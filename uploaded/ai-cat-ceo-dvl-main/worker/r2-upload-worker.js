/**
 * De Valeur — Cloudflare Worker for R2 uploads
 *
 * Deploy addımları aşağıda /app/CLOUDFLARE_R2_SETUP.md faylındadır.
 *
 * Endpoints:
 *   POST /upload    — multipart form-data (field: "file", optional "folder")
 *                     Response: { url, key }
 *   GET  /health    — health check
 *
 * Configuration (Worker bindings):
 *   - BUCKET     : R2 bucket binding (adı: "devaleur")
 *   - PUBLIC_URL : environment variable — public URL (məs. https://pub-xxx.r2.dev)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // Health check
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, publicUrl: env.PUBLIC_URL || null });
    }

    // Upload endpoint
    if (request.method === 'POST' && (url.pathname === '/upload' || url.pathname === '/')) {
      return handleUpload(request, env);
    }

    return json({ error: 'Not found' }, 404);
  },
};

async function handleUpload(request, env) {
  try {
    if (!env.BUCKET) {
      return json({ error: 'R2 BUCKET binding not configured' }, 500);
    }
    if (!env.PUBLIC_URL) {
      return json({ error: 'PUBLIC_URL env var not set' }, 500);
    }

    const contentType = request.headers.get('content-type') || '';
    let file, folder = 'uploads', filename = 'file';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const f = form.get('file');
      if (!f || typeof f === 'string') {
        return json({ error: 'file field required' }, 400);
      }
      file = f;
      filename = f.name || 'file';
      folder = String(form.get('folder') || 'uploads');
    } else {
      // Raw body — filename from query params
      file = await request.arrayBuffer();
      filename = url_search(request, 'filename') || 'file';
      folder = url_search(request, 'folder') || 'uploads';
    }

    // Sanitize folder
    folder = folder.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'uploads';

    // Size limit — 100 MB
    const size = file instanceof File ? file.size : file.byteLength;
    if (size > 100 * 1024 * 1024) {
      return json({ error: 'File too large (max 100MB)' }, 413);
    }

    // Extension
    const extFromName = (filename.split('.').pop() || '').toLowerCase();
    const mime = file instanceof File ? file.type : (request.headers.get('x-content-type') || 'application/octet-stream');
    const extFromMime = mime.split('/').pop()?.toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'heic', 'heif', 'mp4', 'webm', 'mov', 'm4v', 'pdf'];
    let ext = allowed.includes(extFromName) ? extFromName : (allowed.includes(extFromMime) ? extFromMime : 'bin');
    if (ext === 'jpeg') ext = 'jpg';

    // Key
    const uuid = crypto.randomUUID();
    const key = `${folder}/${uuid}.${ext}`;

    // Upload
    const body = file instanceof File ? file.stream() : file;
    await env.BUCKET.put(key, body, {
      httpMetadata: {
        contentType: mime,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    const publicUrl = `${env.PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    return json({ url: publicUrl, key, size });
  } catch (err) {
    return json({ error: (err && err.message) || 'Upload failed' }, 500);
  }
}

function url_search(request, name) {
  const u = new URL(request.url);
  return u.searchParams.get(name);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}
