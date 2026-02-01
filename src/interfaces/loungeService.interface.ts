export enum ServiceLoungeGender {
  MEN = 'men',
  WOMEN = 'women',
  UNISEX = 'unisex',
  KIDS = 'kids',
}

export interface LoungeService {
  _id?: string;
  loungeId: string;
  serviceId: string;
  price: number;
  duration: number;
  gender: ServiceLoungeGender;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
