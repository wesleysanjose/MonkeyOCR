# MonkeyOCR API Server

A FastAPI-based REST API server for MonkeyOCR that supports document parsing and OCR tasks.

## Features

- ✅ CORS support for cross-origin requests
- ✅ Configurable via environment variables
- ✅ Request timeout handling
- ✅ File size limits
- ✅ Request tracking with unique IDs
- ✅ Automatic cleanup endpoints
- ✅ Full URL generation for downloads
- ✅ Works with web frontends on different hosts

## Configuration

The API server can be configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `TEMP_DIR` | Directory for temporary files | `./tmp` |
| `API_BASE_URL` | Full URL of the API server (for download URLs) | `http://localhost:7861` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `*` |
| `MAX_FILE_SIZE` | Maximum upload file size in bytes | `104857600` (100MB) |
| `REQUEST_TIMEOUT` | Request timeout in seconds | `600` (10 minutes) |
| `MONKEYOCR_CONFIG` | Path to MonkeyOCR model config | `model_configs.yaml` |

## Running the Server

### Local Development

```bash
# Set environment variables (optional)
export TEMP_DIR=./tmp
export API_BASE_URL=http://localhost:7861

# Run the server
python api/main.py
```

### Production with Environment File

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
vim .env

# Run with environment file
source .env && python api/main.py
```

### Docker

```bash
docker run -p 7861:7861 \
  -e API_BASE_URL=http://your-server:7861 \
  -e ALLOWED_ORIGINS=http://your-frontend:3800 \
  monkeyocr-api
```

## API Endpoints

### Health Check
- `GET /` - API information
- `GET /health` - Health status

### OCR Tasks
- `POST /ocr/text` - Extract text from image/PDF
- `POST /ocr/formula` - Extract formulas
- `POST /ocr/table` - Extract tables

### Document Parsing
- `POST /parse` - Parse complete PDF document

### File Management
- `GET /static/{filename}` - Download result files
- `GET /download/{filename}` - Alternative download endpoint
- `GET /results/{request_id}` - Get results by request ID
- `DELETE /cleanup/{request_id}` - Clean up files for a request

## Response Format

All responses include:
- `success`: Boolean indicating success/failure
- `message`: Human-readable message
- `request_id`: Unique request identifier

Parse responses also include:
- `download_url`: Full URL to download results
- `download_size`: File size in bytes
- `files`: List of generated files

## CORS Configuration

For production, configure specific origins instead of using `*`:

```bash
export ALLOWED_ORIGINS=https://app.example.com,https://app2.example.com
```

## Integration with Web Frontend

The API server is designed to work with web frontends hosted on different servers:

1. Configure `API_BASE_URL` to the publicly accessible URL
2. Set appropriate CORS origins
3. Frontend receives full download URLs that work directly

Example Next.js configuration:

```javascript
// next.config.js
async rewrites() {
  return [
    {
      source: '/api/monkeyocr/:path*',
      destination: 'http://your-api-server:7861/:path*',
    },
  ]
}
```