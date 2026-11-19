/**
 * Which images bypass Next's image optimiser and go to the browser as stored.
 *
 * Pass the result as `unoptimized` on every `next/image` that renders a URL out
 * of the database — a product photo, a colour swatch, a home tile banner — so
 * the rule lives here and not at each call site.
 */

/**
 * Where the API's local-disk storage serves uploads from. Mirrors
 * `PUBLIC_PREFIX` in `apps/api/src/admin/storage/local-disk.storage.ts`.
 */
const UPLOADS_PREFIX = '/uploads/';

/**
 * - **Uploads.** In production the API writes them to a volume that nginx
 *   serves at `/uploads/…`, and the storefront container never sees that disk.
 *   The optimiser resolves a relative URL inside its own container, finds
 *   nothing and answers 400, so the image never renders. Served as-is, the
 *   browser asks nginx, which has the file. Next also only serves `public/`
 *   files that existed at build time, so mounting the volume into the
 *   storefront would not help either.
 * - **SVG.** The optimiser refuses vectors unless the whole app opts in with
 *   `dangerouslyAllowSVG`, which would apply to every uploaded file too, and a
 *   vector has nothing to optimise anyway.
 *
 * Everything else — the seeded photography in `public/`, and absolute
 * Cloudinary URLs — keeps going through the optimiser.
 */
export function isServedAsStored(src: string): boolean {
  return src.startsWith(UPLOADS_PREFIX) || src.toLowerCase().endsWith('.svg');
}
