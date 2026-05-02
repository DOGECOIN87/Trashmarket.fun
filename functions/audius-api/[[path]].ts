export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const upstream = new URL('https://api.audius.co');
  upstream.pathname = url.pathname.replace(/^\/audius-api/, '');
  upstream.search = url.search;

  const req = new Request(upstream.toString(), {
    method: context.request.method,
    headers: context.request.headers,
  });

  const res = await fetch(req, { redirect: 'follow' });

  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(res.body, {
    status: res.status,
    headers,
  });
};
