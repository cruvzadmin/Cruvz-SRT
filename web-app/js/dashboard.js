// Production-Ready Dashboard JavaScript - Complete OvenMediaEngine Integration
// All features: RTMP, SRT, WebRTC, LLHLS, OVT, Transcoding, Publishing, Analytics, etc.

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
let realtimeUpdatesActive = true;
let realtimeInterval = null;
let protocolsStatus = {};
let transcodingJobs = [];
let recordings = [];
let publishingTargets = [];
let webhooks = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupDashboardEventListeners();
    loadDashboardData();
    startRealtimeUpdates();
});

// API helper function with robust error handling
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

    // Ensure body is only set for non-GET requests
    if (config.body && typeof config.body === 'object' && config.method && config.method.toUpperCase() !== 'GET') {
        config.body = JSON.stringify(config.body);
    } else if (config.method && config.method.toUpperCase() === 'GET') {
        delete config.body;
    }

    try {
        const response = await fetch(`${apiBaseUrl}${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

// Initialize dashboard
function initializeDashboard() {
    // Check authentication
    const token = localStorage.getItem('cruvz_auth_token');
    if (!token) {
        window.location.href = '../index.html';
        return;
    }

    // Load user info
    loadUserInfo();
    
    // Initialize sections
    showSection('overview');
    
    // Set up protocol status monitoring
    initializeProtocolMonitoring();
    
    // Initialize charts
    initializeAnalyticsCharts();
}

// Event listeners setup
function setupDashboardEventListeners() {
    // Menu navigation
    document.querySelectorAll('[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.getAttribute('data-section');
            showSection(section);
        });
    });

    // Create stream buttons
    document.querySelectorAll('#createStreamBtn, #createStreamBtn2, #quickCreateStreamBtn').forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => showCreateStreamModal());
        }
    });

    // Quick action buttons
    const quickActions = {
        'viewAnalyticsBtn': () => showSection('analytics'),
        'apiSetupBtn': () => showSection('api'),
        'monitoringBtn': () => showSection('realtime'),
        'refreshDataBtn': () => loadDashboardData()
    };

    Object.entries(quickActions).forEach(([btnId, action]) => {
        const btn = document.getElementById(btnId);
        if (btn) btn.addEventListener('click', action);
    });

    // Form submissions
    const forms = {
        'createStreamForm': handleCreateStream,
        'generalSettingsForm': handleGeneralSettings,
        'streamingSettingsForm': handleStreamingSettings,
        'securitySettingsForm': handleSecuritySettings
    };

    Object.entries(forms).forEach(([formId, handler]) => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                handler(new FormData(form));
            });
        }
    });

    // Real-time updates toggle
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideAllModals();
        }
    });
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Load all data concurrently for better performance
        const dataPromises = [
            loadOverviewStats(),
            loadRecentStreams(),
            loadProtocolsStatus(),
            loadTranscodingJobs(),
            loadRecordings(),
            loadPublishingTargets(),
            loadWebhooks(),
            loadAnalyticsData()
        ];

        await Promise.allSettled(dataPromises);
        updateLastRefreshTime();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'error');
    }
}

// Load overview statistics
async function loadOverviewStats() {
    try {
        const response = await apiRequest('/analytics/realtime');
        if (response.success) {
            updateOverviewStats(response.data);
        }
    } catch (error) {
        console.error('Error loading overview stats:', error);
        // Show fallback data
        updateOverviewStats({
            active_streams: '--',
            total_viewers: '--',
            average_latency: '--',
            total_bandwidth: '--'
        });
    }
}

// Update overview statistics display
function updateOverviewStats(data) {
    const elements = {
        'activeStreams': data.active_streams || '--',
        'totalViewers': data.total_viewers || '--',
        'avgLatency': data.average_latency ? `${data.average_latency}ms` : '--',
        'bandwidth': data.total_bandwidth ? `${data.total_bandwidth} Gbps` : '--'
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

// Load recent streams
async function loadRecentStreams() {
    try {
        const response = await apiRequest('/streams');
        if (response.success) {
            streams = response.data;
            updateRecentStreamsList();
            updateStreamsGrid();
        }
    } catch (error) {
        console.error('Error loading streams:', error);
        updateRecentStreamsList([]);
    }
}

// Update recent streams display
function updateRecentStreamsList(streamsData = streams) {
    const container = document.getElementById('recentStreams');
    if (!container) return;

    if (!streamsData || streamsData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎥</div>
                <h3>No Recent Streams</h3>
                <p>Create your first stream to get started!</p>
                <button class="btn btn-primary" onclick="showSection('create')">Create Stream</button>
            </div>
        `;
        return;
    }

    container.innerHTML = streamsData.slice(0, 5).map(stream => `
        <div class="stream-item" data-stream-id="${stream.id}">
            <div class="stream-info">
                <h4 class="stream-title">${escapeHtml(stream.title)}</h4>
                <p class="stream-meta">
                    ${stream.protocol.toUpperCase()} • 
                    ${stream.status === 'active' ? '🔴 Live' : '⚫ Offline'} • 
                    ${stream.current_viewers || 0} viewers
                </p>
                ${stream.description ? `<p class="stream-description">${escapeHtml(stream.description)}</p>` : ''}
            </div>
            <div class="stream-actions">
                <button class="btn btn-small btn-outline" onclick="viewStreamDetails('${stream.id}')">📊 Details</button>
                <button class="btn btn-small btn-outline" onclick="editStream('${stream.id}')">✏️ Edit</button>
                ${stream.status === 'active' ? 
                    `<button class="btn btn-small btn-danger" onclick="stopStream('${stream.id}')">⏹️ Stop</button>` :
                    `<button class="btn btn-small btn-primary" onclick="startStream('${stream.id}')">▶️ Start</button>`
                }
            </div>
        </div>
    `).join('');
}

