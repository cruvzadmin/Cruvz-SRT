// Dashboard-specific JavaScript functionality

// API Configuration - Development vs Production
let apiBaseUrl = '/api';

// For development, connect directly to backend server
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    apiBaseUrl = 'http://localhost:5000/api';
} else if (window.BACKEND_API_URL) {
    // If set by nginx/docker env, use that URL (strip trailing /)
    apiBaseUrl = window.BACKEND_API_URL.replace(/\/+$/, '') + '/api';
}

// Dashboard state
let currentSection = 'overview';
let userDropdownOpen = false;
let streams = [];
let analytics = {};


// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupDashboardEventListeners();
    loadDashboardData();
});

// API helper function
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

    // FIX: Ensure body is only set for non-GET requests
    if (config.body && typeof config.body === 'object' && config.method && config.method.toUpperCase() !== 'GET') {
        config.body = JSON.stringify(config.body);
    } else if (config.method && config.method.toUpperCase() === 'GET') {
        delete config.body;
    }

    try {
        const response = await fetch(`${apiBaseUrl}${endpoint}`, config);
        
        // Check if response is valid JSON
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            throw new Error(`Invalid response format from ${endpoint}: ${response.status} ${response.statusText}`);
        }

        if (!response.ok) {
            if (response.status === 401) {
                // Token expired or invalid, redirect to login
                localStorage.removeItem('cruvz_auth_token');
                window.location.href = '../index.html';
                return;
            }
            throw new Error(data.error || `Request failed: ${response.status} ${response.statusText}`);
        }

        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        
        // Show user-friendly error notification if available
        if (typeof showNotification === 'function') {
            showNotification(`API Error: ${error.message}`, 'error');
        } else {
            console.warn('showNotification function not available');
        }
        
        throw error;
    }
}

// Initialize dashboard functionality
function initializeDashboard() {
    // Check authentication - require valid token
    const token = localStorage.getItem('cruvz_auth_token');
    
    if (!token) {
        window.location.href = '../index.html';
        return;
    }
    
    // Setup navigation
    setupSidebarNavigation();
    
    // Load user information
    loadUserInfo();
    
    // Start real-time updates
    startRealtimeUpdates();
}

// Setup dashboard event listeners
function setupDashboardEventListeners() {
    // Click outside to close dropdowns
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.user-menu')) {
            closeUserDropdown();
        }
    });

    // Setup main create stream form
    const mainCreateForm = document.getElementById('createStreamForm');
    if (mainCreateForm) {
        mainCreateForm.addEventListener('submit', handleMainCreateStream);
    }

    // Setup protocol change listener for main form
    const protocolSelect = document.getElementById('streamProtocol');
    if (protocolSelect) {
        protocolSelect.addEventListener('change', updateMainFormProtocolPlaceholders);
        // Update placeholders on initial load
        updateMainFormProtocolPlaceholders();
    }

    // Setup create stream buttons
    const createStreamBtn = document.getElementById('createStreamBtn');
    if (createStreamBtn) {
        createStreamBtn.addEventListener('click', showCreateStreamModal);
    }

    const quickCreateStreamBtn = document.getElementById('quickCreateStreamBtn');
    if (quickCreateStreamBtn) {
        quickCreateStreamBtn.addEventListener('click', showCreateStreamModal);
    }

    // Setup quick action buttons
    const viewAnalyticsBtn = document.getElementById('viewAnalyticsBtn');
    if (viewAnalyticsBtn) {
        viewAnalyticsBtn.addEventListener('click', () => showSection('analytics'));
    }

    const apiSetupBtn = document.getElementById('apiSetupBtn');
    if (apiSetupBtn) {
        apiSetupBtn.addEventListener('click', () => showSection('api'));
    }

    const monitoringBtn = document.getElementById('monitoringBtn');
    if (monitoringBtn) {
        monitoringBtn.addEventListener('click', () => {
            showNotification('Monitoring dashboard would open here', 'info');
        });
    }

    // Setup refresh streams button
    const refreshStreamsBtn = document.getElementById('refreshStreamsBtn');
    if (refreshStreamsBtn) {
        refreshStreamsBtn.addEventListener('click', () => {
            loadStreams();
            showNotification('Streams refreshed', 'success');
        });
    }

    // Setup create stream button in streams section
    const createStreamBtn2 = document.getElementById('createStreamBtn2');
    if (createStreamBtn2) {
        createStreamBtn2.addEventListener('click', showCreateStreamModal);
    }
}

