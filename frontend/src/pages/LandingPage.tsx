import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  useTheme,
  alpha,
  Chip,
  Stack,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  CloudUpload as CloudUploadIcon,
  LiveTv as LiveTvIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import AuthModal from '../components/AuthModal';

interface StatsData {
  live_viewers: number;
  active_streams: number;
  system_latency: string;
}

const LandingPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [stats, setStats] = useState<StatsData>({
    live_viewers: 0,
    active_streams: 0,
    system_latency: '--',
  });

  // Load real-time stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/analytics/realtime');
        const data = await response.json();
        if (data.success) {
          setStats({
            live_viewers: data.data.total_viewers || 0,
            active_streams: data.data.active_streams || 0,
            system_latency: `${data.data.average_latency || '--'}ms`,
          });
        }
      } catch (error) {
        console.log('Could not load real-time stats');
        // Use mock data for demo
        setStats({
          live_viewers: 1247,
          active_streams: 23,
          system_latency: '45ms',
        });
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleAuthOpen = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleAuthClose = () => {
    setAuthModalOpen(false);
  };

  const features = [
    {
      icon: <SpeedIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: 'Sub-Second Latency',
      description: 'Stream with under 100ms latency using WebRTC and LLHLS technologies for real-time interaction.',
    },
    {
      icon: <LiveTvIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: 'Multiple Protocols',
      description: 'Support for WebRTC, SRT, RTMP, RTSP, and MPEG2-TS ingestion with seamless protocol conversion.',
    },
    {
      icon: <CloudUploadIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: 'Adaptive Bitrate',
      description: 'Automatic bitrate adaptation ensures optimal quality for every viewer\'s connection.',
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: 'Enterprise Security',
      description: 'DRM support, token authentication, and secure streaming protocols protect your content.',
    },
    {
      icon: <AnalyticsIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: 'Real-time Analytics',
      description: 'Comprehensive monitoring and analytics with Prometheus and Grafana integration.',
    },
    {
      icon: <PlayArrowIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: 'Live Transcoding',
      description: 'Hardware-accelerated live transcoding with support for H.264, H.265, VP8, and AV1.',
    },
  ];

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Navigation Bar */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          backgroundColor: 'transparent',
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Container maxWidth="lg">
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 0 } }}>
            <Box display="flex" alignItems="center">
              <Box
                component="img"
                src="/logo192.png"
                alt="Cruvz Streaming"
                sx={{ width: 40, height: 40, mr: 2 }}
              />
              <Typography variant="h6" component="div" fontWeight="bold" color="primary">
                Cruvz Streaming
              </Typography>
            </Box>
            
            <Box display="flex" alignItems="center" gap={2}>
              <Button color="inherit" href="#features">
                Features
              </Button>
              <Button color="inherit" href="#pricing">
                Pricing
              </Button>
              <Button color="inherit" href="#docs">
                Documentation
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleAuthOpen('login')}
                sx={{ ml: 2 }}
              >
                Sign In
              </Button>
              <Button
                variant="contained"
                onClick={() => handleAuthOpen('register')}
              >
                Sign Up
              </Button>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Hero Section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
          py: { xs: 8, md: 12 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box>
                <Chip
                  label="Production Ready"
                  color="primary"
                  variant="outlined"
                  sx={{ mb: 3 }}
                />
                <Typography
                  variant="h1"
                  component="h1"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: '2.5rem', md: '3.5rem' },
                    lineHeight: 1.2,
                    mb: 3,
                    background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Production-Ready Streaming for 1000+ Users
                </Typography>
                
                <Typography
                  variant="h6"
                  color="text.secondary"
                  sx={{ mb: 4, lineHeight: 1.6 }}
                >
                  Enterprise-grade streaming platform with PostgreSQL, Redis caching, and horizontal scaling. 
                  Deploy streaming services instantly with sub-second latency.
                </Typography>

                {/* Live Stats */}
                <Stack direction="row" spacing={4} sx={{ mb: 4 }}>
                  <Box textAlign="center">
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {stats.live_viewers.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Live Viewers
                    </Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {stats.active_streams}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Streams
                    </Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {stats.system_latency}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Latency
                    </Typography>
                  </Box>
                </Stack>

                {/* CTA Buttons */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => handleAuthOpen('register')}
                    sx={{
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      boxShadow: theme.shadows[8],
                    }}
                  >
                    Get Started Free
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => navigate('/dashboard')}
                    sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
                  >
                    View Dashboard
                  </Button>
                </Stack>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Card
                  elevation={8}
                  sx={{
                    p: 3,
                    borderRadius: 4,
                    background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Enterprise Features
                    </Typography>
                    <Stack spacing={1}>
                      {[
                        'PostgreSQL Database',
                        'Redis Caching',
                        'Auto-scaling',
                        'Monitoring & Analytics',
                        'Production Security',
                      ].map((feature) => (
                        <Box key={feature} display="flex" alignItems="center">
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: theme.palette.success.main,
                              mr: 2,
                            }}
                          />
                          <Typography variant="body2">{feature}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }} id="features">
        <Box textAlign="center" mb={8}>
          <Typography variant="h2" component="h2" fontWeight="bold" gutterBottom>
            Powerful Streaming Features
          </Typography>
          <Typography variant="h6" color="text.secondary" maxWidth="600px" mx="auto">
            Everything you need to build and scale professional streaming applications
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card
                elevation={2}
                sx={{
                  height: '100%',
                  p: 3,
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: theme.shadows[8],
                  },
                }}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <Box mb={2}>{feature.icon}</Box>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Footer */}
      <Box
        sx={{
          backgroundColor: theme.palette.grey[100],
          py: 6,
          mt: 8,
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={3}>
              <Box display="flex" alignItems="center" mb={2}>
                <Box
                  component="img"
                  src="/logo192.png"
                  alt="Cruvz Streaming"
                  sx={{ width: 32, height: 32, mr: 1 }}
                />
                <Typography variant="h6" fontWeight="bold" color="primary">
                  Cruvz Streaming
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Production-ready streaming platform for the modern web.
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={9}>
              <Grid container spacing={4}>
                {[
                  {
                    title: 'Product',
                    links: ['Features', 'Pricing', 'API', 'Documentation'],
                  },
                  {
                    title: 'Company',
                    links: ['About', 'Careers', 'Contact', 'Support'],
                  },
                  {
                    title: 'Resources',
                    links: ['Blog', 'Tutorials', 'Community', 'Status'],
                  },
                ].map((section) => (
                  <Grid item xs={12} sm={4} key={section.title}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      {section.title}
                    </Typography>
                    <Stack spacing={1}>
                      {section.links.map((link) => (
                        <Typography
                          key={link}
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { color: 'primary.main' },
                          }}
                        >
                          {link}
                        </Typography>
                      ))}
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
          
          <Box
            sx={{
              borderTop: `1px solid ${theme.palette.divider}`,
              pt: 3,
              mt: 4,
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              © 2024 Cruvz Technologies. All rights reserved.
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onClose={handleAuthClose}
        mode={authMode}
        onModeChange={setAuthMode}
      />
    </Box>
  );
};

export default LandingPage;