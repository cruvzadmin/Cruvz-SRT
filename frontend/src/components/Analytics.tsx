import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  Timeline,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Visibility as ViewersIcon,
  Speed as BitrateIcon,
  VideoLibrary as StreamsIcon,
  Assessment as AnalyticsIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { api } from '../services/api';

interface AnalyticsData {
  timestamp: string;
  viewers: number;
  bitrate: number;
  fps: number;
  cpuUsage: number;
  memoryUsage: number;
  networkIn: number;
  networkOut: number;
}

interface StreamMetrics {
  totalStreams: number;
  liveStreams: number;
  totalViewers: number;
  avgBitrate: number;
  totalBandwidth: number;
  uptime: string;
  errors: number;
  warnings: number;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  services: {
    ovenmediaengine: 'running' | 'stopped' | 'error';
    database: 'running' | 'stopped' | 'error';
    redis: 'running' | 'stopped' | 'error';
  };
}

const Analytics: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [metrics, setMetrics] = useState<StreamMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);
  const [timeRange, setTimeRange] = useState('1h');

  useEffect(() => {
    fetchAnalyticsData();
    
    let interval: NodeJS.Timeout;
    if (realTimeEnabled) {
      interval = setInterval(fetchAnalyticsData, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [realTimeEnabled, timeRange]);

  const fetchAnalyticsData = async () => {
    try {
      const [analyticsRes, metricsRes, healthRes] = await Promise.all([
        api.get(`/api/analytics/data?range=${timeRange}`),
        api.get('/api/analytics/metrics'),
        api.get('/api/system/health')
      ]);

      setAnalyticsData(analyticsRes.data);
      setMetrics(metricsRes.data);
      setSystemHealth(healthRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': case 'running': return 'success';
      case 'warning': return 'warning';
      case 'critical': case 'error': return 'error';
      case 'stopped': return 'default';
      default: return 'default';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': case 'running': return <SuccessIcon color="success" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'critical': case 'error': return <ErrorIcon color="error" />;
      default: return <ErrorIcon color="disabled" />;
    }
  };

  const pieData = [
    { name: 'RTMP', value: 45, color: '#8884d8' },
    { name: 'WebRTC', value: 30, color: '#82ca9d' },
    { name: 'SRT', value: 15, color: '#ffc658' },
    { name: 'HLS', value: 10, color: '#ff7c7c' }
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Analytics Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={realTimeEnabled}
                onChange={(e) => setRealTimeEnabled(e.target.checked)}
              />
            }
            label="Real-time"
          />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchAnalyticsData}>
            Refresh
          </Button>
          <Button variant="outlined" startIcon={<ExportIcon />}>
            Export
          </Button>
        </Box>
      </Box>

      {/* System Health Alert */}
      {systemHealth && systemHealth.status !== 'healthy' && (
        <Alert 
          severity={systemHealth.status === 'warning' ? 'warning' : 'error'}
          sx={{ mb: 3 }}
        >
          System health status: {systemHealth.status.toUpperCase()}
        </Alert>
      )}

      {/* Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" color="text.secondary">
                    Live Streams
                  </Typography>
                  <Typography variant="h3" component="div">
                    {metrics?.liveStreams || 0}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    +12% from yesterday
                  </Typography>
                </Box>
                <StreamsIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" color="text.secondary">
                    Total Viewers
                  </Typography>
                  <Typography variant="h3" component="div">
                    {metrics?.totalViewers?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    +8% from yesterday
                  </Typography>
                </Box>
                <ViewersIcon sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" color="text.secondary">
                    Avg Bitrate
                  </Typography>
                  <Typography variant="h3" component="div">
                    {metrics?.avgBitrate || 0}
                    <Typography variant="caption"> kbps</Typography>
                  </Typography>
                  <Typography variant="body2" color="error.main">
                    <TrendingDownIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    -3% from yesterday
                  </Typography>
                </Box>
                <BitrateIcon sx={{ fontSize: 40, color: 'warning.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" color="text.secondary">
                    Bandwidth
                  </Typography>
                  <Typography variant="h3" component="div">
                    {formatBytes(metrics?.totalBandwidth || 0)}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    +15% from yesterday
                  </Typography>
                </Box>
                <AnalyticsIcon sx={{ fontSize: 40, color: 'info.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Viewers Over Time */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Viewers Over Time
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area 
                    type="monotone" 
                    dataKey="viewers" 
                    stroke="#8884d8" 
                    fillOpacity={0.3}
                    fill="#8884d8"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Protocol Distribution */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Protocol Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Performance and System Health */}
      <Grid container spacing={3}>
        {/* Bitrate and FPS */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Performance Metrics
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="bitrate" 
                    stroke="#8884d8" 
                    name="Bitrate (kbps)"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="fps" 
                    stroke="#82ca9d" 
                    name="FPS"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* System Health */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                System Health
              </Typography>
              {systemHealth && (
                <Box>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">CPU Usage</Typography>
                      <Typography variant="h6">{systemHealth.cpu}%</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Memory Usage</Typography>
                      <Typography variant="h6">{systemHealth.memory}%</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Disk Usage</Typography>
                      <Typography variant="h6">{systemHealth.disk}%</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Network</Typography>
                      <Typography variant="h6">{systemHealth.network}%</Typography>
                    </Grid>
                  </Grid>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Services Status
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        {getHealthIcon(systemHealth.services.ovenmediaengine)}
                      </ListItemIcon>
                      <ListItemText 
                        primary="OvenMediaEngine"
                        secondary={
                          <Chip 
                            label={systemHealth.services.ovenmediaengine} 
                            size="small"
                            color={getHealthColor(systemHealth.services.ovenmediaengine)}
                          />
                        }
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        {getHealthIcon(systemHealth.services.database)}
                      </ListItemIcon>
                      <ListItemText 
                        primary="Database"
                        secondary={
                          <Chip 
                            label={systemHealth.services.database} 
                            size="small"
                            color={getHealthColor(systemHealth.services.database)}
                          />
                        }
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        {getHealthIcon(systemHealth.services.redis)}
                      </ListItemIcon>
                      <ListItemText 
                        primary="Redis Cache"
                        secondary={
                          <Chip 
                            label={systemHealth.services.redis} 
                            size="small"
                            color={getHealthColor(systemHealth.services.redis)}
                          />
                        }
                      />
                    </ListItem>
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics;