import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.middleware';

/**
 * Generic validation middleware factory
 * Creates Express middleware that validates request body against a Zod schema
 */
export const validate = <T extends z.ZodTypeAny>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        const errors = result.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
        });
        return;
      }
      
      // Replace body with validated/transformed data
      req.body = result.data;
      next();
    } catch (error) {
      next(new AppError(400, 'Invalid request data'));
    }
  };
};

/**
 * Validate query parameters
 */
export const validateQuery = <T extends z.ZodTypeAny>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.query);
      
      if (!result.success) {
        const errors = result.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        res.status(400).json({
          success: false,
          message: 'Query validation failed',
          errors,
        });
        return;
      }
      
      req.query = result.data;
      next();
    } catch (error) {
      next(new AppError(400, 'Invalid query parameters'));
    }
  };
};

/**
 * Validate route parameters
 */
export const validateParams = <T extends z.ZodTypeAny>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.params);
      
      if (!result.success) {
        const errors = result.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        res.status(400).json({
          success: false,
          message: 'Parameter validation failed',
          errors,
        });
        return;
      }
      
      next();
    } catch (error) {
      next(new AppError(400, 'Invalid route parameters'));
    }
  };
};
