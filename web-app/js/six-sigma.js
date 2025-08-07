// Six Sigma Dashboard JavaScript

// API Configuration
const API_BASE_URL = window.location.origin + '/api';

// Six Sigma data
let sixSigmaData = null;
let charts = {};

// Initialize Six Sigma dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeSixSigmaDashboard();
    loadSixSigmaData();
    startRealtimeUpdates();
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

// Initialize dashboard
function initializeSixSigmaDashboard() {
    // Check authentication
    const token = localStorage.getItem('cruvz_auth_token');
    if (!token) {
        window.location.href = '../index.html';
        return;
    }
    
    // Initialize charts
    initializeCharts();
    
    // Load user info
    loadUserInfo();
}

// Load Six Sigma data
async function loadSixSigmaData() {
    showLoadingOverlay();
    
    try {
        const response = await apiRequest('/six-sigma/dashboard');
        if (response.success) {
            sixSigmaData = response.data;
            updateSixSigmaDisplay(sixSigmaData);
        } else {
            throw new Error('Failed to load Six Sigma data');
        }
    } catch (error) {
        console.error('Failed to load Six Sigma data:', error);
        showNotification('Failed to load Six Sigma data. Using mock data for demonstration.', 'warning');
        
        // Load mock data for demonstration
        loadMockSixSigmaData();
    } finally {
        hideLoadingOverlay();
    }
}

// Load mock Six Sigma data
function loadMockSixSigmaData() {
    sixSigmaData = {
        overview: {
            overall_sigma_level: 6.0,
            api_sigma_level: 6.0,
            target_sigma_level: 6.0,
            uptime_percentage: 99.99,
            total_defects: 0,
            defect_rate: 0.001
        },
        system_health: {
            cpu_usage: 15.2,
            memory_usage: 42.8,
            disk_usage: 25.1,
            active_connections: 1247,
            active_streams: 5,
            network_in_mbps: 1.2,
            network_out_mbps: 2.4,
            uptime_seconds: 2592000
        },
        streaming_performance: {
            total_measurements: 10000,
            avg_cpu_usage: 12.5,
            avg_memory_usage: 35.2,
            total_dropped_frames: 0,
            frame_drop_rate: 0.0
        },
        user_metrics: {
            total_users: 1250,
            active_users: 847,
            user_activity_rate: 67.8
        },
        defects_by_category: [
            { category: 'streaming', total_defects: 0, avg_sigma: 6.0 },
            { category: 'api', total_defects: 0, avg_sigma: 6.0 },
            { category: 'system', total_defects: 0, avg_sigma: 6.0 },
            { category: 'auth', total_defects: 0, avg_sigma: 6.0 }
        ],
        performance_trends: generateMockTrendData(),
        quality_gates: {
            sigma_level_gate: true,
            uptime_gate: true,
            performance_gate: true,
            error_rate_gate: true
        }
    };
    
    updateSixSigmaDisplay(sixSigmaData);
}

// Generate mock trend data
function generateMockTrendData() {
    const trends = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        trends.push({
            date: date.toISOString().split('T')[0],
            avg_sigma: 5.8 + Math.random() * 0.4, // 5.8 - 6.2
            measurements: 100 + Math.floor(Math.random() * 50),
            total_defects: Math.floor(Math.random() * 3)
        });
    }
    
    return trends;
}

// Update Six Sigma display
function updateSixSigmaDisplay(data) {
    // Update quality gates
    updateQualityGates(data.quality_gates, data.overview);
    
    // Update overview metrics
    updateOverviewMetrics(data.overview);
    
    // Update category analysis
    updateCategoryAnalysis(data.defects_by_category);
    
    // Update system health
    updateSystemHealth(data.system_health);
    
    // Update charts
    updateCharts(data.performance_trends);
}