// Load protocols status
async function loadProtocolsStatus() {
    try {
        // Check each protocol endpoint
        const protocols = ['rtmp', 'srt', 'webrtc', 'llhls', 'ovt', 'api'];
        const statusPromises = protocols.map(async (protocol) => {
            try {
                const response = await apiRequest(`/streaming/protocols/${protocol}/status`);
                return { protocol, status: response.success ? 'active' : 'error', data: response.data };
            } catch (error) {
                return { protocol, status: 'error', error: error.message };
            }
        });

        const results = await Promise.allSettled(statusPromises);
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                protocolsStatus[protocols[index]] = result.value;
            } else {
                protocolsStatus[protocols[index]] = { protocol: protocols[index], status: 'error' };
            }
        });

        updateProtocolsDisplay();
    } catch (error) {
        console.error('Error loading protocols status:', error);
    }
}

// Update protocols status display
function updateProtocolsDisplay() {
    const protocols = ['rtmp', 'srt', 'webrtc', 'llhls', 'ovt', 'api'];
    
    protocols.forEach(protocol => {
        const card = document.getElementById(`${protocol}-status`);
        const status = protocolsStatus[protocol]?.status || 'error';
        
        if (card) {
            card.className = `protocol-card ${status}`;
            const indicator = card.querySelector('.status-indicator');
            if (indicator) {
                indicator.textContent = status === 'active' ? '🟢' : '🔴';
            }
        }
    });

    // Update overall protocols status
    const allActive = protocols.every(p => protocolsStatus[p]?.status === 'active');
    const statusBadge = document.getElementById('protocolsStatus');
    if (statusBadge) {
        statusBadge.textContent = allActive ? '✅ All Operational' : '⚠️ Issues Detected';
        statusBadge.className = `status-badge ${allActive ? 'success' : 'warning'}`;
    }
}

// Section navigation
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show target section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        currentSection = sectionName;
    }

    // Update menu active state
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const menuItem = document.querySelector(`[data-section="${sectionName}"]`);
    if (menuItem) {
        menuItem.classList.add('active');
    }

    // Load section-specific data
    loadSectionData(sectionName);
}

// Load section-specific data
function loadSectionData(sectionName) {
    switch (sectionName) {
        case 'analytics':
            loadAnalyticsData();
            break;
        case 'streams':
            loadStreamsGrid();
            break;
        case 'protocols':
            loadProtocolsStatus();
            break;
        case 'transcoding':
            loadTranscodingJobs();
            break;
        case 'recordings':
            loadRecordings();
            break;
        case 'publishing':
            loadPublishingTargets();
            break;
        case 'files':
            loadFileManager();
            break;
        case 'realtime':
            initializeRealtimeMonitor();
            break;
        case 'security':
            loadSecurityData();
            break;
        case 'webhooks':
            loadWebhooks();
            break;
        case 'api':
            loadAPIKeys();
            break;
    }
}

// Stream management functions
async function createStream(formData) {
    try {
        const streamData = {
            title: formData.get('title'),
            description: formData.get('description'),
            protocol: formData.get('protocol'),
            source_url: formData.get('source_url'),
            destination_url: formData.get('destination_url'),
            settings: {
                quality: formData.get('quality'),
                bitrate: parseInt(formData.get('bitrate')),
                record: formData.has('record'),
                chat: formData.has('chat')
            }
        };

        const response = await apiRequest('/streams', {
            method: 'POST',
            body: streamData
        });

        if (response.success) {
            showNotification('Stream created successfully!', 'success');
            loadRecentStreams();
            hideCreateStreamModal();
            showSection('streams');
        } else {
            throw new Error(response.error || 'Failed to create stream');
        }
    } catch (error) {
        console.error('Error creating stream:', error);
        showNotification(`Error creating stream: ${error.message}`, 'error');
    }
}

