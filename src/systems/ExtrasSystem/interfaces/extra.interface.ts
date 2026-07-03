export interface Extra {
  _id?: string;
  name: string;
  description?: string;
  free: boolean;
  cost: number;
  category: string;
  image?: {
    url: string;
    publicId: string;
  };
  createdBy: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LoungeExtra {
  _id?: string;
  loungeId: string;
  extraId: string;
  cost?: number;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
