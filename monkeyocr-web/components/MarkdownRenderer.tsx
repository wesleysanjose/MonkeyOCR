import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { splitMarkdownByPages, getTotalPages, getMarkdownPage } from '../lib/markdownUtils';

interface MarkdownRendererProps {
  content: string;
  rawView?: boolean;
  currentPage?: number;
  onPageCountChange?: (totalPages: number) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  rawView = false,
  currentPage,
  onPageCountChange
}) => {
  const [displayContent, setDisplayContent] = useState<string>(content);
  const [totalPages, setTotalPages] = useState<number>(1);

  useEffect(() => {
    if (!content) {
      setDisplayContent('');
      setTotalPages(1);
      return;
    }

    // If currentPage is provided, we're in page mode
    if (currentPage !== undefined) {
      // Get total pages and notify parent
      const pageCount = getTotalPages(content);
      setTotalPages(pageCount);
      if (onPageCountChange && pageCount !== totalPages) {
        onPageCountChange(pageCount);
      }

      // Get content for current page
      const pageContent = getMarkdownPage(content, currentPage);
      setDisplayContent(pageContent);
    } else {
      // Show all content
      setDisplayContent(content);
    }
  }, [content, currentPage, onPageCountChange, totalPages]);
  if (rawView) {
    return (
      <textarea
        value={displayContent}
        readOnly
        className="w-full h-[800px] p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none overflow-auto"
      />
    );
  }

  return (
    <div className="markdown-body p-6 bg-white rounded-lg shadow-sm h-[800px] overflow-auto">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          img: ({ node, ...props }) => (
            <img
              {...props}
              className="max-w-full h-auto rounded-lg shadow-md my-4"
              loading="lazy"
            />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table
                {...props}
                className="min-w-full divide-y divide-gray-200 border border-gray-300"
              />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th
              {...props}
              className="px-4 py-2 bg-gray-100 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
            />
          ),
          td: ({ node, ...props }) => (
            <td
              {...props}
              className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 border-t"
            />
          ),
          code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <pre className="bg-gray-100 rounded-lg p-4 overflow-x-auto my-4">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            );
          },
          h1: ({ node, ...props }) => (
            <h1 {...props} className="text-3xl font-bold mt-6 mb-4" />
          ),
          h2: ({ node, ...props }) => (
            <h2 {...props} className="text-2xl font-bold mt-5 mb-3" />
          ),
          h3: ({ node, ...props }) => (
            <h3 {...props} className="text-xl font-bold mt-4 mb-2" />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className="my-3 leading-relaxed" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc list-inside my-4 space-y-2" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal list-inside my-4 space-y-2" />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              {...props}
              className="border-l-4 border-gray-300 pl-4 my-4 italic text-gray-700"
            />
          ),
        }}
      >
        {displayContent}
      </ReactMarkdown>
    </div>
  );
};