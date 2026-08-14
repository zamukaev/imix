'use client';

import { useState } from 'react';
import type { Route } from 'next';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { AdminHomeTileDto, TileMoveDirection } from '@imix/types';
import { Link, useRouter } from '@/i18n/navigation';
import { deleteAdminHomeTile, moveAdminHomeTile } from '@/lib/admin-api';
import { toUserMessage } from '@/lib/api';

/**
 * The shop window, in the order it is rendered.
 *
 * Reordering is two buttons rather than drag-and-drop: the list is eight tiles
 * long, a swap is what an editor actually wants, and a drag surface that works
 * on a phone is a library this project does not need. Each move renumbers the
 * whole list on the server and hands it back.
 *
 * Half tiles are marked, because the pairing rule is not visible from a row: two
 * consecutive halves become one row on the storefront, and a half left alone is
 * rendered full width.
 */
export function HomeTileList({ tiles }: { tiles: AdminHomeTileDto[] }) {
  const t = useTranslations('admin');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setPending(id);
    setError(null);

    try {
      await action();
      router.refresh();
    } catch (failure) {
      setError(toUserMessage(failure, tErrors('fallback')));
    } finally {
      setPending(null);
    }
  };

  const move = (id: string, direction: TileMoveDirection) =>
    run(id, () => moveAdminHomeTile(id, direction));

  if (tiles.length === 0) {
    return <p className="text-ink-muted mt-12">{t('noTiles')}</p>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}

      <ul className="space-y-4">
        {tiles.map((tile, index) => (
          <li
            key={tile.id}
            className="border-line bg-surface rounded-card flex flex-wrap items-start gap-4 border p-4"
          >
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={index === 0 || pending !== null}
                onClick={() => void move(tile.id, 'UP')}
                aria-label={t('moveUp')}
                className="border-line text-ink-muted hover:text-ink rounded border px-2 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === tiles.length - 1 || pending !== null}
                onClick={() => void move(tile.id, 'DOWN')}
                aria-label={t('moveDown')}
                className="border-line text-ink-muted hover:text-ink rounded border px-2 disabled:opacity-30"
              >
                ↓
              </button>
            </div>

            <Image
              src={tile.imageUrl}
              alt=""
              width={224}
              height={128}
              sizes="112px"
              className="border-line h-16 w-28 shrink-0 rounded-lg border object-cover"
            />

            <div className="min-w-48 flex-1">
              <p className="font-medium">{tile.headlineRu}</p>
              <p className="text-ink-muted text-sm">{tile.headlineEn}</p>
              <p className="text-ink-muted mt-1 text-xs">
                {tile.published ? t('published') : t('draft')} ·{' '}
                {t(tile.width === 'FULL' ? 'widthFull' : 'widthHalf')} · {tile.surface}
                {tile.primaryHref ? ` · ${tile.primaryHref}` : ''}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-4 text-sm">
              <Link
                href={`/admin/home-tiles/${tile.id}` as Route}
                className="hover:underline"
              >
                {t('edit')}
              </Link>

              {confirming === tile.id ? (
                <>
                  <button
                    type="button"
                    disabled={pending !== null}
                    onClick={() =>
                      void run(tile.id, async () => {
                        await deleteAdminHomeTile(tile.id);
                        setConfirming(null);
                      })
                    }
                    className="text-danger text-xs font-medium hover:underline"
                  >
                    {t('confirmDeleteTile')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="text-ink-muted text-xs hover:underline"
                  >
                    {t('cancel')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => setConfirming(tile.id)}
                  className="text-danger text-xs hover:underline disabled:opacity-40"
                >
                  {t('delete')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
