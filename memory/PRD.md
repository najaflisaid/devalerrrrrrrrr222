# DE VALEUR — Vercel White Screen Fix

## Problem
User reported Vercel deployment (devaleur.az) showed a white/blank page.

## Root Cause
`vite.config.ts` manualChunks misconfiguration:
- `if (id.includes('react'))` was splitting React core and React-dependent packages
  (lucide-react, framer-motion, react-router-dom, react-i18next, qrcode.react,
  react-signature-canvas) into DIFFERENT chunks.
- At runtime React became undefined in some chunks → "Cannot read properties of
  undefined (reading 'useState')" → blank page.

## Fix Applied (2026-01)
- Rewrote `manualChunks` in `/app/vite.config.ts`.
- All React-based packages now bundled into a single `vendor-react` chunk via a
  precise regex matching `node_modules/(react|react-dom|scheduler|react-router*|
  react-i18next|react-signature-canvas|qrcode.react|lucide-react|framer-motion|
  @radix-ui|prop-types|use-sync-external-store)/`.
- firebase / supabase / xlsx / i18next remain in separate chunks for code-splitting.

## Verified
- `yarn build` succeeds (vendor-react: 266 kB / 83 kB gzip).
- `vite preview` locally renders full homepage with no console errors.

## Next Action Items
- User must commit & push so Vercel triggers a fresh production build.
- Optionally clear Vercel build cache during redeploy.
