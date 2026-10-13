'use client';

import { useTranslations } from 'next-intl';
import { ImageUploader } from '@/components/admin/image-uploader';
import { Button } from '@/components/ui/button';
import { FIELD_CLASS, Field } from '@/components/ui/form-field';
import type { ColorDraft, ColorField, DraftProblem } from '@/lib/admin-product-form';

export type ColorFieldErrors = Partial<Record<ColorField, DraftProblem>>;

type ColorFieldsProps = {
  draft: ColorDraft;
  errors: ColorFieldErrors;
  disabled: boolean;
  idPrefix: string;
  onChange: (patch: Partial<ColorDraft>) => void;
  onRemove: () => void;
};

/**
 * One finish: its handle, its two names, its swatch and its photographs.
 *
 * The photographs are the reason this is a section of its own rather than three
 * more columns on the variant row. Several variants share one finish — 256 GB
 * and 512 GB in Lavender are the same lavender device — so the pictures belong
 * to the colour, and hanging them off a variant would mean uploading them twice.
 */
export function ColorFields({
  draft,
  errors,
  disabled,
  idPrefix,
  onChange,
  onRemove,
}: ColorFieldsProps) {
  const t = useTranslations('admin');
  const tValidation = useTranslations('validation');

  const message = (field: ColorField): string | undefined => {
    const problem = errors[field];

    if (!problem) {
      return undefined;
    }

    return problem === 'required' ? tValidation('required') : tValidation('hex');
  };

  const text = (field: 'slug' | 'nameRu' | 'nameEn', label: string, hint?: string) => (
    <Field name={`${idPrefix}-${field}`} label={label} hint={hint} error={message(field)}>
      {(props) => (
        <input
          {...props}
          type="text"
          // The slug is what a variant points at. Once a variant does, renaming
          // it would orphan that variant — so it locks and the name fields, which
          // are only ever displayed, stay editable.
          disabled={disabled || (field === 'slug' && draft.inUse === true)}
          value={draft[field]}
          onChange={(event) => onChange({ [field]: event.target.value })}
          className={FIELD_CLASS}
        />
      )}
    </Field>
  );

  return (
    <div className="border-line space-y-4 rounded-xl border p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {text('slug', t('colorSlug'), t('colorSlugHint'))}
        {text('nameRu', t('colorNameRu'))}
        {text('nameEn', t('colorNameEn'))}

        <Field
          name={`${idPrefix}-hex`}
          label={t('colorHex')}
          hint={t('colorHexHint')}
          error={message('hex')}
        >
          {(props) => (
            <div className="flex items-center gap-2">
              <input
                {...props}
                type="text"
                disabled={disabled}
                value={draft.hex}
                onChange={(event) => onChange({ hex: event.target.value })}
                className={FIELD_CLASS}
              />
              {/*
                The native picker beside the text field rather than instead of
                it: it is the quick way to land on a colour, and the text field
                is the only way to paste an exact value from a spec sheet.
              */}
              <input
                type="color"
                aria-label={t('colorPick')}
                disabled={disabled}
                value={/^#[0-9a-fA-F]{6}$/.test(draft.hex) ? draft.hex : '#000000'}
                onChange={(event) => onChange({ hex: event.target.value })}
                className="border-line size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent"
              />
            </div>
          )}
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{t('colorImages')}</p>
        <p className="text-ink-muted text-sm">{t('colorImagesHint')}</p>
        <ImageUploader
          images={draft.images}
          onChange={(images) => onChange({ images })}
          disabled={disabled}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" disabled={disabled || draft.inUse === true} onClick={onRemove}>
          {t('removeColor')}
        </Button>
        {draft.inUse === true ? (
          <p className="text-ink-muted text-sm">{t('colorInUse')}</p>
        ) : null}
      </div>
    </div>
  );
}
