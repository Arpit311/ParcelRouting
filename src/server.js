require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const logger = require('./config/logger').child({ origin: 'server' });
const {
  helmetMiddleware,
  apiLimiter,
  errorHandler,
  requestLogger,
  inputSanitizer,
} = require('./middleware/security');
const apiRoutes = require('./routes/api');

/**
 * Main Server Configuration
 *
 * ARCHITECTURE:
 * - Express.js for HTTP server
 * - Modular routing structure
 * - Layered security middleware
 * - Comprehensive logging
 * - Error handling
 *
 * The application follows a clean separation of concerns:
 * - Services: Core business logic (RoutingEngine, FileParserService)
 * - Routes: HTTP endpoint handlers
 * - Middleware: Cross-cutting concerns (security, logging)
 * - Config: Application configuration
 */

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Initialize and configure the Express application
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmetMiddleware);
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    }));

    // Request logging
    this.app.use(requestLogger);

    // Body parsing
    this.app.use(bodyParser.json({ limit: '10mb' }));
    this.app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

    // JSON parsing error handler
    this.app.use((err, req, res, next) => {
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON in request body',
        });
      }
      next(err);
    });

    // Input sanitization
    this.app.use(inputSanitizer);

    // Rate limiting
    this.app.use('/api/', apiLimiter);

    logger.info('Middleware initialized');
  }

  /**
   * Setup static file serving and routes
   */
  setupRoutes() {
    // Serve static files (UI)
    this.app.use(express.static(path.join(__dirname, '../public')));

    // API routes
    this.app.use('/api', apiRoutes);

    // Serve index.html for root path (SPA support)
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    logger.info('Routes configured');
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Global error handler (must be last)
    this.app.use(errorHandler);
  }

  /**
   * Start the server
   */
  start() {
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();

    this.server = this.app.listen(this.port, () => {
      logger.info('🚀 Server started', {
        port: this.port,
        environment: this.environment,
        timestamp: new Date().toISOString(),
      });

      console.log(`
╔════════════════════════════════════════════════════════╗
║   Parcel Routing System                                ║
║   Server running on http://localhost:${this.port}              ║
║                                                        ║
║   📊 UI Dashboard: http://localhost:${this.port}      ║
║   🔌 API Docs: http://localhost:${this.port}/api     ║
║   📈 Health Check: http://localhost:${this.port}/api/health   ║
╚════════════════════════════════════════════════════════╝
      `);
    });

    this.server.on('error', (error) => {
      logger.error('Server error: %s', error.message);
      process.exit(1);
    });
  }

  /**
   * Stop the server gracefully
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        logger.info('Server stopped');
        process.exit(0);
      });
    }
  }

  /**
   * Get the Express app (useful for testing)
   */
  getApp() {
    return this.app;
  }
}

// Initialize and start server
if (require.main === module) {
  const server = new Server();
  server.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing server');
    server.stop();
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing server');
    server.stop();
  });
}

module.exports = Server;
