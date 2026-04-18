import multer, { Multer } from 'multer';
import { Request, Response, NextFunction } from 'express';

const storage = multer.memoryStorage();

/* ───────── Post images (up to 10) ───────── */

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
  limits: { fileSize: 10 * 1024 * 1024, files: 10 }, // 10 MB per image, max 10
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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB for video
});

/* ───────── Middleware exports ───────── */

/** Upload up to 10 images for posts (field: "media"). */
export function uploadPostMedia(req: Request, res: Response, next: NextFunction) {
  if (!req.headers['content-type']?.includes('multipart/form-data')) return next();
  postUpload.array('media', 10)(req, res, next);
}

/** Upload 1 video + optional thumbnail for reels. */
export function uploadReelMedia(req: Request, res: Response, next: NextFunction) {
  if (!req.headers['content-type']?.includes('multipart/form-data')) return next();
  reelUpload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ])(req, res, next);
}
