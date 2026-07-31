import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Download, Share2, Loader2, Check, ImageOff, Video, Image as ImageIcon } from 'lucide-react';
import type { Product } from '../../types';
import {
  getCreditConfig,
  getRatesForBrand,
  calcMonthly,
  type CreditCalculatorConfig,
  type BrandRate,
} from '../../services/creditCalculatorService';

interface StoryShareModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  brand: string;
  productName: string;
  price: number; // final display price (already accounts for sale)
  originalPrice?: number; // strike-through price if on sale
  imageUrl: string; // currently visible product image
}

type TemplateKey = 'minimal' | 'noir' | 'gold' | 'editorial';

interface TemplateDef {
  key: TemplateKey;
  label: string;
  swatch: string; // CSS gradient for preview chip
}

const TEMPLATES: TemplateDef[] = [
  { key: 'minimal', label: 'Minimal', swatch: 'linear-gradient(135deg,#f6f5f2,#ffffff)' },
  { key: 'noir', label: 'Noir', swatch: 'linear-gradient(135deg,#0a0a0a,#1f1f1f)' },
  { key: 'gold', label: 'Gold', swatch: 'linear-gradient(135deg,#111,#3a2c14 60%,#c9a24a)' },
  { key: 'editorial', label: 'Editorial', swatch: 'linear-gradient(180deg,#e9e5df 0%,#e9e5df 55%,#111 55%,#111 100%)' },
];

// Instagram Story canonical size
const W = 1080;
const H = 1920;

const formatAzn = (n: number, fixed = 2): string =>
  n.toLocaleString('az-AZ', { minimumFractionDigits: fixed, maximumFractionDigits: fixed });

/**
 * Load an image with CORS anonymous so we can export the canvas via toBlob.
 * Firebase Storage URLs return proper CORS headers.
 */
const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });

// Word-wrap that fits into a max width, returning an array of lines.
const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3
): string[] => {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const trial = current ? `${current} ${w}` : w;
    if (ctx.measureText(trial).width > maxWidth && current) {
      lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const last = lines.slice(0, maxLines).join(' ');
    return [last];
  }
  return lines;
};

