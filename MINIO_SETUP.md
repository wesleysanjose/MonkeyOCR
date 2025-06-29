# MinIO Setup Guide for MonkeyOCR

This guide walks through setting up MinIO as an S3-compatible storage backend for MonkeyOCR.

## Quick Start

### 1. Run MinIO with Docker Compose

Create a `docker-compose.minio.yml` file:

```yaml
version: '3.8'

services:
  minio:
    image: minio/minio:latest
    container_name: monkeyocr-minio
    ports:
      - "9000:9000"     # API port
      - "9001:9001"     # Console port
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123  # Change this!
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    restart: unless-stopped

volumes:
  minio_data:
    driver: local
```

Start MinIO:
```bash
docker-compose -f docker-compose.minio.yml up -d
```

### 2. Configure MonkeyOCR

Update your `.env` file:

```bash
# MinIO Configuration
S3_BUCKET_NAME=monkeyocr
S3_ENDPOINT_URL=http://localhost:9000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
AWS_REGION=us-east-1
S3_PREFIX=monkeyocr
S3_USE_SSL=false
S3_VERIFY_SSL=false

# Enable S3 storage
UPLOAD_INDIVIDUAL_FILES_S3=true
STORE_OCR_RESULTS_S3=true
```

### 3. Create Bucket and Configure CORS

Option 1: Using MinIO Console
- Open http://localhost:9001
- Login with minioadmin/minioadmin123
- Create a bucket named "monkeyocr"
- Go to bucket settings and add CORS configuration

Option 2: Using MinIO Client (mc):
```bash
# Install mc
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Configure mc
mc alias set local http://localhost:9000 minioadmin minioadmin123

# Create bucket
mc mb local/monkeyocr

# Set download policy
mc anonymous set download local/monkeyocr

# Configure CORS for web access
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

mc anonymous set-json cors.json local/monkeyocr
```

Option 3: Using AWS CLI:
```bash
# Configure AWS CLI for MinIO
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin123

# Create bucket
aws --endpoint-url http://localhost:9000 s3 mb s3://monkeyocr
```

### 4. Test the Setup

Start MonkeyOCR API:
```bash
cd /path/to/MonkeyOCR
python api/main.py
```

You should see:
```
✅ MonkeyOCR model initialized successfully
✅ S3 client initialized successfully
```

## Production Setup

### Secure MinIO Deployment

1. **Change default credentials**:
```yaml
environment:
  MINIO_ROOT_USER: your-secure-admin-user
  MINIO_ROOT_PASSWORD: your-very-secure-password-here
```

2. **Enable HTTPS**:
```yaml
environment:
  MINIO_SERVER_URL: https://minio.yourdomain.com
  MINIO_BROWSER_REDIRECT_URL: https://minio-console.yourdomain.com
volumes:
  - ./certs:/root/.minio/certs
```

3. **Create service account** instead of using root credentials:
```bash
# In MinIO Console, create a new service account
# Use those credentials in .env instead of root credentials
```

### MinIO Behind Reverse Proxy (Nginx)

```nginx
# MinIO API
server {
    listen 443 ssl http2;
    server_name minio.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Allow large file uploads
    client_max_body_size 1000m;
    
    location / {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (for MinIO Console)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# MinIO Console
server {
    listen 443 ssl http2;
    server_name minio-console.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:9001;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Update `.env` for proxy setup:
```bash
S3_ENDPOINT_URL=http://localhost:9000  # Internal URL
S3_PUBLIC_URL=https://minio.yourdomain.com  # Public URL
S3_USE_SSL=true
S3_VERIFY_SSL=true
```

### High Availability Setup

For production, use MinIO distributed mode:

```yaml
version: '3.8'

