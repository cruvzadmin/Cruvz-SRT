import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { api, SixSigmaMetric } from '../services/api';

interface QualityDashboard {
  overall_sigma_level: number;
  categories: {
    [key: string]: {
      sigma_level: number;
      metrics_count: number;
      target_achievement: number;
    }
  };
  trends: {
    timestamp: string;
    sigma_level: number;
  }[];
  critical_metrics: SixSigmaMetric[];
}

const SixSigmaQuality: React.FC = () => {
  const [dashboard, setDashboard] = useState<QualityDashboard | null>(null);
  const [metrics, setMetrics] = useState<SixSigmaMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [selectedCategory, timeRange]);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      
      const [dashboardRes, metricsRes] = await Promise.allSettled([
        api.getQualityDashboard(),
        api.getSixSigmaMetrics(selectedCategory === 'all' ? undefined : selectedCategory, timeRange)
      ]);

      if (dashboardRes.status === 'fulfilled') {
        setDashboard(dashboardRes.value);
      } else {
        console.warn('Failed to fetch dashboard:', dashboardRes.reason);
      }

      if (metricsRes.status === 'fulfilled') {
        setMetrics(metricsRes.value);
      } else {
        console.warn('Failed to fetch metrics:', metricsRes.reason);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch Six Sigma data:', error);
      setError('Failed to load Six Sigma quality data');
      setLoading(false);
    }
  };

  const getSigmaLevelColor = (sigmaLevel: number) => {
    if (sigmaLevel >= 4.5) return 'success';
    if (sigmaLevel >= 3.4) return 'warning';
    return 'error';
  };

  const getSigmaLevelLabel = (sigmaLevel: number) => {
    if (sigmaLevel >= 6.0) return 'World Class (6σ)';
    if (sigmaLevel >= 4.5) return 'Excellent (4.5σ+)';
    if (sigmaLevel >= 3.4) return 'Good (3.4σ+)';
    if (sigmaLevel >= 2.0) return 'Average (2σ+)';
    return 'Poor (<2σ)';
  };

  const calculateDefectsPerMillion = (sigmaLevel: number) => {
    // Approximate DPMO for Six Sigma levels
    const dpmoMap: { [key: number]: number } = {
      6: 3.4,
      5: 233,
      4: 6210,
      3: 66807,
      2: 308537,
      1: 691462
    };
    
    const level = Math.floor(sigmaLevel);
    return dpmoMap[level] || dpmoMap[1];
  };

  const formatMetricValue = (value: number, metricName: string) => {
    if (metricName.includes('percentage') || metricName.includes('rate')) {
      return `${(value * 100).toFixed(2)}%`;
    }
    if (metricName.includes('latency') || metricName.includes('time')) {
      return `${value.toFixed(2)}ms`;
    }
    if (metricName.includes('bytes') || metricName.includes('bandwidth')) {
      return formatBytes(value);
    }
    return value.toFixed(2);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading Six Sigma quality metrics...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={fetchDashboardData}>
          Retry
        </Button>
      </Box>
    );
  }

  const overallSigma = dashboard?.overall_sigma_level || 0;
  const defectsPerMillion = calculateDefectsPerMillion(overallSigma);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Six Sigma Quality Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={selectedCategory}
              label="Category"
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <MenuItem value="all">All Categories</MenuItem>
              <MenuItem value="performance">Performance</MenuItem>
              <MenuItem value="streaming_engine">Streaming Engine</MenuItem>
              <MenuItem value="network">Network</MenuItem>
              <MenuItem value="quality">Quality</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="1h">Last Hour</MenuItem>
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchDashboardData}>
            Refresh
          </Button>
          <Button variant="outlined" startIcon={<ExportIcon />}>
            Export Report
          </Button>
        </Box>
      </Box>

      {/* Overall Quality Status */}
      <Alert 
        severity={getSigmaLevelColor(overallSigma)}
        sx={{ mb: 3 }}
        icon={overallSigma >= 3.4 ? <CheckCircleIcon /> : <WarningIcon />}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">
              Overall Quality Level: {getSigmaLevelLabel(overallSigma)}
            </Typography>
            <Typography variant="body2">
              Current Sigma Level: {overallSigma.toFixed(2)}σ | 
              Defects per Million: {defectsPerMillion.toLocaleString()}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h3" component="div">
              {overallSigma.toFixed(1)}σ
            </Typography>
          </Box>
        </Box>
      </Alert>

      {/* Quality Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" color="text.secondary">
                    Performance Quality
                  </Typography>
                  <Typography variant="h3" component="div">
                    {dashboard?.categories?.performance?.sigma_level?.toFixed(1) || '0.0'}σ
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min((dashboard?.categories?.performance?.sigma_level || 0) / 6 * 100, 100)}
                    sx={{ mt: 1 }}
                  />
                </Box>
                <SpeedIcon sx={{ fontSize: 40, color: 'primary.main' }} />
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
                    Streaming Engine
                  </Typography>
                  <Typography variant="h3" component="div">
                    {dashboard?.categories?.streaming_engine?.sigma_level?.toFixed(1) || '0.0'}σ
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min((dashboard?.categories?.streaming_engine?.sigma_level || 0) / 6 * 100, 100)}
                    sx={{ mt: 1 }}
                  />
                </Box>
                <AssessmentIcon sx={{ fontSize: 40, color: 'success.main' }} />
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
                    Network Quality
                  </Typography>
                  <Typography variant="h3" component="div">
                    {dashboard?.categories?.network?.sigma_level?.toFixed(1) || '0.0'}σ
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min((dashboard?.categories?.network?.sigma_level || 0) / 6 * 100, 100)}
                    sx={{ mt: 1 }}
                  />
                </Box>
                <SecurityIcon sx={{ fontSize: 40, color: 'info.main' }} />
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
                    Target Achievement
                  </Typography>
                  <Typography variant="h3" component="div">
                    {((dashboard?.categories?.performance?.target_achievement || 0) * 100).toFixed(0)}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={(dashboard?.categories?.performance?.target_achievement || 0) * 100}
                    sx={{ mt: 1 }}
                  />
                </Box>
                <TrendingUpIcon sx={{ fontSize: 40, color: 'warning.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Sigma Level Trends Chart */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Six Sigma Level Trends
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dashboard?.trends || []}>
              <defs>
                <linearGradient id="sigmaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis domain={[0, 6]} />
              <RechartsTooltip 
                labelFormatter={(value) => new Date(value).toLocaleString()}
                formatter={(value: number) => [`${value.toFixed(2)}σ`, 'Sigma Level']}
              />
              <Area 
                type="monotone" 
                dataKey="sigma_level" 
                stroke="#8884d8" 
                fillOpacity={1} 
                fill="url(#sigmaGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Critical Metrics Table */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Quality Metrics ({selectedCategory === 'all' ? 'All Categories' : selectedCategory})
          </Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Metric Name</TableCell>
                  <TableCell>Current Value</TableCell>
                  <TableCell>Target Value</TableCell>
                  <TableCell>Sigma Level</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {metrics.slice(0, 50).map((metric) => (
                  <TableRow key={metric.id}>
                    <TableCell>{metric.metric_name}</TableCell>
                    <TableCell>{formatMetricValue(metric.metric_value, metric.metric_name)}</TableCell>
                    <TableCell>{metric.target_value ? formatMetricValue(metric.target_value, metric.metric_name) : 'N/A'}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${(metric.sigma_level || 0).toFixed(2)}σ`}
                        color={getSigmaLevelColor(metric.sigma_level || 0)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={metric.category} variant="outlined" size="small" />
                    </TableCell>
                    <TableCell>{new Date(metric.timestamp).toLocaleString()}</TableCell>
                    <TableCell>
                      {(metric.sigma_level || 0) >= 3.4 ? (
                        <CheckCircleIcon color="success" />
                      ) : (metric.sigma_level || 0) >= 2.0 ? (
                        <WarningIcon color="warning" />
                      ) : (
                        <ErrorIcon color="error" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {metrics.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography color="text.secondary">
                No metrics available for the selected filters
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default SixSigmaQuality;