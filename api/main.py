#!/usr/bin/env python3
"""
MonkeyOCR FastAPI Application
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
import io
import tempfile
from typing import Optional, List, Dict
from pathlib import Path
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import zipfile
import shutil
import time

from magic_pdf.model.custom_model import MonkeyOCR
from magic_pdf.data.data_reader_writer import FileBasedDataWriter
from parse import single_task_recognition, parse_pdf
import uvicorn
try:
    from .s3_utils import get_s3_client, S3Client
except ImportError:
    # For running as standalone script
    from s3_utils import get_s3_client, S3Client

# Response models
class TaskResponse(BaseModel):
    success: bool
    task_type: str
    content: str
    message: Optional[str] = None
    s3_url: Optional[str] = None

class ParseResponse(BaseModel):
    success: bool
    message: str
    output_dir: Optional[str] = None
    files: Optional[List[str]] = None
    download_url: Optional[str] = None
    file_urls: Optional[Dict[str, str]] = None  # Map of filename to S3 URL

# Global model instance
monkey_ocr_model = None
executor = ThreadPoolExecutor(max_workers=2)
s3_client: Optional[S3Client] = None

def initialize_model():
    """Initialize MonkeyOCR model"""
    global monkey_ocr_model
    if monkey_ocr_model is None:
        config_path = os.getenv("MONKEYOCR_CONFIG", "model_configs.yaml")
        monkey_ocr_model = MonkeyOCR(config_path)
    return monkey_ocr_model

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler"""
    # Startup
    try:
        initialize_model()
        print("✅ MonkeyOCR model initialized successfully")
        
        # Initialize S3 client if configured
        global s3_client
        if os.getenv("S3_BUCKET_NAME"):
            s3_client = get_s3_client()
            print("✅ S3 client initialized successfully")
        else:
            print("⚠️  S3 not configured, using local file storage")
    except Exception as e:
        print(f"❌ Failed to initialize: {e}")
        raise
    
    yield
    
    # Shutdown
    global executor
    executor.shutdown(wait=True)
    print("🔄 Application shutdown complete")

app = FastAPI(
    title="MonkeyOCR API",
    description="OCR and Document Parsing API using MonkeyOCR",
    version="1.0.0",
    lifespan=lifespan
)

temp_dir = os.getenv("TEMP_DIR", tempfile.gettempdir())
os.makedirs(temp_dir, exist_ok=True)
# Only mount static files if S3 is not configured
if not os.getenv("S3_BUCKET_NAME"):
    app.mount("/static", StaticFiles(directory=temp_dir), name="static")

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "MonkeyOCR API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "model_loaded": monkey_ocr_model is not None,
        "s3_configured": s3_client is not None,
        "temp_dir": temp_dir
    }

@app.post("/ocr/text", response_model=TaskResponse)
async def extract_text(file: UploadFile = File(...)):
    """Extract text from image or PDF"""
    return await perform_ocr_task(file, "text")

@app.post("/ocr/formula", response_model=TaskResponse)
async def extract_formula(file: UploadFile = File(...)):
    """Extract formulas from image or PDF"""
    return await perform_ocr_task(file, "formula")

@app.post("/ocr/table", response_model=TaskResponse)
async def extract_table(file: UploadFile = File(...)):
    """Extract tables from image or PDF"""
    return await perform_ocr_task(file, "table")

