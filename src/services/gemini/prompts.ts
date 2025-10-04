import { Modality } from "@google/genai";
import type { InlineDataPart } from "./types";
import { fileToInlineDataPart } from "./utils";
import { getGeminiClient } from "./client";
import type { BackgroundOption } from "@/constants/controls";

const buildBackgroundInstruction = (
  option: BackgroundOption,
  customBackground: string
): string => {
  switch (option) {
    case "Original":
      return "Preserve the exact background from the uploaded image. Do not change it.";
    case "Transparent":
      return "The background must be perfectly transparent. Only the subject should be visible.";
    case "Custom":
      return `Use a detailed scene described as: "${customBackground}". This background must remain static and consistent in perspective, lighting, and all elements across every frame.`;
    default:
      return "Preserve the exact background from the uploaded image.";
  }
};

export const createConsistentPrompt = async (
  originalImageFile: File,
  userPrompt: string,
  style: string,
  backgroundOption: BackgroundOption,
  customBackground: string
): Promise<string> => {
  const ai = getGeminiClient();
  const originalImagePart: InlineDataPart = await fileToInlineDataPart(
    originalImageFile
  );
  const backgroundInstruction = buildBackgroundInstruction(
    backgroundOption,
    customBackground
  );

  const analysisPrompt = `
  You are an expert prompt engineer for an advanced text-to-image AI model. Your task is to synthesize user inputs into a single, detailed "master prompt". This master prompt will be used as a consistent reference to generate multiple frames of a 360-degree rotation, preventing the subject from "drifting" in appearance.

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
  5.  **Focus on Description:** The prompt should be a pure, detailed description of the subject, style, and scene. It will be used as a constant reference to prevent the subject's appearance from changing during rotation. Do not include placeholders for camera angles.

  **OUTPUT FORMAT:**
  Produce ONLY the final master prompt text. No explanations, no preamble, no markdown.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [originalImagePart, { text: analysisPrompt }],
    },
    config: {
      responseModalities: [Modality.TEXT],
    },
  });

  return response.text?.trim() ?? "";
};
