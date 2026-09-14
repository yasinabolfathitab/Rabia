// Cloudflare Pages Functions Proxy for Supabase
// Path: functions/api/[[path]].js

const TARGET_HOST = 'csoqhdjlnpxlhejfbcai.supabase.co';

export async function onRequest(context) {
  const { request } = context;

  // Handle CORS Preflight request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Parse incoming request URL
  const incomingUrl = new URL(request.url);

  // Strip the '/api' prefix from incoming pathname
  // e.g., /api/rest/v1/orders -> /rest/v1/orders
  //       /api -> /
  let targetPathname = incomingUrl.pathname;
  if (targetPathname.startsWith('/api')) {
    targetPathname = targetPathname.slice(4);
  }
  if (!targetPathname.startsWith('/')) {
    targetPathname = '/' + targetPathname;
  }

  // Build target destination URL to Supabase
  const targetUrl = new URL(`https://${TARGET_HOST}${targetPathname}${incomingUrl.search}`);

  // Clone headers and rewrite Host
  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set('Host', TARGET_HOST);

  // Initialize request options
  const requestInit = {
    method: request.method,
    headers: proxyHeaders,
    redirect: 'follow',
  };

  // Attach body for requests that carry payloads
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    requestInit.body = request.body;
  }

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), requestInit);

    // Create mutable response headers with open CORS
    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy fetch failed', message: err?.message || String(err) }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
