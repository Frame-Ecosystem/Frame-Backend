import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } from '@/config';
import { HttpException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';

class CloudinaryService {
  private configured = false;

  private ensureConfigured() {
    if (!this.configured) {
      if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        logger.warn('[CloudinaryService] Cloudinary credentials not fully configured');
        return false;
      }
      cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET,
      });
      this.configured = true;
      logger.info('[CloudinaryService] Cloudinary configured successfully');
    }
    return true;
  }

  public async uploadProfileImage(fileBuffer: Buffer, userId: string): Promise<{ url: string; publicId: string }> {
    if (!this.ensureConfigured()) {
      throw new HttpException(500, 'Cloudinary is not properly configured');
    }
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `user-profiles/${userId}`,
            resource_type: 'auto',
            public_id: `profile-${Date.now()}`,
          },
          (error, result) => {
            if (error) {
              logger.error(`[CloudinaryService] Upload failed: ${error.message}`);
              reject(error);
            } else {
              logger.info(`[CloudinaryService] Image uploaded successfully: ${result.secure_url}`);
              resolve({
                url: result.secure_url,
                publicId: result.public_id,
              });
            }
          },
        );

        uploadStream.end(fileBuffer);
      });
    } catch (error) {
      logger.error(`[CloudinaryService] Cloudinary upload error: ${error.message}`);
      throw new HttpException(500, `Failed to upload image: ${error.message}`);
    }
  }

  public async deleteProfileImage(publicId: string): Promise<void> {
    if (!this.ensureConfigured()) {
      throw new HttpException(500, 'Cloudinary is not properly configured');
    }
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      if (result.result === 'ok') {
        logger.info(`[CloudinaryService] Image deleted successfully: ${publicId}`);
      } else {
        logger.warn(`[CloudinaryService] Image deletion result: ${result.result}`);
      }
    } catch (error) {
      logger.error(`[CloudinaryService] Failed to delete image: ${error.message}`);
      throw new HttpException(500, `Failed to delete image: ${error.message}`);
    }
  }
}

export default new CloudinaryService();
