
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Viewer360Props {
  images: string[];
}

const Viewer360: React.FC<Viewer360Props> = ({ images }) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startFrameRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    startXRef.current = e.clientX;
    startFrameRef.current = currentFrame;
    e.currentTarget.style.cursor = 'grabbing';
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const sensitivity = 3;
    const dx = e.clientX - startXRef.current;
    const containerWidth = containerRef.current.offsetWidth;
    const frameChange = Math.round((dx / containerWidth) * images.length * sensitivity);

    let nextFrame = startFrameRef.current - frameChange;
    
    // Modulo that handles negative numbers correctly
    const newFrame = ((nextFrame % images.length) + images.length) % images.length;

    setCurrentFrame(newFrame);
  }, [isDragging, images.length]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove]);

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center space-y-2">
      <div
        ref={containerRef}
        className="relative w-full aspect-square bg-gray-800 rounded-lg overflow-hidden touch-none select-none"
        onMouseDown={handleMouseDown}
        style={{ cursor: 'grab' }}
      >
        {images.map((src, index) => (
          <img
            key={index}
            src={src}
            alt={`Frame ${index + 1}`}
            className="absolute top-0 left-0 w-full h-full object-contain"
            style={{
              visibility: index === currentFrame ? 'visible' : 'hidden',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
        ))}
         <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            Drag to rotate
        </div>
      </div>
      <div className="w-full">
        <input
          type="range"
          min="0"
          max={images.length - 1}
          value={currentFrame}
          onChange={(e) => setCurrentFrame(Number(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <div className="text-center text-sm text-gray-400 mt-1">
          Frame: {currentFrame + 1} / {images.length}
        </div>
      </div>
    </div>
  );
};

export default Viewer360;
