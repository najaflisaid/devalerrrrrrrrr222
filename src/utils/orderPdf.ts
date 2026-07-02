/**
 * orderPdf.ts — **TƏHVİL-TƏSLİM AKTI** (Azərbaycan dilində).
 *
 * Şrift: Noto Sans (TTF) → Azərbaycan əlifbası tam dəstəklənir.
 *
 * Layout (kompakt):
 *   • Hər səhifəyə təxminən 30–40 model sığır (image 20pt, row ~22pt)
 *   • Cədvəl avtomatik səhifələnir; başlıq hər səhifədə təkrarlanır
 *   • Footer (Təslim edən / Təslim alan) yalnız SON səhifədə render olunur
 *
 * Şəkillər fetch+blob ilə yüklənir → Firebase Storage CORS-ı düzgün
 * tətbiq olunsa belə canvas-taint xətası baş vermir, deməli bütün şəkillər
 * PDF-də tam görünür.
 *
 * MƏXFİ məlumatlar GÖSTƏRİLMİR: endirim, borc, ümumi məbləğ, ödəniş tarixi.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const LOGO_URL = 'https://i.hizliresim.com/tmu65g6.png';
const FONT_REGULAR_URL = '/fonts/NotoSans-Regular.ttf';
const FONT_BOLD_URL = '/fonts/NotoSans-Bold.ttf';
const FONT_NAME = 'NotoSans';

interface OrderItemLike {
  productId: string;
  productName: { az?: string; ru?: string; en?: string } | string;
  quantity: number;
  regularPrice?: number;
  salePrice?: number;
}

interface OrderLike {
  id: string;
  orderNumber?: number | string;
  customerName?: string;
  customerLastname?: string;
  companyName?: string;
  customerPhone?: string;
  createdAt?: any;
  items: OrderItemLike[];
}

interface ProductLike {
  id: string;
  name?: { az?: string; ru?: string; en?: string };
  brand?: string;
  images?: string[];
  sku?: string;
  barcode?: string;
  price?: number;
  salePrice?: number;
  b2bPrice?: number;
  b2bSalePrice?: number;
}

// ─── Font yükləmə (lazy, cache-li) ───
let _fontPromise: Promise<void> | null = null;
const arrayBufferToBase64 = (buf: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
};

const loadAzFonts = async (doc: jsPDF): Promise<void> => {
  if (!_fontPromise) {
    _fontPromise = (async () => {
      const [regResp, boldResp] = await Promise.all([fetch(FONT_REGULAR_URL), fetch(FONT_BOLD_URL)]);
      if (!regResp.ok || !boldResp.ok) {
        throw new Error('Font yüklənmədi: ' + regResp.status + '/' + boldResp.status);
      }
      const [regBuf, boldBuf] = await Promise.all([regResp.arrayBuffer(), boldResp.arrayBuffer()]);
      (window as any).__azFontReg = arrayBufferToBase64(regBuf);
      (window as any).__azFontBold = arrayBufferToBase64(boldBuf);
    })();
  }
  await _fontPromise;
  const reg = (window as any).__azFontReg as string;
  const bold = (window as any).__azFontBold as string;
  doc.addFileToVFS('NotoSans-Regular.ttf', reg);
  doc.addFileToVFS('NotoSans-Bold.ttf', bold);
  doc.addFont('NotoSans-Regular.ttf', FONT_NAME, 'normal');
  doc.addFont('NotoSans-Bold.ttf', FONT_NAME, 'bold');
};

const formatDate = (raw: any): string => {
  try {
    const d = raw?.toDate ? raw.toDate() : new Date(raw);
    if (!d || isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
};

/**
 * Şəkili PDF üçün resized PNG dataURL-ə çevirir.
 *
 * Strategiya:
 *   1) fetch(url, mode:'cors') ilə blob alırıq → CORS-friendly serverlər üçün
 *      (Firebase Storage, hizliresim, və.s. işləyir).
 *   2) blob → object URL → Image → canvas → toDataURL.
 *      Bu yol "tainted canvas" xətasından qaçır, çünki blob lokaldır.
 *   3) Uğursuz olsa, fallback: crossOrigin='anonymous' ilə Image yüklə.
 *   4) Hər ikisi alınmasa null qaytar → PDF-də boş hüceyrə.
 */
