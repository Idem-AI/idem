/**
 * Define the data structure parsed from URL
 */
interface ParsedData {
  text: string;
  images: string[];
  type: string;
  projectId?: string;
}

/**
 * Parse and decode the data parameter from URL and return the data object
 * @returns {ParsedData} Object containing text and images
 */
export function parseDataFromUrl(): ParsedData {
  try {
    // Get query parameters from current URL
    const urlParams = new URLSearchParams(window.location.search);
    
    // Get data parameter
    const encodedData = urlParams.get('data');
    
    // Return default value if no data parameter exists
    if (!encodedData) {
      // Check if projectId exists as a direct URL parameter
      const projectId = urlParams.get('projectId') || '';
      return { text: '', images: [], type: '', projectId };
    }
    
    // Decode and parse JSON data
    const decodedData = JSON.parse(decodeURIComponent(encodedData)) as Partial<ParsedData>;
    
    // Return parsed data object, ensuring valid structure even if some fields are missing
    return {
      text: decodedData.text || '',
      images: Array.isArray(decodedData.images) ? decodedData.images : [],
      type: decodedData.type || '',
      projectId: decodedData.projectId || urlParams.get('projectId') || ''
    };
  } catch (error) {
    console.error('Error parsing URL data:', error);
    // Return default value on error
    return { text: '', images: [], type: '', projectId: '' };
  }
}