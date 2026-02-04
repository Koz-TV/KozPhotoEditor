import type { ExportRequest, ImageSource } from './fileIO';
import { inferMimeType, loadImageFromBlob } from './image';

export const openImageDialog = async (): Promise<ImageSource | null> => {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readFile } = await import('@tauri-apps/plugin-fs');

  const result = await open({
    multiple: false,
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
    ],
  });

  if (!result || Array.isArray(result)) return null;
  const data = await readFile(result);
  const mimeType = inferMimeType(result);
  const blob = new Blob([data], { type: mimeType });
  const name = result.split(/[/\\\\]/).pop() ?? 'image';
  return loadImageFromBlob(blob, name, data.length);
};

export const loadImageFromPath = async (path: string): Promise<ImageSource> => {
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const data = await readFile(path);
  const mimeType = inferMimeType(path);
  const blob = new Blob([data], { type: mimeType });
  const name = path.split(/[/\\\\]/).pop() ?? 'image';
  return loadImageFromBlob(blob, name, data.length);
};

export const saveExportDialog = async ({ blob, defaultName }: ExportRequest) => {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');

  const path = await save({
    defaultPath: defaultName,
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
    ],
  });

  if (!path) return;
  const buffer = new Uint8Array(await blob.arrayBuffer());
  await writeFile(path, buffer);
};
