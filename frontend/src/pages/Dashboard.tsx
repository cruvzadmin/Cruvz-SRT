import React, { useState, useEffect } from 'react';
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
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Add as AddIcon,
  LiveTv as LiveTvIcon,
  People as PeopleIcon,
  Analytics as AnalyticsIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
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
  status: 'active' | 'inactive' | 'scheduled';
  viewers: number;
  duration: string;
  quality: string;
  protocol: string;
}

interface ChartData {
  time: string;
  viewers: number;
  streams: number;
  bandwidth: number;
}

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
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

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      
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
          setStreams(streamsData.data.slice(0, 5)); // Show only first 5 streams
        }
      }

      // Generate mock chart data for demo
      const mockChartData = Array.from({ length: 24 }, (_, i) => ({
        time: `${i}:00`,
        viewers: Math.floor(Math.random() * 500) + 100,
        streams: Math.floor(Math.random() * 10) + 2,
        bandwidth: Math.floor(Math.random() * 1000) + 200,
      }));
      setChartData(mockChartData);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Use mock data for demo
      setStats({
        total_streams: 15,
        active_streams: 3,
        total_viewers: 1247,
        total_watch_time: 45680,
        revenue: 892.50,
        bandwidth_used: 2.4,
      });
      
      setStreams([
        {
          id: '1',
          title: 'Live Product Demo',
          status: 'active',
          viewers: 234,
          duration: '1:23:45',
          quality: '1080p',
          protocol: 'WebRTC',
        },
        {
          id: '2',
          title: 'Weekly Webinar',
          status: 'active',
          viewers: 156,
          duration: '0:45:12',
          quality: '720p',
          protocol: 'RTMP',
        },
        {
          id: '3',
          title: 'Gaming Stream',
          status: 'inactive',
          viewers: 0,
          duration: '0:00:00',
          quality: '1080p',
          protocol: 'SRT',
        },
      ]);
    } finally {
      // Removed loading state
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return theme.palette.success.main;
      case 'inactive':
        return theme.palette.text.secondary;
      case 'scheduled':
        return theme.palette.warning.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  return (
    <Box>
      {/* Welcome Header */}
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Welcome back, {user?.first_name}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's what's happening with your streams today.
        </Typography>
      </Box>

      {/* Quick Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Active Streams
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.active_streams}
                  </Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <TrendingUpIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="success.main" ml={0.5}>
                      +12%
                    </Typography>
                  </Box>
                </Box>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                  <LiveTvIcon color="primary" />
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
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Viewers
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.total_viewers.toLocaleString()}
                  </Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <TrendingUpIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="success.main" ml={0.5}>
                      +8%
                    </Typography>
                  </Box>
                </Box>
                <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                  <PeopleIcon color="success" />
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
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Watch Time
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {formatDuration(stats.total_watch_time)}
                  </Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <TrendingDownIcon color="error" fontSize="small" />
                    <Typography variant="body2" color="error.main" ml={0.5}>
                      -3%
                    </Typography>
                  </Box>
                </Box>
                <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1) }}>
                  <AnalyticsIcon color="info" />
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
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Bandwidth
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.bandwidth_used} GB
                  </Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <TrendingUpIcon color="success" fontSize="small" />
                    <Typography variant="body2" color="success.main" ml={0.5}>
                      +15%
                    </Typography>
                  </Box>
                </Box>
                <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                  <CloudUploadIcon color="warning" />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Charts Section */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Viewer Analytics (Last 24 Hours)
              </Typography>
              <Box height={300} mt={2}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="viewers"
                      stroke={theme.palette.primary.main}
                      fill={alpha(theme.palette.primary.main, 0.1)}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Bandwidth Usage
              </Typography>
              <Box height={200} mt={2}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.slice(-12)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="bandwidth"
                      fill={alpha(theme.palette.secondary.main, 0.8)}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Streams */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: 'fit-content' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6" fontWeight="bold">
                  Recent Streams
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

              <Stack spacing={2}>
                {streams.map((stream) => (
                  <Card
                    key={stream.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        boxShadow: theme.shadows[4],
                      },
                    }}
                  >
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box flex={1}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          {stream.title}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                          <Chip
                            label={stream.status}
                            size="small"
                            sx={{
                              bgcolor: alpha(getStatusColor(stream.status), 0.1),
                              color: getStatusColor(stream.status),
                              fontWeight: 500,
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {stream.protocol}
                          </Typography>
                        </Stack>
                        
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            {stream.viewers} viewers
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {stream.duration}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box ml={2}>
                        <IconButton size="small">
                          {stream.status === 'active' ? (
                            <StopIcon color="error" />
                          ) : (
                            <PlayArrowIcon color="success" />
                          )}
                        </IconButton>
                      </Box>
                    </Box>
                  </Card>
                ))}
              </Stack>

              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate('/streams')}
                sx={{ mt: 2 }}
              >
                View All Streams
              </Button>
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
              >
                View Analytics
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => navigate('/recordings')}
              >
                Upload Video
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PeopleIcon />}
                onClick={() => navigate('/audience')}
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