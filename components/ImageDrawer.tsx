import React, { useState, useRef } from 'react';
import DrawingCanvas, { DrawingCanvasRef } from './DrawingCanvas';
import { enhanceDrawing } from '../services/geminiService';
import Spinner from './Spinner';

interface ImageDrawerProps {
  onImageReady: (file: File) => void;
}

const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error('Could not determine mime type from data URL');
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

const ImageDrawer: React.FC<ImageDrawerProps> = ({ onImageReady }) => {
    const [prompt, setPrompt] = useState('');
    const [drawing, setDrawing] = useState<string | null>(null);
    const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<DrawingCanvasRef>(null);

    const handleDrawingChange = (dataUrl: string | null) => {
        setDrawing(dataUrl);
        // If the user draws again, the old enhancement is invalid
        if (enhancedImage) {
            setEnhancedImage(null);
        }
    };

    const handleClear = () => {
        canvasRef.current?.clear();
        setDrawing(null);
        setEnhancedImage(null);
        setError(null);
    };

    const handleEnhance = async () => {
        if (!prompt || !drawing) return;
        setLoading(true);
        setError(null);
        try {
            const [header, base64Data] = drawing.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
            const newImageUrl = await enhanceDrawing(base64Data, mimeType, prompt);
            setEnhancedImage(newImageUrl);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred during enhancement.');
        } finally {
            setLoading(false);
        }
    };

    const handleUseImage = () => {
        const imageToUse = enhancedImage || drawing;
        if (imageToUse) {
            const file = dataURLtoFile(imageToUse, 'drawn-image.png');
            onImageReady(file);
        }
    };
    
    const hasDrawing = !!drawing;
    const isViewingEnhanced = !!enhancedImage;

    return (
        <div className="space-y-4">
            <div className="relative w-full aspect-square bg-gray-900/50 rounded-lg border border-gray-700">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-20 rounded-lg">
                        <Spinner message="Enhancing your drawing..."/>
                    </div>
                )}
                {isViewingEnhanced && !loading ? (
                    <img src={enhancedImage} alt="Enhanced Drawing" className="absolute inset-0 w-full h-full object-contain rounded-md z-10" />
                ) : (
                    <DrawingCanvas ref={canvasRef} onDrawEnd={handleDrawingChange} />
                )}
            </div>
            
            <div className="flex space-x-2">
                {isViewingEnhanced ? (
                     <button onClick={() => setEnhancedImage(null)} className="w-full text-sm font-semibold py-2 px-4 rounded-md transition-colors bg-gray-600 hover:bg-gray-700">
                        ← Edit Drawing
                    </button>
                ) : (
                    <button onClick={handleClear} disabled={!hasDrawing} className="w-full text-sm font-semibold py-2 px-4 rounded-md transition-colors bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        Clear Canvas
                    </button>
                )}
            </div>
            
            <div className="space-y-2 p-4 border border-gray-700 rounded-lg bg-gray-900/50">
                <p className="text-sm text-gray-400">Optionally, describe how to enhance your drawing.</p>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="e.g., A photorealistic cat, a watercolor landscape..."
                    disabled={isViewingEnhanced}
                />
                 <button
                    onClick={handleEnhance}
                    disabled={loading || !prompt || !hasDrawing || isViewingEnhanced}
                    className="w-full font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-700"
                >
                    {loading ? 'Enhancing...' : '🎨 Enhance Drawing'}
                </button>
            </div>

            {error && <p className="text-red-400 text-center text-sm">{error}</p>}
            
            <button
                onClick={handleUseImage}
                disabled={!hasDrawing}
                className="w-full font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700"
            >
                Use this Image for 360°
            </button>
        </div>
    );
};

export default ImageDrawer;