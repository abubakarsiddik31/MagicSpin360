import type { InlineDataPart } from "./types";
import { parseDataUrl } from "@/utils/dataUrl";

export const fileToInlineDataPart = async (
  file: File
): Promise<InlineDataPart> => {
  const encodedData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Unable to read file as base64 string."));
        return;
      }
      const base64Data = reader.result.split(",")[1];
      if (!base64Data) {
        reject(new Error("File did not produce a valid data URL payload."));
        return;
      }
      resolve(base64Data);
    };

    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.readAsDataURL(file);
  });

  return {
    inlineData: {
      data: encodedData,
      mimeType: file.type,
    },
  };
};

export const dataUrlToInlineDataPart = (dataUrl: string): InlineDataPart => {
  const { base64Data, mimeType } = parseDataUrl(dataUrl);
  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
};
