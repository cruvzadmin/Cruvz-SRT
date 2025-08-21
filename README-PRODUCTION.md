# 🎯 Cruvz Streaming - Production-Ready Streaming Platform

[![Production Ready](https://img.shields.io/badge/Production-Ready-green.svg)](https://github.com/cruvzadmin/Cruvz-SRT)
[![Six Sigma](https://img.shields.io/badge/Quality-Six%20Sigma-blue.svg)](https://github.com/cruvzadmin/Cruvz-SRT)
[![Zero Errors](https://img.shields.io/badge/Deployment-Zero%20Errors-brightgreen.svg)](https://github.com/cruvzadmin/Cruvz-SRT)

**Enterprise-grade streaming platform with zero-error deployment and Six Sigma quality standards.**

## 🚀 One-Command Production Deployment

```bash
# Clone and deploy instantly
git clone https://github.com/cruvzadmin/Cruvz-SRT.git
cd Cruvz-SRT
./deploy.sh
```

**🎉 That's it!** Your production streaming platform is ready with:
- ✅ Backend API with authentication
- ✅ Multi-protocol streaming (WebRTC, SRT, RTMP) 
- ✅ Real-time monitoring & analytics
- ✅ Production database & caching
- ✅ Zero-error deployment validation

## 🌐 Production Endpoints

After deployment, access your platform at:

| Service | URL | Description |
|---------|-----|-------------|
| **Main Website** | http://localhost | User interface and dashboard |
| **Backend API** | http://localhost:5000 | RESTful API with authentication |
| **Health Check** | http://localhost:5000/health | System health monitoring |
| **Prometheus** | http://localhost:9090 | Metrics and monitoring |
| **Grafana** | http://localhost:3000 | Analytics dashboards |

## 📡 Streaming Protocols

| Protocol | Endpoint | Use Case |
|----------|----------|----------|
| **RTMP** | `rtmp://localhost:1935/app/stream_name` | OBS Studio, broadcast software |
| **WebRTC** | `http://localhost:3333/app/stream_name` | Browser-based streaming |
| **SRT** | `srt://localhost:9999?streamid=app/stream_name` | Secure reliable transport |

## 🎬 User Workflows

### 1. User Registration & Authentication
```bash
# Test user registration
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","email":"john@example.com","password":"secure123"}'
```

### 2. Stream Management
```bash
# Create a new stream
curl -X POST http://localhost:5000/api/streams \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Stream","description":"Live event"}'
```

### 3. Start Streaming
```bash
# Start stream and get URLs
curl -X POST http://localhost:5000/api/streams/STREAM_ID/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Six Sigma Quality Metrics

Run comprehensive quality validation:

```bash
./six-sigma-validation.sh
```

**Quality Gates:**
- ✅ Service Availability: 99.99966%
- ✅ API Response Time: <100ms
- ✅ Error Rate: <0.001%
- ✅ Memory Usage: <80%
- ✅ User Workflows: 100% functional

## 🔧 Management Commands

```bash
./deploy.sh status    # Check service status
./deploy.sh logs      # View real-time logs  
./deploy.sh stop      # Stop all services
./deploy.sh test      # Run validation tests
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   Backend API   │    │ Streaming Engine│
│    (Nginx)      │◄──►│   (Node.js)     │◄──►│ (OvenMediaEngine│
│   Port: 80      │    │   Port: 5000    │    │   Port: 8080    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │     Redis       │    │   Monitoring    │
│   Database      │    │     Cache       │    │ (Prometheus/    │
│   Port: 5432    │    │   Port: 6379    │    │  Grafana)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛡️ Production Features

- **🔐 Security**: JWT authentication, CORS protection, rate limiting
- **📊 Monitoring**: Comprehensive metrics with Prometheus & Grafana
- **⚡ Performance**: Redis caching, connection pooling, optimized queries
- **🔄 Reliability**: Health checks, auto-restart policies, graceful shutdowns
- **📈 Scalability**: Horizontal scaling ready, microservices architecture

## 📚 Documentation

Full documentation available in the [docs/](docs/) directory:

- [API Documentation](docs/API.md)
- [Six Sigma Implementation](docs/reports/SIX_SIGMA_IMPLEMENTATION.md) 
- [Production Deployment Guide](docs/root-level-moved/PRODUCTION_DEPLOYMENT.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run quality validation: `./six-sigma-validation.sh`
5. Submit a pull request

## 📄 License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

---

**🎯 Ready for production use with zero errors and Six Sigma quality standards!**