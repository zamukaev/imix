/**
 * A block standing in for content that has not arrived.
 *
 * Two rules make it useful rather than decorative. It has the **shape** of what
 * it replaces — a square where a photograph goes, a short bar where a price
 * goes — so the page does not jump when the real thing lands. And the pulse is
 * `motion-safe:` only: an animation nobody asked for is exactly what
 * `prefers-reduced-motion` exists to switch off (ARCHITECTURE.md §5.4).
 *
 * Screen readers are told nothing here. The route's `loading.tsx` owns the one
 * announcement, so a grid of twelve cards does not read out twelve times.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-surface-alt motion-safe:animate-pulse ${className}`}
    />
  );
}

/**
 * The wrapper every `loading.tsx` uses: one polite announcement for the whole
 * screen, and the skeletons themselves hidden from assistive technology.
 */
export function LoadingScreen({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
