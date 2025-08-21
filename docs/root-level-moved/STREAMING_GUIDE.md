# Cruvz Streaming - Quick Start Guide

## 🚀 Single Command Deployment

The repository has been cleaned and simplified. Use **only** this command to deploy:

```bash
./production-deploy.sh
```

## 📡 Streaming Endpoints

After deployment, your streaming platform will be available at:

### Frontend Access
- **Main Website**: http://localhost
- **Dashboard**: http://localhost/pages/dashboard.html

### Streaming Protocols
- **RTMP**: `rtmp://localhost:1935/app/stream_name`
- **SRT**: `srt://localhost:9999?streamid=app/stream_name`  
- **WebRTC**: `http://localhost:3333/app/stream_name`

### Monitoring
- **Grafana**: http://localhost:3000 (admin/cruvz123)
- **Prometheus**: http://localhost:9090

## 🎥 Creating Streams

1. **Sign up/Login** at the main website
2. **Access Dashboard** from the navigation menu
3. **Create New Stream** with your preferred settings:
   - Choose protocol (RTMP, SRT, WebRTC)
   - Set quality (720p, 1080p, 4K)
   - Configure bitrate and FPS
4. **Copy Stream URLs** provided in the dashboard
5. **Start Streaming** using OBS, FFmpeg, or compatible software

## 🛠️ Management Commands

```bash
./production-deploy.sh deploy    # Deploy all services
./production-deploy.sh stop      # Stop all services  
./production-deploy.sh logs      # View service logs
./production-deploy.sh status    # Check service status
./production-deploy.sh clean     # Clean deployment
```

## ✅ Verification

The repository is now clean with:
- ✅ **Single deployment script** (production-deploy.sh)
- ✅ **Essential shell scripts only** (9 total, mostly in dependencies)
- ✅ **Organized documentation** (root .md files moved to docs/)
- ✅ **Complete streaming functionality** (frontend + backend + protocols)
- ✅ **Full user management** (authentication, stream lifecycle)
- ✅ **Real-time monitoring** (Prometheus + Grafana)

## 🎯 Ready for Production

Your streaming platform includes:
- Full user authentication system
- Complete stream management (create, start, stop, monitor)
- Multi-protocol support (RTMP, SRT, WebRTC)
- Real-time analytics and monitoring
- Production-ready security and performance optimizations