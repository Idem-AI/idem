import { NextRequest, NextResponse } from "next/server";
import { storageService } from "../../../../../lib/services/storage.service";
import {
  verifyUserAuthentication,
  extractTokenFromHeader,
} from "../../../../../lib/auth/verify-user";

/**
 * POST /api/storage/upload
 * Upload generated application zip files (frontend and/or backend)
 */
export async function POST(request: NextRequest) {
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

    // Parse form data
    const formData = await request.formData();
    const projectId = formData.get("projectId") as string;
    const frontendZip = formData.get("frontend") as File | null;
    const backendZip = formData.get("backend") as File | null;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Missing projectId" },
        { status: 400 }
      );
    }

    if (!frontendZip && !backendZip) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one zip file (frontend or backend) is required",
        },
        { status: 400 }
      );
    }

    // Validate file types
    if (frontendZip && frontendZip.type !== "application/zip") {
      return NextResponse.json(
        { success: false, error: "Frontend file must be a zip file" },
        { status: 400 }
      );
    }

    if (backendZip && backendZip.type !== "application/zip") {
      return NextResponse.json(
        { success: false, error: "Backend file must be a zip file" },
        { status: 400 }
      );
    }

    // Convert files to buffers
    const files: { frontend?: Buffer; backend?: Buffer } = {};

    if (frontendZip) {
      const arrayBuffer = await frontendZip.arrayBuffer();
      files.frontend = Buffer.from(arrayBuffer);
    }

    if (backendZip) {
      const arrayBuffer = await backendZip.arrayBuffer();
      files.backend = Buffer.from(arrayBuffer);
    }

    // Upload to Firebase Storage
    const uploadResults = await storageService.uploadGeneratedAppZips(
      files,
      userId,
      projectId
    );

    return NextResponse.json({
      success: true,
      data: {
        frontend: uploadResults.frontend
          ? {
              url: uploadResults.frontend.downloadURL,
              filePath: uploadResults.frontend.filePath,
              fileName: uploadResults.frontend.fileName,
            }
          : null,
        backend: uploadResults.backend
          ? {
              url: uploadResults.backend.downloadURL,
              filePath: uploadResults.backend.filePath,
              fileName: uploadResults.backend.fileName,
            }
          : null,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error in upload API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to upload zip files",
      },
      { status: 500 }
    );
  }
}
