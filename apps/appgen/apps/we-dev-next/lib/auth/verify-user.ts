import axios from "axios";

export interface UserVerificationResult {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
  error?: string;
}

/**
 * Verify user authentication by calling IDEM API
 * @param authToken - JWT token from Authorization header
 * @returns User verification result
 */
export async function verifyUserAuthentication(
  authToken: string
): Promise<UserVerificationResult> {
  try {
    const idemApiBaseUrl = process.env.IDEM_API_BASE_URL;

    if (!idemApiBaseUrl) {
      console.error("IDEM_API_BASE_URL is not configured");
      return {
        isAuthenticated: false,
        error: "Authentication service not configured",
      };
    }

    // Call IDEM API to verify the token
    const response = await axios.get(`${idemApiBaseUrl}/auth/verify`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      timeout: 5000, // 5 seconds timeout
    });

    if (response.status === 200 && response.data) {
      return {
        isAuthenticated: true,
        userId: response.data.userId || response.data.id,
        email: response.data.email,
      };
    }

    return {
      isAuthenticated: false,
      error: "Invalid authentication response",
    };
  } catch (error: any) {
    console.error("User authentication verification failed:", {
      error: error.message,
      status: error.response?.status,
    });

    return {
      isAuthenticated: false,
      error: error.response?.data?.message || "Authentication failed",
    };
  }
}

/**
 * Extract JWT token from Authorization header
 * @param authHeader - Authorization header value
 * @returns JWT token or null
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer token" and "token" formats
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    return parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }

  return null;
}
