import React, { useState, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon } from 'lucide-react';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFileSelect }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect]);

  return (
    <div
      className={`dropzone-container ${isDragging ? 'dragging' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleChange}
        id="file-upload"
        className="hidden-input"
      />
      <label htmlFor="file-upload" className="dropzone-content">
        <div className="icon-container">
          {isDragging ? (
            <ImageIcon className="upload-icon bounce" size={48} />
          ) : (
            <UploadCloud className="upload-icon" size={48} />
          )}
        </div>
        <h3 className="dropzone-title">
          {isDragging ? 'Drop it here!' : 'Drag & Drop your image'}
        </h3>
        <p className="dropzone-text">or click to browse from your device</p>
        <div className="dropzone-badge">PNG, JPG, WEBP</div>
      </label>
    </div>
  );
};
