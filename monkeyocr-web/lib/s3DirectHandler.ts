import { ExtractedFiles } from './zipHandler';

/**
 * Process files from S3 URLs without downloading images
 * Just replaces image paths in markdown with S3 URLs
 */
export async function processS3Files(fileUrls: Record<string, string>): Promise<ExtractedFiles> {
  try {
    console.log('Processing S3 files:', fileUrls);
    
    let markdown = '';
    let layoutPdf: Blob | undefined;
    const images = new Map<string, string>(); // Will store URL mappings instead of base64
    
    // First, download only the markdown and layout PDF
    const downloadPromises = Object.entries(fileUrls).map(async ([filename, url]) => {
      console.log(`Processing ${filename}`);
      
      if (filename.endsWith('.md')) {
        // Fetch markdown content
        const response = await fetch(url);
        if (response.ok) {
          markdown = await response.text();
          console.log('Downloaded markdown file:', filename);
        }
      } else if (filename.endsWith('_layout.pdf')) {
        // Fetch layout PDF as blob (still needed for PDF viewer)
        const response = await fetch(url);
        if (response.ok) {
          layoutPdf = await response.blob();
          console.log('Downloaded layout PDF:', filename);
        }
      } else if (filename.match(/\.(png|jpg|jpeg)$/i)) {
        // For images, just store the S3 URL mapping
        // Don't download the actual image
        const imageName = filename.split('/').pop() || filename;
        images.set(imageName, url);
        images.set(filename, url);
        
        // If it's in an images folder, also store without the folder prefix
        if (filename.includes('images/')) {
          const nameWithoutFolder = filename.replace(/.*images\//, '');
          images.set(nameWithoutFolder, url);
        }
        
        console.log('Mapped image URL:', filename, '-> ', url);
      }
    });
    
    await Promise.all(downloadPromises);
    
    // Replace image paths in markdown with S3 URLs
    if (markdown && images.size > 0) {
      console.log('Replacing image paths with S3 URLs, found', images.size, 'images');
      markdown = replaceImagePathsWithUrls(markdown, images);
    }
    
    return { markdown, layoutPdf, images };
  } catch (error) {
    console.error('Error processing S3 files:', error);
    throw error;
  }
}

function replaceImagePathsWithUrls(markdown: string, imageUrls: Map<string, string>): string {
  let processedMarkdown = markdown;
  let replacementCount = 0;
  
  // Process HTML tables - remove the <html> wrapper but keep the table
  processedMarkdown = processedMarkdown.replace(/<html>\s*(.*?)\s*<\/html>/gs, (match, htmlContent) => {
    if (htmlContent.includes('<table>') || htmlContent.includes('\\begin{tabular}')) {
      return htmlContent.trim();
    }
    return match;
  });
  
  // Replace image references in markdown with S3 URLs
  processedMarkdown = processedMarkdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, altText, imagePath) => {
    console.log('Processing image reference:', imagePath);
    
    // Extract just the filename from the path
    const filename = imagePath.split('/').pop() || '';
    
    // Try multiple matching strategies
    if (imageUrls.has(imagePath)) {
      replacementCount++;
      console.log('Direct match found for:', imagePath);
      return `![${altText}](${imageUrls.get(imagePath)})`;
    }
    
    if (imageUrls.has(filename)) {
      replacementCount++;
      console.log('Filename match found for:', filename);
      return `![${altText}](${imageUrls.get(filename)})`;
    }
    
    const pathWithoutImagesPrefix = imagePath.replace(/^images\//, '');
    if (imageUrls.has(pathWithoutImagesPrefix)) {
      replacementCount++;
      console.log('Path without prefix match found for:', pathWithoutImagesPrefix);
      return `![${altText}](${imageUrls.get(pathWithoutImagesPrefix)})`;
    }
    
    // Try flexible matching
    for (const [imageName, url] of imageUrls) {
      if (imagePath.endsWith(imageName) || imageName.endsWith(filename) || 
          imagePath.includes(imageName) || imageName.includes(filename)) {
        replacementCount++;
        console.log('Flexible match found:', imageName, 'for path:', imagePath);
        return `![${altText}](${url})`;
      }
    }
    
    console.warn('No S3 URL found for image:', imagePath);
    return match;
  });
  
  console.log(`Replaced ${replacementCount} image references with S3 URLs`);
  return processedMarkdown;
}