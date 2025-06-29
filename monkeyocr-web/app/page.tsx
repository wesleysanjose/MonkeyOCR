'use client';

import React, { useState, useCallback } from 'react';
import { FileUploader } from '../components/FileUploader';
import { PDFViewer } from '../components/PDFViewer';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { ChatInterface, ChatPrompt } from '../components/ChatInterface';
import { monkeyOCRAPI, ParseResponse, TaskResponse } from '../lib/api';
import { downloadAndExtractZip } from '../lib/zipHandler';
import { processS3Files } from '../lib/s3DirectHandler';

const chatPrompts: ChatPrompt[] = [
  {
    label: 'Text (文本)',
    value: 'text',
    instruction: 'Please output the text content from the image.',
  },
  {
    label: 'Formula (公式)',
    value: 'formula',
    instruction: 'Please write out the expression of the formula in the image using LaTeX format.',
  },
  {
    label: 'Table HTML (表格HTML)',
    value: 'table_html',
    instruction: 'This is the image of a table. Please output the table in html format.',
  },
  {
    label: 'Table LaTeX (表格LaTeX)',
    value: 'table_latex',
    instruction: 'Please output the table in the image in LaTeX format.',
  },
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('## 🕐 Waiting for parsing result...');
  const [rawMarkdownContent, setRawMarkdownContent] = useState<string>('🕐 Waiting for parsing result...');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'raw'>('preview');
  const [selectedPrompt, setSelectedPrompt] = useState<ChatPrompt>(chatPrompts[0]);
  const [layoutPdfBlob, setLayoutPdfBlob] = useState<Blob | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [downloadSize, setDownloadSize] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [markdownPageCount, setMarkdownPageCount] = useState<number>(1);
  const [syncNavigation, setSyncNavigation] = useState<boolean>(true);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    // Reset results when new file is selected
    setMarkdownContent('## 🕐 Waiting for parsing result...');
    setRawMarkdownContent('🕐 Waiting for parsing result...');
    setLayoutPdfBlob(null);
    setDownloadUrl('');
    setDownloadSize(0);
    setCurrentPage(1);
    setMarkdownPageCount(1);
  }, []);

  const handleParse = useCallback(async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setMarkdownContent('## ⏳ Processing document...');
    setRawMarkdownContent('⏳ Processing document...');

    try {
      // Parse with page markers for synchronized navigation
      const response: ParseResponse = await monkeyOCRAPI.parseDocument(selectedFile, syncNavigation);
      
      if (response.success) {
        if (response.download_url) {
          // Store download URL for manual download button
          setDownloadUrl(response.download_url);
          setDownloadSize(response.download_size || 0);
          
          // Download and extract the ZIP file
          setMarkdownContent('## ⏳ Extracting results...');
          
          console.log('Download URL:', response.download_url);
          console.log('Response:', response);
          
          try {
            let extracted;
            
            // Check if we have individual file URLs (S3 optimization)
            if (response.file_urls && Object.keys(response.file_urls).length > 0) {
              console.log('Using S3 direct URLs - images will load from S3');
              extracted = await processS3Files(response.file_urls);
            } else {
              // Fallback to downloading ZIP
              console.log('Downloading ZIP file');
              extracted = await downloadAndExtractZip(response.download_url);
            }
            
            // Set the markdown content
            if (extracted.markdown) {
              setRawMarkdownContent(extracted.markdown);
              setMarkdownContent(extracted.markdown);
            } else {
              setMarkdownContent('## ⚠️ No markdown content found in the results');
              setRawMarkdownContent('No markdown content found');
            }
            
            // Set the layout PDF blob for viewing
            if (extracted.layoutPdf) {
              setLayoutPdfBlob(extracted.layoutPdf);
            }
          } catch (extractError: any) {
            console.error('Failed to extract ZIP:', extractError);
            console.error('Download URL was:', response.download_url);
            setMarkdownContent(`## ✅ Parsing Complete\n\nResults are ready for download, but automatic extraction failed.\n\nError: ${extractError.message}`);
            setRawMarkdownContent(response.message);
          }
        } else {
          setMarkdownContent(`## ✅ Parsing Complete\n\n${response.message}`);
          setRawMarkdownContent(response.message);
        }
      } else {
        setMarkdownContent(`## ❌ Error\n\n${response.message}`);
        setRawMarkdownContent(response.message);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error occurred';
      setMarkdownContent(`## ❌ Error\n\n${errorMessage}`);
      setRawMarkdownContent(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, syncNavigation]);

  const handleChat = useCallback(async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setMarkdownContent('## ⏳ Processing with chat mode...');
    setRawMarkdownContent('⏳ Processing with chat mode...');

    try {
      let response: TaskResponse;
      
      switch (selectedPrompt.value) {
        case 'text':
          response = await monkeyOCRAPI.extractText(selectedFile);
          break;
        case 'formula':
          response = await monkeyOCRAPI.extractFormula(selectedFile);
          break;
        case 'table_html':
        case 'table_latex':
          response = await monkeyOCRAPI.extractTable(selectedFile);
          break;
        default:
          response = await monkeyOCRAPI.extractText(selectedFile);
      }

      if (response.success) {
        setRawMarkdownContent(response.content);
        setMarkdownContent(response.content);
      } else {
        const errorMsg = response.message || 'Processing failed';
        setMarkdownContent(`## ❌ Error\n\n${errorMsg}`);
        setRawMarkdownContent(errorMsg);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error occurred';
      setMarkdownContent(`## ❌ Error\n\n${errorMessage}`);
      setRawMarkdownContent(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, selectedPrompt]);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setMarkdownContent('## 🕐 Waiting for parsing result...');
    setRawMarkdownContent('🕐 Waiting for parsing result...');
    setLayoutPdfBlob(null);
    setDownloadUrl('');
    setDownloadSize(0);
    setCurrentPage(1);
    setMarkdownPageCount(1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleMarkdownPageCountChange = useCallback((count: number) => {
    setMarkdownPageCount(count);
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">MonkeyOCR</h1>
          <p className="text-gray-600">Supports PDF parse, image parse, and Q&A</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Upload and Controls */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">📥 Upload PDF/Image (上传PDF/Image)</h3>
              <FileUploader onFileSelect={handleFileSelect} disabled={isProcessing} />
              {selectedFile && (
                <p className="mt-2 text-sm text-gray-600 truncate">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <ChatInterface
                prompts={chatPrompts}
                selectedPrompt={selectedPrompt}
                onPromptChange={setSelectedPrompt}
                onChat={handleChat}
                disabled={!selectedFile || isProcessing}
              />
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">⚙️ Actions (操作)</h3>
              <div className="space-y-3">
                <button
                  onClick={handleParse}
                  disabled={!selectedFile || (!selectedFile.type.startsWith('image/') && selectedFile.type !== 'application/pdf') || isProcessing}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  🔍 Parse (解析)
                </button>
                
                <button
                  onClick={handleClear}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  🗑️ Clear (清除)
                </button>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncNavigation}
                      onChange={(e) => setSyncNavigation(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      🔄 Sync PDF/Markdown Navigation
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    When enabled, parsing includes page markers for synchronized viewing
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ minHeight: '900px' }}>
            {/* PDF Preview */}
            <div className="bg-white rounded-lg shadow-md p-6 flex flex-col h-full">
              <h3 className="text-lg font-semibold mb-4">👁️ File Preview (文件预览)</h3>
              <div className="flex-1">
                <PDFViewer 
                  file={selectedFile} 
                  layoutPdfBlob={layoutPdfBlob}
                  currentPage={syncNavigation ? currentPage : undefined}
                  onPageChange={syncNavigation ? handlePageChange : undefined}
                />
              </div>
            </div>

            {/* Markdown Result */}
            <div className="bg-white rounded-lg shadow-md p-6 flex flex-col h-full">
              <h3 className="text-lg font-semibold mb-4">✔️ Result Display (结果展示)</h3>
              
              {/* Tabs */}
              <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'preview'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Markdown Preview (Markdown预览)
                  </button>
                  <button
                    onClick={() => setActiveTab('raw')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'raw'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Raw Text (原始文本)
                  </button>
                </nav>
              </div>

              <div className="flex-1">
                <MarkdownRenderer 
                  content={activeTab === 'preview' ? markdownContent : rawMarkdownContent} 
                  rawView={activeTab === 'raw'}
                  currentPage={syncNavigation ? currentPage : undefined}
                  onPageCountChange={syncNavigation ? handleMarkdownPageCountChange : undefined}
                />
              </div>

              {/* Download Button */}
              {downloadUrl && (
                <div className="mt-4">
                  <a
                    href={downloadUrl}
                    download
                    className="block w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-center"
                  >
                    ⬇️ Download Results (ZIP{downloadSize > 0 ? ` - ${(downloadSize / 1024 / 1024).toFixed(2)} MB` : ''})
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}