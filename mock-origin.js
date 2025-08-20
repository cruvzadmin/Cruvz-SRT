const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  
  if (req.url === '/v1/stats/current') {
    res.end('{"status":"success","data":{"streams":[]}}');
  } else {
    res.end('{"status":"success"}');
  }
});

server.listen(8080, () => {
  console.log('Mock Origin API running on port 8080');
});