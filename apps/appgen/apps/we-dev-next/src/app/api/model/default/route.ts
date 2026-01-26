import { NextRequest, NextResponse } from 'next/server';
import { getDefaultModelKey } from '../config';

export async function GET(request: NextRequest) {
  try {
    // Retourner le modèle par défaut
    const defaultModel = getDefaultModelKey();

    return NextResponse.json(
      { defaultModel },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching default model:', error);
    return NextResponse.json(
      { error: 'Failed to fetch default model', defaultModel: 'gemini-3-flash-preview' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
