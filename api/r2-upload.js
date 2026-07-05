// Vercel serverless function — upload files to Cloudflare R2
// Accepts base64-encoded file in JSON body (simple, works for images < ~4.5MB)
// Returns { url, key } — url is publicly accessible via R2 public bucket / custom domain

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_URL, // e.g. https://pub-xxxx.r2.dev  OR  https://cdn.example.com
} = process.env;

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function sanitizeExt(filename, contentType) {
  const byName = (filename || '').split('.').pop()?.toLowerCase();
  const byType = (contentType || '').split('/').pop()?.toLowerCase();
  const ext = (byName && byName.length <= 5 ? byName : byType) || 'bin';
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'heic', 'heif'];
  return allowed.includes(ext) ? ext : 'jpg';
}

export default async function handler(req, res) {
  // CORS (in case admin panel is on another domain)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) {
    return res.status(500).json({
      error: 'R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL in Vercel env vars.',
    });
  }

  try {
    const { fileBase64, filename, contentType, folder } = req.body || {};

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({ error: 'fileBase64 field required (base64 encoded, no data URI prefix)' });
    }

    // Strip data URI prefix if present
    const base64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large (max 10MB)' });
    }

    const ext = sanitizeExt(filename, contentType);
    const safeFolder = (folder || 'products').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'products';
    const key = `${safeFolder}/${randomUUID()}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;

    return res.status(200).json({ url: publicUrl, key });
  } catch (err) {
    console.error('R2 upload error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}
