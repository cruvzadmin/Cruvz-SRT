# 🎥 Cruvz-SRT Kubernetes Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Cruvz-SRT enterprise streaming platform on Kubernetes with production-grade configuration, monitoring, and Six Sigma quality metrics.

## Prerequisites

### Required Infrastructure
- **Kubernetes Cluster**: v1.20+ with at least 3 nodes
- **kubectl**: Configured and connected to your cluster
- **Docker**: For building container images
- **Persistent Storage**: 50GB+ total (PostgreSQL, recordings, logs)
- **Resources**: 8 CPU cores, 16GB RAM minimum per node

### Network Requirements
- **LoadBalancer support** (cloud provider or MetalLB)
- **Ingress Controller** (NGINX recommended)
- **External IP ranges** for streaming protocols
- **Port ranges**: 10000-10100 (WebRTC), 31935-39999 (NodePort services)

## Quick Deployment

### 1. Single-Command Deployment

```bash
./deploy-kubernetes.sh
```

This script will:
- ✅ Build all production Docker images
- ✅ Deploy complete Kubernetes manifests
- ✅ Set up monitoring with Prometheus & Grafana
- ✅ Configure OvenMediaEngine with all protocols
- ✅ Initialize PostgreSQL with production schema
- ✅ Provide service URLs and streaming endpoints

### 2. Manual Step-by-Step Deployment

```bash
# Build Docker images
docker build -t cruvz-srt-backend:latest ./backend/
docker build -t cruvz-srt-frontend:latest ./frontend/
docker build -t cruvz-srt-origin:latest .

# Deploy to Kubernetes
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml

# Wait for infrastructure
kubectl wait --for=condition=ready pod -l app=postgres -n cruvz-srt --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n cruvz-srt --timeout=300s

# Deploy application services
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/ovenmediaengine.yaml
kubectl apply -f k8s/frontend.yaml

# Deploy monitoring
kubectl apply -f k8s/monitoring.yaml
kubectl apply -f k8s/grafana.yaml

# Wait for all services
kubectl wait --for=condition=available deployment --all -n cruvz-srt --timeout=600s
```

## Architecture Components

### Core Services
- **PostgreSQL**: Primary database with optimized configuration
- **Redis**: Caching and session storage
- **Backend API**: Node.js/Express with comprehensive routing
- **OvenMediaEngine**: Complete streaming engine with all protocols
- **Frontend**: React/TypeScript with Material-UI

### Monitoring Stack
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Real-time dashboards and visualization
- **Node Exporter**: System metrics collection
- **Fluent Bit**: Log aggregation and processing

### Protocols Supported
- **RTMP**: Port 31935 (OBS, FFmpeg input)
- **SRT**: Ports 31999 (input), 31998 (output)
- **WebRTC**: Port 33333 (browser streaming)
- **LL-HLS**: Port 38088 (low-latency playback)
- **HLS**: Port 38088 (standard playback)
- **Thumbnails**: Port 38081 (preview images)

## Configuration

### Environment Variables

All configuration is managed through ConfigMaps and Secrets:

```yaml
# ConfigMap values (k8s/configmap.yaml)
NODE_ENV: "production"
POSTGRES_HOST: "postgres-service"
REDIS_HOST: "redis-service"
MAX_CONCURRENT_STREAMS: "1000"
MAX_VIEWERS_PER_STREAM: "10000"

# Secret values (k8s/secrets.yaml) - base64 encoded
POSTGRES_PASSWORD: Y3J1dnpTUlQ5MQ==  # cruvzSRT91
JWT_SECRET: Y3J1dnpfc3RyZWFtaW5nX3NlY3JldF9wcm9kdWN0aW9uXzIwMjU=
OME_ACCESS_TOKEN: Y3J1dnpfcHJvZHVjdGlvbl9hcGlfdG9rZW5fMjAyNQ==
```

### OvenMediaEngine Configuration

Complete streaming engine configuration with optimized settings:

```xml
<!-- Multiple bitrate transcoding -->
<OutputProfile>
    <Name>720p</Name>
    <Video>
        <Codec>h264</Codec>
        <Bitrate>2000000</Bitrate>
        <Width>1280</Width>
        <Height>720</Height>
    </Video>
</OutputProfile>

<!-- All protocol publishers -->
<Publishers>
    <LLHLS />
    <WebRTC />
    <SRT />
    <Thumbnail />
</Publishers>
```

