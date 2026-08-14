/**
 * The id every page's `<main>` carries, and the target of the skip link in the
 * storefront layout.
 *
 * In its own module rather than exported from the layout: a page importing a
 * value out of a layout file reads like a dependency it does not have, and Next
 * treats layouts as route entry points rather than as modules to import from.
 */
export const MAIN_CONTENT_ID = 'main-content';
