/**
 * /api/og-default — 1200×1200 ağ arxa fonlu De Valeur logo PNG/SVG generator.
 *
 * Sayt linki paylaşıldıqda (məsələn WhatsApp, Telegram, Twitter, Facebook,
 * iMessage) bu URL OG şəkli kimi göstərilir. SVG image platformaların
 * əksəriyyəti tərəfindən dəstəklənir. Sadə və yüngül.
 */
export default function handler(req, res) {
  const logoUrl = 'https://i.hizliresim.com/tmu65g6.png';

  // 1200×1200 ag arxa fonlu SVG. Logo merkəzdə, yüksək keyfiyyət.
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#ffffff"/>
  <image href="${logoUrl}" x="200" y="350" width="800" height="500" preserveAspectRatio="xMidYMid meet"/>
  <text x="600" y="950" font-family="Montserrat, Helvetica, Arial, sans-serif" font-size="42" font-weight="300" letter-spacing="6" text-anchor="middle" fill="#0a0a0a">PRESTIJINIZƏ DƏYƏR QATAN DETALLAR</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(svg);
}
