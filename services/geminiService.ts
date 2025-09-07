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

/**
 * Uses a generative model to analyze the user's input and create a single,
 * highly detailed "master prompt" to ensure consistency across all generated frames.
 */
const createConsistentPrompt = async (
  originalImageFile: File,
  userPrompt: string,
  style: string,
  backgroundOption: string,
  customBackground: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const originalImagePart = await fileToGenerativePart(originalImageFile);

    let backgroundInstruction = '';
    switch (backgroundOption) {
        case 'Original':
            backgroundInstruction = 'Preserve the exact background from the uploaded image. Do not change it.';
            break;
        case 'Transparent':
            backgroundInstruction = 'The background must be perfectly transparent. Only the subject should be visible.';
            break;
        case 'Custom':
            backgroundInstruction = `Use a detailed scene described as: "${customBackground}". This background must remain static and consistent in perspective, lighting, and all elements across every frame.`;
            break;
        default:
            backgroundInstruction = 'Preserve the exact background from the uploaded image.';
    }

    const analysisPrompt = `
You are an expert prompt engineer for an advanced text-to-image AI model. Your task is to synthesize user inputs into a single, detailed "master prompt". This master prompt will be used to generate multiple frames of a 360-degree rotation.

**CRITICAL INSTRUCTIONS - HIERARCHY OF PRIORITIES:**
1.  **The User's Choices Are Paramount:** The user's specified style and background requirements MUST override the visual information in the uploaded image. The image is a reference for the *subject's form and identity*, not its style or environment.
2.  **Main Subject is the Anchor:** The core object/character from the uploaded image must be the central focus. Accurately describe its fundamental shape and key features.
3.  **Style is a Command:** The final output MUST be in the **"${style}"** style. Your description should reflect this, even if the original image has a different aesthetic.
4.  **Background is Conditional:**
    *   If the user chose 'Original', you must describe and preserve the background from the image.
    *   If the user chose 'Custom' or a new 'Style', you MUST IGNORE the original background and create a new one based on their choice.

**USER'S SPECIFICATIONS:**
- **Subject Description:** "${userPrompt}"
- **Mandatory Artistic Style:** "${style}"
- **Background Instruction:** "${backgroundInstruction}"

**YOUR TASK:**
Based on the hierarchy above, create the master prompt.
1.  **Analyze the reference image ONLY for the subject's core characteristics** (e.g., a red panda, a vintage book, a robot's shape).
2.  **Write a detailed, narrative description of this subject rendered in the user's chosen "${style}" style.**
3.  **Integrate the background** following the background instruction precisely. The background must also match the specified style.
4.  **Ensure the scene is static.** The description should imply that lighting, subject, and background are fixed, and only the camera is moving.
5.  **Include the placeholder:** The prompt MUST contain the exact placeholder \`**[CAMERA_ANGLE]**\` which will be replaced with the viewing angle for each frame.

**OUTPUT FORMAT:**
Produce ONLY the final master prompt text. No explanations, no preamble, no markdown.
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                originalImagePart,
                { text: analysisPrompt },
            ],
        },
    });

    return response.text.trim();
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
  const totalSteps = numFrames + 1; // +1 for the analysis step

  // Step 1: Create the master prompt for consistency
  onProgress({ current: 0, total: totalSteps, message: "Analyzing image & requirements..." });
  const masterPrompt = await createConsistentPrompt(
    originalImageFile,
    userPrompt,
    style,
    backgroundOption,
    customBackground
  );
  onProgress({ current: 1, total: totalSteps, message: "Analysis complete. Generating frames..." });

  // Step 2: Generate frames using the master prompt
  for (let i = 0; i < numFrames; i++) {
    const angle = Math.round(i * (360 / numFrames));
    onProgress({ current: i + 1, total: totalSteps, message: `Generating frame ${i + 1} of ${numFrames} at ${angle}°...` });

    // Replace the placeholder with the current angle for this frame
    const framePrompt = masterPrompt.replace('**[CAMERA_ANGLE]**', `viewed from a precise ${angle}-degree angle`);

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
          parts: [
            originalImagePart,
            { text: framePrompt },
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

      // Update progress after successful generation of a frame
      onProgress({ current: i + 2, total: totalSteps, message: `Frame ${i + 1} complete.` });

    } catch (error) {
      console.error(`Error generating frame ${i + 1}:`, error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      throw new Error(`Failed to generate frame ${i + 1} at ${angle} degrees. Reason: ${errorMessage}`);
    }
  }

  return generatedImages;
};