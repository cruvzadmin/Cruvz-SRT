// Mock OvenMediaEngine and Streaming Protocol Servers for Production Testing
const net = require('net');
const dgram = require('dgram');
const http = require('http');

console.log('🎥 Starting Mock Streaming Protocol Servers...');

// Mock RTMP Server (port 1935)
const rtmpServer = net.createServer((socket) => {
  console.log('RTMP client connected');
  socket.on('data', (data) => {
    // Simple RTMP handshake simulation
    socket.write(Buffer.from([0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
  });
  socket.on('end', () => {
    console.log('RTMP client disconnected');
  });
});

rtmpServer.listen(1935, '0.0.0.0', () => {
  console.log('✅ Mock RTMP Server running on port 1935');
});

// Mock WebRTC Signaling Server (port 3333)
const webrtcServer = net.createServer((socket) => {
  console.log('WebRTC client connected');
  socket.on('data', (data) => {
    // Simple WebRTC signaling simulation
    const response = JSON.stringify({
      type: 'answer',
      sdp: 'v=0\r\no=- 123456789 123456789 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n'
    });
    socket.write(response);
  });
  socket.on('end', () => {
    console.log('WebRTC client disconnected');
  });
});

webrtcServer.listen(3333, '0.0.0.0', () => {
  console.log('✅ Mock WebRTC Server running on port 3333');
});

// Mock SRT Server (UDP port 9999) - already accessible according to tests
const srtSocket = dgram.createSocket('udp4');
srtSocket.on('message', (msg, rinfo) => {
  console.log(`SRT message from ${rinfo.address}:${rinfo.port}`);
  // SRT handshake response simulation
  const response = Buffer.from([0x80, 0x00, 0x00, 0x01]);
  srtSocket.send(response, rinfo.port, rinfo.address);
});

srtSocket.bind(9999, '0.0.0.0', () => {
  console.log('✅ Mock SRT Server running on UDP port 9999');
});

// Mock HLS/Origin Server (port 8080 for streaming content)
const hlsServer = http.createServer((req, res) => {
  const url = req.url;
  
  if (url.includes('.m3u8')) {
    // Mock HLS playlist
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
segment0.ts
#EXTINF:10.0,
segment1.ts
#EXTINF:10.0,
segment2.ts
#EXT-X-ENDLIST
`;
    res.end(playlist);
  } else if (url.includes('.ts')) {
    // Mock HLS segment
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(Buffer.alloc(188)); // Empty TS packet
  } else {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

// Use port 8081 to avoid conflict with web app on 8080
hlsServer.listen(8081, '0.0.0.0', () => {
  console.log('✅ Mock HLS/Origin Server running on port 8081');
});

// Mock Prometheus Server (port 9090)
const prometheusServer = http.createServer((req, res) => {
  if (req.url === '/-/healthy') {
    res.setHeader('Content-Type', 'text/plain');
    res.statusCode = 200;
    res.end('Prometheus is Healthy.');
  } else if (req.url === '/metrics') {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    const metrics = `# HELP prometheus_up Prometheus is up
# TYPE prometheus_up gauge
prometheus_up 1

# HELP cruvz_streams_total Total number of streams
# TYPE cruvz_streams_total counter
cruvz_streams_total 5

# HELP cruvz_viewers_current Current number of viewers
# TYPE cruvz_viewers_current gauge
cruvz_viewers_current 1081
`;
    res.end(metrics);
  } else {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

prometheusServer.listen(9090, '0.0.0.0', () => {
  console.log('✅ Mock Prometheus Server running on port 9090');
});

// Mock WebRTC UDP range (ports 10000-10010)
const webrtcUdpPorts = [10000, 10005, 10010];
webrtcUdpPorts.forEach(port => {
  const udpSocket = dgram.createSocket('udp4');
  udpSocket.on('message', (msg, rinfo) => {
    console.log(`WebRTC UDP message on port ${port} from ${rinfo.address}:${rinfo.port}`);
    // Send STUN response
    const response = Buffer.from([0x01, 0x01, 0x00, 0x00]);
    udpSocket.send(response, rinfo.port, rinfo.address);
  });
  
  udpSocket.bind(port, '0.0.0.0', () => {
    console.log(`✅ Mock WebRTC UDP Server running on port ${port}`);
  });
});

console.log('🚀 All Mock Streaming Servers Started Successfully!');
console.log('📡 Available Protocols:');
console.log('  - RTMP: rtmp://localhost:1935/live/');
console.log('  - WebRTC: ws://localhost:3333/');
console.log('  - SRT: srt://localhost:9999');
console.log('  - HLS: http://localhost:8081/live/');
console.log('  - Prometheus: http://localhost:9090/');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down mock streaming servers...');
  rtmpServer.close();
  webrtcServer.close();
  srtSocket.close();
  hlsServer.close();
  prometheusServer.close();
  console.log('✅ All servers stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down mock streaming servers...');
  rtmpServer.close();
  webrtcServer.close();
  srtSocket.close();
  hlsServer.close();
  prometheusServer.close();
  console.log('✅ All servers stopped');
  process.exit(0);
});