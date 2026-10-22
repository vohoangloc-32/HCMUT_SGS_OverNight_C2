import http from 'http';
import { calculateDiscount } from './discount.js';

const PORT = process.env.PORT || 8000;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/discount') {
    const points = parseFloat(url.searchParams.get('points') ?? '0');
    const discount = calculateDiscount(points);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ points, discount }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'sample-service', version: '1.0.0' }));
});

server.listen(PORT, () => {
  console.log(`Sample service running on port ${PORT}`);
});
