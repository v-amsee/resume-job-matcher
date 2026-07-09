import { useState, useEffect, useRef } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function AuthModal({ mode, onClose, onLogin, onRegister, onGoogleLogin, onForgotPassword, onSwitchMode }) {
  // no more "I am a..." selector -- this is job-seeker only now, always registers as one
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const googleButtonRef = useRef(null);

  // 'form' = normal login/register, 'forgot' = email request form, 'forgot-sent' = confirmation
  const [view, setView] = useState('form');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // loads Google's Identity Services script once and renders their button
  // into googleButtonRef -- no-op if VITE_GOOGLE_CLIENT_ID isn't set
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !onGoogleLogin) return;

    const renderButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          onGoogleLogin(response.credential).catch((err) => setError(err.message));
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 336,
        text: mode === 'login' ? 'signin_with' : 'signup_with',
      });
    };

    const existing = document.getElementById('google-identity-script');
    if (existing) {
      renderButton();
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-identity-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.body.appendChild(script);
  }, [mode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // Client-side checks so obviously-wrong input never has to make a round
  // trip to the server just to bounce back as a 422. The backend still
  // validates independently (EmailStr, password hashing) -- this is purely
  // about faster, friendlier feedback.
  const validate = () => {
    const errors = {};

    if (!EMAIL_RE.test(formData.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }

    if (mode === 'register' && formData.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    } else if (!formData.password) {
      errors.password = 'Enter your password.';
    }

    if (mode === 'register' && !formData.name.trim()) {
      errors.name = 'Enter your full name.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(formData.email.trim(), formData.password);
      } else {
        await onRegister(formData.email.trim(), formData.password, formData.name.trim(), 'job_seeker', '');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');

    if (!EMAIL_RE.test(forgotEmail.trim())) {
      setForgotError('Enter a valid email address.');
      return;
    }

    setForgotLoading(true);
    try {
      await onForgotPassword(forgotEmail.trim());
      setView('forgot-sent');
    } catch (err) {
      // backend always returns 200 here, so an error is a real problem (network etc), safe to show
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const inputClass = (field) =>
    `w-full px-3 py-2 border rounded-md text-sm focus:ring-1 focus:border-brand-600 dark:bg-gray-800 dark:text-gray-100 ${
      fieldErrors[field]
        ? 'border-red-300 focus:ring-red-400 dark:border-red-500'
        : 'border-gray-300 focus:ring-brand-600 dark:border-gray-700'
    }`;

  return (
    <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-8 max-w-md w-full dark:bg-gray-900 dark:border-gray-700">
        <div className="flex items-start justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight dark:text-gray-100">
            {view === 'forgot' && 'Reset your password'}
            {view === 'forgot-sent' && 'Check your email'}
            {view === 'form' && (mode === 'login' ? 'Log in' : 'Create your account')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1 p-1 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {view === 'forgot-sent' && (
          <div>
            <p className="text-sm text-gray-600 mb-6 dark:text-gray-400">
              If <span className="font-medium text-gray-900 dark:text-gray-100">{forgotEmail.trim()}</span> has an
              account, a password reset link is on its way. It expires in 1 hour.
            </p>
            <button
              onClick={() => setView('form')}
              className="w-full bg-gray-900 text-white py-2.5 rounded-md text-sm font-medium hover:bg-black transition-colors dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              Back to login
            </button>
          </div>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgotSubmit} noValidate className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your account email and we'll send you a link to set a new password.
            </p>

            {forgotError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
                {forgotError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Email</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-600 focus:border-brand-600 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={forgotLoading}
              className="w-full bg-gray-900 text-white py-2.5 rounded-md text-sm font-medium hover:bg-black disabled:opacity-50 transition-colors dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {forgotLoading ? 'Sending…' : 'Send reset link'}
            </button>

            <button
              type="button"
              onClick={() => setView('form')}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Back to login
            </button>
          </form>
        )}

        {view === 'form' && (
          <>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
                {error}
              </div>
            )}

            {GOOGLE_CLIENT_ID && onGoogleLogin && (
              <>
                <div ref={googleButtonRef} className="flex justify-center mb-4" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
                  <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Full name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={inputClass('name')}
                placeholder="Jane Doe"
              />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={inputClass('email')}
              placeholder="you@example.com"
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`${inputClass('password')} pr-16`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.password ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
            ) : mode === 'register' ? (
              <p className="mt-1 text-xs text-gray-400">At least {MIN_PASSWORD_LENGTH} characters.</p>
            ) : onForgotPassword ? (
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(formData.email);
                  setForgotError('');
                  setView('forgot');
                }}
                className="mt-1 text-xs text-gray-500 hover:text-gray-800 hover:underline dark:text-gray-400 dark:hover:text-gray-200"
              >
                Forgot password?
              </button>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white py-2.5 rounded-md text-sm font-medium hover:bg-black disabled:opacity-50 transition-colors dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6 dark:text-gray-400">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={onSwitchMode}
                className="text-gray-900 font-medium hover:underline dark:text-gray-100"
              >
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