services:
  minio1:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: secure-password
    command: server http://minio{1...4}/data{1...2} --console-address ":9001"
    volumes:
      - data1-1:/data1
      - data1-2:/data2
    networks:
      - minio_distributed

  minio2:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: secure-password
    command: server http://minio{1...4}/data{1...2} --console-address ":9001"
    volumes:
      - data2-1:/data1
      - data2-2:/data2
    networks:
      - minio_distributed

  # Add minio3 and minio4 similarly...

networks:
  minio_distributed:
    driver: overlay

volumes:
  data1-1:
  data1-2:
  data2-1:
  data2-2:
  # Add more volumes...
```

## Performance Tuning

### 1. MinIO Configuration

```bash
# Set environment variables for better performance
export MINIO_STORAGE_CLASS_STANDARD="EC:2"  # Erasure coding
export MINIO_BROWSER="off"  # Disable browser in production
export GOMAXPROCS=8  # Adjust based on CPU cores
```

### 2. MonkeyOCR Settings

For better performance with MinIO:

```python
# In api/s3_utils.py, you could add:
from boto3.s3.transfer import TransferConfig

# Configure multipart uploads for large files
self.transfer_config = TransferConfig(
    multipart_threshold=1024 * 25,  # 25MB
    max_concurrency=10,
    multipart_chunksize=1024 * 25,
    use_threads=True
)
```

### 3. Network Optimization

If MinIO and MonkeyOCR are on the same network:
- Use internal Docker network names
- Avoid going through external load balancers

## Monitoring

### MinIO Metrics

MinIO exposes Prometheus metrics:
```yaml
environment:
  MINIO_PROMETHEUS_AUTH_TYPE: public
```

Access metrics at: http://localhost:9000/minio/v2/metrics/cluster

### Health Checks

```bash
# Check MinIO health
curl http://localhost:9000/minio/health/live
curl http://localhost:9000/minio/health/ready

# Check bucket access
aws --endpoint-url http://localhost:9000 s3 ls s3://monkeyocr/
```

## Troubleshooting

### Issue: "The specified bucket does not exist"
```bash
# Create the bucket
mc mb local/monkeyocr
# Or
aws --endpoint-url http://localhost:9000 s3 mb s3://monkeyocr
```

### Issue: "Access Denied"
- Check credentials in .env match MinIO settings
- Verify bucket policy allows access
- Check service account permissions if not using root

### Issue: "Connection refused"
- Verify MinIO is running: `docker ps`
- Check endpoint URL in .env
- Ensure firewall allows port 9000

### Issue: "Signature mismatch"
- Ensure system time is synchronized
- Check AWS_REGION matches MinIO configuration
- Verify credentials don't have special characters that need escaping

## Backup and Recovery

### Backup MinIO Data

```bash
# Using mc mirror
mc mirror local/monkeyocr /backup/monkeyocr

# Using Docker volume backup
docker run --rm -v monkeyocr_minio_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/minio-backup.tar.gz -C /data .
```

### Restore from Backup

```bash
# Using mc
mc mirror /backup/monkeyocr local/monkeyocr

# Using Docker volume
docker run --rm -v monkeyocr_minio_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/minio-backup.tar.gz -C /data
```

## Integration with Existing Infrastructure

### Kubernetes Deployment

See the official MinIO Operator:
```bash
kubectl krew install minio
kubectl minio init
kubectl minio tenant create monkeyocr-tenant \
  --servers 4 \
  --volumes 8 \
  --capacity 10Ti
```

### AWS S3 Migration

Migrate from MinIO to AWS S3:
```bash
# Sync data
mc mirror local/monkeyocr s3/monkeyocr-prod

# Update .env
# Remove S3_ENDPOINT_URL
# Update credentials to AWS
```

## Cost Optimization

1. **Storage Classes**: Use MinIO ILM policies for infrequent access
2. **Compression**: Enable compression for markdown files
3. **Lifecycle Policies**: Auto-delete old processed files
4. **Deduplication**: Use MinIO's deduplication features

This setup provides a robust, scalable, and S3-compatible storage solution for MonkeyOCR that can grow from development to production use cases.