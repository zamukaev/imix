import type { ReactNode } from 'react';

/**
 * The look of a text control, in one place.
 *
 * Every form in the shop reaches for these two rather than restyling an input:
 * checkout and sign-in have to look like the same shop, and the way that stops
 * being true is one form quietly growing its own border radius.
 */
export const FIELD_CLASS =
  'border-line focus-visible:border-ink focus-visible:ring-ink/15 aria-invalid:border-danger w-full rounded-xl border bg-transparent px-4 py-3 text-sm outline-none transition-colors focus-visible:ring-4';

export const LEGEND_CLASS = 'text-ink-muted mb-4 text-xs tracking-widest uppercase';

export type FieldRenderProps<TName extends string> = {
  id: TName;
  name: TName;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
};

export type FieldProps<TName extends string> = {
  name: TName;
  label: string;
  hint?: string;
  error: string | undefined;
  children: (props: FieldRenderProps<TName>) => ReactNode;
};

/**
 * Label, control and message as one unit. The control is a render prop so each
 * field keeps its own input type while the wiring between the three ids — and
 * the `aria-describedby` that makes a screen reader read the error out — stays
 * in a single place.
 */
export function Field<TName extends string>({
  name,
  label,
  hint,
  error,
  children,
}: FieldProps<TName>) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>

      {children({
        id: name,
        name,
        'aria-invalid': error !== undefined,
        'aria-describedby': describedBy,
      })}

      {error ? (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-ink-muted text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