// Setup sidebar navigation
function setupSidebarNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            if (section) {
                showSection(section);
            }
        });
    });
}

// Show dashboard section
function showSection(sectionName) {
    // Update menu active state
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === sectionName) {
            item.classList.add('active');
        }
    });
    
    // Show content section
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        currentSection = sectionName;
        
        // Load section-specific data
        loadSectionData(sectionName);
    }
}

// Load section-specific data
function loadSectionData(sectionName) {
    switch (sectionName) {
        case 'overview':
            loadOverviewData();
            break;
        case 'streams':
            loadStreams();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'api':
            loadAPIKeys();
            break;
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        await Promise.all([
            loadOverviewData(),
            loadStreams(),
            loadUserInfo()
        ]);
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

// Load overview data
async function loadOverviewData() {
    try {
        // Load analytics data from API
        const response = await apiRequest('/analytics/dashboard');
        if (response.success) {
            const data = response.data;
            
            // Update stats display
            updateStatsDisplay(data.overview ?? data);

            // Update recent streams
            if (data.recent_streams) {
                updateRecentStreams(data.recent_streams);
            }

            // Update performance charts  
            if (data.daily_trend) {
                updatePerformanceCharts(data.daily_trend);
            }
        }
    } catch (error) {
        console.error('Failed to load overview data:', error);
        showNotification('Unable to connect to server. Please check your connection.', 'error');
        
        // Show connection error
        const overviewStats = document.getElementById('overview-stats');
        if (overviewStats) {
            overviewStats.innerHTML = '<div class="error-message">Unable to load statistics. Please refresh the page.</div>';
        }
    }
}

// Update stats display
function updateStatsDisplay(stats) {
    // Only use real backend stats, no mock or fallback
    const elements = {
        'activeStreams': stats.active_streams ?? '--',
        'totalViewers': stats.total_viewers ?? '--',
        'avgLatency': stats.avg_latency ?? '--',
        'bandwidth': stats.bandwidth ?? '--'
    };
    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
}

// Add implementation for updateRecentStreams and updatePerformanceCharts if needed!

// Load streams
async function loadStreams() {
    try {
        const response = await apiRequest('/streams');
        if (response.success) {
            streams = response.data.streams;
            updateStreamsDisplay(streams);
        }
    } catch (error) {
        console.error('Failed to load streams:', error);
        showNotification('Unable to load streams. Please check your connection.', 'error');
        const streamsContainer = document.getElementById('streamsGrid');
        if (streamsContainer) {
            streamsContainer.innerHTML = '<div class="error-message">Unable to load streams. Please refresh the page.</div>';
        }
    }
}

// Update streams display
function updateStreamsDisplay(streamsList) {
    const container = document.getElementById('streamsGrid');
    if (!container) return;
    if (streamsList.length === 0) {
        container.innerHTML = '<div class="no-streams">No streams found. <a href="#" onclick="showCreateStreamModal()">Create your first stream</a></div>';
        return;
    }
    container.innerHTML = streamsList.map(stream => `
        <div class="stream-card" data-stream-id="${stream.id}">
            <div class="stream-header">
                <h3>${stream.title}</h3>
                <span class="stream-status status-${stream.status}">${stream.status}</span>
            </div>
            <div class="stream-info">
                <p class="stream-description">${stream.description || 'No description'}</p>
                <div class="stream-details">
                    <span>Protocol: ${stream.protocol ? stream.protocol.toUpperCase() : '--'}</span>
                    <span>Created: ${stream.created_at ? new Date(stream.created_at).toLocaleDateString() : '--'}</span>
                    ${stream.status === 'active' ? `<span>Started: ${stream.started_at ? new Date(stream.started_at).toLocaleString() : '--'}</span>` : ''}
                </div>
            </div>
            <div class="stream-actions">
                ${stream.status === 'active' ? 
                    `<button class="btn btn-danger" onclick="stopStream('${stream.id}')">Stop Stream</button>` :
                    `<button class="btn btn-success" onclick="startStream('${stream.id}')">Start Stream</button>`
                }
                <button class="btn btn-secondary" onclick="editStream('${stream.id}')">Edit</button>
                <button class="btn btn-outline" onclick="viewAnalytics('${stream.id}')">Analytics</button>
                ${stream.status !== 'active' ? 
                    `<button class="btn btn-danger-outline" onclick="deleteStream('${stream.id}')">Delete</button>` : ''
                }
            </div>
        </div>
    `).join('');
}

// Update recent streams on dashboard
function updateRecentStreams(streams) {
    const container = document.getElementById('recentStreams');
    if (!container) return;
    
    if (streams.length === 0) {
        container.innerHTML = '<div class="no-streams">No recent streams. <a href="#" onclick="showSection(\'create\')">Create your first stream</a></div>';
        return;
    }
    
    container.innerHTML = streams.slice(0, 5).map(stream => `
        <div class="stream-item" onclick="showSection('streams')">
            <div class="stream-icon">
                <span class="protocol-badge">${stream.protocol ? stream.protocol.toUpperCase() : 'RTMP'}</span>
            </div>
            <div class="stream-content">
                <h4>${stream.title}</h4>
                <p>Status: <span class="status-${stream.status}">${stream.status}</span></p>
                <small>Created: ${stream.created_at ? new Date(stream.created_at).toLocaleDateString() : '--'}</small>
            </div>
        </div>
    `).join('');
}

// Update performance charts (placeholder implementation)
function updatePerformanceCharts(data) {
    console.log('Performance charts would be updated with:', data);
    // In a real implementation, this would use Chart.js or similar library
}

// Load user information
async function loadUserInfo() {
    try {
        const response = await apiRequest('/users/profile');
        if (response.success) {
            const user = response.data.user || response.data;
            updateUserDisplay(user);
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
        updateUserDisplay({
            name: 'User',
            email: 'Please login again',
            avatar_url: null
        });
        showNotification('Unable to load user information', 'warning');
    }
}

// Update user display
function updateUserDisplay(user) {
    const userNameElement = document.getElementById('userName');
    const userAvatarElement = document.getElementById('userAvatar');
    if (userNameElement) {
        userNameElement.textContent = user.first_name || user.name || 'User';
    }
    if (userAvatarElement) {
        userAvatarElement.src = user.avatar_url || '../assets/default-avatar.png';
        userAvatarElement.alt = user.first_name || user.name || 'User';
    }
}

// Load analytics data
async function loadAnalytics() {
    try {
        const response = await apiRequest('/analytics/dashboard');
        if (response.success) {
            analytics = response.data;
            updateAnalyticsDisplay(analytics);
        }
    } catch (error) {
        console.error('Failed to load analytics:', error);
        showNotification('Failed to load analytics data', 'error');
    }
}

// Update analytics display
function updateAnalyticsDisplay(data) {
    if (data.daily_trend) {
        updateAnalyticsCharts(data.daily_trend);
    }
    if (data.performance) {
        updatePerformanceMetrics(data.performance);
    }
}

// Load API keys
async function loadAPIKeys() {
    try {
        const response = await apiRequest('/keys');
        if (response.success) {
            updateAPIKeysDisplay(response.data);
        }
    } catch (error) {
        console.error('Failed to load API keys:', error);
        showNotification('Failed to load API keys', 'error');
    }
}

// Update API keys display
function updateAPIKeysDisplay(apiKeys) {
    const container = document.getElementById('apiKeysContainer');
    if (!container) return;
    if (apiKeys.length === 0) {
        container.innerHTML = '<div class="no-keys">No API keys found. <button onclick="showCreateAPIKeyModal()" class="btn btn-primary">Create your first API key</button></div>';
        return;
    }
    container.innerHTML = apiKeys.map(key => `
        <div class="api-key-card">
            <div class="key-header">
                <h4>${key.name}</h4>
                <span class="key-status ${key.is_active ? 'active' : 'inactive'}">${key.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <div class="key-info">
                <div class="key-detail">
                    <span class="label">Permissions:</span>
                    <span class="value">${key.permissions}</span>
                </div>
                <div class="key-detail">
                    <span class="label">Created:</span>
                    <span class="value">${new Date(key.created_at).toLocaleDateString()}</span>
                </div>
                ${key.expires_at ? `
                <div class="key-detail">
                    <span class="label">Expires:</span>
                    <span class="value">${new Date(key.expires_at).toLocaleDateString()}</span>
                </div>` : ''}
                ${key.last_used ? `
                <div class="key-detail">
                    <span class="label">Last Used:</span>
                    <span class="value">${new Date(key.last_used).toLocaleDateString()}</span>
                </div>` : ''}
            </div>
            <div class="key-actions">
                <button class="btn btn-secondary" onclick="regenerateAPIKey(${key.id})">Regenerate</button>
                <button class="btn btn-outline" onclick="toggleAPIKey(${key.id}, ${!key.is_active})">${key.is_active ? 'Disable' : 'Enable'}</button>
                <button class="btn btn-danger-outline" onclick="deleteAPIKey(${key.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// Stream management functions
async function startStream(streamId) {
    try {
        const response = await apiRequest(`/streams/${streamId}/start`, { method: 'POST' });
        if (response.success) {
            showNotification('Stream started successfully!', 'success');
            showStreamingInfo(response.data);
            loadStreams();
        }
    } catch (error) {
        console.error('Failed to start stream:', error);
        showNotification(error.message || 'Failed to start stream', 'error');
    }
}

async function stopStream(streamId) {
    try {
        const response = await apiRequest(`/streams/${streamId}/stop`, { method: 'POST' });
        if (response.success) {
            showNotification('Stream stopped successfully!', 'success');
            loadStreams();
        }
    } catch (error) {
        console.error('Failed to stop stream:', error);
        showNotification(error.message || 'Failed to stop stream', 'error');
    }
}

async function deleteStream(streamId) {
    if (!confirm('Are you sure you want to delete this stream? This action cannot be undone.')) {
        return;
    }
    try {
        const response = await apiRequest(`/streams/${streamId}`, { method: 'DELETE' });
        if (response.success) {
            showNotification('Stream deleted successfully!', 'success');
            loadStreams();
        }
    } catch (error) {
        console.error('Failed to delete stream:', error);
        showNotification(error.message || 'Failed to delete stream', 'error');
    }
}

// Show streaming information modal
function showStreamingInfo(streamData) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>Streaming Information</h3>
                <button class="modal-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="streaming-urls">
                    <div class="url-group">
                        <label>RTMP URL:</label>
                        <div class="url-input">
                            <input type="text" value="${streamData.rtmp_url || ''}" readonly>
                            <button onclick="copyToClipboard('${streamData.rtmp_url || ''}')">Copy</button>
                        </div>
                    </div>
                    <div class="url-group">
                        <label>SRT URL:</label>
                        <div class="url-input">
                            <input type="text" value="${streamData.srt_url || ''}" readonly>
                            <button onclick="copyToClipboard('${streamData.srt_url || ''}')">Copy</button>
                        </div>
                    </div>
                    <div class="url-group">
                        <label>WebRTC URL:</label>
                        <div class="url-input">
                            <input type="text" value="${streamData.webrtc_url || ''}" readonly>
                            <button onclick="copyToClipboard('${streamData.webrtc_url || ''}')">Copy</button>
                        </div>
                    </div>
                    <div class="url-group">
                        <label>Stream Key:</label>
                        <div class="url-input">
                            <input type="text" value="${streamData.stream_key || ''}" readonly>
                            <button onclick="copyToClipboard('${streamData.stream_key || ''}')">Copy</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Copied to clipboard!', 'success');
    });
}

function showCreateStreamModal() {
    // Switch to the create section in the dashboard
    showSection('create');
    showNotification('Use the form below to create a new stream', 'info');
}

function updateProtocolPlaceholders() {}
function updateMainFormProtocolPlaceholders() {}

async function handleCreateStream(e) {
    e.preventDefault();
    // Should implement modal create stream logic
}

async function handleMainCreateStream(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const streamData = {
        title: formData.get('title'),
        description: formData.get('description'),
        protocol: formData.get('protocol') || 'rtmp',
        source_url: formData.get('source_url'),
        destination_url: formData.get('destination_url'),
        settings: {
            quality: formData.get('quality'),
            bitrate: parseInt(formData.get('bitrate'))
        },
        max_viewers: 1000,
        is_recording: formData.has('record')
    };
    try {
        const response = await apiRequest('/streams', {
            method: 'POST',
            body: streamData
        });
        if (response.success) {
            showNotification('Stream created successfully!', 'success');
            e.target.reset();
            updateMainFormProtocolPlaceholders();
            loadStreams();
            showSection('streams');
        }
    } catch (error) {
        console.error('Failed to create stream:', error);
        showNotification(error.message || 'Failed to create stream', 'error');
    }
}

function startRealtimeUpdates() {
    setInterval(() => {
        if (currentSection === 'overview') {
            loadOverviewData();
        } else if (currentSection === 'streams') {
            loadStreams();
        } else if (currentSection === 'analytics') {
            loadAnalytics();
        }
    }, 30000);
}

function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
        userDropdownOpen = !userDropdownOpen;
    }
}

function closeUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown && userDropdownOpen) {
        dropdown.classList.remove('show');
        userDropdownOpen = false;
    }
}

async function signOut() {
    try {
        await apiRequest('/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        localStorage.removeItem('cruvz_auth_token');
        window.location.href = '../index.html';
    }
}

function showNotification(message, type = 'info') {
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
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function editStream(streamId) {
    showNotification('Edit stream functionality coming soon!', 'info');
}

function viewAnalytics(streamId) {
    showNotification('Stream analytics functionality coming soon!', 'info');
}

function loadSettings() {
    showNotification('Loading settings...', 'info');
}

window.updateProtocolPlaceholders = updateProtocolPlaceholders;
window.updateMainFormProtocolPlaceholders = updateMainFormProtocolPlaceholders;
window.showCreateStreamModal = showCreateStreamModal;
window.startStream = startStream;
window.stopStream = stopStream;
window.deleteStream = deleteStream;
window.editStream = editStream;
window.viewAnalytics = viewAnalytics;
window.toggleUserDropdown = toggleUserDropdown;
window.signOut = signOut;
window.copyToClipboard = copyToClipboard;
window.resetCreateForm = resetCreateForm;

function updateAnalytics() {}
function refreshAnalytics() {}
function exportAnalytics() {}
function toggleChartType(chartName) {}
function showQualityDetails() {}
function showProtocolDetails() {}
function showGeographicMap() {}
function showAllStreams() {}
function generateReport() {}
async function loadStreamPerformance() {}
function updateStreamPerformanceTable(streams) {}

function viewStreamDetails(streamId) { showNotification(`Viewing details for stream ${streamId}`, 'info'); }
function manageStream(streamId) { showNotification(`Managing stream ${streamId}`, 'info'); }
function resetCreateForm() {
    const form = document.getElementById('createStreamForm');
    if (form) {
        form.reset();
        updateMainFormProtocolPlaceholders();
    }
}

window.updateAnalytics = updateAnalytics;
window.refreshAnalytics = refreshAnalytics;
window.exportAnalytics = exportAnalytics;
window.toggleChartType = toggleChartType;
window.showQualityDetails = showQualityDetails;
window.showProtocolDetails = showProtocolDetails;
window.showGeographicMap = showGeographicMap;
window.showAllStreams = showAllStreams;
window.generateReport = generateReport;
window.viewStreamDetails = viewStreamDetails;
window.manageStream = manageStream;
window.showSection = showSection;
