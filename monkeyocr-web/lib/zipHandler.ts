import JSZip from 'jszip';

export interface ExtractedFiles {
  markdown: string;
  layoutPdf?: Blob;
  images: Map<string, string>; // filename -> base64 data URL
}

export async function downloadAndExtractZip(url: string): Promise<ExtractedFiles> {
  try {
    console.log('Downloading ZIP from:', url);
    
    // If the URL starts with http://localhost:7861, replace with proxy path
    let fetchUrl = url;
    if (url.startsWith('http://localhost:7861')) {
      fetchUrl = url.replace('http://localhost:7861', '/api/monkeyocr');
    }
    
    console.log('Fetching from:', fetchUrl);
    
    // Download the ZIP file
    const response = await fetch(fetchUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }
    
    const zipBlob = await response.blob();
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(zipBlob);
    
    let markdown = '';
    let layoutPdf: Blob | undefined;
    const images = new Map<string, string>();
    
    // Process each file in the ZIP
    console.log('Files in ZIP:', Object.keys(zipContent.files));
    
    const filePromises = Object.keys(zipContent.files).map(async (filename) => {
      const file = zipContent.files[filename];
      
      if (file.dir) return; // Skip directories
      
      if (filename.endsWith('.md')) {
        // Extract markdown content
        markdown = await file.async('string');
        console.log('Found markdown file:', filename);
      } else if (filename.endsWith('_layout.pdf')) {
        // Extract layout PDF as blob
        layoutPdf = await file.async('blob');
        console.log('Found layout PDF:', filename);
      } else if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        // Extract ALL images regardless of path (to handle different ZIP structures)
        const imageBlob = await file.async('blob');
        const base64 = await blobToBase64(imageBlob);
        
        // Store with multiple possible keys to improve matching
        const imageName = filename.split('/').pop() || filename;
        images.set(imageName, base64);
        
        // Also store with the full path for better matching
        images.set(filename, base64);
        
        // If it's in an images folder, also store without the folder prefix
        if (filename.includes('images/')) {
          const nameWithoutFolder = filename.replace(/.*images\//, '');
          images.set(nameWithoutFolder, base64);
        }
        
        console.log('Found and extracted image:', filename, '-> saved with keys:', imageName, filename);
      }
    });
    
    await Promise.all(filePromises);
    
    // Process markdown to replace image paths with base64 data URLs
    if (markdown && images.size > 0) {
      console.log('Number of images extracted:', images.size);
      console.log('Image names:', Array.from(images.keys()));
      markdown = replaceImagePaths(markdown, images);
    } else {
      console.log('No images found in ZIP or no markdown content');
    }
    
    return { markdown, layoutPdf, images };
  } catch (error) {
    console.error('Error extracting ZIP:', error);
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
  // First, handle HTML-wrapped content
  let processedMarkdown = markdown;
  
  // Process HTML tables - remove the <html> wrapper but keep the table
  processedMarkdown = processedMarkdown.replace(/<html>\s*(.*?)\s*<\/html>/gs, (match, htmlContent) => {
    // If it contains a table, return just the table content
    if (htmlContent.includes('<table>') || htmlContent.includes('\\begin{tabular}')) {
      // For regular HTML tables, just return the content without <html> tags
      // Markdown renderers can handle inline HTML
      return htmlContent.trim();
    }
    return match;
  });
  
  let replacementCount = 0;
  const imageReferences: string[] = [];
  
  // First, find all image references in the markdown
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = imageRegex.exec(processedMarkdown)) !== null) {
    imageReferences.push(match[2]);
  }
  
  console.log('Found image references in markdown:', imageReferences);
  console.log('Available images in ZIP:', Array.from(images.keys()));
  
  // Replace image references in markdown with base64 data URLs
  processedMarkdown = processedMarkdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, altText, imagePath) => {
    console.log('Processing image reference:', imagePath);
    
    // Extract just the filename from the path
    const filename = imagePath.split('/').pop() || '';
    console.log('Looking for filename:', filename);
    
    // Try multiple matching strategies
    // 1. Direct lookup with the full path
    if (images.has(imagePath)) {
      console.log('Found direct path match! Replacing with base64');
      replacementCount++;
      return `![${altText}](${images.get(imagePath)})`;
    }
    
    // 2. Try with just the filename
    if (images.has(filename)) {
      console.log('Found filename match! Replacing with base64');
      replacementCount++;
      return `![${altText}](${images.get(filename)})`;
    }
    
    // 3. Try without 'images/' prefix if present
    const pathWithoutImagesPrefix = imagePath.replace(/^images\//, '');
    if (images.has(pathWithoutImagesPrefix)) {
      console.log('Found match without images/ prefix! Replacing with base64');
      replacementCount++;
      return `![${altText}](${images.get(pathWithoutImagesPrefix)})`;
    }
    
    // 4. Try more flexible matching
    for (const [imageName, base64] of images) {
      // Check if paths match in various ways
      if (imagePath.endsWith(imageName) || imageName.endsWith(filename) || 
          imagePath.includes(imageName) || imageName.includes(filename)) {
        console.log('Found flexible match! Replacing with base64');
        replacementCount++;
        return `![${altText}](${base64})`;
      }
    }
    
    // If image not found, log and return original
    console.warn('Image not found in extracted images:', filename);
    console.warn('Available images:', Array.from(images.keys()));
    return match;
  });
  
  console.log(`Replaced ${replacementCount} image references`);
  
  return processedMarkdown;
}