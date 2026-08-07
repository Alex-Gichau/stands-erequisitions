import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// 1. JSON PAYLOAD PARSER MIDDLEWARE
// ============================================================================
// Parses incoming requests with JSON payloads and limits body sizes for security
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============================================================================
// 2. DATABASE CONNECTION LOGIC (RECONN-RESILIENT)
// ============================================================================
const mongoUri = process.env.MONGODB_URI || "mongodb://178.104.122.211:27017/stands_finance_db";

const dbOptions = {
  connectTimeoutMS: 10000, // Timeout after 10 seconds of trying to connect
  socketTimeoutMS: 45000,  // Close sockets after 45 seconds of inactivity
  serverSelectionTimeoutMS: 10000, // Fail fast if MongoDB server is down
};

async function connectDatabase() {
  try {
    console.log(`[Database Expert] Attempting connection to MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri, dbOptions);
    console.log(`[Database Expert] Successfully connected to database: ${mongoose.connection.db ? mongoose.connection.db.databaseName : "stands_finance_db"}`);
  } catch (error) {
    console.error("[Database Expert] Connection failed! Check IP whitelist/credentials.");
    console.error(`Reason: ${error.message}`);
    // Graceful retry loop or exit based on production setup
    console.log("[Database Expert] Retrying connection in 5 seconds...");
    setTimeout(connectDatabase, 5000);
  }
}

// Initialize MongoDB connection on startup
connectDatabase();

// Handle runtime connection issues
mongoose.connection.on("disconnected", () => {
  console.warn("[Database Expert] MongoDB connection lost! Connection state: disconnected");
});
mongoose.connection.on("reconnected", () => {
  console.log("[Database Expert] MongoDB connection restored! Connection state: reconnected");
});
mongoose.connection.on("error", (err) => {
  console.error(`[Database Expert] MongoDB runtime error: ${err.message}`);
});

// ============================================================================
// 3. SCHEMA & MODEL SPECIFICATION
// ============================================================================
// A flexible and modern schema to store, query, and validate parsed JSON data
const dataPayloadSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      default: "api-client",
      index: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed, // Accepts any valid, nested JSON data structure
      required: true
    },
    status: {
      type: String,
      enum: ["ACTIVE", "PROCESSED", "ARCHIVED"],
      default: "ACTIVE"
    },
    metadata: {
      clientIp: String,
      userAgent: String,
      processedAt: Date
    }
  },
  {
    timestamps: true, // Auto-generates createdAt and updatedAt fields
    versionKey: false // Excludes internal '__v' field from documents
  }
);

// Instantiate the Mongoose Model
const PayloadModel = mongoose.model("DataPayload", dataPayloadSchema);

// ============================================================================
// 4. API REQUEST HANDLERS (GET & POST)
// ============================================================================

/**
 * @route   GET /api/data
 * @desc    Fetch and retrieve stored JSON payloads
 */
app.get("/api/data", async (req, res) => {
  try {
    // 1. Verify Database Connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: "Service Unavailable",
        message: "Database is currently offline or reconnecting."
      });
    }

    // 2. Parse Query Params (e.g., limit, filter by source)
    const limit = parseInt(req.query.limit) || 20;
    const source = req.query.source ? String(req.query.source) : null;
    
    const filter = {};
    if (source) {
      filter.source = source;
    }

    // 3. Execute Query
    const data = await PayloadModel.find(filter)
      .sort({ createdAt: -1 }) // Get newest entries first
      .limit(limit)
      .lean(); // Faster execution, skips Mongoose document instantiation

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (err) {
    console.error("[GET /api/data Error]:", err.message);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message
    });
  }
});

/**
 * @route   POST /api/data
 * @desc    Receive, parse, validate, and persist an incoming JSON payload
 */
app.post("/api/data", async (req, res) => {
  try {
    // 1. Verify Database Connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: "Service Unavailable",
        message: "Database is offline. Payloads cannot be persisted at this time."
      });
    }

    // 2. Extract and Validate Payloads
    const { source, payload, status } = req.body;

    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid payload. Field 'payload' is required and must be a non-empty JSON object."
      });
    }

    // 3. Construct Document
    const newDoc = new PayloadModel({
      source: source || "direct-post",
      payload: payload,
      status: status || "ACTIVE",
      metadata: {
        clientIp: req.ip || req.headers["x-forwarded-for"] || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        processedAt: new Date()
      }
    });

    // 4. Save to Remote MongoDB
    const savedDoc = await newDoc.save();

    console.log(`[Database Expert] Persisted incoming payload with ID: ${savedDoc._id}`);

    return res.status(201).json({
      success: true,
      message: "Data payload parsed and stored successfully.",
      documentId: savedDoc._id,
      data: savedDoc
    });
  } catch (err) {
    console.error("[POST /api/data Error]:", err.message);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: err.message
    });
  }
});

/**
 * @route   GET /api/health
 * @desc    Return real-time server health and database connection telemetry
 */
app.get("/api/health", (req, res) => {
  const connectionStates = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };

  const dbState = mongoose.connection.readyState;

  res.status(dbState === 1 ? 200 : 503).json({
    success: dbState === 1,
    uptime: Math.floor(process.uptime()),
    database: {
      status: connectionStates[dbState] || "unknown",
      host: mongoose.connection.host || "178.104.122.211",
      port: mongoose.connection.port || 27017,
      name: mongoose.connection.name || "stands_finance_db"
    }
  });
});

// ============================================================================
// 5. SERVER LAUNCHER
// ============================================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`========================================================`);
  console.log(`🚀 [Database Expert] Server is running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📦 MongoDB Server IP: 178.104.122.211:27017`);
  console.log(`========================================================`);
});
