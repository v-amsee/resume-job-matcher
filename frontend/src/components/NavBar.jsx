import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function NavLink({ to, active, children }) {
  return (
    <Link
      to={to}
      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-brand-600 text-gray-900 dark:text-gray-100'
          : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:border-gray-700'
      }`}
    >
      {children}
    </Link>
  );
}

function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-2 rounded-md text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors"
    >
      {isDark ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5m0 15V21m8.25-9H21m-18 0H4.5m14.24 6.24-1.06-1.06M6.82 6.82 5.76 5.76m12.48 0-1.06 1.06M6.82 17.18l-1.06 1.06M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      )}
    </button>
  );
}

export default function NavBar({ user, onLogout, onLoginClick, onRegisterClick, isDark, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight text-gray-900 dark:text-gray-100">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand-600 text-white text-sm font-bold">
                R
              </span>
              ResumeMatch
            </Link>
          </div>

          {/* Menu */}
          <div className="flex items-center space-x-2">
            {user ? (
              <>
                <div className="hidden md:flex space-x-1">
                  <NavLink to="/matched-jobs" active={location.pathname === '/matched-jobs'}>
                    Find Jobs
                  </NavLink>
                  <NavLink to="/applications" active={location.pathname === '/applications'}>
                    Applications
                  </NavLink>
                  <NavLink to="/saved-jobs" active={location.pathname === '/saved-jobs'}>
                    Saved
                  </NavLink>
                </div>

                <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />

                {/* User Menu */}
                <div className="relative group ml-2">
                  <button className="flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 font-medium text-sm dark:text-gray-300 dark:hover:bg-gray-800">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-semibold dark:bg-gray-800 dark:text-gray-300">
                      {user.name?.[0]?.toUpperCase() || '?'}
                    </span>
                    {user.name}
                  </button>
                  <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg border border-gray-200 shadow-lg hidden group-hover:block z-10 dark:bg-gray-900 dark:border-gray-700">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <p className="text-sm font-medium text-gray-900 truncate dark:text-gray-100">{user.email}</p>
                      <p className="text-xs text-gray-500 capitalize mt-0.5 dark:text-gray-400">{user.user_type.replace('_', ' ')}</p>
                    </div>
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
                <button
                  onClick={onLoginClick}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                >
                  Log in
                </button>
                <button
                  onClick={onRegisterClick}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white bg-gray-900 hover:bg-black transition-colors dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  Sign up
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-gray-500 dark:text-gray-400"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && user && (
          <div className="md:hidden pb-4 border-t border-gray-100 pt-2 dark:border-gray-800">
            <Link to="/matched-jobs" className="block px-3 py-2 text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">
              Find Jobs
            </Link>
            <Link to="/applications" className="block px-3 py-2 text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">
              Applications
            </Link>
            <Link to="/saved-jobs" className="block px-3 py-2 text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">
              Saved
            </Link>
            <button
              onClick={onToggleTheme}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            >
              {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
