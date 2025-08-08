# Cruvz Streaming API Documentation

## Overview

The Cruvz Streaming API provides endpoints for managing streams, users, authentication, and analytics in the Cruvz Streaming platform.

Base URL: `http://localhost:5000`

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Health Check

#### GET /health
Returns the health status of the API server.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-08T18:00:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

### Authentication

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one lowercase letter
- At least one uppercase letter
- At least one digit
- At least one special character (!@#$%^&*)

**Response:**
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

#### POST /api/auth/login
Login with existing credentials.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### User Management

#### GET /api/users/profile
Get the current user's profile (Protected).

**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "created_at": "2025-08-08T18:00:00.000Z"
}
```

#### PUT /api/users/profile
Update the current user's profile (Protected).

**Request Body:**
```json
{
  "name": "John Updated",
  "email": "john.updated@example.com"
}
```

#### POST /api/users/change-password
Change user password (Protected).

**Request Body:**
```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewPassword123!"
}
```

### Stream Management

#### GET /api/streams
Get all streams for the authenticated user (Protected).

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 10)
- `status` (optional): Filter by stream status
- `protocol` (optional): Filter by protocol (rtmp, srt, webrtc)

**Response:**
```json
{
  "streams": [
    {
      "id": 1,
      "title": "My Live Stream",
      "description": "Live gaming stream",
      "protocol": "rtmp",
      "status": "live",
      "stream_key": "stream_abc123",
      "settings": {
        "quality": "1080p",
        "bitrate": 5000,
        "fps": 30,
        "audio_bitrate": 128
      },
      "created_at": "2025-08-08T18:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pages": 1
}
```

#### POST /api/streams
Create a new stream (Protected).

**Request Body:**
```json
{
  "title": "My New Stream",
  "description": "Description of my stream",
  "protocol": "rtmp",
  "settings": {
    "quality": "1080p",
    "bitrate": 5000,
    "fps": 30,
    "audio_bitrate": 128
  },
  "max_viewers": 1000,
  "is_recording": false
}
```

#### GET /api/streams/:id
Get details of a specific stream (Protected).

#### PUT /api/streams/:id
Update a stream (Protected).

#### DELETE /api/streams/:id
Delete a stream (Protected).

#### POST /api/streams/:id/start
Start a stream (Protected).

#### POST /api/streams/:id/stop
Stop a stream (Protected).

### Analytics

#### GET /api/analytics/dashboard
Get analytics dashboard data (Protected).

**Query Parameters:**
- `timeframe` (optional): Time range (1h, 24h, 7d, 30d) (default: 24h)

**Response:**
```json
{
  "streams": {
    "total_streams": 5,
    "active_streams": 2,
    "completed_streams": 3
  },
  "performance": {
    "avg_viewers": 150,
    "max_viewers": 500,
    "total_viewers": 1500,
    "avg_duration": 3600,
    "total_data_mb": 1024
  },
  "trending": [
    {
      "date": "2025-08-08",
      "viewers": 200,
      "streams": 3
    }
  ]
}
```

### Six Sigma Quality Metrics

#### GET /api/six-sigma/metrics
Get Six Sigma quality metrics (Protected, Admin only).

#### GET /api/six-sigma/reports
Generate Six Sigma compliance reports (Protected, Admin only).

## Error Responses

All error responses follow this format:
```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error

## Rate Limiting

- General API: 100 requests per 15 minutes per IP
- Authentication endpoints: 5 requests per 15 minutes per IP

## Streaming Protocols

### RTMP
- Endpoint: `rtmp://localhost:1935/app/stream_name`
- Use your stream key as `stream_name`

### SRT
- Endpoint: `srt://localhost:9999?streamid=app/stream_name`
- Use your stream key as `stream_name`

### WebRTC
- Endpoint: `http://localhost:3333/app/stream_name`
- Use your stream key as `stream_name`