/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

export enum ContentType {
  POST = 'post',
  REEL = 'reel',
}

export enum AuthorType {
  CLIENT = 'client',
  LOUNGE = 'lounge',
  AGENT = 'agent',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  DISMISSED = 'dismissed',
}

/* ------------------------------------------------------------------ */
/*  Post                                                               */
/* ------------------------------------------------------------------ */

export interface PostMedia {
  url: string;
  publicId: string;
}

export interface Post {
  _id?: string;
  authorId: string;
  authorType: AuthorType;
  text?: string;
  media: PostMedia[];
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  saveCount: number;
  isHidden: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Reel                                                               */
/* ------------------------------------------------------------------ */

export interface Reel {
  _id?: string;
  authorId: string;
  authorType: AuthorType;
  caption?: string;
  videoUrl: string;
  videoPublicId: string;
  thumbnailUrl?: string;
  thumbnailPublicId?: string;
  duration: number; // seconds (max 300)
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  saveCount: number;
  isHidden: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Comment                                                            */
/* ------------------------------------------------------------------ */

export interface Comment {
  _id?: string;
  authorId: string;
  targetId: string;
  targetType: ContentType;
  text: string;
  parentCommentId?: string;
  likeCount: number;
  isHidden: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  ContentLike  (posts, reels, comments)                               */
/* ------------------------------------------------------------------ */

export type LikeableType = 'post' | 'reel' | 'comment';

export interface ContentLike {
  _id?: string;
  userId: string;
  targetId: string;
  targetType: LikeableType;
  createdAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  ContentSave  (posts, reels)                                        */
/* ------------------------------------------------------------------ */

export interface ContentSave {
  _id?: string;
  userId: string;
  targetId: string;
  targetType: ContentType;
  createdAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Report                                                             */
/* ------------------------------------------------------------------ */

export interface Report {
  _id?: string;
  reporterId: string;
  targetId: string;
  targetType: LikeableType;
  reason: string;
  status: ReportStatus;
  adminNote?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ------------------------------------------------------------------ */
/*  Hashtag                                                            */
/* ------------------------------------------------------------------ */

export interface Hashtag {
  _id?: string;
  name: string;
  postCount: number;
  createdAt?: Date;
}
