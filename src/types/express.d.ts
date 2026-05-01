/* eslint-disable @typescript-eslint/no-empty-interface */
import { User as AppUser } from '../interfaces/user/user.interface';
import { Document } from 'mongoose';

// Augment Express.User so Passport's `req.user` carries our app's User shape.
// Making `user` non-optional here ensures RequestWithUser-typed handlers are
// assignable where Express expects plain RequestHandler.
declare global {
  namespace Express {
    interface User extends AppUser {}
    interface Request {
      user: User & Document;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user: AppUser & Document;
  }
}
