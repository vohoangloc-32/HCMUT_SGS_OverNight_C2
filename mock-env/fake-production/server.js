import http from 'http';

const PORT = parseInt(process.env.PORT ?? process.env.FAKE_PRODUCTION_PORT ?? '4001', 10);
const deploys = [];

const server = http.createServer((req, res) => {
  // CORS
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
  <title>Production Environment — Fake Production Target</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 2rem; margin: 0; }
    .container { max-width: 800px; margin: 0 auto; }
    .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 1.5rem; margin-top: 1.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .status-pill { display: inline-block; padding: 0.35rem 0.85rem; border-radius: 9999px; font-weight: 700; font-size: 0.8rem; text-transform: uppercase; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid #3b82f6; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #1e293b; font-size: 0.875rem; }
    th { color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1 style="margin: 0; font-size: 1.6rem;">🚀 Production Cluster Monitor</h1>
        <p style="color: #94a3b8; margin: 0.35rem 0 0 0; font-size: 0.9rem;">
          Verified Production Deployment Target (Demo Scenario 2)
        </p>
      </div>
      <div>
        <span class="status-pill">${deploys.length} DEPLOYS EXECUTED</span>
      </div>
    </div>

    <div class="card">
      <h2 style="font-size: 1.15rem; margin-top: 0;">Verified Production Releases</h2>
      ${deploys.length === 0 ? `
        <div style="text-align: center; padding: 3rem 1rem; color: #94a3b8;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">📦</div>
          <h3 style="margin: 0 0 0.5rem 0; color: #f1f5f9;">No Deployments Dispatched Yet</h3>
          <p style="font-size: 0.875rem;">Deployments only execute after 2-of-3 guardian approval quorum is reached.</p>
        </div>
      ` : `
        <table>
          <thead>
            <tr>
              <th>Deploy ID</th>
              <th>Version</th>
              <th>Commit Hash</th>
              <th>Execution Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${deploys.map((d) => `
              <tr>
                <td><code>${d.id}</code></td>
                <td><strong style="color: #10b981;">v${d.version}</strong></td>
                <td><code>${d.commit}</code></td>
                <td>${d.deployedAt}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  </div>
</body>
</html>`);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'fake-production', count: deploys.length }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/deploys') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ deploys }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/deploy') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const record = {
          id: `deploy-${Date.now()}`,
          version: data.version,
          commit: data.commit,
          deployedAt: new Date().toISOString(),
        };
        deploys.push(record);
        console.log(`[fake-production] DEPLOY SUCCESSFUL: version=${data.version} commit=${data.commit}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          message: `Deployed version ${data.version} (${data.commit}) to production`,
          deploy: record,
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Fake production server listening on http://0.0.0.0:${PORT}`);
});