// Update quality gates
function updateQualityGates(gates, overview) {
    // Sigma Level Gate
    const sigmaGate = document.getElementById('sigmaGate');
    const sigmaLevel = document.getElementById('currentSigmaLevel');
    const sigmaStatus = document.getElementById('sigmaStatus');
    
    sigmaLevel.textContent = `${overview.overall_sigma_level.toFixed(1)}σ`;
    sigmaStatus.textContent = gates.sigma_level_gate ? 'PASS' : 'FAIL';
    sigmaGate.className = `gate-item ${gates.sigma_level_gate ? 'pass' : 'fail'}`;
    
    // Uptime Gate
    const uptimeGate = document.getElementById('uptimeGate');
    const uptime = document.getElementById('currentUptime');
    const uptimeStatus = document.getElementById('uptimeStatus');
    
    uptime.textContent = `${overview.uptime_percentage.toFixed(2)}%`;
    uptimeStatus.textContent = gates.uptime_gate ? 'PASS' : 'FAIL';
    uptimeGate.className = `gate-item ${gates.uptime_gate ? 'pass' : 'fail'}`;
    
    // Performance Gate
    const performanceGate = document.getElementById('performanceGate');
    const performance = document.getElementById('currentPerformance');
    const performanceStatus = document.getElementById('performanceStatus');
    
    performance.textContent = '100%';
    performanceStatus.textContent = gates.performance_gate ? 'PASS' : 'FAIL';
    performanceGate.className = `gate-item ${gates.performance_gate ? 'pass' : 'fail'}`;
    
    // Error Rate Gate
    const errorGate = document.getElementById('errorGate');
    const errorRate = document.getElementById('currentErrorRate');
    const errorStatus = document.getElementById('errorStatus');
    
    errorRate.textContent = `${overview.defect_rate.toFixed(3)}%`;
    errorStatus.textContent = gates.error_rate_gate ? 'PASS' : 'FAIL';
    errorGate.className = `gate-item ${gates.error_rate_gate ? 'pass' : 'fail'}`;
}

// Update overview metrics
function updateOverviewMetrics(overview) {
    // Overall Sigma
    const overallSigma = document.getElementById('overallSigma');
    if (overallSigma) {
        overallSigma.textContent = overview.overall_sigma_level.toFixed(1);
    }
    
    // DPMO (calculate from defect rate)
    const dpmo = document.getElementById('dpmo');
    if (dpmo) {
        const dpmoValue = (overview.defect_rate / 100) * 1000000;
        dpmo.textContent = dpmoValue.toFixed(1);
    }
    
    // Availability
    const availability = document.getElementById('availability');
    if (availability) {
        availability.textContent = overview.uptime_percentage.toFixed(3);
    }
    
    // Process Capability (Cpk)
    const cpk = document.getElementById('cpk');
    if (cpk) {
        // Calculate Cpk from sigma level
        const cpkValue = overview.overall_sigma_level / 3;
        cpk.textContent = cpkValue.toFixed(1);
    }
}

// Update category analysis
function updateCategoryAnalysis(categories) {
    const categoryMap = {
        'streaming': { defects: 'streamingDefects', sigma: 'streamingSigma', status: 'streamingStatus' },
        'api': { defects: 'apiDefects', sigma: 'apiSigma', status: 'apiStatus' },
        'system': { defects: 'systemDefects', sigma: 'systemSigma', status: 'systemStatus' },
        'auth': { defects: 'uxDefects', sigma: 'uxSigma', status: 'uxStatus' }
    };
    
    categories.forEach(category => {
        const mapping = categoryMap[category.category];
        if (mapping) {
            const defectsEl = document.getElementById(mapping.defects);
            const sigmaEl = document.getElementById(mapping.sigma);
            const statusEl = document.getElementById(mapping.status);
            
            if (defectsEl) defectsEl.textContent = category.total_defects;
            if (sigmaEl) sigmaEl.textContent = `${category.avg_sigma.toFixed(1)}σ`;
            
            if (statusEl) {
                let status = 'EXCELLENT';
                let statusClass = 'status-good';
                
                if (category.avg_sigma < 3.0) {
                    status = 'CRITICAL';
                    statusClass = 'status-critical';
                } else if (category.avg_sigma < 4.0) {
                    status = 'POOR';
                    statusClass = 'status-poor';
                } else if (category.avg_sigma < 5.0) {
                    status = 'GOOD';
                    statusClass = 'status-good';
                }
                
                statusEl.textContent = status;
                statusEl.className = `stat-value ${statusClass}`;
            }
        }
    });
}

// Update system health
function updateSystemHealth(health) {
    // CPU Usage
    const cpuUsage = document.getElementById('cpuUsage');
    const cpuFill = document.getElementById('cpuFill');
    if (cpuUsage && cpuFill) {
        cpuUsage.textContent = health.cpu_usage.toFixed(1);
        cpuFill.style.width = `${health.cpu_usage}%`;
        cpuFill.className = `health-fill ${health.cpu_usage > 80 ? 'critical' : health.cpu_usage > 60 ? 'warning' : 'good'}`;
    }
    
    // Memory Usage
    const memoryUsage = document.getElementById('memoryUsage');
    const memoryFill = document.getElementById('memoryFill');
    if (memoryUsage && memoryFill) {
        memoryUsage.textContent = health.memory_usage.toFixed(1);
        memoryFill.style.width = `${health.memory_usage}%`;
        memoryFill.className = `health-fill ${health.memory_usage > 80 ? 'critical' : health.memory_usage > 60 ? 'warning' : 'good'}`;
    }
    
    // Network I/O
    const networkIO = document.getElementById('networkIO');
    if (networkIO) {
        networkIO.textContent = (health.network_in_mbps + health.network_out_mbps).toFixed(1);
    }
    
    // Active Connections
    const activeConnections = document.getElementById('activeConnections');
    if (activeConnections) {
        activeConnections.textContent = health.active_connections.toLocaleString();
    }
}

