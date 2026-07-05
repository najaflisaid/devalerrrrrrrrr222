// Helper: upload a File to Cloudflare R2 via /api/r2-upload, returns public URL
// Client-side utility used by admin panels.

export async function uploadImageToR2(file: File, folder = 'products'): Promise<string> {
  if (!file) throw new Error('No file');
  if (!file.type.startsWith('image/')) {
    throw new Error('Yalnız şəkil faylları qəbul edilir');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Şəkil çox böyükdür (maks. 10MB)');
  }

  const base64 = await fileToBase64(file);

  const resp = await fetch('/api/r2-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileBase64: base64,
      filename: file.name,
      contentType: file.type,
      folder,
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error || `Yükləmə uğursuz oldu (${resp.status})`);
  }
  if (!data?.url) throw new Error('Server URL qaytarmadı');
  return data.url as string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Fayl oxunmadı'));
    reader.readAsDataURL(file);
  });
}
