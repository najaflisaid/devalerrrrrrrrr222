import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, PenLine } from 'lucide-react';

// Sadə inline imza sahəsi — formanın daxilində istifadə üçün.
// Onchange ilə valideynə imza data URL göndərir (boş string = imza yoxdur).

interface InlineSignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  height?: number;
  label?: string;
  disabled?: boolean;
}

const MIN_STROKES_REQUIRED = 8;

const InlineSignaturePad: React.FC<InlineSignaturePadProps> = ({
  value,
  onChange,
  height = 180,
  label = 'İmzanız',
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const strokeCountRef = useRef(0);
  const [hasContent, setHasContent] = useState(!!value);

  // Canvas-ı ölçüsünə uyğun qur (responsive)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Əgər artıq value varsa (məsələn redaktə) — şəkli çək
      if (value) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = value;
      }
    };
    setupCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const isTouch = 'touches' in e;
    const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    strokeCountRef.current += 1;
    if (strokeCountRef.current >= MIN_STROKES_REQUIRED && !hasContent) {
      setHasContent(true);
    }
  };

  const end = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (strokeCountRef.current >= MIN_STROKES_REQUIRED) {
      onChange(canvas.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokeCountRef.current = 0;
    setHasContent(false);
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] uppercase tracking-wider text-gray-600 flex items-center gap-1">
          <PenLine className="h-3 w-3" /> {label}
        </label>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasContent}
          className="text-[11px] inline-flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-red-600 disabled:opacity-40 disabled:hover:text-gray-600"
          data-testid="signature-clear"
        >
          <RotateCcw className="h-3 w-3" /> Təmizlə
        </button>
      </div>
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden" style={{ height }}>
        <canvas
          ref={canvasRef}
          className={`w-full h-full ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'} touch-none`}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          data-testid="signature-canvas"
        />
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-300 text-sm select-none">Burada imzalayın</p>
          </div>
        )}
        {/* Imza xətti dekorativ */}
        <div className="absolute bottom-3 left-4 right-4 border-b border-gray-200 pointer-events-none" />
      </div>
      <p className="text-[10px] text-gray-500">
        İmzalamaqla ərizənizin məzmununu və üçüncü şəxslərlə paylaşılmamasına dair öhdəliyinizi təsdiq edirsiniz.
      </p>
    </div>
  );
};

export default InlineSignaturePad;
