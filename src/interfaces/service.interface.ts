export enum ServiceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface Service {
  _id?: string;
  name: string;
  categoryId: string;
  baseDuration?: number;
  status: ServiceStatus;
  createdAt?: Date;
  updatedAt?: Date;
}
