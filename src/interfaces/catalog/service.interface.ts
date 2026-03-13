export interface Service {
  _id?: string;
  name: string;
  categoryId: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
