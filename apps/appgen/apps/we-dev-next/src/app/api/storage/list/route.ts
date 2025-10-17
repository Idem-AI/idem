import { NextRequest, NextResponse } from "next/server";
import { storageService } from "../../../../../lib/services/storage.service";
import {
  verifyUserAuthentication,
  extractTokenFromHeader,
} from "../../../../../lib/auth/verify-user";

/**
 * GET /api/storage/list?projectId=xxx
 * List all zip files for a project
 */
export async function GET(request: NextRequest) {
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

    const userId = verificationResult.userId;

    // Get projectId from query params
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Missing projectId parameter" },
        { status: 400 }
      );
    }

    // List files from Firebase Storage
    const filePaths = await storageService.listProjectZipFiles(
      userId,
      projectId
    );

    // Get download URLs for each file
    const files = await Promise.all(
      filePaths.map(async (filePath) => {
        const downloadURL = await storageService.getDownloadURL(filePath);
        const fileName = filePath.split("/").pop() || "unknown.zip";
        return {
          filePath,
          fileName,
          downloadURL,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        files,
        count: files.length,
      },
    });
  } catch (error: any) {
    console.error("Error in list API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to list zip files",
      },
      { status: 500 }
    );
  }
}
