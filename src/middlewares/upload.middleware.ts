import multer, { Multer } from 'multer';
import { HttpException } from '@exceptions/HttpException';

// Configure multer to store files in memory (buffer)
const storage = multer.memoryStorage();

// File filter to only accept images
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, png, gif, webp)'), false);
  }
};

// Configure upload with size limit (5MB)
const upload: Multer = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

export default upload;
