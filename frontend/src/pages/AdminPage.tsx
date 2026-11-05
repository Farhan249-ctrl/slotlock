import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { Booking } from '../api/types';
import './MyBookingsPage.css';

export const AdminPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: pendingBookings,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-bookings', 'PENDING'],
    queryFn: () => api.bookings.listByStatus('PENDING'),
  });

  // Optimistic mutation for approving/rejecting bookings
  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: number;
      status: 'APPROVED' | 'REJECTED';
    }) => api.bookings.updateStatus(id, status),

    // Optimistic Update
    onMutate: async ({ id }) => {
      setErrorMessage(null);
      await queryClient.cancelQueries({
        queryKey: ['admin-bookings', 'PENDING'],
      });

      const previousBookings = queryClient.getQueryData<Booking[]>([
        'admin-bookings',
        'PENDING',
      ]);

      // Optimistically remove the booking from the pending list
      if (previousBookings) {
        queryClient.setQueryData<Booking[]>(
          ['admin-bookings', 'PENDING'],
          previousBookings.filter((b) => b.id !== id)
        );
      }

      return { previousBookings };
    },

    // Rollback on error
    onError: (err: unknown, _variables, context) => {
      if (context?.previousBookings) {
        queryClient.setQueryData(
          ['admin-bookings', 'PENDING'],
          context.previousBookings
        );
      }
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to update booking status. Rolled back.'
      );
    },

    // Always refetch to sync server state
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-bookings', 'PENDING'],
      });
      queryClient.invalidateQueries({
        queryKey: ['bookings'],
      });
    },
  });

  const formatLocalDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleApprove = (id: number) => {
    updateStatusMutation.mutate({ id, status: 'APPROVED' });
  };

  const handleReject = (id: number) => {
    updateStatusMutation.mutate({ id, status: 'REJECTED' });
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Admin Review — Pending Bookings</h1>
        <p className="page-subtitle">
          Review and approve or reject hall reservation requests (changes update optimistically)
        </p>
      </div>

      {errorMessage && (
        <div className="banner banner-error" role="alert" aria-live="polite">
          {errorMessage}
        </div>
      )}

      {isLoading && (
        <div className="bookings-table-container" style={{ padding: 'var(--space-4)' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: '48px', marginBottom: '8px' }}
            />
          ))}
        </div>
      )}

      {isError && (
        <div className="banner banner-error" role="alert" aria-live="polite">
          <p>
            {error instanceof Error
              ? error.message
              : 'Failed to load pending bookings.'}
          </p>
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

      {!isLoading &&
        !isError &&
        pendingBookings &&
        pendingBookings.length === 0 && (
          <div className="empty-state">
            <h3>No pending bookings</h3>
            <p>All requested hall reservations have been reviewed.</p>
          </div>
        )}

      {!isLoading &&
        !isError &&
        pendingBookings &&
        pendingBookings.length > 0 && (
          <div className="bookings-table-container">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th scope="col">Hall</th>
                  <th scope="col">Requester</th>
                  <th scope="col">Title</th>
                  <th scope="col">Time Range (Local)</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingBookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.hallName}</strong>
                    </td>
                    <td>{b.userName}</td>
                    <td>{b.title}</td>
                    <td>
                      {formatLocalDateTime(b.startTime)} –{' '}
                      {formatLocalDateTime(b.endTime)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          type="button"
                          className="btn btn-success"
                          onClick={() => handleApprove(b.id)}
                          disabled={updateStatusMutation.isPending}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleReject(b.id)}
                          disabled={updateStatusMutation.isPending}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};
