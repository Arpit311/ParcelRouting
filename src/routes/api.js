const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger').child({ origin: 'api' });
const config = require('../config/environment');
const RoutingEngine = require('../services/RoutingEngine');
const FileParserService = require('../services/FileParserService');
const {
  validateSingleParcel,
  validateFileFormat,
  sanitizeParcel,
} = require('../validators/parcelValidator');
const { uploadLimiter } = require('../middleware/security');
const { getAllRules } = require('../config/routingRules');

const router = express.Router();
const routingEngine = new RoutingEngine();
const fileParser = new FileParserService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});

const orderSummary = {
  totalRequests: 0,
  totalParcels: 0,
  departmentCounts: {
    Mail: 0,
    Regular: 0,
    Heavy: 0,
    Insurance: 0,
    Default: 0,
  },
  lastParcel: null,
  lastBatch: null,
  lastUpdated: null,
};

async function routeParcelBatch(inputParcels, batchTimestamp) {
  const startTime = Date.now();
  const batchLogDir = path.join(process.cwd(), 'logs', 'batches', batchTimestamp);
  await fs.mkdir(batchLogDir, { recursive: true });

  const routed = [];
  const failed = [];
  const departmentCounts = {};
  const parcelLogFiles = [];

  logger.info('Starting batch routing', {
    batchTimestamp,
    parcelCount: inputParcels.length
  });

  for (let i = 0; i < inputParcels.length; i += 1) {
    const parcel = inputParcels[i];
    const parcelIndex = i + 1;
    const parcelLogFile = path.join(batchLogDir, `parcel-${parcelIndex}.json`);

    const validation = validateSingleParcel(parcel);
    if (!validation.valid) {
      const failureData = {
        batchTimestamp,
        parcelIndex,
        status: 'failed',
        parcel,
        error: validation.error,
        timestamp: new Date().toISOString(),
      };
      await fs.writeFile(parcelLogFile, JSON.stringify(failureData, null, 2));
      parcelLogFiles.push(parcelLogFile);
      failed.push({ parcel, error: validation.error });
      logger.warn('Parcel validation failed', {
        batchTimestamp,
        parcelIndex,
        error: validation.error
      });
      continue;
    }

    try {
      const sanitized = sanitizeParcel(validation.value);
      const result = routingEngine.routeParcel(sanitized);
      const successData = {
        batchTimestamp,
        parcelIndex,
        status: 'routed',
        parcel: sanitized,
        decision: result,
        timestamp: new Date().toISOString(),
      };
      await fs.writeFile(parcelLogFile, JSON.stringify(successData, null, 2));
      parcelLogFiles.push(parcelLogFile);
      routed.push(result);
      departmentCounts[result.department] = (departmentCounts[result.department] || 0) + 1;
    } catch (routingError) {
      const errorData = {
        batchTimestamp,
        parcelIndex,
        status: 'error',
        parcel,
        error: routingError.message,
        timestamp: new Date().toISOString(),
      };
      await fs.writeFile(parcelLogFile, JSON.stringify(errorData, null, 2));
      parcelLogFiles.push(parcelLogFile);
      failed.push({ parcel, error: routingError.message });
      logger.error('Parcel routing error in batch', {
        batchTimestamp,
        parcelIndex,
        error: routingError.message
      });
    }
  }

  const processingTimeMs = Date.now() - startTime;

  orderSummary.totalRequests += 1;
  orderSummary.totalParcels += inputParcels.length;
  Object.entries(departmentCounts).forEach(([department, count]) => {
    orderSummary.departmentCounts[department] =
      (orderSummary.departmentCounts[department] || 0) + count;
  });
  orderSummary.lastParcel = null;
  orderSummary.lastBatch = {
    batchTimestamp,
    totalCount: inputParcels.length,
    successCount: routed.length,
    failureCount: failed.length,
    departmentCounts,
    parcelLogFiles,
    timestamp: new Date().toISOString(),
  };
  orderSummary.lastUpdated = orderSummary.lastBatch.timestamp;

  logger.info('Batch routing completed', {
    batchTimestamp,
    totalCount: inputParcels.length,
    successCount: routed.length,
    failureCount: failed.length,
    processingTimeMs,
    departmentCounts
  });

  return {
    batchTimestamp,
    totalCount: inputParcels.length,
    successCount: routed.length,
    failureCount: failed.length,
    departmentCounts,
    parcelLogFiles,
    routed,
    failed: failed.length > 0 ? failed : undefined,
    processingTimeMs,
  };
}

