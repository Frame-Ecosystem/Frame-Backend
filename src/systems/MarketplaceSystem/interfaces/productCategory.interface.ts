/**
 * Product Category & Suggestion Interfaces
 * ----------------------------------------
 * Replaces the legacy hard-coded `ProductCategory` enum (kept in
 * `marketplace.interface.ts` only as `LEGACY_PRODUCT_CATEGORY_TAGS`
 * for backward-compatible seeding of default categories).
 *
 * Categories are now first-class admin-managed documents. Any
 * authenticated user may submit a category suggestion when an
 * appropriate one cannot be found; admins moderate suggestions and
 * the approval pipeline auto-creates the underlying `ProductCategory`
 * document on `IMPLEMENTED`.
 */

export interface ProductCategoryImage {
  url?: string;
  publicId?: string;
}

export interface ProductCategory {
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: ProductCategoryImage;
  /**
   * Soft toggle — admins may hide a category without deleting it
   * (and without affecting historical product references).
   */
  isActive: boolean;
  /** Lower numbers surface first in dropdowns and grids. */
  displayOrder: number;
  /** Number of active products in the category (denormalised — kept fresh by service-layer hooks). */
  productCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Lifecycle:
 *  PENDING     → submitted, waiting for admin review
 *  APPROVED    → admin endorsed but not yet implemented (rare — usually we go straight to IMPLEMENTED)
 *  REJECTED    → admin denied (terminal)
 *  IMPLEMENTED → admin approved AND a real ProductCategory was created (terminal, links via implementedCategoryId)
 */
export enum ProductCategorySuggestionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  IMPLEMENTED = 'implemented',
}

export interface ProductCategorySuggestion {
  _id?: string;
  /** Proposed display name for the category. */
  name: string;
  /** Why the user thinks this category is needed. */
  description: string;
  /** Optional initial example products the user has in mind. */
  exampleProducts?: string[];
  /** Optional icon hint (emoji or short label) — admin may override on implementation. */
  iconHint?: string;
  status: ProductCategorySuggestionStatus;
  /** Any authenticated user may suggest — usually a store owner or a buyer. */
  suggestedBy: string;
  /** Populated after IMPLEMENTED. */
  implementedCategoryId?: string;
  /** Admin moderation note — shown back to the suggester on approve/reject. */
  adminNote?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
