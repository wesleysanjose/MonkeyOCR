import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  file: File | null;
  layoutPdfBlob?: Blob | null;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ file, layoutPdfBlob, currentPage: externalPage, onPageChange }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [internalPage, setInternalPage] = useState<number>(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pageHeight, setPageHeight] = useState<number>(0);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  
  // Use external page if provided, otherwise use internal state
  const currentPage = externalPage ?? internalPage;
  
  // Sync internal page with external page when external control is used
  useEffect(() => {
    if (externalPage && externalPage !== internalPage) {
      setInternalPage(externalPage);
    }
  }, [externalPage]);

  useEffect(() => {
    let urlToRevoke: string | null = null;
    
    // Reset initial load flag when file changes
    setIsInitialLoad(true);
    
    if (layoutPdfBlob) {
      // If we have a layout PDF blob, use that
      const url = URL.createObjectURL(layoutPdfBlob);
      setPdfUrl(url);
      setImageUrl(null);
      urlToRevoke = url;
    } else if (file) {
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('image/')) {
        setImageUrl(url);
        setPdfUrl(null);
        setNumPages(1);
      } else if (file.type === 'application/pdf') {
        setPdfUrl(url);
        setImageUrl(null);
      }
      urlToRevoke = url;
    }
    
    return () => {
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
      }
    };
  }, [file, layoutPdfBlob]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    if (!externalPage) {
      setInternalPage(1);
    }
  };

  const onPageLoadSuccess = ({ width, height }: { width: number; height: number }) => {
    setPageWidth(width);
    setPageHeight(height);
    
    // Only auto-fit on initial load or when explicitly requested
    if (isInitialLoad) {
      // Calculate scale to fit the page in the viewport
      // Viewport dimensions (accounting for padding)
      const viewportWidth = 750; // Approximate width of container
      const viewportHeight = 700; // Height minus controls
      
      const scaleX = viewportWidth / width;
      const scaleY = viewportHeight / height;
      
      // Use the smaller scale to ensure the entire page fits
      const fitScale = Math.min(scaleX, scaleY, 1.0) * 0.9; // 0.9 for some padding
      setScale(fitScale);
      setIsInitialLoad(false);
    }
  };

  const goToPrevPage = () => {
    const newPage = Math.max(1, currentPage - 1);
    if (onPageChange) {
      onPageChange(newPage);
    } else {
      setInternalPage(newPage);
    }
  };

  const goToNextPage = () => {
    const newPage = Math.min(numPages, currentPage + 1);
    if (onPageChange) {
      onPageChange(newPage);
    } else {
      setInternalPage(newPage);
    }
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  const fitToPage = () => {
    if (pageWidth && pageHeight) {
      const viewportWidth = 750;
      const viewportHeight = 700;
      
      const scaleX = viewportWidth / pageWidth;
      const scaleY = viewportHeight / pageHeight;
      
      const fitScale = Math.min(scaleX, scaleY, 1.0) * 0.9;
      setScale(fitScale);
    }
  };

  if (!file && !layoutPdfBlob) {
    return (
      <div className="h-[800px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
        <p className="text-gray-500">No file selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-md p-4">
        {/* Zoom Controls */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b">
          <div className="flex items-center space-x-2">
            <button
              onClick={zoomOut}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <button
              onClick={resetZoom}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium min-w-[60px]"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Zoom In"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </button>
            <div className="ml-4 border-l pl-4">
              <button
                onClick={fitToPage}
                className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors text-sm font-medium"
                title="Fit to Page"
              >
                Fit to Page
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Page {currentPage} of {numPages}
          </div>
        </div>
        
        <div className="h-[750px] overflow-auto flex items-center justify-center bg-gray-50">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt="Preview" 
              className="object-contain transition-transform duration-200"
              style={{ transform: `scale(${scale})`, maxWidth: `${scale * 100}%` }}
              onLoad={(e) => {
                if (isInitialLoad) {
                  const img = e.target as HTMLImageElement;
                  const imgWidth = img.naturalWidth;
                  const imgHeight = img.naturalHeight;
                  onPageLoadSuccess({ width: imgWidth, height: imgHeight });
                }
              }}
            />
          ) : pdfUrl ? (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500">Loading PDF...</div>
                </div>
              }
            >
              <Page 
                pageNumber={currentPage} 
                renderTextLayer={false}
                renderAnnotationLayer={false}
                scale={scale}
                onLoadSuccess={onPageLoadSuccess}
                className="transition-transform duration-200"
              />
            </Document>
          ) : null}
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <button
          onClick={goToPrevPage}
          disabled={currentPage <= 1}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
        >
          ⬅ Prev Page (上一页)
        </button>
        
        <div className="page-info-box">
          {currentPage} / {numPages}
        </div>
        
        <button
          onClick={goToNextPage}
          disabled={currentPage >= numPages}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
        >
          (下一页) Next Page ➡
        </button>
      </div>
    </div>
  );
};