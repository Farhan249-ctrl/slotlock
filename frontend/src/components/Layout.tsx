import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import './Layout.css';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-container">
      <header className="top-nav" role="banner">
        <div className="top-nav-inner">
          <div className="brand-section">
            <NavLink to="/halls" className="brand-logo" aria-label="SlotLock Home">
              <svg
                className="brand-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z" />
              </svg>
              <span>SlotLock</span>
            </NavLink>

            {user && (
              <nav className="nav-links" aria-label="Primary Navigation">
                <NavLink
                  to="/halls"
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  Halls
                </NavLink>
                <NavLink
                  to="/my-bookings"
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  My Bookings
                </NavLink>
                {user.role === 'ADMIN' && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      `nav-link ${isActive ? 'active' : ''}`
                    }
                  >
                    Admin Review
                  </NavLink>
                )}
              </nav>
            )}
          </div>

          {user && (
            <div className="user-section">
              <div className="user-info">
                <span className="user-name">{user.name}</span>
                <span
                  className={`badge ${
                    user.role === 'ADMIN' ? 'badge-role' : 'badge-cancelled'
                  }`}
                >
                  {user.role}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary"
                aria-label="Log out of SlotLock"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main-content" role="main">
        <Outlet />
      </main>
    </div>
  );
};
