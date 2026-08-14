'use client';

import { useTranslations } from 'next-intl';
import { FIELD_CLASS, Field } from '@/components/ui/form-field';
import type {
  DraftProblem,
  VariantDraft,
  VariantField,
} from '@/lib/admin-product-form';

export type VariantFieldErrors = Partial<Record<VariantField, DraftProblem>>;

type VariantFieldsProps = {
  draft: VariantDraft;
  errors: VariantFieldErrors;
  disabled: boolean;
  /** Prefixed so the ids stay unique across a page holding several rows. */
  idPrefix: string;
  onChange: (patch: Partial<VariantDraft>) => void;
};

/**
 * The eight fields of one variant.
 *
 * Both labels and both prices sit side by side rather than in separate
 * "Russian" and "English" tabs: seeing them together is what makes a missing
 * translation obvious while typing, instead of at submit time.
 */
export function VariantFields({
  draft,
  errors,
  disabled,
  idPrefix,
  onChange,
}: VariantFieldsProps) {
  const t = useTranslations('admin');
  const tValidation = useTranslations('validation');

  const message = (field: VariantField): string | undefined => {
    const problem = errors[field];

    if (!problem) {
      return undefined;
    }

    return problem === 'required' ? tValidation('required') : tValidation('amount');
  };

  const text = (
    field: 'sku' | 'labelRu' | 'labelEn' | 'color' | 'config',
    label: string,
    hint?: string,
  ) => (
    <Field
      name={`${idPrefix}-${field}`}
      label={label}
      hint={hint}
      error={message(field)}
    >
      {(props) => (
        <input
          {...props}
          type="text"
          disabled={disabled}
          value={draft[field]}
          onChange={(event) => onChange({ [field]: event.target.value })}
          className={FIELD_CLASS}
        />
      )}
    </Field>
  );

  const amount = (field: 'priceRub' | 'priceUsd' | 'stock', label: string, hint?: string) => (
    <Field
      name={`${idPrefix}-${field}`}
      label={label}
      hint={hint}
      error={message(field)}
    >
      {(props) => (
        <input
          {...props}
          type="text"
          // Not `type="number"`: it rejects the decimal comma a Russian keyboard
          // produces and turns a stray scroll into a price change.
          inputMode="decimal"
          disabled={disabled}
          value={draft[field]}
          onChange={(event) => onChange({ [field]: event.target.value })}
          className={FIELD_CLASS}
        />
      )}
    </Field>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {text('sku', t('sku'), t('skuHint'))}
      {text('labelRu', t('labelRu'))}
      {text('labelEn', t('labelEn'))}
      {amount('stock', t('stock'))}
      {text('color', t('color'), t('optional'))}
      {text('config', t('config'), t('optional'))}
      {amount('priceRub', t('priceRub'), t('priceHintRub'))}
      {amount('priceUsd', t('priceUsd'), t('priceHintUsd'))}
    </div>
  );
}
