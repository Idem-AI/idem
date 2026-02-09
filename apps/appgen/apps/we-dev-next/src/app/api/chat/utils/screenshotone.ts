export const bytesToDataUrl = (bytes: Buffer, mimeType: string) => {
  const binary = bytes.toString('base64');
  return `data:${mimeType};base64,${binary}`;
};
export const screenshotOne = async (targetUrl: string) => {
  const apiKey = process.env.SCREENSHOTONE_API_KEY;
  const apiBaseUrl = "https://api.screenshotone.com/take" 
  const params = {
        "access_key": apiKey,
        "url": targetUrl,
        "full_page": "true",
        "device_scale_factor": "1",
        "format": "png",
        "block_ads": "true",
        "block_cookie_banners": "true",
        "block_trackers": "true",
        "cache": "false",
        "viewport_width": "1280",
        "viewport_height": "832",
    }
  // 构建查询字符串
  const searchParams = new URLSearchParams(params);
  const url = `${apiBaseUrl}?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/png',
      },
      signal: AbortSignal.timeout(60000), 
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    throw new Error('Error taking screenshot');
  }
}
 