/**
 * Health Check Endpoint
 * GET /api/health
 *
 * Returns system health status for monitoring
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * Get Available Rules Endpoint
 * GET /api/rules
 *
 * Returns information about all available routing rules
 * Useful for understanding how the system routes parcels
 */
router.get('/rules', (req, res) => {
  try {
    const rules = routingEngine.getAvailableRules();
    res.json({
      success: true,
      rules,
      count: rules.length,
    });
  } catch (error) {
    logger.error('Failed to retrieve rules: %s', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve routing rules',
    });
  }
});

/**
 * Route Single Parcel Endpoint
 * POST /api/route
 *
 * Routes a single parcel and returns the department assignment
 *
 * Request Body:
 * {
 *   "weight": 5,
 *   "value": 500,
 *   "destinationCountry": "NL",
 *   "recipientName": "John Doe"
 * }
 */
router.post('/route', (req, res) => {
  try {
    // Validate input
    const validation = validateSingleParcel(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    // Sanitize input
    const parcel = sanitizeParcel(validation.value);

    // Route the parcel
    const decision = routingEngine.routeParcel(parcel);

    if (!decision.success) {
      return res.status(400).json({
        success: false,
        error: decision.error,
      });
    }

    orderSummary.totalRequests += 1;
    orderSummary.totalParcels += 1;
    orderSummary.departmentCounts[decision.department] =
      (orderSummary.departmentCounts[decision.department] || 0) + 1;
    orderSummary.lastParcel = {
      parcel,
      decision,
      timestamp: new Date().toISOString(),
    };
    orderSummary.lastBatch = null;
    orderSummary.lastUpdated = orderSummary.lastParcel.timestamp;

    res.json({
      success: true,
      parcel,
      decision,
      requestId: uuidv4(),
    });
  } catch (error) {
    logger.error('Routing failed: %s', error.message);
    res.status(500).json({
      success: false,
      error: 'Routing operation failed',
    });
  }
});

/**
 * Route Batch Parcels Endpoint
 * POST /api/route-batch
 *
 * Routes multiple parcels and returns department assignments for each
 *
 * Request Body:
 * {
 *   "parcels": [
 *     { "weight": 5, "value": 500 },
 *     { "weight": 15, "value": 2000 }
 *   ]
 * }
 */
router.post('/route-batch', async (req, res) => {
  const batchTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: 2026-05-04T21-57-02

  try {
    const inputParcels = req.body.parcels || req.body;
    if (!Array.isArray(inputParcels)) {
      return res.status(400).json({
        success: false,
        error: 'Input must be an array of parcels',
      });
    }

    if (inputParcels.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Must provide at least 1 parcel',
      });
    }

    if (inputParcels.length > config.MAX_BATCH_PARCELS) {
      return res.status(400).json({
        success: false,
        error: `Batch size exceeds limit of ${config.MAX_BATCH_PARCELS} parcels`,
      });
    }

    const result = await routeParcelBatch(inputParcels, batchTimestamp);

    res.json({
      success: true,
      result,
      requestId: batchTimestamp,
    });
  } catch (error) {
    logger.error('Batch routing failed: %s', error.message);
    res.status(500).json({
      success: false,
      error: 'Batch routing operation failed',
    });
  }
});

/**
 * Upload and Route File Endpoint
 * POST /api/upload
 *
 * Uploads a file (XML or JSON) and routes all parcels
 *
 * Query Parameters:
 * - format: 'xml' or 'json' (default: 'xml')
 *
 * Multipart form data:
 * - file: The file to upload
 */
