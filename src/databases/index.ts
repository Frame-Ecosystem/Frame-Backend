import { MONGO_URI } from '@config';

export const dbConnection = {
  url: MONGO_URI,
  options: {
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
};
