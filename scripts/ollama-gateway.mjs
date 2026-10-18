// Authenticated least-privilege gateway for a laptop Ollama reached through a
// tunnel (ngrok, Cloudflare, etc.). It exposes ONLY the two endpoints the app
// uses — GET /api/tags and POST /api/chat — checks a shared secret, and
// forwards everything else to a flat 404. Raw Ollama has no authentication and
// a model-management API; never tunnel it directly. Run this in front instead.
//
//   node scripts/ollama-gateway.mjs --secret <rahasia>
//
// Then put a tunnel in front of the printed loopback port and set, on Railway:
//   OLLAMA_URL=https://<url-tunnel>
//   OLLAMA_AUTH=Bearer <rahasia>   (sama persis dengan --secret di sini)
//
// Flags / env (flags win):
//   --secret   / GATEWAY_SECRET   required; the bearer secret the app must send
//   --port     / GATEWAY_PORT     listen port (default 11435)
//   --host     / GATEWAY_HOST     listen host (default 127.0.0.1, loopback only)
//   --ollama   / OLLAMA_ORIGIN    upstream Ollama (default http://127.0.0.1:11434)
import http from 'node:http';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  secret: { type: 'string' }, port: { type: 'string' }, host: { type: 'string' }, ollama: { type: 'string' },
} });

const secret = values.secret || process.env.GATEWAY_SECRET || '';
const port = Number(values.port || process.env.GATEWAY_PORT || 11435);
const host = values.host || process.env.GATEWAY_HOST || '127.0.0.1';
const origin = (values.ollama || process.env.OLLAMA_ORIGIN || 'http://127.0.0.1:11434').replace(/\/+$/, '');

if (!secret || secret.length < 16) {
  console.error('Gateway menolak start: --secret (atau GATEWAY_SECRET) wajib diisi, minimal 16 karakter.');
  console.error('Buat rahasia acak:  node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'base64url\'))"');
  process.exit(1);
}

const expected = Buffer.from('Bearer ' + secret);
// Constant-time compare so a wrong secret cannot be guessed by timing.
function authorized(header) {
  if (typeof header !== 'string') return false;
  const given = Buffer.from(header);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(given, expected);
}

const MAX_BODY = 256 * 1024; // chat payloads are small; cap to blunt abuse.
const ALLOWED = new Map([['GET /api/tags', 'GET'], ['POST /api/chat', 'POST']]);

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = `${req.method} ${url.pathname}`;
  // Auth first: never reveal which routes exist to an unauthenticated caller.
  if (!authorized(req.headers['authorization'])) return send(res, 401, '{"error":"unauthorized"}');
  if (!ALLOWED.has(route)) return send(res, 404, '{"error":"not found"}');

  const chunks = [];
  let size = 0, aborted = false;
  req.on('data', chunk => {
    size += chunk.length;
    if (size > MAX_BODY) { aborted = true; send(res, 413, '{"error":"payload too large"}'); req.destroy(); return; }
    chunks.push(chunk);
  });
  req.on('end', async () => {
    if (aborted) return;
    const body = req.method === 'POST' ? Buffer.concat(chunks) : undefined;
    try {
      const upstream = await fetch(origin + url.pathname, {
        method: req.method,
        headers: body ? { 'Content-Type': req.headers['content-type'] || 'application/json' } : {},
        body,
        signal: AbortSignal.timeout(60000),
      });
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
      res.end(buf);
      // Log route + status only — never the chat body, to avoid leaking orders.
      console.log(new Date().toISOString(), route, '->', upstream.status);
    } catch (error) {
      console.log(new Date().toISOString(), route, '-> upstream error:', error.message);
      send(res, 502, '{"error":"ollama unavailable"}');
    }
  });
});

server.listen(port, host, () => {
  console.log(`Ollama gateway aktif di http://${host}:${port}  ->  ${origin}`);
  console.log('Endpoint yang diizinkan: GET /api/tags, POST /api/chat. Selain itu ditolak.');
  console.log('Arahkan tunnel ke port di atas, lalu set OLLAMA_URL + OLLAMA_AUTH=Bearer <rahasia> di Railway.');
});