## Service Access

### Getting Service URLs

```bash
# Get external IPs
kubectl get services -n cruvz-srt

# Get NodePort URLs
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}')
echo "Frontend: http://$NODE_IP:$(kubectl get svc frontend-service -n cruvz-srt -o jsonpath='{.spec.ports[0].nodePort}')"
echo "Grafana: http://$NODE_IP:$(kubectl get svc grafana-service -n cruvz-srt -o jsonpath='{.spec.ports[0].nodePort}')"

# Port forwarding for API access
kubectl port-forward service/backend-service 5000:5000 -n cruvz-srt
kubectl port-forward service/ovenmediaengine-service 8080:8080 -n cruvz-srt
```

### Default Credentials

- **Grafana**: admin / cruvz123
- **Admin User**: admin@cruvzstreaming.com / Adm1n_Test_2025!_Qx7R$$gL3
- **Demo Streamer**: demo.streamer@cruvz.com / Demo123!_Stream

## Streaming Endpoints

### Input Endpoints (Publishing)

```bash
# RTMP (OBS/FFmpeg)
rtmp://$NODE_IP:31935/app/{stream_key}

# SRT (Low latency)
srt://$NODE_IP:31999?streamid=input/app/{stream_key}

# WebRTC (Browser)
ws://$NODE_IP:33333/app/{stream_key}
```

### Output Endpoints (Playback)

```bash
# LL-HLS (Ultra low latency)
http://$NODE_IP:38088/app/{stream_key}/llhls.m3u8

# HLS (Standard)
http://$NODE_IP:38088/app/{stream_key}/playlist.m3u8

# SRT Output
srt://$NODE_IP:31998?streamid=app/{stream_key}

# WebRTC Playback
ws://$NODE_IP:33333/app/{stream_key}

# Thumbnails
http://$NODE_IP:38081/app/{stream_key}/thumb.jpg
```

## Monitoring & Health Checks

### Prometheus Metrics

```bash
# Access Prometheus
kubectl port-forward service/prometheus-service 9090:9090 -n cruvz-srt

# Key metrics available:
- streams_active: Number of live streams
- viewers_total: Total concurrent viewers
- ome_total_connections: OvenMediaEngine connections
- node_cpu_usage: System CPU utilization
- node_memory_usage: Memory utilization
```

### Grafana Dashboards

Pre-configured dashboards include:
- **Streaming Platform Overview**: System health and performance
- **Six Sigma Quality Metrics**: Quality levels and defect tracking
- **OvenMediaEngine Stats**: Streaming engine performance
- **Infrastructure Monitoring**: Kubernetes cluster health

### Health Check Endpoints

```bash
# System health
curl http://$NODE_IP:$BACKEND_PORT/api/health

# OvenMediaEngine health
curl http://$NODE_IP:$OME_PORT/v1/stats/current -H "Authorization: cruvz-production-api-token-2025"

# Six Sigma dashboard
curl http://$NODE_IP:$BACKEND_PORT/api/six-sigma/dashboard
```

## Six Sigma Quality Metrics

### Quality Levels

- **6σ (World Class)**: 3.4 defects per million opportunities
- **4.5σ (Excellent)**: 1,350 defects per million
- **3.4σ (Good)**: 22,700 defects per million
- **2σ (Average)**: 308,537 defects per million

### Tracked Metrics

- **Performance**: API response times, throughput
- **Streaming Engine**: Connection success rates, latency
- **Network**: Bandwidth utilization, packet loss
- **Quality**: Stream quality, transcoding success

### Dashboard Access

```bash
# Access quality dashboard
http://$NODE_IP:$FRONTEND_PORT/six-sigma-quality

# API endpoints
GET /api/six-sigma/metrics
GET /api/six-sigma/dashboard
GET /api/six-sigma/report
POST /api/six-sigma/metrics
```

## Scaling & Performance

### Horizontal Scaling

```bash
# Scale backend replicas
kubectl scale deployment/backend --replicas=5 -n cruvz-srt

# Scale frontend replicas
kubectl scale deployment/frontend --replicas=3 -n cruvz-srt

# Scale Redis (if using Redis Cluster)
kubectl scale statefulset/redis --replicas=3 -n cruvz-srt
```

### Vertical Scaling

Update resource limits in deployment manifests:

