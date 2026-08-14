/**
 * Where uploaded assets go.
 *
 * An interface rather than a Cloudinary client sprinkled through the controller,
 * because the provider is the part most likely to change: this shop sells into
 * Russia, and the same question that hangs over Stripe (see the note in
 * CLAUDE.md) hangs over any US-hosted CDN. Swapping in S3, Selectel or a plain
 * nginx box should mean one new class and one line in the factory.
 */
export interface AssetStorage {
  /** Named so the log can say which one is actually in use at boot. */
  readonly name: string;

  /**
   * Stores the bytes and returns where the storefront can fetch them: either an
   * absolute path this shop serves or an `https://` URL at the provider.
   */
  save(file: UploadedAsset): Promise<string>;
}

/** What the multipart layer hands over, narrowed to what a provider needs. */
export type UploadedAsset = {
  buffer: Buffer;
  /** Untrusted — used for nothing but a hint in an error message. */
  originalName: string;
  mimeType: string;
};

export const ASSET_STORAGE = 'ASSET_STORAGE';

/**
 * What may be uploaded, keyed by the extension it is stored under.
 *
 * The extension comes from the sniffed type rather than from the filename: a
 * browser will happily send `payload.php` as `image/png`, and the name is the
 * half an attacker controls.
 *
 * `.glb` is here for the 3D layer in Phase 5. Accepting it now costs nothing and
 * saves this list being the thing that blocks that slice.
 */
export const ALLOWED_ASSET_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'model/gltf-binary': 'glb',
};

/** 8 MB: comfortably above a product photograph, well below a memory problem. */
export const MAX_ASSET_BYTES = 8 * 1024 * 1024;

export function extensionFor(mimeType: string): string | null {
  return ALLOWED_ASSET_TYPES[mimeType] ?? null;
}
