// Safe headers for sending a stored file back (26 Nov 2026, audit round 2). Only pictures, videos
// and PDFs open in the browser; anything else downloads as plain bytes, so a file that claims to be
// a web page can never run inside the Hub. The file name is cleaned for the header.
const INLINE = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/avif",
  "video/mp4", "video/quicktime", "video/webm", "application/pdf",
]);
export const isInlineSafe = (mime: string | null | undefined) => !!mime && INLINE.has(mime.toLowerCase());

/** Pictures and videos people may upload to galleries (Fun Corner and similar). */
export const MEDIA_TYPES = new Set([...INLINE].filter(t => t.startsWith("image/") || t.startsWith("video/")));
export const MEDIA_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "image/heif": "heif", "image/avif": "avif",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

/** Headers for a stored file. `download` forces "save" even for a picture or PDF (document lists that always download). */
export function fileHeaders(mime: string | null | undefined, name: string | null | undefined, extra: Record<string, string> = {}, opts: { download?: boolean } = {}): Record<string, string> {
  const m = (mime ?? "").toLowerCase();
  const svg = m === "image/svg+xml"; // a picture that can carry script: shown, but sandboxed
  const safe = isInlineSafe(m) || svg;
  const inline = safe && !opts.download;
  const clean = (name ?? "file").replace(/[\r\n"\\]/g, "").replace(/[^\x20-\x7e]/g, "_").slice(0, 150) || "file";
  return {
    "Content-Type": safe ? m : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${clean}"; filename*=UTF-8''${encodeURIComponent((name ?? "file").slice(0, 150))}`,
    "X-Content-Type-Options": "nosniff",
    ...(svg ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
    ...extra,
  };
}
