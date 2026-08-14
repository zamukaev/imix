import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import {
  extensionFor,
  type AssetStorage,
  type UploadedAsset,
} from './asset-storage';

/**
 * Where the files land when nothing else is configured. Inside the storefront's
 * `public/`, so Next serves them at `/uploads/...` with no extra wiring — the
 * same way the seeded product photography is served.
 */
const DEFAULT_UPLOAD_DIR = '../web/public/uploads';

/** The path the storefront will ask for. Must match the directory above. */
const PUBLIC_PREFIX = '/uploads';

/** Enough of a content hash to be unique, short enough to read in a URL. */
const HASH_LENGTH = 16;

/**
 * Saves to the local filesystem.
 *
 * The development default, and honest about being one: it only works while the
 * API and the storefront share a disk, which they do locally and will not once
 * they are two deployables. Production sets `CLOUDINARY_URL` (or gains another
 * `AssetStorage`) and this class stops being constructed.
 *
 * The filename is a hash of the contents, which makes uploading the same
 * photograph twice a no-op instead of a second copy, and means nothing an admin
 * types ends up in a path.
 */
export class LocalDiskStorage implements AssetStorage {
  readonly name = 'local disk';

  private readonly logger = new Logger(LocalDiskStorage.name);
  private readonly directory: string;

  constructor(directory = process.env.UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR) {
    this.directory = resolve(process.cwd(), directory);
    this.logger.warn(
      `Uploads are being written to ${this.directory} and served from ${PUBLIC_PREFIX}. ` +
        'This only works while the API and the storefront share a filesystem — set CLOUDINARY_URL for anything else.',
    );
  }

  async save(file: UploadedAsset): Promise<string> {
    const extension = extensionFor(file.mimeType);

    if (!extension) {
      // The controller has already checked; this keeps the invariant local to
      // whoever is writing bytes to disk.
      throw new Error(`Refusing to store ${file.mimeType}`);
    }

    const digest = createHash('sha256')
      .update(file.buffer)
      .digest('hex')
      .slice(0, HASH_LENGTH);
    const filename = `${digest}.${extension}`;

    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, filename), file.buffer);

    return `${PUBLIC_PREFIX}/${filename}`;
  }
}
