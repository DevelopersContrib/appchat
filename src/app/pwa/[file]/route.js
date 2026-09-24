import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

const FILES = {
  'icon-192.png': { size: 192, padding: 0 },
  'icon-512.png': { size: 512, padding: 0 },
  // Maskable icons get cropped to a circle/squircle on Android, so keep the art inside the safe zone.
  'maskable-512.png': { size: 512, padding: 0.12 },
  'apple-touch-icon.png': { size: 180, padding: 0 },
};

let svgDataUrl;

export async function GET(request, { params }) {
  const { file } = await params;
  const spec = FILES[file];
  if (!spec) return new Response('Not found', { status: 404 });

  svgDataUrl ??= `data:image/svg+xml;base64,${(await readFile(join(process.cwd(), 'public/pwa-icon.svg'))).toString('base64')}`;
  const inner = Math.round(spec.size * (1 - spec.padding * 2));

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
        <img src={svgDataUrl} width={inner} height={inner} alt="" />
      </div>
    ),
    {
      width: spec.size,
      height: spec.size,
      headers: { 'Cache-Control': 'public, max-age=86400, immutable' },
    }
  );
}
