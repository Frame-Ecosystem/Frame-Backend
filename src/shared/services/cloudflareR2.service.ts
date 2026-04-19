import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { HttpException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';
import crypto from 'crypto';

/* ------------------------------------------------------------------ */
/*  Config — pulled from environment                                   */
/* ------------------------------------------------------------------ */

const {
  R2_ACCOUNT_ID = '',
  R2_ACCESS_KEY_ID = '',
  R2_SECRET_ACCESS_KEY = '',
  R2_BUCKET_NAME = '',
  R2_PUBLIC_URL = '', // e.g. https://images.example.com  or  https://<bucket>.r2.dev
} = process.env;

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

class CloudflareR2Service {
  private client: S3Client | null = null;

  /** Lazily build the S3-compatible client the first time it's needed. */
  private ensureClient(): S3Client {
    if (this.client) return this.client;

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      throw new HttpException(500, 'Cloudflare R2 is not properly configured');
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    logger.info('[CloudflareR2Service] S3 client configured');
    return this.client;
  }

  /* ───────── Generic upload / delete ───────── */

  /**
   * Upload a buffer to Cloudflare R2.
   * @param fileBuffer  Raw image bytes
   * @param folder      Virtual folder path   (e.g. `user-profiles/abc123`)
   * @param prefix      Key prefix            (e.g. `profile`)
   * @returns `{ url, publicId }` — `publicId` is the full object key for later deletion.
   */
  private async upload(fileBuffer: Buffer, folder: string, prefix: string): Promise<{ url: string; publicId: string }> {
    const client = this.ensureClient();

    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const key = `${folder}/${prefix}-${uniqueSuffix}`;

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: fileBuffer,
          ContentType: this.detectContentType(fileBuffer),
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );

      const url = `${R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`;
      logger.info(`[CloudflareR2Service] Uploaded: ${url}`);
      return { url, publicId: key };
    } catch (error) {
      logger.error(`[CloudflareR2Service] Upload failed: ${error.message}`);
      throw new HttpException(500, `Failed to upload image: ${error.message}`);
    }
  }

  /** Delete an object from R2 by its key (publicId). */
  public async deleteImage(publicId: string): Promise<void> {
    const client = this.ensureClient();

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: publicId,
        }),
      );
      logger.info(`[CloudflareR2Service] Deleted: ${publicId}`);
    } catch (error) {
      logger.error(`[CloudflareR2Service] Delete failed: ${error.message}`);
      throw new HttpException(500, `Failed to delete image: ${error.message}`);
    }
  }

  /* ───────── Public upload helpers ───────── */

  public async uploadProfileImage(fileBuffer: Buffer, userId: string) {
    return this.upload(fileBuffer, `user-profiles/${userId}`, 'profile');
  }

  public async uploadCoverImage(fileBuffer: Buffer, userId: string) {
    return this.upload(fileBuffer, `user-covers/${userId}`, 'cover');
  }

  public async uploadLoungeServiceImage(fileBuffer: Buffer, serviceId: string) {
    return this.upload(fileBuffer, `lounge-services/${serviceId}`, 'service');
  }

  /* ───────── Content (Posts & Reels) ───────── */

  public async uploadPostImage(fileBuffer: Buffer, postId: string) {
    return this.upload(fileBuffer, `posts/${postId}`, 'img');
  }

  public async uploadReelVideo(fileBuffer: Buffer, reelId: string) {
    return this.upload(fileBuffer, `reels/${reelId}`, 'video');
  }

  public async uploadReelThumbnail(fileBuffer: Buffer, reelId: string) {
    return this.upload(fileBuffer, `reels/${reelId}`, 'thumb');
  }

  /* ───────── Marketplace ───────── */

  public async uploadStoreLogo(fileBuffer: Buffer, storeId: string) {
    return this.upload(fileBuffer, `stores/${storeId}`, 'logo');
  }

  public async uploadStoreBanner(fileBuffer: Buffer, storeId: string) {
    return this.upload(fileBuffer, `stores/${storeId}`, 'banner');
  }

  public async uploadProductImage(fileBuffer: Buffer, productId: string) {
    return this.upload(fileBuffer, `products/${productId}`, 'img');
  }

  public async uploadReviewImage(fileBuffer: Buffer, reviewId: string) {
    return this.upload(fileBuffer, `reviews/${reviewId}`, 'img');
  }

  /* ───────── Utils ───────── */

  /** Best-effort content-type detection from magic bytes. */
  private detectContentType(buffer: Buffer): string {
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') return 'image/png';
    if (buffer.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return 'application/octet-stream';
  }
}

export default new CloudflareR2Service();
