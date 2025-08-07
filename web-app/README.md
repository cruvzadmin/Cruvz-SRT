# Cruvz Streaming Web Application

Complete web application interface for the Cruvz Streaming platform, providing all the missing UI components for a production-ready streaming service.

## Features Implemented

### 🔐 Authentication System
- **User Registration (Signup)** - Complete signup form with validation
- **User Login (Signin)** - Secure login with JWT token support
- **Session Management** - Persistent user sessions with automatic token refresh
- **User Profile Management** - User settings and profile editing

### 📊 Stream Management Dashboard
- **Live Stream Overview** - Real-time statistics and monitoring
- **Stream Creation Interface** - Easy-to-use stream setup wizard
- **Stream Controls** - Start, stop, edit, and delete streams
- **Stream Analytics** - Detailed performance metrics and viewer analytics
- **Multi-stream Management** - Handle multiple concurrent streams

### 🎛️ Admin Console
- **System Settings** - Configure streaming quality, bitrate, and other parameters
- **User Management** - Admin controls for user accounts
- **API Key Management** - Generate and manage API keys for integrations
- **Security Settings** - Password changes and security configurations

### 📈 Analytics & Monitoring
- **Real-time Metrics** - Live viewer counts, latency, and bandwidth usage
- **Historical Analytics** - Performance trends over time
- **Stream Performance** - Quality metrics and optimization insights
- **System Health** - Server status and resource monitoring

### 🎨 Modern UI/UX
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **Modern Interface** - Clean, professional design with smooth animations
- **Dark/Light Themes** - Adaptive theming for better user experience
- **Interactive Components** - Real-time updates and dynamic content

## File Structure

```
web-app/
├── index.html              # Landing page with authentication
├── pages/
│   └── dashboard.html      # Main dashboard interface
├── css/
│   ├── style.css          # Main application styles
│   └── dashboard.css      # Dashboard-specific styles
├── js/
│   ├── main.js           # Core application logic
│   └── dashboard.js      # Dashboard functionality
├── assets/
│   ├── logo.png          # Application logo
│   └── default-avatar.png # Default user avatar
└── nginx.conf            # Web server configuration
```

## API Integration

The web application integrates with the Cruvz Streaming API server through the following endpoints:

### Authentication Endpoints
- `POST /api/v1/auth/signup` - User registration
- `POST /api/v1/auth/signin` - User login
- `POST /api/v1/auth/validate` - Token validation
- `GET /api/v1/auth/me` - Get current user info

### Stream Management Endpoints
- `GET /api/v1/streams` - List all streams
- `POST /api/v1/streams` - Create new stream
- `PUT /api/v1/streams/{id}` - Update stream
- `DELETE /api/v1/streams/{id}` - Delete stream
- `POST /api/v1/streams/{id}/start` - Start stream
- `POST /api/v1/streams/{id}/stop` - Stop stream

### Analytics Endpoints
- `GET /api/v1/analytics/overview` - Dashboard statistics
- `GET /api/v1/analytics/streams` - Stream analytics

## Quick Setup

1. **Run the setup script:**
   ```bash
   ./setup-webapp.sh
   ```

2. **Start all services:**
   ```bash
   ./deploy.sh
   ```

3. **Access the application:**
   - Main Website: http://localhost
   - Dashboard: http://localhost/pages/dashboard.html
   - Analytics: http://localhost:3000 (Grafana)

## Features Overview

### Landing Page (`index.html`)
- Hero section with streaming statistics
- Feature showcase
- Authentication modals (signup/signin)
- Live demo functionality
- Call-to-action buttons

### Dashboard (`pages/dashboard.html`)
- Overview with key metrics
- Recent streams list
- Quick action cards
- Stream management interface
- Settings panels
- API key management

### Core Functionality
- Real-time data updates
- Form validation and error handling
- Responsive navigation
- Modal dialogs
- Notification system
- Clipboard integration
- Local storage for user sessions

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Security Features

- JWT token-based authentication
- CSRF protection
- XSS prevention
- Content Security Policy headers
- Secure cookie handling
- Input validation and sanitization

## Performance Optimizations

- Minified CSS and JavaScript
- Gzip compression
- Static asset caching
- Lazy loading for images
- Efficient DOM manipulation
- Debounced API calls

## Integration Points

The web application is designed to integrate seamlessly with:

1. **Cruvz Streaming Engine** - Core streaming functionality
2. **Prometheus** - Metrics collection
3. **Grafana** - Advanced analytics dashboard
4. **API Server** - Backend data and operations
5. **WebRTC** - Real-time streaming capabilities

## Development Notes

- Built with vanilla JavaScript for maximum compatibility
- CSS Grid and Flexbox for responsive layouts
- ES6+ features with fallbacks for older browsers
- Modular architecture for easy maintenance
- Comprehensive error handling
- Accessibility compliance (WCAG 2.1)

## Customization

The application can be easily customized:

1. **Branding** - Update colors, logos, and fonts in `css/style.css`
2. **Features** - Add new sections in the dashboard
3. **API Endpoints** - Modify `js/main.js` for different backend APIs
4. **Layouts** - Adjust responsive breakpoints and grid layouts

This web application provides a complete, production-ready interface for the Cruvz Streaming platform, addressing all the missing UI components mentioned in the original requirements.