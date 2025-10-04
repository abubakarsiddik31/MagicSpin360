export interface ParsedDataUrl {
  base64Data: string;
  mimeType: string;
}

/**
 * Parses a data URL (e.g. from a canvas or inline image) and returns the
 * base64-encoded payload alongside its MIME type.
 */
export const parseDataUrl = (dataUrl: string): ParsedDataUrl => {
  const [header, base64Data] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);

  if (!mimeMatch || !base64Data) {
    throw new Error("Unable to parse data URL.");
  }

  return {
    base64Data,
    mimeType: mimeMatch[1],
  };
};

/**
 * Converts a data URL into a File object so it can flow through the existing
 * upload/generation pipeline.
 */
export const dataUrlToFile = (dataUrl: string, filename: string): File => {
  const { base64Data, mimeType } = parseDataUrl(dataUrl);
  const binaryString = atob(base64Data);
  const length = binaryString.length;
  const uint8Array = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }

  return new File([uint8Array], filename, { type: mimeType });
};
