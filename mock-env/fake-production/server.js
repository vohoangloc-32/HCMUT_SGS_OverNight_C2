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
