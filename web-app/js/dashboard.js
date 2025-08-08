// Dashboard-specific JavaScript functionality

// Dashboard state
let currentSection = 'overview';
let userDropdownOpen = false;
let streams = [];
let analytics = {};

// API Configuration
const API_BASE_URL = window.location.origin + '/api';

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

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                // Token expired, redirect to login
                localStorage.removeItem('cruvz_auth_token');
                window.location.href = '../index.html';
                return;
            }
            throw new Error(data.error || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

// Initialize dashboard functionality
function initializeDashboard() {
    // Check authentication
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
            updateStatsDisplay(data.overview);
            
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
        showNotification('Failed to load overview data', 'error');
        
        // Fallback to mock data for development
        loadMockOverviewData();
    }
}

// Update stats display
function updateStatsDisplay(stats) {
    const elements = {
        'activeStreams': stats.active_streams || 0,
        'totalViewers': (stats.total_viewers || 0).toLocaleString(),
        'avgLatency': `${stats.avg_viewers || 0}`,
        'bandwidth': `${(stats.total_data_transferred || 0).toFixed(1)} MB`
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
}

// Load mock data as fallback
function loadMockOverviewData() {
    const stats = {
        activeStreams: Math.floor(Math.random() * 10) + 1,
        totalViewers: Math.floor(Math.random() * 5000) + 1000,
        avgLatency: Math.floor(Math.random() * 20) + 40,
        bandwidth: (Math.random() * 2 + 1).toFixed(1)
    };
    
    updateStatsDisplay({
        active_streams: stats.activeStreams,
        total_viewers: stats.totalViewers,
        avg_viewers: stats.avgLatency,
        total_data_transferred: parseFloat(stats.bandwidth)
    });
}

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
        showNotification('Failed to load streams', 'error');
        
        // Fallback to mock data
        streams = generateMockStreams();
        updateStreamsDisplay(streams);
    }
}

// Update streams display
function updateStreamsDisplay(streamsList) {
    const container = document.getElementById('streamsContainer');
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
                    <span>Protocol: ${stream.protocol.toUpperCase()}</span>
                    <span>Created: ${new Date(stream.created_at).toLocaleDateString()}</span>
                    ${stream.status === 'live' ? `<span>Started: ${new Date(stream.started_at).toLocaleString()}</span>` : ''}
                </div>
            </div>
            <div class="stream-actions">
                ${stream.status === 'live' ? 
                    `<button class="btn btn-danger" onclick="stopStream(${stream.id})">Stop Stream</button>` :
                    `<button class="btn btn-success" onclick="startStream(${stream.id})">Start Stream</button>`
                }
                <button class="btn btn-secondary" onclick="editStream(${stream.id})">Edit</button>
                <button class="btn btn-outline" onclick="viewAnalytics(${stream.id})">Analytics</button>
                ${stream.status !== 'live' ? 
                    `<button class="btn btn-danger-outline" onclick="deleteStream(${stream.id})">Delete</button>` : ''
                }
            </div>
        </div>
    `).join('');
}

// Generate mock streams for fallback
function generateMockStreams() {
    return [
        {
            id: 1,
            title: 'Live Gaming Session',
            description: 'Playing the latest games',
            status: 'live',
            protocol: 'rtmp',
            created_at: new Date().toISOString(),
            started_at: new Date().toISOString()
        },
        {
            id: 2,
            title: 'Tech Talk',
            description: 'Discussion about new technologies',
            status: 'inactive',
            protocol: 'webrtc',
            created_at: new Date().toISOString()
        }
    ];
}

// Load user information
async function loadUserInfo() {
    try {
        const response = await apiRequest('/users/profile');
        if (response.success) {
            const user = response.data;
            updateUserDisplay(user);
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
        // Fallback to mock data
        updateUserDisplay({
            name: 'User',
            email: 'user@example.com',
            avatar_url: null
        });
    }
}

// Update user display
function updateUserDisplay(user) {
    const userNameElement = document.getElementById('userName');
    const userAvatarElement = document.getElementById('userAvatar');
    
    if (userNameElement) {
        userNameElement.textContent = user.name;
    }
    
    if (userAvatarElement) {
        userAvatarElement.src = user.avatar_url || '../assets/default-avatar.png';
        userAvatarElement.alt = user.name;
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
    // Update charts and analytics UI
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
        const response = await apiRequest(`/streams/${streamId}/start`, {
            method: 'POST'
        });
        
        if (response.success) {
            showNotification('Stream started successfully!', 'success');
            // Show streaming URLs
            showStreamingInfo(response.data);
            // Refresh streams list
            loadStreams();
        }
    } catch (error) {
        console.error('Failed to start stream:', error);
        showNotification(error.message || 'Failed to start stream', 'error');
    }
}

async function stopStream(streamId) {
    try {
        const response = await apiRequest(`/streams/${streamId}/stop`, {
            method: 'POST'
        });
        
        if (response.success) {
            showNotification('Stream stopped successfully!', 'success');
            // Refresh streams list
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
        const response = await apiRequest(`/streams/${streamId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showNotification('Stream deleted successfully!', 'success');
            // Refresh streams list
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
                            <input type="text" value="${streamData.rtmp_url}" readonly>
                            <button onclick="copyToClipboard('${streamData.rtmp_url}')">Copy</button>
                        </div>
                    </div>
                    <div class="url-group">
                        <label>SRT URL:</label>
                        <div class="url-input">
                            <input type="text" value="${streamData.srt_url}" readonly>
                            <button onclick="copyToClipboard('${streamData.srt_url}')">Copy</button>
                        </div>
                    </div>
                    <div class="url-group">
                        <label>WebRTC URL:</label>
                        <div class="url-input">
                            <input type="text" value="${streamData.webrtc_url}" readonly>
                            <button onclick="copyToClipboard('${streamData.webrtc_url}')">Copy</button>
                        </div>
                    </div>
                    <div class="url-group">
                        <label>Stream Key:</label>
                        <div class="url-input">
                            <input type="text" value="${streamData.stream_key}" readonly>
                            <button onclick="copyToClipboard('${streamData.stream_key}')">Copy</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Copy to clipboard utility
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Copied to clipboard!', 'success');
    });
}

