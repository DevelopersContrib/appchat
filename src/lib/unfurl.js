export async function unfurlUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      headers: { 'User-Agent': 'AppChat Bot/1.0' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;

    const html = await res.text();
    const title = extract(html, /<meta\s+property="og:title"\s+content="([^"]+)"/i)
      || extract(html, /<title[^>]*>([^<]+)<\/title>/i)
      || url;
    const description = extract(html, /<meta\s+property="og:description"\s+content="([^"]+)"/i)
      || extract(html, /<meta\s+name="description"\s+content="([^"]+)"/i)
      || '';
    const image = extract(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i);
    const siteName = extract(html, /<meta\s+property="og:site_name"\s+content="([^"]+)"/i);
    const favicon = extract(html, /<link[^>]+rel="(?:shortcut )?icon"[^>]+href="([^"]+)"/i);

    return {
      url,
      title: decodeEntities(title).slice(0, 200),
      description: decodeEntities(description).slice(0, 300),
      image,
      siteName,
      favicon: favicon ? new URL(favicon, url).href : null,
      domain: new URL(url).hostname,
    };
  } catch {
    return null;
  }
}

function extract(html, regex) {
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
