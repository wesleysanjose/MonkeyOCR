# S3 Integration for MonkeyOCR API

This document describes how to configure and use S3-compatible storage with the MonkeyOCR API server.

## Overview

The MonkeyOCR API can store parsed documents and results in S3-compatible storage services instead of local file storage. Supported services include:

- **Amazon S3** - AWS native object storage
- **MinIO** - Self-hosted S3-compatible storage
- **Wasabi** - S3-compatible cloud storage
- **DigitalOcean Spaces** - S3-compatible object storage
- **Any S3-compatible service** - Using the S3 API standard

This provides:

- **Better scalability** - Offloads file storage from API servers
- **Direct access URLs** - Generate pre-signed URLs for secure, time-limited access
- **CDN integration** - Can be integrated with CloudFront for global distribution
- **Cost efficiency** - Pay only for what you use

## Configuration

### 1. Set Environment Variables

Copy `.env.example` to `.env` and configure the S3 settings:

#### For AWS S3:
```bash
# Required
S3_BUCKET_NAME=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Optional
AWS_REGION=us-east-1  # Default: us-east-1
S3_PREFIX=monkeyocr   # Default: monkeyocr
```

#### For MinIO:
```bash
# Required
S3_BUCKET_NAME=your-bucket-name
S3_ENDPOINT_URL=http://localhost:9000  # Your MinIO endpoint
AWS_ACCESS_KEY_ID=minioadmin          # Your MinIO access key
AWS_SECRET_ACCESS_KEY=minioadmin      # Your MinIO secret key

# Optional
AWS_REGION=us-east-1       # Can be any value for MinIO
S3_PREFIX=monkeyocr        # Default: monkeyocr
S3_USE_SSL=false           # Set to false for local development
S3_VERIFY_SSL=false        # Set to false for self-signed certs

# If MinIO is behind a proxy/load balancer
S3_PUBLIC_URL=https://minio-public.example.com
```

#### For Other S3-Compatible Services:
```bash
# Wasabi example
S3_BUCKET_NAME=your-bucket-name
S3_ENDPOINT_URL=https://s3.wasabisys.com
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# DigitalOcean Spaces example
S3_BUCKET_NAME=your-space-name
S3_ENDPOINT_URL=https://nyc3.digitaloceanspaces.com
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=nyc3
```

### 2. Create Bucket

#### AWS S3:
```bash
# Create bucket
aws s3 mb s3://your-bucket-name --region us-east-1

# Set CORS policy for web access
aws s3api put-bucket-cors --bucket your-bucket-name --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}'
```

#### MinIO:
```bash
# Using MinIO client (mc)
mc alias set myminio http://localhost:9000 minioadmin minioadmin
mc mb myminio/your-bucket-name

# Set bucket policy to allow public read with presigned URLs
mc policy set download myminio/your-bucket-name

# Or using AWS CLI with MinIO
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
aws --endpoint-url http://localhost:9000 s3 mb s3://your-bucket-name
```

#### MinIO Docker Setup:
```yaml
# docker-compose.yml
version: '3.8'
services:
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"  # Console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

volumes:
  minio_data:
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

## MinIO-Specific Configuration

### Running MinIO Locally

1. **Start MinIO**:
```bash
# Using Docker
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"

# Or download and run binary
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
./minio server /data --console-address ":9001"
```

2. **Access MinIO Console**: http://localhost:9001

3. **Create bucket and access keys in console**

### MinIO Behind Reverse Proxy

If MinIO is behind nginx/traefik:

```bash
# Set public URL for correct presigned URLs
S3_PUBLIC_URL=https://minio.example.com
S3_ENDPOINT_URL=http://minio:9000  # Internal URL
```

## Troubleshooting

### Common Issues

1. **403 Forbidden on upload**
   - Check access key/secret key
   - Verify bucket exists and permissions
   - For MinIO: check bucket policy

2. **Pre-signed URLs not working**
   - Check CORS configuration
   - Verify endpoint URL is correct
   - For MinIO: ensure S3_PUBLIC_URL is set if behind proxy
   - Check if URL is accessible from browser

3. **Connection refused (MinIO)**
   - Verify MinIO is running
   - Check S3_ENDPOINT_URL is correct
   - Ensure firewall allows connection

4. **SSL certificate errors**
   - Set S3_USE_SSL=false for local development
   - Set S3_VERIFY_SSL=false for self-signed certs

5. **Slow uploads**
   - For AWS: Enable S3 Transfer Acceleration
   - For MinIO: Check network/disk performance
   - Use multipart uploads for large files

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