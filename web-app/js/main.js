// Main JavaScript file for Cruvz Streaming Platform

// Global state
let currentUser = null;
let authMode = 'signin'; // 'signin' or 'signup'

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
    
    // Initialize demo animations
    initializeDemoAnimations();
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
    // Simulate real-time data updates
    setInterval(updateDemoStats, 2000);
}

// Update demo statistics
function updateDemoStats() {
    const latencyElement = document.getElementById('demoLatency');
    const viewersElement = document.getElementById('demoViewers');
    
    if (latencyElement) {
        const latency = Math.floor(Math.random() * 20) + 35; // 35-55ms
        latencyElement.textContent = `${latency}ms`;
    }
    
    if (viewersElement) {
        const viewers = Math.floor(Math.random() * 500) + 1000; // 1000-1500
        viewersElement.textContent = viewers.toLocaleString();
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
    const nameGroup = document.getElementById('nameGroup');
    
    if (mode === 'signin') {
        title.textContent = 'Sign In';
        submitBtn.textContent = 'Sign In';
        switchText.textContent = "Don't have an account?";
        switchBtn.textContent = 'Sign Up';
        confirmPasswordGroup.style.display = 'none';
        nameGroup.style.display = 'none';
    } else {
        title.textContent = 'Sign Up';
        submitBtn.textContent = 'Create Account';
        switchText.textContent = 'Already have an account?';
        switchBtn.textContent = 'Sign In';
        confirmPasswordGroup.style.display = 'block';
        nameGroup.style.display = 'block';
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

// Handle authentication form submission
async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    const fullName = formData.get('fullName');
    
    // Basic validation
    if (!email || !password) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    if (authMode === 'signup') {
        if (password !== confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }
        
        if (!fullName) {
            showNotification('Please enter your full name', 'error');
            return;
        }
    }
    
    try {
        const endpoint = authMode === 'signin' ? '/api/v1/auth/signin' : '/api/v1/auth/signup';
        const requestData = {
            email,
            password,
            ...(authMode === 'signup' && { fullName })
        };
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store auth token
            localStorage.setItem('cruvz_auth_token', data.token);
            currentUser = data.user;
            
            // Update UI
            updateAuthUI();
            hideAuthModal();
            
            const action = authMode === 'signin' ? 'signed in' : 'account created';
            showNotification(`Successfully ${action}!`, 'success');
            
            // Redirect to dashboard if appropriate
            if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
                setTimeout(() => {
                    window.location.href = 'pages/dashboard.html';
                }, 1500);
            }
        } else {
            showNotification(data.message || 'Authentication failed', 'error');
        }
    } catch (error) {
        console.error('Auth error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Check authentication status
async function checkAuthStatus() {
    const token = localStorage.getItem('cruvz_auth_token');
    if (!token) return;
    
    try {
        const response = await fetch('/api/v1/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            updateAuthUI();
        } else {
            // Token is invalid, remove it
            localStorage.removeItem('cruvz_auth_token');
            currentUser = null;
        }
    } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('cruvz_auth_token');
        currentUser = null;
    }
}

// Validate auth token
async function validateAuthToken(token) {
    try {
        const response = await fetch('/api/v1/auth/validate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            updateAuthUI();
        } else {
            localStorage.removeItem('cruvz_auth_token');
        }
    } catch (error) {
        console.error('Token validation error:', error);
        localStorage.removeItem('cruvz_auth_token');
    }
}

// Update authentication UI
function updateAuthUI() {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;
    
    if (currentUser) {
        // User is logged in
        const signInBtn = navMenu.querySelector('.btn-primary');
        const signUpBtn = navMenu.querySelector('.btn-secondary');
        
        if (signInBtn && signUpBtn) {
            // Replace sign in/up buttons with user menu
            const userMenu = document.createElement('div');
            userMenu.className = 'user-menu';
            userMenu.innerHTML = `
                <div class="user-info">
                    <img src="${currentUser.avatar || '/assets/default-avatar.png'}" alt="${currentUser.name}" class="user-avatar">
                    <span class="user-name">${currentUser.name}</span>
                </div>
                <div class="user-dropdown">
                    <a href="pages/dashboard.html" class="dropdown-item">Dashboard</a>
                    <a href="pages/profile.html" class="dropdown-item">Profile</a>
                    <a href="pages/settings.html" class="dropdown-item">Settings</a>
                    <button onclick="signOut()" class="dropdown-item">Sign Out</button>
                </div>
            `;
            
            signInBtn.replaceWith(userMenu);
            signUpBtn.remove();
        }
    }
}

// Sign out function
function signOut() {
    localStorage.removeItem('cruvz_auth_token');
    currentUser = null;
    
    showNotification('Successfully signed out', 'success');
    
    // Reload page to reset UI
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

// Demo Modal Functions
function showDemo() {
    const modal = document.getElementById('demoModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Start demo simulation
    startDemoSimulation();
}

function hideDemoModal() {
    const modal = document.getElementById('demoModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
    
    // Stop demo simulation
    stopDemoSimulation();
}

let demoSimulation = null;

function startDemoSimulation() {
    // Simulate streaming data updates
    demoSimulation = setInterval(() => {
        const latency = Math.floor(Math.random() * 15) + 30; // 30-45ms
        const viewers = Math.floor(Math.random() * 1000) + 500; // 500-1500
        const qualities = ['720p', '1080p', '1440p', '4K'];
        const quality = qualities[Math.floor(Math.random() * qualities.length)];
        
        const latencyEl = document.getElementById('demoLatency');
        const viewersEl = document.getElementById('demoViewers');
        const qualityEl = document.getElementById('demoQuality');
        
        if (latencyEl) latencyEl.textContent = `${latency}ms`;
        if (viewersEl) viewersEl.textContent = viewers.toLocaleString();
        if (qualityEl) qualityEl.textContent = quality;
    }, 1000);
}

function stopDemoSimulation() {
    if (demoSimulation) {
        clearInterval(demoSimulation);
        demoSimulation = null;
    }
}

function startDemo() {
    showNotification('Demo stream started!', 'success');
    // Add logic to start actual demo stream
}

function stopDemo() {
    showNotification('Demo stream stopped!', 'info');
    // Add logic to stop actual demo stream
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    // Add notification styles
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 3000;
            background: white;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            overflow: hidden;
            animation: slideIn 0.3s ease;
        }
        
        .notification-info { border-left: 4px solid #17a2b8; }
        .notification-success { border-left: 4px solid #28a745; }
        .notification-error { border-left: 4px solid #dc3545; }
        .notification-warning { border-left: 4px solid #ffc107; }
        
        .notification-content {
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .notification-message {
            margin-right: 15px;
        }
        
        .notification-close {
            background: none;
            border: none;
            font-size: 1.2rem;
            color: #999;
            cursor: pointer;
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    
    if (!document.querySelector('style[data-notifications]')) {
        style.setAttribute('data-notifications', 'true');
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
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

// API helper functions
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('cruvz_auth_token');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    };
    
    const response = await fetch(endpoint, { ...defaultOptions, ...options });
    
    if (response.status === 401) {
        // Token is invalid, remove it and redirect to login
        localStorage.removeItem('cruvz_auth_token');
        currentUser = null;
        showNotification('Session expired. Please sign in again.', 'warning');
        showAuthModal('signin');
        throw new Error('Unauthorized');
    }
    
    return response;
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