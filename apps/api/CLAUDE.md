# CLAUDE.md - API (Express.js)

This file provides guidance to **Claude Code** when working with the **API** Express.js backend.

## Project Overview

The API is a RESTful backend service built with **Express.js** and **TypeScript**. It provides endpoints for architecture generation, diagram processing, image manipulation, and integration with AI services.

## Technology Stack

- **Runtime**: Node.js (TypeScript)
- **Framework**: Express.js 4.21.2
- **Language**: TypeScript 5.8.2
- **Image Processing**: Sharp 0.33.5, Puppeteer 24.17.0
- **File Handling**: Multer 2.0.2, JSZip 3.10.1, AG-PSD 28.3.1
- **AI Integration**: OpenAI 4.95.1, Google GenAI 1.1.0
- **Caching**: IORedis 5.4.1
- **Authentication**: Firebase Admin 13.2.0
- **Logging**: Winston 3.17.0
- **API Documentation**: Swagger (swagger-jsdoc, swagger-ui-express)
- **Security**: CORS, Cookie Parser
- **Version Control**: Octokit (GitHub API)
- **Shared Models**: @idem/shared-models

## MCP Integration

**Use the Express.js MCP** for all Express-specific queries and code generation.

The MCP provides:

- Express.js best practices
- Middleware patterns
- Error handling strategies
- Routing conventions
- Security best practices
- Performance optimization

## Project Structure

```
api/
├── api/
│   ├── index.ts              # Entry point
│   ├── routes/               # Route handlers
│   │   ├── index.ts
│   │   ├── architecture.ts
│   │   ├── diagrams.ts
│   │   └── images.ts
│   ├── controllers/          # Business logic
│   │   ├── architectureController.ts
│   │   ├── diagramController.ts
│   │   └── imageController.ts
│   ├── middleware/           # Custom middleware
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   ├── validation.ts
│   │   └── rateLimiter.ts
│   ├── services/             # External services
│   │   ├── aiService.ts
│   │   ├── imageService.ts
│   │   └── cacheService.ts
│   ├── utils/                # Utilities
│   │   ├── logger.ts
│   │   └── helpers.ts
│   └── types/                # TypeScript types
│       └── index.ts
├── docs/                     # API documentation
└── tests/                    # Test files
```

## Express.js Best Practices

### Application Setup

```typescript
// api/index.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { config } from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Swagger documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Idem API',
      version: '1.0.0',
      description: 'API for architecture and diagram generation',
    },
    servers: [
      {
        url: process.env.API_URL || `http://localhost:${PORT}`,
      },
    ],
  },
  apis: ['./api/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
});

export default app;
```

### Router Pattern

```typescript
// api/routes/index.ts
import { Router } from 'express';
import architectureRoutes from './architecture';
import diagramRoutes from './diagrams';
import imageRoutes from './images';

const router = Router();

router.use('/architecture', architectureRoutes);
router.use('/diagrams', diagramRoutes);
router.use('/images', imageRoutes);

export default router;
```

```typescript
// api/routes/architecture.ts
import { Router } from 'express';
import {
  generateArchitecture,
  getArchitecture,
  updateArchitecture,
  deleteArchitecture,
} from '../controllers/architectureController';
import { authenticate } from '../middleware/auth';
import { validateArchitecture } from '../middleware/validation';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @swagger
 * /api/architecture:
 *   post:
 *     summary: Generate architecture diagram
 *     tags: [Architecture]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *     responses:
 *       201:
 *         description: Architecture generated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  authenticate,
  rateLimiter(10, 60000), // 10 requests per minute
  validateArchitecture,
  generateArchitecture
);

router.get('/:id', authenticate, getArchitecture);
router.put('/:id', authenticate, validateArchitecture, updateArchitecture);
router.delete('/:id', authenticate, deleteArchitecture);

export default router;
```

### Controller Pattern

```typescript
// api/controllers/architectureController.ts
import { Request, Response, NextFunction } from 'express';
import { ArchitectureService } from '../services/architectureService';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

const architectureService = new ArchitectureService();

export const generateArchitecture = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { description, type } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    logger.info(`Generating architecture for user ${userId}`);

    const architecture = await architectureService.generate({
      description,
      type,
      userId,
    });

    res.status(201).json({
      success: true,
      data: architecture,
    });
  } catch (error) {
    next(error);
  }
};

export const getArchitecture = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;

    const architecture = await architectureService.getById(id, userId);

    if (!architecture) {
      throw new AppError('Architecture not found', 404);
    }

    res.json({
      success: true,
      data: architecture,
    });
  } catch (error) {
    next(error);
  }
};