@app.post("/parse", response_model=ParseResponse)
async def parse_document(
    file: UploadFile = File(...),
    page_markers: bool = Form(False)
):
    """Parse complete document (PDF only)
    
    Args:
        file: PDF file to parse
        page_markers: Whether to insert page break markers between pages
    """
    try:
        if not monkey_ocr_model:
            raise HTTPException(status_code=500, detail="Model not initialized")
        
        # Validate file type
        allowed_extensions = {'.pdf', '.jpg', '.jpeg', '.png'}
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Get original filename without extension
        original_name = '.'.join(file.filename.split('.')[:-1])
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Create output directory
            output_dir = tempfile.mkdtemp(prefix="monkeyocr_parse_")
            
            # Run parsing in thread pool
            loop = asyncio.get_event_loop()
            result_dir = await loop.run_in_executor(
                executor, 
                parse_pdf, 
                temp_file_path, 
                output_dir, 
                monkey_ocr_model,
                page_markers
            )
            
            # List generated files
            files = []
            if os.path.exists(result_dir):
                for root, dirs, filenames in os.walk(result_dir):
                    for filename in filenames:
                        rel_path = os.path.relpath(os.path.join(root, filename), result_dir)
                        files.append(rel_path)
            
            # Create download URL with original filename
            zip_filename = f"{original_name}_parsed_{int(time.time())}.zip"
            zip_path = os.path.join(temp_dir, zip_filename)
            
            # Create ZIP file with renamed files
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, filenames in os.walk(result_dir):
                    for filename in filenames:
                        file_path = os.path.join(root, filename)
                        
                        # Create new filename with original name prefix
                        file_ext = os.path.splitext(filename)[1]
                        file_base = os.path.splitext(filename)[0]
                        
                        # Handle different file types
                        if filename.endswith('.md'):
                            new_filename = f"{original_name}.md"
                        elif filename.endswith('_content_list.json'):
                            new_filename = f"{original_name}_content_list.json"
                        elif filename.endswith('_middle.json'):
                            new_filename = f"{original_name}_middle.json"
                        elif filename.endswith('_model.pdf'):
                            new_filename = f"{original_name}_model.pdf"
                        elif filename.endswith('_layout.pdf'):
                            new_filename = f"{original_name}_layout.pdf"
                        elif filename.endswith('_spans.pdf'):
                            new_filename = f"{original_name}_spans.pdf"
                        else:
                            # For images and other files, keep relative path structure but rename
                            rel_path = os.path.relpath(file_path, result_dir)
                            if 'images/' in rel_path:
                                # Keep images in images subfolder with original name prefix
                                image_name = os.path.basename(rel_path)
                                new_filename = f"images/{original_name}_{image_name}"
                            else:
                                new_filename = f"{original_name}_{filename}"
                        
                        zipf.write(file_path, new_filename)
            
            # Prepare file URLs dictionary
            file_urls = {}
            
            # Upload to S3 if configured, otherwise use local storage
            if s3_client:
                try:
                    # Upload individual files to S3 for direct access
                    if os.getenv("UPLOAD_INDIVIDUAL_FILES_S3", "true").lower() == "true":
                        # Generate timestamp once for this parse operation
                        parse_timestamp = int(time.time())
                        
                        for root, dirs, filenames in os.walk(result_dir):
                            for filename in filenames:
                                file_path = os.path.join(root, filename)
                                rel_path = os.path.relpath(file_path, result_dir)
                                
                                # Generate S3 key for individual file using the same timestamp
                                file_s3_key = f"{s3_client.prefix}/parsed/{parse_timestamp}_{original_name}/{rel_path}"
                                
                                # Upload individual file
                                s3_client.upload_file(file_path, file_s3_key, metadata={
                                    'original_filename': file.filename,
                                    'file_type': os.path.splitext(filename)[1],
                                    'task_type': 'parse'
                                })
                                
                                # Generate presigned URL for individual file
                                file_url = s3_client.generate_presigned_url(file_s3_key, expiration=86400)  # 24 hours
                                file_urls[rel_path] = file_url
                    
                    # Upload ZIP file
                    # Generate S3 key
                    s3_key = s3_client.generate_s3_key("parsed", original_name)
                    
                    # Upload to S3
                    s3_client.upload_file(zip_path, s3_key, metadata={
                        'original_filename': file.filename,
                        'task_type': 'parse',
                        'timestamp': str(int(time.time()))
                    })
                    
                    # Generate presigned URL
                    download_url = s3_client.generate_presigned_url(s3_key, expiration=86400)  # 24 hours
                    
                    # Clean up local ZIP file
                    os.unlink(zip_path)
                except Exception as s3_error:
                    print(f"S3 upload error: {s3_error}")
                    # Fallback to local storage on S3 error
                    download_url = f"/static/{zip_filename}"
            else:
                # Use local file storage
                download_url = f"/static/{zip_filename}"
            
            return ParseResponse(
                success=True,
                message="Document parsing completed successfully",
                output_dir=result_dir,
                files=files,
                download_url=download_url,
                file_urls=file_urls if file_urls else None
            )
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            # Clean up result directory after some time (optional)
            # shutil.rmtree(result_dir, ignore_errors=True)
            
    except Exception as e:
        import traceback
        print(f"Parse endpoint error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")

