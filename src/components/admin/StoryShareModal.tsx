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

type TemplateKey = 'minimal' | 'noir' | 'gold' | 'editorial' | 'pure' | 'silhouette';

interface TemplateDef {
  key: TemplateKey;
  label: string;
  swatch: string; // CSS gradient for preview chip
}

const TEMPLATES: TemplateDef[] = [
  { key: 'minimal', label: 'Minimal', swatch: 'linear-gradient(180deg,#ffffff 0%,#fbf8f4 45%,#f3ede4 75%,#ece3d6 100%)' },
  { key: 'pure', label: 'Pure', swatch: 'linear-gradient(180deg,#ffffff 0%,#faf7f1 60%,#f1ece2 100%)' },
  { key: 'silhouette', label: 'Silhouette', swatch: 'linear-gradient(180deg,#ffffff 0%,#f6f3ec 70%,#efe7da 100%)' },
  { key: 'editorial', label: 'Editorial', swatch: 'linear-gradient(180deg,#e9e5df 0%,#e9e5df 55%,#111 55%,#111 100%)' },
  { key: 'noir', label: 'Noir', swatch: 'linear-gradient(135deg,#0a0a0a,#1f1f1f)' },
  { key: 'gold', label: 'Gold', swatch: 'linear-gradient(135deg,#111,#3a2c14 60%,#c9a24a)' },
];

// Instagram Story canonical size
const W = 1080;
const H = 1920;

const formatAzn = (n: number, fixed = 2): string =>
  n.toLocaleString('az-AZ', { minimumFractionDigits: fixed, maximumFractionDigits: fixed });

// Cloudflare Worker URL — fallback proxy path
const IMG_PROXY_BASE =
  (import.meta as any).env?.VITE_R2_WORKER_URL ||
  'https://orange-cloud-4565.najaflisaid35.workers.dev';

/**
 * Robust image loader that survives CORS-unfriendly hosts.
 *
 * Strategy (tried in order — first non-null wins):
 *  1. Same-origin backend proxy `/api/img-proxy?url=...` — most reliable
 *     because it is same-origin and always returns permissive CORS headers.
 *  2. Direct `fetch()` → blob URL → <img>. Works when the origin returns
 *     CORS headers (Firebase Storage default, some R2 setups).
 *  3. `<img crossOrigin="anonymous">` fallback.
 *  4. Cloudflare Worker `/proxy?url=...` — for setups where the backend is
 *     not deployed yet.
 *
 * If ALL four fail we resolve with `null` so callers render a placeholder
 * instead of throwing.
 */
