import { GoogleGenAI } from "@google/genai";

let cachedClient: GoogleGenAI | null = null;

const resolveApiKey = (): string | undefined => {
  // Vite exposes custom environment variables through import.meta.env,
  // but we also fall back to process.env for Node runtimes (tests, SSR).
  const viteKey =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY
      : undefined;

  if (viteKey) {
    return viteKey;
  }

  if (typeof process !== "undefined") {
    return (
      process.env.VITE_GEMINI_API_KEY ??
      process.env.GEMINI_API_KEY ??
      process.env.API_KEY
    );
  }

  return undefined;
};

export const getGeminiClient = (): GoogleGenAI => {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = resolveApiKey();

  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Please set VITE_GEMINI_API_KEY in your environment."
    );
  }

  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
};
