// Dashboard-specific JavaScript functionality

// Use existing apiBaseUrl from main.js or create one if not available
let apiBaseUrl = window.API_BASE_URL || `http://${window.location.hostname}:5000/api`;

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

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(`${apiBaseUrl}${endpoint}`, config);
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
        showNotification('Unable to connect to server. Please check your connection.', 'error');
        
        // Show connection error instead of mock data
        document.getElementById('overview-stats').innerHTML = '<div class="error-message">Unable to load statistics. Please refresh the page.</div>';
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
        
        // Show error message instead of mock data
        const streamsContainer = document.getElementById('streams-container');
        if (streamsContainer) {
            streamsContainer.innerHTML = '<div class="error-message">Unable to load streams. Please refresh the page.</div>';
        }
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

// Load user information
async function loadUserInfo() {
    try {
        const response = await apiRequest('/auth/me');
        if (response.success) {
            const user = response.data;
            updateUserDisplay(user);
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
        // Show generic user info instead of mock data
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
                        <select id="streamProtocol" name="protocol" onchange="updateProtocolPlaceholders()">
                            <option value="rtmp">RTMP</option>
                            <option value="srt">SRT</option>
                            <option value="webrtc">WebRTC</option>
                        </select>
                    </div>
                    
                    <!-- Source/Input URL Configuration -->
                    <div class="form-group">
                        <label for="sourceUrl">Source URL (Input) *</label>
                        <input type="url" id="sourceUrl" name="source_url" required 
                               placeholder="rtmp://source.example.com/live/stream_key">
                        <small class="form-help">The URL where your streaming software will send the stream</small>
                    </div>
                    
                    <!-- Destination/Output URL Configuration -->
                    <div class="form-group">
                        <label for="destinationUrl">Destination URL (Output) *</label>
                        <input type="url" id="destinationUrl" name="destination_url" required 
                               placeholder="rtmp://localhost:1935/app/stream_name">
                        <small class="form-help">The URL where viewers will access the stream</small>
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
    
    // Update placeholders based on initial protocol
    updateProtocolPlaceholders();
}

// Update URL placeholders based on selected protocol
function updateProtocolPlaceholders() {
    const protocol = document.getElementById('streamProtocol')?.value || 'rtmp';
    const sourceUrl = document.getElementById('sourceUrl');
    const destinationUrl = document.getElementById('destinationUrl');
    
    if (!sourceUrl || !destinationUrl) return;
    
    switch(protocol) {
        case 'rtmp':
            sourceUrl.placeholder = 'rtmp://source.example.com/live/stream_key';
            destinationUrl.placeholder = 'rtmp://localhost:1935/app/stream_name';
            break;
        case 'srt':
            sourceUrl.placeholder = 'srt://source.example.com:9999?streamid=input_stream_key';
            destinationUrl.placeholder = 'srt://localhost:9999?streamid=app/stream_name';
            break;
        case 'webrtc':
            sourceUrl.placeholder = 'http://source.example.com:3333/app/input_stream';
            destinationUrl.placeholder = 'http://localhost:3333/app/stream_name';
            break;
    }
}

// Handle create stream form submission
async function handleCreateStream(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const streamData = {
        title: formData.get('title'),
        description: formData.get('description'),
        protocol: formData.get('protocol'),
        source_url: formData.get('source_url'),
        destination_url: formData.get('destination_url'),
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
// Make updateProtocolPlaceholders available globally
window.updateProtocolPlaceholders = updateProtocolPlaceholders;
window.showCreateStreamModal = showCreateStreamModal;
window.startStream = startStream;
window.stopStream = stopStream;
window.deleteStream = deleteStream;
window.editStream = editStream;
window.viewAnalytics = viewAnalytics;
window.toggleUserDropdown = toggleUserDropdown;
window.signOut = signOut;
window.copyToClipboard = copyToClipboard;

// Enhanced Analytics Functions
function updateAnalytics() {
    const timeframe = document.getElementById('analyticsTimeframe')?.value || '24h';
    console.log('Updating analytics for timeframe:', timeframe);
    
    if (window.analyticsEngine) {
        window.analyticsEngine.fetchAnalyticsData();
    }
    
    // Also load stream performance data
    loadStreamPerformance();
}

function refreshAnalytics() {
    if (window.analyticsEngine) {
        window.analyticsEngine.fetchAnalyticsData();
    }
    loadStreamPerformance();
    showNotification('Analytics refreshed', 'success');
}

function exportAnalytics() {
    const timeframe = document.getElementById('analyticsTimeframe')?.value || '24h';
    if (window.analyticsEngine) {
        window.analyticsEngine.exportData('csv', timeframe);
    }
}

function toggleChartType(chartName) {
    // Toggle between different chart types (line, bar, area)
    console.log('Toggling chart type for:', chartName);
    showNotification(`Chart type toggled for ${chartName}`, 'info');
}

function showQualityDetails() {
    showNotification('Quality details modal would open here', 'info');
}

function showProtocolDetails() {
    showNotification('Protocol details modal would open here', 'info');
}

function showGeographicMap() {
    showNotification('Geographic map modal would open here', 'info');
}

function showAllStreams() {
    showSection('streams');
}

function generateReport() {
    showNotification('Generating analytics report...', 'info');
    // This would generate and download a comprehensive report
}

// Load stream performance data for analytics table
async function loadStreamPerformance() {
    try {
        const response = await apiRequest('/analytics/streams');
        if (response.success) {
            updateStreamPerformanceTable(response.data);
        }
    } catch (error) {
        console.error('Failed to load stream performance:', error);
        const tableBody = document.getElementById('streamPerformanceTable');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" class="loading-cell">Failed to load stream performance data</td></tr>';
        }
    }
}

function updateStreamPerformanceTable(streams) {
    const tableBody = document.getElementById('streamPerformanceTable');
    if (!tableBody) return;
    
    if (streams.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="loading-cell">No active streams found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = streams.map(stream => `
        <tr>
            <td>
                <div class="stream-name">
                    <strong>${stream.title}</strong>
                    <div class="stream-id">${stream.stream_key}</div>
                </div>
            </td>
            <td>
                <span class="protocol-badge protocol-${stream.protocol.toLowerCase()}">${stream.protocol.toUpperCase()}</span>
            </td>
            <td>
                <span class="viewer-count">${stream.viewers || 0}</span>
            </td>
            <td>
                <span class="quality-badge quality-${stream.quality}">${stream.quality}</span>
            </td>
            <td>
                <span class="latency ${stream.latency < 100 ? 'good' : stream.latency < 200 ? 'warning' : 'poor'}">${stream.latency || 0}ms</span>
            </td>
            <td>
                <span class="uptime ${stream.uptime > 99 ? 'excellent' : stream.uptime > 95 ? 'good' : 'poor'}">${stream.uptime || 0}%</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-small btn-outline" onclick="viewStreamDetails('${stream.id}')">View</button>
                    <button class="btn btn-small btn-primary" onclick="manageStream('${stream.id}')">Manage</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function viewStreamDetails(streamId) {
    showNotification(`Viewing details for stream ${streamId}`, 'info');
    // This would open a detailed view modal
}

function manageStream(streamId) {
    showNotification(`Managing stream ${streamId}`, 'info');
    // This would open stream management interface
}

// Load analytics when the analytics section is accessed
function loadAnalytics() {
    // Initialize analytics engine if not already done
    if (!window.analyticsEngine) {
        window.analyticsEngine = new window.AnalyticsEngine();
        window.analyticsEngine.init();
    }
    
    // Load stream performance data
    loadStreamPerformance();
    
    // Trigger data refresh
    updateAnalytics();
}

// Export new functions for global access
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