router.post('/upload', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({
        success: true,
        message: 'File upload endpoint is available. Submit a file with field name "file".',
        hint: 'Example: curl -F "file=@your-file.xml" http://localhost:3000/api/upload?format=xml',
      });
    }

    const format = req.query.format || 'xml';
    const formatValidation = validateFileFormat(format);
    if (!formatValidation.valid) {
      return res.status(400).json({
        success: false,
        error: formatValidation.error,
      });
    }

    const content = req.file.buffer.toString('utf8');
    const parcels = await fileParser.parseContent(content, format);

    if (!Array.isArray(parcels) || parcels.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No parcels were found in the uploaded file',
      });
    }

    if (parcels.length > config.MAX_BATCH_PARCELS) {
      return res.status(400).json({
        success: false,
        error: `Uploaded parcel file exceeds limit of ${config.MAX_BATCH_PARCELS} parcels`,
      });
    }

    const batchTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const result = await routeParcelBatch(parcels, batchTimestamp);

    logger.info('File upload and processing completed', {
      format,
      parcelCount: parcels.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      processingTimeMs: result.processingTimeMs
    });

    res.json({
      success: true,
      message: 'File uploaded and parcels routed successfully',
      result,
      requestId: uuidv4(),
    });
  } catch (error) {
    logger.error('File upload failed: %s', error.message);
    res.status(500).json({
      success: false,
      error: 'File upload operation failed',
    });
  }
});

/**
 * System Statistics Endpoint
 * GET /api/stats
 *
 * Returns system statistics (for monitoring dashboard)
 * In production, this would query a database for historical data
 */
router.get('/stats', (req, res) => {
  try {
    res.json({
      success: true,
      stats: {
        requestTimestamp: new Date().toISOString(),
        systemStatus: 'operational',
        availableRules: routingEngine.getAvailableRules().length,
        departments: [
          'Mail',
          'Regular',
          'Heavy',
          'Insurance',
        ],
        message: 'Statistics endpoint - extend this to include historical data from database',
      },
    });
  } catch (error) {
    logger.error('Failed to retrieve stats: %s', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system statistics',
    });
  }
});

/**
 * Reset Orders Summary Endpoint
 * POST /api/orders-summary/reset
 *
 * Resets the order summary data to initial state.
 */
router.post('/orders-summary/reset', (req, res) => {
  orderSummary.totalRequests = 0;
  orderSummary.totalParcels = 0;
  orderSummary.departmentCounts = {
    Mail: 0,
    Regular: 0,
    Heavy: 0,
    Insurance: 0,
    Default: 0,
  };
  orderSummary.lastParcel = null;
  orderSummary.lastBatch = null;
  orderSummary.lastUpdated = null;
  res.json({
    success: true,
    message: 'Order summary has been reset',
  });
});

/**
 * Orders Summary Endpoint
 * GET /api/orders-summary
 *
 * Returns summary of parcels routed during this server session.
 * Includes detailed information from individual parcel log files.
 */
router.get('/orders-summary', async (req, res) => {
  try {
    const detailedSummary = { ...orderSummary };

    // If there's a last batch, read the individual parcel log files
    if (detailedSummary.lastBatch && detailedSummary.lastBatch.parcelLogFiles) {
      const parcelDetails = [];
      for (const logFile of detailedSummary.lastBatch.parcelLogFiles) {
        try {
          const logData = await fs.readFile(logFile, 'utf8');
          const parcelInfo = JSON.parse(logData);
          parcelDetails.push(parcelInfo);
        } catch (fileError) {
          logger.warn('Failed to read parcel log file %s: %s', logFile, fileError.message);
        }
      }
      detailedSummary.lastBatch.parcelDetails = parcelDetails;
    }

    res.json({
      success: true,
      summary: detailedSummary,
    });
  } catch (error) {
    logger.error('Failed to retrieve orders summary: %s', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve orders summary',
    });
  }
});

/**
 * 404 Not Found Handler
 */
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /api/health',
      'GET /api/rules',
      'POST /api/route',
      'POST /api/route-batch',
      'POST /api/upload',
      'GET /api/stats',
      'GET /api/orders-summary',
      'POST /api/orders-summary/reset',
    ],
  });
});

module.exports = router;
