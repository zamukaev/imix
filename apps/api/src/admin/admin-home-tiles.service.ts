import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AdminHomeTileDto, TileMoveDirection } from '@imix/types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WriteHomeTileDto } from './dto/write-home-tile.dto';
import { StorefrontHrefService } from './storefront-href.service';

const UNIQUE_VIOLATION = 'P2002';

/**
 * Gaps between positions, so a tile can be dropped between two others without
 * renumbering. `move` rewrites the whole list to multiples of this, which also
 * repairs any collisions the seed or an older row left behind.
 */
const POSITION_STEP = 10;

const tileSelect = {
  id: true,
  key: true,
  position: true,
  published: true,
  width: true,
  surface: true,
  headlineRu: true,
  headlineEn: true,
  subheadRu: true,
  subheadEn: true,
  imageUrl: true,
  imageAltRu: true,
  imageAltEn: true,
  primaryLabelRu: true,
  primaryLabelEn: true,
  primaryHref: true,
  secondaryLabelRu: true,
  secondaryLabelEn: true,
  secondaryHref: true,
} satisfies Prisma.HomeTileSelect;

/** The order the storefront reads them in — `id` breaks ties, as it does there. */
const tileOrder: Prisma.HomeTileOrderByWithRelationInput[] = [
  { position: 'asc' },
  { id: 'asc' },
];

/** One CTA, named so an error message can say which of the two is half-filled. */
type ActionSlot = 'primary' | 'secondary';

@Injectable()
export class AdminHomeTilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hrefs: StorefrontHrefService,
  ) {}

  /** Every tile, drafts included — the admin owns the unpublished ones too. */
  async findAll(): Promise<AdminHomeTileDto[]> {
    return this.prisma.homeTile.findMany({ select: tileSelect, orderBy: tileOrder });
  }

  async create(dto: WriteHomeTileDto): Promise<AdminHomeTileDto> {
    await this.assertActionsUsable(dto);

    const last = await this.prisma.homeTile.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    try {
      return await this.prisma.homeTile.create({
        // A new tile lands at the end. Somewhere else would be a guess about
        // editorial intent, and `move` is one click away.
        data: { ...toData(dto), position: (last?.position ?? 0) + POSITION_STEP },
        select: tileSelect,
      });
    } catch (error) {
      throw this.explain(error, dto.key);
    }
  }

  async update(id: string, dto: WriteHomeTileDto): Promise<AdminHomeTileDto> {
    await this.assertActionsUsable(dto);
    await this.assertExists(id);

    try {
      return await this.prisma.homeTile.update({
        where: { id },
        data: toData(dto),
        select: tileSelect,
      });
    } catch (error) {
      throw this.explain(error, dto.key);
    }
  }

  async remove(id: string): Promise<void> {
    await this.assertExists(id);

    await this.prisma.homeTile.delete({ where: { id } });
  }

  /**
   * Swaps a tile with its neighbour and renumbers the list.
   *
   * Renumbering rather than swapping two numbers: `position` is deliberately not
   * unique (ARCHITECTURE.md §2), so two tiles can share one, and swapping equal
   * numbers is a no-op that looks like a broken button. Rewriting all of them to
   * `(index + 1) * 10` is a handful of updates for a page that holds eight tiles,
   * and it leaves the order total whatever state it started in.
   */
  async move(id: string, direction: TileMoveDirection): Promise<AdminHomeTileDto[]> {
    const tiles = await this.prisma.homeTile.findMany({
      select: { id: true },
      orderBy: tileOrder,
    });
    const from = tiles.findIndex((tile) => tile.id === id);

    if (from === -1) {
      throw new NotFoundException(`No home tile with id "${id}"`);
    }

    const to = direction === 'UP' ? from - 1 : from + 1;

    if (to < 0 || to >= tiles.length) {
      // Already at the end it was asked to move towards. Not an error: the
      // button is simply disabled a moment later than the click arrived.
      return this.findAll();
    }

    const reordered = [...tiles];
    const [moved] = reordered.splice(from, 1);

    if (moved) {
      reordered.splice(to, 0, moved);
    }

    await this.prisma.$transaction(
      reordered.map((tile, index) =>
        this.prisma.homeTile.update({
          where: { id: tile.id },
          data: { position: (index + 1) * POSITION_STEP },
        }),
      ),
    );

    return this.findAll();
  }

  /**
   * Refuses a CTA that cannot be rendered, and one that points nowhere.
   *
   * Two separate problems. A half-filled action — a label in one language, or a
   * label with no href — is silently dropped by the storefront (see
   * `HomeTilesService.toActions`), which is the right thing to do with a row
   * that already exists and the wrong thing to do with an edit somebody is
   * making right now: they would press save and watch nothing appear.
   *
   * The href is then resolved against the real catalogue. A shop window that can
   * link anywhere eventually links somewhere broken, and until now nothing
   * checked it.
   */
  private async assertActionsUsable(dto: WriteHomeTileDto): Promise<void> {
    for (const slot of ['primary', 'secondary'] as const) {
      const labelRu = dto[`${slot}LabelRu`] ?? null;
      const labelEn = dto[`${slot}LabelEn`] ?? null;
      const href = dto[`${slot}Href`] ?? null;
      const filled = [labelRu, labelEn, href].filter((part) => part !== null).length;

      if (filled === 0) {
        continue;
      }

      if (filled < 3) {
        throw new BadRequestException(this.incompleteMessage(slot, labelRu, labelEn, href));
      }

      const unreachable = await this.hrefs.explainIfUnreachable(href ?? '');

      if (unreachable) {
        throw new BadRequestException(`The ${slot} link goes nowhere: ${unreachable}`);
      }
    }
  }

  private incompleteMessage(
    slot: ActionSlot,
    labelRu: string | null,
    labelEn: string | null,
    href: string | null,
  ): string {
    const missing = [
      labelRu === null ? 'a Russian label' : null,
      labelEn === null ? 'an English label' : null,
      href === null ? 'a link' : null,
    ].filter((part): part is string => part !== null);

    return `The ${slot} action is missing ${missing.join(' and ')}. Fill it in or clear it — a half-filled button is never shown.`;
  }

  private async assertExists(id: string): Promise<void> {
    const tile = await this.prisma.homeTile.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!tile) {
      throw new NotFoundException(`No home tile with id "${id}"`);
    }
  }

  private explain(error: unknown, key: string): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION
    ) {
      return new ConflictException(`A home tile with the key "${key}" already exists.`);
    }

    return error;
  }
}

/** Every optional field settles to `null` rather than staying undefined. */
function toData(dto: WriteHomeTileDto): Omit<Prisma.HomeTileCreateInput, 'position'> {
  return {
    key: dto.key,
    published: dto.published,
    width: dto.width,
    surface: dto.surface,
    headlineRu: dto.headlineRu,
    headlineEn: dto.headlineEn,
    subheadRu: dto.subheadRu ?? null,
    subheadEn: dto.subheadEn ?? null,
    imageUrl: dto.imageUrl,
    imageAltRu: dto.imageAltRu ?? null,
    imageAltEn: dto.imageAltEn ?? null,
    primaryLabelRu: dto.primaryLabelRu ?? null,
    primaryLabelEn: dto.primaryLabelEn ?? null,
    primaryHref: dto.primaryHref ?? null,
    secondaryLabelRu: dto.secondaryLabelRu ?? null,
    secondaryLabelEn: dto.secondaryLabelEn ?? null,
    secondaryHref: dto.secondaryHref ?? null,
  };
}
