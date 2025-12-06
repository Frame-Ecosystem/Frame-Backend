import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } from '@/config';
import { HttpException } from '@exceptions/HttpException';
import { logger } from '@utils/logger';

class UploadService {
  constructor() {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Upload image to Cloudinary from buffer
   * @param fileBuffer - File buffer from multer
   * @param userId - User ID for organizing uploads
   * @returns Promise with upload result containing URL
   */
  public async uploadProfileImage(fileBuffer: Buffer, userId: string): Promise<{ url: string; publicId: string }> {
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
              logger.error(`[UploadService] Upload failed: ${error.message}`);
              reject(error);
            } else {
              logger.info(`[UploadService] Image uploaded successfully: ${result.secure_url}`);
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
      logger.error(`[UploadService] Cloudinary upload error: ${error.message}`);
      throw new HttpException(500, `Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Delete image from Cloudinary
   * @param publicId - Public ID of the image in Cloudinary
   */
  public async deleteProfileImage(publicId: string): Promise<void> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      if (result.result === 'ok') {
        logger.info(`[UploadService] Image deleted successfully: ${publicId}`);
      } else {
        logger.warn(`[UploadService] Image deletion result: ${result.result}`);
      }
    } catch (error) {
      logger.error(`[UploadService] Failed to delete image: ${error.message}`);
      throw new HttpException(500, `Failed to delete image: ${error.message}`);
    }
  }
}

export default new UploadService();
