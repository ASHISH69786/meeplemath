import type { APIRoute } from 'astro';

// Google requires /ads.txt once AdSense is live. Set PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX.
export const GET: APIRoute = () => {
  const client = import.meta.env.PUBLIC_ADSENSE_CLIENT;
  const body = client
    ? `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`
    : '# AdSense not configured yet\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
};
