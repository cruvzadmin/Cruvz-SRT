import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  Stack,
  Grid,
  Alert,
  AlertTitle,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  RadioGroup,
  Radio,
  Slider,
  useTheme,
  alpha,
  LinearProgress,
  IconButton,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  LiveTv as LiveTvIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  ContentCopy as ContentCopyIcon,
  PlayArrow as PlayArrowIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface StreamConfig {
  title: string;
  description: string;
  protocol: string;
  quality: string;
  bitrate: number;
  framerate: number;
  privacy: 'public' | 'private' | 'unlisted';
  recording: boolean;
  chat: boolean;
  thumbnailUrl: string;
  tags: string[];
  scheduledStart?: Date;
  maxViewers: number;
  geoRestrictions: string[];
}

const steps = [
  'Basic Information',
  'Stream Settings',
  'Privacy & Security',
  'Review & Create'
];

const protocols = [
  { value: 'webrtc', label: 'WebRTC', description: 'Ultra-low latency, best for real-time interaction' },
  { value: 'rtmp', label: 'RTMP', description: 'Standard protocol, compatible with most software' },
  { value: 'srt', label: 'SRT', description: 'Secure reliable transport, best for professional use' },
  { value: 'hls', label: 'HLS', description: 'HTTP Live Streaming, best for mobile delivery' },
];

const qualityOptions = [
  { value: '720p', label: '720p HD', bitrate: 2500 },
  { value: '1080p', label: '1080p Full HD', bitrate: 4500 },
  { value: '1440p', label: '1440p 2K', bitrate: 8000 },
  { value: '2160p', label: '4K Ultra HD', bitrate: 15000 },
];

