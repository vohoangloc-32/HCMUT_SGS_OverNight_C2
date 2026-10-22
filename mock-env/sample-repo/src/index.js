import http from 'http';

const PORT = process.env.PORT || 8000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'sample-service', version: '1.0.0' }));
});

server.listen(PORT, () => {
  console.log(`Sample service running on port ${PORT}`);
});
