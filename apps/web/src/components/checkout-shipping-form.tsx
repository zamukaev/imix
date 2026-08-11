'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { FIELD_CLASS, Field, LEGEND_CLASS } from '@/components/ui/form-field';
import {
  SHIPPING_COUNTRY_CODES,
  type ShippingFieldErrors,
  type ShippingFormRaw,
} from '@/lib/checkout';
import { formatCountry } from '@/lib/format';

type CheckoutShippingFormProps = {
  /** Server action wired up by `useActionState` on the page. */
  action: (formData: FormData) => void;
  /** Values as last typed, so a rejected submission comes back filled in. */
  defaults: ShippingFormRaw;
  fieldErrors: ShippingFieldErrors;
  /** Whole-form failure — an API refusal rather than a bad field. */
  formError: string | null;
  isPending: boolean;
  /** Set when the server has no Stripe key, so paying cannot work. */
  disabledReason: string | null;
};

/**
 * Step one of checkout: where the parcel goes. Validation runs again on the
 * server, so this is about telling the shopper what to fix, not about trust.
 */
export function CheckoutShippingForm({
  action,
  defaults,
  fieldErrors,
  formError,
  isPending,
  disabledReason,
}: CheckoutShippingFormProps) {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const busy = isPending || disabledReason !== null;

  return (
    <form action={action} noValidate className="space-y-8">
      <fieldset disabled={busy}>
        <legend className={LEGEND_CLASS}>{t('contactLegend')}</legend>

        <div className="space-y-4">
          <Field
            name="email"
            label={t('email')}
            hint={t('emailHint')}
            error={fieldErrors.email}
          >
            {(props) => (
              <input
                {...props}
                type="email"
                inputMode="email"
                autoComplete="email"
                defaultValue={defaults.email}
                className={FIELD_CLASS}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset disabled={busy}>
        <legend className={LEGEND_CLASS}>{t('shippingLegend')}</legend>

        <div className="space-y-4">
          <Field name="name" label={t('name')} error={fieldErrors.name}>
            {(props) => (
              <input
                {...props}
                type="text"
                autoComplete="name"
                defaultValue={defaults.name}
                className={FIELD_CLASS}
              />
            )}
          </Field>

          <Field name="address" label={t('address')} error={fieldErrors.address}>
            {(props) => (
              <input
                {...props}
                type="text"
                autoComplete="street-address"
                defaultValue={defaults.address}
                className={FIELD_CLASS}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <Field name="zip" label={t('zip')} error={fieldErrors.zip}>
              {(props) => (
                <input
                  {...props}
                  type="text"
                  autoComplete="postal-code"
                  defaultValue={defaults.zip}
                  className={FIELD_CLASS}
                />
              )}
            </Field>

            <Field name="city" label={t('city')} error={fieldErrors.city}>
              {(props) => (
                <input
                  {...props}
                  type="text"
                  autoComplete="address-level2"
                  defaultValue={defaults.city}
                  className={FIELD_CLASS}
                />
              )}
            </Field>
          </div>

          <Field name="country" label={t('country')} error={fieldErrors.country}>
            {(props) => (
              <select
                {...props}
                autoComplete="country"
                defaultValue={defaults.country}
                className={FIELD_CLASS}
              >
                {SHIPPING_COUNTRY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {formatCountry(code, locale)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </fieldset>

      {formError ? (
        <p role="alert" className="text-danger text-sm">
          {formError}
        </p>
      ) : null}

      {disabledReason ? (
        <p
          role="status"
          className="text-ink-muted border-line rounded-xl border border-dashed p-4 text-sm"
        >
          {disabledReason}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending || disabledReason !== null} fullWidth>
        {isPending ? t('submitPending') : t('submit')}
      </Button>
    </form>
  );
}