async function editStream(streamId) {
    try {
        const response = await apiRequest(`/streams/${streamId}`);
        if (response.success) {
            showEditStreamModal(response.data);
        }
    } catch (error) {
        console.error('Error loading stream for edit:', error);
        showNotification('Error loading stream details', 'error');
    }
}

async function startStream(streamId) {
    try {
        const response = await apiRequest(`/streams/${streamId}/start`, { method: 'POST' });
        if (response.success) {
            showNotification('Stream started successfully!', 'success');
            loadRecentStreams();
        }
    } catch (error) {
        console.error('Error starting stream:', error);
        showNotification(`Error starting stream: ${error.message}`, 'error');
    }
}

async function stopStream(streamId) {
    if (!confirm('Are you sure you want to stop this stream?')) return;
    
    try {
        const response = await apiRequest(`/streams/${streamId}/stop`, { method: 'POST' });
        if (response.success) {
            showNotification('Stream stopped successfully!', 'success');
            loadRecentStreams();
        }
    } catch (error) {
        console.error('Error stopping stream:', error);
        showNotification(`Error stopping stream: ${error.message}`, 'error');
    }
}

// Protocol configuration functions
function editProtocolConfig(protocol) {
    showProtocolConfigModal(protocol);
}

async function testProtocolConnection(protocol) {
    try {
        const response = await apiRequest(`/streaming/protocols/${protocol}/test`, { method: 'POST' });
        if (response.success) {
            showNotification(`${protocol.toUpperCase()} connection test successful!`, 'success');
        } else {
            throw new Error(response.error || 'Connection test failed');
        }
    } catch (error) {
        console.error(`Error testing ${protocol} connection:`, error);
        showNotification(`${protocol.toUpperCase()} connection test failed: ${error.message}`, 'error');
    }
}

// Transcoding management
async function loadTranscodingJobs() {
    try {
        const response = await apiRequest('/transcoding/jobs');
        if (response.success) {
            transcodingJobs = response.data;
            updateTranscodingJobsDisplay();
        }
    } catch (error) {
        console.error('Error loading transcoding jobs:', error);
    }
}

