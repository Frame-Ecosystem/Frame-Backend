import multer, { Multer } from 'multer';
import { Request, Response, NextFunction } from 'express';

const storage = multer.memoryStorage();

/**
 * Magic byte signatures for allowed image types.
 * Validates actual file content, not just the MIME type from the request header.
 */
const IMAGE_MAGIC_BYTES: { mime: string; bytes: number[] }[] = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header
];

const ALLOWED_MIMES = IMAGE_MAGIC_BYTES.map(m => m.mime);

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, png, gif, webp)'), false);
  }
};

/**
 * Validate magic bytes of an uploaded file buffer.
 * Returns true if the file content matches a known image signature.
 */
function validateMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  return IMAGE_MAGIC_BYTES.some(sig => sig.bytes.every((byte, i) => buffer[i] === byte));
}

const upload: Multer = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/**
 * Middleware that conditionally applies multer only when the request
 * Content-Type is multipart/form-data. Falls through otherwise.
 * Validates file magic bytes after upload to prevent MIME spoofing.
 */
export function optionalUpload(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      upload.single(fieldName)(req, res, (err?: any) => {
        if (err) return next(err);
        // Validate magic bytes if a file was uploaded
        if (req.file?.buffer && !validateMagicBytes(req.file.buffer)) {
          return res.status(400).json({ message: 'Invalid image file content' });
        }
        next();
      });
    } else {
      next();
    }
  };
}

export default upload;
