# Cruvz Streaming - Production-Ready Sub-Second Latency Streaming Platform

<img src="dist/OME_LLHLS_220610.svg" style="max-width: 100%; height: auto;">

## 🚀 SINGLE-COMMAND PRODUCTION DEPLOYMENT

**Zero-error production deployment with advanced security, monitoring, and performance optimization.**

```bash
git clone https://github.com/techfixind/Cruvz-SRT.git
cd Cruvz-SRT
./production-deploy.sh
```

**That's it!** Your production streaming platform is ready.

---

## ✨ Production Features

### 🎯 **Complete Production System**
- ✅ **Real Backend API** - JWT authentication, role-based access, comprehensive validation
- ✅ **Production Database** - SQLite with optimized schema and migrations
- ✅ **Advanced Security** - Helmet.js, rate limiting, CSP headers, input validation
- ✅ **Zero Mock Data** - All functionality uses real APIs and database
- ✅ **Performance Optimized** - Docker multi-stage builds, nginx compression, Redis caching

### 🔒 **Enterprise Security**
- ✅ **JWT Authentication** - Secure token-based authentication with refresh tokens
- ✅ **Rate Limiting** - API protection with different limits for auth/streaming/general endpoints
- ✅ **Security Headers** - HSTS, CSP, XSS protection, clickjacking prevention
- ✅ **Input Validation** - Comprehensive Joi schema validation on all endpoints
- ✅ **Password Security** - bcrypt with configurable rounds, password complexity requirements

### 📊 **Real-Time Analytics & Monitoring**
- ✅ **Prometheus Metrics** - System and application metrics collection
- ✅ **Grafana Dashboards** - Beautiful real-time monitoring dashboards
- ✅ **Stream Analytics** - Viewer counts, performance metrics, quality monitoring
- ✅ **Error Tracking** - Comprehensive error logging and alerting
- ✅ **Performance Monitoring** - API response times, resource usage tracking

### 🎥 **Advanced Streaming Engine**
- ✅ **Sub-Second Latency** - WebRTC streaming with <100ms latency
- ✅ **Multi-Protocol Support** - RTMP, SRT, WebRTC ingestion and delivery
- ✅ **Adaptive Bitrate** - Automatic quality adjustment based on connection
- ✅ **Live Transcoding** - Hardware-accelerated H.264/H.265/VP8 encoding
- ✅ **Recording & DVR** - Live stream recording with instant replay

### 💼 **Complete Business Logic**
- ✅ **User Management** - Registration, authentication, profile management, roles
- ✅ **Stream Lifecycle** - Create, configure, start, stop, monitor, delete streams
- ✅ **API Management** - API key generation, rate limiting, usage tracking
- ✅ **Admin Controls** - User management, system monitoring, configuration

---

## 🌐 Access Your Production System

After deployment, access these endpoints:

| Service | URL | Credentials |
|---------|-----|-------------|
| **🏠 Main Website** | `http://localhost` | - |
| **📊 Admin Dashboard** | `http://localhost/pages/dashboard.html` | Sign up/Login |
| **📈 Grafana Monitoring** | `http://localhost:3000` | `admin / cruvz123` |
| **🔍 Prometheus Metrics** | `http://localhost:9090` | - |
| **🔗 Backend API** | `http://localhost:5000` | API Documentation |

## 📡 Streaming Endpoints

| Protocol | Endpoint | Usage |
|----------|----------|-------|
| **RTMP** | `rtmp://localhost:1935/app/stream_name` | OBS, FFmpeg, Broadcasting software |
| **SRT** | `srt://localhost:9999?streamid=app/stream_name` | Professional broadcast equipment |
| **WebRTC** | `http://localhost:3333/app/stream_name` | Browser-based streaming |

## Demo https://space.cruvzstreaming.com/

<img src="dist/05_OvenSpace_230214.png" style="max-width: 100%; height: auto;">

CruvzSpace is a sub-second latency streaming demo service using [Cruvz Streaming](https://github.com/techfixind/Cruvz-SRT), [CruvzPlayer](https://github.com/techfixind/CruvzPlayer) and [CruvzLiveKit](https://github.com/techfixind/CruvzLiveKit-Web). You can experience Cruvz Streaming in the **[CruvzSpace Demo](https://space.cruvzstreaming.com/)**.

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

### 🚀 Single-Command Production Deployment ✅

**✨ SIMPLIFIED ZERO-ERROR DEPLOYMENT**: Complete production system with one command!

```bash
# PRODUCTION DEPLOYMENT
git clone https://github.com/techfixind/Cruvz-SRT.git
cd Cruvz-SRT
./production-deploy.sh  # Single command for complete deployment

# Access your fully functional system:
# 🏠 Main Website: http://localhost
# 📊 Dashboard: http://localhost/pages/dashboard.html  
# 📈 Grafana: http://localhost:3000 (admin/cruvz123)  
# 🔍 Prometheus: http://localhost:9090
# 🔗 Backend API: http://localhost:5000
# 🎥 RTMP: rtmp://localhost:1935/app/stream_name
# 📡 WebRTC: http://localhost:3333/app/stream_name
# 🔒 SRT: srt://localhost:9999?streamid=app/stream_name
```

**🛠️ Management Commands:**
```bash
./production-deploy.sh         # Deploy all services
./production-deploy.sh stop    # Stop all services  
./production-deploy.sh logs    # View service logs
./production-deploy.sh status  # Check service status
./production-deploy.sh clean   # Clean deployment
./production-deploy.sh help    # Show all commands
```

**📊 Production Features:**
- ✅ **Real Backend API** - Complete Node.js/Express backend with authentication
- ✅ **Zero Mock Data** - All functionality uses real database and APIs
- ✅ **User Authentication** - JWT-based secure login/registration system
- ✅ **Stream Management** - Full CRUD operations for stream lifecycle
- ✅ **Database Integration** - SQLite with complete schema and migrations
- ✅ **Real-time Analytics** - Live performance monitoring and dashboards
- ✅ **Multi-protocol Streaming** - RTMP, SRT, WebRTC support
- ✅ **Production Security** - Industry-standard authentication and validation
- ✅ **Docker Deployment** - Production-ready containerized architecture
- ✅ **Monitoring Stack** - Prometheus + Grafana integration
- ✅ **Zero-Error Deployment** - Comprehensive validation and error handling

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
