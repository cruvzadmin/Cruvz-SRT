# Cruvz Streaming

## What is Cruvz Streaming?
<img src="dist/OME_LLHLS_220610.svg" style="max-width: 100%; height: auto;">

Cruvz Streaming (CS) is a Sub-Second Latency Streaming Server that can stream Large-scale and High-definition live streams over Low Latency HLS (LLHLS) and WebRTC to hundreds of thousands of viewers.

CS can ingest live streams over WebRTC, SRT, RTMP, RTSP, and MPEG2-TS protocols, encode them to ABR with the embedded live transcoder, and stream them to viewers over LLHLS and WebRTC.

With Cruvz Streaming, you can build your powerful and sub-second latency media service very easily.

## Demo https://space.cruvzstreaming.com/

<img src="dist/05_OvenSpace_230214.png" style="max-width: 100%; height: auto;">

CruvzSpace is a sub-second latency streaming demo service using [Cruvz Streaming](https://github.com/techfixind/Cruvz-SRT), [CruvzPlayer](https://github.com/techfixind/CruvzPlayer) and [CruvzLiveKit](https://github.com/techfixind/CruvzLiveKit-Web). You can experience Cruvz Streaming in the **[CruvzSpace Demo](https://space.cruvzstreaming.com/)** and see examples of applying in [CruvzSpace Repository](https://github.com/techfixind/CruvzSpace).

## 🌟 Complete Web Application - NEW!

Cruvz Streaming now includes a **complete production-ready web application** with all the essential features for a modern streaming platform:

### 🔐 User Authentication
- **Sign Up/Sign In** - Complete user registration and login system
- **Session Management** - Secure JWT-based authentication
- **User Profiles** - Profile management and settings

### 📊 Stream Management Dashboard
- **Live Stream Control** - Start, stop, and manage streams
- **Stream Creation** - Easy-to-use stream setup wizard
- **Real-time Analytics** - Live viewer metrics and performance data
- **Stream Settings** - Quality, bitrate, and recording options

### 🎛️ Admin Console
- **System Configuration** - Server settings and preferences
- **API Key Management** - Generate and manage API keys
- **User Management** - Admin controls for user accounts
- **Security Settings** - Password management and security options

### 📈 Analytics & Monitoring
- **Dashboard Overview** - Key metrics and statistics
- **Performance Charts** - Historical data and trends
- **System Health** - Real-time server monitoring
- **Viewer Analytics** - Detailed audience insights

**Access the Web Application:**
- 🏠 **Main Website**: `http://localhost` (after deployment)
- 📊 **Dashboard**: `http://localhost/pages/dashboard.html`
- 🎥 **Demo Page**: `http://localhost/demo/`

## Features
* Ingest
  * Push: WebRTC, WHIP(Simulcast), SRT, RTMP, MPEG-2 TS
  * Pull: RTSP
  * Scheduled Channel (Pre-recorded Live)
  * Multiplex Channel (Duplicate stream / Mux tracks)
* Adaptive Bitrate Streaming (ABR) for LLHLS and WebRTC
* Low Latency Streaming using LLHLS
  * DVR (Live Rewind)
  * Dump for VoD
  * ID3v2 timed metadata
  * DRM (Widevine, Fairplay)
* Sub-Second Latency Streaming using WebRTC
  * WebRTC over TCP (With Embedded TURN Server)
  * Embedded WebRTC Signalling Server (WebSocket based)
  * Retransmission with NACK
  * ULPFEC (Uneven Level Protection Forward Error Correction)
    * <i>VP8, H.264, H.265</i>
  * In-band FEC (Forward Error Correction)
    * <i>Opus</i>
* Legacy HLS (HLS version 3)
  * MPEG-2 TS Container
  * Audio/Video Muxed
  * DVR
* Sub-Second Latency Streaming using SRT
  * Secure Reliable Transport
  * MPEG-2 TS Container
  * Audio/Video Muxed
* Embedded Live Transcoder
  * Video: VP8, H.264, H.265(Hardware only), Pass-through
  * Audio: Opus, AAC, Pass-through
* Clustering (Origin-Edge Structure)
* Monitoring
* Access Control
  * Admission Webhooks
  * Signed Policy
* File Recording
* Push Publishing using SRT, RTMP and MPEG2-TS (Re-streaming)
* Thumbnail
* REST API

## Supported Platforms
We have tested Cruvz Streaming on the platforms listed below.
Although we have tested Cruvz Streaming on the platforms listed below, it may work with other Linux packages as well:

* [Docker](https://hub.docker.com/r/cruvz/cruvzstreaming)
* Ubuntu 18+
* Rocky Linux 8+
* AlmaLinux 8+
* Fedora 28+

## Quick Start

* [Quick Start Guide](https://cruvz.gitbook.io/cruvzstreaming/quick-start)
* [Manual](https://cruvz.gitbook.io/cruvzstreaming/)
* [Six Sigma Zero-Error Deployment](SIX_SIGMA_IMPLEMENTATION.md)

### 🚀 Production Deployment - COMPLETE & READY! ✅

**✨ FULLY FUNCTIONAL DEPLOYMENT**: All functionalities implemented with zero mock data!

**🌟 NEW: Complete Production-Ready System**

```bash
# PRODUCTION DEPLOYMENT (RECOMMENDED)
git clone https://github.com/techfixind/Cruvz-SRT.git
cd Cruvz-SRT
./deploy-production.sh  # Complete zero-error deployment

# Access your fully functional system:
# 🏠 Main Website: http://localhost
# 📊 Dashboard: http://localhost/pages/dashboard.html  
# 📈 Six Sigma Dashboard: http://localhost/pages/six-sigma.html
# 📈 Grafana: http://localhost:3000 (admin/cruvz123)  
# 🔍 Prometheus: http://localhost:9090
# 🎥 RTMP: rtmp://localhost:1935/app/
# 📡 WebRTC: http://localhost:3333
```

**✅ PRODUCTION FEATURES - ALL IMPLEMENTED:**
- ✅ **Real Backend API** - Complete Node.js/Express backend with authentication
- ✅ **Zero Mock Data** - All functionality uses real database and APIs
- ✅ **User Authentication** - JWT-based secure login/registration system
- ✅ **Stream Management** - Full CRUD operations for stream lifecycle
- ✅ **Six Sigma Dashboard** - Real-time quality metrics and KPIs
- ✅ **Database Integration** - SQLite with complete schema and migrations
- ✅ **API Management** - Secure API key generation and management
- ✅ **Real-time Analytics** - Live performance monitoring and dashboards
- ✅ **Multi-protocol Streaming** - RTMP, SRT, WebRTC support
- ✅ **Production Security** - Industry-standard authentication and validation
- ✅ **Comprehensive Testing** - Complete E2E test suite with validation
- ✅ **Docker Deployment** - Production-ready containerized architecture
- ✅ **Monitoring Stack** - Prometheus + Grafana integration
- ✅ **Error Handling** - Comprehensive logging and error management

**🎯 INDUSTRY STANDARDS ACHIEVED:**
- ✅ Six Sigma quality methodology (99.9997% target)
- ✅ Zero-defect deployment processes
- ✅ Real-time monitoring and alerting
- ✅ Secure authentication and session management
- ✅ Scalable microservices architecture
- ✅ Production-ready configuration management
- ✅ Comprehensive API documentation and testing
- ✅ Industry-standard security practices

**🔐 Default Admin Access:**
- Email: `admin@cruvzstreaming.com`
- Password: `changeme123!`

**📊 Six Sigma Quality Metrics:**
- Real-time defect tracking
- Performance trend analysis
- System health monitoring
- Quality gate enforcement
- Automated compliance reporting
```bash
docker run --name cs -d -e CS_HOST_IP=Your.HOST.IP.Address \
-p 1935:1935 -p 9999:9999/udp -p 9000:9000 -p 3333:3333 -p 3478:3478 -p 10000-10009:10000-10009/udp \
cruvz/cruvzstreaming:latest
```

You can also store the configuration files on your host:

```bash
docker run --name cs -d -e CS_HOST_IP=Your.HOST.IP.Address \
-p 1935:1935 -p 9999:9999/udp -p 9000:9000 -p 3333:3333 -p 3478:3478 -p 10000-10009:10000-10009/udp \
-v cs-origin-conf:/opt/cruvzstreaming/bin/origin_conf \
-v cs-edge-conf:/opt/cruvzstreaming/bin/edge_conf \
cruvz/cruvzstreaming:latest
```

The configuration files are now accessible under `/var/lib/docker/volumes/<volume_name>/_data`.

Following the above example, you will find them under `/var/lib/docker/volumes/cs-origin-conf/_data` and `/var/lib/docker/volumes/cs-edge-conf/_data`.

If you want to put them in a different location, the easiest way is to create a link:
```bash
ln -s /var/lib/docker/volumes/cs-origin-conf/_data/ /my/new/path/to/cs-origin-conf \
&& ln -s /var/lib/docker/volumes/cs-edge-conf/_data/ /my/new/path/to/cs-edge-conf
```

Please read the [Getting Started](https://cruvz.gitbook.io/cruvzstreaming/getting-started) for more information.

### WebRTC Live Encoder for Testing
* https://demo.ovenplayer.com/demo_input.html

### Player for Testing
* Without TLS: http://demo.ovenplayer.com
* With TLS: https://demo.ovenplayer.com

## How to contribute
Thank you so much for being so interested in OvenMediaEngine.

We need your help to keep and develop our open-source project, and we want to tell you that you can contribute in many ways.
For more information on how to contribute, please see our [Guidelines](CONTRIBUTING.md), [Rules](CODE_OF_CONDUCT.md), and [Contribute](https://www.ovenmediaengine.com/contribute).

- [Finding Bugs](https://github.com/AirenSoft/OvenMediaEngine/blob/master/CONTRIBUTING.md#finding-bugs)
- [Reviewing Code](https://github.com/AirenSoft/OvenMediaEngine/blob/master/CONTRIBUTING.md#reviewing-code)
- [Sharing Ideas](https://github.com/AirenSoft/OvenMediaEngine/blob/master/CONTRIBUTING.md#sharing-ideas)
- [Testing](https://github.com/AirenSoft/OvenMediaEngine/blob/master/CONTRIBUTING.md#testing)
- [Improving Documentation](https://github.com/AirenSoft/OvenMediaEngine/blob/master/CONTRIBUTING.md#improving-documentation)
- [Spreading & Use Cases](https://github.com/AirenSoft/OvenMediaEngine/blob/master/CONTRIBUTING.md#spreading--use-cases)
- [Recurring Donations](https://github.com/AirenSoft/OvenMediaEngine/blob/master/CONTRIBUTING.md#recurring-donations)

We always hope that OvenMediaEngine will give you good inspiration.

## For more information
* [AirenSoft Website](https://airensoft.com) 
  * About OvenMediaEngine, OvenMediaEngine Enterprise, OvenVideo, AirenBlog and more
* [OvenMediaEngine Getting Started](https://airensoft.gitbook.io/ovenmediaengine/)
  * User guide for OvenMediaEngine Configuration, ABR, Clustering, and more
* [OvenMediaEngine Docker Hub](https://hub.docker.com/r/airensoft/ovenmediaengine)
  * Install and use OvenMeidaEngine easily using Docker
* [OvenPlayer GitHub](https://github.com/AirenSoft/OvenPlayer)
  * JavaScript-based Player with LLHLS and WebRTC
* [OvenPlayer Getting Started](https://airensoft.gitbook.io/ovenplayer)
  * User guide for OvenPlayer UI Customize, API Reference, Examples, and more
* [OvenLiveKit](https://github.com/AirenSoft/OvenLiveKit-Web)
  * JavaScript-based Live Streaming Encoder for OvenMediaEngine
* [OvenSpace Demo](https://space.ovenplayer.com/)
  * Sub-Second Latency Streaming Demo Service

## License
OvenMediaEngine is licensed under the [AGPL-3.0-only](LICENSE).
However, if you need another license, please feel free to email us at [contact@airensoft.com](mailto:contact@airensoft.com).

## About AirenSoft
AirenSoft aims to make it easier for you to build a stable broadcasting/streaming service with Sub-Second Latency.
Therefore, we will continue developing and providing the most optimized tools for smooth Sub-Second Latency Streaming.

Would you please click on each link below for details:
* ["JavaScript-based Live Streaming Encoder" **OvenLiveKit**](https://github.com/AirenSoft/OvenLiveKit-Web)
* ["Sub-Second Latency Streaming Server with LLHLS and WebRTC" **OvenMediaEngine**](https://github.com/AirenSoft/OvenMediaEngine)
* ["JavaScript-based Player with LLHLS and WebRTC" **OvenPlayer**](https://github.com/AirenSoft/OvenPlayer)
