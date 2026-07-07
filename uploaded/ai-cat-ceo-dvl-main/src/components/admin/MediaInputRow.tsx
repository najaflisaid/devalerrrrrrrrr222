import { useRef, useState } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, Video } from 'lucide-react';
import { uploadMediaToR2 } from '../../services/imageUploadService';

interface MediaInputRowProps {
  value: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  placeholder?: string;
  folder?: string;
  /** 'image' = yalnız şəkil, 'video' = yalnız video, 'any' = hər ikisi (default) */
  accept?: 'image' | 'video' | 'any';
  /** Max ölçü (MB). Default: şəkil 10 MB, video 100 MB, any 100 MB */
  maxSizeMB?: number;
  showPreview?: boolean;
  testId?: string;
  label?: string;
}

const ACCEPT_MAP = {
  image: 'image/*',
  video: 'video/*',
  any: 'image/*,video/*',
};

/**
 * Universal media input: [URL input] + [Yüklə] + [Sil]
 * Şəkil, video, və ya hər ikisi (banner mediaları üçün) — R2-yə yükləyir.
 */
export default function MediaInputRow({
  value,
  onChange,
  onRemove,
  placeholder = 'URL və ya Yüklə',
  folder = 'media',
  accept = 'any',
  maxSizeMB,
  showPreview = false,
  testId,
  label,
}: MediaInputRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const effectiveMax = maxSizeMB ?? (accept === 'image' ? 10 : 100);

  const handlePick = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    // Type check
    if (accept === 'image' && !file.type.startsWith('image/')) {
      setError('Yalnız şəkil faylı seçin');
      return;
    }
    if (accept === 'video' && !file.type.startsWith('video/')) {
      setError('Yalnız video faylı seçin');
      return;
    }
    if (accept === 'any' && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Şəkil və ya video seçin');
      return;
    }

    if (file.size > effectiveMax * 1024 * 1024) {
      setError(`Fayl çox böyükdür (maks. ${effectiveMax} MB)`);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadMediaToR2(file, folder, (p) => setProgress(p));
      onChange(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Yükləmə xətası';
      setError(msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(value);

  return (
    <div className="mb-2">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="flex gap-2 items-stretch">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
          placeholder={placeholder}
          data-testid={testId ? `${testId}-url` : undefined}
        />
        <button
          type="button"
          onClick={handlePick}
          disabled={uploading}
          className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-all disabled:opacity-50 flex items-center gap-1.5 text-sm whitespace-nowrap"
          title={accept === 'image' ? 'Şəkil yüklə' : accept === 'video' ? 'Video yüklə' : 'Şəkil / Video yüklə'}
          data-testid={testId ? `${testId}-upload-btn` : undefined}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">{progress > 0 ? `${progress}%` : 'Yüklənir...'}</span>
            </>
          ) : (
            <>
              {accept === 'video' ? <Video className="h-4 w-4" /> : accept === 'image' ? <ImageIcon className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              <span className="hidden sm:inline">Yüklə</span>
            </>
          )}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            title="Sil"
            data-testid={testId ? `${testId}-remove-btn` : undefined}
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_MAP[accept]}
          className="hidden"
          onChange={handleFile}
          data-testid={testId ? `${testId}-file-input` : undefined}
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 mt-1" data-testid={testId ? `${testId}-error` : undefined}>
          {error}
        </p>
      )}

      {showPreview && value && !uploading && !error && (
        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          {isVideo ? (
            <video
              src={value}
              className="w-full max-h-48 object-contain"
              controls
              muted
            />
          ) : (
            <img
              src={value}
              alt="Preview"
              className="w-full max-h-48 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
      )}
    </div>
  );
}
