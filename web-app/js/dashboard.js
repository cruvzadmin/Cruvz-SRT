// Dashboard-specific JavaScript functionality

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
    // Form submissions
    const createStreamForm = document.getElementById('createStreamForm');
    if (createStreamForm) {
        createStreamForm.addEventListener('submit', handleCreateStream);
    }
    
    const generalSettingsForm = document.getElementById('generalSettingsForm');
    if (generalSettingsForm) {
        generalSettingsForm.addEventListener('submit', handleGeneralSettings);
    }
    
    const streamingSettingsForm = document.getElementById('streamingSettingsForm');
    if (streamingSettingsForm) {
        streamingSettingsForm.addEventListener('submit', handleStreamingSettings);
    }
    
    const securitySettingsForm = document.getElementById('securitySettingsForm');
    if (securitySettingsForm) {
        securitySettingsForm.addEventListener('submit', handleSecuritySettings);
    }
    
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
        // Simulate API call for now
        const stats = {
            activeStreams: Math.floor(Math.random() * 10) + 1,
            totalViewers: Math.floor(Math.random() * 5000) + 1000,
            avgLatency: Math.floor(Math.random() * 20) + 40,
            bandwidth: (Math.random() * 2 + 1).toFixed(1)
        };
        
        // Update stats display
        document.getElementById('activeStreams').textContent = stats.activeStreams;
        document.getElementById('totalViewers').textContent = stats.totalViewers.toLocaleString();
        document.getElementById('avgLatency').textContent = `${stats.avgLatency}ms`;
        document.getElementById('bandwidth').textContent = `${stats.bandwidth} Gbps`;
        
        // Load recent streams
        loadRecentStreams();
        
    } catch (error) {
        console.error('Failed to load overview data:', error);
    }
}

// Load recent streams
async function loadRecentStreams() {
    try {
        // Simulate recent streams data
        const recentStreams = [
            {
                id: '1',
                title: 'Gaming Session - Live Now',
                status: 'live',
                viewers: 1234,
                duration: '2h 15m',
                thumbnail: '🎮'
            },
            {
                id: '2',
                title: 'Music Performance',
                status: 'offline',
                viewers: 856,
                duration: '1h 30m',
                thumbnail: '🎵'
            },
            {
                id: '3',
                title: 'Educational Webinar',
                status: 'scheduled',
                viewers: 0,
                duration: 'Starts in 1h',
                thumbnail: '📚'
            }
        ];
        
        const recentStreamsContainer = document.getElementById('recentStreams');
        if (recentStreamsContainer) {
            recentStreamsContainer.innerHTML = recentStreams.map(stream => `
                <div class="stream-item">
                    <div class="stream-thumbnail">${stream.thumbnail}</div>
                    <div class="stream-info">
                        <div class="stream-title">${stream.title}</div>
                        <div class="stream-meta">${stream.duration} • ${stream.viewers} viewers</div>
                    </div>
                    <div class="stream-status">
                        <span class="status-badge ${stream.status}">${stream.status}</span>
                    </div>
                </div>
            `).join('');
        }
        
    } catch (error) {
        console.error('Failed to load recent streams:', error);
    }
}

// Load streams
async function loadStreams() {
    try {
        // Simulate streams data
        const streamsData = [
            {
                id: '1',
                title: 'Gaming Session - Live Now',
                description: 'Playing the latest games with viewers',
                status: 'live',
                viewers: 1234,
                quality: '1080p',
                bitrate: '5000',
                thumbnail: '🎮',
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                title: 'Music Performance',
                description: 'Live acoustic performance',
                status: 'offline',
                viewers: 856,
                quality: '720p',
                bitrate: '3000',
                thumbnail: '🎵',
                createdAt: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: '3',
                title: 'Educational Webinar',
                description: 'Learn about streaming technology',
                status: 'scheduled',
                viewers: 0,
                quality: '1080p',
                bitrate: '5000',
                thumbnail: '📚',
                createdAt: new Date(Date.now() + 3600000).toISOString()
            }
        ];
        
        streams = streamsData;
        renderStreams();
        
    } catch (error) {
        console.error('Failed to load streams:', error);
        showNotification('Failed to load streams', 'error');
    }
}

