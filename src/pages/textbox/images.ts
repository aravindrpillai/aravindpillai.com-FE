/** Pasted/dropped images are embedded as data: URIs, downscaled so a box stays small. */
const MAX_DIM = 1920;
const KEEP_AS_IS_BYTES = 300 * 1024;
const OK_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function imageToDataUrl(file: File): Promise<string> {
  // GIFs keep their animation; small images are kept untouched.
  if (file.type === "image/gif" || (OK_TYPES.includes(file.type) && file.size <= KEEP_AS_IS_BYTES)) {
    return readAsDataUrl(file);
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL("image/webp", 0.85);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}

export const imageFilesFrom = (list?: DataTransferItemList | FileList | null): File[] => {
  if (!list) return [];
  const files: File[] = [];
  for (const item of Array.from(list as ArrayLike<DataTransferItem | File>)) {
    const f = item instanceof File ? item : item.kind === "file" ? item.getAsFile() : null;
    if (f && f.type.startsWith("image/")) files.push(f);
  }
  return files;
};