// Create stream modal
function showCreateStreamModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create New Stream</h3>
                <button class="modal-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="createStreamForm">
                    <div class="form-group">
                        <label for="streamTitle">Stream Title *</label>
                        <input type="text" id="streamTitle" name="title" required>
                    </div>
                    <div class="form-group">
                        <label for="streamDescription">Description</label>
                        <textarea id="streamDescription" name="description" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="streamProtocol">Protocol</label>
                        <select id="streamProtocol" name="protocol">
                            <option value="rtmp">RTMP</option>
                            <option value="srt">SRT</option>
                            <option value="webrtc">WebRTC</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="streamQuality">Quality</label>
                        <select id="streamQuality" name="quality">
                            <option value="720p">720p</option>
                            <option value="1080p" selected>1080p</option>
                            <option value="4k">4K</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="maxViewers">Max Viewers</label>
                        <input type="number" id="maxViewers" name="max_viewers" value="1000" min="1" max="100000">
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="enableRecording" name="is_recording">
                            Enable Recording
                        </label>
                    </div>
                    <div class="form-actions">
                        <button type="button" onclick="this.closest('.modal').remove()" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create Stream</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle form submission
    document.getElementById('createStreamForm').addEventListener('submit', handleCreateStream);
}

// Handle create stream form submission
async function handleCreateStream(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const streamData = {
        title: formData.get('title'),
        description: formData.get('description'),
        protocol: formData.get('protocol'),
        settings: {
            quality: formData.get('quality')
        },
        max_viewers: parseInt(formData.get('max_viewers')),
        is_recording: formData.has('is_recording')
    };
    
    try {
        const response = await apiRequest('/streams', {
            method: 'POST',
            body: streamData
        });
        
        if (response.success) {
            showNotification('Stream created successfully!', 'success');
            // Close modal
            e.target.closest('.modal').remove();
            // Refresh streams list
            loadStreams();
        }
    } catch (error) {
        console.error('Failed to create stream:', error);
        showNotification(error.message || 'Failed to create stream', 'error');
    }
}

// Start real-time updates
function startRealtimeUpdates() {
    // Update data every 30 seconds
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

// User dropdown functions
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

// Sign out function
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
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Stub functions for missing features
function editStream(streamId) {
    showNotification('Edit stream functionality coming soon!', 'info');
}

function viewAnalytics(streamId) {
    showNotification('Stream analytics functionality coming soon!', 'info');
}

function loadSettings() {
    showNotification('Loading settings...', 'info');
}

// Export functions for global access
window.showCreateStreamModal = showCreateStreamModal;
window.startStream = startStream;
window.stopStream = stopStream;
window.deleteStream = deleteStream;
window.editStream = editStream;
window.viewAnalytics = viewAnalytics;
window.toggleUserDropdown = toggleUserDropdown;
window.signOut = signOut;
window.copyToClipboard = copyToClipboard;
window.showSection = showSection;