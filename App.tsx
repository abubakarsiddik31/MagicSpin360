import React, { useState, useCallback } from 'react';
import ImageUploader from './components/ImageUploader';
import Viewer360 from './components/Viewer360';
import Spinner from './components/Spinner';
import { generate360Images } from './services/geminiService';
import { LoadingProgress } from './types';
import ImageGenerator from './components/ImageGenerator';

const NUM_FRAMES = 4; // Lower for faster testing, increase for smoother rotation (e.g., 24, 36)
const STYLES = ['Photorealistic', 'Cartoon', 'Clay Model', 'Watercolor', 'Pixel Art', 'Fantasy', 'Sci-Fi'];
const BACKGROUND_OPTIONS = ['Original', 'Transparent', 'Custom'];

const App: React.FC = () => {
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('A high-quality image of this object');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [style, setStyle] = useState<string>(STYLES[0]);
  const [backgroundOption, setBackgroundOption] = useState<string>(BACKGROUND_OPTIONS[0]);
  const [customBackground, setCustomBackground] = useState<string>('');
  const [inputMode, setInputMode] = useState<'upload' | 'generate'>('upload');


  const handleImageUpload = useCallback((file: File) => {
    setOriginalImageFile(file);
    setGeneratedImages([]);
    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setInputMode('upload');
  }, []);

  const handleGenerate = async () => {
    if (!originalImageFile) {
      setError('Please upload or generate an image first.');
      return;
    }
    if (backgroundOption === 'Custom' && !customBackground.trim()) {
        setError('Please describe the custom background scene.');
        return;
    }

    setError(null);
    setGeneratedImages([]);
    setLoadingProgress({ current: 0, total: NUM_FRAMES + 1, message: 'Initializing...' });

    try {
      const images = await generate360Images(
        originalImageFile,
        prompt,
        NUM_FRAMES,
        style,
        backgroundOption,
        customBackground,
        (progress) => {
          setLoadingProgress(progress);
        }
      );
      setGeneratedImages(images);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred during generation.');
    } finally {
      setLoadingProgress(null);
    }
  };

  const renderOutput = () => {
    if (loadingProgress) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 rounded-lg p-8">
            <Spinner message={loadingProgress.message}/>
            <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4">
                <div 
                    className="bg-blue-500 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}>
                </div>
            </div>
            <p className="text-gray-400 mt-2">{loadingProgress.current} / {loadingProgress.total} steps</p>
        </div>
      );
    }

    if (error) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-red-900/20 border border-red-500 rounded-lg p-8 text-center">
                <h3 className="text-xl font-bold text-red-400 mb-2">Generation Failed</h3>
                <p className="text-red-300">{error}</p>
            </div>
        );
    }

    if (generatedImages.length > 0) {
      return <Viewer360 images={generatedImages} />;
    }

    return (
        <div className="w-full h-full flex items-center justify-center bg-gray-800 rounded-lg p-8">
            <div className="text-center text-gray-500">
                <h3 className="text-2xl font-semibold">360° View</h3>
                <p>Your generated interactive image will appear here.</p>
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            MagicSpin 360°
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Turn your 2D images into interactive 360° experiences with AI.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 space-y-6">
            <div>
                <label className="block text-lg font-semibold mb-2">1. Get Your Image</label>
                <div className="flex border-b border-gray-700 mb-4">
                    <button onClick={() => setInputMode('upload')} className={`px-4 py-2 text-sm font-medium transition ${inputMode === 'upload' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>
                        Upload Image
                    </button>
                    <button onClick={() => setInputMode('generate')} className={`px-4 py-2 text-sm font-medium transition ${inputMode === 'generate' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>
                        Generate with AI
                    </button>
                </div>

                {inputMode === 'upload' && <ImageUploader onImageUpload={handleImageUpload} initialImageUrl={previewUrl} />}
                {inputMode === 'generate' && <ImageGenerator onImageReady={handleImageUpload} />}
            </div>

            <div>
                <label className="block text-lg font-semibold mb-2" htmlFor="prompt">2. Describe Subject</label>
                <textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={2}
                    className="w-full bg-gray-900 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="e.g., A futuristic sneaker, clean studio lighting"
                />
            </div>

            <div>
                <label className="block text-lg font-semibold mb-2">3. Customize Scene</label>
                <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                    <div>
                        <label htmlFor="style-select" className="block text-sm font-medium text-gray-400 mb-1">Style</label>
                        <select
                            id="style-select"
                            value={style}
                            onChange={(e) => setStyle(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        >
                            {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Background</label>
                        <div className="flex flex-wrap gap-4">
                            {BACKGROUND_OPTIONS.map(opt => (
                                <label key={opt} className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="background"
                                        value={opt}
                                        checked={backgroundOption === opt}
                                        onChange={(e) => setBackgroundOption(e.target.value)}
                                        className="h-4 w-4 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500"
                                    />
                                    <span>{opt}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {backgroundOption === 'Custom' && (
                        <div>
                            <textarea
                                value={customBackground}
                                onChange={(e) => setCustomBackground(e.target.value)}
                                rows={2}
                                className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                placeholder="e.g., A cyberpunk city, a marble showroom..."
                            />
                        </div>
                    )}
                </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!originalImageFile || !!loadingProgress}
              className="w-full text-lg font-bold py-3 px-6 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 enabled:shadow-lg enabled:shadow-blue-500/30"
            >
              {loadingProgress ? 'Generating...' : '✨ Generate 360° View'}
            </button>
          </div>

          {/* Output Panel */}
          <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 min-h-[400px] lg:min-h-0 flex items-center justify-center">
             {renderOutput()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;