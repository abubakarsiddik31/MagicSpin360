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

        // This function resizes the canvas's drawing buffer to match its actual
        // display size, accounting for high-DPI screens. This is crucial for
        // accurate coordinate mapping and sharp rendering.
        const setupCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            // The canvas is styled to fill its parent, so we get the size from the parent.
            const rect = canvas.parentElement!.getBoundingClientRect();
            
            // Check if the dimensions have actually changed to avoid unnecessary redraws
            // and potential infinite loops in some edge cases.
            if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                
                // Scale the context to ensure 1 CSS pixel corresponds to 1 drawing pixel.
                context.scale(dpr, dpr);
                
                // Reset context properties and set background after resizing.
                context.fillStyle = 'black'; // Set background color
                context.fillRect(0, 0, rect.width, rect.height); // Fill the background
                context.lineCap = 'round';
                context.strokeStyle = 'white';
                context.lineWidth = 4;
            }
        };

        // ResizeObserver is more reliable than the window's 'resize' event for
        // tracking element size changes, especially in complex layouts.
        const resizeObserver = new ResizeObserver(() => {
            setupCanvas();
        });

        // We observe the parent element because the canvas itself is absolutely
        // positioned and its size is dictated by the parent.
        if (canvas.parentElement) {
            resizeObserver.observe(canvas.parentElement);
        }

        // Initial setup.
        setupCanvas();

        // Cleanup observer on component unmount.
        return () => {
            resizeObserver.disconnect();
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
            // Use the first touch point for drawing
            clientX = e.nativeEvent.touches[0].clientX;
            clientY = e.nativeEvent.touches[0].clientY;
        } else {
            return { x: 0, y: 0 };
        }
        
        // Calculate the cursor's position relative to the canvas element.
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
        const { x, y } = getCoords(e);
        context.lineTo(x, y);
        context.stroke();
    };

    useImperativeHandle(ref, () => ({
        clear() {
            const canvas = canvasRef.current;
            const context = contextRef.current;
            if (canvas && context && canvas.parentElement) {
                // The context is scaled, so we clear based on the CSS dimensions.
                const rect = canvas.parentElement.getBoundingClientRect();
                 // Clear by filling with the background color
                context.fillStyle = 'black';
                context.fillRect(0, 0, rect.width, rect.height);
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

        // Use a non-passive listener to be able to call preventDefault.
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