import type { ComponentPropsWithoutRef } from 'react';
import { Link } from '@/i18n/navigation';

/**
 * The storefront's only button.
 *
 * Two variants and no third — see ARCHITECTURE.md §5.3. Neither knows which
 * ground it was dropped on: colours come from the `--surface-*` contract, which
 * `Tile` re-points per surface, so the same primary reads as a dark pill on a
 * light tile and a light pill on a dark one.
 */
export type ButtonVariant = 'primary' | 'ghost';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-pill px-6 py-3 text-control font-medium whitespace-nowrap transition-[opacity,border-color,background-color] outline-none focus-visible:ring-4 focus-visible:ring-(--surface-ink)/20 disabled:pointer-events-none disabled:opacity-40';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-(--surface-solid-bg) text-(--surface-solid-ink) border border-transparent hover:opacity-90',
  ghost:
    'border border-(--surface-line) text-(--surface-ink) hover:border-(--surface-ink)',
};

function buttonClass(variant: ButtonVariant, fullWidth: boolean, extra?: string): string {
  return [BASE, VARIANTS[variant], fullWidth ? 'w-full' : '', extra ?? '']
    .filter(Boolean)
    .join(' ');
}

type SharedProps = {
  variant?: ButtonVariant;
  /** Stretches to the container — checkout and cart use this, tiles do not. */
  fullWidth?: boolean;
};

export type ButtonProps = ComponentPropsWithoutRef<'button'> & SharedProps;

export function Button({
  variant = 'primary',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={buttonClass(variant, fullWidth, className)}
    />
  );
}

export type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & SharedProps;

/**
 * The same control as a navigation target. Uses the locale-aware `Link`, so a
 * CTA inside a tile keeps the visitor in their language.
 */
export function ButtonLink({
  variant = 'primary',
  fullWidth = false,
  className,
  ...props
}: ButtonLinkProps) {
  return <Link {...props} className={buttonClass(variant, fullWidth, className)} />;
}
