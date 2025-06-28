import React, { useCallback } from 'react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  acceptedFileTypes?: string[];
  disabled?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  acceptedFileTypes = ['.pdf', '.jpg', '.jpeg', '.png'],
  disabled = false,
}) => {
  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (file) {
        const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
        if (acceptedFileTypes.includes(fileExtension)) {
          onFileSelect(file);
        }
      }
    },
    [acceptedFileTypes, onFileSelect]
  );

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className="w-full">
      <label
        htmlFor="file-upload"
        className={`relative cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 hover:border-gray-400 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-1 text-sm text-gray-600">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-gray-500">
            PDF, PNG, JPG up to 100MB
          </p>
        </div>
        <input
          id="file-upload"
          name="file-upload"
          type="file"
          className="sr-only"
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileChange}
          disabled={disabled}
        />
      </label>
    </div>
  );
};