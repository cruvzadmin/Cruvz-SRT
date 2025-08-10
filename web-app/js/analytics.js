// Real-time Analytics Module for Cruvz Streaming Platform

class AnalyticsEngine {
    constructor() {
        this.charts = {};
        this.realTimeData = {
            viewers: [],
            bandwidth: [],
            latency: [],
            quality: []
        };
        this.updateInterval = null;
        this.websocket = null;
        this.isConnected = false;
    }

    // Initialize analytics system
    async init() {
        await this.loadChartLibrary();
        this.initializeCharts();
        this.startRealTimeUpdates();
        this.connectWebSocket();
    }

    // Load Chart.js library dynamically
    async loadChartLibrary() {
        if (window.Chart) return;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Initialize all analytics charts
    initializeCharts() {
        this.createViewersChart();
        this.createBandwidthChart();
        this.createLatencyChart();
        this.createQualityChart();
        this.createStreamDistributionChart();
        this.createGeographicChart();
    }

    // Create real-time viewers chart
    createViewersChart() {
        const ctx = document.getElementById('viewersChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.viewers = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(),
                datasets: [{
                    label: 'Active Viewers',
                    data: [],
                    borderColor: 'rgb(99, 102, 241)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white'
                    }
                }
            }
        });
    }

    // Create bandwidth usage chart
    createBandwidthChart() {
        const ctx = document.getElementById('bandwidthChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.bandwidth = new Chart(ctx, {
            type: 'area',
            data: {
                labels: this.generateTimeLabels(),
                datasets: [{
                    label: 'Bandwidth (Mbps)',
                    data: [],
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // Create latency monitoring chart
    createLatencyChart() {
        const ctx = document.getElementById('latencyChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.latency = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(),
                datasets: [{
                    label: 'Latency (ms)',
                    data: [],
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1000,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // Create stream quality chart
    createQualityChart() {
        const ctx = document.getElementById('qualityChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.quality = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['1080p', '720p', '480p', '360p'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        'rgb(99, 102, 241)',
                        'rgb(34, 197, 94)',
                        'rgb(251, 191, 36)',
                        'rgb(239, 68, 68)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // Create stream distribution chart
    createStreamDistributionChart() {
        const ctx = document.getElementById('streamDistributionChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.distribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['RTMP', 'SRT', 'WebRTC'],
                datasets: [{
                    label: 'Active Streams',
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.8)',
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(251, 191, 36, 0.8)'
                    ],
                    borderColor: [
                        'rgb(99, 102, 241)',
                        'rgb(34, 197, 94)',
                        'rgb(251, 191, 36)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // Create geographic distribution chart
    createGeographicChart() {
        const ctx = document.getElementById('geographicChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.geographic = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['North America', 'Europe', 'Asia', 'Others'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        'rgb(99, 102, 241)',
                        'rgb(34, 197, 94)',
                        'rgb(251, 191, 36)',
                        'rgb(239, 68, 68)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // Generate time labels for charts
    generateTimeLabels() {
        const labels = [];
        const now = new Date();
        for (let i = 19; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 30000); // 30 second intervals
            labels.push(time.toLocaleTimeString('en-US', { 
                hour12: false,
                minute: '2-digit',
                second: '2-digit'
            }));
        }
        return labels;
    }

    // Connect to WebSocket for real-time updates
    connectWebSocket() {
        const wsUrl = `ws://${window.location.hostname}:5000/ws/analytics`;
        
        try {
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('Analytics WebSocket connected');
                this.isConnected = true;
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.updateRealTimeData(data);
            };
            
            this.websocket.onclose = () => {
                console.log('Analytics WebSocket disconnected');
                this.isConnected = false;
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.connectWebSocket(), 5000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('Analytics WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            // Fall back to polling
            this.startPolling();
        }
    }

    // Start real-time updates
    startRealTimeUpdates() {
        this.updateInterval = setInterval(() => {
            if (!this.isConnected) {
                this.fetchAnalyticsData();
            }
        }, 30000); // Update every 30 seconds if WebSocket is not available
    }

    // Fetch analytics data from API
    async fetchAnalyticsData() {
        try {
            const token = localStorage.getItem('cruvz_auth_token');
            const response = await fetch('/api/analytics/realtime', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateRealTimeData(data);
            }
        } catch (error) {
            console.error('Failed to fetch analytics data:', error);
        }
    }

    // Update charts with real-time data
    updateRealTimeData(data) {
        // Update viewers chart
        if (this.charts.viewers) {
            this.updateChart(this.charts.viewers, data.viewers || 0);
        }

        // Update bandwidth chart
        if (this.charts.bandwidth) {
            this.updateChart(this.charts.bandwidth, data.bandwidth || 0);
        }

        // Update latency chart
        if (this.charts.latency) {
            this.updateChart(this.charts.latency, data.latency || 0);
        }

        // Update quality distribution
        if (this.charts.quality && data.qualityDistribution) {
            this.charts.quality.data.datasets[0].data = data.qualityDistribution;
            this.charts.quality.update('none');
        }

        // Update stream distribution
        if (this.charts.distribution && data.streamDistribution) {
            this.charts.distribution.data.datasets[0].data = data.streamDistribution;
            this.charts.distribution.update('none');
        }

        // Update geographic distribution
        if (this.charts.geographic && data.geographicDistribution) {
            this.charts.geographic.data.datasets[0].data = data.geographicDistribution;
            this.charts.geographic.update('none');
        }

        // Update summary stats
        this.updateSummaryStats(data);
    }

    // Update chart with new data point
    updateChart(chart, newValue) {
        const dataset = chart.data.datasets[0];
        dataset.data.push(newValue);
        
        // Keep only last 20 data points
        if (dataset.data.length > 20) {
            dataset.data.shift();
            chart.data.labels.shift();
        }
        
        // Add new time label
        const now = new Date();
        chart.data.labels.push(now.toLocaleTimeString('en-US', { 
            hour12: false,
            minute: '2-digit',
            second: '2-digit'
        }));
        
        chart.update('none');
    }

    // Update summary statistics
    updateSummaryStats(data) {
        const elements = {
            activeStreams: document.getElementById('activeStreams'),
            totalViewers: document.getElementById('totalViewers'),
            avgLatency: document.getElementById('avgLatency'),
            bandwidth: document.getElementById('bandwidth')
        };

        if (elements.activeStreams) {
            elements.activeStreams.textContent = data.activeStreams || 0;
        }
        if (elements.totalViewers) {
            elements.totalViewers.textContent = data.totalViewers || 0;
        }
        if (elements.avgLatency) {
            elements.avgLatency.textContent = `${data.averageLatency || 0}ms`;
        }
        if (elements.bandwidth) {
            elements.bandwidth.textContent = `${(data.totalBandwidth || 0).toFixed(1)} Gbps`;
        }
    }

    // Start polling fallback
    startPolling() {
        setInterval(() => {
            this.fetchAnalyticsData();
        }, 30000);
    }

    // Clean up
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.websocket) {
            this.websocket.close();
        }
        
        // Destroy all charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
    }

    // Export analytics data
    async exportData(format = 'csv', dateRange = '24h') {
        try {
            const token = localStorage.getItem('cruvz_auth_token');
            const response = await fetch(`/api/analytics/export?format=${format}&range=${dateRange}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-${new Date().toISOString().split('T')[0]}.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Failed to export analytics data:', error);
        }
    }
}

// Initialize analytics when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('viewersChart')) {
        window.analyticsEngine = new AnalyticsEngine();
        window.analyticsEngine.init();
    }
});

// Export for use in other modules
window.AnalyticsEngine = AnalyticsEngine;