# MonkeyOCR Web

A Next.js web application for MonkeyOCR - Multi-modal large language model for structured document understanding and information extraction.

## Features

- 📄 PDF and image file upload (PDF, JPG, JPEG, PNG)
- 👁️ Real-time file preview with page navigation
- 🔍 Document parsing with structure recognition
- 💬 Q&A interface for text, formula, and table extraction
- 📝 Markdown preview with LaTeX support
- ⬇️ Download parsed results (layout PDF and markdown)
- 🎨 Responsive design with Tailwind CSS

## Prerequisites

- Node.js 18.x or higher
- npm or yarn
- MonkeyOCR API server running at http://epyc:7861

## Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3800](http://localhost:3800) in your browser.

## Configuration

The API server URL is configured in `next.config.js`. Update the `rewrites` section if your API server is running on a different host:

```javascript
async rewrites() {
  return [
    {
      source: '/api/monkeyocr/:path*',
      destination: 'http://epyc:7861/:path*',
    },
  ]
}
```

## Build

To create a production build:

```bash
npm run build
npm start
```

## Technologies Used

- Next.js 14
- TypeScript
- Tailwind CSS
- React PDF
- React Markdown with KaTeX
- Axios