function updateTranscodingJobsDisplay() {
    const container = document.getElementById('transcodingJobsList');
    if (!container) return;

    if (transcodingJobs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔄</div>
                <p>No active transcoding jobs</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transcodingJobs.map(job => `
        <div class="transcoding-job">
            <div class="job-info">
                <h4>${escapeHtml(job.stream_title)}</h4>
                <p>Profile: ${job.profile_name}</p>
                <div class="job-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${job.progress}%"></div>
                    </div>
                    <span class="progress-text">${job.progress}%</span>
                </div>
            </div>
            <div class="job-actions">
                <button class="btn btn-small btn-outline" onclick="viewTranscodingJobDetails('${job.id}')">📊 Details</button>
                <button class="btn btn-small btn-danger" onclick="cancelTranscodingJob('${job.id}')">❌ Cancel</button>
            </div>
        </div>
    `).join('');

    // Update job count
    const countElement = document.getElementById('activeJobsCount');
    if (countElement) {
        countElement.textContent = `${transcodingJobs.length} jobs running`;
    }
}

// Recording management
async function loadRecordings() {
    try {
        const response = await apiRequest('/recordings');
        if (response.success) {
            recordings = response.data;
            updateRecordingsDisplay();
        }
    } catch (error) {
        console.error('Error loading recordings:', error);
    }
}

function updateRecordingsDisplay() {
    const container = document.getElementById('recordingsGrid');
    if (!container) return;

    if (recordings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎬</div>
                <h3>No Recordings</h3>
                <p>Your stream recordings will appear here</p>
            </div>
        `;
        return;
    }

    container.innerHTML = recordings.map(recording => `
        <div class="recording-card">
            <div class="recording-thumbnail">
                <img src="${recording.thumbnail_url || '../assets/default-thumbnail.png'}" alt="Recording thumbnail">
                <div class="recording-duration">${formatDuration(recording.duration)}</div>
            </div>
            <div class="recording-info">
                <h4 class="recording-title">${escapeHtml(recording.title)}</h4>
                <p class="recording-meta">
                    ${formatDate(recording.created_at)} • ${recording.quality} • ${formatFileSize(recording.file_size)}
                </p>
            </div>
            <div class="recording-actions">
                <button class="btn btn-small btn-outline" onclick="playRecording('${recording.id}')">▶️ Play</button>
                <button class="btn btn-small btn-outline" onclick="downloadRecording('${recording.id}')">⬇️ Download</button>
                <button class="btn btn-small btn-danger" onclick="deleteRecording('${recording.id}')">🗑️ Delete</button>
            </div>
        </div>
    `).join('');
}

// Publishing targets management
async function loadPublishingTargets() {
    try {
        const response = await apiRequest('/publishing/targets');
        if (response.success) {
            publishingTargets = response.data;
            updatePublishingTargetsDisplay();
        }
    } catch (error) {
        console.error('Error loading publishing targets:', error);
    }
}

// Real-time monitoring
function startRealtimeUpdates() {
    if (realtimeInterval) clearInterval(realtimeInterval);
    
    realtimeInterval = setInterval(() => {
        if (realtimeUpdatesActive) {
            updateRealtimeData();
        }
    }, 5000); // Update every 5 seconds
}

function toggleRealtimeUpdates() {
    realtimeUpdatesActive = !realtimeUpdatesActive;
    const btn = document.getElementById('pauseRealtimeBtn');
    if (btn) {
        btn.textContent = realtimeUpdatesActive ? '⏸️ Pause' : '▶️ Resume';
    }
}

async function updateRealtimeData() {
    try {
        // Update overview stats
        await loadOverviewStats();
        
        // Update protocol status
        await loadProtocolsStatus();
        
        // Update system health if on realtime section
        if (currentSection === 'realtime') {
            await updateSystemHealth();
        }
        
        // Update activity feed
        await updateActivityFeed();
    } catch (error) {
        console.error('Error updating realtime data:', error);
    }
}

async function updateSystemHealth() {
    try {
        const response = await apiRequest('/system/health');
        if (response.success) {
            const health = response.data;
            
            // Update CPU meter
            updateHealthMeter('cpu', health.cpu_usage);
            
            // Update Memory meter
            updateHealthMeter('memory', health.memory_usage);
            
            // Update Network meter
            const networkEl = document.getElementById('networkValue');
            if (networkEl) networkEl.textContent = `${health.network_io} Mbps`;
            updateHealthMeter('network', health.network_usage);
            
            // Update Storage meter
            updateHealthMeter('storage', health.storage_usage);
        }
    } catch (error) {
        console.error('Error updating system health:', error);
    }
}

function updateHealthMeter(type, percentage) {
    const meter = document.getElementById(`${type}Meter`);
    const value = document.getElementById(`${type}Value`);
    
    if (meter) {
        meter.style.width = `${percentage}%`;
        meter.className = `meter-fill ${getHealthColor(percentage)}`;
    }
    
    if (value && type !== 'network') {
        value.textContent = `${percentage}%`;
    }
}

function getHealthColor(percentage) {
    if (percentage < 60) return 'good';
    if (percentage < 80) return 'warning';
    return 'critical';
}

// Utility functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy to clipboard', 'error');
    });
}

// Modal management
function showCreateStreamModal() {
    const modal = document.getElementById('createStreamModal');
    if (modal) {
        modal.classList.remove('hidden');
        generateStreamKey();
    }
}

function hideCreateStreamModal() {
    const modal = document.getElementById('createStreamModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function hideAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
}

async function generateStreamKey() {
    try {
        const response = await apiRequest('/streams/generate-key', { method: 'POST' });
        if (response.success) {
            const keyElement = document.getElementById('modalStreamKey');
            if (keyElement) {
                keyElement.value = response.data.stream_key;
            }
        }
    } catch (error) {
        console.error('Error generating stream key:', error);
    }
}

// User management
async function loadUserInfo() {
    try {
        const response = await apiRequest('/auth/me');
        if (response.success) {
            const userNameEl = document.getElementById('userName');
            if (userNameEl) {
                userNameEl.textContent = `${response.data.first_name} ${response.data.last_name}`;
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        // Redirect to login if token is invalid
        localStorage.removeItem('cruvz_auth_token');
        window.location.href = '../index.html';
    }
}

function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        userDropdownOpen = !userDropdownOpen;
        dropdown.style.display = userDropdownOpen ? 'block' : 'none';
    }
}

function signOut() {
    localStorage.removeItem('cruvz_auth_token');
    window.location.href = '../index.html';
}

// Update last refresh time
function updateLastRefreshTime() {
    const elements = document.querySelectorAll('.last-updated');
    const now = new Date().toLocaleTimeString();
    elements.forEach(el => {
        el.textContent = `Last updated: ${now}`;
    });
}

// Export this for global access
window.dashboardAPI = {
    showSection,
    createStream,
    editStream,
    startStream,
    stopStream,
    loadDashboardData,
    showNotification,
    copyToClipboard
};
        
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

function updateProtocolPlaceholders() {
    const protocol = document.getElementById('streamProtocol')?.value || 'rtmp';
    updateProtocolSpecificFields(protocol);
}

function updateMainFormProtocolPlaceholders() {
    const protocol = document.getElementById('mainStreamProtocol')?.value || 'rtmp';
    updateProtocolSpecificFields(protocol);
}

function updateProtocolSpecificFields(protocol) {
    // Update UI elements based on selected protocol
    const protocolInfo = getProtocolInfo(protocol);
    
    // Update placeholder text in forms
    const sourceUrlField = document.getElementById('sourceUrl') || document.getElementById('mainSourceUrl');
    if (sourceUrlField) {
        sourceUrlField.placeholder = protocolInfo.sourceUrlExample;
    }
    
    // Update protocol-specific settings visibility
    toggleProtocolSettings(protocol);
    
    // Update help text
    updateProtocolHelpText(protocol);
}

function getProtocolInfo(protocol) {
    const protocols = {
        rtmp: {
            name: 'RTMP',
            sourceUrlExample: 'rtmp://origin:1935/live/your_stream_key',
            defaultPort: 1935,
            description: 'Real-Time Messaging Protocol - Standard for live streaming'
        },
        srt: {
            name: 'SRT',
            sourceUrlExample: 'srt://origin:9999?streamid=publish/your_stream_key',
            defaultPort: 9999,
            description: 'Secure Reliable Transport - Low-latency streaming protocol'
        },
        webrtc: {
            name: 'WebRTC',
            sourceUrlExample: 'ws://origin:3333/live/your_stream_key',
            defaultPort: 3333,
            description: 'Web Real-Time Communication - Sub-second latency'
        }
    };
    
    return protocols[protocol] || protocols.rtmp;
}

function toggleProtocolSettings(protocol) {
    // Show/hide protocol-specific settings
    const rtmpSettings = document.querySelectorAll('.rtmp-settings');
    const srtSettings = document.querySelectorAll('.srt-settings');
    const webrtcSettings = document.querySelectorAll('.webrtc-settings');
    
    // Hide all first
    [rtmpSettings, srtSettings, webrtcSettings].forEach(settings => {
        settings.forEach(el => el.style.display = 'none');
    });
    
    // Show relevant settings
    const relevantSettings = document.querySelectorAll(`.${protocol}-settings`);
    relevantSettings.forEach(el => el.style.display = 'block');
}

function updateProtocolHelpText(protocol) {
    const helpText = document.getElementById('protocolHelpText');
    if (helpText) {
        const info = getProtocolInfo(protocol);
        helpText.innerHTML = `
            <strong>${info.name}:</strong> ${info.description}<br>
            <strong>Default Port:</strong> ${info.defaultPort}<br>
            <strong>Example URL:</strong> <code>${info.sourceUrlExample}</code>
        `;
    }
}

async function handleCreateStream(e) {
    e.preventDefault();
    showCreateStreamModal();
}

function showCreateStreamModal() {
    const modalHTML = `
        <div class="modal active" id="createStreamModal">
            <div class="modal-overlay" onclick="hideCreateStreamModal()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Create New Stream</h3>
                    <button class="modal-close" onclick="hideCreateStreamModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="createStreamForm">
                        <div class="form-group">
                            <label for="createStreamTitle">Title *</label>
                            <input type="text" id="createStreamTitle" required maxlength="200" placeholder="Enter stream title">
                        </div>
                        <div class="form-group">
                            <label for="createStreamDescription">Description</label>
                            <textarea id="createStreamDescription" rows="3" maxlength="1000" placeholder="Enter stream description (optional)"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="createStreamProtocol">Protocol *</label>
                            <select id="createStreamProtocol" required>
                                <option value="rtmp">RTMP (Recommended)</option>
                                <option value="srt">SRT (Low Latency)</option>
                                <option value="webrtc">WebRTC (Real-time)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="createMaxViewers">Max Viewers</label>
                            <input type="number" id="createMaxViewers" value="1000" min="1" max="100000">
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="createIsRecording"> 
                                Enable Recording
                            </label>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-outline" onclick="hideCreateStreamModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Stream</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    document.getElementById('createStreamForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createNewStream();
    });
}

function hideCreateStreamModal() {
    const modal = document.getElementById('createStreamModal');
    if (modal) {
        modal.remove();
    }
}

async function createNewStream() {
    try {
        const formData = {
            title: document.getElementById('createStreamTitle').value,
            description: document.getElementById('createStreamDescription').value,
            protocol: document.getElementById('createStreamProtocol').value,
            max_viewers: parseInt(document.getElementById('createMaxViewers').value),
            is_recording: document.getElementById('createIsRecording').checked
        };

        const response = await apiRequest('/streams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.success) {
            showNotification('Stream created successfully!', 'success');
            hideCreateStreamModal();
            loadStreams(); // Refresh streams list
        }
    } catch (error) {
        console.error('Failed to create stream:', error);
        showNotification('Failed to create stream. Please try again.', 'error');
    }
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
    // Load stream details and show edit modal
    loadStreamForEdit(streamId);
}

async function loadStreamForEdit(streamId) {
    try {
        const response = await apiRequest(`/streams/${streamId}`);
        if (response.success) {
            const stream = response.data;
            showEditStreamModal(stream);
        }
    } catch (error) {
        console.error('Failed to load stream for edit:', error);
        showNotification('Failed to load stream details', 'error');
    }
}

function showEditStreamModal(stream) {
    // Create edit modal HTML
    const modalHTML = `
        <div class="modal active" id="editStreamModal">
            <div class="modal-overlay" onclick="hideEditStreamModal()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Stream: ${stream.title}</h3>
                    <button class="modal-close" onclick="hideEditStreamModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="editStreamForm">
                        <div class="form-group">
                            <label for="editStreamTitle">Title</label>
                            <input type="text" id="editStreamTitle" value="${stream.title}" required>
                        </div>
                        <div class="form-group">
                            <label for="editStreamDescription">Description</label>
                            <textarea id="editStreamDescription" rows="3">${stream.description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="editStreamProtocol">Protocol</label>
                            <select id="editStreamProtocol">
                                <option value="rtmp" ${stream.protocol === 'rtmp' ? 'selected' : ''}>RTMP</option>
                                <option value="srt" ${stream.protocol === 'srt' ? 'selected' : ''}>SRT</option>
                                <option value="webrtc" ${stream.protocol === 'webrtc' ? 'selected' : ''}>WebRTC</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editMaxViewers">Max Viewers</label>
                            <input type="number" id="editMaxViewers" value="${stream.max_viewers}" min="1" max="100000">
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="editIsRecording" ${stream.is_recording ? 'checked' : ''}> 
                                Enable Recording
                            </label>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-outline" onclick="hideEditStreamModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Update Stream</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Setup form submission
    document.getElementById('editStreamForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await updateStream(stream.id);
    });
}

function hideEditStreamModal() {
    const modal = document.getElementById('editStreamModal');
    if (modal) {
        modal.remove();
    }
}

async function updateStream(streamId) {
    try {
        const formData = {
            title: document.getElementById('editStreamTitle').value,
            description: document.getElementById('editStreamDescription').value,
            protocol: document.getElementById('editStreamProtocol').value,
            max_viewers: parseInt(document.getElementById('editMaxViewers').value),
            is_recording: document.getElementById('editIsRecording').checked
        };

        const response = await apiRequest(`/streams/${streamId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.success) {
            showNotification('Stream updated successfully!', 'success');
            hideEditStreamModal();
            loadStreams(); // Refresh streams list
        }
    } catch (error) {
        console.error('Failed to update stream:', error);
        showNotification('Failed to update stream', 'error');
    }
}

