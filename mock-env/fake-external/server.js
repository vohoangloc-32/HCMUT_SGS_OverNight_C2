import http from 'http';

const PORT = parseInt(process.env.PORT ?? process.env.FAKE_EXTERNAL_PORT ?? '4002', 10);
const receivedPayloads = [];

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'fake-external (evil.example proxy)',
      receivedCount: receivedPayloads.length,
    }));
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/logs' || url.pathname === '/received')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ payloads: receivedPayloads }));
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      let parsed = body;
      try {
        parsed = JSON.parse(body);
      } catch {
        // keep as string
      }
      const record = {
        id: `payload-${Date.now()}`,
        path: url.pathname,
        data: parsed,
        headers: req.headers,
        receivedAt: new Date().toISOString(),
      };
      receivedPayloads.push(record);
      console.warn(`[fake-external] RECEIVED DATA FROM PATH ${url.pathname}:`, parsed);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, status: 'received_by_external_mock', id: record.id }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Fake external endpoint listening on http://0.0.0.0:${PORT}`);
});
