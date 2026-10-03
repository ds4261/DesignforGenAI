export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function photoError(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "Choose a JPG, PNG, or WebP photo.";
  if (!file.size) return "That photo is empty. Choose another photo.";
  if (file.size > MAX_PHOTO_BYTES) return "Choose a photo smaller than 4 MB.";
  return null;
}
