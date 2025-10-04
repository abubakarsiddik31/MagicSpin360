import React, { useState, useRef, useEffect, useCallback } from "react";

interface Viewer360Props {
  images: string[];
}

const Viewer360: React.FC<Viewer360Props> = ({ images }) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startFrameRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  const handleInteractionStart = () => {
    setIsPlaying(false);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    handleInteractionStart();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startFrameRef.current = currentFrame;
    e.currentTarget.style.cursor = "grabbing";
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (containerRef.current) {
      containerRef.current.style.cursor = "grab";
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const sensitivity = 3;
      const dx = e.clientX - startXRef.current;
      const containerWidth = containerRef.current.offsetWidth;
      const frameChange = Math.round(
        (dx / containerWidth) * images.length * sensitivity
      );

      let nextFrame = startFrameRef.current - frameChange;

      const newFrame =
        ((nextFrame % images.length) + images.length) % images.length;

      setCurrentFrame(newFrame);
    },
    [isDragging, images.length]
  );

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleInteractionStart();
    setCurrentFrame(Number(e.target.value));
  };

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        setCurrentFrame((prevFrame) => (prevFrame + 1) % images.length);
      }, 100); // 10 frames per second
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, images.length]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove]);

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
      <div
        ref={containerRef}
        className="relative w-full aspect-square bg-gray-800 rounded-lg overflow-hidden touch-none select-none"
        onMouseDown={handleMouseDown}
        style={{ cursor: "grab" }}
      >
        {images.map((src, index) => (
          <img
            key={index}
            src={src}
            alt={`Frame ${index + 1}`}
            className="absolute top-0 left-0 w-full h-full object-contain"
            style={{
              visibility: index === currentFrame ? "visible" : "hidden",
              pointerEvents: "none",
            }}
            draggable={false}
          />
        ))}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
          Drag to rotate
        </div>
      </div>
      <div className="w-full">
        <div className="flex items-center space-x-4">
          <button
            onClick={togglePlay}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={isPlaying ? "Pause rotation" : "Play rotation"}
          >
            {isPlaying ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 00-1 1v2a1 1 0 102 0V9a1 1 0 00-1-1zm6 0a1 1 0 00-1 1v2a1 1 0 102 0V9a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
          <input
            type="range"
            min="0"
            max={images.length - 1}
            value={currentFrame}
            onChange={handleSliderChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div className="text-center text-sm text-gray-400 mt-2">
          Frame: {currentFrame + 1} / {images.length}
        </div>
      </div>
    </div>
  );
};

export default Viewer360;
