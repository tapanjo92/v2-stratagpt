'use client';

import { useState, useEffect, useRef } from 'react';
import { s3Service, S3Document, UploadProgress } from '@/app/lib/services/s3-service';
import { startCredentialRefresh, stopCredentialRefresh } from '@/app/lib/aws-config';

export const dynamic = 'force-dynamic';

export default function TestS3Page() {
  const [documents, setDocuments] = useState<S3Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [testResults, setTestResults] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startCredentialRefresh();
    loadDocuments();
    
    return () => {
      stopCredentialRefresh();
    };
  }, []);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await s3Service.listDocuments();
      setDocuments(docs);
      addTestResult(`Loaded ${docs.length} documents`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
      addTestResult(`Error loading documents: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });
      
      const key = await s3Service.uploadDocument(file, (progress) => {
        setUploadProgress(progress);
      });
      
      addTestResult(`Uploaded: ${file.name} (${key})`);
      await loadDocuments();
      setUploadProgress(null);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
      addTestResult(`Error uploading file: ${err}`);
      setUploadProgress(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadDocument = async (doc: S3Document) => {
    try {
      setLoading(true);
      setError(null);
      
      const blob = await s3Service.downloadDocument(doc.key);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      addTestResult(`Downloaded: ${doc.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download document');
      addTestResult(`Error downloading document: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const getPresignedUrl = async (doc: S3Document) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = await s3Service.getPresignedDownloadUrl(doc.key);
      window.open(url, '_blank');
      
      addTestResult(`Generated presigned URL for: ${doc.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get presigned URL');
      addTestResult(`Error getting presigned URL: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (doc: S3Document) => {
    if (!confirm(`Delete ${doc.name}?`)) return;

    try {
      setLoading(true);
      setError(null);
      
      await s3Service.deleteDocument(doc.key);
      addTestResult(`Deleted: ${doc.name}`);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
      addTestResult(`Error deleting document: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const getMetadata = async (doc: S3Document) => {
    try {
      setLoading(true);
      setError(null);
      
      const metadata = await s3Service.getDocumentMetadata(doc.key);
      if (metadata) {
        addTestResult(`Metadata for ${doc.name}: ${JSON.stringify(metadata)}`);
        alert(`Metadata for ${doc.name}:\n\n${JSON.stringify(metadata, null, 2)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get metadata');
      addTestResult(`Error getting metadata: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">S3 Integration Test</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-6">
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Upload Document</h2>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            disabled={loading}
            className="mb-2"
          />
          {uploadProgress && (
            <div className="mt-2">
              <div className="flex justify-between text-sm mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Documents</h2>
            <button
              onClick={loadDocuments}
              disabled={loading}
              className="px-4 py-2 bg-gray-500 text-white rounded disabled:bg-gray-300"
            >
              Refresh
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Modified</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.length > 0 ? (
                  documents.map(doc => (
                    <tr key={doc.key}>
                      <td className="px-4 py-2 text-sm">{doc.name}</td>
                      <td className="px-4 py-2 text-sm">{formatFileSize(doc.size)}</td>
                      <td className="px-4 py-2 text-sm">
                        {new Date(doc.lastModified).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <div className="space-x-2">
                          <button
                            onClick={() => downloadDocument(doc)}
                            disabled={loading}
                            className="text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => getPresignedUrl(doc)}
                            disabled={loading}
                            className="text-green-600 hover:text-green-800 disabled:text-gray-400"
                          >
                            Presigned
                          </button>
                          <button
                            onClick={() => getMetadata(doc)}
                            disabled={loading}
                            className="text-purple-600 hover:text-purple-800 disabled:text-gray-400"
                          >
                            Metadata
                          </button>
                          <button
                            onClick={() => deleteDocument(doc)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-800 disabled:text-gray-400"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-center text-gray-500">
                      No documents found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Test Results</h2>
        <div className="bg-gray-50 p-4 rounded h-48 overflow-y-auto">
          {testResults.length > 0 ? (
            testResults.map((result, index) => (
              <div key={index} className="text-sm mb-1">
                {result}
              </div>
            ))
          ) : (
            <p className="text-gray-500">No test results yet</p>
          )}
        </div>
      </div>
    </div>
  );
}