import { NextResponse } from 'next/server';
export async function POST(request: Request) {
  try {
    console.log('=== DEPLOY API CALLED ===');
    console.log('NETLIFY_TOKEN:', process.env.NETLIFY_TOKEN ? 'Present' : 'Missing');
    console.log('NETLIFY_DEPLOY_URL:', process.env.NETLIFY_DEPLOY_URL);

    const accessToken = process.env.NETLIFY_TOKEN;
    const url = process.env.NETLIFY_DEPLOY_URL;

    if (!accessToken || !url) {
      console.error('Missing Netlify configuration');
      return NextResponse.json({
        success: false,
        message: 'Netlify configuration missing',
      });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('No file provided');
      return NextResponse.json({
        success: false,
        message: 'No file provided',
      });
    }

    console.log('File info:', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Check if file is a zip file
    if (file.type !== 'application/zip') {
      console.error('Invalid file type:', file.type);
      return NextResponse.json({
        success: false,
        message: 'Invalid file type. Please upload a zip file',
      });
    }

    // Create a new site first
    console.log('Creating new site on Netlify...');
    const createSiteResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: `idem-app-${Date.now()}`, // Generate unique site name
      }),
    });

    if (!createSiteResponse.ok) {
      const errorText = await createSiteResponse.text();
      console.error('Failed to create site:', createSiteResponse.status, errorText);
      return NextResponse.json({
        success: false,
        message: `Failed to create site: ${createSiteResponse.status} - ${errorText}`,
      });
    }

    const siteData = await createSiteResponse.json();
    console.log('Site created:', siteData);

    // Now deploy to the created site
    const deployUrl = `${url}/${siteData.id}/deploys`;
    console.log('Deploying to site:', deployUrl);

    const headers = {
      'Content-Type': 'application/zip',
      Authorization: `Bearer ${accessToken}`,
    };

    console.log('Sending deployment request to Netlify...');
    const response = await fetch(deployUrl, {
      method: 'POST',
      headers: headers,
      body: file,
    });

    console.log('Netlify response status:', response.status);
    console.log('Netlify response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Netlify response body:', responseText);

    // Check response
    if (response.ok) {
      try {
        const siteInfo = JSON.parse(responseText);
        console.log('Site created and deployed successfully');
        console.log('Site URL:', siteInfo.url);

        return NextResponse.json({
          success: true,
          url: siteInfo.url,
          siteInfo: siteInfo,
        });
      } catch (parseError) {
        console.error('Failed to parse Netlify response:', parseError);
        return NextResponse.json({
          success: false,
          message: 'Invalid response from Netlify',
        });
      }
    } else {
      console.error(`Failed to create site. Status code: ${response.status}`);
      console.error(`Response content: ${responseText}`);

      return NextResponse.json({
        success: false,
        message: `Netlify deployment failed: ${response.status} - ${responseText}`,
        status: response.status,
      });
    }
  } catch (error) {
    console.error('Deploy API error:', error);
    return NextResponse.json({
      success: false,
      message: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
