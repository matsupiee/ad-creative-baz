export function parseTiktokCdnExpiry(url: string): Date | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!parsed.host.endsWith(".tiktokcdn.com")) return null;

  const segments = parsed.pathname.split("/").filter((s) => s.length > 0);
  if (segments.length < 2) return null;
  const expHex = segments[1];
  if (!expHex || !/^[0-9a-f]{8}$/i.test(expHex)) return null;

  const epochSeconds = parseInt(expHex, 16);
  if (!Number.isFinite(epochSeconds)) return null;
  const expiresAt = new Date(epochSeconds * 1000);

  const now = Date.now();
  const lowerBound = now - 24 * 60 * 60 * 1000;
  const upperBound = now + 30 * 24 * 60 * 60 * 1000;
  const t = expiresAt.getTime();
  if (t < lowerBound || t > upperBound) return null;

  return expiresAt;
}
