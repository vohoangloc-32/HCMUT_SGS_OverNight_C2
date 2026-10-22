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
  const acceptsHtml = (req.headers.accept ?? '').includes('text/html');

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/viewer') && acceptsHtml) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Evil.Example Proxy Monitor — Fake External</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 2rem; margin: 0; }
    .container { max-width: 800px; margin: 0 auto; }
    .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 1.5rem; margin-top: 1.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .status-pill { display: inline-block; padding: 0.35rem 0.85rem; border-radius: 9999px; font-weight: 700; font-size: 0.8rem; text-transform: uppercase; }
    .clean { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981; }
    .leak { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid #ef4444; }
    pre { background: #070a12; padding: 1rem; border-radius: 8px; border: 1px solid #1e293b; overflow-x: auto; color: #38bdf8; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1 style="margin: 0; font-size: 1.6rem;">🌐 Fake External Endpoint</h1>
        <p style="color: #94a3b8; margin: 0.35rem 0 0 0; font-size: 0.9rem;">
          Stands in for <code>http://evil.attacker-controlled-site.org</code> during Demo Scenario 3
        </p>
      </div>
      <div>
        <span class="status-pill ${receivedPayloads.length === 0 ? 'clean' : 'leak'}">
          ${receivedPayloads.length === 0 ? '✔ 0 PAYLOADS RECEIVED (NOTHING ARRIVED)' : `⚠️ ${receivedPayloads.length} PAYLOADS RECEIVED`}
        </span>
      </div>
    </div>

    <div class="card">
      <h2 style="font-size: 1.15rem; margin-top: 0;">Captured Exfiltration Payloads</h2>
      ${receivedPayloads.length === 0 ? `
        <div style="text-align: center; padding: 3rem 1rem;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🛡️</div>
          <h3 style="margin: 0 0 0.5rem 0; color: #10b981;">No Exfiltrated Data Reached This Server</h3>
          <p style="color: #94a3b8; font-size: 0.875rem; max-width: 500px; margin: 0 auto;">
            The prompt injection attempt was successfully blocked by the Key-Holder Gateway. Guardian quorum was never granted, and the agent never had direct access to secret plaintext.
          </p>
        </div>
      ` : `
        <div>
          ${receivedPayloads.map((p) => `
            <div style="margin-bottom: 1rem; border-bottom: 1px solid #1e293b; padding-bottom: 1rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.5rem;">
                <strong>Path: ${p.path}</strong>
                <span>${p.receivedAt}</span>
              </div>
              <pre>${JSON.stringify(p.data, null, 2)}</pre>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  </div>
</body>
</html>`);
    return;
  }

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
