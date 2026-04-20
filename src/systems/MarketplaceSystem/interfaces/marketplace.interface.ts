// ─── Store ───────────────────────────────────────────────────────────

export enum StoreStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
}

export enum StoreCategory {
  BEAUTY = 'beauty',
  FASHION = 'fashion',
  WELLNESS = 'wellness',
  ACCESSORIES = 'accessories',
  TOOLS = 'tools',
  OTHER = 'other',
}

export enum StoreBadge {
  NONE = 'none',
  VERIFIED = 'verified',
  TOP_SELLER = 'topSeller',
  PREMIUM = 'premium',
}

export interface StorePolicies {
  returnPolicy?: string;
  shippingPolicy?: string;
}

export interface StoreStats {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  averageRating: number;
  ratingCount: number;
}

export interface Store {
  _id?: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  logo?: { url?: string; publicId?: string };
  banner?: { url?: string; publicId?: string };
  status: StoreStatus;
  category: StoreCategory;
  badge: StoreBadge;
  contactEmail?: string;
  contactPhone?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
    city?: string;
    state?: string;
  };
  policies?: StorePolicies;
  stats: StoreStats;
  isVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// ─── Product ─────────────────────────────────────────────────────────

export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  HIDDEN = 'hidden',
}

/**
 * @deprecated Product categories are now managed dynamically by admins
 * (see `ProductCategory` document in `productCategory.interface.ts` and
 * the `/v1/marketplace/product-categories` endpoints). This list is kept
 * only as the seed of default categories on first boot.
 */
export const LEGACY_PRODUCT_CATEGORY_TAGS = [
  'skincare',
  'haircare',
  'makeup',
  'tools',
  'accessories',
  'fragrance',
  'wellness',
  'nails',
  'other',
] as const;

export enum ProductCondition {
  NEW = 'new',
  LIKE_NEW = 'likeNew',
  USED = 'used',
}

export interface ProductVariant {
  sku?: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  attributes?: Record<string, string>;
}

export interface ProductImage {
  url: string;
  publicId: string;
  isPrimary?: boolean;
}

export interface ProductStats {
  totalSold: number;
  totalRevenue: number;
  viewCount: number;
  wishlistCount: number;
  averageRating: number;
  ratingCount: number;
}

export interface Product {
  _id?: string;
  storeId: string;
  name: string;
  slug: string;
  description?: string;
  /** ObjectId reference to a `ProductCategory` document. */
  categoryId: string;
  tags: string[];
  images: ProductImage[];
  price: number;
  compareAtPrice?: number;
  currency: string;
  variants: ProductVariant[];
  stock: number;
  sku?: string;
  status: ProductStatus;
  condition: ProductCondition;
  isDigital: boolean;
  weight?: number;
  dimensions?: { length?: number; width?: number; height?: number };
  stats: ProductStats;
  createdAt?: Date;
  updatedAt?: Date;
}

// ─── Order ───────────────────────────────────────────────────────────

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
}

export enum PaymentMethod {
  CASH_ON_DELIVERY = 'cashOnDelivery',
  BANK_TRANSFER = 'bankTransfer',
  IN_STORE = 'inStore',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

export interface OrderItem {
  productId: string;
  variantIndex?: number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state?: string;
  zipCode?: string;
  notes?: string;
}

export interface Order {
  _id?: string;
  orderNumber: string;
  buyerId: string;
  storeId: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shippingAddress: ShippingAddress;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  cancelReason?: string;
  refundReason?: string;
  refundAmount?: number;
  disputeReason?: string;
  disputeResolution?: string;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// ─── Cart ────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string;
  storeId: string;
  variantIndex?: number;
  quantity: number;
}

export interface Cart {
  _id?: string;
  userId: string;
  items: CartItem[];
  createdAt?: Date;
  updatedAt?: Date;
}

// ─── Product Review ──────────────────────────────────────────────────

export enum ReviewStatus {
  ACTIVE = 'active',
  HIDDEN = 'hidden',
}

export interface ProductReview {
  _id?: string;
  productId: string;
  storeId: string;
  userId: string;
  orderId?: string;
  rating: number;
  title?: string;
  comment?: string;
  images: ProductImage[];
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
  helpfulCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ─── Wishlist ────────────────────────────────────────────────────────

export interface Wishlist {
  _id?: string;
  userId: string;
  productId: string;
  createdAt?: Date;
}
