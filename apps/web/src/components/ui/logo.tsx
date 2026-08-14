import Image from 'next/image';

/**
 * Two cuts of one artwork, both taken from `public/logo.jpg`: `mark` is the
 * wordmark alone, for the thin nav bar where the "INTER STORE" line would be
 * unreadable anyway; `lockup` is the full signature, for the footer where there
 * is room for it. Both have their ground cut away, so they sit on the
 * translucent nav and on either neutral surface without a white box behind them.
 *
 * Cutting the ground away is not only a matter of alpha. The source ground is
 * RGB 254, and the antialiased edge pixels came out of it carrying that white as
 * their colour — invisible on white, a light halo everywhere else, most of all
 * under the nav when a dark tile scrolls beneath it. So the edge was un-matted:
 * `C = a·F + (1-a)·254` solved back for `F`, with alpha below 8/255 dropped as
 * JPEG dust. The mask itself is untouched and fully opaque pixels are unchanged.
 *
 * The files are 640px wide so a 3× screen has something to work with; `sizes` is
 * what each cut actually occupies, and keeps the optimiser from serving that
 * full width to a 78px slot in the nav.
 */
const ASSETS = {
  mark: { src: '/brand/logo-mark.png', width: 640, height: 194, sizes: '96px' },
  lockup: {
    src: '/brand/logo-lockup.png',
    width: 640,
    height: 285,
    sizes: '128px',
  },
} as const;

export type LogoVariant = keyof typeof ASSETS;

type LogoProps = {
  variant?: LogoVariant;
  /** Set the height here and leave the width to `w-auto`. */
  className?: string;
  /** The header's logo is above the fold on every page; the footer's is not. */
  priority?: boolean;
};

/**
 * The iMIX wordmark.
 *
 * `alt` is empty on purpose: the logo never carries the accessible name. It is
 * always either inside a link that names itself (`aria-label`) or next to text
 * that already says "iMIX", and a second announcement of the brand is noise.
 */
export function Logo({ variant = 'mark', className, priority = false }: LogoProps) {
  return (
    <Image
      {...ASSETS[variant]}
      alt=""
      priority={priority}
      className={className}
    />
  );
}
