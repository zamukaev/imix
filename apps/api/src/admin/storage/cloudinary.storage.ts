import { createHash } from 'node:crypto';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { AssetStorage, UploadedAsset } from './asset-storage';

/** Everything iMIX uploads lives under one folder at the provider. */
const FOLDER = 'imix';

const MILLISECONDS_PER_SECOND = 1000;

type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

type CloudinaryUploadResponse = {
  secure_url?: unknown;
  error?: { message?: unknown };
};

/**
 * Uploads through Cloudinary's REST API.
 *
 * Signed with `crypto` and posted with `fetch` rather than through the official
 * SDK: the whole interaction is one request, and the SDK would be a dependency
 * carried by both deployables for it. If a second provider ever needs more than
 * this, that is the moment to reconsider — not now.
 *
 * `resource_type: auto` so the same path takes both a photograph and, in Phase 5,
 * a `.glb` (Cloudinary treats a model as a raw file).
 */
export class CloudinaryStorage implements AssetStorage {
  readonly name = 'Cloudinary';

  private readonly logger = new Logger(CloudinaryStorage.name);

  constructor(private readonly credentials: CloudinaryCredentials) {}

  /**
   * Reads `CLOUDINARY_URL`, or `null` when it is absent or malformed.
   *
   * The format is Cloudinary's own: `cloudinary://<api_key>:<api_secret>@<cloud_name>`.
   */
  static fromEnvironment(url = process.env.CLOUDINARY_URL): CloudinaryStorage | null {
    if (!url) {
      return null;
    }

    try {
      const parsed = new URL(url);

      if (parsed.protocol !== 'cloudinary:') {
        return null;
      }

      const cloudName = parsed.hostname;
      const apiKey = decodeURIComponent(parsed.username);
      const apiSecret = decodeURIComponent(parsed.password);

      if (!cloudName || !apiKey || !apiSecret) {
        return null;
      }

      return new CloudinaryStorage({ cloudName, apiKey, apiSecret });
    } catch {
      return null;
    }
  }

  async save(file: UploadedAsset): Promise<string> {
    const timestamp = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
    const body = new FormData();

    body.set('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }));
    body.set('api_key', this.credentials.apiKey);
    body.set('timestamp', String(timestamp));
    body.set('folder', FOLDER);
    body.set('signature', this.sign({ folder: FOLDER, timestamp: String(timestamp) }));

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.credentials.cloudName}/auto/upload`,
      { method: 'POST', body },
    );
    const payload = (await response.json().catch(() => null)) as
      | CloudinaryUploadResponse
      | null;

    if (!response.ok || typeof payload?.secure_url !== 'string') {
      const detail =
        typeof payload?.error?.message === 'string'
          ? payload.error.message
          : `HTTP ${response.status}`;

      this.logger.error(`Cloudinary refused the upload: ${detail}`);

      // A 503 rather than a 500: nothing about the request was wrong, the
      // dependency is unhappy, and the admin's own retry is a reasonable answer.
      throw new ServiceUnavailableException(
        'The asset store rejected the upload. Try again in a moment.',
      );
    }

    return payload.secure_url;
  }

  /**
   * Cloudinary's scheme: every signed parameter except the file itself, sorted
   * by name, joined as a query string, with the API secret appended and the lot
   * hashed with SHA-1. Their choice of hash, not ours.
   */
  private sign(params: Record<string, string>): string {
    const canonical = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    return createHash('sha1')
      .update(`${canonical}${this.credentials.apiSecret}`)
      .digest('hex');
  }
}
