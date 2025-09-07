import React, { useState } from 'react';
import { generateSingleImage, editSingleImage } from '../services/geminiService';
import Spinner from './Spinner';

interface ImageGeneratorProps {
  onImageReady: (file: File) => void;
}

const TEMPLATES = [
    { name: "Character", prompt: "A minimalist sticker of a cute, fluffy red panda, featuring a pastel color palette. The design should have clean lines and soft shading. The background must be transparent." },
    { name: "Object", prompt: "A highly detailed, photorealistic image of a vintage leather-bound book with gold accents, resting on a dark wood table. Soft, warm lighting from a nearby candle." },
    { name: "Vehicle", prompt: "A sleek, futuristic sci-fi sports car, hovering slightly above a neon-lit city street at night. Style should be photorealistic with cinematic lighting." },
    { name: "Robot", prompt: "A friendly, cartoon-style robot with a retro-futuristic design, waving happily. The style is clean and simple, like a modern illustration. Transparent background." },
    { name: "Nature", prompt: "A magical, glowing mushroom in an enchanted forest at night. The style is fantastical and dreamlike, with vibrant, bioluminescent colors." },
];

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

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onImageReady }) => {
    const [prompt, setPrompt] = useState('');
    const [editPrompt, setEditPrompt] = useState('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt) return;
        setLoading(true);
        setGeneratedImage(null);
        setError(null);
        try {
            const imageUrl = await generateSingleImage(prompt);
            setGeneratedImage(imageUrl);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = async () => {
        if (!editPrompt || !generatedImage) return;
        setEditing(true);
        setError(null);
        try {
            const [header, base64Data] = generatedImage.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
            const newImageUrl = await editSingleImage(base64Data, mimeType, editPrompt);
            setGeneratedImage(newImageUrl);
            setEditPrompt('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred during edit.');
        } finally {
            setEditing(false);
        }
    };

    const handleUseImage = () => {
        if (generatedImage) {
            const file = dataURLtoFile(generatedImage, 'generated-image.png');
            onImageReady(file);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <p className="text-sm text-gray-400 mb-2">Start with a template or write your own prompt.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                    {TEMPLATES.map(t => (
                        <button 
                            key={t.name}
                            onClick={() => setPrompt(t.prompt)}
                            className="text-xs text-left p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                        >
                            <span className="font-bold">{t.name}</span>
                            <p className="text-gray-400 truncate">{t.prompt}</p>
                        </button>
                    ))}
                </div>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-900 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Describe the image you want to create..."
                />
                <button
                    onClick={handleGenerate}
                    disabled={loading || !prompt}
                    className="w-full mt-2 font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700"
                >
                    {loading ? 'Generating...' : 'Generate Image'}
                </button>
            </div>
            
            <div className="relative w-full h-64 bg-gray-900/50 rounded-lg flex items-center justify-center border border-gray-700">
                {loading && <Spinner message="Creating your image..."/>}
                {error && <p className="text-red-400 p-4 text-center">{error}</p>}
                {generatedImage && !loading && (
                    <img src={generatedImage} alt="Generated" className="max-h-full max-w-full object-contain rounded-md" />
                )}
                {!generatedImage && !loading && !error && <p className="text-gray-500">Preview will appear here</p>}
            </div>

            {generatedImage && (
                <div className="space-y-2">
                     <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        rows={2}
                        className="w-full bg-gray-900 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="Describe your edits (e.g., 'add a hat', 'make the background blue')..."
                    />
                     <button
                        onClick={handleEdit}
                        disabled={editing || !editPrompt}
                        className="w-full font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-700"
                    >
                        {editing ? 'Applying...' : 'Apply Edit'}
                    </button>
                    <button
                        onClick={handleUseImage}
                        className="w-full font-bold py-2 px-4 rounded-md transition-colors bg-green-600 hover:bg-green-700"
                    >
                        Use this Image for 360°
                    </button>
                </div>
            )}
        </div>
    );
};

export default ImageGenerator;
