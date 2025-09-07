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

export const generate360Images = async (
  originalImageFile: File,
  userPrompt: string,
  numFrames: number,
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

    const prompt = `
Imagine you are a skilled photographer creating a story about a single subject: ${userPrompt}.  
The subject is standing in a fixed scene, with the original background from the reference image.  

The story unfolds as the camera slowly circles around them.  
At this moment in the story, the camera has moved to exactly **${angle} degrees** around the subject’s vertical axis, as if rotating in smooth 3D space.  

Just like in every other frame of this story:
- The subject must remain **perfectly the same** as in the reference: same face, body, clothing, textures, and colors. Nothing about them should change.  
- The light, shadows, and overall artistic style stay identical from frame to frame, as if the same lens and lighting setup are used throughout the story.  
- The subject always stays centered in the frame, with the same camera distance and perspective—no zooming or cropping.  
- The background is part of the scene’s story: it must be **the same background from the original image**, unchanged, keeping the sense of place consistent.  

This frame is one page of the ongoing visual story: a perfect moment in a continuous 360° rotation sequence.`


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