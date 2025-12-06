import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import { connect, set, disconnect } from 'mongoose';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { NODE_ENV, PORT, LOG_FORMAT, ORIGIN, CREDENTIALS } from '@config';
import { dbConnection } from '@databases';
import { Routes } from '@interfaces/routes.interface';
import errorMiddleware from '@middlewares/error.middleware';
import { logger, stream } from '@utils/logger';
import { ensureAdminExists, ensureCollectionExists } from '@utils/initAdmin';

class App {
  public app: express.Application;
  public env: string;
  public port: string | number;

  constructor(routes: Routes[]) {
    this.app = express();
    this.env = NODE_ENV || 'development';
    this.port = PORT || 3000;

    // Note: connectToDatabase is async but called without await here
    // This is intentional - the app initializes routes/middleware while DB connects
    this.connectToDatabase();
    this.initializeMiddlewares();
    this.initializeRoutes(routes);
    this.initializeSwagger();
    this.initializeErrorHandling();
  }

  public listen() {
    this.app.listen(this.port, () => {
      logger.info(`=================================`);
      logger.info(`======= ENV: ${this.env} =======`);
      logger.info(`🚀 App listening on the port ${this.port}`);
      logger.info(`📚 Swagger API Docs: http://localhost:${this.port}/api-docs`);
      logger.info(`=================================`);
    });
  }

  public async closeDatabaseConnection(): Promise<void> {
    try {
      await disconnect();
      console.log('Disconnected from MongoDB');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }

  public getServer() {
    return this.app;
  }

  private async connectToDatabase() {
    if (this.env !== 'production') {
      set('debug', true);
    }

    try {
      logger.info(`🔄 Connecting to MongoDB at ${dbConnection.url}...`);
      await connect(dbConnection.url);
      logger.info(`✅ Successfully connected to MongoDB`);

      // Log the actual database name for verification in Compass
      const dbName = dbConnection.url.split('/').pop() || 'unknown';
      logger.info(`📊 Using database: ${dbName}`);

      // Ensure the collection and indexes exist
      try {
        await ensureCollectionExists();
      } catch (colErr) {
        logger.warn(`Warning: failed to ensure collection exists: ${colErr?.message || colErr}`);
      }

      // Ensure an admin user exists on first run
      try {
        await ensureAdminExists();
      } catch (adminErr) {
        logger.error(`Error while ensuring admin exists: ${adminErr?.message || adminErr}`);
        // Don't rethrow - let the app continue even if admin creation fails
      }
    } catch (error) {
      logger.error(`❌ Failed to connect to MongoDB: ${error.message}`);
      // Log but don't throw - allow the app to start even if DB is unavailable initially
      logger.warn('⚠️ App starting without database connection. API will be unavailable until MongoDB connects.');
    }
  }

  private initializeMiddlewares() {
    this.app.use(morgan(LOG_FORMAT, { stream }));
    this.app.use(cors({ origin: ORIGIN, credentials: CREDENTIALS }));
    this.app.use(hpp());
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());
  }

  private initializeRoutes(routes: Routes[]) {
    routes.forEach(route => {
      this.app.use('/', route.router);
    });
  }

  private initializeSwagger() {
    const options = {
      swaggerDefinition: {
        info: {
          title: 'REST API',
          version: '1.0.0',
          description: 'Example docs',
        },
      },
      apis: ['swagger.yaml'],
    };

    const specs = swaggerJSDoc(options);
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }
}

export default App;