// Render streams
function renderStreams() {
    const streamsGrid = document.getElementById('streamsGrid');
    if (!streamsGrid) return;
    
    if (streams.length === 0) {
        streamsGrid.innerHTML = `
            <div class="empty-state">
                <h3>No streams yet</h3>
                <p>Create your first stream to get started</p>
                <button class="btn btn-primary" onclick="showCreateStreamModal()">Create Stream</button>
            </div>
        `;
        return;
    }
    
    streamsGrid.innerHTML = streams.map(stream => `
        <div class="stream-card">
            <div class="stream-preview">
                <span style="font-size: 4rem;">${stream.thumbnail}</span>
                <div class="stream-overlay">
                    <span class="status-badge ${stream.status}">${stream.status}</span>
                </div>
            </div>
            <div class="stream-card-content">
                <h3 class="stream-card-title">${stream.title}</h3>
                <p class="stream-card-meta">
                    ${stream.quality} • ${stream.bitrate} kbps • ${stream.viewers} viewers
                </p>
                <div class="stream-actions">
                    ${stream.status === 'live' ? 
                        '<button class="btn btn-outline btn-small" onclick="stopStream(\'' + stream.id + '\')">Stop</button>' :
                        '<button class="btn btn-primary btn-small" onclick="startStream(\'' + stream.id + '\')">Start</button>'
                    }
                    <button class="btn btn-outline btn-small" onclick="editStream('${stream.id}')">Edit</button>
                    <button class="btn btn-outline btn-small" onclick="deleteStream('${stream.id}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Load user information
async function loadUserInfo() {
    try {
        // Simulate user data for now
        const user = {
            name: 'John Doe',
            email: 'john@example.com',
            avatar: '../assets/default-avatar.png',
            streamKey: 'sk_' + Math.random().toString(36).substr(2, 24)
        };
        
        // Update user display
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        
        if (userName) userName.textContent = user.name;
        if (userAvatar) userAvatar.src = user.avatar;
        
        // Update stream key
        const streamKeyInput = document.getElementById('streamKey');
        const modalStreamKey = document.getElementById('modalStreamKey');
        
        if (streamKeyInput) streamKeyInput.value = user.streamKey;
        if (modalStreamKey) modalStreamKey.value = user.streamKey;
        
        // Update settings forms
        const displayNameInput = document.getElementById('displayName');
        if (displayNameInput) displayNameInput.value = user.name;
        
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}

// User dropdown functions
function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    const arrow = document.querySelector('.dropdown-arrow');
    
    if (userDropdownOpen) {
        dropdown.classList.remove('active');
        arrow.style.transform = 'rotate(0deg)';
        userDropdownOpen = false;
    } else {
        dropdown.classList.add('active');
        arrow.style.transform = 'rotate(180deg)';
        userDropdownOpen = true;
    }
}

function closeUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    const arrow = document.querySelector('.dropdown-arrow');
    
    if (dropdown) dropdown.classList.remove('active');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
    userDropdownOpen = false;
}

// Create stream functions
function showCreateStreamModal() {
    const modal = document.getElementById('createStreamModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function hideCreateStreamModal() {
    const modal = document.getElementById('createStreamModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// Handle create stream form
async function handleCreateStream(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const streamData = {
        title: formData.get('title'),
        description: formData.get('description'),
        category: formData.get('category'),
        quality: formData.get('quality'),
        bitrate: formData.get('bitrate'),
        record: formData.get('record') === 'on',
        chat: formData.get('chat') === 'on'
    };
    
    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Add to streams list
        const newStream = {
            id: Date.now().toString(),
            ...streamData,
            status: 'offline',
            viewers: 0,
            thumbnail: '🎥',
            createdAt: new Date().toISOString()
        };
        
        streams.unshift(newStream);
        renderStreams();
        
        showNotification('Stream created successfully!', 'success');
        resetCreateForm();
        
    } catch (error) {
        console.error('Failed to create stream:', error);
        showNotification('Failed to create stream', 'error');
    }
}

// Reset create form
function resetCreateForm() {
    const form = document.getElementById('createStreamForm');
    if (form) {
        form.reset();
    }
}

// Start quick stream
async function startQuickStream() {
    try {
        showNotification('Starting quick stream...', 'info');
        hideCreateStreamModal();
        
        // Simulate starting stream
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        showNotification('Stream started successfully!', 'success');
        
        // Redirect to streams section
        showSection('streams');
        
    } catch (error) {
        console.error('Failed to start quick stream:', error);
        showNotification('Failed to start stream', 'error');
    }
}

// Stream management functions
async function startStream(streamId) {
    try {
        const stream = streams.find(s => s.id === streamId);
        if (stream) {
            stream.status = 'live';
            stream.viewers = Math.floor(Math.random() * 1000) + 100;
            renderStreams();
            showNotification(`Stream "${stream.title}" started!`, 'success');
        }
    } catch (error) {
        console.error('Failed to start stream:', error);
        showNotification('Failed to start stream', 'error');
    }
}

async function stopStream(streamId) {
    try {
        const stream = streams.find(s => s.id === streamId);
        if (stream) {
            stream.status = 'offline';
            stream.viewers = 0;
            renderStreams();
            showNotification(`Stream "${stream.title}" stopped!`, 'info');
        }
    } catch (error) {
        console.error('Failed to stop stream:', error);
        showNotification('Failed to stop stream', 'error');
    }
}

async function deleteStream(streamId) {
    if (!confirm('Are you sure you want to delete this stream?')) {
        return;
    }
    
    try {
        streams = streams.filter(s => s.id !== streamId);
        renderStreams();
        showNotification('Stream deleted successfully!', 'success');
    } catch (error) {
        console.error('Failed to delete stream:', error);
        showNotification('Failed to delete stream', 'error');
    }
}

// Settings functions
function showSettingsTab(tabName) {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.textContent.toLowerCase() === tabName) {
            button.classList.add('active');
        }
    });
    
    // Show tab content
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    const targetTab = document.getElementById(`${tabName}-settings`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
}

// Handle settings forms
async function handleGeneralSettings(e) {
    e.preventDefault();
    showNotification('General settings updated!', 'success');
}

async function handleStreamingSettings(e) {
    e.preventDefault();
    showNotification('Streaming settings updated!', 'success');
}

async function handleSecuritySettings(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmNewPassword');
    
    if (newPassword !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    showNotification('Password updated successfully!', 'success');
    e.target.reset();
}

// Stream key functions
function toggleStreamKey() {
    const input = document.getElementById('streamKey');
    const button = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = 'Hide';
    } else {
        input.type = 'password';
        button.textContent = 'Show';
    }
}

function regenerateStreamKey() {
    if (!confirm('Are you sure you want to regenerate your stream key? This will invalidate your current key.')) {
        return;
    }
    
    const newKey = 'sk_' + Math.random().toString(36).substr(2, 24);
    const streamKeyInput = document.getElementById('streamKey');
    const modalStreamKey = document.getElementById('modalStreamKey');
    
    if (streamKeyInput) streamKeyInput.value = newKey;
    if (modalStreamKey) modalStreamKey.value = newKey;
    
    showNotification('Stream key regenerated successfully!', 'success');
}

// Analytics functions
async function loadAnalytics() {
    try {
        // Simulate analytics data
        showNotification('Analytics loaded', 'info');
    } catch (error) {
        console.error('Failed to load analytics:', error);
    }
}

function updateAnalytics() {
    const timeframe = document.getElementById('analyticsTimeframe').value;
    showNotification(`Analytics updated for ${timeframe}`, 'info');
}

// API Keys functions
async function loadAPIKeys() {
    try {
        // Simulate API keys data
        const apiKeys = [
            {
                id: '1',
                name: 'Production API Key',
                key: 'ak_' + Math.random().toString(36).substr(2, 32),
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                lastUsed: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: '2',
                name: 'Development API Key',
                key: 'ak_' + Math.random().toString(36).substr(2, 32),
                createdAt: new Date(Date.now() - 172800000).toISOString(),
                lastUsed: new Date(Date.now() - 7200000).toISOString()
            }
        ];
        
        const apiKeysList = document.getElementById('apiKeysList');
        if (apiKeysList) {
            apiKeysList.innerHTML = apiKeys.map(key => `
                <div class="api-key-item">
                    <div class="api-key-info">
                        <div class="api-key-name">${key.name}</div>
                        <div class="api-key-value">${key.key.substr(0, 20)}...</div>
                    </div>
                    <div class="api-key-actions">
                        <button class="btn btn-outline btn-small" onclick="copyAPIKey('${key.key}')">Copy</button>
                        <button class="btn btn-outline btn-small" onclick="deleteAPIKey('${key.id}')">Delete</button>
                    </div>
                </div>
            `).join('');
        }
        
    } catch (error) {
        console.error('Failed to load API keys:', error);
    }
}

function generateAPIKey() {
    const name = prompt('Enter a name for this API key:');
    if (!name) return;
    
    const newKey = 'ak_' + Math.random().toString(36).substr(2, 32);
    showNotification(`API key "${name}" generated successfully!`, 'success');
    loadAPIKeys(); // Refresh the list
}

function copyAPIKey(key) {
    copyToClipboard(key);
    showNotification('API key copied to clipboard', 'success');
}

function deleteAPIKey(keyId) {
    if (!confirm('Are you sure you want to delete this API key?')) {
        return;
    }
    
    showNotification('API key deleted successfully!', 'success');
    loadAPIKeys(); // Refresh the list
}

// Utility functions
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

function refreshStreams() {
    showNotification('Refreshing streams...', 'info');
    loadStreams();
}

function openMonitoring() {
    window.open('http://localhost:3000', '_blank');
}

function editStream(streamId) {
    showNotification('Edit stream functionality coming soon!', 'info');
}

// Real-time updates
function startRealtimeUpdates() {
    // Update statistics every 30 seconds
    setInterval(() => {
        if (currentSection === 'overview') {
            loadOverviewData();
        }
    }, 30000);
    
    // Update stream viewer counts every 10 seconds
    setInterval(() => {
        streams.forEach(stream => {
            if (stream.status === 'live') {
                const change = Math.floor(Math.random() * 100) - 50;
                stream.viewers = Math.max(0, stream.viewers + change);
            }
        });
        if (currentSection === 'streams') {
            renderStreams();
        }
    }, 10000);
}

// Export functions for global access
window.showSection = showSection;
window.toggleUserDropdown = toggleUserDropdown;
window.showCreateStreamModal = showCreateStreamModal;
window.hideCreateStreamModal = hideCreateStreamModal;
window.startQuickStream = startQuickStream;
window.resetCreateForm = resetCreateForm;
window.startStream = startStream;
window.stopStream = stopStream;
window.editStream = editStream;
window.deleteStream = deleteStream;
window.showSettingsTab = showSettingsTab;
window.toggleStreamKey = toggleStreamKey;
window.regenerateStreamKey = regenerateStreamKey;
window.updateAnalytics = updateAnalytics;
window.generateAPIKey = generateAPIKey;
window.copyAPIKey = copyAPIKey;
window.deleteAPIKey = deleteAPIKey;
window.copyToClipboard = copyToClipboard;
window.refreshStreams = refreshStreams;
window.openMonitoring = openMonitoring;