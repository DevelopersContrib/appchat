import { NextResponse } from 'next/server';

// OAuth endpoints are called by other apps (sometimes from browsers), so they allow any origin.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
};

export const json = (body, status = 200, extra = {}) =>
  NextResponse.json(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store', ...extra } });

export const preflight = () => new NextResponse(null, { status: 204, headers: CORS });

/** Reads a form-encoded or JSON body. */
export async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return request.json().catch(() => ({}));
  const text = await request.text().catch(() => '');
  return Object.fromEntries(new URLSearchParams(text));
}