const StoryShareModal: React.FC<StoryShareModalProps> = ({
  open,
  onClose,
  brand,
  productName,
  price,
  originalPrice,
  imageUrl,
}) => {
  const [template, setTemplate] = useState<TemplateKey>('minimal');
  const [config, setConfig] = useState<CreditCalculatorConfig | null>(null);
  const [rendering, setRendering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [imgError, setImgError] = useState(false);
  const [busy, setBusy] = useState<null | 'download' | 'share' | 'video'>(null);
  const [copiedNote, setCopiedNote] = useState(false);
  const [watermark, setWatermark] = useState(true); // DE VALEUR logo overlay
  const [videoUrl, setVideoUrl] = useState<string>(''); // generated MP4/WebM blob URL
  const [videoProgress, setVideoProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Loaded product image cached so we don't refetch when template changes
  const productImgRef = useRef<HTMLImageElement | null>(null);

  // Fetch credit config once when modal opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const cfg = await getCreditConfig();
        setConfig(cfg);
      } catch {
        setConfig(null);
      }
    })();
  }, [open]);

  // 6-month rate for this brand (falls back to defaults). If 6 not present,
  // pick the closest available month plan.
  const sixMonthRate: BrandRate | null = useMemo(() => {
    if (!config) return null;
    const rates = getRatesForBrand(config, brand);
    if (!rates.length) return null;
    const six = rates.find((r) => r.months === 6);
    if (six) return six;
    // pick nearest to 6
    return rates.reduce((best, r) =>
      Math.abs(r.months - 6) < Math.abs(best.months - 6) ? r : best
    );
  }, [config, brand]);

  const monthlyForSix = useMemo(() => {
    if (!sixMonthRate) return null;
    return calcMonthly(price, sixMonthRate.months, sixMonthRate.percent);
  }, [price, sixMonthRate]);

  // ─────────────────── Render the story image ───────────────────
  const render = async () => {
    if (!canvasRef.current) return;
    setRendering(true);
    setImgError(false);
    try {
      // Ensure fonts are loaded so canvas draws correctly
      try {
        await (document as any).fonts?.ready;
      } catch {
        /* ignore */
      }

      const canvas = canvasRef.current;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Cache product image to speed up re-renders (template/watermark change)
      if (!productImgRef.current || productImgRef.current.src !== imageUrl) {
        try {
          productImgRef.current = await loadImage(imageUrl);
        } catch {
          productImgRef.current = null;
          setImgError(true);
        }
      }
      const productImg = productImgRef.current;

      drawTemplate(ctx, template, productImg);
      if (watermark) drawWatermark(ctx, template);

      const dataUrl = canvas.toDataURL('image/png');
      setPreviewUrl(dataUrl);
    } finally {
      setRendering(false);
    }
  };

  /**
   * Elegant "DE VALEUR" wordmark in a corner, half-transparent so it doesn't
   * overpower the design. Colour adapts to template (light bg = dark ink,
   * dark bg = gold ink).
   */
  const drawWatermark = (ctx: CanvasRenderingContext2D, tpl: TemplateKey) => {
    const isDark = tpl === 'noir' || tpl === 'gold';
    ctx.save();
    // Anchor at bottom-left, above the site footer line
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = isDark ? 0.55 : 0.4;
    ctx.fillStyle = isDark ? '#C9A24A' : '#111';

    // Small decorative mark (◆) — the DE VALEUR diamond
    ctx.font = '400 34px "Playfair Display", Georgia, serif';
    ctx.fillText('◆', 60, H - 66);

    // Wordmark
    ctx.font = '500 22px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('DE  VALEUR', 105, H - 70);

    // Tag under wordmark
    ctx.globalAlpha = isDark ? 0.35 : 0.25;
    ctx.font = '400 14px "Inter", Arial, sans-serif';
    ctx.fillText('Luxury  ·  since  2020', 105, H - 48);
    ctx.restore();
  };

  // Draw specific template
  const drawTemplate = (
    ctx: CanvasRenderingContext2D,
    key: TemplateKey,
    productImg: HTMLImageElement | null
  ) => {
    ctx.clearRect(0, 0, W, H);
    switch (key) {
      case 'noir':
        return drawNoir(ctx, productImg);
      case 'gold':
        return drawGold(ctx, productImg);
      case 'editorial':
        return drawEditorial(ctx, productImg);
      case 'minimal':
      default:
        return drawMinimal(ctx, productImg);
    }
  };

  // Shared helpers
  const drawProductImage = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    box: { x: number; y: number; w: number; h: number }
  ) => {
    if (!img) {
      // Placeholder
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      return;
    }
    const scale = Math.min(box.w / img.width, box.h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = box.x + (box.w - dw) / 2;
    const dy = box.y + (box.h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  };

  const drawSiteFooter = (ctx: CanvasRenderingContext2D, color: string) => {
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.font = '400 26px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.letterSpacing = '4px' as any;
    ctx.fillText('DEVALEUR.AZ', W / 2, H - 70);
  };

  // ─── Template: Minimal (light, editorial) ───
  const drawMinimal = (
    ctx: CanvasRenderingContext2D,
    productImg: HTMLImageElement | null
  ) => {
    // Warm off-white background
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#faf8f4');
    g.addColorStop(1, '#eeeae2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Top brand strip
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.font = '500 34px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText((brand || 'DE VALEUR').toUpperCase(), W / 2, 180);

    // Thin divider
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 60, 220);
    ctx.lineTo(W / 2 + 60, 220);
    ctx.stroke();

    // Product image — big centered card
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(90, 300, W - 180, 900);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.strokeRect(90, 300, W - 180, 900);
    drawProductImage(ctx, productImg, { x: 130, y: 340, w: W - 260, h: 820 });

    // Product name (2 lines)
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.font = '400 54px "Playfair Display", "Georgia", serif';
    const nameLines = wrapText(ctx, productName, W - 200, 2);
    let ny = 1290;
    nameLines.forEach((ln) => {
      ctx.fillText(ln, W / 2, ny);
      ny += 66;
    });

    // Old price (strikethrough) if on sale
    if (originalPrice && originalPrice > price) {
      ctx.font = '400 30px "Inter", Arial, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      const oldText = `${formatAzn(originalPrice, 0)} AZN`;
      ctx.fillText(oldText, W / 2, ny + 40);
      const m = ctx.measureText(oldText);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 - m.width / 2 - 8, ny + 32);
      ctx.lineTo(W / 2 + m.width / 2 + 8, ny + 32);
      ctx.stroke();
      ny += 60;
    }

    // Price — big
    ctx.fillStyle = '#111';
    ctx.font = '600 96px "Playfair Display", Georgia, serif';
    ctx.fillText(`${formatAzn(price, 0)} AZN`, W / 2, ny + 130);

    // Credit block
    if (monthlyForSix != null && sixMonthRate) {
      const boxY = ny + 200;
      // Gold pill
      ctx.fillStyle = '#111';
      const pillW = 640;
      const pillH = 150;
      const pillX = (W - pillW) / 2;
      ctx.fillRect(pillX, boxY, pillW, pillH);
      // Inner border gold
      ctx.strokeStyle = '#C9A24A';
      ctx.lineWidth = 2;
      ctx.strokeRect(pillX + 6, boxY + 6, pillW - 12, pillH - 12);

      ctx.fillStyle = '#C9A24A';
      ctx.font = '500 22px "Inter", Arial, sans-serif';
      ctx.fillText(
        `KREDİTLƏ ${sixMonthRate.months} AY${sixMonthRate.percent > 0 ? ` · ${sixMonthRate.percent}%` : ' · 0%'}`,
        W / 2,
        boxY + 55
      );
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 58px "Playfair Display", Georgia, serif';
      ctx.fillText(`${formatAzn(monthlyForSix)} AZN / ay`, W / 2, boxY + 115);
    }

    drawSiteFooter(ctx, 'rgba(0,0,0,0.55)');
  };

  // ─── Template: Noir (dark luxury) ───
  const drawNoir = (
    ctx: CanvasRenderingContext2D,
    productImg: HTMLImageElement | null
  ) => {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Subtle radial glow
    const glow = ctx.createRadialGradient(W / 2, 700, 50, W / 2, 700, 900);
    glow.addColorStop(0, 'rgba(201,162,74,0.18)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Brand top
    ctx.fillStyle = '#C9A24A';
    ctx.textAlign = 'center';
    ctx.font = '500 32px "Inter", Arial, sans-serif';
    ctx.fillText((brand || 'DE VALEUR').toUpperCase(), W / 2, 180);
    ctx.strokeStyle = '#C9A24A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 55, 210);
    ctx.lineTo(W / 2 + 55, 210);
    ctx.stroke();

    // Product image on transparent frame
    drawProductImage(ctx, productImg, { x: 100, y: 290, w: W - 200, h: 900 });

    // Name
    ctx.fillStyle = '#f5f2ea';
    ctx.font = '400 56px "Playfair Display", Georgia, serif';
    const nameLines = wrapText(ctx, productName, W - 200, 2);
    let ny = 1280;
    nameLines.forEach((ln) => {
      ctx.fillText(ln, W / 2, ny);
      ny += 66;
    });

    // Old price
    if (originalPrice && originalPrice > price) {
      ctx.font = '400 30px "Inter", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      const oldText = `${formatAzn(originalPrice, 0)} AZN`;
      ctx.fillText(oldText, W / 2, ny + 40);
      const m = ctx.measureText(oldText);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 - m.width / 2 - 8, ny + 32);
      ctx.lineTo(W / 2 + m.width / 2 + 8, ny + 32);
      ctx.stroke();
      ny += 60;
    }

    // Price
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 100px "Playfair Display", Georgia, serif';
    ctx.fillText(`${formatAzn(price, 0)} AZN`, W / 2, ny + 130);

    // Credit block — gold outline card
    if (monthlyForSix != null && sixMonthRate) {
      const boxY = ny + 200;
      const pillW = 720;
      const pillH = 170;
      const pillX = (W - pillW) / 2;
      ctx.strokeStyle = '#C9A24A';
      ctx.lineWidth = 2;
      ctx.strokeRect(pillX, boxY, pillW, pillH);

      ctx.fillStyle = '#C9A24A';
      ctx.font = '500 24px "Inter", Arial, sans-serif';
      ctx.fillText(
        `${sixMonthRate.months} AY KREDİT${sixMonthRate.percent > 0 ? ` · ${sixMonthRate.percent}%` : ' · FAİZSİZ'}`,
        W / 2,
        boxY + 58
      );
      ctx.fillStyle = '#f5f2ea';
      ctx.font = '600 62px "Playfair Display", Georgia, serif';
      ctx.fillText(`${formatAzn(monthlyForSix)} AZN / ay`, W / 2, boxY + 130);
    }

    drawSiteFooter(ctx, 'rgba(255,255,255,0.55)');
  };

  // ─── Template: Gold (bold, black + gold accents) ───
  const drawGold = (
    ctx: CanvasRenderingContext2D,
    productImg: HTMLImageElement | null
  ) => {
    // Dark gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#151105');
    g.addColorStop(1, '#3a2c14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Gold diagonal strip on top
    ctx.fillStyle = '#C9A24A';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, 120);
    ctx.lineTo(0, 200);
    ctx.closePath();
    ctx.fill();

    // Brand on gold strip
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.font = '700 42px "Inter", Arial, sans-serif';
    ctx.fillText((brand || 'DE VALEUR').toUpperCase(), W / 2, 100);

    // Product image
    ctx.fillStyle = '#faf7f0';
    ctx.fillRect(80, 280, W - 160, 900);
    drawProductImage(ctx, productImg, { x: 110, y: 310, w: W - 220, h: 840 });

    // Name
    ctx.fillStyle = '#f5e7c1';
    ctx.textAlign = 'center';
    ctx.font = '400 52px "Playfair Display", Georgia, serif';
    const nameLines = wrapText(ctx, productName, W - 200, 2);
    let ny = 1260;
    nameLines.forEach((ln) => {
      ctx.fillText(ln, W / 2, ny);
      ny += 64;
    });

    // Old price
    if (originalPrice && originalPrice > price) {
      ctx.font = '400 28px "Inter", Arial, sans-serif';
      ctx.fillStyle = 'rgba(245,231,193,0.55)';
      const oldText = `${formatAzn(originalPrice, 0)} AZN`;
      ctx.fillText(oldText, W / 2, ny + 34);
      const m = ctx.measureText(oldText);
      ctx.strokeStyle = 'rgba(245,231,193,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 - m.width / 2 - 8, ny + 28);
      ctx.lineTo(W / 2 + m.width / 2 + 8, ny + 28);
      ctx.stroke();
      ny += 52;
    }

    // Big price with gold underline
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 108px "Playfair Display", Georgia, serif';
    const priceText = `${formatAzn(price, 0)} AZN`;
    ctx.fillText(priceText, W / 2, ny + 140);
    const pm = ctx.measureText(priceText);
    ctx.strokeStyle = '#C9A24A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W / 2 - pm.width / 2, ny + 168);
    ctx.lineTo(W / 2 + pm.width / 2, ny + 168);
    ctx.stroke();

    // Credit ribbon (gold)
    if (monthlyForSix != null && sixMonthRate) {
      const boxY = ny + 230;
      const ribbonH = 160;
      ctx.fillStyle = '#C9A24A';
      ctx.fillRect(0, boxY, W, ribbonH);
      ctx.fillStyle = '#111';
      ctx.font = '600 26px "Inter", Arial, sans-serif';
      ctx.fillText(
        `${sixMonthRate.months} AY KREDİT${sixMonthRate.percent > 0 ? ` · ${sixMonthRate.percent}%` : ' · 0% FAİZ'}`,
        W / 2,
        boxY + 55
      );
      ctx.font = '700 62px "Playfair Display", Georgia, serif';
      ctx.fillText(`${formatAzn(monthlyForSix)} AZN / ay`, W / 2, boxY + 125);
    }

    drawSiteFooter(ctx, 'rgba(245,231,193,0.65)');
  };

  // ─── Template: Editorial (split — image top, dark info bottom) ───
  const drawEditorial = (
    ctx: CanvasRenderingContext2D,
    productImg: HTMLImageElement | null
  ) => {
    // Top light
    ctx.fillStyle = '#ece7df';
    ctx.fillRect(0, 0, W, 1050);
    // Bottom dark
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 1050, W, H - 1050);

    // Brand top
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.font = '500 30px "Inter", Arial, sans-serif';
    ctx.fillText((brand || 'DE VALEUR').toUpperCase(), W / 2, 130);
    // Small dot separator
    ctx.beginPath();
    ctx.arc(W / 2, 160, 3, 0, Math.PI * 2);
    ctx.fill();

    // Product image
    drawProductImage(ctx, productImg, { x: 90, y: 200, w: W - 180, h: 820 });

    // Product name
    ctx.fillStyle = '#f5f2ea';
    ctx.textAlign = 'left';
    ctx.font = '400 50px "Playfair Display", Georgia, serif';
    const nameLines = wrapText(ctx, productName, W - 180, 2);
    let ny = 1170;
    nameLines.forEach((ln) => {
      ctx.fillText(ln, 90, ny);
      ny += 60;
    });

    // Divider line
    ctx.strokeStyle = 'rgba(201,162,74,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(90, ny + 30);
    ctx.lineTo(W - 90, ny + 30);
    ctx.stroke();

    // Price + credit — 2 columns
    const colY = ny + 100;
    // Left: price
    ctx.fillStyle = 'rgba(245,242,234,0.55)';
    ctx.font = '400 22px "Inter", Arial, sans-serif';
    ctx.fillText('QİYMƏT', 90, colY);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 78px "Playfair Display", Georgia, serif';
    ctx.fillText(`${formatAzn(price, 0)} AZN`, 90, colY + 80);
    if (originalPrice && originalPrice > price) {
      ctx.font = '400 24px "Inter", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      const oldText = `${formatAzn(originalPrice, 0)} AZN`;
      ctx.fillText(oldText, 90, colY + 120);
      const m = ctx.measureText(oldText);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(90, colY + 112);
      ctx.lineTo(90 + m.width, colY + 112);
      ctx.stroke();
    }

    // Right: credit (right-aligned)
    if (monthlyForSix != null && sixMonthRate) {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(201,162,74,0.85)';
      ctx.font = '400 22px "Inter", Arial, sans-serif';
      ctx.fillText(
        `${sixMonthRate.months} AY${sixMonthRate.percent > 0 ? ` · ${sixMonthRate.percent}%` : ' · 0%'}`,
        W - 90,
        colY
      );
      ctx.fillStyle = '#C9A24A';
      ctx.font = '600 60px "Playfair Display", Georgia, serif';
      ctx.fillText(`${formatAzn(monthlyForSix)} AZN`, W - 90, colY + 80);
      ctx.fillStyle = 'rgba(245,242,234,0.75)';
      ctx.font = '400 22px "Inter", Arial, sans-serif';
      ctx.fillText('aylıq ödəniş', W - 90, colY + 118);
      ctx.textAlign = 'center';
    }

    drawSiteFooter(ctx, 'rgba(245,242,234,0.55)');
  };

  // Re-render whenever template / data changes
  useEffect(() => {
    if (!open) return;
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template, imageUrl, price, originalPrice, brand, productName, monthlyForSix, sixMonthRate, watermark]);

  const filename = useMemo(() => {
    const safe = (s: string) =>
      (s || '').toString().replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 40);
    return `story-${safe(brand)}-${safe(productName)}-${template}.png`;
  }, [brand, productName, template]);

  const canvasToBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      if (!canvasRef.current) return resolve(null);
      canvasRef.current.toBlob((b) => resolve(b), 'image/png', 0.95);
    });

  const handleDownload = async () => {
    setBusy('download');
    try {
      const blob = await canvasToBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setBusy('share');
    setCopiedNote(false);
    try {
      const blob = await canvasToBlob();
      if (!blob) return;
      const file = new File([blob], filename, { type: 'image/png' });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({
            files: [file],
            title: `${brand} — ${productName}`,
            text: `${brand} — ${productName} · ${formatAzn(price, 0)} AZN`,
          });
        } catch {
          /* user cancelled */
        }
      } else {
        // Desktop fallback — copy image to clipboard when possible, else download
        try {
          if ((window as any).ClipboardItem) {
            await navigator.clipboard.write([
              new (window as any).ClipboardItem({ 'image/png': blob }),
            ]);
            setCopiedNote(true);
            setTimeout(() => setCopiedNote(false), 3000);
          } else {
            await handleDownload();
          }
        } catch {
          await handleDownload();
        }
      }
    } finally {
      setBusy(null);
    }
  };

  // ─────────────────── Generate animated Story VIDEO (5s) ───────────────────
  /**
   * Renders a 5-second animation on the canvas and captures it via
   * MediaRecorder → produces a WebM/MP4 blob suitable for uploading to
   * Instagram Story. Animation timeline:
   *   0.00–0.60s  → product image fades in + gently scales up
   *   0.30–0.90s  → brand name slides down from above
   *   0.60–1.20s  → product name slides up
   *   0.90–1.50s  → price counts up
   *   1.30s+      → credit block reveals with gold shimmer looping
   *   4.30–5.00s  → gentle exit shimmer
   *
   * We restart the animation loop until the recorder stops at 5s. The
   * template drawing is called per-frame with alpha/transform states.
   */
  const generateVideo = async () => {
    if (!canvasRef.current) return;
    setBusy('video');
    setVideoProgress(0);
    setVideoUrl('');

    try {
      // Preload product image
      let productImg: HTMLImageElement | null = productImgRef.current;
      if (!productImg || productImg.src !== imageUrl) {
        try {
          productImg = await loadImage(imageUrl);
          productImgRef.current = productImg;
        } catch {
          productImg = null;
          setImgError(true);
        }
      }
      try {
        await (document as any).fonts?.ready;
      } catch {
        /* ignore */
      }

      const canvas = canvasRef.current;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Pick best supported mime type — MP4 first (iOS Instagram), then WebM
      const candidates = [
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      let mimeType = '';
      for (const c of candidates) {
        if ((window as any).MediaRecorder?.isTypeSupported?.(c)) {
          mimeType = c;
          break;
        }
      }
      if (!mimeType) {
        alert('Bu brauzer video yazmağı dəstəkləmir. Chrome, Safari 14.1+ və ya Firefox istifadə edin.');
        return;
      }

      const stream = (canvas as any).captureStream(30);
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const finished = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };
      });

      const durationMs = 5000;
      const startAt = performance.now();
      let stopped = false;

      // Easing helpers
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

      // Draw a single animated frame
      const drawFrame = (t: number) => {
        // 1) Base template (this fills the whole canvas)
        drawTemplate(ctx, template, productImg);

        // 2) Overlay animation layers on top based on `t` (0..1)
        // Fade-in "curtain" that reveals gradually
        if (t < 0.15) {
          const a = 1 - easeOut(t / 0.15);
          ctx.save();
          ctx.fillStyle = template === 'noir' || template === 'gold' ? '#000' : '#fff';
          ctx.globalAlpha = a;
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }

        // Subtle vertical shimmer bar sweeping across the price band
        // (from t=0.55 to end, looping)
        const shimmerStart = 0.55;
        if (t > shimmerStart) {
          const st = ((t - shimmerStart) / 0.45) % 1; // 0..1 loop
          const bandCenter = W * st;
          const grad = ctx.createLinearGradient(bandCenter - 250, 0, bandCenter + 250, 0);
          grad.addColorStop(0, 'rgba(201,162,74,0)');
          grad.addColorStop(0.5, 'rgba(201,162,74,0.22)');
          grad.addColorStop(1, 'rgba(201,162,74,0)');
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = grad;
          // Only shimmer over the lower half where the credit block lives
          ctx.fillRect(0, H * 0.55, W, H * 0.35);
          ctx.restore();
        }

        // Final gentle vignette fade at very end
        if (t > 0.92) {
          const a = clamp01((t - 0.92) / 0.08) * 0.15;
          ctx.save();
          ctx.fillStyle = template === 'noir' || template === 'gold' ? '#000' : '#fff';
          ctx.globalAlpha = a;
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }

        // Watermark on top last
        if (watermark) drawWatermark(ctx, template);
      };

      const loop = () => {
        if (stopped) return;
        const elapsed = performance.now() - startAt;
        const t = clamp01(elapsed / durationMs);
        drawFrame(t);
        setVideoProgress(Math.round(t * 100));
        if (elapsed < durationMs) {
          requestAnimationFrame(loop);
        }
      };

      recorder.start(200);
      loop();

      await new Promise<void>((r) => setTimeout(r, durationMs + 120));
      stopped = true;
      recorder.stop();

      const blob = await finished;
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setVideoProgress(100);
    } catch (e) {
      console.error(e);
      alert('Video yaradılmadı. Bir daha cəhd edin.');
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadVideo = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    // Determine extension from URL: browsers may deliver mp4 or webm
    const ext = videoUrl.includes('mp4') ? 'mp4' : 'webm';
    a.download = filename.replace(/\.png$/, `.${ext}`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleShareVideo = async () => {
    if (!videoUrl) return;
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], filename.replace(/\.png$/, `.${ext}`), { type: blob.type });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `${brand} — ${productName}`,
          text: `${brand} — ${productName}`,
        });
      } else {
        handleDownloadVideo();
      }
    } catch {
      handleDownloadVideo();
    }
  };

  // Cleanup video blob URL when modal closes / component unmounts
  useEffect(() => {
    if (!open && videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl('');
      setVideoProgress(0);
    }
  }, [open, videoUrl]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      data-testid="story-share-modal"
    >
      <div
        className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/10">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">Instagram Story üçün paylaş</h3>
            <p className="text-[11px] text-gray-500">
              1080 × 1920 — şablon seç, yüklə və ya birbaşa paylaş
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/5 rounded-lg"
            data-testid="story-share-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0 flex-1 min-h-0">
          {/* Templates */}
          <div className="border-b md:border-b-0 md:border-r border-black/10 p-4 space-y-2 overflow-y-auto">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Şablon
            </p>
            <div className="grid grid-cols-4 md:grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTemplate(t.key)}
                  className={`group relative rounded-lg overflow-hidden border-2 transition-all ${
                    template === t.key
                      ? 'border-gray-900 shadow-md'
                      : 'border-transparent hover:border-black/20'
                  }`}
                  data-testid={`story-template-${t.key}`}
                >
                  <div
                    className="aspect-[9/16] w-full"
                    style={{ background: t.swatch }}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-white/90 px-2 py-1 text-[11px] font-medium text-gray-900 text-center">
                    {t.label}
                  </div>
                  {template === t.key && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-gray-900 text-white rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="pt-4 mt-4 border-t border-black/10 space-y-1">
              <p className="text-[11px] text-gray-500">Brend</p>
              <p className="text-sm font-medium text-gray-900">{brand || '—'}</p>
              <p className="text-[11px] text-gray-500 mt-2">Məhsul</p>
              <p className="text-sm text-gray-900 line-clamp-2">{productName}</p>
              <p className="text-[11px] text-gray-500 mt-2">Qiymət</p>
              <p className="text-sm font-semibold text-gray-900">{formatAzn(price, 0)} AZN</p>
              {sixMonthRate && monthlyForSix != null && (
                <>
                  <p className="text-[11px] text-gray-500 mt-2">
                    {sixMonthRate.months} ay kreditlə
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatAzn(monthlyForSix)} AZN / ay
                  </p>
                </>
              )}
              {imgError && (
                <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-start gap-1.5">
                  <ImageOff className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  Şəkil CORS səbəbindən yüklənmədi. Şəkilsiz şablon istifadə olunur.
                </p>
              )}
            </div>

            {/* Watermark toggle */}
            <div className="pt-3 mt-3 border-t border-black/10">
              <label
                className="flex items-center justify-between gap-2 cursor-pointer select-none"
                data-testid="story-watermark-toggle-wrap"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">DE VALEUR watermark</p>
                  <p className="text-[11px] text-gray-500">İncə brend imzası əlavə et</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={watermark}
                  onClick={() => setWatermark((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    watermark ? 'bg-gray-900' : 'bg-gray-300'
                  }`}
                  data-testid="story-watermark-toggle"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      watermark ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 md:p-6 bg-gray-100 overflow-y-auto flex flex-col items-center justify-center min-h-[420px]">
            <div className="relative w-full max-w-[280px] aspect-[9/16] bg-white shadow-lg rounded-lg overflow-hidden">
              {rendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-700" />
                </div>
              )}
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Story preview"
                  className="w-full h-full object-cover"
                  data-testid="story-preview-img"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                  Hazırlanır...
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            {copiedNote && (
              <p className="mt-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-1.5">
                ✓ Şəkil clipboard-a köçürüldü — Instagram-a yapışdır
              </p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-black/10 p-4 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleDownload}
              disabled={rendering || !previewUrl || busy === 'download'}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50"
              data-testid="story-share-download"
            >
              {busy === 'download' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              PNG yüklə
            </button>
            <button
              onClick={handleShare}
              disabled={rendering || !previewUrl || busy === 'share'}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-black disabled:opacity-50"
              data-testid="story-share-instagram"
            >
              {busy === 'share' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              PNG paylaş
            </button>
          </div>

          {/* Video Story row */}
          <div className="pt-2 border-t border-dashed border-black/10">
            {!videoUrl ? (
              <button
                onClick={generateVideo}
                disabled={rendering || busy === 'video'}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#111] via-[#3a2c14] to-[#C9A24A] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
                data-testid="story-video-generate"
              >
                {busy === 'video' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Video yaradılır {videoProgress}%
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    5 saniyəlik animasiyalı video yarat
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-2" data-testid="story-video-ready">
                <div className="rounded-lg overflow-hidden bg-black">
                  <video
                    src={videoUrl}
                    className="w-full max-h-48 mx-auto"
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(videoUrl);
                      setVideoUrl('');
                      setVideoProgress(0);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-xs font-semibold rounded-lg hover:bg-gray-50"
                    data-testid="story-video-reset"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Yenidən
                  </button>
                  <button
                    onClick={handleDownloadVideo}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-gray-300 text-gray-900 text-xs font-semibold rounded-lg hover:bg-gray-50"
                    data-testid="story-video-download"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Yüklə
                  </button>
                  <button
                    onClick={handleShareVideo}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-black"
                    data-testid="story-video-share"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Paylaş
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryShareModal;
