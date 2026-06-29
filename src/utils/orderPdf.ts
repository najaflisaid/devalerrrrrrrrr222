/**
 * orderPdf.ts — B2B sifariş üçün **TƏHVİL-TƏSLİM AKTI** (Azərbaycan dilində).
 *
 * Şrift: Noto Sans (TTF, `/fonts/NotoSans-Regular.ttf` + `/fonts/NotoSans-Bold.ttf`)
 *   → Azərbaycan əlifbası (ə, ş, ç, ğ, ı, ö, ü) tam dəstəklənir.
 *
 * MƏXFİ məlumatlar GÖSTƏRİLMİR: endirim, borc, ümumi məbləğ, ödəniş tarixi.
 * Yalnız operativ məlumat: məhsul şəkli, ad, brend, barkod, miqdar, vahid, satış qiyməti.
 *
 * Footer: "Təslim edən" + "Təslim alan" — hər ikisi üçün Vəzifə və Ad/Soyad sahələri ilə.
 */
import jsPDF from 'jspdf';
import autoTable, { CellHookData } from 'jspdf-autotable';

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
      const [regResp, boldResp] = await Promise.all([
        fetch(FONT_REGULAR_URL),
        fetch(FONT_BOLD_URL),
      ]);
      if (!regResp.ok || !boldResp.ok) {
        throw new Error('Font yüklənmədi: ' + regResp.status + '/' + boldResp.status);
      }
      const [regBuf, boldBuf] = await Promise.all([
        regResp.arrayBuffer(),
        boldResp.arrayBuffer(),
      ]);
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

const loadImageAsDataUrl = (url: string): Promise<{ dataUrl: string; w: number; h: number } | null> =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const max = 110;
        let w = img.naturalWidth || 100;
        let h = img.naturalHeight || 100;
        const ratio = Math.min(max / w, max / h, 1);
        w = Math.max(1, Math.round(w * ratio));
        h = Math.max(1, Math.round(h * ratio));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL('image/png'), w, h });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

/** Məhsul üçün "Satış qiyməti" — endirimli qiymət varsa onu, yoxsa adi qiyməti qaytarır. */
const resolveSalePrice = (item: OrderItemLike, p?: ProductLike): number => {
  if (typeof item.salePrice === 'number' && item.salePrice > 0) return item.salePrice;
  if (typeof item.regularPrice === 'number' && item.regularPrice > 0) return item.regularPrice;
  if (p) {
    if (typeof p.salePrice === 'number' && p.salePrice > 0) return p.salePrice;
    if (typeof p.price === 'number' && p.price > 0) return p.price;
  }
  return 0;
};

/**
 * downloadOrderPdf — Təhvil-təslim aktı PDF-i.
 * MƏXFİ olmayan satış qiyməti göstərilir; endirim/borc/total YOXDUR.
 */
