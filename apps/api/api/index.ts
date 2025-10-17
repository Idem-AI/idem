import express, { Express, Request, Response } from "express";
import morgan from "morgan";
import { stream as loggerStream } from "./config/logger";
import admin from "firebase-admin";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { authRoutes } from "./routes/auth.routes";
import { promptRoutes } from "./routes/prompt.routes";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import swaggerOptions from "./config/swagger.config";

dotenv.config();

const serviceAccountFromEnv = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
};

if (serviceAccountFromEnv.project_id && serviceAccountFromEnv.private_key) {
  admin.initializeApp({
    credential: admin.credential.cert(
      serviceAccountFromEnv as admin.ServiceAccount
    ),
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  console.log("Firebase Admin SDK initialized successfully.");
} else {
  console.error(
    "Firebase Admin SDK initialization failed: Missing credentials in environment variables."
  );
}

import { projectRoutes } from "./routes/project.routes";
import { brandingRoutes } from "./routes/branding.routes";
import { diagramRoutes } from "./routes/diagram.routes";
import { businessPlanRoutes } from "./routes/businessPlan.routes";
import { deploymentRoutes } from "./routes/deployment.routes";
import { developmentRoutes } from "./routes/development.routes";
import { userRoutes } from "./routes/user.routes";
import githubRoutes from "./routes/github.routes";
import archetypeRoutes from "./routes/archetype.routes";
import quotaRoutes from "./routes/quota.routes";
import cacheRoutes from "./routes/cache.routes";
import { PdfService } from "./services/pdf.service";
import RedisConnection from "./config/redis.config";
import policyRoutes from "./routes/policy.routes";

const app: Express = express();

// HTTP request logging middleware
app.use(morgan("combined", { stream: loggerStream }));
const port = process.env.PORT || 3001;
app.use(cookieParser());

app.use(express.json());

// Parse CORS allowed origins from environment variable
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [];

console.log(`CORS allowed origins: ${allowedOrigins.join(", ")}`);

app.use(
  cors({
    origin: function (origin, callback) {
      // Si pas d'origin (requêtes same-origin comme Swagger UI), autoriser
      if (!origin) {
        callback(null, true);
        return;
      }

      // Autoriser les requêtes depuis le même serveur (pour Swagger UI)
      if (origin.startsWith(`http://localhost:${port}`)) {
        callback(null, true);
        return;
      }

      // Vérifier si l'origin est dans la liste autorisée
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS: Origin not allowed: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Accept",
      "Accept-Language",
      "Accept-Encoding",
      "Connection",
      "User-Agent",
      "Referer",
      "Origin",
      "X-Requested-With",
    ],
    exposedHeaders: [
      "Content-Type",
      "Cache-Control",
      "Connection",
      "X-Accel-Buffering",
    ],
  })
);

app.use("/projects", projectRoutes);
app.use("/project", brandingRoutes);
app.use("/project", diagramRoutes);
app.use("/project", businessPlanRoutes);
app.use("/project", deploymentRoutes);
app.use("/project", developmentRoutes);
app.use("/auth", authRoutes);
app.use("/auth", userRoutes);
app.use("/prompt", promptRoutes);
app.use("/quota", quotaRoutes);
app.use("/archetypes", archetypeRoutes);
app.use("/github", githubRoutes);
app.use("/cache", cacheRoutes);
app.use("/project", policyRoutes);

// Swagger setup
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Welcome to idem API",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use((err: Error, req: Request, res: Response /*, next: NextFunction */) => {
  console.error("Global error handler:", err);
  res.status(500).send("Something broke!");
});

const server = app.listen(port, async () => {
  console.log(`Server running on port ${port}`);

  // Initialiser le PdfService au démarrage pour optimiser les performances
  try {
    await PdfService.initialize();
    console.log("PdfService initialized successfully");
  } catch (error) {
    console.error("Failed to initialize PdfService:", error);
  }

  // Tester la connexion Redis au démarrage
  try {
    const redisConnected = await RedisConnection.testConnection();
    if (redisConnected) {
      console.log("Redis connection established successfully");
    } else {
      console.warn("Redis connection test failed - cache will be disabled");
    }
  } catch (error) {
    console.error("Redis connection error:", error);
  }
});

// Gestion propre de l'arrêt de l'application
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  await PdfService.closeBrowser();
  await RedisConnection.disconnect();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  await PdfService.closeBrowser();
  await RedisConnection.disconnect();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export { admin };

export default app;
