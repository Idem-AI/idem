import { NextResponse } from "next/server";
export async function POST(request: Request) {
    console.log(process.env.NETLIFY_TOKEN, "NETLIFY_TOKEN");
    console.log(process.env.NETLIFY_DEPLOY_URL, "NETLIFY_DEPLOY_URL");
    const accessToken= process.env.NETLIFY_TOKEN;
    const url = process.env.NETLIFY_DEPLOY_URL;
    const formData = await request.formData();
    const file = formData.get("file") as File; 
    // Check if file is a zip file
    if (file.type !== "application/zip") {
        return NextResponse.json({
            success: false,
            message: "Invalid file type. Please upload a zip file"
        })
    }
    const headers = {
        "Content-Type": "application/zip",
        "Authorization": `Bearer ${accessToken}`
    };   
    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: file
    });
      // Check response
      if (response.ok) {
        const siteInfo = await response.json();
        console.log("Site created and deployed successfully");
        console.log(`Site URL: ${siteInfo.url}`);
        // Print more information as needed
        return NextResponse.json({
            success: true,
            url: siteInfo.url
        })
    } 
    console.log(`Failed to create site. Status code: ${response.status}`);
    console.log(`Response content: ${await response.text()}`);
    return NextResponse.json({
        success: false,
    })
}

