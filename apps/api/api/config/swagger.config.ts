import path from "path";

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Idem API",
      version: "1.0.0",
      description: "API documentation for the Idem platform",
      contact: {
        name: "Idem API Support",
        url: "https://your-support-url.com",
        email: "support@your-domain.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3001", // Corrected to match your actual port
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        cookieAuth: {
          // Added for session cookie authentication
          type: "apiKey",
          in: "cookie",
          name: "session", // Name of the cookie
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Path to the API docs
  // Paths to files containing OpenAPI definitions
  apis: [
    path.join(__dirname, "../routes/**/*.ts"),
    path.join(__dirname, "../models/**/*.ts"), // If you define schemas here
    path.join(__dirname, "../dtos/**/*.ts"), // For DTO definitions
  ],
};

export default swaggerOptions;
