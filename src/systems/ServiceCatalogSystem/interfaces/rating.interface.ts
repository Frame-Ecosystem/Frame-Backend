export interface Rating {
  _id?: string;
  clientId: string;
  loungeId: string;
  score: number; // 1–5
  comment?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Denormalized rating summary stored on the lounge user document. */
export interface RatingSummary {
  averageRating: number;
  ratingCount: number;
}
