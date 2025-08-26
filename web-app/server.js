// Simple production web server for Cruvz Streaming frontend
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

const PORT = process.env.WEB_PORT || 8085;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const WEB_ROOT = __dirname;

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// Security headers
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' http: https: ws: wss:; frame-ancestors 'self';");
}

// CORS headers
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Proxy request to backend
function proxyToBackend(req, res) {
  const proxyUrl = BACKEND_URL + req.url;
  const lib = proxyUrl.startsWith('https://') ? https : http;
  
  const options = {
    method: req.method,
    headers: { ...req.headers, host: new URL(BACKEND_URL).host },
    timeout: 30000
  };
  
  const proxyReq = lib.request(proxyUrl, options, (proxyRes) => {
    // Copy response headers
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });
    
    res.statusCode = proxyRes.statusCode;
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: 'Backend service unavailable'
    }));
  });
  
  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    res.statusCode = 504;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: 'Backend service timeout'
    }));
  });
  
  // Pipe request body to proxy
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

// Serve static files
async function serveStatic(req, res, filePath) {
  try {
    const fullPath = path.join(WEB_ROOT, filePath);
    const stats = await stat(fullPath);
    
    if (!stats.isFile()) {
      return false;
    }
    
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stats.size);
    
    // Cache headers for static assets
    if (['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
      res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
    }
    
    const content = await readFile(fullPath);
    res.end(content);
    return true;
  } catch (err) {
    return false;
  }
}

// Request handler
async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  
  // Set security headers
  setSecurityHeaders(res);
  setCORSHeaders(res);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }
  
  console.log(`${req.method} ${pathname}`);
  
  // Proxy API requests to backend
  if (pathname.startsWith('/api/') || pathname === '/health' || pathname === '/metrics') {
    proxyToBackend(req, res);
    return;
  }
  
  // Serve static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  
  // Try to serve the requested file
  if (await serveStatic(req, res, filePath)) {
    return;
  }
  
  // Try common variations
  const variations = [
    filePath + '.html',
    filePath + '/index.html',
    '/index.html' // Fallback for SPA
  ];
  
  for (const variation of variations) {
    if (await serveStatic(req, res, variation)) {
      return;
    }
  }
  
  // 404 - serve index.html for SPA routing
  if (await serveStatic(req, res, '/index.html')) {
    return;
  }
  
  // Final 404
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html');
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>404 - Not Found</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #e74c3c; }
        </style>
    </head>
    <body>
        <h1>404 - Page Not Found</h1>
        <p>The requested resource could not be found on this server.</p>
        <a href="/">Return to Home</a>
    </body>
    </html>
  `);
}

// Create and start server
const server = http.createServer(handleRequest);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Cruvz Streaming Web App running on port ${PORT}`);
  console.log(`📁 Serving files from: ${WEB_ROOT}`);
  console.log(`🔗 Proxying API requests to: ${BACKEND_URL}`);
  console.log(`🌍 Environment: production`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 Visit: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Starting graceful shutdown...');
  server.close(() => {
    console.log('Web server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Starting graceful shutdown...');
  server.close(() => {
    console.log('Web server closed');
    process.exit(0);
  });
});

module.exports = server;
