import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { UploadedAssetDto } from '@imix/types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ALLOWED_ASSET_TYPES,
  ASSET_STORAGE,
  MAX_ASSET_BYTES,
  extensionFor,
  type AssetStorage,
} from './storage/asset-storage';

/**
 * What multer hands over. Declared here rather than pulled in as `@types/multer`
 * — three fields, against a package whose only job is to name them.
 */
type MultipartFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

const FIELD_NAME = 'file';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUploadController {
  constructor(@Inject(ASSET_STORAGE) private readonly storage: AssetStorage) {}

  /**
   * Takes one file and answers with where it now lives.
   *
   * Two things are deliberately not trusted. The size cap is enforced by multer
   * before the bytes are in memory, not checked afterwards. And the type comes
   * from the sniffed `mimetype`, never from the filename — the name is the half
   * of an upload that an attacker writes.
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor(FIELD_NAME, { limits: { fileSize: MAX_ASSET_BYTES, files: 1 } }),
  )
  async upload(@UploadedFile() file?: MultipartFile): Promise<UploadedAssetDto> {
    if (!file) {
      throw new BadRequestException(`Expected a file in the "${FIELD_NAME}" field.`);
    }

    if (!extensionFor(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: ${Object.keys(
          ALLOWED_ASSET_TYPES,
        ).join(', ')}.`,
      );
    }

    return {
      url: await this.storage.save({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
      }),
    };
  }
}
