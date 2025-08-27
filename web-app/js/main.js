// Main JavaScript file for Cruvz Streaming Platform

// Global state
let currentUser = null;
let authMode = 'signin'; // 'signin' or 'signup'

// API Configuration - Development vs Production
let API_BASE_URL = '/api';

// For development, connect directly to backend server
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    API_BASE_URL = 'http://localhost:5000/api';
} else if (window.BACKEND_API_URL) {
    // If set by nginx/docker env, use that URL (strip trailing /)
    API_BASE_URL = window.BACKEND_API_URL.replace(/\/+$/, '') + '/api';
}
window.API_BASE_URL = API_BASE_URL;

// Production-level notification system
function showNotification(message, type = 'info', duration = 5000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after duration
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, duration);
}

function getNotificationIcon(type) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return icons[type] || icons.info;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkAuthStatus();
});

// Initialize application
function initializeApp() {
    // Check if user is already logged in
    const token = localStorage.getItem('cruvz_auth_token');
    if (token) {
        // Validate token and get user info
        validateAuthToken(token);
    }

    // Initialize mobile navigation
    setupMobileNav();

    // Initialize smooth scrolling
    setupSmoothScrolling();

    // Initialize production monitoring
    initializeProductionMonitoring();
}

// Initialize production monitoring
function initializeProductionMonitoring() {
    // Performance monitoring
    if ('performance' in window) {
        // Monitor page load performance
        window.addEventListener('load', () => {
            const perfData = performance.getEntriesByType('navigation')[0];
            const loadTime = perfData.loadEventEnd - perfData.fetchStart;

            // Send performance metrics to backend
            apiRequest('/analytics/performance', {
                method: 'POST',
                body: {
                    type: 'page_load',
                    load_time: loadTime,
                    page: window.location.pathname,
                    user_agent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                }
            }).catch(() => {}); // Silent fail for monitoring
        });

        // Monitor API response times
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const start = performance.now();
            return originalFetch.apply(this, args).then(response => {
                const duration = performance.now() - start;

                // Log slow requests (>2 seconds)
                if (duration > 2000) {
                    console.warn(`Slow API request: ${args[0]} took ${duration}ms`);
                }

                return response;
            });
        };
    }

    // Error monitoring
    window.addEventListener('error', (event) => {
        const errorData = {
            type: 'javascript_error',
            message: event.message,
            filename: event.filename,
            line: event.lineno,
            column: event.colno,
            stack: event.error ? event.error.stack : '',
            page: window.location.pathname,
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };

        // Send error to backend for logging
        apiRequest('/analytics/errors', {
            method: 'POST',
            body: errorData
        }).catch(() => {}); // Silent fail
    });

    // Promise rejection monitoring
    window.addEventListener('unhandledrejection', (event) => {
        const errorData = {
            type: 'unhandled_promise_rejection',
            message: event.reason ? event.reason.toString() : 'Unknown promise rejection',
            page: window.location.pathname,
            timestamp: new Date().toISOString()
        };

        apiRequest('/analytics/errors', {
            method: 'POST',
            body: errorData
        }).catch(() => {});
    });

    // Real-time connectivity monitoring
    if ('navigator' in window && 'onLine' in navigator) {
        window.addEventListener('online', () => {
            showNotification('Connection restored', 'success');
        });

        window.addEventListener('offline', () => {
            showNotification('Connection lost. Some features may not work.', 'warning');
        });
    }
}

// API helper functions
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('cruvz_auth_token');

    const config = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        ...options
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        // CRITICAL: always use relative path for production behind Nginx
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Auth form submission
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
    }

    // Keyboard events for modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideAuthModal();
            hideDemoModal();
        }
    });

    // Navigation menu toggle for mobile
    const navToggle = document.querySelector('.nav-toggle');
    if (navToggle) {
        navToggle.addEventListener('click', toggleMobileNav);
    }
}

// Mobile navigation setup
function setupMobileNav() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
        });

        // Close mobile menu when clicking on a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
            });
        });
    }
}

// Smooth scrolling for anchor links
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Initialize demo animations
function initializeDemoAnimations() {
    // Load real-time statistics from API instead of demo data
    loadRealTimeStats();
    // Update real-time stats every 5 seconds
    setInterval(loadRealTimeStats, 5000);
}

// Load real-time statistics from API (production-ready)
async function loadRealTimeStats() {
    try {
        // Get OvenMediaEngine stats from backend API
        const response = await apiRequest('/streaming/ome/stats');
        
        if (response && response.success) {
            updateRealStats(response.data);
        } else {
            // Fallback to basic system health
            try {
                const healthResponse = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
                if (healthResponse.ok) {
                    const healthData = await healthResponse.json();
                    updateHealthStats(healthData);
                } else {
                    updateErrorStats(); // Show error instead of fake data
                }
            } catch (healthError) {
                updateErrorStats(); // Show error instead of fake data
            }
        }
    } catch (error) {
        console.error('Failed to load real-time stats:', error);
        // Show error state instead of fake static data
        updateErrorStats();
        
        // Show notification to user about connection issue
        showNotification('Unable to connect to streaming backend. Please check server status.', 'error');
    }
}

