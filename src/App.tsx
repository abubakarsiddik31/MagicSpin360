import React, { useCallback, useEffect, useMemo, useState } from "react";
import ImageDrawer from "@/components/ImageDrawer";
import ImageGenerator from "@/components/ImageGenerator";
import ImageUploader from "@/components/ImageUploader";
import Spinner from "@/components/Spinner";
import Viewer360 from "@/components/Viewer360";
import {
  BACKGROUND_OPTIONS,
  type BackgroundOption,
  DEFAULT_FRAME_COUNT,
  DEFAULT_PROMPT,
  FRAME_COUNT_LIMITS,
  STYLE_PRESETS,
} from "@/constants/controls";
import { generate360Images, interpolateFrames } from "@/services/gemini";
import type { LoadingProgress } from "@/types";

const INPUT_MODES = ["upload", "generate", "draw"] as const;
type InputMode = (typeof INPUT_MODES)[number];

type StyleOption = (typeof STYLE_PRESETS)[number];

const App: React.FC = () => {
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [loadingProgress, setLoadingProgress] =
    useState<LoadingProgress | null>(null);
  const [isInterpolating, setIsInterpolating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [style, setStyle] = useState<StyleOption>(STYLE_PRESETS[0]);
  const [backgroundOption, setBackgroundOption] = useState<BackgroundOption>(
    BACKGROUND_OPTIONS[0]
  );
  const [customBackground, setCustomBackground] = useState<string>("");
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [numFrames, setNumFrames] = useState<number>(DEFAULT_FRAME_COUNT);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleImageUpload = useCallback((file: File) => {
    setOriginalImageFile(file);
    setGeneratedImages([]);
    setError(null);
    setInputMode("upload");
    setPreviewUrl((currentPreview) => {
      if (currentPreview) {
        URL.revokeObjectURL(currentPreview);
      }
      return URL.createObjectURL(file);
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!originalImageFile) {
      setError("Please upload, generate, or draw an image first.");
      return;
    }

    if (backgroundOption === "Custom" && !customBackground.trim()) {
      setError("Please describe the custom background scene.");
      return;
    }

    setError(null);
    setGeneratedImages([]);
    const totalSteps = numFrames + 1;
    setLoadingProgress({
      current: 0,
      total: totalSteps,
      message: "Initializing…",
    });

    try {
      const images = await generate360Images(
        originalImageFile,
        prompt,
        numFrames,
        style,
        backgroundOption,
        customBackground,
        (progress) => setLoadingProgress(progress)
      );
      setGeneratedImages(images);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred during generation."
      );
    } finally {
      setLoadingProgress(null);
    }
  }, [
    backgroundOption,
    customBackground,
    numFrames,
    originalImageFile,
    prompt,
    style,
  ]);

  const handleInterpolate = useCallback(async () => {
    if (generatedImages.length === 0) {
      return;
    }

    setError(null);
    setIsInterpolating(true);
    setLoadingProgress({
      current: 0,
      total: generatedImages.length,
      message: "Initializing interpolation…",
    });

    try {
      const smootherImages = await interpolateFrames(
        generatedImages,
        (progress) => {
          setLoadingProgress(progress);
        }
      );
      setGeneratedImages(smootherImages);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred during interpolation."
      );
    } finally {
      setIsInterpolating(false);
      setLoadingProgress(null);
    }
  }, [generatedImages]);

  const progressPercentage = useMemo(() => {
    if (!loadingProgress || loadingProgress.total === 0) {
      return 0;
    }
    return Math.min(
      100,
      (loadingProgress.current / loadingProgress.total) * 100
    );
  }, [loadingProgress]);

  const isGenerateDisabled =
    !originalImageFile || Boolean(loadingProgress) || isInterpolating;
  const showCustomBackground = backgroundOption === "Custom";

  const renderOutput = () => {
    if (loadingProgress) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 rounded-lg p-8">
          <Spinner message={loadingProgress.message} />
          <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4">
            <div
              className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-gray-400 mt-2">
            {loadingProgress.current} / {loadingProgress.total} steps
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-red-900/20 border border-red-500 rounded-lg p-8 text-center">
          <h3 className="text-xl font-bold text-red-400 mb-2">
            Operation Failed
          </h3>
          <p className="text-red-300">{error}</p>
        </div>
      );
    }

    if (generatedImages.length > 0) {
      return (
        <div className="w-full h-full flex flex-col space-y-4">
          <Viewer360 images={generatedImages} />
          <button
            onClick={handleInterpolate}
            disabled={isInterpolating || Boolean(loadingProgress)}
            className="w-full font-bold py-2 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700"
          >
            {isInterpolating ? "Smoothing…" : "🌀 Double Frames & Smooth"}
          </button>
        </div>
      );
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
          <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 space-y-6">
            <div>
              <label className="block text-lg font-semibold mb-2">
                1. Get Your Image
              </label>
              <div className="flex border-b border-gray-700 mb-4">
                <button
                  onClick={() => setInputMode("upload")}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    inputMode === "upload"
                      ? "border-b-2 border-blue-500 text-white"
                      : "text-gray-400 hover:bg-gray-700/50"
                  }`}
                >
                  Upload Image
                </button>
                <button
                  onClick={() => setInputMode("generate")}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    inputMode === "generate"
                      ? "border-b-2 border-blue-500 text-white"
                      : "text-gray-400 hover:bg-gray-700/50"
                  }`}
                >
                  Generate with AI
                </button>
                <button
                  onClick={() => setInputMode("draw")}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    inputMode === "draw"
                      ? "border-b-2 border-blue-500 text-white"
                      : "text-gray-400 hover:bg-gray-700/50"
                  }`}
                >
                  Draw with AI
                </button>
              </div>

              {inputMode === "upload" && (
                <ImageUploader
                  onImageUpload={handleImageUpload}
                  initialImageUrl={previewUrl}
                />
              )}
              {inputMode === "generate" && (
                <ImageGenerator onImageReady={handleImageUpload} />
              )}
              {inputMode === "draw" && (
                <ImageDrawer onImageReady={handleImageUpload} />
              )}
            </div>

            <div>
              <label
                className="block text-lg font-semibold mb-2"
                htmlFor="prompt"
              >
                2. Describe Subject
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={2}
                className="w-full bg-gray-900 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                placeholder="e.g., A futuristic sneaker, clean studio lighting"
              />
            </div>

            <div>
              <label className="block text-lg font-semibold mb-2">
                3. Customize Scene
              </label>
              <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <div>
                  <label
                    htmlFor="style-select"
                    className="block text-sm font-medium text-gray-400 mb-1"
                  >
                    Style
                  </label>
                  <select
                    id="style-select"
                    value={style}
                    onChange={(event) =>
                      setStyle(event.target.value as StyleOption)
                    }
                    className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  >
                    {STYLE_PRESETS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="frames-slider"
                    className="block text-sm font-medium text-gray-400 mb-1"
                  >
                    Number of Frames:{" "}
                    <span className="font-bold text-white">{numFrames}</span>
                  </label>
                  <input
                    id="frames-slider"
                    type="range"
                    min={FRAME_COUNT_LIMITS.min}
                    max={FRAME_COUNT_LIMITS.max}
                    step={FRAME_COUNT_LIMITS.step}
                    value={numFrames}
                    onChange={(event) =>
                      setNumFrames(Number(event.target.value))
                    }
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <span className="block text-sm font-medium text-gray-400 mb-2">
                    Background
                  </span>
                  <div className="flex flex-wrap gap-4">
                    {BACKGROUND_OPTIONS.map((option) => (
                      <label
                        key={option}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="background"
                          value={option}
                          checked={backgroundOption === option}
                          onChange={() => setBackgroundOption(option)}
                          className="h-4 w-4 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {showCustomBackground && (
                  <div>
                    <textarea
                      value={customBackground}
                      onChange={(event) =>
                        setCustomBackground(event.target.value)
                      }
                      rows={2}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      placeholder="e.g., A cyberpunk city, a marble showroom…"
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerateDisabled}
              className="w-full text-lg font-bold py-3 px-6 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 enabled:shadow-lg enabled:shadow-blue-500/30"
            >
              {loadingProgress && !isInterpolating
                ? "Generating…"
                : "✨ Generate 360° View"}
            </button>
          </div>

          <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 min-h-[400px] lg:min-h-0 flex items-center justify-center">
            {renderOutput()}
          </div>
        </main>
        <footer className="mt-8 text-center text-xs text-gray-500 space-x-2">
          <span>Built by Abu Bakar Siddik</span>
          <a
            className="text-blue-400 hover:text-blue-300"
            href="mailto:abubakar1808031@gmail.com"
          >
            Email
          </a>
          <a
            className="text-blue-400 hover:text-blue-300"
            href="https://www.linkedin.com/in/abu-bakar-siddik31/"
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn
          </a>
        </footer>
      </div>
    </div>
  );
};

export default App;
