export enum ServiceLoungeGender {
  MEN = 'men',
  WOMEN = 'women',
  UNISEX = 'unisex',
  KIDS = 'kids',
}

export enum LoungeServiceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface LoungeService {
  _id?: string;
  loungeId: string;
  serviceId: string;
  price: number;
  duration: number;
  gender: ServiceLoungeGender;
  status: LoungeServiceStatus;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