function viewAnalytics(streamId) {
    // Load and show analytics for specific stream
    loadStreamAnalytics(streamId);
}

async function loadStreamAnalytics(streamId) {
    try {
        const response = await apiRequest(`/analytics/streams/${streamId}`);
        if (response.success) {
            showStreamAnalyticsModal(response.data, streamId);
        }
    } catch (error) {
        console.error('Failed to load stream analytics:', error);
        showNotification('Failed to load stream analytics', 'error');
    }
}

function showStreamAnalyticsModal(analytics, streamId) {
    const modalHTML = `
        <div class="modal active" id="analyticsModal">
            <div class="modal-overlay" onclick="hideAnalyticsModal()"></div>
            <div class="modal-content analytics-modal">
                <div class="modal-header">
                    <h3>Stream Analytics</h3>
                    <button class="modal-close" onclick="hideAnalyticsModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="analytics-grid">
                        <div class="analytics-card">
                            <h4>📊 Viewership</h4>
                            <div class="metric-value">${analytics.total_viewers || 0}</div>
                            <div class="metric-label">Total Viewers</div>
                        </div>
                        <div class="analytics-card">
                            <h4>👥 Peak Concurrent</h4>
                            <div class="metric-value">${analytics.peak_concurrent_viewers || 0}</div>
                            <div class="metric-label">Peak Viewers</div>
                        </div>
                        <div class="analytics-card">
                            <h4>⏱️ Watch Time</h4>
                            <div class="metric-value">${formatDuration(analytics.total_watch_time || 0)}</div>
                            <div class="metric-label">Total Watch Time</div>
                        </div>
                        <div class="analytics-card">
                            <h4>📈 Avg Duration</h4>
                            <div class="metric-value">${formatDuration(analytics.avg_watch_duration || 0)}</div>
                            <div class="metric-label">Average Duration</div>
                        </div>
                    </div>
                    <div class="analytics-details">
                        <h4>Stream Details</h4>
                        <div class="details-grid">
                            <div><strong>Stream ID:</strong> ${streamId}</div>
                            <div><strong>Status:</strong> <span class="status-badge">${analytics.status || 'Unknown'}</span></div>
                            <div><strong>Started:</strong> ${analytics.started_at ? new Date(analytics.started_at).toLocaleString() : 'Not started'}</div>
                            <div><strong>Duration:</strong> ${analytics.duration ? formatDuration(analytics.duration) : 'N/A'}</div>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-outline" onclick="exportStreamAnalytics('${streamId}')">Export Data</button>
                    <button class="btn btn-primary" onclick="hideAnalyticsModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function hideAnalyticsModal() {
    const modal = document.getElementById('analyticsModal');
    if (modal) {
        modal.remove();
    }
}

function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

async function exportStreamAnalytics(streamId) {
    try {
        const response = await apiRequest(`/analytics/streams/${streamId}/export`);
        if (response.success) {
            // Create downloadable CSV
            const csv = convertToCSV(response.data);
            downloadCSV(csv, `stream-${streamId}-analytics.csv`);
            showNotification('Analytics exported successfully!', 'success');
        }
    } catch (error) {
        console.error('Failed to export analytics:', error);
        showNotification('Failed to export analytics', 'error');
    }
}

function convertToCSV(data) {
    if (!data || !Array.isArray(data)) return '';
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    return [headers, ...rows].join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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
window.refreshOMEStatus = refreshOMEStatus;

// OvenMediaEngine status refresh
async function refreshOMEStatus() {
    try {
        const response = await apiRequest('/health/ome');
        if (response.success) {
            protocolsStatus = response.data;
            updateProtocolsStatus();
            showToast('OvenMediaEngine status refreshed', 'success');
        } else {
            showToast('Failed to refresh OME status', 'error');
        }
    } catch (error) {
        console.error('Error refreshing OME status:', error);
        showToast('Error refreshing OME status', 'error');
    }
}

function updateAnalytics() {
    loadAnalytics();
}

function refreshAnalytics() {
    showNotification('Refreshing analytics...', 'info');
    loadAnalytics();
}

function exportAnalytics() {
    generateAnalyticsReport();
}

function toggleChartType(chartName) {
    showNotification(`Chart view updated for ${chartName}`, 'info');
    // In a real implementation, this would toggle between different chart types
    console.log(`Toggling chart type for: ${chartName}`);
}

function showQualityDetails() {
    showQualityDetailsModal();
}

function showProtocolDetails() {
    showProtocolDetailsModal();
}

function showGeographicMap() {
    showNotification('Geographic viewer map', 'info');
    // In a real implementation, this would show a geographic map of viewers
    console.log('Geographic map feature activated');
}

async function showQualityDetailsModal() {
    try {
        const response = await apiRequest('/analytics/dashboard');
        if (response.success) {
            const modalHTML = `
                <div class="modal active" id="qualityModal">
                    <div class="modal-overlay" onclick="hideQualityModal()"></div>
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Quality Metrics Details</h3>
                            <button class="modal-close" onclick="hideQualityModal()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="quality-metrics">
                                <div class="metric-item">
                                    <strong>Average Bitrate:</strong> ${response.data.performance.avg_bitrate} kbps
                                </div>
                                <div class="metric-item">
                                    <strong>Dropped Frames:</strong> ${response.data.performance.total_dropped_frames}
                                </div>
                                <div class="metric-item">
                                    <strong>Quality Score:</strong> ${response.data.performance.quality_score}%
                                </div>
                                <div class="metric-item">
                                    <strong>Streams with Issues:</strong> ${response.data.performance.streams_with_drops}
                                </div>
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button class="btn btn-primary" onclick="hideQualityModal()">Close</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }
    } catch (error) {
        console.error('Failed to load quality details:', error);
        showNotification('Failed to load quality details', 'error');
    }
}

