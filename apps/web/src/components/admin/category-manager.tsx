'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AdminCategoryDto } from '@imix/types';
import { Button } from '@/components/ui/button';
import { FIELD_CLASS, Field, LEGEND_CLASS } from '@/components/ui/form-field';
import { useRouter } from '@/i18n/navigation';
import {
  createAdminCategory,
  deleteAdminCategory,
  updateAdminCategory,
} from '@/lib/admin-api';
import { toUserMessage } from '@/lib/api';

type Draft = { slug: string; nameRu: string; nameEn: string };

const EMPTY: Draft = { slug: '', nameRu: '', nameEn: '' };

/**
 * The category list, editable in place.
 *
 * A separate page per category would be three clicks to rename one, and there
 * are six of them. `productCount` is shown next to each because it is the reason
 * a delete will be refused — better to see it before pressing the button than in
 * the error afterwards.
 */
export function CategoryManager({ categories }: { categories: AdminCategoryDto[] }) {
  const t = useTranslations('admin');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      categories.map((category) => [
        category.id,
        { slug: category.slug, nameRu: category.nameRu, nameEn: category.nameEn },
      ]),
    ),
  );
  const [fresh, setFresh] = useState<Draft>(EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);

    try {
      await action();
      router.refresh();
    } catch (failure) {
      setError(toUserMessage(failure, tErrors('fallback')));
    } finally {
      setPending(false);
    }
  };

  const isComplete = (draft: Draft) =>
    draft.slug.trim() !== '' && draft.nameRu.trim() !== '' && draft.nameEn.trim() !== '';

  const fields = (draft: Draft, prefix: string, onChange: (patch: Partial<Draft>) => void) => (
    <div className="grid flex-1 gap-3 sm:grid-cols-3">
      {(['nameRu', 'nameEn', 'slug'] as const).map((field) => (
        <Field
          key={field}
          name={`${prefix}-${field}`}
          label={t(field === 'slug' ? 'slug' : field)}
          error={undefined}
        >
          {(props) => (
            <input
              {...props}
              type="text"
              disabled={pending}
              value={draft[field]}
              onChange={(event) => onChange({ [field]: event.target.value })}
              className={FIELD_CLASS}
            />
          )}
        </Field>
      ))}
    </div>
  );

  return (
    <div className="space-y-10">
      <section>
        <h2 className={LEGEND_CLASS}>{t('addCategory')}</h2>
        <div className="border-line bg-surface rounded-card border p-5">
          {fields(fresh, 'new-category', (patch) =>
            setFresh((current) => ({ ...current, ...patch })),
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={pending || !isComplete(fresh)}
            className="mt-4"
            onClick={() =>
              void run(async () => {
                await createAdminCategory(fresh);
                setFresh(EMPTY);
              })
            }
          >
            {t('addCategory')}
          </Button>
        </div>
      </section>

      <section>
        <h2 className={LEGEND_CLASS}>{t('categories')}</h2>

        <ul className="space-y-4">
          {categories.map((category) => {
            const draft = drafts[category.id] ?? EMPTY;

            return (
              <li
                key={category.id}
                className="border-line bg-surface rounded-card border p-5"
              >
                {fields(draft, category.id, (patch) =>
                  setDrafts((current) => ({
                    ...current,
                    [category.id]: { ...draft, ...patch },
                  })),
                )}

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending || !isComplete(draft)}
                    onClick={() =>
                      void run(() =>
                        updateAdminCategory(category.id, draft).then(() => undefined),
                      )
                    }
                  >
                    {t('save')}
                  </Button>

                  <span className="text-ink-muted text-xs">
                    {t('categoryProducts', { count: category.productCount })}
                  </span>

                  {confirming === category.id ? (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          void run(async () => {
                            await deleteAdminCategory(category.id);
                            setConfirming(null);
                          })
                        }
                        className="text-danger ml-auto text-xs font-medium hover:underline"
                      >
                        {t('confirmDeleteCategory')}
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
                      disabled={pending || category.productCount > 0}
                      onClick={() => setConfirming(category.id)}
                      title={
                        category.productCount > 0 ? t('categoryNotEmpty') : undefined
                      }
                      className="text-danger ml-auto text-xs hover:underline disabled:opacity-40"
                    >
                      {t('delete')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
