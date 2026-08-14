'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  HOME_TILE_SURFACES,
  HOME_TILE_WIDTHS,
  type AdminHomeTileDto,
} from '@imix/types';
import { ImageUploader } from '@/components/admin/image-uploader';
import { Button } from '@/components/ui/button';
import { FIELD_CLASS, Field, LEGEND_CLASS } from '@/components/ui/form-field';
import { useRouter } from '@/i18n/navigation';
import { createAdminHomeTile, updateAdminHomeTile } from '@/lib/admin-api';
import {
  emptyHomeTileDraft,
  homeTileDraftFrom,
  toHomeTileRequest,
  type HomeTileDraft,
  type HomeTileField,
  type HomeTileFieldErrors,
} from '@/lib/admin-home-tile-form';
import { toUserMessage } from '@/lib/api';

type HomeTileFormProps = {
  /** Absent when creating. */
  tile?: AdminHomeTileDto;
};

/**
 * One tile of the home page, edited whole.
 *
 * Both languages sit side by side rather than behind tabs — a shop window with a
 * headline in one of them is the failure this arrangement is meant to make
 * obvious while typing.
 *
 * The links are checked twice, differently: this form insists that a CTA is
 * complete before it will submit, and the API then resolves the href against the
 * real catalogue. Only the second one can know whether `/phones` is a page.
 */
export function HomeTileForm({ tile }: HomeTileFormProps) {
  const t = useTranslations('admin');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const router = useRouter();

  const [draft, setDraft] = useState<HomeTileDraft>(() =>
    tile ? homeTileDraftFrom(tile) : emptyHomeTileDraft(),
  );
  const [fields, setFields] = useState<HomeTileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const patch = (change: Partial<HomeTileDraft>) => {
    setDraft((current) => ({ ...current, ...change }));
    setNotice(null);
  };

  const submit = async () => {
    const parsed = toHomeTileRequest(draft);

    if (!parsed.ok) {
      setFields(parsed.fields);
      setFormError(null);

      return;
    }

    setPending(true);
    setFields({});
    setFormError(null);

    try {
      if (tile) {
        setDraft(homeTileDraftFrom(await updateAdminHomeTile(tile.id, parsed.value)));
        setNotice(t('savedTile'));
        router.refresh();
      } else {
        await createAdminHomeTile(parsed.value);
        router.push('/admin/home-tiles');
        router.refresh();
      }
    } catch (error) {
      setFormError(toUserMessage(error, tErrors('fallback')));
    } finally {
      setPending(false);
    }
  };

  const message = (field: HomeTileField): string | undefined =>
    fields[field] === undefined ? undefined : tValidation('required');

  const text = (field: HomeTileField, label: string, hint?: string) => (
    <Field name={field} label={label} hint={hint} error={message(field)}>
      {(props) => (
        <input
          {...props}
          type="text"
          disabled={pending}
          value={draft[field]}
          onChange={(event) => patch({ [field]: event.target.value })}
          className={FIELD_CLASS}
        />
      )}
    </Field>
  );

  return (
    <div className="space-y-12">
      <section>
        <h2 className={LEGEND_CLASS}>{t('tileLegend')}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {text('headlineRu', t('headlineRu'))}
          {text('headlineEn', t('headlineEn'))}
          {text('subheadRu', t('subheadRu'), t('optional'))}
          {text('subheadEn', t('subheadEn'), t('optional'))}
          {text('key', t('tileKey'), t('tileKeyHint'))}

          <div className="grid grid-cols-2 gap-4">
            <Field name="width" label={t('width')} error={undefined}>
              {(props) => (
                <select
                  {...props}
                  disabled={pending}
                  value={draft.width}
                  onChange={(event) =>
                    patch({ width: event.target.value as HomeTileDraft['width'] })
                  }
                  className={FIELD_CLASS}
                >
                  {HOME_TILE_WIDTHS.map((value) => (
                    <option key={value} value={value}>
                      {t(value === 'FULL' ? 'widthFull' : 'widthHalf')}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field name="surface" label={t('surface')} error={undefined}>
              {(props) => (
                <select
                  {...props}
                  disabled={pending}
                  value={draft.surface}
                  onChange={(event) =>
                    patch({ surface: event.target.value as HomeTileDraft['surface'] })
                  }
                  className={FIELD_CLASS}
                >
                  {HOME_TILE_SURFACES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={pending}
            checked={draft.published}
            onChange={(event) => patch({ published: event.target.checked })}
            className="border-line size-4 rounded"
          />
          {t('published')}
        </label>
      </section>

      <section>
        <h2 className={LEGEND_CLASS}>{t('imagesLegend')}</h2>
        <p className="text-ink-muted mb-4 text-sm">{t('tileImageNote')}</p>

        <ImageUploader
          images={draft.imageUrl ? [draft.imageUrl] : []}
          max={1}
          disabled={pending}
          onChange={(images) => patch({ imageUrl: images[0] ?? '' })}
        />
        {message('imageUrl') ? (
          <p className="text-danger mt-2 text-xs">{message('imageUrl')}</p>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {text('imageAltRu', t('imageAltRu'), t('altHint'))}
          {text('imageAltEn', t('imageAltEn'), t('altHint'))}
        </div>
      </section>

      <section>
        <h2 className={LEGEND_CLASS}>{t('actionsLegend')}</h2>
        <p className="text-ink-muted mb-4 text-sm">{t('actionsNote')}</p>

        <div className="grid gap-4 sm:grid-cols-3">
          {text('primaryLabelRu', t('primaryLabelRu'))}
          {text('primaryLabelEn', t('primaryLabelEn'))}
          {text('primaryHref', t('href'), t('hrefHint'))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {text('secondaryLabelRu', t('secondaryLabelRu'))}
          {text('secondaryLabelEn', t('secondaryLabelEn'))}
          {text('secondaryHref', t('href'), t('hrefHint'))}
        </div>
      </section>

      {formError ? (
        <p role="alert" className="text-danger text-sm">
          {formError}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="text-success text-sm">
          {notice}
        </p>
      ) : null}

      <div className="border-line border-t pt-6">
        <Button type="button" disabled={pending} onClick={() => void submit()}>
          {pending ? t('saving') : tile ? t('saveTile') : t('createTile')}
        </Button>
      </div>
    </div>
  );
}