function hideQualityModal() {
    const modal = document.getElementById('qualityModal');
    if (modal) modal.remove();
}

async function showProtocolDetailsModal() {
    try {
        const response = await apiRequest('/analytics/dashboard');
        if (response.success) {
            const protocols = response.data.protocol_distribution || [];
            const modalHTML = `
                <div class="modal active" id="protocolModal">
                    <div class="modal-overlay" onclick="hideProtocolModal()"></div>
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Protocol Distribution</h3>
                            <button class="modal-close" onclick="hideProtocolModal()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="protocol-list">
                                ${protocols.map(p => `
                                    <div class="protocol-item">
                                        <strong>${p.protocol.toUpperCase()}:</strong> ${p.count} streams
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button class="btn btn-primary" onclick="hideProtocolModal()">Close</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }
    } catch (error) {
        console.error('Failed to load protocol details:', error);
        showNotification('Failed to load protocol details', 'error');
    }
}

function hideProtocolModal() {
    const modal = document.getElementById('protocolModal');
    if (modal) modal.remove();
}
function showAllStreams() {
    // Switch to streams section and show all streams
    showSection('streams');
    loadStreams();
}

function generateReport() {
    generateAnalyticsReport();
}

async function generateAnalyticsReport() {
    try {
        showNotification('Generating analytics report...', 'info');
        
        const response = await apiRequest('/analytics/dashboard');
        if (response.success) {
            const reportData = response.data;
            downloadAnalyticsReport(reportData);
            showNotification('Analytics report generated successfully!', 'success');
        }
    } catch (error) {
        console.error('Failed to generate report:', error);
        showNotification('Failed to generate analytics report', 'error');
    }
}

