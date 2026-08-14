'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MIN_PASSWORD_LENGTH } from '@imix/types';
import { Button } from '@/components/ui/button';
import { FIELD_CLASS, Field } from '@/components/ui/form-field';
import { Link, useRouter } from '@/i18n/navigation';
import { RETURN_TO_PARAM, safeReturnTo } from '@/lib/session-routes';
import {
  EMPTY_AUTH_FORM,
  parseAuthForm,
  readAuthForm,
  type AuthFieldErrors,
  type AuthFormRaw,
  type AuthValidationMessages,
} from '@/lib/auth-form';

export type AuthMode = 'login' | 'register';

type AuthFormState = {
  values: AuthFormRaw;
  fieldErrors: AuthFieldErrors;
  formError: string | null;
};

const INITIAL_STATE: AuthFormState = {
  values: EMPTY_AUTH_FORM,
  fieldErrors: {},
  formError: null,
};

/**
 * Sign in and sign up — one component, because the two differ by a field and a
 * heading and nothing else.
 *
 * It posts to this app's own `/api/auth/*` rather than to the API, and gets the
 * account back rather than a token: the tokens stop at that route handler and
 * become httpOnly cookies. Nothing here ever holds one.
 */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const t = useTranslations('auth');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  // Set by the middleware when it turned somebody away from a page they were
  // heading for. Validated rather than trusted: see `safeReturnTo`.
  const returnTo = safeReturnTo(useSearchParams().get(RETURN_TO_PARAM));

  const [state, submit, isPending] = useActionState<AuthFormState, FormData>(
    async (_previous, formData) => {
      const values = readAuthForm(formData);
      const parsed = parseAuthForm(values, mode, toValidationMessages(tValidation));

      if (!parsed.ok) {
        return { values, fieldErrors: parsed.fieldErrors, formError: null };
      }

      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'register'
            ? {
                email: parsed.values.email,
                password: parsed.values.password,
                name: parsed.values.name,
              }
            : { email: parsed.values.email, password: parsed.values.password },
        ),
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          typeof body === 'object' && body !== null && 'message' in body
            ? String((body as { message: unknown }).message)
            : tErrors('fallback');

        // The password is deliberately not carried back: a rejected sign-in
        // should be retyped, not resubmitted from a stale field.
        return {
          values: { ...values, password: '' },
          fieldErrors: {},
          formError: message,
        };
      }

      if (returnTo) {
        // A full navigation rather than `router.push`: the value already
        // carries its own locale prefix (the middleware copied it off the path
        // it turned away), and the locale-aware router would add a second one.
        window.location.assign(returnTo);

        return INITIAL_STATE;
      }

      // `refresh` re-renders the Server Components with the new cookie in place,
      // so the header shows the account without a full page load.
      router.push('/');
      router.refresh();

      return INITIAL_STATE;
    },
    INITIAL_STATE,
  );

  const isRegister = mode === 'register';

  return (
    <form action={submit} noValidate className="space-y-6">
      <fieldset disabled={isPending} className="space-y-4">
        <Field name="email" label={t('email')} error={state.fieldErrors.email}>
          {(props) => (
            <input
              {...props}
              type="email"
              inputMode="email"
              autoComplete="email"
              defaultValue={state.values.email}
              className={FIELD_CLASS}
            />
          )}
        </Field>

        <Field
          name="password"
          label={t('password')}
          hint={isRegister ? t('passwordHint', { count: MIN_PASSWORD_LENGTH }) : undefined}
          error={state.fieldErrors.password}
        >
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              defaultValue={state.values.password}
              className={FIELD_CLASS}
            />
          )}
        </Field>

        {isRegister ? (
          <Field
            name="name"
            label={t('name')}
            hint={t('nameHint')}
            error={state.fieldErrors.name}
          >
            {(props) => (
              <input
                {...props}
                type="text"
                autoComplete="name"
                defaultValue={state.values.name}
                className={FIELD_CLASS}
              />
            )}
          </Field>
        ) : null}
      </fieldset>

      {state.formError ? (
        <p role="alert" className="text-danger text-sm">
          {state.formError}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} fullWidth>
        {isPending
          ? t(isRegister ? 'signUpPending' : 'signInPending')
          : t(isRegister ? 'signUpSubmit' : 'signInSubmit')}
      </Button>

      <p className="text-ink-muted text-center text-sm">
        {isRegister ? t('haveAccount') : t('noAccount')}{' '}
        <Link
          href={isRegister ? '/login' : '/register'}
          className="text-brand hover:underline"
        >
          {isRegister ? t('signInLink') : t('signUpLink')}
        </Link>
      </p>
    </form>
  );
}

/**
 * Lifts the `validation` namespace into the plain object the schemas take, so
 * `auth-form.ts` stays free of React and of next-intl.
 */
function toValidationMessages(
  t: ReturnType<typeof useTranslations<'validation'>>,
): AuthValidationMessages {
  return {
    email: t('authEmail'),
    password: t('password'),
    passwordTooShort: t('passwordTooShort', { count: MIN_PASSWORD_LENGTH }),
    passwordTooLong: t('passwordTooLong'),
    nameTooLong: t('nameTooLong'),
  };
}
