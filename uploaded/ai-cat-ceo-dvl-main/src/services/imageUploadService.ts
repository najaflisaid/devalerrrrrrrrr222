// De Valeur — Client-side upload service (Cloudflare R2 via Worker)
//
// ⚠️ WORKER URL burada saxlanır — Vercel env variable-larına ehtiyac yoxdur.
// Cloudflare-də Worker deploy etdikdən sonra bu URL-i yeniləyin.
//
// Setup guide: /app/CLOUDFLARE_R2_SETUP.md
//
// Worker endpoint POST-la multipart/form-data qəbul edir (field: "file", optional "folder")
// Response: { url, key }

// Priority: Vite env → hardcoded fallback
const WORKER_URL =
  (import.meta as any).env?.VITE_R2_WORKER_URL ||
  'https://orange-cloud-4565.najaflisaid35.workers.dev';

export type UploadProgress = (percent: number) => void;

export async function uploadMediaToR2(
  file: File,
  folder = 'uploads',
  onProgress?: UploadProgress
): Promise<string> {
  if (!file) throw new Error('Fayl seçilmədi');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  // Use XMLHttpRequest for progress support (fetch doesn't support upload progress natively)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const endpoint = `${WORKER_URL.replace(/\/$/, '')}/upload`;

    xhr.open('POST', endpoint, true);
    xhr.responseType = 'json';

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.onload = () => {
      const res = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300) {
        if (res?.url) resolve(res.url);
        else reject(new Error('Server URL qaytarmadı'));
      } else {
        reject(new Error(res?.error || `Yükləmə uğursuz oldu (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Şəbəkə xətası — Worker URL və CORS quraşdırmasını yoxlayın'));
    xhr.ontimeout = () => reject(new Error('Yükləmə vaxtı bitdi'));

    xhr.send(formData);
  });
}

// Backward compat — köhnə funksiya adı
export async function uploadImageToR2(file: File, folder = 'products'): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Yalnız şəkil faylları qəbul edilir');
  }
  return uploadMediaToR2(file, folder);
}
