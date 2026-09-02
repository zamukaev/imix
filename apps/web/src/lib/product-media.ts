/**
 * What the product detail page can show for one product, and which of it comes
 * up first.
 *
 * This is the whole decision, kept out of the component because it is the part
 * with rules: a product may have photos, a model, both or neither, and 3D is an
 * enhancement layer that must never be the only way to see the goods
 * (ARCHITECTURE.md §6).
 */

export type ProductMediaMode = 'photo' | 'model';

export type ProductMediaSource = {
  images: readonly string[];
  model3dUrl: string | null;
};

export type ProductMediaPlan = {
  /** Available modes, in the order the switcher shows them. */
  modes: readonly ProductMediaMode[];
  /** What the page opens on. */
  initialMode: ProductMediaMode;
  /**
   * The image the canvas stands behind while the `.glb` downloads, and what the
   * viewer falls back to if it never arrives.
   */
  posterImage: string | null;
  /** The model to load, trimmed — non-null exactly when `modes` includes `model`. */
  modelUrl: string | null;
};

export function planProductMedia({ images, model3dUrl }: ProductMediaSource): ProductMediaPlan {
  const hasPhotos = images.length > 0;
  // The admin stores a blank field as null, but a whitespace-only value coming
  // from an older row would otherwise render an empty, permanently loading tab.
  const trimmedModel = model3dUrl?.trim();
  const modelUrl = trimmedModel !== undefined && trimmedModel !== '' ? trimmedModel : null;

  const modes: ProductMediaMode[] = [];
  if (hasPhotos) modes.push('photo');
  if (modelUrl !== null) modes.push('model');

  return {
    modes,
    // Photo first whenever there is one: it is the accessible path, the LCP
    // candidate, and the only mode that survives a WebGL failure. 3D leads only
    // for a product that has nothing else — and a product with neither falls
    // back to photo, whose empty state is a well rather than a dead canvas.
    initialMode: modes[0] ?? 'photo',
    posterImage: images[0] ?? null,
    modelUrl,
  };
}

/** The switcher is a control, so it appears only when there is a real choice. */
export function shouldShowModeSwitcher(plan: ProductMediaPlan): boolean {
  return plan.modes.length > 1;
}
