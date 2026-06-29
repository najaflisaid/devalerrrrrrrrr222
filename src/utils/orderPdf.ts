/**
 * orderPdf.ts — B2B sifariş üçün təhvil/yığım QAİMƏSI (Azərbaycan dilində).
 *
 * Mühüm: Bu sənəddə MƏXFİ məlumatlar GÖSTƏRİLMİR:
 *   • Qiymət, endirim, borc, ümumi məbləğ — YOXDUR.
 *   • Yalnız operativ siyahı: məhsul şəkli, ad, brend, barkod, miqdar, vahid.
 *
 * İstifadə: `await downloadOrderPdf(order, products)` — yüklənmə avtomatik başlayır.
 */
import jsPDF from 'jspdf';
import autoTable, { CellHookData } from 'jspdf-autotable';

const LOGO_URL = 'https://i.hizliresim.com/tmu65g6.png';

interface OrderItemLike {
  productId: string;
  productName: { az?: string; ru?: string; en?: string } | string;
  quantity: number;
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
}

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
 * Şəkli base64 PNG dataURL-ə çevirir. CORS-imkanlı (CORS izni olmayan
 * şəkillər üçün boş dataURL qaytarır — şəkilsiz hüceyrə görünəcək).
 */
const loadImageAsDataUrl = (url: string): Promise<{ dataUrl: string; w: number; h: number } | null> =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Maks 100x100 — PDF üçün kifayət, fayl ölçüsünü kiçik saxlayır
        const max = 100;
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

/**
 * downloadOrderPdf — qaimə generasiya edib brauzerdə yüklənmə başladır.
 * MƏXFİ məlumatlar (qiymət/endirim/borc) GÖSTƏRİLMİR.
 */
export const downloadOrderPdf = async (
  order: OrderLike,
  products: ProductLike[]
): Promise<void> => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;

  // ─── Loqo + başlıq ───
  const logo = await loadImageAsDataUrl(LOGO_URL);
  if (logo) {
    const lw = 70;
    const lh = (logo.h * lw) / logo.w;
    try {
      doc.addImage(logo.dataUrl, 'PNG', margin, 30, lw, lh);
    } catch {
      /* loqo yüklənmədisə davam et */
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('QAIME', pageWidth - margin, 50, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text('B2B sifaris teslim/yigim senedi', pageWidth - margin, 66, { align: 'right' });
  doc.setTextColor(0);

  // ─── Sifariş başlıq blokları ───
  const headStartY = 110;
  const orderNumber =
    order.orderNumber !== undefined && order.orderNumber !== null
      ? `#${order.orderNumber}`
      : `#${(order.id || '').slice(0, 8)}`;

  const fullName = [order.customerName, order.customerLastname].filter(Boolean).join(' ').trim() || '-';
  const company = order.companyName && !String(order.companyName).includes('@') ? order.companyName : '';
  const phone = order.customerPhone && String(order.customerPhone).length < 30 ? order.customerPhone : '';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Sifaris melumatlari', margin, headStartY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const meta: Array<[string, string]> = [
    ['Sifaris N:', orderNumber],
    ['Tarix:', formatDate(order.createdAt) || '-'],
    ['Musteri:', fullName],
  ];
  if (company) meta.push(['Sirket:', company]);
  if (phone) meta.push(['Telefon:', phone]);

  let y = headStartY + 14;
  meta.forEach(([k, v]) => {
    doc.setTextColor(110);
    doc.text(k, margin, y);
    doc.setTextColor(20);
    doc.text(String(v), margin + 70, y);
    y += 14;
  });
  doc.setTextColor(0);

  // ─── Məhsulları cədvələ hazırla (şəkillər prefetched) ───
  const totalQty = (order.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const tableStartY = y + 8;

  // Şəkilləri əvvəlcədən yüklə (CORS imkan verirsə)
  const imageData = await Promise.all(
    (order.items || []).map(async (it) => {
      const p = products.find((pp) => pp.id === it.productId);
      const url = p?.images?.[0] || '';
      const data = await loadImageAsDataUrl(url);
      return data;
    })
  );

  const rows = (order.items || []).map((it, idx) => {
    const p = products.find((pp) => pp.id === it.productId);
    const nameAz =
      (typeof it.productName === 'object' ? it.productName?.az : it.productName) ||
      p?.name?.az || p?.name?.en || '-';
    const brand = p?.brand || '-';
    const barcode = p?.barcode || p?.sku || '-';
    return {
      idx: idx + 1,
      img: imageData[idx],
      name: String(nameAz),
      brand,
      barcode,
      qty: Number(it.quantity) || 0,
    };
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [['#', 'Sekil', 'Mehsul adi', 'Brend', 'Barkod', 'Miqdar', 'Vahid']],
    body: rows.map((r) => [r.idx, '', r.name, r.brand, r.barcode, r.qty, 'eded']),
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 6,
      valign: 'middle',
      lineColor: [220, 220, 220],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [33, 33, 33],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      textColor: 30,
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 24 },
      1: { halign: 'center', cellWidth: 56, minCellHeight: 56 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 80 },
      4: { cellWidth: 90, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 50, fontStyle: 'bold' },
      6: { halign: 'center', cellWidth: 40 },
    },
    didDrawCell: (data: CellHookData) => {
      if (data.section === 'body' && data.column.index === 1) {
        const r = rows[data.row.index];
        if (r?.img) {
          const cell = data.cell;
          const max = Math.min(cell.width, cell.height) - 6;
          const w = max;
          const h = (r.img.h * max) / r.img.w;
          const finalH = Math.min(h, max);
          const finalW = (r.img.w * finalH) / r.img.h;
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

  // ─── Summary (yalnız əməliyyat üçün — qiymət YOXDUR) ───
  const finalY = (doc as any).lastAutoTable?.finalY || tableStartY + 80;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Model sayi: ${rows.length}`, margin, finalY + 24);
  doc.text(`Umumi miqdar: ${totalQty} eded`, margin, finalY + 40);

  // ─── Footer: imza sahələri ───
  const footerY = doc.internal.pageSize.getHeight() - 80;
  doc.setDrawColor(180);
  doc.line(margin, footerY, margin + 180, footerY);
  doc.line(pageWidth - margin - 180, footerY, pageWidth - margin, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text('Teslim eden (imza)', margin, footerY + 14);
  doc.text('Teslim alan (imza)', pageWidth - margin - 180, footerY + 14);

  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    'De Valeur — bu qaime yalniz mehsul siyahisi/yigim ucun nezerde tutulub. Qiymet ve odenis melumatlari ayrica sened ile teqdim olunur.',
    margin,
    doc.internal.pageSize.getHeight() - 30,
    { maxWidth: pageWidth - margin * 2 }
  );

  const safeOrderNo = String(orderNumber).replace(/[^a-zA-Z0-9_-]/g, '');
  doc.save(`qaime-${safeOrderNo || 'siparis'}.pdf`);
};