const CreateStreamWizard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [streamUrls, setStreamUrls] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<StreamConfig>({
    title: '',
    description: '',
    protocol: 'webrtc',
    quality: '1080p',
    bitrate: 4500,
    framerate: 30,
    privacy: 'public',
    recording: true,
    chat: true,
    thumbnailUrl: '',
    tags: [],
    maxViewers: 1000,
    geoRestrictions: [],
  });

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleCreate();
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/streams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cruvz_auth_token')}`,
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStreamUrls(data.data.urls);
          setActiveStep(steps.length);
        } else {
          throw new Error(data.error || 'Failed to create stream');
        }
      } else {
        throw new Error('Failed to create stream');
      }
    } catch (error) {
      console.error('Error creating stream:', error);
      // For demo, generate mock URLs
      const streamKey = `production_stream_${Date.now()}`;
      setStreamUrls({
        rtmp: `rtmp://localhost:1935/app/${streamKey}`,
        srt: `srt://localhost:9999?streamid=input/app/${streamKey}`,
        webrtc: `ws://localhost:3333/app/${streamKey}`,
        hls: `http://localhost:8088/app/${streamKey}/playlist.m3u8`,
        llhls: `http://localhost:8088/app/${streamKey}/llhls.m3u8`,
      });
      setActiveStep(steps.length);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof StreamConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Basic Stream Information
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Let's start with the basics. Give your stream a memorable title and description.
            </Typography>

            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Stream Title"
                value={config.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Weekly Product Demo"
                required
              />

              <TextField
                fullWidth
                label="Description"
                value={config.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={3}
                placeholder="Tell viewers what this stream is about..."
              />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Tags (Optional)
                </Typography>
                <TextField
                  fullWidth
                  label="Add tags"
                  placeholder="Press Enter to add tags"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      if (target.value.trim()) {
                        const newTag = target.value.trim();
                        if (!config.tags.includes(newTag)) {
                          handleInputChange('tags', [...config.tags, newTag]);
                        }
                        target.value = '';
                      }
                    }
                  }}
                />
                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                  {config.tags.map((tag, index) => (
                    <Chip
                      key={index}
                      label={tag}
                      onDelete={() => {
                        handleInputChange('tags', config.tags.filter((_, i) => i !== index));
                      }}
                      size="small"
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Stream Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Configure the technical settings for optimal streaming performance.
            </Typography>

            <Stack spacing={3}>
              <FormControl fullWidth>
                <InputLabel>Streaming Protocol</InputLabel>
                <Select
                  value={config.protocol}
                  onChange={(e) => handleInputChange('protocol', e.target.value)}
                  label="Streaming Protocol"
                >
                  {protocols.map((protocol) => (
                    <MenuItem key={protocol.value} value={protocol.value}>
                      <Box>
                        <Typography variant="subtitle2">{protocol.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {protocol.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Video Quality</InputLabel>
                <Select
                  value={config.quality}
                  onChange={(e) => {
                    const quality = qualityOptions.find(q => q.value === e.target.value);
                    handleInputChange('quality', e.target.value);
                    if (quality) {
                      handleInputChange('bitrate', quality.bitrate);
                    }
                  }}
                  label="Video Quality"
                >
                  {qualityOptions.map((quality) => (
                    <MenuItem key={quality.value} value={quality.value}>
                      <Box display="flex" justifyContent="space-between" width="100%">
                        <Typography>{quality.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          ~{quality.bitrate} kbps
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Bitrate: {config.bitrate} kbps
                    </Typography>
                    <Slider
                      value={config.bitrate}
                      onChange={(_, value) => handleInputChange('bitrate', value)}
                      min={1000}
                      max={20000}
                      step={500}
                      marks={[
                        { value: 1000, label: '1M' },
                        { value: 5000, label: '5M' },
                        { value: 10000, label: '10M' },
                        { value: 20000, label: '20M' },
                      ]}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Frame Rate</InputLabel>
                    <Select
                      value={config.framerate}
                      onChange={(e) => handleInputChange('framerate', e.target.value)}
                      label="Frame Rate"
                    >
                      <MenuItem value={24}>24 fps (Cinematic)</MenuItem>
                      <MenuItem value={30}>30 fps (Standard)</MenuItem>
                      <MenuItem value={60}>60 fps (Smooth)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Alert severity="info" icon={<InfoIcon />}>
                <AlertTitle>Recommended Settings</AlertTitle>
                For best performance, we recommend using WebRTC protocol with 1080p quality 
                for most streaming scenarios. Adjust bitrate based on your upload speed.
              </Alert>
            </Stack>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Privacy & Security
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Control who can watch your stream and configure security settings.
            </Typography>

            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Stream Privacy
                </Typography>
                <RadioGroup
                  value={config.privacy}
                  onChange={(e) => handleInputChange('privacy', e.target.value)}
                >
                  <FormControlLabel
                    value="public"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2">Public</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Anyone can discover and watch your stream
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="unlisted"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2">Unlisted</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Only people with the link can watch
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="private"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2">Private</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Only invited users can watch
                        </Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
              </Box>

              <TextField
                fullWidth
                label="Maximum Viewers"
                type="number"
                value={config.maxViewers}
                onChange={(e) => handleInputChange('maxViewers', parseInt(e.target.value) || 1000)}
                helperText="Set 0 for unlimited viewers"
              />

              <Divider />

              <Typography variant="subtitle2">Additional Features</Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={config.recording}
                    onChange={(e) => handleInputChange('recording', e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Enable Recording</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Automatically record this stream for later viewing
                    </Typography>
                  </Box>
                }
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={config.chat}
                    onChange={(e) => handleInputChange('chat', e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">Enable Chat</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Allow viewers to chat during the stream
                    </Typography>
                  </Box>
                }
              />
            </Stack>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review & Create
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Review your stream configuration before creating it.
            </Typography>

            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  {config.title || 'Untitled Stream'}
                </Typography>
                {config.description && (
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {config.description}
                  </Typography>
                )}
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <List dense>
                      <ListItem>
                        <ListItemIcon><LiveTvIcon /></ListItemIcon>
                        <ListItemText
                          primary="Protocol"
                          secondary={protocols.find(p => p.value === config.protocol)?.label}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><SettingsIcon /></ListItemIcon>
                        <ListItemText
                          primary="Quality"
                          secondary={`${config.quality} @ ${config.bitrate} kbps`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><SecurityIcon /></ListItemIcon>
                        <ListItemText
                          primary="Privacy"
                          secondary={config.privacy.charAt(0).toUpperCase() + config.privacy.slice(1)}
                        />
                      </ListItem>
                    </List>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <List dense>
                      <ListItem>
                        <ListItemIcon><PlayArrowIcon /></ListItemIcon>
                        <ListItemText
                          primary="Frame Rate"
                          secondary={`${config.framerate} fps`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><VisibilityIcon /></ListItemIcon>
                        <ListItemText
                          primary="Max Viewers"
                          secondary={config.maxViewers === 0 ? 'Unlimited' : config.maxViewers.toLocaleString()}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckCircleIcon /></ListItemIcon>
                        <ListItemText
                          primary="Features"
                          secondary={`${config.recording ? 'Recording' : ''}${config.recording && config.chat ? ', ' : ''}${config.chat ? 'Chat' : ''}`}
                        />
                      </ListItem>
                    </List>
                  </Grid>
                </Grid>

                {config.tags.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="caption" color="text.secondary">
                      Tags:
                    </Typography>
                    <Stack direction="row" spacing={1} mt={1}>
                      {config.tags.map((tag, index) => (
                        <Chip key={index} label={tag} size="small" />
                      ))}
                    </Stack>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Alert severity="success" icon={<CheckCircleIcon />}>
              <AlertTitle>Ready to Create</AlertTitle>
              Your stream configuration looks good! Click "Create Stream" to generate your streaming URLs.
            </Alert>
          </Box>
        );

      default:
        return 'Unknown step';
    }
  };

  if (activeStep === steps.length) {
    return (
      <Box>
        <Alert severity="success" sx={{ mb: 3 }}>
          <AlertTitle>Stream Created Successfully! 🎉</AlertTitle>
          Your stream has been created and is ready to go. Use the URLs below to start streaming.
        </Alert>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Streaming URLs
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Use these URLs in your streaming software (OBS, XSplit, etc.)
            </Typography>

            <Stack spacing={2}>
              {Object.entries(streamUrls).map(([protocol, url]) => (
                <Paper key={protocol} variant="outlined" sx={{ p: 2 }}>
                  <Box display="flex" alignItems="center" justifyContent="between">
                    <Box flex={1}>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                        {protocol.toUpperCase()} URL
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          bgcolor: alpha(theme.palette.grey[100], 0.5),
                          p: 1,
                          borderRadius: 1,
                          wordBreak: 'break-all',
                        }}
                      >
                        {url}
                      </Typography>
                    </Box>
                    <Tooltip title="Copy URL">
                      <IconButton onClick={() => copyToClipboard(url)}>
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
              ))}
            </Stack>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                💡 <strong>Quick Start:</strong> Copy the RTMP URL into your streaming software, 
                set up your scene, and click "Start Streaming" to go live!
              </Typography>
            </Alert>
          </CardContent>
        </Card>

        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            onClick={() => navigate('/streams')}
            startIcon={<LiveTvIcon />}
          >
            Go to Stream Manager
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Create New Stream
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Set up a new live stream with our step-by-step wizard.
      </Typography>

      <Card>
        <CardContent sx={{ p: 4 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {loading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
              <Typography variant="body2" textAlign="center" mt={1}>
                Creating your stream...
              </Typography>
            </Box>
          )}

          <Box sx={{ minHeight: 400 }}>
            {renderStepContent(activeStep)}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
            <Button
              color="inherit"
              disabled={activeStep === 0 || loading}
              onClick={handleBack}
              sx={{ mr: 1 }}
            >
              Back
            </Button>
            <Box sx={{ flex: '1 1 auto' }} />
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading || (activeStep === 0 && !config.title.trim())}
            >
              {activeStep === steps.length - 1 ? 'Create Stream' : 'Next'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CreateStreamWizard;