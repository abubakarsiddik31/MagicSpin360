import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';

interface DrawingCanvasProps {
    onDrawEnd: (dataUrl: string | null) => void;
}

export interface DrawingCanvasRef {
    clear: () => void;
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({ onDrawEnd }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;
        contextRef.current = context;

        // Function to set up canvas dimensions and properties
        const setupCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            // Get the size of the canvas element from CSS
            const rect = canvas.getBoundingClientRect();
            // Set the canvas's internal buffer size to match, scaled by DPR
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            
            // Scale the context to ensure drawings are sharp on high-DPI screens
            context.scale(dpr, dpr);

            // Reset context properties after scaling
            context.lineCap = 'round';
            context.strokeStyle = 'white';
            context.lineWidth = 4;
        };

        // Initial setup
        setupCanvas();

        // Re-run setup on window resize to handle layout changes
        window.addEventListener('resize', setupCanvas);

        // Cleanup
        return () => {
            window.removeEventListener('resize', setupCanvas);
        };
    }, []);

    const getCoords = (e: React.MouseEvent | React.TouchEvent): { x: number, y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        let clientX, clientY;
        if (e.nativeEvent instanceof MouseEvent) {
            clientX = e.nativeEvent.clientX;
            clientY = e.nativeEvent.clientY;
        } else if (e.nativeEvent instanceof TouchEvent) {
            clientX = e.nativeEvent.touches[0].clientX;
            clientY = e.nativeEvent.touches[0].clientY;
        } else {
            return { x: 0, y: 0 };
        }
        
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const context = contextRef.current;
        if (!context) return;
        const { x, y } = getCoords(e);
        context.beginPath();
        context.moveTo(x, y);
        setIsDrawing(true);
    };

    const finishDrawing = () => {
        const context = contextRef.current;
        if (!context || !isDrawing) return;
        context.closePath();
        setIsDrawing(false);
        const dataUrl = canvasRef.current?.toDataURL();
        onDrawEnd(dataUrl || null);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const context = contextRef.current;
        if (!context) return;
        // Prevent scrolling on touch devices while drawing
        e.preventDefault();
        const { x, y } = getCoords(e);
        context.lineTo(x, y);
        context.stroke();
    };

    useImperativeHandle(ref, () => ({
        clear() {
            const canvas = canvasRef.current;
            const context = contextRef.current;
            if (canvas && context) {
                // We need to get the unscaled width/height for clearing
                const dpr = window.devicePixelRatio || 1;
                context.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
                onDrawEnd(null);
            }
        }
    }));

    // Add preventDefault to touch move to stop page scrolling on mobile
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const preventScroll = (e: TouchEvent) => {
            if (isDrawing) {
                e.preventDefault();
            }
        };

        canvas.addEventListener('touchmove', preventScroll, { passive: false });

        return () => {
            canvas.removeEventListener('touchmove', preventScroll);
        }
    }, [isDrawing]);

    return (
        <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseUp={finishDrawing}
            onMouseMove={draw}
            onMouseLeave={finishDrawing}
            onTouchStart={startDrawing}
            onTouchEnd={finishDrawing}
            onTouchMove={draw}
            className="absolute top-0 left-0 w-full h-full cursor-crosshair touch-none z-10"
            aria-label="Drawing canvas"
        />
    );
});

export default DrawingCanvas;