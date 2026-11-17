const MAX_SIDE = 1600;
const MAX_BYTES = 5 * 1024 * 1024;

// Returns a smaller JPEG File. If the browser cannot decode the image, the
// original is sent as long as it is small enough; the server re-encodes it anyway.
export async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob) throw new Error('encode failed');
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } catch {
    if (file.size <= MAX_BYTES) return file;
    throw new Error('That photo is too large and could not be shrunk. Try another one.');
  }
}