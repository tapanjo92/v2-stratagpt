'use client';

import { useState, useEffect } from 'react';
import FileUpload from '@/app/components/FileUpload';
import { s3Service, S3Document } from '@/app/lib/services/s3-service';
import { dynamoDBService } from '@/app/lib/services/dynamodb-service';
import { FileText, Download, Trash2, Search, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

interface DocumentMetadata {
  documentId: string;
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  extractedText?: string;
  pageCount?: number;
  error?: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<S3Document[]>([]);
  const [metadata, setMetadata] = useState<Record<string, DocumentMetadata>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load documents from S3
      const docs = await s3Service.listDocuments();
      setDocuments(docs);
      
      // Load metadata from DynamoDB for each document
      const metadataPromises = docs.map(doc => 
        dynamoDBService.getDocumentMetadata(doc.key)
      );
      
      const metadataResults = await Promise.allSettled(metadataPromises);
      const metadataMap: Record<string, DocumentMetadata> = {};
      
      metadataResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          metadataMap[docs[index].key] = result.value;
        }
      });
      
      setMetadata(metadataMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = async (key: string, file: File) => {
    // Create initial metadata entry
    const documentMetadata: DocumentMetadata = {
      documentId: key,
      name: file.name,
      size: file.size,
      contentType: file.type,
      uploadedAt: new Date().toISOString(),
      status: 'pending'
    };
    
    try {
      await dynamoDBService.createDocumentMetadata(documentMetadata);
      // Reload documents
      await loadDocuments();
    } catch (err) {
      console.error('Failed to create document metadata:', err);
    }
  };

  const handleDownload = async (doc: S3Document) => {
    try {
      const url = await s3Service.getDownloadUrl(doc.key);
      // Use a temporary link instead of window.open to avoid CORS
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download:', err);
      alert('Failed to download document. Please try again.');
    }
  };

  const handleDelete = async (doc: S3Document) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await s3Service.deleteDocument(doc.key);
      await dynamoDBService.deleteDocumentMetadata(doc.key);
      await loadDocuments();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const meta = metadata[doc.key];
    
    // Search filter
    if (searchQuery && !doc.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Status filter
    if (filterStatus !== 'all' && meta?.status !== filterStatus) {
      return false;
    }
    
    return true;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents</h1>
        <p className="text-gray-600">Upload and manage your strata documents</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Upload Documents</h2>
        <FileUpload
          onUploadComplete={handleUploadComplete}
          onError={(err) => console.error('Upload error:', err)}
          accept=".pdf,.doc,.docx,.txt"
          maxSizeMB={50}
        />
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400 h-5 w-5" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow-sm border">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading documents...</span>
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">
            <p>Error: {error}</p>
            <button
              onClick={loadDocuments}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Try again
            </button>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p>No documents found</p>
            {searchQuery && (
              <p className="text-sm mt-2">
                Try adjusting your search criteria
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filteredDocuments.map((doc) => {
              const meta = metadata[doc.key];
              return (
                <div key={doc.key} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <FileText className="h-10 w-10 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {doc.name}
                        </h3>
                        <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                          <span>{formatFileSize(doc.size)}</span>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(doc.lastModified, { addSuffix: true })}
                          </span>
                          {meta?.pageCount && (
                            <>
                              <span>•</span>
                              <span>{meta.pageCount} pages</span>
                            </>
                          )}
                        </div>
                        {meta && (
                          <div className="mt-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(meta.status)}`}>
                              {meta.status}
                            </span>
                            {meta.error && (
                              <p className="mt-1 text-xs text-red-600">{meta.error}</p>
                            )}
                            {meta.extractedText && meta.status === 'completed' && (
                              <details className="mt-2">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                  View extracted text ({meta.extractedText.length} characters)
                                </summary>
                                <div className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600">
                                  <div className="max-h-32 overflow-y-auto mb-2">
                                    {meta.extractedText.substring(0, 500)}
                                    {meta.extractedText.length > 500 && '...'}
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (meta.extractedText) {
                                        // Use data URI instead of blob URL to avoid insecure connection warning
                                        const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(meta.extractedText);
                                        const link = document.createElement('a');
                                        link.href = dataUri;
                                        link.download = `${doc.name.replace(/\.[^/.]+$/, '')}_extracted.txt`;
                                        link.style.display = 'none';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                      }
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                                  >
                                    Download full text as .txt
                                  </button>
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Download"
                      >
                        <Download className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}