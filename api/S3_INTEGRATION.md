# S3 Integration for MonkeyOCR API

This document describes how to configure and use S3 storage with the MonkeyOCR API server.

## Overview

The MonkeyOCR API can store parsed documents and results in Amazon S3 instead of local file storage. This provides:

- **Better scalability** - Offloads file storage from API servers
- **Direct access URLs** - Generate pre-signed URLs for secure, time-limited access
- **CDN integration** - Can be integrated with CloudFront for global distribution
- **Cost efficiency** - Pay only for what you use

## Configuration

### 1. Set Environment Variables

Copy `.env.example` to `.env` and configure the S3 settings:

```bash
# Required for S3 integration
S3_BUCKET_NAME=your-bucket-name

# Optional (defaults shown)
AWS_REGION=us-east-1
S3_PREFIX=monkeyocr

# AWS Credentials (choose one method):
# Method 1: Environment variables
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Method 2: IAM role (when running on EC2/ECS/Lambda)
# No credentials needed - automatically uses IAM role

# Method 3: AWS CLI configuration
# Configure via: aws configure
```

### 2. Create S3 Bucket

```bash
# Create bucket
aws s3 mb s3://your-bucket-name --region us-east-1

# Set appropriate bucket policy (example)
aws s3api put-bucket-policy --bucket your-bucket-name --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPresignedUrls",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/monkeyocr/*",
      "Condition": {
        "StringLike": {
          "aws:userid": "AIDAI*"
        }
      }
    }
  ]
}'
```

### 3. IAM Permissions

If using IAM roles or users, ensure they have these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

## Usage

### Document Parsing Endpoint

When S3 is configured, the `/parse` endpoint automatically:

1. Processes the PDF document
2. Creates a ZIP file with all results
3. Uploads the ZIP to S3
4. Returns a pre-signed URL (valid for 24 hours)

**Response with S3:**
```json
{
  "success": true,
  "message": "Document parsing completed successfully",
  "download_url": "https://your-bucket.s3.amazonaws.com/monkeyocr/parsed/...",
  "files": ["document.md", "document_layout.pdf", ...]
}
```

### OCR Task Endpoints

For `/ocr/text`, `/ocr/formula`, and `/ocr/table` endpoints:

- Results are returned directly in the response
- Optionally stored in S3 if `STORE_OCR_RESULTS_S3=true`
- S3 URL included in response when stored

**Response with S3 storage:**
```json
{
  "success": true,
  "task_type": "text",
  "content": "Extracted text content...",
  "message": "Text extraction completed successfully",
  "s3_url": "https://your-bucket.s3.amazonaws.com/monkeyocr/ocr/text/..."
}
```

## S3 Storage Structure

Files are organized in S3 as follows:

```
your-bucket/
└── monkeyocr/                 # Configurable prefix
    ├── parsed/                 # Full document parsing results
    │   └── 1234567890_document.zip
    └── ocr/                   # Single-task OCR results
        ├── text/
        │   └── 1234567890_image.png.md
        ├── formula/
        │   └── 1234567890_doc.pdf.md
        └── table/
            └── 1234567890_table.jpg.md
```

## Migration from Local Storage

If migrating from local file storage to S3:

1. Set up S3 configuration as described above
2. Restart the API server
3. New uploads will automatically use S3
4. Old files remain accessible via local storage

## Troubleshooting

### Common Issues

1. **403 Forbidden on upload**
   - Check IAM permissions
   - Verify bucket policy
   - Ensure credentials are correct

2. **Pre-signed URLs not working**
   - Check bucket CORS configuration
   - Verify AWS region is correct
   - Ensure system time is synchronized

3. **Slow uploads**
   - Consider enabling S3 Transfer Acceleration
   - Use multipart uploads for large files
   - Check network connectivity to AWS

### Debug Mode

Enable debug logging:
```python
import boto3
boto3.set_stream_logger('')
```

## Security Best Practices

1. **Use IAM roles** instead of access keys when possible
2. **Enable bucket encryption** for sensitive documents
3. **Set lifecycle policies** to auto-delete old files
4. **Monitor access** with CloudTrail logging
5. **Use bucket policies** to restrict access
6. **Enable versioning** for important documents

## Cost Optimization

1. **Set lifecycle rules** to move old files to cheaper storage classes
2. **Enable S3 Intelligent-Tiering** for automatic optimization
3. **Use S3 metrics** to monitor usage
4. **Consider S3 One Zone-IA** for non-critical data
5. **Implement cleanup policies** for temporary files