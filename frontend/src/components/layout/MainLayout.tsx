import React, { useState, ReactNode } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Avatar,
  Badge,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  alpha,
  Tooltip,
  Stack,
  useMediaQuery,
  Fab,
  Zoom,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  VideoLibrary as VideoLibraryIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  Search as SearchIcon,
  LiveTv as LiveTvIcon,
  Cloud as CloudIcon,
  Security as SecurityIcon,
  Help as HelpIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 80;

interface MainLayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  id: string;
  title: string;
  icon: React.ElementType;
  path: string;
  badge?: number;
  children?: NavigationItem[];
}

const navigation: NavigationItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: DashboardIcon,
    path: '/dashboard',
  },
  {
    id: 'streams',
    title: 'Stream Manager',
    icon: LiveTvIcon,
    path: '/streams',
    badge: 3,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: AnalyticsIcon,
    path: '/analytics',
  },
  {
    id: 'media',
    title: 'Media Library',
    icon: VideoLibraryIcon,
    path: '/media',
  },
  {
    id: 'cloud',
    title: 'Cloud Storage',
    icon: CloudIcon,
    path: '/storage',
  },
  {
    id: 'security',
    title: 'Security',
    icon: SecurityIcon,
    path: '/security',
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: SettingsIcon,
    path: '/settings',
  },
];

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState<null | HTMLElement>(null);

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setDrawerCollapsed(!drawerCollapsed);
    }
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleNotificationsOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationsAnchor(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setNotificationsAnchor(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    handleUserMenuClose();
  };

  const isActiveRoute = (path: string): boolean => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const drawerWidth = isMobile ? DRAWER_WIDTH : (drawerCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo Section */}
      <Box
        sx={{
          p: 3,
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar
            sx={{
              bgcolor: theme.palette.primary.main,
              width: 40,
              height: 40,
            }}
          >
            <LiveTvIcon />
          </Avatar>
          {!drawerCollapsed && (
            <Box>
              <Typography variant="h6" fontWeight="bold" color="primary">
                Cruvz SRT
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Streaming Platform
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 2 }}>
        <List sx={{ px: 2, '& .MuiListItem-root': { mb: 0.5 } }}>
          {navigation.map((item) => (
            <ListItem key={item.id} disablePadding>
              <Tooltip title={drawerCollapsed ? item.title : ''} placement="right">
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    minHeight: 48,
                    backgroundColor: isActiveRoute(item.path)
                      ? alpha(theme.palette.primary.main, 0.1)
                      : 'transparent',
                    color: isActiveRoute(item.path)
                      ? theme.palette.primary.main
                      : theme.palette.text.primary,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: 'inherit',
                      minWidth: drawerCollapsed ? 0 : 40,
                      justifyContent: 'center',
                    }}
                  >
                    <Badge badgeContent={item.badge} color="error">
                      <item.icon />
                    </Badge>
                  </ListItemIcon>
                  {!drawerCollapsed && (
                    <ListItemText
                      primary={item.title}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: isActiveRoute(item.path) ? 600 : 400,
                      }}
                    />
                  )}
                  {!drawerCollapsed && item.badge && (
                    <Badge badgeContent={item.badge} color="error" />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* User Profile Section */}
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${theme.palette.divider}`,
          background: alpha(theme.palette.grey[50], 0.5),
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar
            sx={{
              bgcolor: theme.palette.secondary.main,
              width: 40,
              height: 40,
            }}
          >
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </Avatar>
          {!drawerCollapsed && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>
                {user?.first_name} {user?.last_name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user?.email}
              </Typography>
            </Box>
          )}
          {!drawerCollapsed && (
            <IconButton size="small" onClick={handleUserMenuOpen}>
              <MoreVertIcon />
            </IconButton>
          )}
        </Stack>
      </Box>

      {/* Collapse Button */}
      {!isMobile && (
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <IconButton
            onClick={handleDrawerToggle}
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.2),
              },
            }}
          >
            {drawerCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
        elevation={0}
      >
        <Toolbar sx={{ minHeight: '64px !important' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { lg: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Search Bar */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              maxWidth: 400,
              bgcolor: alpha(theme.palette.grey[100], 0.8),
              borderRadius: 2,
              px: 2,
              py: 1,
              mr: 2,
            }}
          >
            <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Search streams, analytics, settings...
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Right Side Actions */}
          <Stack direction="row" alignItems="center" spacing={1}>
            {/* Notifications */}
            <IconButton color="inherit" onClick={handleNotificationsOpen}>
              <Badge badgeContent={4} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>

            {/* Help */}
            <IconButton color="inherit">
              <HelpIcon />
            </IconButton>

            {/* User Avatar */}
            <IconButton onClick={handleUserMenuOpen}>
              <Avatar
                sx={{
                  bgcolor: theme.palette.primary.main,
                  width: 32,
                  height: 32,
                }}
              >
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </Avatar>
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box
        component="nav"
        sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}
      >
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: DRAWER_WIDTH,
              },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
                transition: theme.transitions.create('width', {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          overflow: 'auto',
        }}
      >
        <Toolbar />
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      </Box>

      {/* Floating Action Button for Quick Stream Creation */}
      <Zoom in={true}>
        <Fab
          color="primary"
          aria-label="create stream"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          }}
          onClick={() => navigate('/streams/create')}
        >
          <AddIcon />
        </Fab>
      </Zoom>

      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleUserMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { navigate('/profile'); handleUserMenuClose(); }}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => { navigate('/settings'); handleUserMenuClose(); }}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Notifications Menu */}
      <Menu
        anchorEl={notificationsAnchor}
        open={Boolean(notificationsAnchor)}
        onClose={handleNotificationsClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { width: 320, maxHeight: 400 },
        }}
      >
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="h6">Notifications</Typography>
        </Box>
        <MenuItem>
          <Stack spacing={1}>
            <Typography variant="subtitle2">New stream started</Typography>
            <Typography variant="caption" color="text.secondary">
              Stream "Live Demo" is now broadcasting
            </Typography>
          </Stack>
        </MenuItem>
        <MenuItem>
          <Stack spacing={1}>
            <Typography variant="subtitle2">Analytics update</Typography>
            <Typography variant="caption" color="text.secondary">
              Weekly report is ready for review
            </Typography>
          </Stack>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleNotificationsClose}>
          <Typography variant="body2" color="primary" textAlign="center" width="100%">
            View all notifications
          </Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default MainLayout;