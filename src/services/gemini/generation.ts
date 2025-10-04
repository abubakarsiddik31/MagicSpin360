import { Modality, type GenerateContentResponse } from "@google/genai";
import { createConsistentPrompt } from "./prompts";
import { dataUrlToInlineDataPart, fileToInlineDataPart } from "./utils";
import { getGeminiClient } from "./client";
import type { InlineDataPart } from "./types";
import type { LoadingProgress } from "@/types";
import type { BackgroundOption } from "@/constants/controls";

const extractInlineData = (
  response: GenerateContentResponse
): InlineDataPart | null => {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if ("inlineData" in part && part.inlineData) {
      return {
        inlineData: {
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        },
      };
    }
  }
  return null;
};

const inlineDataToDataUrl = ({ inlineData }: InlineDataPart): string =>
  `data:${inlineData.mimeType};base64,${inlineData.data}`;

const ensureImage = (
  response: GenerateContentResponse,
  errorMessage: string
): InlineDataPart => {
  const imagePart = extractInlineData(response);
  if (!imagePart) {
    throw new Error(errorMessage);
  }
  return imagePart;
};

export const generateSingleImage = async (prompt: string): Promise<string> => {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image-preview",
    contents: {
      parts: [
        {
          text: `Generate a high-quality image based on this description: "${prompt}". The subject should be centered with a clean or transparent background unless specified otherwise.`,
        },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  return inlineDataToDataUrl(
    ensureImage(response, "Image generation failed to produce an image.")
  );
};

export const editSingleImage = async (
  base64ImageData: string,
  mimeType: string,
  editPrompt: string
): Promise<string> => {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image-preview",
    contents: {
      parts: [
        {
          inlineData: { data: base64ImageData, mimeType },
        },
        {
          text: `Modify the uploaded image by following this instruction: "${editPrompt}". Maintain the original style and composition.`,
        },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  return inlineDataToDataUrl(
    ensureImage(response, "Image editing failed to return a new image.")
  );
};

export const enhanceDrawing = async (
  base64ImageData: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image-preview",
    contents: {
      parts: [
        {
          inlineData: { data: base64ImageData, mimeType },
        },
        {
          text: `You are an AI image generation assistant. Your task is to take a user's rough sketch (the provided image) and a text prompt, and transform the sketch into a fully realized, high-quality image.
**CRITICAL:** The composition, shapes, and placement of objects in the output image MUST strictly follow the user's sketch. The text prompt, "${prompt}", should ONLY be used to define the artistic style, color, texture, and finer details. Do not add, remove, or reposition major elements from the original sketch. The final output must be an enhanced, detailed version of the provided drawing.`,
        },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  return inlineDataToDataUrl(
    ensureImage(response, "Image enhancement failed to return an image.")
  );
};

export const generate360Images = async (
  originalImageFile: File,
  userPrompt: string,
  numFrames: number,
  style: string,
  backgroundOption: BackgroundOption,
  customBackground: string,
  onProgress: (progress: LoadingProgress) => void
): Promise<string[]> => {
  const ai = getGeminiClient();
  const generatedImages: string[] = [];
  const totalSteps = numFrames + 1; // +1 for the analysis step

  onProgress({
    current: 0,
    total: totalSteps,
    message: "Analyzing image & requirements...",
  });
  const masterPrompt = await createConsistentPrompt(
    originalImageFile,
    userPrompt,
    style,
    backgroundOption,
    customBackground
  );
  onProgress({
    current: 1,
    total: totalSteps,
    message: "Analysis complete. Generating frames...",
  });

  let previousImagePart = await fileToInlineDataPart(originalImageFile);
  let previousAngle = 0;

  for (let i = 0; i < numFrames; i += 1) {
    const targetAngle = Math.round((i + 1) * (360 / numFrames));
    onProgress({
      current: i + 1,
      total: totalSteps,
      message: `Generating frame ${
        i + 1
      } of ${numFrames} at ${targetAngle}\u00b0...`,
    });

    const framePrompt = `${masterPrompt}

**ROTATION TASK:** The provided image shows the subject at approximately a ${previousAngle}-degree horizontal angle. Your task is to generate the next frame, rotating the subject to a ${targetAngle}-degree horizontal view. Maintain perfect consistency in style, lighting, scale, and background as described in the master prompt above. The rotation should be smooth and incremental. The subject must remain perfectly centered.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: {
          parts: [previousImagePart, { text: framePrompt }],
        },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      const imagePart = ensureImage(
        response,
        `Frame ${i + 1} generation failed: No image data returned.`
      );

      generatedImages.push(inlineDataToDataUrl(imagePart));
      previousImagePart = imagePart;
      previousAngle = targetAngle;
      onProgress({
        current: i + 2,
        total: totalSteps,
        message: `Frame ${i + 1} complete.`,
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "An unknown error occurred.";
      throw new Error(
        `Failed to generate frame ${
          i + 1
        } at ${targetAngle} degrees. Reason: ${reason}`
      );
    }
  }

  return generatedImages;
};

export const interpolateFrames = async (
  baseImages: string[],
  onProgress: (progress: LoadingProgress) => void
): Promise<string[]> => {
  const ai = getGeminiClient();
  const finalImages: string[] = [];
  const totalSteps = baseImages.length;

  for (let i = 0; i < baseImages.length; i += 1) {
    onProgress({
      current: i,
      total: totalSteps,
      message: `Interpolating frame ${i + 1} of ${totalSteps}...`,
    });

    const frameA = baseImages[i];
    const frameB = baseImages[(i + 1) % baseImages.length];
    finalImages.push(frameA);

    try {
      const imagePartA = dataUrlToInlineDataPart(frameA);
      const imagePartB = dataUrlToInlineDataPart(frameB);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: {
          parts: [
            imagePartA,
            imagePartB,
            {
              text: "You are an expert in video frame interpolation. Your task is to generate a single intermediate frame that smoothly transitions between the two provided images. Image 1 is the starting frame, and Image 2 is the ending frame. Create a new frame that represents the exact halfway point of the rotation between them. The subject's position, scale, lighting, and the background must be a perfect blend, creating a fluid motion. Do not introduce any new elements. Output only the image.",
            },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      const interpolated = extractInlineData(response);
      if (interpolated) {
        finalImages.push(inlineDataToDataUrl(interpolated));
      }
    } catch (error) {
      console.warn(
        `Interpolation failed for frame between ${i} and ${i + 1}.`,
        error
      );
    }
  }

  onProgress({
    current: totalSteps,
    total: totalSteps,
    message: "Interpolation complete!",
  });
  return finalImages;
};
