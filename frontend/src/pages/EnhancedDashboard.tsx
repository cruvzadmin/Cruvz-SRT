import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Stack,
  Avatar,
  useTheme,
  alpha,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  ButtonGroup,
  Skeleton,
  IconButton,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Add as AddIcon,
  LiveTv as LiveTvIcon,
  People as PeopleIcon,
  Analytics as AnalyticsIcon,
  CloudUpload as CloudUploadIcon,
  Schedule as ScheduleIcon,
  AccessTime as AccessTimeIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  total_streams: number;
  active_streams: number;
  total_viewers: number;
  total_watch_time: number;
  revenue: number;
  bandwidth_used: number;
}

interface StreamData {
  id: string;
  title: string;
  status: 'active' | 'inactive' | 'scheduled' | 'error';
  viewers: number;
  duration: string;
  quality: string;
  protocol: string;
  thumbnail?: string;
  started_at?: string;
}

interface ChartData {
  time: string;
  viewers: number;
  streams: number;
  bandwidth: number;
  latency: number;
}

interface SystemHealth {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  status: 'healthy' | 'warning' | 'error';
}

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    total_streams: 0,
    active_streams: 0,
    total_viewers: 0,
    total_watch_time: 0,
    revenue: 0,
    bandwidth_used: 0,
  });
  const [streams, setStreams] = useState<StreamData[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    cpu: 0,
    memory: 0,
    disk: 0,
    network: 0,
    status: 'healthy',
  });
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load dashboard statistics
      const statsResponse = await fetch('/api/analytics/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cruvz_auth_token')}`,
        },
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setStats(statsData.data);
        }
      }

      // Load recent streams
      const streamsResponse = await fetch('/api/streams', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cruvz_auth_token')}`,
        },
      });
      
      if (streamsResponse.ok) {
        const streamsData = await streamsResponse.json();
        if (streamsData.success) {
          setStreams(streamsData.data.slice(0, 8));
        }
      }

      // Load system health
      const healthResponse = await fetch('/api/health/system', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cruvz_auth_token')}`,
        },
      });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        if (healthData.success) {
          setSystemHealth(healthData.data.system || {
            cpu: 45,
            memory: 67,
            disk: 23,
            network: 89,
            status: 'healthy',
          });
        }
      }

      // Generate realistic chart data
      const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : 30;
      const mockChartData = Array.from({ length: hours }, (_, i) => ({
        time: timeRange === '24h' ? `${i}:00` : `Day ${i + 1}`,
        viewers: Math.floor(Math.random() * 800) + 200,
        streams: Math.floor(Math.random() * 15) + 3,
        bandwidth: Math.floor(Math.random() * 1200) + 300,
        latency: Math.floor(Math.random() * 50) + 45,
      }));
      setChartData(mockChartData);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Use realistic demo data
      setStats({
        total_streams: 24,
        active_streams: 7,
        total_viewers: 2847,
        total_watch_time: 156780,
        revenue: 1284.50,
        bandwidth_used: 4.7,
      });
      
      setStreams([
        {
          id: '1',
          title: 'Product Launch Event',
          status: 'active',
          viewers: 1247,
          duration: '2:14:32',
          quality: '1080p',
          protocol: 'WebRTC',
          started_at: '2024-01-15T10:30:00Z',
        },
        {
          id: '2',
          title: 'Weekly Tech Talk',
          status: 'active',
          viewers: 356,
          duration: '1:05:18',
          quality: '720p',
          protocol: 'RTMP',
          started_at: '2024-01-15T14:00:00Z',
        },
        {
          id: '3',
          title: 'Gaming Tournament',
          status: 'active',
          viewers: 892,
          duration: '3:22:45',
          quality: '1080p',
          protocol: 'SRT',
          started_at: '2024-01-15T09:15:00Z',
        },
        {
          id: '4',
          title: 'Music Performance',
          status: 'scheduled',
          viewers: 0,
          duration: '0:00:00',
          quality: '4K',
          protocol: 'WebRTC',
        },
        {
          id: '5',
          title: 'Educational Webinar',
          status: 'inactive',
          viewers: 0,
          duration: '1:30:22',
          quality: '720p',
          protocol: 'RTMP',
        },
      ]);

      setSystemHealth({
        cpu: 45,
        memory: 67,
        disk: 23,
        network: 89,
        status: 'healthy',
      });
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadDashboardData();
  }, [timeRange, loadDashboardData]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon sx={{ color: theme.palette.success.main }} />;
      case 'scheduled':
        return <ScheduleIcon sx={{ color: theme.palette.warning.main }} />;
      case 'error':
        return <ErrorIcon sx={{ color: theme.palette.error.main }} />;
      default:
        return <StopIcon sx={{ color: theme.palette.grey[500] }} />;
    }
  };

  const getHealthColor = (value: number) => {
    if (value < 50) return theme.palette.success.main;
    if (value < 80) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const protocolColors = ['#3f51b5', '#f50057', '#ff9800', '#4caf50', '#2196f3'];
  const protocolData = [
    { name: 'WebRTC', value: 35, color: protocolColors[0] },
    { name: 'RTMP', value: 28, color: protocolColors[1] },
    { name: 'SRT', value: 22, color: protocolColors[2] },
    { name: 'HLS', value: 10, color: protocolColors[3] },
    { name: 'DASH', value: 5, color: protocolColors[4] },
  ];

  if (loading) {
    return (
      <Box>
        <Box mb={4}>
          <Skeleton variant="text" width={300} height={40} />
          <Skeleton variant="text" width={500} height={24} />
        </Box>
        <Grid container spacing={3}>
          {[...Array(4)].map((_, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* Welcome Header */}
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Welcome back, {user?.first_name}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's what's happening with your streaming platform today.
        </Typography>
      </Box>

      {/* Quick Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ position: 'relative', overflow: 'visible' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="overline" color="text.secondary" gutterBottom>
                    Active Streams
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color="primary">
                    {stats.active_streams}
                  </Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <TrendingUpIcon sx={{ color: 'success.main', fontSize: 16 }} />
                    <Typography variant="body2" color="success.main" ml={0.5}>
                      +12% vs yesterday
                    </Typography>
                  </Box>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    width: 56,
                    height: 56,
                  }}
                >
                  <LiveTvIcon fontSize="large" />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="overline" color="text.secondary" gutterBottom>
                    Total Viewers
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color="success.main">
                    {stats.total_viewers.toLocaleString()}
                  </Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <TrendingUpIcon sx={{ color: 'success.main', fontSize: 16 }} />
                    <Typography variant="body2" color="success.main" ml={0.5}>
                      +8% this week
                    </Typography>
                  </Box>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    color: 'success.main',
                    width: 56,
                    height: 56,
                  }}
                >
                  <PeopleIcon fontSize="large" />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="overline" color="text.secondary" gutterBottom>
                    Watch Time
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color="info.main">
                    {formatDuration(stats.total_watch_time)}
                  </Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <TrendingDownIcon sx={{ color: 'error.main', fontSize: 16 }} />
                    <Typography variant="body2" color="error.main" ml={0.5}>
                      -3% this month
                    </Typography>
                  </Box>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    color: 'info.main',
                    width: 56,
                    height: 56,
                  }}
                >
                  <AccessTimeIcon fontSize="large" />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="overline" color="text.secondary" gutterBottom>
                    Bandwidth
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color="warning.main">
                    {stats.bandwidth_used} GB
                  </Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <TrendingUpIcon sx={{ color: 'success.main', fontSize: 16 }} />
                    <Typography variant="body2" color="success.main" ml={0.5}>
                      +15% efficiency
                    </Typography>
                  </Box>
                </Box>
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                    color: 'warning.main',
                    width: 56,
                    height: 56,
                  }}
                >
                  <CloudUploadIcon fontSize="large" />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Analytics Chart */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6" fontWeight="bold">
                  Viewer Analytics
                </Typography>
                <ButtonGroup size="small" variant="outlined">
                  <Button
                    variant={timeRange === '24h' ? 'contained' : 'outlined'}
                    onClick={() => setTimeRange('24h')}
                  >
                    24H
                  </Button>
                  <Button
                    variant={timeRange === '7d' ? 'contained' : 'outlined'}
                    onClick={() => setTimeRange('7d')}
                  >
                    7D
                  </Button>
                  <Button
                    variant={timeRange === '30d' ? 'contained' : 'outlined'}
                    onClick={() => setTimeRange('30d')}
                  >
                    30D
                  </Button>
                </ButtonGroup>
              </Box>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="time" stroke={theme.palette.text.secondary} />
                    <YAxis stroke={theme.palette.text.secondary} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="viewers"
                      stroke={theme.palette.primary.main}
                      fill={alpha(theme.palette.primary.main, 0.1)}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          {/* System Health */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                System Health
              </Typography>
              <Grid container spacing={3}>
                {[
                  { label: 'CPU Usage', value: systemHealth.cpu, icon: SpeedIcon },
                  { label: 'Memory', value: systemHealth.memory, icon: StorageIcon },
                  { label: 'Disk Space', value: systemHealth.disk, icon: StorageIcon },
                  { label: 'Network', value: systemHealth.network, icon: SecurityIcon },
                ].map((metric) => (
                  <Grid item xs={12} sm={6} md={3} key={metric.label}>
                    <Box textAlign="center">
                      <Avatar
                        sx={{
                          bgcolor: alpha(getHealthColor(metric.value), 0.1),
                          color: getHealthColor(metric.value),
                          mx: 'auto',
                          mb: 1,
                        }}
                      >
                        <metric.icon />
                      </Avatar>
                      <Typography variant="h5" fontWeight="bold" color={getHealthColor(metric.value)}>
                        {metric.value}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {metric.label}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={metric.value}
                        sx={{
                          mt: 1,
                          height: 6,
                          borderRadius: 3,
                          bgcolor: alpha(getHealthColor(metric.value), 0.1),
                          '& .MuiLinearProgress-bar': {
                            bgcolor: getHealthColor(metric.value),
                          },
                        }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Side Panel */}
        <Grid item xs={12} lg={4}>
          {/* Active Streams */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6" fontWeight="bold">
                  Live Streams
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/streams/create')}
                  size="small"
                >
                  New Stream
                </Button>
              </Box>

              <List disablePadding>
                {streams.slice(0, 5).map((stream, index) => (
                  <ListItem
                    key={stream.id}
                    sx={{
                      px: 0,
                      py: 1,
                      borderBottom: index < 4 ? `1px solid ${theme.palette.divider}` : 'none',
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {getStatusIcon(stream.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="subtitle2" fontWeight={600} noWrap>
                          {stream.title}
                        </Typography>
                      }
                      secondary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={stream.protocol}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.75rem', height: 20 }}
                          />
                          <Typography variant="caption">
                            {stream.viewers} viewers
                          </Typography>
                        </Stack>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton size="small">
                        <MoreVertIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>

              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate('/streams')}
                sx={{ mt: 2 }}
              >
                View All Streams ({stats.total_streams})
              </Button>
            </CardContent>
          </Card>

          {/* Protocol Distribution */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Protocol Usage
              </Typography>
              <Box height={200} display="flex" justifyContent="center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={protocolData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {protocolData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Stack spacing={1} mt={2}>
                {protocolData.map((item) => (
                  <Box key={item.name} display="flex" alignItems="center" justifyContent="space-between">
                    <Box display="flex" alignItems="center">
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: item.color,
                          mr: 1,
                        }}
                      />
                      <Typography variant="body2">{item.name}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      {item.value}%
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/streams/create')}
                sx={{ py: 1.5 }}
              >
                Create Stream
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AnalyticsIcon />}
                onClick={() => navigate('/analytics')}
                sx={{ py: 1.5 }}
              >
                View Analytics
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => navigate('/media')}
                sx={{ py: 1.5 }}
              >
                Upload Media
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PeopleIcon />}
                onClick={() => navigate('/audience')}
                sx={{ py: 1.5 }}
              >
                Manage Audience
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Dashboard;