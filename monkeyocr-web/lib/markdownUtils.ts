/**
 * Utility functions for markdown processing
 */

/**
 * Split markdown content by page break markers
 * @param markdown The full markdown content with page markers
 * @returns Array of page contents, with page 1 at index 0
 */
export function splitMarkdownByPages(markdown: string): string[] {
  if (!markdown) return [''];
  
  // Pattern to match page break markers: <!-- Page Break: Page X of Y -->
  const pageBreakPattern = /<!-- Page Break: Page \d+ of \d+ -->/g;
  
  // Split by page markers
  const pages = markdown.split(pageBreakPattern);
  
  // Clean up each page (trim whitespace)
  const cleanedPages = pages.map(page => page.trim()).filter(page => page.length > 0);
  
  // If no page markers found, return the whole content as single page
  if (cleanedPages.length === 0) {
    return [markdown];
  }
  
  return cleanedPages;
}

/**
 * Extract total page count from markdown
 * @param markdown The full markdown content
 * @returns Total number of pages, or 1 if no markers found
 */
export function getTotalPages(markdown: string): number {
  if (!markdown) return 1;
  
  // Look for page markers to determine total pages
  const pageBreakPattern = /<!-- Page Break: Page \d+ of (\d+) -->/;
  const match = markdown.match(pageBreakPattern);
  
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  
  // If no markers, count the split pages
  const pages = splitMarkdownByPages(markdown);
  return Math.max(1, pages.length);
}

/**
 * Get a specific page from markdown
 * @param markdown The full markdown content
 * @param pageNumber The page number (1-indexed)
 * @returns The content of the specified page
 */
export function getMarkdownPage(markdown: string, pageNumber: number): string {
  const pages = splitMarkdownByPages(markdown);
  const pageIndex = pageNumber - 1;
  
  if (pageIndex < 0 || pageIndex >= pages.length) {
    return pages[0] || 'No content available';
  }
  
  return pages[pageIndex];
}