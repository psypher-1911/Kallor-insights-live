// Edge middleware: HTTP basic auth for the whole site. Set KALLOR_USER / KALLOR_PASS in Vercel env (defaults below).
export const config = { matcher: ['/((?!favicon.ico).*)'] };
export default function middleware(req) {
  const user = process.env.KALLOR_USER || 'nate', pass = process.env.KALLOR_PASS || 'ctd-2026';
  const h = req.headers.get('authorization') || '';
  if (h.startsWith('Basic ')) { try { if (atob(h.slice(6)) === `${user}:${pass}`) return; } catch (e) {} }
  return new Response('Kallor Insights — sign in', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Kallor Insights"' } });
}
