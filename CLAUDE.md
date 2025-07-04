# CLAUDE.md
<!-- Generated by Claude Conductor v1.1.2 -->

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Context (Read First)
- **Tech Stack**: Python (≥3.9), PyTorch, Transformers, FastAPI, Next.js, TypeScript
- **Main File**: `parse.py` (CLI), `api/main.py` (API server), `monkeyocr-web/` (Web UI)
- **Core Mechanic**: Structure-Recognition-Relation (SRR) triplet paradigm for document parsing
- **Key Integration**: OpenAI API support, S3 storage, Docker deployment
- **Platform Support**: Linux, macOS, Windows (CUDA/CPU/MPS device support)
- **DO NOT**: Expose API keys, skip authentication, allow unrestricted CORS, or perform unsafe file operations

## Session Startup Checklist
**IMPORTANT**: At the start of each session, check these items:
1. **Check TASKS.md** - Look for any IN_PROGRESS or BLOCKED tasks from previous sessions
2. **Review recent JOURNAL.md entries** - Scan last 2-3 entries for context
3. **If resuming work**: Load the current task context from TASKS.md before proceeding
4. **Security**: Check for any new security vulnerabilities or exposed credentials

## Table of Contents
1. [Architecture](ARCHITECTURE.md) - SRR pipeline, model architecture, deployment options
2. [Design Tokens](DESIGN.md) - UI design system, colors, typography
3. [UI/UX Patterns](UIUX.md) - Web interface components, Gradio demo
4. [Runtime Config](CONFIG.md) - Model configs, environment variables, device settings
5. [Data Model](DATA_MODEL.md) - Document structure, block types, recognition results
6. [API Contracts](API.md) - FastAPI endpoints, request/response formats
7. [Build & Release](BUILD.md) - Docker build, model download, deployment
8. [Testing Guide](TEST.md) - Test scripts, benchmark data, validation
9. [Operational Playbooks](PLAYBOOKS/DEPLOY.md) - Deployment guides, troubleshooting
10. [Contributing](CONTRIBUTING.md) - Code style, PR process, development setup
11. [Error Ledger](ERRORS.md) - Common errors, CUDA issues, model loading
12. [Task Management](TASKS.md) - Active tasks, feature development, bug fixes

## Quick Reference
**Main Entry Points**:
- **CLI**: `parse.py` - Main command-line interface
- **API Server**: `api/main.py:17-300` - FastAPI application
- **Web UI**: `monkeyocr-web/src/app/page.tsx` - Next.js main page
- **Core Pipeline**: `magic_pdf/MonkeyOCR.py:200-350` - Main OCR pipeline

**Key Classes**:
- **MonkeyOCR**: `magic_pdf/MonkeyOCR.py:178` - Main OCR processing class
- **Structure Model**: `magic_pdf/model/structure.py:10` - Layout detection
- **Recognition Model**: `magic_pdf/model/recognition.py:20` - Content extraction
- **Relation Model**: `magic_pdf/model/relation.py:15` - Reading order prediction

**Important Functions**:
- **parse_pdf**: `magic_pdf/MonkeyOCR.py:200` - Main PDF parsing function
- **load_models**: `magic_pdf/model/model_loader.py:50` - Model initialization
- **process_blocks**: `magic_pdf/operators/grouping.py:100` - Block processing
- **convert_to_markdown**: `magic_pdf/dict2md/convert.py:25` - Markdown conversion

## Current State
- [x] Core OCR pipeline complete
- [x] Web interface functional
- [x] API server implemented
- [ ] Authentication system needed
- [ ] CORS configuration required
- [ ] Security hardening pending

## Development Workflow
1. **Setup Environment**: `conda create -n monkeyocr python=3.9 && pip install -r requirements.txt`
2. **Download Models**: `python scripts/download_models.py`
3. **Run Tests**: `python demo/demo_chat.py` or `python parse.py test.pdf`
4. **Start API Server**: `python api/main.py`
5. **Start Web UI**: `cd monkeyocr-web && npm run dev`
6. **Deploy with Docker**: `docker-compose up`

## Task Templates
### 1. Add New Recognition Feature
1. Update model config in `model_configs.yaml`
2. Implement operator in `magic_pdf/operators/`
3. Add to pipeline in `magic_pdf/MonkeyOCR.py`
4. Test with `demo/demo_chat.py`
5. Update API endpoint in `api/main.py`

### 2. Fix Security Vulnerability
1. Identify vulnerable code location
2. Implement secure alternative
3. Test for regression
4. Update security documentation
5. Add to ERRORS.md if applicable

### 3. Improve Performance
1. Profile with `python -m cProfile parse.py`
2. Identify bottleneck in pipeline
3. Optimize model batch size or processing
4. Benchmark with test documents
5. Update performance metrics

## Anti-Patterns (Avoid These)
❌ **Don't expose API keys** - Always use environment variables  
❌ **Don't skip CORS configuration** - Set proper origins, not "*"  
❌ **Don't trust user input** - Validate all file paths and inputs  
❌ **Don't load all models at once** - Use lazy loading for memory efficiency  
❌ **Don't process without temp files** - Always use temporary directories  
❌ **Don't ignore CUDA errors** - Check device availability first

## Security Considerations
- **API Authentication**: Currently missing - implement before production
- **File Upload Validation**: Check file types and sizes
- **Path Traversal**: Sanitize all file paths
- **CORS Configuration**: Set specific allowed origins
- **Environment Variables**: Never commit .env files
- **Model Weights**: Keep secure, don't expose download URLs

## Performance Notes
- **Processing Speed**: ~0.84 pages/second on V100
- **Memory Usage**: ~8GB for base models
- **Batch Processing**: Optimal batch size is 4-8 pages
- **Model Loading**: Cache models between requests
- **Temp File Cleanup**: Implement automatic cleanup

## Journal Update Requirements
**IMPORTANT**: Update JOURNAL.md regularly throughout our work sessions:
- After completing any significant feature or fix
- When encountering and resolving errors
- At the end of each work session
- When making architectural decisions
- Format: What/Why/How/Issues/Result structure

## Task Management Integration
**How TASKS.md and JOURNAL.md work together**:
1. **Active Work**: TASKS.md tracks current/incomplete tasks with full context
2. **Completed Work**: When tasks complete, they generate JOURNAL.md entries with `|TASK:ID|` tags
3. **History**: JOURNAL.md preserves complete task history even if Claude Code is reinstalled
4. **Context Recovery**: Search JOURNAL.md for `|TASK:` to see all completed tasks over time
5. **Clean Handoffs**: TASKS.md always shows what needs to be resumed or completed

## Version History
- **v1.0.0** - Initial MonkeyOCR release with SRR pipeline
- **v1.1.0** - Added API server and web interface
- **v1.2.0** - Docker support and multi-language recognition