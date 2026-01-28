import { useState } from 'react';
import { parseFile } from '../lib/parsers';

export default function FileImport({ onTransactionsParsed }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    // Validate file type
    const validExtensions = ['csv', 'xlsx', 'xls', 'qif', 'qfx', 'pdf'];
    const extension = file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(extension)) {
      setError(`Unsupported format: .${extension}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🚀 Starting parse for:', file.name);
      const transactions = await parseFile(file);
      
      console.log('✅ Parsed transactions:', transactions.length);
      
      if (transactions.length === 0) {
        setError('No transactions found in file.');
        setIsLoading(false);
        return;
      }

      // Pass parsed transactions to parent
      onTransactionsParsed(transactions, file.name);
      
    } catch (err) {
      console.error('❌ Parse error:', err);
      setError(`Failed to parse file: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          border: isDragging ? '3px dashed #667eea' : '2px dashed #ccc',
          borderRadius: '12px',
          padding: '40px 20px',
          textAlign: 'center',
          background: isDragging ? '#f0f4ff' : '#fafafa',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        {isLoading ? (
          <div>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>⏳</div>
            <div style={{ fontSize: '16px', color: '#666' }}>Parsing file...</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>📁</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>
              Import Your Expenses
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
              Drag & drop or click to upload
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              Supported: CSV, Excel, Quicken (.qif), PDF
            </div>
            
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.qif,.qfx,.pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="file-upload"
            />
            
            <label
              htmlFor="file-upload"
              style={{
                display: 'inline-block',
                marginTop: '15px',
                padding: '10px 24px',
                background: '#667eea',
                color: 'white',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              Choose File
            </label>
          </>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: '15px',
          padding: '12px',
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          color: '#c33',
          fontSize: '14px'
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