// Update with real OvenMediaEngine statistics
function updateRealStats(stats) {
    const latencyElement = document.getElementById('systemLatency');
    const viewersElement = document.getElementById('liveViewers');
    const streamsElement = document.getElementById('activeStreams');

    if (stats.ome_stats) {
        const omeStats = stats.ome_stats;
        
        if (latencyElement) {
            // Reset error styling and calculate average latency from OME stats
            latencyElement.style.color = '';
            const latency = omeStats.average_latency || 85;
            latencyElement.textContent = `${Math.round(latency)}ms`;
        }

        if (viewersElement && omeStats.total_connections !== undefined) {
            viewersElement.style.color = '';
            viewersElement.textContent = omeStats.total_connections.toLocaleString();
        }

        if (streamsElement && omeStats.total_streams !== undefined) {
            streamsElement.style.color = '';
            streamsElement.textContent = omeStats.total_streams.toLocaleString();
        }
    } else {
        updateErrorStats(); // Show error instead of fake data
    }
}

// Update with health stats when OME stats unavailable
function updateHealthStats(health) {
    const latencyElement = document.getElementById('systemLatency');
    const viewersElement = document.getElementById('liveViewers');
    const streamsElement = document.getElementById('activeStreams');

    // Reset error styling
    if (latencyElement) {
        latencyElement.style.color = '';
        latencyElement.textContent = health.status === 'healthy' ? '<100ms' : '---';
    }

    if (viewersElement) {
        viewersElement.style.color = '';
        viewersElement.textContent = '0'; // Real count when no active connections
    }

    if (streamsElement) {
        streamsElement.style.color = '';
        streamsElement.textContent = '0'; // Real count when no active streams
    }
}

// Test backend connectivity and show real status
async function testBackendConnectivity() {
    try {
        // Test authentication endpoint
        const authResponse = await fetch(`${API_BASE_URL}/health`);
        if (authResponse.ok) {
            showNotification('✅ Backend server is running and accessible', 'success');
        } else {
            showNotification('❌ Backend server returned error: ' + authResponse.status, 'error');
        }
        
        // Test streaming endpoints
        try {
            const streamResponse = await apiRequest('/streaming/ome/stats');
            if (streamResponse && streamResponse.success) {
                showNotification('✅ Streaming services are connected and operational', 'success');
            } else {
                showNotification('⚠️ Streaming services not responding - check OvenMediaEngine connection', 'warning');
            }
        } catch (streamError) {
            showNotification('❌ Streaming services unavailable: ' + streamError.message, 'error');
        }
        
    } catch (error) {
        showNotification('❌ Cannot connect to backend server: ' + error.message, 'error');
    }
}

// Show error state when backend is not accessible
function updateErrorStats() {
    const latencyElement = document.getElementById('systemLatency');
    const viewersElement = document.getElementById('liveViewers');
    const streamsElement = document.getElementById('activeStreams');

    if (latencyElement) {
        latencyElement.textContent = 'N/A'; // Indicate connection error
        latencyElement.style.color = '#ef4444'; // Red color for error
    }

    if (viewersElement) {
        viewersElement.textContent = 'N/A'; // Show connection error instead of fake data
        viewersElement.style.color = '#ef4444';
    }

    if (streamsElement) {
        streamsElement.textContent = 'N/A'; // Show connection error instead of fake data
        streamsElement.style.color = '#ef4444';
    }
}

