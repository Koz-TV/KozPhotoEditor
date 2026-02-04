export type ImageSource = {
  bitmap: ImageBitmap;
  name: string;
  size: number;
  type: string;
  width: number;
  height: number;
};

export type ExportRequest = {
  blob: Blob;
  defaultName: string;
  mimeType: string;
};

export const isTauri = () => {
  if (typeof window === 'undefined') return false;
  const globalAny = globalThis as { isTauri?: boolean } & Record<string, unknown>;
  if (typeof globalAny.isTauri === 'boolean') return globalAny.isTauri;
  return '__TAURI__' in window;
};
