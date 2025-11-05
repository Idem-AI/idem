// Auth models
export * from './auth/user.model';
export * from './auth/team.model';
export * from './auth/project-team.model';
export * from './auth/invitation.model';

// Project models
export * from './projects/project.model';

// Utility types
export interface BaseModel {
  id?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