```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "2"
  limits:
    memory: "4Gi"
    cpu: "4"
```

### Auto-scaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: cruvz-srt
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Production Optimization

### Database Tuning

PostgreSQL is configured with production-optimized settings:

```yaml
args:
- postgres
- -c
- max_connections=200
- -c
- shared_buffers=256MB
- -c
- effective_cache_size=1GB
- -c
- work_mem=4MB
```

### OvenMediaEngine Optimization

```xml
<Bind>
    <Publishers>
        <AppWorkerCount>1</AppWorkerCount>
        <StreamWorkerCount>4</StreamWorkerCount>
    </Publishers>
</Bind>
```

### Network Optimization

- **ICE Candidates**: 10000-10100 for WebRTC
- **Buffer Sizes**: Optimized for low latency
- **Connection Pools**: Configured for high concurrency

## Troubleshooting

### Common Issues

1. **Pods Not Starting**
   ```bash
   kubectl describe pod <pod-name> -n cruvz-srt
   kubectl logs <pod-name> -n cruvz-srt
   ```

2. **Database Connection Issues**
   ```bash
   kubectl exec -it deployment/postgres -n cruvz-srt -- pg_isready -U cruvz
   ```

3. **OvenMediaEngine API Issues**
   ```bash
   kubectl port-forward service/ovenmediaengine-service 8080:8080 -n cruvz-srt
   curl http://localhost:8080/v1/stats/current -H "Authorization: cruvz-production-api-token-2025"
   ```

4. **Storage Issues**
   ```bash
   kubectl get pvc -n cruvz-srt
   kubectl describe pvc <pvc-name> -n cruvz-srt
   ```

### Log Analysis

```bash
# Application logs
kubectl logs -f deployment/backend -n cruvz-srt
kubectl logs -f deployment/ovenmediaengine -n cruvz-srt

# Aggregated logs
kubectl logs -f deployment/log-aggregator -n cruvz-srt

# Monitor events
kubectl get events -n cruvz-srt --sort-by='.lastTimestamp'
```

### Performance Monitoring

```bash
# Resource usage
kubectl top nodes
kubectl top pods -n cruvz-srt

# Network monitoring
kubectl exec -it deployment/backend -n cruvz-srt -- netstat -tuln
```

## Security

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: cruvz-srt-network-policy
  namespace: cruvz-srt
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: cruvz-srt
```

### RBAC Configuration

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: cruvz-srt
  name: cruvz-srt-role
rules:
- apiGroups: [""]
  resources: ["pods", "services"]
  verbs: ["get", "list", "watch"]
```

### Security Contexts

All containers run with security contexts:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  allowPrivilegeEscalation: false
  capabilities:
    drop:
    - ALL
```

## Backup & Recovery

### Database Backup

```bash
# Create backup
kubectl exec deployment/postgres -n cruvz-srt -- pg_dump -U cruvz cruvzdb > backup.sql

# Restore backup
kubectl exec -i deployment/postgres -n cruvz-srt -- psql -U cruvz cruvzdb < backup.sql
```

### Configuration Backup

```bash
# Export all manifests
kubectl get all,configmap,secret,pvc -n cruvz-srt -o yaml > cruvz-srt-backup.yaml
```

## Support & Maintenance

### Regular Maintenance

1. **Update Images**: Rebuild and deploy latest versions
2. **Monitor Metrics**: Check Six Sigma dashboards daily
3. **Log Rotation**: Configure log retention policies
4. **Certificate Management**: Renew TLS certificates
5. **Backup Verification**: Test restore procedures monthly

### Emergency Procedures

1. **Service Restart**: `kubectl rollout restart deployment/<name> -n cruvz-srt`
2. **Database Recovery**: Use automated backup restoration
3. **Traffic Rerouting**: Scale down problematic services
4. **Incident Response**: Follow runbook procedures

### Getting Help

- **Logs**: Check application and infrastructure logs
- **Metrics**: Review Prometheus alerts and Grafana dashboards
- **Health Checks**: Use built-in health endpoints
- **Documentation**: Refer to component-specific docs

## Conclusion

This Kubernetes deployment provides a production-ready, scalable, and highly available streaming platform with comprehensive monitoring, quality metrics, and operational tooling. The platform is designed to handle thousands of concurrent streams while maintaining Six Sigma quality standards.

For additional support or advanced configuration, refer to the component documentation or contact the platform team.