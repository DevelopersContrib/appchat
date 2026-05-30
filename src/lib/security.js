const rateLimitMap = new Map();

export function rateLimit(key, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.start > windowMs) {
    rateLimitMap.set(key, { start: now, count: 1 });
    return true;
  }

  entry.count++;
  if (entry.count > maxRequests) return false;
  return true;
}

export function getClientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

export function validateEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function validateSlug(slug) {
  if (typeof slug !== 'string') return false;
  if (slug.length < 2 || slug.length > 63) return false;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) return false;

  const reserved = ['admin', 'api', 'login', 'onboard', 'room', 'about', 'contact', 'privacy', 'terms', 'select-org', 'www', 'app', 'mail', 'ftp', 'static', 'assets'];
  return !reserved.includes(slug);
}

export function isInternalUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return true;
    if (hostname.startsWith('10.') || hostname.startsWith('172.') || hostname.startsWith('192.168.')) return true;
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return true;
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return true;

    return false;
  } catch {
    return true;
  }
}

export function sanitizeUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (isInternalUrl(url)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

if (typeof globalThis.__rateLimitCleanup === 'undefined') {
  globalThis.__rateLimitCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now - entry.start > 300000) rateLimitMap.delete(key);
    }
  }, 60000);
}
