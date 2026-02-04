import type { ImageSource } from './fileIO';

export const inferMimeType = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'application/octet-stream';
};

export const loadImageFromBlob = async (
  blob: Blob,
  name: string,
  size: number
): Promise<ImageSource> => {
  const bitmap = await createImageBitmap(blob);
  return {
    bitmap,
    name,
    size,
    type: blob.type || inferMimeType(name),
    width: bitmap.width,
    height: bitmap.height,
  };
};

export const loadImageFromFile = async (file: File): Promise<ImageSource> => {
  return loadImageFromBlob(file, file.name, file.size);
};
