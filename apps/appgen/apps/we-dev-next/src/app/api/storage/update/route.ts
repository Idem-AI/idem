import { NextRequest, NextResponse } from "next/server";
import { storageService } from "../../../../../lib/services/storage.service";
import {
  verifyUserAuthentication,
  extractTokenFromHeader,
} from "../../../../../lib/auth/verify-user";

/**
 * PUT /api/storage/update
 * Update existing zip files (overwrites the old ones)
 */
export async function PUT(request: NextRequest) {
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

    // Parse form data
    const formData = await request.formData();
    const frontendFilePath = formData.get("frontendFilePath") as string | null;
    const backendFilePath = formData.get("backendFilePath") as string | null;
    const frontendZip = formData.get("frontend") as File | null;
    const backendZip = formData.get("backend") as File | null;

    if (!frontendZip && !backendZip) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one zip file (frontend or backend) is required",
        },
        { status: 400 }
      );
    }

    const results: {
      frontend?: { url: string; filePath: string; fileName: string };
      backend?: { url: string; filePath: string; fileName: string };
    } = {};

    // Update frontend zip if provided
    if (frontendZip && frontendFilePath) {
      if (frontendZip.type !== "application/zip") {
        return NextResponse.json(
          { success: false, error: "Frontend file must be a zip file" },
          { status: 400 }
        );
      }

      const arrayBuffer = await frontendZip.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const uploadResult = await storageService.updateZipFile(
        buffer,
        frontendFilePath
      );

      results.frontend = {
        url: uploadResult.downloadURL,
        filePath: uploadResult.filePath,
        fileName: uploadResult.fileName,
      };
    }

    // Update backend zip if provided
    if (backendZip && backendFilePath) {
      if (backendZip.type !== "application/zip") {
        return NextResponse.json(
          { success: false, error: "Backend file must be a zip file" },
          { status: 400 }
        );
      }

      const arrayBuffer = await backendZip.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const uploadResult = await storageService.updateZipFile(
        buffer,
        backendFilePath
      );

      results.backend = {
        url: uploadResult.downloadURL,
        filePath: uploadResult.filePath,
        fileName: uploadResult.fileName,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        frontend: results.frontend || null,
        backend: results.backend || null,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error in update API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update zip files",
      },
      { status: 500 }
    );
  }
}
