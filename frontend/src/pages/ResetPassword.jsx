import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI, extractErrorMessage } from '../services/api';

const MIN_PASSWORD_LENGTH = 8;

// Landed on from the link in a forgot-password email. Public route -- works
// whether or not anyone is logged in.
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('This reset link is missing its token. Request a new one from the login screen.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not reset your password.'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Password updated</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">You can now log in with your new password.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-black dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 shadow-xl p-8 dark:bg-gray-900 dark:border-gray-700">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-6 dark:text-gray-100">
          Set a new password
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {error}
          </div>
        )}

        {!token && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-md dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-400">
            No reset token found in this link. Open this page from the link in your reset email, or request a
            new one from the login screen.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-600 focus:border-brand-600 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-gray-400">At least {MIN_PASSWORD_LENGTH} characters.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-600 focus:border-brand-600 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white py-2.5 rounded-md text-sm font-medium hover:bg-black disabled:opacity-50 transition-colors dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            {loading ? 'Please wait…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
