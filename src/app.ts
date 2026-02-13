import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import passport from 'passport';
import { connect, set, disconnect } from 'mongoose';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { NODE_ENV, PORT, LOG_FORMAT, ORIGIN, CREDENTIALS } from '@config';
import { dbConnection } from '@databases';
import { Routes } from '@interfaces/routes.interface';
import errorMiddleware from '@middlewares/error.middleware';
import { logger, stream } from '@utils/logger';
import { ensureAdminExists, ensureCollectionExists } from '@utils/initAdmin';
import { REQUEST_BODY_LIMIT } from './config/constants';
import './config/passport'; // Initialize Passport

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
    this.app.listen(Number(this.port), '0.0.0.0', () => {
      logger.info(`=================================`);
      logger.info(`======= ENV: ${this.env} =======`);
      logger.info(`🚀 App listening on 0.0.0.0:${this.port}`);
      logger.info(`📱 WiFi Access: http://[YOUR_IP]:${this.port}`);
      logger.info(`📚 Swagger API Docs: http://localhost:${this.port}/api-docs`);
      logger.info(`=================================`);
    });
  }

  public async closeDatabaseConnection(): Promise<void> {
    try {
      await disconnect();
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error closing database connection:', { error });
    }
  }

  public getServer() {
    return this.app;
  }

  private async connectToDatabase(retries = 5, delay = 5000) {
    // Suppress Mongoose 7 strictQuery deprecation warning
    set('strictQuery', false);

    if (this.env !== 'production') {
      set('debug', true);
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.info(`🔄 Connecting to MongoDB at ${dbConnection.url}... (attempt ${attempt}/${retries})`);
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

        // Connection successful, exit retry loop
        return;
      } catch (error) {
        logger.error(`❌ Failed to connect to MongoDB (attempt ${attempt}/${retries}): ${error.message}`);

        if (attempt < retries) {
          const waitTime = delay * attempt; // Exponential backoff
          logger.info(`⏳ Retrying in ${waitTime / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          logger.error('❌ All MongoDB connection attempts failed.');
          logger.warn('⚠️ App starting without database connection. API will be unavailable until MongoDB connects.');
        }
      }
    }
  }

  private initializeMiddlewares() {
    this.app.use(morgan(LOG_FORMAT, { stream }));

    // CORS configuration for WiFi access
    const corsOptions = {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // Allow localhost for development
        if (origin.startsWith('http://localhost')) return callback(null, true);

        // Allow 127.0.0.1 for local access
        if (origin.startsWith('http://127.0.0.1')) return callback(null, true);

        // Allow WiFi network IPs (192.168.x.x range)
        if (origin.match(/^http:\/\/192\.168\.\d+\.\d+/)) return callback(null, true);

        // Allow specific configured origin
        if (ORIGIN && origin === ORIGIN) return callback(null, true);

        return callback(new Error('Not allowed by CORS'));
      },
      credentials: CREDENTIALS,
    };

    this.app.use(cors(corsOptions));
    this.app.use(hpp());
    this.app.use(helmet());
    this.app.use(compression());
    // Limit request body size to prevent DoS attacks
    this.app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
    this.app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
    this.app.use(cookieParser());
    // Initialize Passport
    this.app.use(passport.initialize());
  }

  private initializeRoutes(routes: Routes[]) {
    // Health check endpoint - always available
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: this.env,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // Readiness check endpoint
    this.app.get('/ready', async (req, res) => {
      try {
        // Check database connection
        await connect(dbConnection.url);
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          database: 'connected',
        });
      } catch (error) {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          database: 'disconnected',
          error: this.env === 'development' ? error.message : 'Database connection failed',
        });
      }
    });

    routes.forEach(route => {
      this.app.use(route.path, route.router);
    });
  }

  private initializeSwagger() {
    // Only enable Swagger in development and staging environments
    if (this.env !== 'production') {
      const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));
      this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    }
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }
}

export default App;
