import type { ExportRequest } from './fileIO';

export const downloadBlob = async ({ blob, defaultName }: ExportRequest) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = defaultName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
