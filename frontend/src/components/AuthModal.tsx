import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Link,
  Stack,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'login' | 'register';
  onModeChange: (mode: 'login' | 'register') => void;
}

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, mode, onModeChange }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { login, register, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      return false;
    }

    if (mode === 'register') {
      if (!formData.first_name || !formData.last_name) {
        setError('First name and last name are required');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!validateForm()) return;

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
      } else {
        await register({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          password: formData.password,
        });
      }
      
      // Success - close modal and redirect
      onClose();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || `${mode === 'login' ? 'Login' : 'Registration'} failed`);
    }
  };

  const handleModeSwitch = () => {
    setError(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
    onModeChange(mode === 'login' ? 'register' : 'login');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Header */}
        <Box
          sx={{
            p: 3,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            color: 'white',
            position: 'relative',
          }}
        >
          <IconButton
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: 'white',
            }}
          >
            <CloseIcon />
          </IconButton>
          
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {mode === 'login' ? 'Welcome Back' : 'Get Started'}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            {mode === 'login'
              ? 'Sign in to access your streaming dashboard'
              : 'Create your account to start streaming'}
          </Typography>
        </Box>

        {/* Form */}
        <Box sx={{ p: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={3}>
              {mode === 'register' && (
                <Stack direction="row" spacing={2}>
                  <TextField
                    fullWidth
                    label="First Name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                    variant="outlined"
                  />
                  <TextField
                    fullWidth
                    label="Last Name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                    variant="outlined"
                  />
                </Stack>
              )}

              <TextField
                fullWidth
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                variant="outlined"
                autoComplete="email"
              />

              <TextField
                fullWidth
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleInputChange}
                required
                variant="outlined"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={togglePasswordVisibility}
                      edge="end"
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  ),
                }}
              />

              {mode === 'register' && (
                <TextField
                  fullWidth
                  label="Confirm Password"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  variant="outlined"
                  autoComplete="new-password"
                />
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  mt: 2,
                }}
              >
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : mode === 'login' ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </Button>
            </Stack>
          </form>

          {/* Mode Switch */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Divider sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                OR
              </Typography>
            </Divider>
            
            <Typography variant="body2" color="text.secondary">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              {' '}
              <Link
                component="button"
                variant="body2"
                onClick={handleModeSwitch}
                sx={{
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: theme.palette.primary.main,
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                {mode === 'login' ? 'Sign up here' : 'Sign in here'}
              </Link>
            </Typography>
          </Box>

          {/* Terms and Privacy (for register mode) */}
          {mode === 'register' && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 3, display: 'block', textAlign: 'center' }}
            >
              By creating an account, you agree to our{' '}
              <Link href="#" color="primary">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="#" color="primary">
                Privacy Policy
              </Link>
            </Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;