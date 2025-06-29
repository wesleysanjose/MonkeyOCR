# S3 Integration with Web Interface

This document explains how the MonkeyOCR web interface works with S3 storage.

## Overview

The S3 integration provides two modes of operation for the web interface:

1. **Optimized Mode** (with individual file URLs) - Faster, direct access to files
2. **Legacy Mode** (ZIP download only) - Backward compatible with existing deployments

## How It Works

### API Response Structure

When S3 is configured, the API returns:

```json
{
  "success": true,
  "message": "Document parsing completed successfully",
  "download_url": "https://bucket.s3.amazonaws.com/monkeyocr/parsed/xxx.zip",
  "file_urls": {
    "document.md": "https://bucket.s3.amazonaws.com/monkeyocr/parsed/xxx/document.md",
    "document_layout.pdf": "https://bucket.s3.amazonaws.com/monkeyocr/parsed/xxx/document_layout.pdf",
    "images/image_1.png": "https://bucket.s3.amazonaws.com/monkeyocr/parsed/xxx/images/image_1.png"
  }
}
```

### Web Interface Behavior

1. **With Individual File URLs** (Optimized):
   - Directly fetches markdown, PDF, and images from S3
   - No need to download and extract ZIP
   - Faster loading and display
   - Images are still converted to base64 for inline display

2. **Without Individual File URLs** (Legacy):
   - Downloads the entire ZIP file
   - Extracts contents client-side
   - Works the same as local file storage

### Configuration

Enable individual file uploads in `.env`:

```bash
# Enable individual file uploads for optimized web display
UPLOAD_INDIVIDUAL_FILES_S3=true
```

## Important: CORS Configuration

For the web interface to load images directly from S3/MinIO, you **MUST** configure CORS:

### MinIO CORS Setup:
```bash
# Using mc (MinIO Client)
cat > cors.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

mc anonymous set-json cors.json myminio/monkeyocr
```

### AWS S3 CORS Setup:
```bash
aws s3api put-bucket-cors --bucket monkeyocr --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
      "MaxAgeSeconds": 3000
    }
  ]
}'
```

**Note**: For production, replace `"AllowedOrigins": ["*"]` with your specific domain.

## Benefits

1. **Performance**:
   - Images load directly from S3 without downloading
   - No base64 encoding overhead
   - Browser can cache S3 images
   - Faster initial page display

2. **Scalability**:
   - Direct S3 access reduces API server load
   - CloudFront CDN can cache individual files
   - Better concurrent user support

3. **User Experience**:
   - Progressive loading (markdown loads first)
   - Faster preview rendering
   - Same download experience for full results

## Implementation Details

### API Server (`api/main.py`)

- Uploads both ZIP and individual files to S3
- Returns `file_urls` map in response
- Maintains backward compatibility

### Web Interface (`monkeyocr-web/`)

- **`lib/s3Handler.ts`**: New module for S3 direct access
- **`lib/zipHandler.ts`**: Enhanced to handle S3 pre-signed URLs
- **`app/page.tsx`**: Intelligently chooses between S3 direct or ZIP mode

### S3 Structure

```
bucket/
└── monkeyocr/
    └── parsed/
        ├── 1234567890_document.zip              # Full results ZIP
        └── 1234567890_document/                 # Individual files
            ├── document.md
            ├── document_layout.pdf
            ├── document_content_list.json
            └── images/
                ├── image_1.png
                └── image_2.jpg
```

## Security Considerations

1. **Pre-signed URLs**: All S3 URLs are time-limited (24 hours by default)
2. **No Direct S3 Access**: Client never gets S3 credentials
3. **CORS Configuration**: S3 bucket should allow CORS from your domain

## Troubleshooting

### Images Not Loading

1. Check S3 CORS configuration
2. Verify pre-signed URLs haven't expired
3. Check browser console for CORS errors

### Slow Performance

1. Enable CloudFront CDN for S3 bucket
2. Check S3 region proximity to users
3. Monitor S3 request metrics

### Fallback Issues

If S3 direct access fails, the system automatically falls back to ZIP download mode.

## Future Enhancements

1. **Streaming Updates**: Use S3 event notifications for real-time progress
2. **Partial Loading**: Load only visible pages for large documents
3. **Client-side Caching**: Cache processed results in browser
4. **Direct Upload**: Allow clients to upload directly to S3