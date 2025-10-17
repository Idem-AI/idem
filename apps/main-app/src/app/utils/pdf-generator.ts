import { jsPDF } from 'jspdf';
import { marked } from 'marked';
import TurndownService from 'turndown';

async function convertSvgToBase64(svg: SVGSVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Get SVG data
      const xml = new XMLSerializer().serializeToString(svg);

      // Make SVG data URI-friendly
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        // Set dimensions with a minimum size
        canvas.width = Math.max(img.width, 10);
        canvas.height = Math.max(img.height, 10);

        // Fill with white background to prevent transparency issues
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the image
        ctx.drawImage(img, 0, 0);

        // Convert to PNG data URL
        const dataUrl = canvas.toDataURL('image/png');

        // Clean up
        URL.revokeObjectURL(url);

        resolve(dataUrl);
      };

      img.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load SVG as image: ${error}`));
      };

      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}

export async function generatePdf(
  content: string,
  isMarkdown: boolean = false
): Promise<void> {
  let htmlContent = isMarkdown ? await marked(content) : content;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  document.body.appendChild(tempDiv);

  // Process SVG elements - convert to PNG images
  const svgElements = tempDiv.querySelectorAll('svg');
  const svgPromises = Array.from(svgElements).map(async (svg) => {
    try {
      const base64 = await convertSvgToBase64(svg as SVGSVGElement);
      const img = document.createElement('img');
      img.src = base64;
      img.style.maxWidth = '100%';
      svg.parentNode?.replaceChild(img, svg);
    } catch (error) {
      console.warn('Échec de la conversion SVG:', error);
      // Instead of removing, replace with placeholder
      const placeholder = document.createElement('div');
      placeholder.textContent = '[Image non disponible]';
      placeholder.style.padding = '10px';
      placeholder.style.border = '1px solid #ccc';
      svg.parentNode?.replaceChild(placeholder, svg);
    }
  });

  // Wait for all SVG conversions to complete
  await Promise.all(svgPromises);

  const styledContent = `
    <div style="
      color: black !important;
      background: white !important;
      font-family: Arial, sans-serif !important;
      padding: 15mm;
      line-height: 1.5;
    ">
      ${tempDiv.innerHTML}
    </div>
  `;

  tempDiv.innerHTML = styledContent;

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      hotfixes: ['px_scaling'],
    });

    // Add default font - no need to specify custom font faces
    await doc.html(tempDiv, {
      callback: (pdf) => {
        pdf.save('document.pdf');
      },
      margin: [0, 0, 15, 0],
      width: 220,
      windowWidth: 824,
      x: 0,
      y: 15,
      // Removed fontFaces configuration that was causing issues
    });
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    throw new Error('Échec de la génération du PDF');
  } finally {
    document.body.removeChild(tempDiv);
  }
}

export async function markdownToHtml(markdown: string): Promise<string> {
  return await marked(markdown);
}

const turndownService = new TurndownService();

export function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}
