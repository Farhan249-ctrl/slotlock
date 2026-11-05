import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { Booking, BookingStatus } from '../api/types';
import './MyBookingsPage.css';

export const MyBookingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: bookings,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: api.bookings.listMine,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.bookings.cancel(id),
    onSuccess: () => {
      setBookingToCancel(null);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (err: unknown) => {
      if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('Failed to cancel booking.');
      }
    },
  });

  const formatLocalDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getStatusBadgeClass = (status: BookingStatus) => {
    switch (status) {
      case 'APPROVED':
        return 'badge-approved';
      case 'PENDING':
        return 'badge-pending';
      case 'REJECTED':
        return 'badge-rejected';
      case 'CANCELLED':
        return 'badge-cancelled';
    }
  };

  const handleConfirmCancel = () => {
    if (bookingToCancel) {
      cancelMutation.mutate(bookingToCancel.id);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Bookings</h1>
        <p className="page-subtitle">Track your hall reservations and manage active bookings</p>
      </div>

      {actionError && (
        <div className="banner banner-error" role="alert" aria-live="polite">
          {actionError}
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
          <p>{error instanceof Error ? error.message : 'Failed to load your bookings.'}</p>
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

      {!isLoading && !isError && bookings && bookings.length === 0 && (
        <div className="empty-state">
          <h3>No bookings yet</h3>
          <p>You haven&apos;t reserved any halls yet.</p>
        </div>
      )}

      {!isLoading && !isError && bookings && bookings.length > 0 && (
        <div className="bookings-table-container">
          <table className="bookings-table">
            <thead>
              <tr>
                <th scope="col">Hall</th>
                <th scope="col">Title</th>
                <th scope="col">Time Range (Local)</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const canCancel =
                  booking.status === 'PENDING' || booking.status === 'APPROVED';
                return (
                  <tr key={booking.id}>
                    <td>
                      <strong>{booking.hallName}</strong>
                    </td>
                    <td>{booking.title}</td>
                    <td>
                      {formatLocalDateTime(booking.startTime)} –{' '}
                      {formatLocalDateTime(booking.endTime)}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td>
                      {canCancel ? (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => {
                            setActionError(null);
                            setBookingToCancel(booking);
                          }}
                        >
                          Cancel
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                          No actions
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Accessible Confirmation Dialog */}
      {bookingToCancel && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
        >
          <div className="modal-content">
            <h2 id="cancel-dialog-title" style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>
              Cancel Booking?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              Are you sure you want to cancel your reservation for{' '}
              <strong>{bookingToCancel.title}</strong> at{' '}
              <strong>{bookingToCancel.hallName}</strong>? This slot will immediately be made available for others.
            </p>

            {cancelMutation.isError && (
              <p className="form-error" style={{ marginTop: 'var(--space-2)' }}>
                {cancelMutation.error instanceof Error
                  ? cancelMutation.error.message
                  : 'Failed to cancel.'}
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBookingToCancel(null)}
                disabled={cancelMutation.isPending}
              >
                Keep Booking
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmCancel}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
