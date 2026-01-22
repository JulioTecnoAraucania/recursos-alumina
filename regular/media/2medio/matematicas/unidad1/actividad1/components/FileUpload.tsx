import React, { useRef, useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle } from 'lucide-react';

interface FileUploadProps {
  label: string;
  accept: string;
  onFileSelect: (files: File[]) => void;
  multiple?: boolean;
  isLoading?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, accept, onFileSelect, multiple = false, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileCount, setFileCount] = useState<number>(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (files: File[]) => {
    // If not multiple, strictly take the first one
    const validFiles = multiple ? files : [files[0]];
    
    setFileCount(validFiles.length);
    setFileName(validFiles[0].name);
    onFileSelect(validFiles);
  };

  const displayStatus = () => {
    if (fileCount === 0) return null;
    if (fileCount === 1) return fileName;
    return `${fileCount} archivos seleccionados`;
  };

  return (
    <div 
      className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 cursor-pointer group
        ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}
        ${isLoading ? 'opacity-50 pointer-events-none' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={inputRef} 
        className="hidden" 
        accept={accept} 
        multiple={multiple}
        onChange={handleChange} 
      />
      
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className={`p-4 rounded-full ${fileCount > 0 ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'} transition-colors`}>
          {fileCount > 0 ? <CheckCircle size={32} /> : <Upload size={32} />}
        </div>
        
        <div className="space-y-1">
          <h3 className="font-semibold text-slate-900 text-lg">
            {fileCount > 0 ? 'Archivos Listos' : label}
          </h3>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">
            {displayStatus() || `Arrastra o haz clic para subir ${multiple ? '(Varios archivos permitidos)' : ''}`}
          </p>
        </div>

        {isDragging && (
          <div className="absolute inset-0 bg-indigo-500/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <p className="text-indigo-700 font-bold text-lg">¡Suelta los archivos aquí!</p>
          </div>
        )}
      </div>
    </div>
  );
};