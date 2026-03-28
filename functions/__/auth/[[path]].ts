// Cloudflare Pages Function to reverse-proxy Firebase Auth requests.
// This allows authDomain to be set to "trashmarket.fun" so the auth iframe
// runs on the same domain, avoiding third-party cookie blocking in Chrome.

const FIREBASE_AUTH_DOMAIN = "trashmarket-fun.firebaseapp.com";

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  // Rebuild the path: /__/auth/... -> https://trashmarket-fun.firebaseapp.com/__/auth/...
  const targetUrl = `https://${FIREBASE_AUTH_DOMAIN}${url.pathname}${url.search}`;

  // Clone the request with the new URL
  const headers = new Headers(context.request.headers);
  // Remove the host header so it gets set to the target
  headers.delete("host");

  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    body: context.request.method !== "GET" && context.request.method !== "HEAD"
      ? context.request.body
      : undefined,
    redirect: "manual",
  });

  // Clone the response and pass it through
  const responseHeaders = new Headers(response.headers);

  // Rewrite any location headers that point back to Firebase
  const location = responseHeaders.get("location");
  if (location) {
    const rewritten = location.replace(
      `https://${FIREBASE_AUTH_DOMAIN}`,
      `https://trashmarket.fun`
    );
    responseHeaders.set("location", rewritten);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};
