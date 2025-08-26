# Cruvz-SRT Streaming Platform - Protocol Guide

Complete guide for all supported streaming protocols and OvenMediaEngine features.

## Table of Contents

1. [Quick Start](#quick-start)
2. [RTMP Streaming](#rtmp-streaming)
3. [SRT Streaming](#srt-streaming)
4. [WebRTC Streaming](#webrtc-streaming)
5. [Low Latency HLS (LL-HLS)](#low-latency-hls-ll-hls)
6. [OVT (Open Video Transfer)](#ovt-open-video-transfer)
7. [Transcoding](#transcoding)
8. [Recording](#recording)
9. [Push Publishing](#push-publishing)
10. [Analytics & Monitoring](#analytics--monitoring)
11. [Troubleshooting](#troubleshooting)

---

## Quick Start

### System Requirements
- **Hardware**: 4+ CPU cores, 8GB+ RAM, SSD storage
- **Network**: 100+ Mbps upload for high-quality streaming
- **Software**: Docker, Docker Compose

### Getting Started
1. **Login to Dashboard**: Access your account at the web interface
2. **Create Stream**: Use the dashboard to create a new stream
3. **Get Stream Key**: Copy your unique stream key from the dashboard
4. **Configure Encoder**: Set up your streaming software (OBS, etc.)
5. **Start Streaming**: Begin your live stream

---

## RTMP Streaming

**Real-Time Messaging Protocol** - Industry standard for live streaming.

### Connection Details
- **Endpoint**: `rtmp://your-domain:1935/live`
- **Stream Key**: Generated in dashboard (format: `stream_xxxxxxxxxxxxx`)
- **Port**: 1935 (TCP)

### Configuration Examples

#### OBS Studio
1. **Settings** → **Stream**
2. **Service**: Custom
3. **Server**: `rtmp://your-domain:1935/live`
4. **Stream Key**: Your unique stream key

#### FFmpeg Command Line
```bash
ffmpeg -re -i input.mp4 -c:v libx264 -c:a aac \
  -f flv rtmp://your-domain:1935/live/YOUR_STREAM_KEY
```

#### Professional Encoders
- **Wirecast**: Use Custom RTMP destination
- **XSplit**: Add Custom RTMP output
- **Restream Studio**: Configure custom RTMP endpoint

### Quality Settings
| Quality | Resolution | Bitrate | FPS |
|---------|------------|---------|-----|
| 1080p | 1920x1080 | 6000 kbps | 30/60 |
| 720p | 1280x720 | 3000 kbps | 30/60 |
| 480p | 854x480 | 1500 kbps | 30 |

### Playback URLs
- **HLS**: `http://your-domain:8088/live/YOUR_STREAM_KEY/index.m3u8`
- **WebRTC**: Available via dashboard player

---

## SRT Streaming

**Secure Reliable Transport** - Low-latency streaming with error correction.

### Connection Details
- **Endpoint**: `srt://your-domain:9999`
- **Mode**: Caller mode (client connects to server)
- **Stream ID**: Your stream key
- **Port**: 9999 (UDP)

### Configuration Examples

#### OBS Studio (with SRT plugin)
1. **Settings** → **Stream**
2. **Service**: Custom
3. **Server**: `srt://your-domain:9999?streamid=YOUR_STREAM_KEY`

#### FFmpeg Command Line
```bash
ffmpeg -re -i input.mp4 -c:v libx264 -c:a aac \
  -f mpegts srt://your-domain:9999?streamid=YOUR_STREAM_KEY
```

#### Larix Broadcaster (Mobile)
- **Connection**: SRT
- **Host**: your-domain
- **Port**: 9999
- **Stream ID**: YOUR_STREAM_KEY

### Advanced SRT Parameters
```
srt://your-domain:9999?streamid=YOUR_STREAM_KEY&latency=200&maxbw=5000000
```
- `latency`: Buffer size in milliseconds (100-2000)
- `maxbw`: Maximum bandwidth in bits per second
- `passphrase`: Optional encryption passphrase

---

## WebRTC Streaming

**Web Real-Time Communication** - Ultra-low latency browser-based streaming.

### Connection Details
- **Signaling**: `ws://your-domain:3333/webrtc`
- **STUN/TURN**: Built-in ICE handling
- **Protocols**: UDP preferred, TCP fallback

### Browser-Based Streaming

#### JavaScript Implementation
```javascript
// Initialize WebRTC connection
const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// Get user media
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: 1280, height: 720 },
  audio: true
});

// Add tracks to peer connection
stream.getTracks().forEach(track => pc.addTrack(track, stream));

// Connect to signaling server
const ws = new WebSocket('ws://your-domain:3333/webrtc/YOUR_STREAM_KEY');
```

#### Mobile Apps
- **Native iOS**: Use WebRTC framework
- **Native Android**: Use WebRTC library
- **React Native**: Use react-native-webrtc

### Playback
- **Direct URL**: `webrtc://your-domain:3333/live/YOUR_STREAM_KEY`
- **Dashboard Player**: Built-in WebRTC player available

---

## Low Latency HLS (LL-HLS)

**HTTP Live Streaming** with sub-second latency for Apple ecosystem.

### Connection Details
- **Endpoint**: `http://your-domain:8088/live/YOUR_STREAM_KEY/index.m3u8`
- **Chunk Duration**: 0.5 seconds
- **Segment Duration**: 6 seconds
- **Part Hold Back**: 1.5 seconds

### Configuration

#### For Apple Devices
```html
<video controls>
  <source src="http://your-domain:8088/live/YOUR_STREAM_KEY/index.m3u8" type="application/vnd.apple.mpegurl">
</video>
```

#### HLS.js for Web Browsers
```javascript
import Hls from 'hls.js';

const video = document.getElementById('video');
if (Hls.isSupported()) {
  const hls = new Hls({
    lowLatencyMode: true,
    backBufferLength: 90
  });
  hls.loadSource('http://your-domain:8088/live/YOUR_STREAM_KEY/index.m3u8');
  hls.attachMedia(video);
}
```

### Quality Ladder
Automatic bitrate adaptation based on viewer's connection:
- **Source**: Original quality from encoder
- **720p**: 3000 kbps bitrate
- **480p**: 1500 kbps bitrate
- **360p**: 800 kbps bitrate

---

## OVT (Open Video Transfer)

**OvenMediaEngine's proprietary protocol** for origin-edge distribution.

### Use Cases
- **Multi-region streaming**: Distribute streams across geographical locations
- **Load balancing**: Scale viewers across multiple edge servers
- **Content delivery**: Efficient stream replication

### Configuration

#### Origin Server Setup
```xml
<Publishers>
  <OVT>
    <Port>9000</Port>
  </OVT>
</Publishers>
```

#### Edge Server Connection
```bash
# Connect edge to origin
curl -X POST http://edge-server:8080/v1/vhosts/default/apps/live/streams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "stream_name",
    "outputStreamName": "stream_name",
    "providers": [{
      "type": "ovt",
      "location": "origin-server:9000/live/stream_name"
    }]
  }'
```

---

## Transcoding

**Real-time video processing** for multiple output formats and qualities.

### Transcoding Profiles

#### Standard Profiles
```json
{
  "profiles": [
    {
      "name": "1080p_profile",
      "video": {
        "codec": "h264",
        "bitrate": 5000000,
        "width": 1920,
        "height": 1080,
        "framerate": 30
      },
      "audio": {
        "codec": "aac",
        "bitrate": 128000,
        "samplerate": 48000,
        "channels": 2
      }
    }
  ]
}
```

#### GPU Acceleration
- **NVIDIA**: NVENC encoder support
- **Intel**: Quick Sync Video support
- **Hardware**: Automatic detection and usage

### API Usage

#### Start Transcoding Job
```bash
curl -X POST http://your-domain:5000/api/transcoding/jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": "your_stream_id",
    "profile_id": "1080p_profile",
    "output_format": "mp4"
  }'
```

#### Monitor Progress
```bash
curl -X GET http://your-domain:5000/api/transcoding/jobs/JOB_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Recording

**DVR functionality** for stream archival and playback.

### Recording Options
- **Format**: MP4, FLV, TS
- **Quality**: Source, transcoded variants
- **Storage**: Local filesystem, cloud storage
- **Duration**: Segment-based or continuous

### API Usage

#### Start Recording
```bash
curl -X POST http://your-domain:5000/api/streaming/recording/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stream_id": "your_stream_id",
    "format": "mp4",
    "quality": "source"
  }'
```

#### Stop Recording
```bash
curl -X POST http://your-domain:5000/api/streaming/recording/stop \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stream_id": "your_stream_id"}'
```

### File Management
- **Download**: Generate secure download links
- **Storage**: Automatic cleanup based on retention policies
- **Metadata**: Duration, file size, creation time

---

## Push Publishing

**Simultaneous streaming** to multiple platforms.

### Supported Platforms
- **YouTube Live**: RTMP endpoint integration
- **Twitch**: Direct RTMP publishing
- **Facebook Live**: RTMPS publishing
- **Custom RTMP**: Any RTMP-compatible platform

### Configuration

#### YouTube Live Setup
1. **Platform**: YouTube
2. **Stream Key**: Your YouTube stream key
3. **Server**: rtmp://a.rtmp.youtube.com/live2

#### Multiple Platform Publishing
```bash
curl -X POST http://your-domain:5000/api/publishing/targets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Multi-Platform Stream",
    "targets": [
      {
        "platform": "youtube",
        "stream_key": "YOUTUBE_KEY",
        "enabled": true
      },
      {
        "platform": "twitch",
        "stream_key": "TWITCH_KEY",
        "enabled": true
      }
    ]
  }'
```

---

## Analytics & Monitoring

**Real-time metrics** and performance monitoring.

### Available Metrics
- **Viewer Statistics**: Concurrent viewers, total views, geographic distribution
- **Quality Metrics**: Bitrate, frame rate, resolution, dropped frames
- **Performance**: CPU usage, memory, bandwidth utilization
- **System Health**: Server status, error rates, uptime

### Six Sigma Quality Metrics
- **Defect Rate**: Errors per million operations
- **Process Capability**: Cp, Cpk calculations
- **Sigma Level**: Quality performance rating
- **Control Charts**: Statistical process control

### API Access

#### Dashboard Analytics
```bash
curl -X GET http://your-domain:5000/api/analytics/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Real-time Metrics
```bash
curl -X GET http://your-domain:5000/api/analytics/realtime
```

#### Six Sigma Metrics
```bash
curl -X GET http://your-domain:5000/api/six-sigma/metrics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Troubleshooting

### Common Issues

#### Connection Problems
1. **Check firewall**: Ensure ports 1935, 9999, 3333, 8088 are open
2. **Network latency**: Use SRT for high-latency connections
3. **Bandwidth**: Ensure sufficient upload bandwidth

#### Stream Quality Issues
1. **Bitrate**: Adjust based on connection quality
2. **Encoder settings**: Use hardware acceleration when available
3. **Keyframe interval**: Set to 2 seconds for better seek performance

#### Authentication Errors
1. **Stream key**: Verify correct stream key format
2. **Permissions**: Check user account permissions
3. **Token expiry**: Refresh authentication tokens

### Performance Optimization

#### Encoder Settings
- **Keyframe Interval**: 2 seconds (60 frames at 30fps)
- **B-frames**: 2 for better compression
- **Preset**: medium for balance of quality/performance

#### Network Optimization
- **CDN**: Use content delivery network for global reach
- **Edge servers**: Deploy closer to viewers
- **Protocol selection**: Choose based on use case requirements

### Support Resources
- **Dashboard**: Built-in diagnostics and monitoring
- **Logs**: Detailed error logging and troubleshooting
- **Health checks**: Automated system monitoring
- **Documentation**: Complete API reference available

---

## Protocol Comparison

| Protocol | Latency | Compatibility | Use Case |
|----------|---------|---------------|----------|
| **RTMP** | 3-5 seconds | Universal | General streaming |
| **SRT** | 100-500ms | Professional | Low-latency production |
| **WebRTC** | <100ms | Modern browsers | Interactive streaming |
| **LL-HLS** | 1-2 seconds | Apple ecosystem | Mobile/Safari |
| **OVT** | <100ms | OME only | Origin-edge distribution |

Choose the protocol that best fits your latency requirements, viewer platform, and technical capabilities.