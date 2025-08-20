const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  
  if (req.url === '/api/v1/label/__name__/values') {
    res.end('{"status":"success","data":["prometheus_tsdb_head_series"]}');
  } else {
    res.end('{"status":"success","data":{}}');
  }
});

server.listen(9090, () => {
  console.log('Mock Prometheus running on port 9090');
});