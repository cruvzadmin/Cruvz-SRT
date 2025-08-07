// Main JavaScript file for Cruvz Streaming Platform

// Global state
let currentUser = null;
let authMode = 'signin'; // 'signin' or 'signup'

// API Configuration
const API_BASE_URL = window.location.origin + '/api';

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
            <span class="user-name">Welcome, ${currentUser.name}</span>
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
    const name = formData.get('fullName');
    const confirmPassword = formData.get('confirmPassword');
    
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
            
            response = await apiRequest('/auth/register', {
                method: 'POST',
                body: { email, password, name }
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
                window.location.href = 'pages/dashboard.html';
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