import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { LoadingProgress } from '../types';

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export const generateSingleImage = async (prompt: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const response = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/png',
      aspectRatio: '1:1',
    },
  });

  if (response.generatedImages && response.generatedImages.length > 0) {
    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${base64ImageBytes}`;
  } else {
    throw new Error("Image generation failed to produce an image.");
  }
};

export const editSingleImage = async (base64ImageData: string, mimeType: string, editPrompt: string): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable is not set.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const imagePart = {
        inlineData: {
            data: base64ImageData,
            mimeType: mimeType,
        },
    };

    const textPart = { text: `Modify the uploaded image by following this instruction: "${editPrompt}". Maintain the original style and composition.` };

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
            parts: [imagePart, textPart],
        },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
    }
    
    throw new Error("Image editing failed to return a new image.");
};


export const generate360Images = async (
  originalImageFile: File,
  userPrompt: string,
  numFrames: number,
  style: string,
  backgroundOption: string,
  customBackground: string,
  onProgress: (progress: LoadingProgress) => void
): Promise<string[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const generatedImages: string[] = [];
  const originalImagePart = await fileToGenerativePart(originalImageFile);

  onProgress({ current: 0, total: numFrames, message: "Preparing to generate..." });

  for (let i = 0; i < numFrames; i++) {
    const angle = Math.round(i * (360 / numFrames));
    onProgress({ current: i, total: numFrames, message: `Generating frame at ${angle}°...` });

    let backgroundChoiceText = '';
    switch (backgroundOption) {
      case 'Original':
        backgroundChoiceText = 'Preserve the exact background from the uploaded image. Do not change it.';
        break;
      case 'Transparent':
        backgroundChoiceText = 'The background must be perfectly transparent. Only the subject should be visible.';
        break;
      case 'Custom':
        backgroundChoiceText = customBackground
          ? `A detailed scene described as: "${customBackground}". This background must remain static and consistent in perspective, lighting, and all elements across every frame, as if the camera is rotating around the subject within this fixed environment.`
          : 'Preserve the exact background from the uploaded image. Do not change it.'; // Fallback
        break;
      default:
        backgroundChoiceText = 'Preserve the exact background from the uploaded image. Do not change it.';
    }

    const prompt = `
**Objective:** Generate a single, high-quality, stylized image that represents one frame in a 360-degree rotation of the subject from the provided reference image.

**Subject:** Based on the uploaded image. The user's description is: "${userPrompt}".

**Camera Angle:** The subject is viewed from a precise **${angle}-degree** angle in a clockwise rotation around its vertical axis.

**Artistic Style:** Apply a consistent **"${style}"** style. The visual aesthetic must be uniform across all generated frames to create a seamless rotation effect.

**Background:** ${backgroundChoiceText}

**CRITICAL INSTRUCTIONS for CONSISTENCY:**
1.  **Subject Fidelity:** The subject's core features, colors, textures, and details MUST remain identical to the reference image. DO NOT add, remove, or alter the subject's design.
2.  **Lighting & Shadows:** The lighting environment must be static. The position and intensity of light sources and shadows must NOT change from frame to frame.
3.  **Composition:** Keep the subject perfectly centered. The camera's distance and height relative to the subject must be fixed. Do not change the perspective or lens.
4.  **Output:** Provide only the resulting image. Do not add any text or explanation.`;


    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
          parts: [
            originalImagePart,
            { text: prompt },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      let imageFound = false;
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64ImageBytes: string = part.inlineData.data;
          const imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
          generatedImages.push(imageUrl);
          imageFound = true;
          break;
        }
      }
      if (!imageFound) {
        throw new Error(`Frame ${i + 1} generation failed: No image data returned.`);
      }

      onProgress({ current: i + 1, total: numFrames, message: `Frame ${i + 1} complete.` });
    } catch (error) {
      console.error(`Error generating frame ${i + 1}:`, error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      throw new Error(`Failed to generate frame ${i + 1} at ${angle} degrees. Reason: ${errorMessage}`);
    }
  }

  return generatedImages;
};