// Initialize charts
function initializeCharts() {
    // For simplicity, we'll create basic chart visualizations
    // In a real implementation, you'd use Chart.js or similar
    console.log('Charts initialized');
}

// Update charts
function updateCharts(trendData) {
    if (!trendData || trendData.length === 0) return;
    
    // Update sigma trend chart
    updateSigmaChart(trendData);
    
    // Update defect trend chart
    updateDefectChart(trendData);
}

// Update sigma chart
function updateSigmaChart(data) {
    const canvas = document.getElementById('sigmaChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw chart background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
        const y = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
        const x = (width / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    
    // Draw sigma level line
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    data.forEach((point, index) => {
        const x = (width / (data.length - 1)) * index;
        const y = height - ((point.avg_sigma - 5.0) / 1.5) * height; // Scale 5.0-6.5 to canvas height
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Add labels
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText('6.0σ', 5, 15);
    ctx.fillText('5.0σ', 5, height - 5);
}

// Update defect chart
function updateDefectChart(data) {
    const canvas = document.getElementById('defectChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw chart background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    // Draw bars for defects
    const maxDefects = Math.max(...data.map(d => d.total_defects), 1);
    
    data.forEach((point, index) => {
        const barWidth = width / data.length - 2;
        const barHeight = (point.total_defects / maxDefects) * height;
        const x = (width / data.length) * index + 1;
        const y = height - barHeight;
        
        ctx.fillStyle = point.total_defects === 0 ? '#28a745' : '#dc3545';
        ctx.fillRect(x, y, barWidth, barHeight);
    });
    
    // Add labels
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText('Defects', 5, 15);
    ctx.fillText('0', 5, height - 5);
}

// Load user info
async function loadUserInfo() {
    try {
        const response = await apiRequest('/users/profile');
        if (response.success) {
            const user = response.data;
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
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}

// Refresh Six Sigma data
function refreshSixSigmaData() {
    showNotification('Refreshing Six Sigma data...', 'info');
    loadSixSigmaData();
}

// Generate Six Sigma report
async function generateSixSigmaReport() {
    showNotification('Generating Six Sigma report...', 'info');
    
    try {
        const response = await apiRequest('/six-sigma/reports?timeframe=30d');
        if (response.success) {
            // Create and download report
            const reportData = JSON.stringify(response.data, null, 2);
            const blob = new Blob([reportData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `six-sigma-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification('Six Sigma report generated successfully!', 'success');
        }
    } catch (error) {
        console.error('Failed to generate report:', error);
        showNotification('Failed to generate Six Sigma report', 'error');
    }
}

// Export metrics
function exportMetrics() {
    if (!sixSigmaData) {
        showNotification('No data available to export', 'warning');
        return;
    }
    
    const csvData = convertToCSV(sixSigmaData);
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `six-sigma-metrics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Metrics exported successfully!', 'success');
}

// Convert data to CSV
function convertToCSV(data) {
    const headers = ['Date', 'Category', 'Sigma Level', 'Defects', 'Status'];
    const rows = [headers.join(',')];
    
    data.defects_by_category.forEach(category => {
        const row = [
            new Date().toISOString().split('T')[0],
            category.category,
            category.avg_sigma.toFixed(2),
            category.total_defects,
            category.avg_sigma >= 4.0 ? 'PASS' : 'FAIL'
        ];
        rows.push(row.join(','));
    });
    
    return rows.join('\n');
}

// Open Grafana
function openGrafana() {
    window.open('http://localhost:3000', '_blank');
}

// Start real-time updates
function startRealtimeUpdates() {
    // Update data every 30 seconds
    setInterval(() => {
        loadSixSigmaData();
    }, 30000);
}

// Show/hide loading overlay
function showLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// User dropdown functions
function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
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

// Export functions for global access
window.refreshSixSigmaData = refreshSixSigmaData;
window.generateSixSigmaReport = generateSixSigmaReport;
window.exportMetrics = exportMetrics;
window.openGrafana = openGrafana;
window.toggleUserDropdown = toggleUserDropdown;
window.signOut = signOut;