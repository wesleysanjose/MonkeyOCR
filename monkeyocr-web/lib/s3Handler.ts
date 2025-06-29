import { ExtractedFiles } from './zipHandler';

/**
 * Extract files directly from S3 URLs without downloading a ZIP
 * This is more efficient when files are already available individually in S3
 */
export async function extractFromS3Urls(fileUrls: Record<string, string>): Promise<ExtractedFiles> {
  try {
    console.log('Extracting from S3 URLs:', fileUrls);
    
    let markdown = '';
    let layoutPdf: Blob | undefined;
    const images = new Map<string, string>();
    
    // Process each file URL
    const filePromises = Object.entries(fileUrls).map(async ([filename, url]) => {
      console.log(`Processing ${filename} from ${url}`);
      
      if (filename.endsWith('.md')) {
        // Fetch markdown content
        const response = await fetch(url);
        if (response.ok) {
          markdown = await response.text();
          console.log('Downloaded markdown file:', filename);
        }
      } else if (filename.endsWith('_layout.pdf')) {
        // Fetch layout PDF as blob
        const response = await fetch(url);
        if (response.ok) {
          layoutPdf = await response.blob();
          console.log('Downloaded layout PDF:', filename);
        }
      } else if (filename.match(/\.(png|jpg|jpeg)$/i)) {
        // Fetch images and convert to base64
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          const base64 = await blobToBase64(blob);
          
          // Store with multiple possible keys to improve matching
          const imageName = filename.split('/').pop() || filename;
          images.set(imageName, base64);
          images.set(filename, base64);
          
          // If it's in an images folder, also store without the folder prefix
          if (filename.includes('images/')) {
            const nameWithoutFolder = filename.replace(/.*images\//, '');
            images.set(nameWithoutFolder, base64);
          }
          
          console.log('Downloaded and converted image:', filename);
        }
      }
    });
    
    await Promise.all(filePromises);
    
    // Process markdown to replace image paths with base64 data URLs
    if (markdown && images.size > 0) {
      console.log('Processing markdown with', images.size, 'images');
      markdown = replaceImagePaths(markdown, images);
    }
    
    return { markdown, layoutPdf, images };
  } catch (error) {
    console.error('Error extracting from S3 URLs:', error);
    throw error;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function replaceImagePaths(markdown: string, images: Map<string, string>): string {
  let processedMarkdown = markdown;
  
  // Process HTML tables - remove the <html> wrapper but keep the table
  processedMarkdown = processedMarkdown.replace(/<html>\s*(.*?)\s*<\/html>/gs, (match, htmlContent) => {
    if (htmlContent.includes('<table>') || htmlContent.includes('\\begin{tabular}')) {
      return htmlContent.trim();
    }
    return match;
  });
  
  let replacementCount = 0;
  
  // Replace image references in markdown with base64 data URLs
  processedMarkdown = processedMarkdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, altText, imagePath) => {
    console.log('Processing image reference:', imagePath);
    
    // Extract just the filename from the path
    const filename = imagePath.split('/').pop() || '';
    
    // Try multiple matching strategies
    if (images.has(imagePath)) {
      replacementCount++;
      return `![${altText}](${images.get(imagePath)})`;
    }
    
    if (images.has(filename)) {
      replacementCount++;
      return `![${altText}](${images.get(filename)})`;
    }
    
    const pathWithoutImagesPrefix = imagePath.replace(/^images\//, '');
    if (images.has(pathWithoutImagesPrefix)) {
      replacementCount++;
      return `![${altText}](${images.get(pathWithoutImagesPrefix)})`;
    }
    
    // Try flexible matching
    for (const [imageName, base64] of images) {
      if (imagePath.endsWith(imageName) || imageName.endsWith(filename) || 
          imagePath.includes(imageName) || imageName.includes(filename)) {
        replacementCount++;
        return `![${altText}](${base64})`;
      }
    }
    
    console.warn('Image not found:', filename);
    return match;
  });
  
  console.log(`Replaced ${replacementCount} image references`);
  return processedMarkdown;
}