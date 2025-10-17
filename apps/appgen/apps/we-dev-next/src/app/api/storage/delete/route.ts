import { NextRequest, NextResponse } from "next/server";
import { storageService } from "../../../../../lib/services/storage.service";
import {
  verifyUserAuthentication,
  extractTokenFromHeader,
} from "../../../../../lib/auth/verify-user";

/**
 * DELETE /api/storage/delete
 * Delete zip files from Firebase Storage
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify user authentication
    const authHeader = request.headers.get("Authorization");
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing authentication token" },
        { status: 401 }
      );
    }

    const verificationResult = await verifyUserAuthentication(token);

    if (!verificationResult.isAuthenticated || !verificationResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error: verificationResult.error || "Authentication failed",
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { filePaths } = body;

    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "filePaths array is required and must not be empty",
        },
        { status: 400 }
      );
    }

    // Delete files from Firebase Storage
    await storageService.deleteMultipleZipFiles(filePaths);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${filePaths.length} file(s)`,
      deletedCount: filePaths.length,
    });
  } catch (error: any) {
    console.error("Error in delete API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete zip files",
      },
      { status: 500 }
    );
  }
}
