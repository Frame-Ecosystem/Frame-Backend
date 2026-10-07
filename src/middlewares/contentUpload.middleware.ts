import multer, { Multer } from 'multer';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { extname } from 'path';
import { HttpException } from '@exceptions/HttpException';
import { MAX_REEL_VIDEO_BYTES, REEL_THUMBNAIL_MIME_TYPES, REEL_VIDEO_MIME_TYPES } from '@systems/FeedContentSystem/contentLimits';

const POST_MAX_IMAGES = 20;
const POST_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const handleUploadError = (err: any, next: NextFunction, fallbackCode: string) => {
  if (!err) return next();
  if (err instanceof HttpException) return next(err);

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
  if (file.fieldname === 'video' && REEL_VIDEO_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else if (file.fieldname === 'thumbnail' && REEL_THUMBNAIL_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new HttpException(400, 'Unsupported reel media file type', 'INVALID_UPLOAD_FILE_TYPE'), false);
  }
};

const reelUpload: Multer = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpdir()),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
  }),
  fileFilter: videoFilter,
  limits: { fileSize: MAX_REEL_VIDEO_BYTES, files: 2, fields: 5, parts: 7 },
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
