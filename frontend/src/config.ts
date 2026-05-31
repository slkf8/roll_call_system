/**
 * Centralized frontend runtime configuration.
 *
 * API_BASE_URL precedence:
 *   1. VITE_API_BASE_URL (Vite build-time injection via .env / .env.local /
 *      build-time shell export) — trimmed; whitespace-only treated as unset.
 *   2. Dev fallback   → "http://127.0.0.1:8000" (Vite dev server).
 *   3. Prod fallback  → "" (same-origin: requests become relative /api/...).
 *
 * Same-origin in prod means the browser talks to whatever origin served the
 * HTML — the packaged binary on 127.0.0.1, Tailscale Serve, Cloudflare
 * Tunnel, or a custom domain. No private hostname is hard-coded.
 *
 * VITE_API_BASE_URL is a build-time substitution, not a runtime override:
 * set it before `npm run build` only when the bundle must reach a backend on
 * a DIFFERENT origin than the one serving the HTML.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  (import.meta.env.DEV ? "http://127.0.0.1:8000" : "");
