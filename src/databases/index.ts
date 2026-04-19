import { DB_HOST, DB_PORT, DB_DATABASE } from '@config';

export const dbConnection = {
  url: `mongodb://${DB_HOST}:${DB_PORT}/${DB_DATABASE}`,
  options: {
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
};
