const express = require("express");
const path = require("path");
const fs = require("fs");
const { ApolloServer } = require("apollo-server-express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");

const { GoogleAuth } = require("google-auth-library");
const axios = require("axios");
require("dotenv").config();
// Import the configured upload middleware
const upload = require("./utils/uploadConfig");
const typeDefs = require("./schema");
const query = require("./mutations/query");
const mutation = require("./mutations/mutations");

const app = express();

// Update CORS configuration
app.use(
  cors({
    origin: ["http://localhost:3000"], // Frontend URL
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

app.use(express.json());

// Create directories
const assetsDir = path.join(__dirname, "assets");
const uploadsDir = path.join(__dirname, "uploads");
const productUploadsDir = path.join(uploadsDir, "products");

// Create necessary directories
[assetsDir, uploadsDir, productUploadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Update file upload endpoint
app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const imageUrl = `http://localhost:4000/uploads/products/${req.file.filename}`;

    console.log("Product image uploaded:", {
      originalName: req.file.originalname,
      savedAs: req.file.filename,
      url: imageUrl,
    });

    res.json({
      success: true,
      url: imageUrl,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Serve uploaded files
app.use(
  "/uploads/products",
  express.static(path.join(__dirname, "uploads/products"))
);

// Add route for creating products
app.post("/api/products", async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Combine resolvers
const resolvers = {
  Query: query.Query,
  Mutation: mutation.Mutation,
};

// Context middleware for authentication
const context = ({ req }) => {
  const auth = req.headers.authorization || "";
  console.log("Auth header:", auth);

  if (auth) {
    try {
      // Remove quotes from the token string
      const token = auth.replace(/"/g, "");
      console.log("Cleaned token:", token);

      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decodedToken);

      const user = {
        id: decodedToken.id,
        email: decodedToken.email,
        role: decodedToken.role,
      };
      console.log("Authenticated user:", user);
      return { user };
    } catch (error) {
      console.error("Token verification failed:", error.message);
    }
  }
  console.log("No auth token provided");
  return { user: null };
};

// Update the authenticateEarthEngine function
const authenticateEarthEngine = async () => {
  try {
    console.log("🔄 Authenticating with Google Earth Engine...");
    const auth = new GoogleAuth({
      keyFilename: path.join(
        __dirname,
        process.env.GOOGLE_APPLICATION_CREDENTIALS
      ),
      scopes: ["https://www.googleapis.com/auth/earthengine"],
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    if (!token?.access_token) {
      throw new Error("No access token received from Google Auth");
    }

    console.log("✅ Google Earth Engine authenticated successfully!");
    return token.access_token;
  } catch (error) {
    console.error("❌ GEE Authentication Failed:", error);
    throw error;
  }
};

async function startApolloServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context,
    formatError: (error) => {
      console.error("GraphQL Error:", error);
      return {
        message: error.message,
        path: error.path,
      };
    },
  });

  await server.start();
  server.applyMiddleware({ app });

  // Modern MongoDB Connection
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });

    console.log("Connected to MongoDB");

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

// NDVI endpoint
app.post("/api/ndvi", async (req, res) => {
  try {
    const { bounds } = req.body;

    // Validate input
    if (
      !bounds ||
      typeof bounds.north !== "number" ||
      typeof bounds.south !== "number" ||
      typeof bounds.east !== "number" ||
      typeof bounds.west !== "number"
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid bounds provided",
      });
    }

    // Generate NDVI data points
    const points = [];
    const latSpread = bounds.north - bounds.south;
    const lngSpread = bounds.east - bounds.west;
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;

    // Generate more realistic NDVI values
    for (let i = 0; i < 200; i++) {
      // Calculate position
      const lat = centerLat + (Math.random() - 0.5) * latSpread;
      const lng = centerLng + (Math.random() - 0.5) * lngSpread;

      // Calculate distance from center (0-1 range)
      const distanceFromCenter = Math.sqrt(
        Math.pow((lat - centerLat) / (latSpread / 2), 2) +
          Math.pow((lng - centerLng) / (lngSpread / 2), 2)
      );

      // Generate NDVI value (0-1 range)
      // Higher values near center, lower at edges
      const baseValue = Math.random() * 0.3 + 0.4; // Base value between 0.4-0.7
      const value = Math.max(
        0,
        Math.min(1, baseValue * (1 - distanceFromCenter / 2))
      );

      points.push({ lat, lng, value });
    }

    console.log(`✅ Generated ${points.length} NDVI points`);

    res.json({
      success: true,
      data: {
        points,
        bounds,
      },
    });
  } catch (error) {
    console.error("NDVI calculation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to calculate NDVI",
    });
  }
});

// Error handling middleware for file uploads
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File size is too large. Maximum size is 5MB",
      });
    }
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
  next(error);
});

startApolloServer().catch((error) => {
  console.error("Server startup error:", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});
