'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { s3Service, UploadProgress } from '@/app/lib/services/s3-service';

export interface FileUploadProps {
  onUploadComplete?: (key: string, file: File) => void;
  onError?: (error: Error) => void;
  accept?: string;
  maxSizeMB?: number;
  multiple?: boolean;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
  key?: string;
}

export default function FileUpload({
  onUploadComplete,
  onError,
  accept = '.pdf,.doc,.docx,.txt',
  maxSizeMB = 50,
  multiple = true
}: FileUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }
    
    const acceptedTypes = accept.split(',').map(t => t.trim());
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!acceptedTypes.includes(fileExtension) && !acceptedTypes.includes('*')) {
      return `File type ${fileExtension} not accepted`;
    }
    
    return null;
  };

  const uploadFile = async (file: File, uploadId: string) => {
    const error = validateFile(file);
    if (error) {
      setUploadingFiles(prev => prev.map(f => 
        f.id === uploadId ? { ...f, status: 'error', error } : f
      ));
      onError?.(new Error(error));
      return;
    }

    try {
      const key = await s3Service.uploadDocument(
        file,
        (progress: UploadProgress) => {
          setUploadingFiles(prev => prev.map(f => 
            f.id === uploadId ? { ...f, progress: progress.percentage } : f
          ));
        }
      );

      setUploadingFiles(prev => prev.map(f => 
        f.id === uploadId ? { ...f, status: 'completed', key, progress: 100 } : f
      ));
      
      onUploadComplete?.(key, file);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadingFiles(prev => prev.map(f => 
        f.id === uploadId ? { ...f, status: 'error', error: errorMessage } : f
      ));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  };

  const handleFiles = (files: FileList) => {
    const newFiles: UploadingFile[] = Array.from(files).map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: 'uploading' as const
    }));

    setUploadingFiles(prev => [...prev, ...newFiles]);

    // Upload each file
    newFiles.forEach(({ file, id }) => {
      uploadFile(file, id);
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (id: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearCompleted = () => {
    setUploadingFiles(prev => prev.filter(f => f.status !== 'completed'));
  };

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          Drag and drop files here, or{' '}
          <button
            type="button"
            className="text-blue-600 hover:text-blue-500 font-medium"
            onClick={() => fileInputRef.current?.click()}
          >
            browse
          </button>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {accept.replace(/,/g, ', ')} up to {maxSizeMB}MB
        </p>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-700">Uploads</h3>
            {uploadingFiles.some(f => f.status === 'completed') && (
              <button
                onClick={clearCompleted}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear completed
              </button>
            )}
          </div>
          
          {uploadingFiles.map(file => (
            <div
              key={file.id}
              className="bg-white border rounded-lg p-3 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <FileText className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    
                    {file.status === 'uploading' && (
                      <div className="mt-2">
                        <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {file.progress}% uploaded
                        </p>
                      </div>
                    )}
                    
                    {file.status === 'error' && (
                      <p className="text-xs text-red-600 mt-1 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {file.error}
                      </p>
                    )}
                    
                    {file.status === 'completed' && (
                      <p className="text-xs text-green-600 mt-1 flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Upload complete
                      </p>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => removeFile(file.id)}
                  className="ml-2 text-gray-400 hover:text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}