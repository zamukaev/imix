# Product artwork

Photographs of the Apple devices iMIX resells. iMIX is a retailer of genuine
hardware, so product imagery identifies the goods actually on sale — see the
hard constraints in `CLAUDE.md`. The brand identity around them stays iMIX.

The files currently here were copied from `assets/` for local development. Before
production, replace them with imagery from Apple's reseller marketing resources
(or own photography) and move serving to the configured asset host — Phase 4
puts them behind `next/image`.

Naming follows `<product-slug>-<n>.<ext>` and is referenced from
`apps/api/prisma/seed.ts`.
