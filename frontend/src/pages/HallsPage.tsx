import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/endpoints';
import './HallsPage.css';

export const HallsPage: React.FC = () => {
  const {
    data: halls,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['halls'],
    queryFn: api.halls.list,
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">University Halls</h1>
        <p className="page-subtitle">Select a hall to check availability and book a slot</p>
      </div>

      {isLoading && (
        <div className="halls-grid" aria-label="Loading halls">
          {[1, 2, 3].map((i) => (
            <div key={i} className="hall-card" style={{ height: '160px' }}>
              <div className="skeleton" style={{ height: '24px', width: '60%', marginBottom: '12px' }} />
              <div className="skeleton" style={{ height: '16px', width: '40%' }} />
              <div className="skeleton" style={{ height: '36px', width: '100%', marginTop: 'auto' }} />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="banner banner-error" role="alert" aria-live="polite">
          <p>{error instanceof Error ? error.message : 'Failed to load halls.'}</p>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: 'var(--space-2)' }}
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && halls && halls.length === 0 && (
        <div className="empty-state">
          <h3>No halls available</h3>
          <p>No halls are registered in the system right now.</p>
        </div>
      )}

      {!isLoading && !isError && halls && halls.length > 0 && (
        <div className="halls-grid">
          {halls.map((hall) => (
            <div key={hall.id} className="hall-card">
              <div className="hall-card-header">
                <h2 className="hall-card-title">{hall.name}</h2>
                <p className="hall-card-capacity">Capacity: {hall.capacity} people</p>
              </div>
              <div className="hall-card-footer">
                <Link
                  to={`/halls/${hall.id}`}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  View slots
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
