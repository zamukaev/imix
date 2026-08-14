import { Logger, type Provider } from '@nestjs/common';
import { ASSET_STORAGE, type AssetStorage } from './asset-storage';
import { CloudinaryStorage } from './cloudinary.storage';
import { LocalDiskStorage } from './local-disk.storage';

/**
 * Picks the storage provider once, at boot, and says which one it picked.
 *
 * Configuration decides, not a runtime branch: nothing downstream of
 * `ASSET_STORAGE` knows or cares where a file ends up. Adding S3 means adding a
 * class and a line here.
 */
export const assetStorageProvider: Provider = {
  provide: ASSET_STORAGE,
  useFactory: (): AssetStorage => {
    const storage = CloudinaryStorage.fromEnvironment() ?? new LocalDiskStorage();

    new Logger('AssetStorage').log(`Uploads go to ${storage.name}.`);

    return storage;
  },
};
