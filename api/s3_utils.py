"""
S3 utilities for MonkeyOCR API
"""
import os
import boto3
from botocore.exceptions import ClientError
from typing import Optional, Dict, Any
import logging
import time

logger = logging.getLogger(__name__)

class S3Client:
    def __init__(self):
        self.bucket_name = os.getenv("S3_BUCKET_NAME")
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.prefix = os.getenv("S3_PREFIX", "monkeyocr")
        
        # Initialize S3 client
        self.s3_client = boto3.client(
            's3',
            region_name=self.region,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            aws_session_token=os.getenv("AWS_SESSION_TOKEN")  # Optional, for temporary credentials
        )
        
        if not self.bucket_name:
            raise ValueError("S3_BUCKET_NAME environment variable is required")
    
    def upload_file(self, file_path: str, s3_key: str, metadata: Optional[Dict[str, str]] = None) -> str:
        """
        Upload a file to S3
        
        Args:
            file_path: Local file path to upload
            s3_key: S3 object key (path in bucket)
            metadata: Optional metadata to attach to the object
            
        Returns:
            S3 object key
        """
        try:
            extra_args = {}
            if metadata:
                extra_args['Metadata'] = metadata
            
            self.s3_client.upload_file(
                file_path,
                self.bucket_name,
                s3_key,
                ExtraArgs=extra_args
            )
            logger.info(f"Uploaded {file_path} to s3://{self.bucket_name}/{s3_key}")
            return s3_key
        except ClientError as e:
            logger.error(f"Failed to upload file to S3: {e}")
            raise
    
    def upload_file_obj(self, file_obj: Any, s3_key: str, metadata: Optional[Dict[str, str]] = None) -> str:
        """
        Upload a file object to S3
        
        Args:
            file_obj: File-like object to upload
            s3_key: S3 object key (path in bucket)
            metadata: Optional metadata to attach to the object
            
        Returns:
            S3 object key
        """
        try:
            extra_args = {}
            if metadata:
                extra_args['Metadata'] = metadata
            
            self.s3_client.upload_fileobj(
                file_obj,
                self.bucket_name,
                s3_key,
                ExtraArgs=extra_args
            )
            logger.info(f"Uploaded file object to s3://{self.bucket_name}/{s3_key}")
            return s3_key
        except ClientError as e:
            logger.error(f"Failed to upload file object to S3: {e}")
            raise
    
    def generate_presigned_url(self, s3_key: str, expiration: int = 3600) -> str:
        """
        Generate a presigned URL for downloading from S3
        
        Args:
            s3_key: S3 object key
            expiration: URL expiration time in seconds (default: 1 hour)
            
        Returns:
            Presigned URL
        """
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            raise
    
    def generate_presigned_post(self, s3_key: str, expiration: int = 3600) -> Dict[str, Any]:
        """
        Generate a presigned POST URL for uploading directly to S3
        
        Args:
            s3_key: S3 object key
            expiration: URL expiration time in seconds (default: 1 hour)
            
        Returns:
            Dictionary with 'url' and 'fields' for the POST request
        """
        try:
            response = self.s3_client.generate_presigned_post(
                Bucket=self.bucket_name,
                Key=s3_key,
                ExpiresIn=expiration
            )
            return response
        except ClientError as e:
            logger.error(f"Failed to generate presigned POST: {e}")
            raise
    
    def check_object_exists(self, s3_key: str) -> bool:
        """
        Check if an object exists in S3
        
        Args:
            s3_key: S3 object key
            
        Returns:
            True if object exists, False otherwise
        """
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return False
            raise
    
    def delete_object(self, s3_key: str) -> bool:
        """
        Delete an object from S3
        
        Args:
            s3_key: S3 object key
            
        Returns:
            True if successful
        """
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
            logger.info(f"Deleted s3://{self.bucket_name}/{s3_key}")
            return True
        except ClientError as e:
            logger.error(f"Failed to delete object from S3: {e}")
            raise
    
    def list_objects(self, prefix: str, max_keys: int = 1000) -> list:
        """
        List objects in S3 with a given prefix
        
        Args:
            prefix: Prefix to filter objects
            max_keys: Maximum number of keys to return
            
        Returns:
            List of object keys
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix,
                MaxKeys=max_keys
            )
            
            if 'Contents' not in response:
                return []
            
            return [obj['Key'] for obj in response['Contents']]
        except ClientError as e:
            logger.error(f"Failed to list objects in S3: {e}")
            raise
    
    def generate_s3_key(self, file_type: str, original_filename: str, task_type: str = "parse") -> str:
        """
        Generate a consistent S3 key for storing files
        
        Args:
            file_type: Type of file (e.g., 'parsed', 'ocr')
            original_filename: Original filename from upload
            task_type: Task type for OCR operations
            
        Returns:
            S3 key string
        """
        timestamp = int(time.time())
        safe_filename = os.path.basename(original_filename).replace(' ', '_')
        
        if file_type == "parsed":
            return f"{self.prefix}/parsed/{timestamp}_{safe_filename}.zip"
        elif file_type == "ocr":
            return f"{self.prefix}/ocr/{task_type}/{timestamp}_{safe_filename}.md"
        else:
            return f"{self.prefix}/other/{timestamp}_{safe_filename}"

# Global S3 client instance
s3_client: Optional[S3Client] = None

def get_s3_client() -> S3Client:
    """Get or create S3 client instance"""
    global s3_client
    if s3_client is None:
        s3_client = S3Client()
    return s3_client