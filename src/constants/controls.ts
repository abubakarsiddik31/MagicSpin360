export const STYLE_PRESETS = [
  "Photorealistic",
  "Cartoon",
  "Clay Model",
  "Watercolor",
  "Pixel Art",
  "Fantasy",
  "Sci-Fi",
] as const;

export const BACKGROUND_OPTIONS = [
  "Original",
  "Transparent",
  "Custom",
] as const;

export type BackgroundOption = (typeof BACKGROUND_OPTIONS)[number];

export const DEFAULT_FRAME_COUNT = 4;
export const FRAME_COUNT_LIMITS = {
  min: 4,
  max: 12,
  step: 1,
} as const;

export const DEFAULT_PROMPT = "A high-quality image of this object";