const loadImage = async (url: string): Promise<HTMLImageElement | null> => {
  if (!url) return null;

  const fromFetch = async (u: string, sameOrigin = false): Promise<HTMLImageElement | null> => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      // Same-origin fetches (backend proxy) don't need explicit CORS mode.
      // iOS Safari occasionally 500s on `credentials: 'omit'` for same-origin.
      const opts: RequestInit = sameOrigin
        ? { cache: 'default', signal: ctrl.signal }
        : { mode: 'cors', credentials: 'omit', signal: ctrl.signal };
      const res = await fetch(u, opts);
      clearTimeout(timer);
      if (!res.ok) return null;
      const blob = await res.blob();
      // iOS may return empty blob.type; accept as long as we got bytes back
      if (blob.size === 0) return null;
      const objectUrl = URL.createObjectURL(blob);
      return await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        const t = setTimeout(() => resolve(null), 8000);
        img.onload = () => { clearTimeout(t); resolve(img); };
        img.onerror = () => { clearTimeout(t); resolve(null); };
        img.src = objectUrl;
      });
    } catch {
      return null;
    }
  };

  const fromCrossOrigin = (u: string): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image();
      const t = setTimeout(() => resolve(null), 8000);
      img.crossOrigin = 'anonymous';
      img.onload = () => { clearTimeout(t); resolve(img); };
      img.onerror = () => { clearTimeout(t); resolve(null); };
      img.src = u;
    });

  // 1) Same-origin backend proxy (MOST RELIABLE — no CORS complications)
  const backendProxy = `/api/img-proxy?url=${encodeURIComponent(url)}`;
  const viaBackend = await fromFetch(backendProxy, true);
  if (viaBackend) return viaBackend;

  // 2) Direct fetch on the original URL
  const viaBlob = await fromFetch(url, false);
  if (viaBlob) return viaBlob;

  // 3) Classic Image with crossOrigin
  const viaImg = await fromCrossOrigin(url);
  if (viaImg) return viaImg;

  // 4) Cloudflare Worker proxy (fallback if backend not deployed)
  const proxyUrl = `${IMG_PROXY_BASE.replace(/\/$/, '')}/proxy?url=${encodeURIComponent(url)}`;
  const viaWorker = await fromFetch(proxyUrl, false);
  if (viaWorker) return viaWorker;
  return await fromCrossOrigin(proxyUrl);
};

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
  // Original URL (not the blob: URL that img.src becomes) — key for cache lookup
  const productImgSrcRef = useRef<string>('');
  // Track blob URL of current preview so we can revoke it on re-render
  const previewUrlRef = useRef<string>('');

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
      if (productImgSrcRef.current !== imageUrl) {
        const loaded = await loadImage(imageUrl);
        productImgRef.current = loaded;
        productImgSrcRef.current = imageUrl;
        // Clear or set error state based on actual load result
        setImgError(!loaded && !!imageUrl);
      }
      const productImg = productImgRef.current;

      drawTemplate(ctx, template, productImg);
      if (watermark) drawWatermark(ctx, template);

      // Convert to blob URL (much lighter than dataURL for large canvases on iOS)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png', 0.92);
      });
      if (blob) {
        // Revoke previous URL to free memory (iOS Safari is aggressive here)
        if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      }
    } finally {
      setRendering(false);
    }
  };

  /**
   * Elegant "DE VALEUR" wordmark in the bottom-left, mirroring the site's
   * two-font pairing: **Pinyon Script** for the signature diamond mark,
   * **Montserrat** for the letterform wordmark. Colour adapts to template.
   */
  const drawWatermark = (ctx: CanvasRenderingContext2D, tpl: TemplateKey) => {
    const isDark = tpl === 'noir' || tpl === 'gold';
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = isDark ? 0.6 : 0.5;
    ctx.fillStyle = isDark ? '#C9A24A' : '#111';

    // Pinyon Script diamond signature — soft, calligraphic
    ctx.font = '400 56px "Pinyon Script", "Great Vibes", cursive';
    ctx.fillText('D', 60, H - 60);

    // Wordmark in Montserrat
    ctx.font = '500 20px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('DE  VALEUR', 115, H - 72);

    // Tag in Montserrat light
    ctx.globalAlpha = isDark ? 0.4 : 0.32;
    ctx.font = '300 13px "Montserrat", Arial, sans-serif';
    ctx.fillText('Luxury  ·  since  2020', 115, H - 50);
    ctx.restore();
  };

  // Draw specific template (static, fully-rendered — used for preview PNG and
  // as base layer during video generation before animated overlays kick in).
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
      case 'pure':
        return drawPure(ctx, productImg);
      case 'silhouette':
        return drawSilhouette(ctx, productImg);
      case 'minimal':
      default:
        return drawMinimal(ctx, productImg);
    }
  };

  interface AnimHelpers {
    easeOut: (t: number) => number;
    easeInOut: (t: number) => number;
    easeElastic: (t: number) => number;
    range: (t: number, a: number, b: number) => number;
  }

  /**
   * Renders one animated frame:
   *  - base template as background
   *  - a "reveal ring" that scales out from the centre for the first 25%
   *  - a soft dark gradient breathing over the composition
   *  - a golden zoom-in on the product image area (via clip + transform)
   */
  const drawAnimatedTemplate = (
    ctx: CanvasRenderingContext2D,
    key: TemplateKey,
    productImg: HTMLImageElement | null,
    t: number,
    h: AnimHelpers
  ) => {
    // Ken-Burns-style subtle zoom on the whole composition
    const zoom = 1 + h.easeInOut(t) * 0.04; // 1.00 → 1.04
    const drift = h.easeInOut(t) * 20; // slow vertical drift
    ctx.save();
    ctx.translate(W / 2, H / 2 - drift);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
    drawTemplate(ctx, key, productImg);
    ctx.restore();

    // Central iris reveal for the first 25% (from center outward)
    if (t < 0.25) {
      const p = h.easeOut(h.range(t, 0, 0.25));
      const bg = key === 'noir' || key === 'gold' ? '#000' : '#faf8f4';
      const maxR = Math.hypot(W, H) / 2;
      const radius = maxR * p;
      ctx.save();
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(W / 2, H / 2, radius, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill('evenodd');
      ctx.restore();
    }

    // Soft breathing dark vignette (very subtle) — adds cinematic feel
    const breathe = 0.05 + Math.sin(t * Math.PI * 2) * 0.03;
    const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.9);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${breathe.toFixed(3)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
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
    ctx.font = '400 26px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    ctx.letterSpacing = '4px' as any;
    ctx.fillText('DEVALEUR.AZ', W / 2, H - 70);
  };

  // ─── Template: Minimal (clean, white → soft tint, editorial) ───
  const drawMinimal = (
    ctx: CanvasRenderingContext2D,
    productImg: HTMLImageElement | null
  ) => {
    // Smooth vertical gradient — pure white at top, gently melting into a soft
    // warm tint towards the bottom. Extra stops keep the transition seamless
    // (no visible banding / hard colour break).
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#fbf8f4');
    g.addColorStop(0.75, '#f3ede4');
    g.addColorStop(1, '#ece3d6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Brand — top, widely tracked
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '8px' as any;
    ctx.font = '500 34px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText((brand || 'DE VALEUR').toUpperCase(), W / 2, 175);
    ctx.letterSpacing = '0px' as any;

    // Thin hairline divider
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 44, 215);
    ctx.lineTo(W / 2 + 44, 215);
    ctx.stroke();

    // Product image — large, floating with a soft natural shadow (no boxed card)
    ctx.save();
    ctx.shadowColor = 'rgba(60,45,25,0.18)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 34;
    drawProductImage(ctx, productImg, { x: 140, y: 300, w: W - 280, h: 900 });
    ctx.restore();

    // Product name (max 2 lines)
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.font = '400 52px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    const nameLines = wrapText(ctx, productName, W - 200, 2);
    let ny = 1300;
    nameLines.forEach((ln) => {
      ctx.fillText(ln, W / 2, ny);
      ny += 64;
    });

    // Old price (strikethrough) if on sale
    if (originalPrice && originalPrice > price) {
      ctx.font = '400 30px "Montserrat", "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      const oldText = `${formatAzn(originalPrice, 0)} AZN`;
      ctx.fillText(oldText, W / 2, ny + 38);
      const m = ctx.measureText(oldText);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 - m.width / 2 - 8, ny + 30);
      ctx.lineTo(W / 2 + m.width / 2 + 8, ny + 30);
      ctx.stroke();
      ny += 56;
    }

    // Price — the hero number
    ctx.fillStyle = '#0f0f0f';
    ctx.font = '600 100px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(`${formatAzn(price, 0)} AZN`, W / 2, ny + 128);

    // Credit — minimal single line with a subtle gold accent (no heavy pill)
    if (monthlyForSix != null && sixMonthRate) {
      const cy = ny + 210;
      ctx.fillStyle = '#9a7b32';
      ctx.font = '500 22px "Montserrat", "Helvetica Neue", Arial, sans-serif';
      ctx.letterSpacing = '2px' as any;
      const label = `${sixMonthRate.months} AY KREDİT${sixMonthRate.percent > 0 ? ` · ${sixMonthRate.percent}%` : ' · FAİZSİZ'}`;
      ctx.fillText(label, W / 2, cy);
      ctx.letterSpacing = '0px' as any;

      ctx.fillStyle = '#1a1a1a';
      ctx.font = '500 46px "Montserrat", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(`${formatAzn(monthlyForSix)} AZN / ay`, W / 2, cy + 62);

      // slim gold underline centred below
      const uw = 120;
      ctx.strokeStyle = 'rgba(201,162,74,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 - uw / 2, cy + 92);
      ctx.lineTo(W / 2 + uw / 2, cy + 92);
      ctx.stroke();
    }

    drawSiteFooter(ctx, 'rgba(0,0,0,0.5)');
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
    ctx.font = '500 32px "Montserrat", "Helvetica Neue", Arial, sans-serif';
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
    ctx.font = '400 56px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    const nameLines = wrapText(ctx, productName, W - 200, 2);
    let ny = 1280;
    nameLines.forEach((ln) => {
      ctx.fillText(ln, W / 2, ny);
      ny += 66;
    });

    // Old price
    if (originalPrice && originalPrice > price) {
      ctx.font = '400 30px "Montserrat", "Helvetica Neue", Arial, sans-serif';
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
    ctx.font = '600 100px "Montserrat", "Helvetica Neue", Arial, sans-serif';
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
      ctx.font = '500 24px "Montserrat", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(
        `${sixMonthRate.months} AY KREDİT${sixMonthRate.percent > 0 ? ` · ${sixMonthRate.percent}%` : ' · FAİZSİZ'}`,
        W / 2,
        boxY + 58
      );
      ctx.fillStyle = '#f5f2ea';
      ctx.font = '600 62px "Montserrat", "Helvetica Neue", Arial, sans-serif';
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
    ctx.font = '700 42px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText((brand || 'DE VALEUR').toUpperCase(), W / 2, 100);

    // Product image
    ctx.fillStyle = '#faf7f0';
    ctx.fillRect(80, 280, W - 160, 900);
    drawProductImage(ctx, productImg, { x: 110, y: 310, w: W - 220, h: 840 });

    // Name
    ctx.fillStyle = '#f5e7c1';
    ctx.textAlign = 'center';
    ctx.font = '400 52px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    const nameLines = wrapText(ctx, productName, W - 200, 2);
    let ny = 1260;
    nameLines.forEach((ln) => {
      ctx.fillText(ln, W / 2, ny);
      ny += 64;
    });

    // Old price
    if (originalPrice && originalPrice > price) {
      ctx.font = '400 28px "Montserrat", "Helvetica Neue", Arial, sans-serif';
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
    ctx.font = '700 108px "Montserrat", "Helvetica Neue", Arial, sans-serif';
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
      ctx.font = '600 26px "Montserrat", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(
        `${sixMonthRate.months} AY KREDİT${sixMonthRate.percent > 0 ? ` · ${sixMonthRate.percent}%` : ' · 0% FAİZ'}`,
        W / 2,
        boxY + 55
      );
      ctx.font = '700 62px "Montserrat", "Helvetica Neue", Arial, sans-serif';
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
    ctx.font = '500 30px "Montserrat", "Helvetica Neue", Arial, sans-serif';
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
    ctx.font = '400 50px "Montserrat", "Helvetica Neue", Arial, sans-serif';
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
    ctx.font = '400 22px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('QİYMƏT', 90, colY);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 78px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(`${formatAzn(price, 0)} AZN`, 90, colY + 80);
    if (originalPrice && originalPrice > price) {
      ctx.font = '400 24px "Montserrat", "Helvetica Neue", Arial, sans-serif';
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
      ctx.font = '400 22px "Montserrat", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(
        `${sixMonthRate.months} AY${sixMonthRate.percent > 0 ? ` · ${sixMonthRate.percent}%` : ' · 0%'}`,
        W - 90,
        colY
      );
      ctx.fillStyle = '#C9A24A';
      ctx.font = '600 60px "Montserrat", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(`${formatAzn(monthlyForSix)} AZN`, W - 90, colY + 80);
      ctx.fillStyle = 'rgba(245,242,234,0.75)';
      ctx.font = '400 22px "Montserrat", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText('aylıq ödəniş', W - 90, colY + 118);
      ctx.textAlign = 'center';
    }

    drawSiteFooter(ctx, 'rgba(245,242,234,0.55)');
  };

  // ─── Template: Pure (huge image, minimal text strip at bottom) ───
  // Product image dominates ~74% of the canvas. The bottom 26% carries a
  // small dark info strip with brand + name + price + monthly, all in tiny,
  // widely-spaced Montserrat. Zero decorative shapes — pure white space.
  const drawPure = (
    ctx: CanvasRenderingContext2D,
    productImg: HTMLImageElement | null
  ) => {
    // Off-white paper — smooth white → soft tint (no hard colour break)
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.6, '#faf7f1');
    bg.addColorStop(1, '#f1ece2');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── PRODUCT IMAGE — huge, near-full width ──
    const imgBox = { x: 40, y: 90, w: W - 80, h: 1330 };
    drawProductImage(ctx, productImg, imgBox);

    // Thin bottom divider hairline
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 1470);
    ctx.lineTo(W - 80, 1470);
    ctx.stroke();

    // ── BOTTOM INFO STRIP (tiny, minimal) ──
    // Brand mark (Pinyon Script D + Montserrat wordmark, centered)
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.font = '400 42px "Pinyon Script", cursive';
    ctx.fillText('D', W / 2 - 62, 1540);
    ctx.font = '500 18px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText((brand || 'DE VALEUR').toUpperCase(), W / 2 + 10, 1535);

    // Product name — small serif-free line
    ctx.font = '400 26px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#111';
    const nameLines = wrapText(ctx, productName, W - 200, 2);
    let ny = 1610;
    nameLines.forEach((ln) => {
      ctx.fillText(ln, W / 2, ny);
      ny += 34;
    });

    // Divider dot
    ctx.beginPath();
    ctx.arc(W / 2, ny + 20, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ny += 60;

    // Price — modest, not shouted
    ctx.fillStyle = '#111';
    ctx.font = '500 44px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(`${formatAzn(price, 0)} AZN`, W / 2, ny);

    if (originalPrice && originalPrice > price) {
      ctx.font = '400 20px "Montserrat", Arial, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      const oldText = `${formatAzn(originalPrice, 0)} AZN`;
      ctx.fillText(oldText, W / 2, ny + 32);
      const m = ctx.measureText(oldText);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W / 2 - m.width / 2 - 4, ny + 25);
      ctx.lineTo(W / 2 + m.width / 2 + 4, ny + 25);
      ctx.stroke();
    }

    // Credit — tiny line under price
    if (monthlyForSix != null && sixMonthRate) {
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.font = '400 18px "Montserrat", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(
        `${sixMonthRate.months} ay kreditlə  ·  ${formatAzn(monthlyForSix)} AZN / ay`,
        W / 2,
        ny + (originalPrice && originalPrice > price ? 78 : 46)
      );
    }

    drawSiteFooter(ctx, 'rgba(0,0,0,0.4)');
  };

  // ─── Template: Silhouette (dominant image, single-line bottom rail) ───
  // Even more minimal than Pure. The image fills 78% of the canvas on a warm
  // beige backdrop. Bottom 22% has a single centered rail: brand mark → name
  // → price → aylıq, all in one horizontal composition with generous spacing.
  const drawSilhouette = (
    ctx: CanvasRenderingContext2D,
    productImg: HTMLImageElement | null
  ) => {
    // Full-height smooth gradient — white melting into a soft warm beige.
    // No hard split; the transition is imperceptible.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#faf7f0');
    g.addColorStop(0.8, '#f3ece0');
    g.addColorStop(1, '#e9dfce');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // ── PRODUCT IMAGE — dominant, with a soft natural shadow ──
    ctx.save();
    ctx.shadowColor = 'rgba(60,45,25,0.16)';
    ctx.shadowBlur = 55;
    ctx.shadowOffsetY = 30;
    const imgBox = { x: 40, y: 70, w: W - 80, h: 1360 };
    drawProductImage(ctx, productImg, imgBox);
    ctx.restore();

    // Tiny top brand — whispered in the corner
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.letterSpacing = '3px' as any;
    ctx.font = '500 18px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText((brand || 'DE VALEUR').toUpperCase(), 60, 90);
    ctx.letterSpacing = '0px' as any;
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.font = '400 32px "Pinyon Script", cursive';
    ctx.fillText('by DE Valeur', 60, 132);

    // ── BOTTOM RAIL — elegant centred block on the soft tint (dark text) ──
    const railCenterY = 1620;

    // Product name — small caps
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20,20,20,0.92)';
    ctx.letterSpacing = '1px' as any;
    ctx.font = '500 26px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    const nameLine = productName.length > 34 ? productName.slice(0, 33) + '…' : productName;
    ctx.fillText(nameLine, W / 2, railCenterY - 55);
    ctx.letterSpacing = '0px' as any;

    // Thin gold hairline
    ctx.strokeStyle = 'rgba(201,162,74,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 40, railCenterY - 28);
    ctx.lineTo(W / 2 + 40, railCenterY - 28);
    ctx.stroke();

    // Whispered price
    ctx.fillStyle = '#0f0f0f';
    ctx.font = '600 74px "Montserrat", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(`${formatAzn(price, 0)} AZN`, W / 2, railCenterY + 40);

    if (originalPrice && originalPrice > price) {
      ctx.font = '400 24px "Montserrat", "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      const oldText = `${formatAzn(originalPrice, 0)} AZN`;
      ctx.fillText(oldText, W / 2, railCenterY + 78);
      const m = ctx.measureText(oldText);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W / 2 - m.width / 2 - 4, railCenterY + 70);
      ctx.lineTo(W / 2 + m.width / 2 + 4, railCenterY + 70);
      ctx.stroke();
    }

    if (monthlyForSix != null && sixMonthRate) {
      ctx.fillStyle = 'rgba(154,123,50,0.95)';
      ctx.font = '500 22px "Montserrat", "Helvetica Neue", Arial, sans-serif';
      const suffix = sixMonthRate.percent > 0 ? ` · ${sixMonthRate.percent}%` : '  ·  faizsiz';
      ctx.fillText(
        `${sixMonthRate.months} ay${suffix}   ·   ${formatAzn(monthlyForSix)} AZN / ay`,
        W / 2,
        railCenterY + (originalPrice && originalPrice > price ? 118 : 92)
      );
    }

    drawSiteFooter(ctx, 'rgba(0,0,0,0.4)');
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
   * Renders a 5-second premium animation on the canvas and records it via
   * MediaRecorder → MP4/WebM blob for Instagram Story.
   *
   * Timeline (t in 0..1):
   *   0.00 – 0.20  reveal curtain slides open
   *   0.05 – 0.35  product image zooms from 0.82 → 1.00 with fade in
   *   0.15 – 0.40  brand name slides in from top + letter-tracking
   *   0.30 – 0.55  product name slides up from below + fade in
   *   0.40 – 0.75  price COUNTS UP from 0 → final value (elastic)
   *   0.55 – 0.75  old price + strike animates in
   *   0.65 – 0.90  credit block scales from 0 with gold border pulse
   *   0.30 → end   floating gold sparkle particles rising slowly
   *   0.55 → end   gold shimmer band sweeps continuously across price
   *   0.92 – 1.00  subtle final "seal" pulse over watermark
   */
  const generateVideo = async () => {
    if (!canvasRef.current) return;
    setBusy('video');
    setVideoProgress(0);
    setVideoUrl('');

    try {
      // Preload product image
      let productImg: HTMLImageElement | null = productImgRef.current;
      if (productImgSrcRef.current !== imageUrl) {
        productImg = await loadImage(imageUrl);
        productImgRef.current = productImg;
        productImgSrcRef.current = imageUrl;
        setImgError(!productImg && !!imageUrl);
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
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
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
      const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      const easeElastic = (t: number) => {
        if (t === 0 || t === 1) return t;
        const c4 = (2 * Math.PI) / 3;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
      };

      // Range helper: maps global t → local 0..1 for a window
      const range = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

      // Persistent sparkle particles (rising gold flecks)
      const sparkles: Array<{ x: number; y: number; s: number; sp: number; ph: number }> = [];
      for (let i = 0; i < 22; i++) {
        sparkles.push({
          x: Math.random() * W,
          y: H + Math.random() * 400,
          s: 2 + Math.random() * 4,
          sp: 60 + Math.random() * 140,
          ph: Math.random() * Math.PI * 2,
        });
      }

      const drawSparkles = (ctx: CanvasRenderingContext2D, tSec: number, alpha = 1) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of sparkles) {
          const y = ((p.y - p.sp * tSec) % (H + 400)) - 200;
          const twinkle = 0.4 + Math.sin(tSec * 4 + p.ph) * 0.35;
          ctx.globalAlpha = alpha * twinkle;
          // gold dot with halo
          const halo = ctx.createRadialGradient(p.x, y, 0, p.x, y, p.s * 5);
          halo.addColorStop(0, 'rgba(201,162,74,0.95)');
          halo.addColorStop(0.5, 'rgba(201,162,74,0.25)');
          halo.addColorStop(1, 'rgba(201,162,74,0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(p.x, y, p.s * 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff8e2';
          ctx.beginPath();
          ctx.arc(p.x, y, p.s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      };

      /**
       * Draw one animated frame. `t` is 0..1 across the 5-second timeline.
       */
      const drawFrame = (t: number, tSec: number) => {
        // Base fill first (avoid template drawing since we want fully-animated layout)
        drawAnimatedTemplate(ctx, template, productImg, t, {
          easeOut,
          easeInOut,
          easeElastic,
          range,
        });

        // Sparkles (from 0.3 onwards) — layered over content
        if (t > 0.3) {
          drawSparkles(ctx, tSec, easeOut(range(t, 0.3, 0.55)));
        }

        // Continuous shimmer band across price/credit region (from 0.55)
        if (t > 0.55) {
          const st = ((t - 0.55) / 0.35) % 1; // 0..1 loop every ~1.75s
          const bandCenter = W * st;
          const grad = ctx.createLinearGradient(bandCenter - 320, 0, bandCenter + 320, 0);
          grad.addColorStop(0, 'rgba(255,220,140,0)');
          grad.addColorStop(0.5, 'rgba(255,220,140,0.32)');
          grad.addColorStop(1, 'rgba(255,220,140,0)');
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = grad;
          ctx.fillRect(0, H * 0.55, W, H * 0.35);
          ctx.restore();
        }

        // Watermark (with subtle pulse at the very end)
        if (watermark) {
          if (t > 0.92) {
            const p = range(t, 0.92, 1);
            const s = 1 + Math.sin(p * Math.PI) * 0.06;
            ctx.save();
            ctx.translate(105, H - 60);
            ctx.scale(s, s);
            ctx.translate(-105, -(H - 60));
            drawWatermark(ctx, template);
            ctx.restore();
          } else {
            drawWatermark(ctx, template);
          }
        }

        // Reveal curtain handled inside drawAnimatedTemplate (iris from center)
      };

      const loop = () => {
        if (stopped) return;
        const elapsed = performance.now() - startAt;
        const t = clamp(elapsed / durationMs);
        const tSec = elapsed / 1000;
        drawFrame(t, tSec);
        setVideoProgress(Math.round(t * 100));
        if (elapsed < durationMs) {
          requestAnimationFrame(loop);
        }
      };

      recorder.start(200);
      loop();

      await new Promise<void>((r) => setTimeout(r, durationMs + 150));
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

  // Cleanup video + preview blob URLs when modal closes / component unmounts
  useEffect(() => {
    if (!open) {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl('');
        setVideoProgress(0);
      }
      if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = '';
      }
      setPreviewUrl('');
      // Reset image cache so next open always fetches fresh (in case URL changed)
      productImgSrcRef.current = '';
      productImgRef.current = null;
      setImgError(false);
    }
  }, [open, videoUrl]);

  if (!open) return null;

  // Detect environments where Web Share w/ files is missing (mobile Safari
  // ≤ 14 or Instagram in-app browser) so we can hide/adjust buttons if needed.
  const canWebShareFiles = typeof navigator !== 'undefined' &&
    (navigator as any).canShare &&
    (() => {
      try {
        return (navigator as any).canShare({
          files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })],
        });
      } catch {
        return false;
      }
    })();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
      onClick={onClose}
      data-testid="story-share-modal"
    >
      <div
        className="relative bg-white w-full max-w-3xl sm:rounded-2xl shadow-2xl overflow-hidden h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header — sticky at top */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-black/10 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-[14px] sm:text-[15px] font-semibold text-gray-900 truncate">
              Instagram Story üçün paylaş
            </h3>
            <p className="text-[11px] text-gray-500 hidden sm:block">
              1080 × 1920 — şablon seç, yüklə və ya birbaşa paylaş
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 hover:bg-black/5 active:bg-black/10 rounded-lg flex-shrink-0"
            data-testid="story-share-close"
            aria-label="Bağla"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — mobile: stacked (preview → templates → info) / desktop: sidebar+preview */}
        <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[280px_1fr] md:gap-0 overflow-y-auto md:overflow-hidden">
          {/* Preview — ALWAYS FIRST on mobile so user sees the result immediately */}
          <div className="order-1 md:order-2 md:col-start-2 p-3 sm:p-4 md:p-6 bg-gray-50 md:overflow-y-auto flex flex-col items-center justify-start md:justify-center flex-shrink-0">
            <div className="relative w-[45vw] max-w-[220px] md:w-full md:max-w-[280px] aspect-[9/16] bg-white shadow-lg rounded-lg overflow-hidden">
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
              <p className="mt-3 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-1.5 text-center">
                ✓ Şəkil clipboard-a köçürüldü — Instagram-a yapışdır
              </p>
            )}
            {imgError && (
              <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-start gap-1.5 md:hidden">
                <ImageOff className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                Şəkil yüklənmədi — şəkilsiz şablon istifadə olunur.
              </p>
            )}
          </div>

          {/* Templates + Info panel (sidebar on desktop, second block on mobile) */}
          <div className="order-2 md:order-1 md:col-start-1 md:row-start-1 border-t md:border-t-0 md:border-r border-black/10 p-3 sm:p-4 space-y-3 md:overflow-y-auto">
            {/* Templates — horizontal scroll on mobile, 2-col grid on desktop */}
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden md:block">
              Şablon
            </p>
            <div className="flex md:grid md:grid-cols-2 gap-2 overflow-x-auto md:overflow-visible -mx-3 sm:-mx-4 md:mx-0 px-3 sm:px-4 md:px-0 snap-x scrollbar-thin">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTemplate(t.key)}
                  className={`group relative rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 w-[80px] md:w-auto snap-start ${
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
                  <div className="absolute inset-x-0 bottom-0 bg-white/90 px-1 py-0.5 md:px-2 md:py-1 text-[10px] md:text-[11px] font-medium text-gray-900 text-center">
                    {t.label}
                  </div>
                  {template === t.key && (
                    <div className="absolute top-1 right-1 md:top-1.5 md:right-1.5 w-4 h-4 md:w-5 md:h-5 bg-gray-900 text-white rounded-full flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 md:h-3 md:w-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Info — hidden on mobile to save room (preview shows all this visually) */}
            <div className="pt-3 mt-1 border-t border-black/10 space-y-1 hidden md:block">
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

            {/* Watermark toggle — visible on all screens */}
            <div className="pt-3 border-t border-black/10">
              <label
                className="flex items-center justify-between gap-2 cursor-pointer select-none"
                data-testid="story-watermark-toggle-wrap"
              >
                <div className="min-w-0">
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
        </div>

        {/* Footer actions — sticky at bottom */}
        <div className="border-t border-black/10 p-3 sm:p-4 space-y-2 flex-shrink-0 bg-white">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownload}
              disabled={rendering || !previewUrl || busy === 'download'}
              className="inline-flex items-center justify-center gap-2 px-3 py-3 bg-white border border-gray-300 text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 min-h-[44px]"
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
              className="inline-flex items-center justify-center gap-2 px-3 py-3 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-black active:bg-black disabled:opacity-50 min-h-[44px]"
              data-testid="story-share-instagram"
            >
              {busy === 'share' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {canWebShareFiles ? 'PNG paylaş' : 'PNG kopyala'}
            </button>
          </div>

          {/* Video Story row */}
          <div className="pt-2 border-t border-dashed border-black/10">
            {!videoUrl ? (
              <button
                onClick={generateVideo}
                disabled={rendering || busy === 'video'}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#111] via-[#3a2c14] to-[#C9A24A] text-white text-sm font-semibold rounded-lg hover:opacity-90 active:opacity-80 disabled:opacity-50 min-h-[44px]"
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
                    <span className="truncate">5 saniyəlik animasiyalı video</span>
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
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(videoUrl);
                      setVideoUrl('');
                      setVideoProgress(0);
                    }}
                    className="inline-flex items-center justify-center gap-1 px-2 py-2.5 bg-white border border-gray-300 text-gray-900 text-xs font-semibold rounded-lg active:bg-gray-100 min-h-[44px]"
                    data-testid="story-video-reset"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Yenidən
                  </button>
                  <button
                    onClick={handleDownloadVideo}
                    className="inline-flex items-center justify-center gap-1 px-2 py-2.5 bg-white border border-gray-300 text-gray-900 text-xs font-semibold rounded-lg active:bg-gray-100 min-h-[44px]"
                    data-testid="story-video-download"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Yüklə
                  </button>
                  <button
                    onClick={handleShareVideo}
                    className="inline-flex items-center justify-center gap-1 px-2 py-2.5 bg-gray-900 text-white text-xs font-semibold rounded-lg active:bg-black min-h-[44px]"
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
