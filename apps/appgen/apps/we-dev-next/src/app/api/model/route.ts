import { NextResponse } from "next/server";
import { modelConfig } from "./config";
// Get model configuration, can be migrated to the configuration center
export async function POST() {
  // Filter out the key part
  const config = modelConfig.map((item) => {
    return {
      label: item.modelName,
      value: item.modelKey,
      useImage: item.useImage,
      description: item.description,
      icon: item.iconUrl,
      provider: item.provider,
      functionCall: item.functionCall,
    };
  });
  return NextResponse.json(config);
}
