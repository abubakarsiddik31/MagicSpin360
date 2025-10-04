import React, { useState, useCallback, useRef, useEffect } from "react";

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  initialImageUrl?: string | null;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUpload,
  initialImageUrl,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialImageUrl || null
  );
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialImageUrl) {
      setPreviewUrl(initialImageUrl);
    }
  }, [initialImageUrl]);

  const handleFileChange = useCallback(
    (files: FileList | null) => {
      if (files && files[0]) {
        const file = files[0];
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
          };
          reader.readAsDataURL(file);
          onImageUpload(file);
        }
      }
    },
    [onImageUpload]
  );

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-6 w-full h-64 flex flex-col justify-center items-center text-center cursor-pointer transition-colors duration-300 ${
        isDragging
          ? "border-blue-400 bg-gray-700"
          : "border-gray-600 hover:border-gray-400"
      }`}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/png, image/jpeg"
        onChange={(e) => handleFileChange(e.target.files)}
      />
      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Preview"
          className="max-h-full max-w-full object-contain rounded-md"
        />
      ) : (
        <div className="text-gray-400">
          <svg
            className="mx-auto h-12 w-12"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-2">Drag & drop an image, or click to select</p>
          <p className="text-xs text-gray-500">PNG or JPG</p>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