export const updateArchitecture = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    const updates = req.body;

    const architecture = await architectureService.update(id, userId, updates);

    res.json({
      success: true,
      data: architecture,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteArchitecture = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;

    await architectureService.delete(id, userId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
```

### Service Layer

```typescript
// api/services/architectureService.ts
import { OpenAI } from 'openai';
import { CacheService } from './cacheService';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

interface GenerateArchitectureInput {
  description: string;
  type: string;
  userId: string;
}

export class ArchitectureService {
  private openai: OpenAI;
  private cache: CacheService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.cache = new CacheService();
  }

  async generate(input: GenerateArchitectureInput) {
    const { description, type, userId } = input;

    // Check cache
    const cacheKey = `arch:${userId}:${type}:${description}`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      logger.info('Returning cached architecture');
      return JSON.parse(cached);
    }

    try {
      // Generate with AI
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert software architect.',
          },
          {
            role: 'user',
            content: `Generate a ${type} architecture for: ${description}`,
          },
        ],
        temperature: 0.7,
      });

      const result = completion.choices[0]?.message?.content;

      if (!result) {
        throw new AppError('Failed to generate architecture', 500);
      }

      const architecture = {
        id: this.generateId(),
        userId,
        type,
        description,
        content: result,
        createdAt: new Date().toISOString(),
      };

      // Cache result
      await this.cache.set(cacheKey, JSON.stringify(architecture), 3600);

      return architecture;
    } catch (error) {
      logger.error('Architecture generation failed:', error);
      throw new AppError('Failed to generate architecture', 500);
    }
  }

  async getById(id: string, userId: string) {
    // Implementation
    return null;
  }

  async update(id: string, userId: string, updates: any) {
    // Implementation
    return null;
  }

  async delete(id: string, userId: string) {
    // Implementation
  }

  private generateId(): string {
    return `arch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Middleware

#### Authentication Middleware

```typescript
// api/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { AppError } from '../utils/errors';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.substring(7);
    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = decodedToken;
    next();
  } catch (error) {
    next(new AppError('Invalid token', 401));
  }
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken;
    }
  }
}
```

#### Validation Middleware

```typescript
// api/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/errors';

const architectureSchema = z.object({
  description: z.string().min(10).max(1000),
  type: z.enum(['microservices', 'monolithic', 'serverless', 'event-driven']),
});

export const validateArchitecture = (req: Request, res: Response, next: NextFunction): void => {
  try {
    architectureSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
};
```

#### Rate Limiter Middleware

```typescript
// api/middleware/rateLimiter.ts
import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/cacheService';
import { AppError } from '../utils/errors';

const cache = new CacheService();

export const rateLimiter = (maxRequests: number, windowMs: number) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.uid || req.ip;
      const key = `ratelimit:${userId}`;

      const current = await cache.get(key);
      const count = current ? parseInt(current) : 0;

      if (count >= maxRequests) {
        throw new AppError('Too many requests', 429);
      }

      await cache.set(key, (count + 1).toString(), Math.ceil(windowMs / 1000));
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

#### Error Handler Middleware

```typescript
// api/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  logger.error(`Error: ${message}`, {
    statusCode,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
```

### Utilities

#### Logger

```typescript
// api/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}
```

#### Cache Service

```typescript
// api/services/cacheService.ts
import Redis from 'ioredis';
import { logger } from '../utils/logger';

export class CacheService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis connected');
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.client.flushall();
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }
}
```

## File Upload Handling

```typescript
// api/middleware/upload.ts
import multer from 'multer';
import path from 'path';
import { AppError } from '../utils/errors';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type', 400));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});
```

## Testing

```typescript
// tests/architecture.test.ts
import request from 'supertest';
import app from '../api/index';

describe('Architecture API', () => {
  let authToken: string;

  beforeAll(async () => {
    // Get auth token
    authToken = 'test-token';
  });

  describe('POST /api/architecture', () => {
    it('should generate architecture', async () => {
      const response = await request(app)
        .post('/api/architecture')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'E-commerce platform',
          type: 'microservices',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/architecture')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Short',
          type: 'invalid',
        });

      expect(response.status).toBe(400);
    });

    it('should return 401 without auth', async () => {
      const response = await request(app).post('/api/architecture').send({
        description: 'E-commerce platform',
        type: 'microservices',
      });

      expect(response.status).toBe(401);
    });
  });
});
```

## Development Commands

```bash
# Start development server
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Run tests
npm test
```

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **Input Validation**: Validate all user inputs with Zod
3. **Authentication**: Use Firebase Admin SDK for token verification
4. **Rate Limiting**: Implement rate limiting on all endpoints
5. **CORS**: Configure CORS properly for production
6. **Helmet**: Use helmet middleware for security headers
7. **SQL Injection**: Use parameterized queries (if using SQL)
8. **XSS**: Sanitize user inputs
9. **Logging**: Don't log sensitive information
10. **Error Handling**: Don't expose stack traces in production

## Important Reminders

1. **Use Express.js MCP** for Express-specific questions
2. **Async/await** for all async operations
3. **Error handling** - always use try-catch and error middleware
4. **TypeScript strictly** - type everything
5. **Logging** - use Winston for structured logging
6. **Validation** - validate inputs with Zod
7. **Caching** - use Redis for performance
8. **Documentation** - use Swagger for API docs
9. **Testing** - write integration tests
10. **Security** - follow OWASP guidelines

## Additional Resources

- [Express.js Documentation](https://expressjs.com)
- [TypeScript Documentation](https://www.typescriptlang.org)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Main Monorepo CLAUDE.md](../../CLAUDE.md)

---

**Remember**: Security, performance, and maintainability are paramount in backend development. Always validate, sanitize, and log appropriately.
