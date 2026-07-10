import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { authAPI, extractErrorMessage } from './services/api';
import NavBar from './components/NavBar';
import AuthModal from './components/AuthModal';

// Pages
import Home from './pages/Home';
import UploadResume from './pages/UploadResume';
import MatchedJobs from './pages/MatchedJobs';
import JobDetails from './pages/JobDetails';
import Applications from './pages/Applications';
import SavedJobs from './pages/SavedJobs';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';

import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'

  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('access_token');
        
        if (token && storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error loading user:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const handleLogin = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      const { access_token, user } = response.data;
      
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      setShowAuthModal(false);
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Login failed'));
    }
  };

  const handleGoogleLogin = async (credential) => {
    try {
      const response = await authAPI.googleLogin(credential);
      const { access_token, user } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      setShowAuthModal(false);
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Google sign-in failed'));
    }
  };

  const handleForgotPassword = async (email) => {
    try {
      await authAPI.forgotPassword(email);
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Something went wrong'));
    }
  };

  const handleRegister = async (email, password, name, userType, company) => {
    try {
      const response = await authAPI.register(email, password, name, userType, company);
      const { access_token, user } = response.data;
      
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      setShowAuthModal(false);
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Registration failed'));
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    setUser(null);
  };

  const handleProfileUpdate = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const openLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-xl text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <NavBar
          user={user}
          onLogout={handleLogout}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onLoginClick={openLogin}
          onRegisterClick={() => {
            setAuthMode('register');
            setShowAuthModal(true);
          }}
        />

        {showAuthModal && (
          <AuthModal
            mode={authMode}
            onClose={() => setShowAuthModal(false)}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onGoogleLogin={handleGoogleLogin}
            onForgotPassword={handleForgotPassword}
            onSwitchMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          />
        )}

        <Routes>
          {/* Public routes -- browsing jobs doesn't require an account,
              only applying/saving/uploading a resume does */}
          <Route path="/" element={<Home user={user} onLoginClick={openLogin} />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/matched-jobs" element={<MatchedJobs user={user} onLoginClick={openLogin} />} />
          <Route path="/jobs/:jobId" element={<JobDetails user={user} onLoginClick={openLogin} />} />

          {/* Protected routes */}
          {user && (
            <>
              <Route path="/upload-resume" element={<UploadResume />} />
              <Route path="/applications" element={<Applications />} />
              <Route path="/saved-jobs" element={<SavedJobs />} />
              <Route path="/profile" element={<Profile user={user} onProfileUpdate={handleProfileUpdate} />} />
            </>
          )}

          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