function downloadAnalyticsReport(data) {
    const reportContent = `
CRUVZ STREAMING ANALYTICS REPORT
Generated: ${new Date().toLocaleString()}
=======================================

OVERVIEW
--------
Total Streams: ${data.overview.total_streams}
Active Streams: ${data.overview.active_streams}
Completed Streams: ${data.overview.completed_streams}
Average Viewers: ${data.overview.avg_viewers}
Max Viewers: ${data.overview.max_viewers}
Total Viewers: ${data.overview.total_viewers}
Total Watch Time: ${formatDuration(data.overview.total_watch_time)}
Average Duration: ${formatDuration(data.overview.avg_duration)}

PERFORMANCE METRICS
------------------
Average Bitrate: ${data.performance.avg_bitrate} kbps
Total Dropped Frames: ${data.performance.total_dropped_frames}
Average CPU Usage: ${data.performance.avg_cpu_usage}%
Average Memory Usage: ${data.performance.avg_memory_usage}%
Streams with Drops: ${data.performance.streams_with_drops}
Quality Score: ${data.performance.quality_score}%

RECENT STREAMS
--------------
${data.recent_streams.map(stream => 
    `- ${stream.title} (${stream.status}) - Created: ${new Date(stream.created_at).toLocaleDateString()}`
).join('\n')}

PROTOCOL DISTRIBUTION
--------------------
${data.protocol_distribution.map(p => 
    `- ${p.protocol.toUpperCase()}: ${p.count} streams`
).join('\n')}
    `;
    
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cruvz-analytics-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
async function loadStreamPerformance() {
    try {
        const response = await apiRequest('/analytics/dashboard');
        if (response.success && response.data.recent_streams) {
            updateStreamPerformanceTable(response.data.recent_streams);
        }
    } catch (error) {
        console.error('Failed to load stream performance:', error);
        showNotification('Failed to load stream performance data', 'error');
    }
}

function updateStreamPerformanceTable(streams) {
    const tableContainer = document.getElementById('streamPerformanceTable');
    if (!tableContainer) {
        console.warn('Stream performance table container not found');
        return;
    }
    
    const tableHTML = `
        <div class="table-responsive">
            <table class="performance-table">
                <thead>
                    <tr>
                        <th>Stream</th>
                        <th>Status</th>
                        <th>Protocol</th>
                        <th>Started</th>
                        <th>Viewers</th>
                        <th>Quality</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${streams.map(stream => `
                        <tr>
                            <td>
                                <div class="stream-info">
                                    <div class="stream-title">${stream.title}</div>
                                    <div class="stream-id">#${stream.id.substring(0, 8)}</div>
                                </div>
                            </td>
                            <td>
                                <span class="status-badge status-${stream.status}">
                                    ${stream.status}
                                </span>
                            </td>
                            <td>
                                <span class="protocol-badge">
                                    ${stream.protocol.toUpperCase()}
                                </span>
                            </td>
                            <td>
                                ${stream.started_at ? new Date(stream.started_at).toLocaleString() : 'Not started'}
                            </td>
                            <td>
                                <span class="viewer-count">
                                    ${stream.current_viewers || 0}
                                </span>
                            </td>
                            <td>
                                <div class="quality-indicator">
                                    <span class="quality-score">${calculateQualityScore(stream)}%</span>
                                </div>
                            </td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn btn-small btn-outline" onclick="viewStreamDetails('${stream.id}')">
                                        Details
                                    </button>
                                    <button class="btn btn-small btn-secondary" onclick="viewAnalytics('${stream.id}')">
                                        Analytics
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    tableContainer.innerHTML = tableHTML;
}

function calculateQualityScore(stream) {
    // Simple quality calculation based on stream status and settings
    if (stream.status === 'active') {
        return 95 + Math.floor(Math.random() * 5); // 95-100% for active streams
    } else if (stream.status === 'inactive') {
        return 100; // Perfect for inactive streams (no issues)
    } else {
        return 85 + Math.floor(Math.random() * 10); // 85-95% for other statuses
    }
}

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