const loadImageAsDataUrl = async (url: string, maxSide = 64): Promise<{ dataUrl: string; w: number; h: number } | null> => {
  if (!url) return null;

  const resize = (img: HTMLImageElement): { dataUrl: string; w: number; h: number } | null => {
    try {
      const canvas = document.createElement('canvas');
      let w = img.naturalWidth || maxSide;
      let h = img.naturalHeight || maxSide;
      const ratio = Math.min(maxSide / w, maxSide / h, 1);
      w = Math.max(1, Math.round(w * ratio));
      h = Math.max(1, Math.round(h * ratio));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), w, h };
    } catch {
      return null;
    }
  };

  // Strategiya 1: fetch + blob (CORS-friendly)
  try {
    const resp = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' });
    if (resp.ok) {
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const result = await new Promise<{ dataUrl: string; w: number; h: number } | null>((resolve) => {
        const img = new Image();
        const cleanup = () => URL.revokeObjectURL(objectUrl);
        img.onload = () => { resolve(resize(img)); cleanup(); };
        img.onerror = () => { resolve(null); cleanup(); };
        img.src = objectUrl;
      });
      if (result) return result;
    }
  } catch {
    /* fetch fail — try fallback */
  }

  // Strategiya 2: crossOrigin attribute (image element)
  try {
    const result = await new Promise<{ dataUrl: string; w: number; h: number } | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(resize(img));
      img.onerror = () => resolve(null);
      img.src = url;
    });
    return result;
  } catch {
    return null;
  }
};

const resolveSalePrice = (item: OrderItemLike, p?: ProductLike): number => {
  if (typeof item.salePrice === 'number' && item.salePrice > 0) return item.salePrice;
  if (typeof item.regularPrice === 'number' && item.regularPrice > 0) return item.regularPrice;
  if (p) {
    if (typeof p.salePrice === 'number' && p.salePrice > 0) return p.salePrice;
    if (typeof p.price === 'number' && p.price > 0) return p.price;
  }
  return 0;
};

