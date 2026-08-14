'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Reveals its children once, as they scroll into view.
 *
 * The whole motion budget from ARCHITECTURE.md §5.4, and nothing else: opacity
 * plus a short upward translate, under 500 ms, no bounce, no scale, no spin.
 *
 * Three things make it safe rather than decorative:
 *
 * - **It starts visible.** The hidden state is applied by the effect, which only
 *   runs on the client. So a page with JavaScript disabled, a crawler, and the
 *   server-rendered HTML all show the content — the animation is an enhancement
 *   layered on top, never the thing that makes the tile appear.
 * - **`prefers-reduced-motion` skips it entirely.** Not "a shorter animation":
 *   the element is simply never hidden, checked in the same effect rather than
 *   in CSS so the initial state is right too.
 * - **It fires once and disconnects.** A tile that faded in should stay in;
 *   re-animating on every scroll past is the thing that makes this pattern
 *   tiresome.
 *
 * No GSAP and no ScrollTrigger. Those arrive in Phase 5 for the scroll-driven 3D
 * hero, where a timeline is genuinely needed; an `IntersectionObserver` and two
 * CSS properties are the whole of this.
 */
export function Reveal({
  children,
  /** Tens of milliseconds, to stagger siblings within one tile. */
  delayMs = 0,
  className = '',
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (reducedMotion.matches) {
      return;
    }

    // Anything already on screen when the effect runs — the first tile, above
    // the fold — must not be hidden and then faded in. That would be a flash of
    // missing content on every page load.
    if (element.getBoundingClientRect().top < window.innerHeight) {
      return;
    }

    setHidden(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHidden(false);
          observer.disconnect();
        }
      },
      // A little before the edge, so the reveal is finishing as the element
      // arrives rather than starting once it is already being read.
      { rootMargin: '0px 0px -10% 0px' },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={hidden ? undefined : { transitionDelay: `${delayMs}ms` }}
      className={[
        'motion-safe:transition-[opacity,translate] motion-safe:duration-500 motion-safe:ease-out',
        hidden ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
