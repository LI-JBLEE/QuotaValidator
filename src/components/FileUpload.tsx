import { useCallback, useState } from 'react';

interface FileUploadProps {
  label: string;
  description: string;
  onFileLoaded: (data: ArrayBuffer, fileName: string) => void;
  fileName?: string;
  accept?: string;
}

export default function FileUpload({ label, description, onFileLoaded, fileName, accept = '.xlsx,.xls' }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result as ArrayBuffer;
        onFileLoaded(data, file.name);
      };
      reader.readAsArrayBuffer(file);
    },
    [onFileLoaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="flex-1">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{label}</h3>
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : fileName
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById(`file-${label}`)?.click()}
      >
        <input
          id={`file-${label}`}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        {fileName ? (
          <div>
            <div className="text-green-600 text-lg mb-1">&#10003;</div>
            <p className="text-sm font-medium text-green-700 break-all">{fileName}</p>
            <p className="text-xs text-gray-500 mt-1">Click to replace</p>
          </div>
        ) : (
          <div>
            <p className="text-gray-500 text-sm mb-1">Drag & Drop or Click to Browse</p>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
