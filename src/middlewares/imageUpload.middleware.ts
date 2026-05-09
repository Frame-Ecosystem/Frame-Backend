import multer, { Multer } from 'multer';
import { Request, Response, NextFunction } from 'express';

const storage = multer.memoryStorage();

/**
 * Magic byte signatures for allowed image types.
 * Validates actual file content, not just the MIME type from the request header.
 * This prevents MIME spoofing attacks where attackers upload executable files.
 */
const IMAGE_MAGIC_BYTES = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] }, // JPEG SOI marker
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] }, // PNG signature
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46] }, // GIF signature
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header (WebP)
] as const;

const ALLOWED_MIMES = IMAGE_MAGIC_BYTES.map(m => m.mime);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Validate magic bytes of an uploaded file buffer.
 * Returns the detected MIME type if valid, null otherwise.
 * @param buffer - The file buffer to validate
 * @returns Detected MIME type or null if invalid
 */
function validateMagicBytes(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 3) return null;

  for (const sig of IMAGE_MAGIC_BYTES) {
    if (sig.bytes.every((byte, i) => buffer[i] === byte)) {
      return sig.mime;
    }
  }
  return null;
}

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Pre-filter based on MIME type (client-provided, can be spoofed)
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    cb(new Error('Only image files are allowed (jpeg, png, gif, webp)'), false);
  } else {
    cb(null, true);
  }
};

const upload: Multer = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

/**
 * Middleware that conditionally applies multer only when the request
 * Content-Type is multipart/form-data.
 * Validates file magic bytes after upload to prevent MIME spoofing attacks.
 * This ensures files are actual images, not executables with fake MIME types.
 */
export function optionalUpload(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'];

    // Only process if multipart/form-data
    if (!contentType?.includes('multipart/form-data')) {
      return next();
    }

    // Apply multer processing
    upload.single(fieldName)(req, res, (err?: any) => {
      if (err) return next(err);

      // Validate magic bytes if a file was uploaded
      if (req.file?.buffer) {
        const detectedMime = validateMagicBytes(req.file.buffer);
        if (!detectedMime) {
          return res.status(400).json({ message: 'Invalid image file: file content does not match a recognized image format' });
        }
        // Update file MIME type to detected value (additional security measure)
        req.file.mimetype = detectedMime;
      }

      next();
    });
  };
}

export default upload;
