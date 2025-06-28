#!/bin/bash

# Run the API server with proper environment variables
export TEMP_DIR=./tmp
export API_BASE_URL=http://localhost:7861
export ALLOWED_ORIGINS=http://localhost:3800,http://localhost:3000

echo "Starting MonkeyOCR API Server..."
echo "TEMP_DIR: $TEMP_DIR"
echo "API_BASE_URL: $API_BASE_URL"
echo "ALLOWED_ORIGINS: $ALLOWED_ORIGINS"

python api/main.py