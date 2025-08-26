import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  TextField,
  Button,
  Chip,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Person as PersonIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Api as ApiIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Key as KeyIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  avatar?: string;
  role: string;
  createdAt: string;
  lastLogin: string;
  preferences: {
    notifications: boolean;
    darkMode: boolean;
    autoRefresh: boolean;
    language: string;
  };
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
}

interface SecurityLog {
  id: string;
  action: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  success: boolean;
}

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [apiKeyDialog, setApiKeyDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [apiKeyForm, setApiKeyForm] = useState({
    name: '',
    permissions: [] as string[]
  });

  useEffect(() => {
    fetchProfile();
    fetchApiKeys();
    fetchSecurityLogs();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/api/profile');
      setProfile(response.data);
      setFormData({
        fullName: response.data.fullName,
        email: response.data.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const response = await api.get('/api/profile/api-keys');
      setApiKeys(response.data);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  };

  const fetchSecurityLogs = async () => {
    try {
      const response = await api.get('/api/profile/security-logs');
      setSecurityLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch security logs:', error);
    }
  };

  const saveProfile = async () => {
    try {
      const updateData: any = {
        fullName: formData.fullName,
        email: formData.email
      };

      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          setSnackbar({ open: true, message: 'Passwords do not match', severity: 'error' });
          return;
        }
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      await api.put('/api/profile', updateData);
      await fetchProfile();
      setEditMode(false);
      setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
      setSnackbar({ open: true, message: 'Profile updated successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to update profile:', error);
      setSnackbar({ open: true, message: 'Failed to update profile', severity: 'error' });
    }
  };

  const updatePreference = async (key: string, value: any) => {
    try {
      await api.put('/api/profile/preferences', { [key]: value });
      if (profile) {
        setProfile({
          ...profile,
          preferences: { ...profile.preferences, [key]: value }
        });
      }
      setSnackbar({ open: true, message: 'Preference updated', severity: 'success' });
    } catch (error) {
      console.error('Failed to update preference:', error);
      setSnackbar({ open: true, message: 'Failed to update preference', severity: 'error' });
    }
  };

  const createApiKey = async () => {
    try {
      const response = await api.post('/api/profile/api-keys', apiKeyForm);
      setApiKeys([...apiKeys, response.data]);
      setApiKeyDialog(false);
      setApiKeyForm({ name: '', permissions: [] });
      setSnackbar({ open: true, message: 'API key created successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to create API key:', error);
      setSnackbar({ open: true, message: 'Failed to create API key', severity: 'error' });
    }
  };

  const deleteApiKey = async (keyId: string) => {
    if (!window.confirm('Are you sure you want to delete this API key?')) return;
    
    try {
      await api.delete(`/api/profile/api-keys/${keyId}`);
      setApiKeys(apiKeys.filter(k => k.id !== keyId));
      setSnackbar({ open: true, message: 'API key deleted successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to delete API key:', error);
      setSnackbar({ open: true, message: 'Failed to delete API key', severity: 'error' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: 'Copied to clipboard', severity: 'success' });
  };

  if (!profile) {
    return <Box>Loading...</Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Typography variant="h4" component="h1" fontWeight="bold" sx={{ mb: 3 }}>
        Profile Settings
      </Typography>

      <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Avatar
                  sx={{ width: 80, height: 80, mr: 2 }}
                  src={profile.avatar}
                >
                  {profile.fullName.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" fontWeight="bold">
                    {profile.fullName}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    @{profile.username}
                  </Typography>
                  <Chip label={profile.role} color="primary" size="small" sx={{ mt: 1 }} />
                </Box>
                <Box>
                  {editMode ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button variant="contained" startIcon={<SaveIcon />} onClick={saveProfile}>
                        Save
                      </Button>
                      <Button variant="outlined" startIcon={<CancelIcon />} onClick={() => setEditMode(false)}>
                        Cancel
                      </Button>
                    </Box>
                  ) : (
                    <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditMode(true)}>
                      Edit Profile
                    </Button>
                  )}
                </Box>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    disabled={!editMode}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!editMode}
                  />
                </Grid>
                
                {editMode && (
                  <>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Change Password (Optional)
                        </Typography>
                      </Divider>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Current Password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.currentPassword}
                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="New Password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Confirm New Password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={showPassword}
                            onChange={(e) => setShowPassword(e.target.checked)}
                          />
                        }
                        label="Show passwords"
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Account Info */}
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Account Information
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Member Since"
                    secondary={new Date(profile.createdAt).toLocaleDateString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Last Login"
                    secondary={new Date(profile.lastLogin).toLocaleString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Account Status"
                    secondary={<Chip label="Active" color="success" size="small" />}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Preferences
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="Email Notifications" />
                  <Switch
                    checked={profile.preferences.notifications}
                    onChange={(e) => updatePreference('notifications', e.target.checked)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Dark Mode" />
                  <Switch
                    checked={profile.preferences.darkMode}
                    onChange={(e) => updatePreference('darkMode', e.target.checked)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Auto Refresh" />
                  <Switch
                    checked={profile.preferences.autoRefresh}
                    onChange={(e) => updatePreference('autoRefresh', e.target.checked)}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* API Keys */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  <ApiIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  API Keys
                </Typography>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setApiKeyDialog(true)}>
                  Create API Key
                </Button>
              </Box>
              
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Key</TableCell>
                      <TableCell>Permissions</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Last Used</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {apiKeys.map((apiKey) => (
                      <TableRow key={apiKey.id}>
                        <TableCell>{apiKey.name}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {apiKey.key.substring(0, 12)}...
                            </Typography>
                            <IconButton size="small" onClick={() => copyToClipboard(apiKey.key)}>
                              <KeyIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {apiKey.permissions.map((perm) => (
                              <Chip key={perm} label={perm} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>{new Date(apiKey.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => deleteApiKey(apiKey.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {apiKeys.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No API keys created yet
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Logs */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Recent Security Activity
              </Typography>
              
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Action</TableCell>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>IP Address</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {securityLogs.slice(0, 10).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{log.ip}</TableCell>
                        <TableCell>
                          <Chip 
                            label={log.success ? 'Success' : 'Failed'} 
                            color={log.success ? 'success' : 'error'} 
                            size="small" 
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Create API Key Dialog */}
      <Dialog open={apiKeyDialog} onClose={() => setApiKeyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Key Name"
                value={apiKeyForm.name}
                onChange={(e) => setApiKeyForm({ ...apiKeyForm, name: e.target.value })}
                placeholder="My API Key"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Permissions (select one or more):
              </Typography>
              {['read', 'write', 'delete', 'admin'].map((perm) => (
                <FormControlLabel
                  key={perm}
                  control={
                    <Switch
                      checked={apiKeyForm.permissions.includes(perm)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setApiKeyForm({
                            ...apiKeyForm,
                            permissions: [...apiKeyForm.permissions, perm]
                          });
                        } else {
                          setApiKeyForm({
                            ...apiKeyForm,
                            permissions: apiKeyForm.permissions.filter(p => p !== perm)
                          });
                        }
                      }}
                    />
                  }
                  label={perm.charAt(0).toUpperCase() + perm.slice(1)}
                />
              ))}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApiKeyDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={createApiKey} 
            disabled={!apiKeyForm.name || apiKeyForm.permissions.length === 0}
          >
            Create Key
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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

export default Profile;