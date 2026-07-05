import { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { uploadImageToR2 } from '../../services/imageUploadService';

interface ImageInputRowProps {
  value: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  placeholder?: string;
  folder?: string;
  testId?: string;
}

/**
 * Bir sətir: [URL input] [📎 Yüklə düyməsi] [X sil düyməsi]
 * URL manually yazmaq və ya faylı seçib R2-yə yükləmək — hər ikisi.
 */
export default function ImageInputRow({
  value,
  onChange,
  onRemove,
  placeholder = 'Şəkil URL',
  folder = 'products',
  testId,
}: ImageInputRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // reset input so same file can be reselected
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImageToR2(file, folder);
      onChange(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Yükləmə xətası';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-2">
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
          title="Faylı seçib yüklə"
          data-testid={testId ? `${testId}-upload-btn` : undefined}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">Yüklənir...</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Yüklə</span>
            </>
          )}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            data-testid={testId ? `${testId}-remove-btn` : undefined}
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
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
    </div>
  );
}