@app.get("/download/{filename}")
async def download_file(filename: str):
    """Download result files - redirects to S3 if configured"""
    if s3_client:
        # For S3, we expect the filename to be an S3 key
        # Generate a new presigned URL
        try:
            download_url = s3_client.generate_presigned_url(filename, expiration=3600)
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=download_url)
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")
    else:
        # Local file storage
        file_path = os.path.join(temp_dir, filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='application/octet-stream'
        )

@app.get("/results/{task_id}")
async def get_results(task_id: str):
    """Get parsing results by task ID"""
    result_dir = f"/app/tmp/monkeyocr_parse_{task_id}"
    
    if not os.path.exists(result_dir):
        raise HTTPException(status_code=404, detail="Results not found")
    
    files = []
    for root, dirs, filenames in os.walk(result_dir):
        for filename in filenames:
            rel_path = os.path.relpath(os.path.join(root, filename), result_dir)
            files.append(rel_path)
    
    return {"files": files, "result_dir": result_dir}

async def perform_ocr_task(file: UploadFile, task_type: str) -> TaskResponse:
    """Perform OCR task on uploaded file"""
    try:
        if not monkey_ocr_model:
            raise HTTPException(status_code=500, detail="Model not initialized")
        
        # Validate file type
        allowed_extensions = {'.pdf', '.jpg', '.jpeg', '.png'}
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Create output directory
            output_dir = tempfile.mkdtemp(prefix=f"monkeyocr_{task_type}_")
            
            # Run OCR task in thread pool
            loop = asyncio.get_event_loop()
            result_dir = await loop.run_in_executor(
                executor,
                single_task_recognition,
                temp_file_path,
                output_dir,
                monkey_ocr_model,
                task_type
            )
            
            # Read result file
            result_files = [f for f in os.listdir(result_dir) if f.endswith(f'_{task_type}_result.md')]
            if not result_files:
                raise Exception("No result file generated")
            
            result_file_path = os.path.join(result_dir, result_files[0])
            with open(result_file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Optionally upload to S3 if client wants to store results
            s3_url = None
            if s3_client and os.getenv("STORE_OCR_RESULTS_S3", "false").lower() == "true":
                # Generate S3 key
                s3_key = s3_client.generate_s3_key("ocr", file.filename, task_type)
                
                # Upload to S3
                s3_client.upload_file(result_file_path, s3_key, metadata={
                    'original_filename': file.filename,
                    'task_type': task_type,
                    'timestamp': str(int(time.time()))
                })
                
                # Generate presigned URL
                s3_url = s3_client.generate_presigned_url(s3_key, expiration=86400)  # 24 hours
            
            return TaskResponse(
                success=True,
                task_type=task_type,
                content=content,
                message=f"{task_type.capitalize()} extraction completed successfully",
                s3_url=s3_url if s3_url else None
            )
            
        finally:
            # Clean up temporary file
            os.unlink(temp_file_path)
            
    except Exception as e:
        return TaskResponse(
            success=False,
            task_type=task_type,
            content="",
            message=f"OCR task failed: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7861)
