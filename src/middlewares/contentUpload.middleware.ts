import multer, { Multer } from 'multer';
import { Request, Response, NextFunction } from 'express';
import { HttpException } from '@exceptions/HttpException';

const POST_MAX_IMAGES = 20;
const POST_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const REEL_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

const handleUploadError = (err: any, next: NextFunction, fallbackCode: string) => {
  if (!err) return next();

  if (err?.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpException(400, 'Uploaded file exceeds size limit', 'UPLOAD_FILE_TOO_LARGE'));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new HttpException(400, 'Too many files uploaded', 'UPLOAD_TOO_MANY_FILES'));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new HttpException(400, 'Unexpected file field in upload payload', 'UPLOAD_UNEXPECTED_FIELD'));
    }

    return next(new HttpException(400, err.message || 'Invalid upload payload', fallbackCode));
  }

  return next(new HttpException(400, err.message || 'Invalid upload payload', fallbackCode));
};

const storage = multer.memoryStorage();

/* ───────── Post images (up to 20) ───────── */

const imageFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, png, gif, webp)'), false);
  }
};

const postUpload: Multer = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: POST_IMAGE_MAX_BYTES, files: POST_MAX_IMAGES }, // 10 MB per image, max 20
});

/* ───────── Reel video (1 video + optional thumbnail) ───────── */

const videoFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const videoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];

  if (file.fieldname === 'video' && videoTypes.includes(file.mimetype)) {
    cb(null, true);
  } else if (file.fieldname === 'thumbnail' && imageTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for field "${file.fieldname}"`), false);
  }
};

const reelUpload: Multer = multer({
  storage,
  fileFilter: videoFilter,
  limits: { fileSize: REEL_VIDEO_MAX_BYTES }, // 50 MB for video
});

/* ───────── Middleware exports ───────── */

/** Upload up to 20 images for posts (field: "media"). */
export function uploadPostMedia(req: Request, res: Response, next: NextFunction) {
  if (!req.headers['content-type']?.includes('multipart/form-data')) return next();
  postUpload.array('media', POST_MAX_IMAGES)(req, res, err => handleUploadError(err, next, 'POST_MEDIA_UPLOAD_ERROR'));
}

/** Upload 1 video + optional thumbnail for reels. */
export function uploadReelMedia(req: Request, res: Response, next: NextFunction) {
  if (!req.headers['content-type']?.includes('multipart/form-data')) return next();
  reelUpload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ])(req, res, err => handleUploadError(err, next, 'REEL_MEDIA_UPLOAD_ERROR'));
}
