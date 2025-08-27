import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  ContentCopy as CopyIcon,
  RadioButtonChecked as LiveIcon,
  RadioButtonUnchecked as OfflineIcon
} from '@mui/icons-material';
import { api } from '../services/api';

interface Stream {
  id: string;
  name: string;
  application: string;
  status: 'live' | 'offline' | 'starting' | 'stopping';
  protocol: 'RTMP' | 'SRT' | 'WebRTC' | 'LLHLS' | 'HLS' | 'MPEGTS';
  viewers: number;
  bitrate: number;
  fps: number;
  duration: string;
  created_at: string;
  updated_at: string;
  input_url: string;
  stream_key: string;
  user_id: string;
  resolution: string;
  settings: any;
  output_urls: {
    rtmp?: string;
    srt?: string;
    webrtc?: string;
    hls?: string;
    llhls?: string;
  };
}

interface OMEStream {
  name: string;
  tracks: any[];
  connections: any[];
  createdTime: string;
}

const StreamManager: React.FC = () => {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [omeStreams, setOMEStreams] = useState<OMEStream[]>([]);
  const [protocols, setProtocols] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [recordingDialogOpen, setRecordingDialogOpen] = useState(false);
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Form state for creating/editing streams
  const [formData, setFormData] = useState({
    name: '',
    application: 'app',
    protocol: 'RTMP' as Stream['protocol'],
    enableRecording: false,
    enableTranscoding: true,
    maxBitrate: 4000,
    targetFps: 30,
    resolution: '1920x1080'
  });

  // Recording form state
  const [recordingData, setRecordingData] = useState({
    filePath: '',
    format: 'mp4'
  });

  // Push form state
  const [pushData, setPushData] = useState({
    rtmpUrl: '',
    streamKey: ''
  });

  useEffect(() => {
    fetchStreams();
    fetchProtocols();
    // Setup real-time updates
    const interval = setInterval(() => {
      fetchStreams();
      fetchOMEStreams();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStreams = async () => {
    try {
      const response = await api.getStreams();
      setStreams(response);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch streams:', error);
      setSnackbar({ open: true, message: 'Failed to fetch streams', severity: 'error' });
      setLoading(false);
    }
  };

  const fetchOMEStreams = async () => {
    try {
      const response = await api.getOMEStreams();
      if (response.success && response.data?.response) {
        setOMEStreams(response.data.response);
      }
    } catch (error) {
      console.error('Failed to fetch OME streams:', error);
    }
  };

  const fetchProtocols = async () => {
    try {
      const response = await api.getOMEProtocols();
      setProtocols(response.data);
    } catch (error) {
      console.error('Failed to fetch protocols:', error);
    }
  };

  const createStream = async () => {
    try {
      const response = await api.createStream(formData);
      setStreams([...streams, response]);
      setCreateDialogOpen(false);
      resetFormData();
      setSnackbar({ open: true, message: 'Stream created successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to create stream:', error);
      setSnackbar({ open: true, message: 'Failed to create stream', severity: 'error' });
    }
  };

  const resetFormData = () => {
    setFormData({
      name: '',
      application: 'app',
      protocol: 'RTMP',
      enableRecording: false,
      enableTranscoding: true,
      maxBitrate: 4000,
      targetFps: 30,
      resolution: '1920x1080'
    });
  };
    }
  };

  const startStream = async (streamId: string) => {
    try {
      await api.startStream(streamId);
      await fetchStreams();
      setSnackbar({ open: true, message: 'Stream started successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to start stream:', error);
      setSnackbar({ open: true, message: 'Failed to start stream', severity: 'error' });
    }
  };

  const stopStream = async (streamId: string) => {
    try {
      await api.stopStream(streamId);
      await fetchStreams();
      setSnackbar({ open: true, message: 'Stream stopped successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to stop stream:', error);
      setSnackbar({ open: true, message: 'Failed to stop stream', severity: 'error' });
    }
  };

  const deleteStream = async (streamId: string) => {
    if (!window.confirm('Are you sure you want to delete this stream?')) return;
    
    try {
      await api.deleteStream(streamId);
      setStreams(streams.filter(s => s.id !== streamId));
      setSnackbar({ open: true, message: 'Stream deleted successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to delete stream:', error);
      setSnackbar({ open: true, message: 'Failed to delete stream', severity: 'error' });
    }
  };

  const startRecording = async () => {
    if (!selectedStream) return;

    try {
      const filePath = recordingData.filePath || `/recordings/${selectedStream.stream_key}_${Date.now()}.${recordingData.format}`;
      await api.startOMERecording('default', selectedStream.application, selectedStream.stream_key, {
        filePath,
        info: { format: recordingData.format }
      });
      setRecordingDialogOpen(false);
      setSnackbar({ open: true, message: 'Recording started successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to start recording:', error);
      setSnackbar({ open: true, message: 'Failed to start recording', severity: 'error' });
    }
  };

  const startPush = async () => {
    if (!selectedStream || !pushData.rtmpUrl || !pushData.streamKey) return;

    try {
      await api.startOMEPush('default', selectedStream.application, selectedStream.stream_key, pushData.rtmpUrl, pushData.streamKey);
      setPushDialogOpen(false);
      setSnackbar({ open: true, message: 'Push started successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to start push:', error);
      setSnackbar({ open: true, message: 'Failed to start push', severity: 'error' });
    }
  };

  const getStreamEndpoints = (stream: Stream) => {
    if (!protocols || !protocols.protocols) return {};
    
    const baseEndpoints: any = {};
    Object.entries(protocols.protocols).forEach(([key, protocol]: [string, any]) => {
      if (protocol.endpoint) {
        baseEndpoints[key] = protocol.endpoint.replace('{stream_key}', stream.stream_key);
      } else if (protocol.input_endpoint || protocol.output_endpoint) {
        if (protocol.input_endpoint) {
          baseEndpoints[`${key}_input`] = protocol.input_endpoint.replace('{stream_key}', stream.stream_key);
        }
        if (protocol.output_endpoint) {
          baseEndpoints[`${key}_output`] = protocol.output_endpoint.replace('{stream_key}', stream.stream_key);
        }
      }
    });
    return baseEndpoints;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: 'Copied to clipboard', severity: 'success' });
  };

  const getStatusColor = (status: Stream['status']) => {
    switch (status) {
      case 'live': return 'success';
      case 'offline': return 'default';
      case 'starting': return 'warning';
      case 'stopping': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: Stream['status']) => {
    switch (status) {
      case 'live': return <LiveIcon color="success" />;
      case 'offline': return <OfflineIcon color="disabled" />;
      case 'starting': case 'stopping': return <CircularProgress size={20} />;
      default: return <OfflineIcon color="disabled" />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Stream Manager
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          size="large"
        >
          Create Stream
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Total Streams
              </Typography>
              <Typography variant="h3" component="div">
                {streams.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Live Streams
              </Typography>
              <Typography variant="h3" component="div" color="success.main">
                {streams.filter(s => s.status === 'live').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Total Viewers
              </Typography>
              <Typography variant="h3" component="div">
                {streams.reduce((acc, s) => acc + s.viewers, 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Avg Bitrate
              </Typography>
              <Typography variant="h3" component="div">
                {streams.length > 0 ? Math.round(streams.reduce((acc, s) => acc + s.bitrate, 0) / streams.length) : 0}
                <Typography variant="caption"> kbps</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Streams Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Active Streams
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : streams.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No streams created yet. Click "Create Stream" to get started.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Stream</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Protocol</TableCell>
                    <TableCell>Viewers</TableCell>
                    <TableCell>Bitrate</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {streams.map((stream) => (
                    <TableRow key={stream.id}>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {stream.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {stream.application}/{stream.id}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(stream.status)}
                          label={stream.status.toUpperCase()}
                          color={getStatusColor(stream.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label={stream.protocol} variant="outlined" size="small" />
                      </TableCell>
                      <TableCell>{stream.viewers.toLocaleString()}</TableCell>
                      <TableCell>{stream.bitrate} kbps</TableCell>
                      <TableCell>{stream.duration}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {stream.status === 'offline' ? (
                            <Tooltip title="Start Stream">
                              <IconButton 
                                size="small" 
                                color="success"
                                onClick={() => startStream(stream.id)}
                              >
                                <PlayIcon />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Stop Stream">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={() => stopStream(stream.id)}
                              >
                                <StopIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="View Details">
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => {
                                // Navigate to stream details page
                                console.log('View stream details:', stream.id);
                              }}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Copy Stream URL">
                            <IconButton 
                              size="small"
                              onClick={() => copyToClipboard(stream.input_url)}
                            >
                              <CopyIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Stream">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => deleteStream(stream.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Stream Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Stream</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Stream Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Live Stream"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Application"
                value={formData.application}
                onChange={(e) => setFormData({ ...formData, application: e.target.value })}
                placeholder="app"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Protocol</InputLabel>
                <Select
                  value={formData.protocol}
                  label="Protocol"
                  onChange={(e) => setFormData({ ...formData, protocol: e.target.value as Stream['protocol'] })}
                >
                  <MenuItem value="RTMP">RTMP</MenuItem>
                  <MenuItem value="SRT">SRT</MenuItem>
                  <MenuItem value="WebRTC">WebRTC</MenuItem>
                  <MenuItem value="LLHLS">LLHLS</MenuItem>
                  <MenuItem value="HLS">HLS</MenuItem>
                  <MenuItem value="MPEGTS">MPEGTS</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Bitrate (kbps)"
                type="number"
                value={formData.maxBitrate}
                onChange={(e) => setFormData({ ...formData, maxBitrate: parseInt(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Target FPS"
                type="number"
                value={formData.targetFps}
                onChange={(e) => setFormData({ ...formData, targetFps: parseInt(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enableRecording}
                    onChange={(e) => setFormData({ ...formData, enableRecording: e.target.checked })}
                  />
                }
                label="Enable Recording"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enableTranscoding}
                    onChange={(e) => setFormData({ ...formData, enableTranscoding: e.target.checked })}
                  />
                }
                label="Enable Transcoding"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createStream} disabled={!formData.name}>
            Create Stream
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StreamManager;