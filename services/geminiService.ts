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

const dataUrlToGenerativePart = (dataUrl: string) => {
    const [header, data] = dataUrl.split(',');
    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
    return {
      inlineData: { data, mimeType },
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
5.  **Include the placeholder:** The prompt MUST contain the exact placeholder \`**[CAMERA_INSTRUCTION]**\`. This placeholder will be replaced with a detailed command specifying the camera's exact horizontal angle, its behavior, and constraints for each frame.

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
    
    // This instruction is critical for consistency.
    const frameInstruction = `The camera is now at a precise ${angle}-degree horizontal angle. The subject MUST remain perfectly centered in the frame and maintain the same scale as the reference image. The lighting and background must not change. Only the camera's viewing angle should be different in this image.`;
    const framePrompt = masterPrompt.replace('**[CAMERA_INSTRUCTION]**', frameInstruction);

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

export const interpolateFrames = async (
    baseImages: string[],
    onProgress: (progress: LoadingProgress) => void
  ): Promise<string[]> => {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable is not set.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const finalImages: string[] = [];
    const totalSteps = baseImages.length;
  
    for (let i = 0; i < baseImages.length; i++) {
      onProgress({ current: i, total: totalSteps, message: `Interpolating frame ${i + 1} of ${totalSteps}...` });
  
      const frameA = baseImages[i];
      // Connect the last frame back to the first for a seamless loop
      const frameB = baseImages[(i + 1) % baseImages.length];
  
      finalImages.push(frameA); // Add the original frame
  
      try {
        const imagePartA = dataUrlToGenerativePart(frameA);
        const imagePartB = dataUrlToGenerativePart(frameB);
        const textPart = {
          text: "You are an expert in video frame interpolation. Your task is to generate a single intermediate frame that smoothly transitions between the two provided images. Image 1 is the starting frame, and Image 2 is the ending frame. Create a new frame that represents the exact halfway point of the rotation between them. The subject's position, scale, lighting, and the background must be a perfect blend, creating a fluid motion. Do not introduce any new elements. Output only the image.",
        };
  
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image-preview',
          contents: {
            parts: [imagePartA, imagePartB, textPart],
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
            finalImages.push(imageUrl); // Add the new interpolated frame
            imageFound = true;
            break;
          }
        }
        if (!imageFound) {
          // If interpolation fails, we can just skip adding the frame for now
          console.warn(`Interpolation failed for frame between ${i} and ${i + 1}.`);
        }
      } catch (error) {
        console.error(`Error interpolating frame between ${i} and ${i + 1}:`, error);
        // Continue even if one frame fails
      }
    }
    onProgress({ current: totalSteps, total: totalSteps, message: `Interpolation complete!` });
    return finalImages;
  };