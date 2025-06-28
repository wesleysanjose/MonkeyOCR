# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MonkeyOCR is a multi-modal large language model for structured document understanding and information extraction. It uses a Structure-Recognition-Relation (SRR) paradigm to process PDFs and images, extracting text, formulas (LaTeX), and tables.

## Common Development Commands

### Installation and Setup
```bash
# Install in development mode
pip install -e .

# Install dependencies
pip install -r requirements.txt

# Download models from HuggingFace or ModelScope
python tools/download_model.py
```

### Running the Application
```bash
# End-to-end parsing (default)
python parse.py input.pdf

# Single task recognition (text/formula/table)
python parse.py input.pdf -t text

# Run API server
python api/main.py

# Run Gradio demo
python demo/demo_gradio.py

# Run with specific model configuration
python parse.py input.pdf --model-configs model_configs.yaml
```

### Docker Commands
```bash
# Build and run with docker-compose
docker-compose up

# Run with GPU support
docker run --gpus all monkeyocr:latest
```

## Architecture and Code Structure

### Core Processing Pipeline
1. **Structure Detection** (`magic_pdf/model/`)
   - Uses DocLayout-YOLO models in `model_weight/Structure/`
   - Detects document layout elements (text blocks, tables, figures)

2. **Content Recognition** (`magic_pdf/model/custom_model.py`)
   - MonkeyOCR vision-language model for text/formula/table recognition
   - Model weights in `model_weight/Recognition/`
   - Supports multiple backends: LMDeploy (default), VLLM, Transformers, API

3. **Relationship Prediction** (`model_weight/Relation/`)
   - Predicts relationships between document elements
   - Used for understanding document structure

### Key Modules
- `magic_pdf/pdf_parse_union_core_v2_llm.py` - Main parsing logic that orchestrates the SRR pipeline
- `magic_pdf/operators/` - Processing operators for different document elements
- `magic_pdf/dict2md/` - Conversion logic to Markdown output
- `magic_pdf/filter/` - PDF classification and filtering
- `parse.py` - Main CLI entry point that handles command-line arguments and initiates processing

### Model Configuration
The `model_configs.yaml` file controls:
- Model paths and types
- Inference backend selection
- Processing parameters
- GPU/device settings

### API Structure
- `api/main.py` - FastAPI server implementation
- Endpoints for PDF/image processing
- Asynchronous processing support

## Important Notes

- The project requires GPU with CUDA support for optimal performance
- Models are large (several GB) and need to be downloaded separately
- Supports quantization (AWQ) for reduced memory usage
- When modifying model inference, check backend compatibility in `magic_pdf/model/custom_model.py`
- The main parsing flow starts in `parse.py` and delegates to `pdf_parse_union_core_v2_llm.py`