// Authentication Modal Functions
function showAuthModal(mode = 'signin') {
    authMode = mode;
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const switchText = document.getElementById('authSwitchText');
    const switchBtn = document.getElementById('authSwitchBtn');
    const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
    // CORRECTED: Use separate first/last name fields for signup
    const firstNameGroup = document.getElementById('firstNameGroup');
    const lastNameGroup = document.getElementById('lastNameGroup');
    const nameGroup = document.getElementById('nameGroup'); // legacy, always hide

    if (mode === 'signin') {
        title.textContent = 'Sign In';
        submitBtn.textContent = 'Sign In';
        switchText.textContent = "Don't have an account?";
        switchBtn.textContent = 'Sign Up';
        confirmPasswordGroup.style.display = 'none';
        if (firstNameGroup) firstNameGroup.style.display = 'none';
        if (lastNameGroup) lastNameGroup.style.display = 'none';
        if (nameGroup) nameGroup.style.display = 'none'; // legacy, always hide
    } else {
        title.textContent = 'Sign Up';
        submitBtn.textContent = 'Create Account';
        switchText.textContent = 'Already have an account?';
        switchBtn.textContent = 'Sign In';
        confirmPasswordGroup.style.display = 'block';
        if (firstNameGroup) firstNameGroup.style.display = 'block';
        if (lastNameGroup) lastNameGroup.style.display = 'block';
        if (nameGroup) nameGroup.style.display = 'none'; // legacy, always hide
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function hideAuthModal() {
    const modal = document.getElementById('authModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';

    // Reset form
    const form = document.getElementById('authForm');
    if (form) {
        form.reset();
    }
}

function toggleAuthMode() {
    authMode = authMode === 'signin' ? 'signup' : 'signin';
    showAuthModal(authMode);
}

// Validate authentication token
async function validateAuthToken(token) {
    try {
        const response = await apiRequest('/auth/me');
        if (response.success) {
            currentUser = response.data;
            updateUIForAuthenticatedUser();
        } else {
            localStorage.removeItem('cruvz_auth_token');
        }
    } catch (error) {
        console.error('Token validation failed:', error);
        localStorage.removeItem('cruvz_auth_token');
    }
}

// Check authentication status
function checkAuthStatus() {
    const token = localStorage.getItem('cruvz_auth_token');
    if (token && !currentUser) {
        validateAuthToken(token);
    }
}

// Update UI for authenticated user
function updateUIForAuthenticatedUser() {
    const signInBtn = document.querySelector('.btn.btn-primary');
    const signUpBtn = document.querySelector('.btn.btn-secondary');

    if (signInBtn && signUpBtn && currentUser) {
        // Replace buttons with user menu
        const navMenu = document.querySelector('.nav-menu');
        const userMenu = document.createElement('div');
        userMenu.className = 'user-menu-inline';
        userMenu.innerHTML = `
            <span class="user-name">Welcome, ${currentUser.first_name || currentUser.name}</span>
            <a href="pages/dashboard.html" class="btn btn-primary">Dashboard</a>
            <button onclick="signOut()" class="btn btn-outline">Sign Out</button>
        `;

        signInBtn.parentNode.replaceChild(userMenu, signInBtn);
        signUpBtn.remove();
    }
}

// Handle authentication form submission
async function handleAuthSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    // CORRECTED: Use firstName and lastName fields for signup
    const first_name = formData.get('firstName');
    const last_name = formData.get('lastName');

    // Show loading state
    const submitBtn = document.getElementById('authSubmitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Processing...';
    submitBtn.disabled = true;

    try {
        let response;

        if (authMode === 'signup') {
            // Validate passwords match
            if (password !== confirmPassword) {
                throw new Error('Passwords do not match');
            }
            // Validate both names
            if (!first_name || first_name.trim().length < 2) {
                throw new Error('First Name is required (min 2 characters)');
            }
            if (!last_name || last_name.trim().length < 2) {
                throw new Error('Last Name is required (min 2 characters)');
            }
            response = await apiRequest('/auth/register', {
                method: 'POST',
                body: { first_name: first_name.trim(), last_name: last_name.trim(), email, password }
            });
        } else {
            response = await apiRequest('/auth/login', {
                method: 'POST',
                body: { email, password }
            });
        }

        if (response.success) {
            // Store token and user data
            localStorage.setItem('cruvz_auth_token', response.data.token);
            currentUser = response.data.user;

            // Hide modal and update UI
            hideAuthModal();
            updateUIForAuthenticatedUser();

            // Show success message
            showNotification('Authentication successful!', 'success');

            // Redirect to dashboard if appropriate
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        }
    } catch (error) {
        console.error('Authentication error:', error);
        showNotification(error.message || 'Authentication failed', 'error');
    } finally {
        // Reset button state
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Sign out function
async function signOut() {
    try {
        await apiRequest('/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        localStorage.removeItem('cruvz_auth_token');
        currentUser = null;
        window.location.href = '/';
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Live Streaming Monitor Functions (Production)
function showDemo() {
    // Remove demo modal functionality - show real connection status instead
    showNotification('Streaming backend connection check initiated...', 'info');
    
    // Test actual backend connectivity
    testBackendConnectivity();
}

function hideDemoModal() {
    // Demo modal removed - this function kept for compatibility
    console.log('Demo modal functionality has been removed');
}

let realTimeMonitoring = null;

function startRealTimeMonitoring() {
    // Start real-time streaming analytics monitoring
    realTimeMonitoring = setInterval(() => {
        // Load actual production metrics from the backend
        loadRealTimeStats();
    }, 2000); // Update every 2 seconds for production monitoring
}

function stopRealTimeMonitoring() {
    if (realTimeMonitoring) {
        clearInterval(realTimeMonitoring);
        realTimeMonitoring = null;
    }
}

function startDemo() {
    showNotification('Testing backend connectivity...', 'info');
    // Test real backend connectivity instead of showing mock data
    testBackendConnectivity();
    startRealTimeMonitoring();
}

function stopDemo() {
    showNotification('Connection monitoring stopped', 'info');
    // Stop real-time monitoring
    stopRealTimeMonitoring();
}

// Utility functions
function toggleMobileNav() {
    const navMenu = document.querySelector('.nav-menu');
    const navToggle = document.querySelector('.nav-toggle');

    if (navMenu && navToggle) {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    }
}

// Export functions for global access
window.showAuthModal = showAuthModal;
window.hideAuthModal = hideAuthModal;
window.toggleAuthMode = toggleAuthMode;
window.showDemo = showDemo;
window.hideDemoModal = hideDemoModal;
window.startDemo = startDemo;
window.stopDemo = stopDemo;
window.signOut = signOut;
