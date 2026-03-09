import multer, { Multer } from 'multer';
import { Request, Response, NextFunction } from 'express';

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, png, gif, webp)'), false);
  }
};

const upload: Multer = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

/**
 * Middleware that conditionally applies multer only when the request
 * Content-Type is multipart/form-data. Falls through otherwise.
 */
export function optionalUpload(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      upload.single(fieldName)(req, res, next);
    } else {
      next();
    }
  };
}

export default upload;
