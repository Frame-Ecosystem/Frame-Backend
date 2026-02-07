export enum ServiceSuggestionStatus {
  PENDING = 'pending',
  REJECTED = 'rejected',
  IMPLEMENTED = 'implemented',
}

export interface ServiceSuggestion {
  _id?: string;
  name: string;
  description: string;
  estimatedPrice?: number;
  estimatedDuration?: number;
  targetGender?: 'men' | 'women' | 'unisex' | 'kids';
  status: ServiceSuggestionStatus;
  loungeId: string;
  adminNote?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