export const downloadOrderPdf = async (
  order: OrderLike,
  products: ProductLike[]
): Promise<void> => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;

  // ─── Şrifti yüklə (Azərbaycan əlifbası dəstəyi) ───
  try {
    await loadAzFonts(doc);
    doc.setFont(FONT_NAME, 'normal');
  } catch (err) {
    console.warn('AZ font load failed, fallback to helvetica:', err);
    // fallback helvetica — diakritiklər itə bilər, amma minimal işləklik qalır
  }

  // ─── Loqo + başlıq ───
  const logo = await loadImageAsDataUrl(LOGO_URL);
  if (logo) {
    const lw = 70;
    const lh = (logo.h * lw) / logo.w;
    try {
      doc.addImage(logo.dataUrl, 'PNG', margin, 30, lw, lh);
    } catch {
      /* noop */
    }
  }

  doc.setFont(FONT_NAME, 'bold');
  doc.setFontSize(15);
  doc.text('Təhvil-təslim aktı', pageWidth - margin, 56, { align: 'right' });

  // ─── Sifariş başlığı ───
  const headStartY = 110;
  const orderNumber =
    order.orderNumber !== undefined && order.orderNumber !== null
      ? `#${order.orderNumber}`
      : `#${(order.id || '').slice(0, 8)}`;

  const fullName = [order.customerName, order.customerLastname].filter(Boolean).join(' ').trim() || '-';
  const company = order.companyName && !String(order.companyName).includes('@') ? order.companyName : '';
  const phone = order.customerPhone && String(order.customerPhone).length < 30 ? order.customerPhone : '';

  doc.setFont(FONT_NAME, 'bold');
  doc.setFontSize(11);
  doc.text('Sifariş məlumatları', margin, headStartY);
  doc.setFont(FONT_NAME, 'normal');
  doc.setFontSize(10);

  const meta: Array<[string, string]> = [
    ['Sifariş №:', orderNumber],
    ['Tarix:', formatDate(order.createdAt) || '-'],
    ['Müştəri:', fullName],
  ];
  if (company) meta.push(['Şirkət:', company]);
  if (phone) meta.push(['Telefon:', phone]);

  let y = headStartY + 14;
  meta.forEach(([k, v]) => {
    doc.setTextColor(110);
    doc.text(k, margin, y);
    doc.setTextColor(20);
    doc.text(String(v), margin + 80, y);
    y += 14;
  });
  doc.setTextColor(0);

  // ─── Şəkilləri əvvəlcədən yüklə ───
  const totalQty = (order.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const tableStartY = y + 8;

  const imageData = await Promise.all(
    (order.items || []).map(async (it) => {
      const p = products.find((pp) => pp.id === it.productId);
      const url = p?.images?.[0] || '';
      return await loadImageAsDataUrl(url);
    })
  );

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
      img: imageData[idx],
      name: String(nameAz),
      brand,
      barcode,
      qty: Number(it.quantity) || 0,
      price: salePrice,
    };
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Şəkil', 'Məhsul adı', 'Brend', 'Barkod', 'Miqdar', 'Vahid', 'Satış qiyməti']],
    body: rows.map((r) => [
      r.idx,
      '',
      r.name,
      r.brand,
      r.barcode,
      r.qty,
      'ədəd',
      r.price > 0 ? `${r.price.toFixed(2)} AZN` : '-',
    ]),
    styles: {
      font: FONT_NAME,
      fontSize: 9,
      cellPadding: 6,
      valign: 'middle',
      lineColor: [220, 220, 220],
      lineWidth: 0.5,
    },
    headStyles: {
      font: FONT_NAME,
      fontStyle: 'bold',
      fillColor: [33, 33, 33],
      textColor: 255,
      halign: 'center',
    },
    bodyStyles: {
      font: FONT_NAME,
      textColor: 30,
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 22 },
      1: { halign: 'center', cellWidth: 54, minCellHeight: 54 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 70 },
      4: { cellWidth: 82, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 42, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 36 },
      7: { halign: 'right', cellWidth: 70, fontStyle: 'bold' },
    },
    didDrawCell: (data: CellHookData) => {
      if (data.section === 'body' && data.column.index === 1) {
        const r = rows[data.row.index];
        if (r?.img) {
          const cell = data.cell;
          const maxSide = Math.min(cell.width, cell.height) - 6;
          const ratio = r.img.w / r.img.h;
          let finalW: number, finalH: number;
          if (ratio >= 1) {
            finalW = maxSide;
            finalH = maxSide / ratio;
          } else {
            finalH = maxSide;
            finalW = maxSide * ratio;
          }
          const x = cell.x + (cell.width - finalW) / 2;
          const yy = cell.y + (cell.height - finalH) / 2;
          try {
            doc.addImage(r.img.dataUrl, 'PNG', x, yy, finalW, finalH);
          } catch {
            /* noop */
          }
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  // ─── Yekun (yalnız sayğac — borc/endirim YOXDUR) ───
  const finalY = (doc as any).lastAutoTable?.finalY || tableStartY + 80;
  doc.setFont(FONT_NAME, 'bold');
  doc.setFontSize(10);
  doc.text(`Model sayı: ${rows.length}`, margin, finalY + 22);
  doc.text(`Ümumi miqdar: ${totalQty} ədəd`, margin, finalY + 38);

  // ─── Footer: Təslim edən / Təslim alan ───
  // İki sütun, hər birində: "Vəzifə:" + "Ad, Soyad:" + imza xətti
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerTop = Math.max(finalY + 70, pageHeight - 170);
  const colWidth = (pageWidth - margin * 2 - 40) / 2;
  const leftX = margin;
  const rightX = margin + colWidth + 40;

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

    doc.text('Ad, Soyad:', x, footerTop + 38);
    doc.line(x + 52, footerTop + 39, x + colWidth, footerTop + 39);

    doc.text('İmza:', x, footerTop + 78);
    doc.line(x, footerTop + 80, x + colWidth, footerTop + 80);
  };

  drawSignatureBlock(leftX, 'Təslim edən');
  drawSignatureBlock(rightX, 'Təslim alan');

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    'De Valeur — bu sənəd təhvil-təslim aktıdır.',
    pageWidth / 2,
    pageHeight - 24,
    { align: 'center' }
  );

  const safeOrderNo = String(orderNumber).replace(/[^a-zA-Z0-9_-]/g, '');
  doc.save(`tehvil-teslim-${safeOrderNo || 'sifaris'}.pdf`);
};