export const downloadOrderPdf = async (order: OrderLike, products: ProductLike[]): Promise<void> => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;

  // ─── Şrift ───
  try {
    await loadAzFonts(doc);
    doc.setFont(FONT_NAME, 'normal');
  } catch (err) {
    console.warn('AZ font load failed, fallback to helvetica:', err);
  }

  // ─── Loqo + başlıq ───
  // Loqo daha yüksək ölçüdə yüklənir ki, PDF-də piksel görünməsin
  const logo = await loadImageAsDataUrl(LOGO_URL, 320);
  if (logo) {
    const lw = 60;
    const lh = (logo.h * lw) / logo.w;
    try { doc.addImage(logo.dataUrl, 'JPEG', margin, 24, lw, lh); } catch { /* noop */ }
  }

  doc.setFont(FONT_NAME, 'bold');
  doc.setFontSize(14);
  doc.text('Təhvil-təslim aktı', pageWidth - margin, 50, { align: 'right' });

  // ─── Sifariş başlığı ───
  const headStartY = 90;
  const orderNumber =
    order.orderNumber !== undefined && order.orderNumber !== null
      ? `${order.orderNumber}`
      : `${(order.id || '').slice(0, 8)}`;
  const fullName = [order.customerName, order.customerLastname].filter(Boolean).join(' ').trim() || '-';
  const company = order.companyName && !String(order.companyName).includes('@') ? order.companyName : '';
  const phone = order.customerPhone && String(order.customerPhone).length < 30 ? order.customerPhone : '';

  doc.setFont(FONT_NAME, 'bold');
  doc.setFontSize(10);
  doc.text('Sifariş məlumatları', margin, headStartY);
  doc.setFont(FONT_NAME, 'normal');
  doc.setFontSize(9);
  const meta: Array<[string, string]> = [
    ['Sifariş №:', orderNumber],
    ['Tarix:', formatDate(order.createdAt) || '-'],
    ['Müştəri:', fullName],
  ];
  if (company) meta.push(['Şirkət:', company]);
  if (phone) meta.push(['Telefon:', phone]);

  let y = headStartY + 12;
  meta.forEach(([k, v]) => {
    doc.setTextColor(110);
    doc.text(k, margin, y);
    doc.setTextColor(20);
    doc.text(String(v), margin + 70, y);
    y += 12;
  });
  doc.setTextColor(0);

  // ─── Sifariş məhsulları — SƏKILSİZ (şəkillər çıxarıldı) ───
  const totalQty = (order.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const tableStartY = y + 6;

  // ─── Cədvəl sıraları ───
  const rows = (order.items || []).map((it, idx) => {
    const p = products.find((pp) => pp.id === it.productId);
    const nameAz =
      (typeof it.productName === 'object' ? it.productName?.az : it.productName) ||
      p?.name?.az || p?.name?.en || '-';
    const brand = p?.brand || '-';
    const barcode = p?.barcode || p?.sku || '-';
    const salePrice = resolveSalePrice(it, p);
    return {
      idx: idx + 1,
      name: String(nameAz),
      brand,
      barcode,
      qty: Number(it.quantity) || 0,
      price: salePrice,
    };
  });

  // ─── KOMPAKT CƏDVƏL — 40-a qədər sətir 1 səhifədə sığır ───
  // A4 hündürlüyü 842pt. Başlıq (~145pt) + footer (~150pt) + summary (~40pt) → ~505pt cədvələ qalır.
  // 40 sətir üçün row height ~12pt lazımdır.
  const ROW_HEIGHT = rows.length > 30 ? 12 : (rows.length > 20 ? 15 : 18);
  const FONT_SIZE = rows.length > 30 ? 7 : 7.5;

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Məhsul adı', 'Brend', 'Barkod', 'Miqdar', 'Vahid', 'Satış qiyməti']],
    body: rows.map((r) => [
      r.idx,
      r.name,
      r.brand,
      r.barcode,
      r.qty,
      'ədəd',
      r.price > 0 ? `${r.price.toFixed(2)} AZN` : '-',
    ]),
    styles: {
      font: FONT_NAME,
      fontSize: FONT_SIZE,
      cellPadding: 2,
      valign: 'middle',
      lineColor: [220, 220, 220],
      lineWidth: 0.4,
      minCellHeight: ROW_HEIGHT,
      overflow: 'linebreak',
    },
    headStyles: {
      font: FONT_NAME,
      fontStyle: 'bold',
      fontSize: FONT_SIZE + 0.5,
      fillColor: [33, 33, 33],
      textColor: 255,
      halign: 'center',
      minCellHeight: 14,
    },
    bodyStyles: { font: FONT_NAME, textColor: 30 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 22 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 68 },
      3: { cellWidth: 78, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 42, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 32 },
      6: { halign: 'right', cellWidth: 66, fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin, top: 30, bottom: 30 },
  });

  // ─── Yekun sayğacı ───
  const finalY = (doc as any).lastAutoTable?.finalY || tableStartY + 60;
  let summaryY = finalY + 18;

  // Əgər footer + summary aşağıya sığmırsa yeni səhifəyə keç
  const footerHeight = 130;
  if (summaryY + footerHeight > pageHeight - 20) {
    doc.addPage();
    summaryY = 60;
  }

  doc.setFont(FONT_NAME, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text(`Model sayı: ${rows.length}`, margin, summaryY);
  doc.text(`Ümumi miqdar: ${totalQty} ədəd`, margin, summaryY + 14);

  // ─── Footer: Təslim edən / Təslim alan (son səhifədə) ───
  const footerTop = Math.max(summaryY + 40, pageHeight - 140);
  const colWidth = (pageWidth - margin * 2 - 32) / 2;
  const leftX = margin;
  const rightX = margin + colWidth + 32;

  const drawSignatureBlock = (x: number, title: string) => {
    doc.setFont(FONT_NAME, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text(title, x, footerTop);

    doc.setFont(FONT_NAME, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text('Vəzifə:', x, footerTop + 18);
    doc.setDrawColor(180);
    doc.line(x + 38, footerTop + 19, x + colWidth, footerTop + 19);

    doc.text('Ad, Soyad:', x, footerTop + 36);
    doc.line(x + 52, footerTop + 37, x + colWidth, footerTop + 37);

    doc.text('İmza:', x, footerTop + 70);
    doc.line(x, footerTop + 72, x + colWidth, footerTop + 72);
  };

  drawSignatureBlock(leftX, 'Təslim edən');
  drawSignatureBlock(rightX, 'Təslim alan');

  // Səhifə nömrəsi
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont(FONT_NAME, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`${i} / ${totalPages}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
  }

  const safeOrderNo = String(orderNumber).replace(/[^a-zA-Z0-9_-]/g, '');
  doc.save(`tehvil-teslim-${safeOrderNo || 'sifaris'}.pdf`);
};
