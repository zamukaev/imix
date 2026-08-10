import { Injectable } from '@nestjs/common';
import {
  DEFAULT_LOCALE,
  type HomeTileActionDto,
  type HomeTileActions,
  type HomeTileDto,
  type Locale,
} from '@imix/types';
import { Prisma } from '@prisma/client';
import { text } from '../common/localisation';
import { PrismaService } from '../prisma/prisma.service';

const tileSelect = {
  id: true,
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

type HomeTileRow = Prisma.HomeTileGetPayload<{ select: typeof tileSelect }>;

@Injectable()
export class HomeTilesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The published tiles, in order.
   *
   * Deliberately a flat list: pairing two `HALF` tiles is a rendering decision
   * and belongs to whoever is laying out the page, not to the API.
   */
  async findAll(locale: Locale = DEFAULT_LOCALE): Promise<HomeTileDto[]> {
    const tiles = await this.prisma.homeTile.findMany({
      where: { published: true },
      select: tileSelect,
      // `position` is not unique, so `id` breaks ties and keeps the order total
      // — two tiles sharing a position must not swap between requests.
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });

    return tiles.map((tile) => toHomeTileDto(tile, locale));
  }
}

function toHomeTileDto(tile: HomeTileRow, locale: Locale): HomeTileDto {
  return {
    id: tile.id,
    width: tile.width,
    surface: tile.surface,
    headline: text(locale, { ru: tile.headlineRu, en: tile.headlineEn }),
    subhead: optionalText(locale, tile.subheadRu, tile.subheadEn),
    image: {
      src: tile.imageUrl,
      // Null means decorative, which is an empty alt — not a missing one.
      alt: optionalText(locale, tile.imageAltRu, tile.imageAltEn) ?? '',
    },
    actions: toActions(tile, locale),
  };
}

/**
 * Builds the action tuple, dropping anything incomplete.
 *
 * A label with no href — or an href whose label was never translated — cannot
 * be rendered honestly, so it does not reach the storefront at all. A secondary
 * without a primary is promoted rather than left dangling: the tile still has
 * one thing to do.
 */
function toActions(tile: HomeTileRow, locale: Locale): HomeTileActions {
  const primary = toAction(
    locale,
    tile.primaryLabelRu,
    tile.primaryLabelEn,
    tile.primaryHref,
  );
  const secondary = toAction(
    locale,
    tile.secondaryLabelRu,
    tile.secondaryLabelEn,
    tile.secondaryHref,
  );

  if (primary && secondary) {
    return [primary, secondary];
  }

  const only = primary ?? secondary;

  return only ? [only] : [];
}

function toAction(
  locale: Locale,
  labelRu: string | null,
  labelEn: string | null,
  href: string | null,
): HomeTileActionDto | null {
  const label = optionalText(locale, labelRu, labelEn);

  return label && href ? { label, href } : null;
}

/** Resolves a nullable translated pair; null when this locale has no text. */
function optionalText(
  locale: Locale,
  ru: string | null,
  en: string | null,
): string | null {
  return locale === 'ru' ? ru : en;
}
