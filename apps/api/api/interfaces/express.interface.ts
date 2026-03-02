import { Request } from 'express';

export interface DecodedToken {
  uid: string;
  email?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

export interface CustomRequest extends Request {
  user?: DecodedToken;
  policyWarning?: {
    requiresFinalization: boolean;
    finalizeEndpoint: string;
  };
}
