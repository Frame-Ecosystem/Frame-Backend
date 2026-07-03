export enum SearchType {
  ALL = 'all',
  USERS = 'users',
  LOUNGES = 'lounges',
  POSTS = 'posts',
  REELS = 'reels',
  PRODUCTS = 'products',
  STORES = 'stores',
  HASHTAGS = 'hashtags',
  SERVICES = 'services',
}

export const SEARCH_TYPE_VALUES = Object.values(SearchType);

export interface SearchUserResult {
  _id: string;
  type: string;
  firstName?: string;
  lastName?: string;
  loungeTitle?: string;
  agentName?: string;
  profileImage?: { url?: string; publicId?: string };
  bio?: string;
  location?: { address?: string; placeName?: string };
  averageRating?: number;
  followersCount?: number;
  isFollowedByMe?: boolean;
}

export interface SearchContentResult {
  _id: string;
  contentType: 'post' | 'reel';
  authorId: { _id: string; firstName?: string; lastName?: string; loungeTitle?: string; profileImage?: { url?: string }; type?: string };
  text?: string;
  caption?: string;
  media?: Array<{ url: string; publicId: string }>;
  videoUrl?: string;
  thumbnailUrl?: string;
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  saveCount: number;
  createdAt: Date;
  isLiked?: boolean;
  isSaved?: boolean;
}

export interface SearchProductResult {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  images: Array<{ url: string; publicId: string; isPrimary: boolean }>;
  status: string;
  stats: { averageRating: number; ratingCount: number; totalSold: number };
  storeId: { _id: string; name: string; slug: string };
  tags: string[];
  createdAt: Date;
}

export interface SearchStoreResult {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo: { url?: string; publicId?: string };
  category: string;
  badge: string;
  isVerified: boolean;
  stats: { averageRating: number; totalProducts: number };
  location: { city?: string; address?: string };
  createdAt: Date;
}

export interface SearchHashtagResult {
  _id: string;
  name: string;
  postCount: number;
}

export interface SearchServiceResult {
  _id: string;
  name: string;
  description?: string;
  categoryId: { _id: string; name: string };
}

export interface SearchResults {
  query: string;
  type: SearchType;
  users?: { data: SearchUserResult[]; total: number };
  lounges?: { data: SearchUserResult[]; total: number };
  posts?: { data: SearchContentResult[]; total: number };
  reels?: { data: SearchContentResult[]; total: number };
  products?: { data: SearchProductResult[]; total: number };
  stores?: { data: SearchStoreResult[]; total: number };
  hashtags?: { data: SearchHashtagResult[]; total: number };
  services?: { data: SearchServiceResult[]; total: number };
}
