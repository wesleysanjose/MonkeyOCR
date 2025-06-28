#!/usr/bin/env python3
"""Test script to examine ZIP file contents"""

import sys
import zipfile
import os

def examine_zip(zip_path):
    """Examine the contents of a ZIP file"""
    print(f"Examining ZIP file: {zip_path}")
    print("-" * 50)
    
    with zipfile.ZipFile(zip_path, 'r') as zip_file:
        # List all files
        print("Files in ZIP:")
        for info in zip_file.filelist:
            print(f"  {info.filename} - {info.file_size} bytes")
        
        print("\n" + "-" * 50)
        
        # Check for markdown files
        md_files = [f for f in zip_file.namelist() if f.endswith('.md')]
        if md_files:
            print(f"\nFound {len(md_files)} markdown file(s)")
            for md_file in md_files:
                content = zip_file.read(md_file).decode('utf-8')
                # Find image references
                import re
                image_refs = re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', content)
                print(f"\nImage references in {md_file}:")
                for alt, path in image_refs[:5]:  # Show first 5
                    print(f"  ![{alt}]({path})")
                if len(image_refs) > 5:
                    print(f"  ... and {len(image_refs) - 5} more")
        
        # Check for image files
        image_files = [f for f in zip_file.namelist() 
                      if f.endswith(('.jpg', '.jpeg', '.png', '.gif'))]
        print(f"\nFound {len(image_files)} image file(s)")
        for img in image_files[:5]:  # Show first 5
            print(f"  {img}")
        if len(image_files) > 5:
            print(f"  ... and {len(image_files) - 5} more")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python test_zip_extraction.py <path_to_zip>")
        sys.exit(1)
    
    zip_path = sys.argv[1]
    if not os.path.exists(zip_path):
        print(f"Error: File {zip_path} does not exist")
        sys.exit(1)
    
    examine_zip(zip_path)