import axios from 'axios';

const API_BASE_URL = '/api/monkeyocr';

export interface TaskResponse {
  success: boolean;
  task_type: string;
  content: string;
  message?: string;
  s3_url?: string;
}

export interface ParseResponse {
  success: boolean;
  message: string;
  output_dir?: string;
  files?: string[];
  download_url?: string;
  download_size?: number;
  request_id?: string;
  file_urls?: Record<string, string>;  // Map of filename to S3 URL
}

class MonkeyOCRAPI {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 600000, // 10 minutes timeout for large files
    });
  }

  async extractText(file: File): Promise<TaskResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.axiosInstance.post<TaskResponse>('/ocr/text', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }

  async extractFormula(file: File): Promise<TaskResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.axiosInstance.post<TaskResponse>('/ocr/formula', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }

  async extractTable(file: File): Promise<TaskResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.axiosInstance.post<TaskResponse>('/ocr/table', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }

  async parseDocument(file: File, pageMarkers: boolean = false): Promise<ParseResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('page_markers', pageMarkers.toString());
    
    const response = await this.axiosInstance.post<ParseResponse>('/parse', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }

}

export const monkeyOCRAPI = new MonkeyOCRAPI();