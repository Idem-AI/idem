import { DeploymentModel } from "../../models/deployment.model";

export interface BaseResponseDto {
  success: boolean;
  message: string;
  data?: DeploymentModel | DeploymentModel[] | any;
  errors?: string[];
}

// Standard success response
export const successResponse = (
  message: string,
  data?: any
): BaseResponseDto => ({
  success: true,
  message,
  data,
});

// Standard error response
export const errorResponse = (
  message: string,
  errors?: string[]
): BaseResponseDto => ({
  success: false,
  message,
  errors,
});
