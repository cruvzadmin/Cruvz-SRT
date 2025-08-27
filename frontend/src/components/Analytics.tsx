import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
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
  const [omeStats, setOMEStats] = useState<any>(null);
  const [protocols, setProtocols] = useState<any>(null);
  const [sixSigmaMetrics, setSixSigmaMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = async () => {
    try {
      setError(null);
      
      // Fetch real data from multiple sources
      const [
        analyticsRes,
        metricsRes,
        healthRes,
        omeStatsRes,
        protocolsRes,
        sixSigmaRes
      ] = await Promise.allSettled([
        api.getAnalyticsData('1h'),
        api.getStreamMetrics(),
        api.getSystemHealth(),
        api.getOMEStats(),
        api.getOMEProtocols(),
        api.getSixSigmaMetrics('performance', '1h')
      ]);

      // Handle analytics data
      if (analyticsRes.status === 'fulfilled') {
        setAnalyticsData(analyticsRes.value);
      } else {
        console.warn('Failed to fetch analytics data:', analyticsRes.reason);
      }

      // Handle metrics
      if (metricsRes.status === 'fulfilled') {
        setMetrics(metricsRes.value);
      } else {
        console.warn('Failed to fetch metrics:', metricsRes.reason);
      }

      // Handle system health
      if (healthRes.status === 'fulfilled') {
        setSystemHealth(healthRes.value);
      } else {
        console.warn('Failed to fetch system health:', healthRes.reason);
      }

      // Handle OME stats
      if (omeStatsRes.status === 'fulfilled') {
        setOMEStats(omeStatsRes.value);
      } else {
        console.warn('Failed to fetch OME stats:', omeStatsRes.reason);
      }

      // Handle protocols
      if (protocolsRes.status === 'fulfilled') {
        setProtocols(protocolsRes.value);
      } else {
        console.warn('Failed to fetch protocols:', protocolsRes.reason);
      }

      // Handle Six Sigma metrics
      if (sixSigmaRes.status === 'fulfilled') {
        setSixSigmaMetrics(sixSigmaRes.value);
      } else {
        console.warn('Failed to fetch Six Sigma metrics:', sixSigmaRes.reason);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      setError('Failed to load analytics data. Please check your connection.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    
    let interval: NodeJS.Timeout;
    if (realTimeEnabled) {
      interval = setInterval(fetchAnalyticsData, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [realTimeEnabled]);

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

  const getPieData = () => {
    if (!protocols || !protocols.protocols) {
      return [
        { name: 'RTMP', value: 0, color: '#8884d8' },
        { name: 'WebRTC', value: 0, color: '#82ca9d' },
        { name: 'SRT', value: 0, color: '#ffc658' },
        { name: 'HLS', value: 0, color: '#ff7c7c' }
      ];
    }

    const protocolData = protocols.protocols;
    return [
      { 
        name: 'RTMP', 
        value: protocolData.rtmp?.connections || 0, 
        color: '#8884d8' 
      },
      { 
        name: 'WebRTC', 
        value: protocolData.webrtc?.connections || 0, 
        color: '#82ca9d' 
      },
      { 
        name: 'SRT', 
        value: protocolData.srt?.connections || 0, 
        color: '#ffc658' 
      },
      { 
        name: 'LLHLS', 
        value: protocolData.llhls?.connections || 0, 
        color: '#ff7c7c' 
      }
    ].filter(item => item.value > 0);
  };

  const calculateSigmaLevel = (metrics: any[]) => {
    if (!metrics || metrics.length === 0) return 0;
    const avgSigma = metrics.reduce((sum, m) => sum + (m.sigma_level || 0), 0) / metrics.length;
    return avgSigma.toFixed(2);
  };

  const getOMEConnectionStats = () => {
    if (!omeStats || !omeStats.data) return { input: 0, output: 0, total: 0 };
    
    const stats = omeStats.data;
    return {
      input: stats.inputConnections || 0,
      output: stats.outputConnections || 0,
      total: stats.totalConnections || 0
    };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading analytics data...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={fetchAnalyticsData}>
          Retry
        </Button>
      </Box>
    );
  }

  const connectionStats = getOMEConnectionStats();
  const pieData = getPieData();
  const currentSigmaLevel = calculateSigmaLevel(sixSigmaMetrics);

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

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* System Health Alert */}
      {systemHealth && systemHealth.status !== 'healthy' && (
        <Alert 
          severity={systemHealth.status === 'warning' ? 'warning' : 'error'}
          sx={{ mb: 3 }}
        >
          System health status: {systemHealth.status.toUpperCase()}
          {systemHealth.services && (
            <Box sx={{ mt: 1 }}>
              Services: {Object.entries(systemHealth.services).map(([service, status]) => (
                <Chip 
                  key={service}
                  label={`${service}: ${status}`}
                  color={getHealthColor(status as string)}
                  size="small"
                  sx={{ mr: 1 }}
                />
              ))}
            </Box>
          )}
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
                    {metrics?.liveStreams || connectionStats.total || 0}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    OME Connections: {connectionStats.total}
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
                    {metrics?.totalViewers?.toLocaleString() || connectionStats.output?.toLocaleString() || 0}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    Output: {connectionStats.output} | Input: {connectionStats.input}
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
                    Average Bitrate
                  </Typography>
                  <Typography variant="h3" component="div">
                    {metrics?.avgBitrate ? `${(metrics.avgBitrate / 1000).toFixed(1)}M` : '0M'}
                  </Typography>
                  <Typography variant="body2" color="info.main">
                    <BitrateIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    Bandwidth: {formatBytes(omeStats?.data?.networkSentBytes || 0)}/s
                  </Typography>
                </Box>
                <BitrateIcon sx={{ fontSize: 40, color: 'info.main' }} />
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
                    Six Sigma Level
                  </Typography>
                  <Typography variant="h3" component="div">
                    {currentSigmaLevel}σ
                  </Typography>
                  <Typography variant="body2" color="warning.main">
                    <AnalyticsIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    Quality: {parseFloat(currentSigmaLevel) >= 3.4 ? 'Excellent' : 'Needs Improvement'}
                  </Typography>
                </Box>
                <AnalyticsIcon sx={{ fontSize: 40, color: 'warning.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
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
                    label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
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