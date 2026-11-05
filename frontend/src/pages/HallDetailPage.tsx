import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../api/endpoints';
import { Booking, BookingStatus, SlotTakenError } from '../api/types';
import './HallDetailPage.css';

export const HallDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const hallId = Number(id);
  const queryClient = useQueryClient();

  // Local timezone name
  const timeZoneName = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  // Selected date defaults to tomorrow's date YYYY-MM-DD
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(tomorrowStr);

  // Form states
  const [title, setTitle] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('10:00');
  const [endTimeStr, setEndTimeStr] = useState('11:00');
  const [formErrors, setFormErrors] = useState<{
    title?: string;
    time?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch hall details
  const { data: halls } = useQuery({
    queryKey: ['halls'],
    queryFn: api.halls.list,
  });
  const hall = halls?.find((h) => h.id === hallId);

  // Fetch bookings for this hall and date
  const {
    data: bookings,
    isLoading: isLoadingBookings,
    isError: isErrorBookings,
    error: bookingsError,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ['bookings', hallId, selectedDate],
    queryFn: () => api.bookings.listForHallAndDate(hallId, selectedDate),
    enabled: !isNaN(hallId) && !!selectedDate,
  });

  // Booking mutation
  const createBookingMutation = useMutation({
    mutationFn: api.bookings.create,
    onSuccess: () => {
      setSuccessMessage('Booking requested successfully!');
      setTitle('');
      setServerError(null);
      queryClient.invalidateQueries({
        queryKey: ['bookings', hallId, selectedDate],
      });
    },
    onError: (err: unknown) => {
      if (err instanceof SlotTakenError) {
        setServerError('That slot was just taken. Pick another time.');
        queryClient.invalidateQueries({
          queryKey: ['bookings', hallId, selectedDate],
        });
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('Failed to submit booking.');
      }
    },
  });

  const validate = () => {
    const errs: { title?: string; time?: string } = {};

    if (!title.trim()) {
      errs.title = 'Title is required';
    }

    if (!startTimeStr || !endTimeStr) {
      errs.time = 'Start and end times are required';
    } else {
      const startDateTime = new Date(`${selectedDate}T${startTimeStr}:00`);
      const endDateTime = new Date(`${selectedDate}T${endTimeStr}:00`);

      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        errs.time = 'Invalid date or time';
      } else if (startDateTime.getTime() <= Date.now()) {
        errs.time = 'Start time must be in the future';
      } else if (endDateTime.getTime() <= startDateTime.getTime()) {
        errs.time = 'End time must be after start time';
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    const startDateTime = new Date(`${selectedDate}T${startTimeStr}:00`);
    const endDateTime = new Date(`${selectedDate}T${endTimeStr}:00`);

    createBookingMutation.mutate({
      hallId,
      title: title.trim(),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
    });
  };

  // Helper to format local time string (e.g. "10:00 AM")
  const formatLocalTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate timeline positions (08:00 to 20:00 -> 480 to 1200 minutes)
  const getTimelinePlacement = (booking: Booking) => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);

    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();

    const timelineStart = 8 * 60; // 08:00
    const timelineDuration = 12 * 60; // 12 hours (720 min)

    const leftPercent = Math.max(
      0,
      Math.min(100, ((startMin - timelineStart) / timelineDuration) * 100)
    );
    const rightPercent = Math.max(
      0,
      Math.min(100, ((endMin - timelineStart) / timelineDuration) * 100)
    );
    const widthPercent = Math.max(2, rightPercent - leftPercent);

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    };
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

  const getTimelineBlockClass = (status: BookingStatus) => {
    switch (status) {
      case 'APPROVED':
        return 'timeline-block-approved';
      case 'PENDING':
        return 'timeline-block-pending';
      case 'REJECTED':
        return 'timeline-block-rejected';
      case 'CANCELLED':
        return 'timeline-block-cancelled';
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{hall ? hall.name : 'Hall Schedule'}</h1>
        <p className="page-subtitle">
          {hall ? `Capacity: ${hall.capacity} seats` : 'View timeline and book slots'}
        </p>
      </div>

      <div className="hall-detail-layout">
        {/* Timeline Section */}
        <section className="timeline-section" aria-labelledby="timeline-heading">
          <div className="date-selector-row">
            <div>
              <label
                htmlFor="schedule-date-picker"
                className="form-label"
                style={{ display: 'block', marginBottom: 'var(--space-1)' }}
              >
                Schedule Date
              </label>
              <input
                id="schedule-date-picker"
                type="date"
                className="form-input"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setServerError(null);
                  setSuccessMessage(null);
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="timezone-pill" title="Time Zone">
                Zone: {timeZoneName}
              </span>
            </div>
          </div>

          <h2 id="timeline-heading" style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>
            Day Timeline (08:00 – 20:00)
          </h2>

          <div className="timeline-hour-markers" aria-hidden="true">
            <span>08:00</span>
            <span>10:00</span>
            <span>12:00</span>
            <span>14:00</span>
            <span>16:00</span>
            <span>18:00</span>
            <span>20:00</span>
          </div>

          <div
            className="timeline-track"
            role="region"
            aria-label={`Timeline for ${selectedDate}`}
          >
            {bookings?.map((b) => {
              const placement = getTimelinePlacement(b);
              return (
                <div
                  key={b.id}
                  className={`timeline-block ${getTimelineBlockClass(b.status)}`}
                  style={{
                    left: placement.left,
                    width: placement.width,
                  }}
                  title={`${b.title} (${formatLocalTime(b.startTime)} - ${formatLocalTime(
                    b.endTime
                  )}) [${b.status}]`}
                >
                  {formatLocalTime(b.startTime)} - {b.title} ({b.status})
                </div>
              );
            })}
          </div>

          {isLoadingBookings && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div className="skeleton" style={{ height: '40px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ height: '40px' }} />
            </div>
          )}

          {isErrorBookings && (
            <div className="banner banner-error" role="alert">
              <p>
                {bookingsError instanceof Error
                  ? bookingsError.message
                  : 'Failed to load schedule for this date.'}
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: 'var(--space-2)' }}
                onClick={() => refetchBookings()}
              >
                Retry
              </button>
            </div>
          )}

          {!isLoadingBookings && !isErrorBookings && bookings && bookings.length === 0 && (
            <p className="empty-state" style={{ padding: 'var(--space-6) 0' }}>
              No bookings scheduled for this date. All slots between 08:00 and 20:00 are free!
            </p>
          )}

          {bookings && bookings.length > 0 && (
            <div className="booked-list">
              <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Scheduled Bookings on this Day:
              </h3>
              {bookings.map((b) => (
                <div key={b.id} className="booked-item">
                  <div>
                    <span className="booked-item-title">{b.title}</span>
                    <div className="booked-item-time">
                      {formatLocalTime(b.startTime)} – {formatLocalTime(b.endTime)} ({timeZoneName})
                    </div>
                  </div>
                  <span className={`badge ${getStatusBadgeClass(b.status)}`}>
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Booking Form Section */}
        <section className="booking-form-section" aria-labelledby="booking-heading">
          <h2 id="booking-heading" style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>
            Book a Slot
          </h2>

          {serverError && (
            <div className="banner banner-error" role="alert" aria-live="polite">
              {serverError}
            </div>
          )}

          {successMessage && (
            <div className="banner banner-success" role="status" aria-live="polite">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="booking-title">
                Booking Title / Purpose
              </label>
              <input
                id="booking-title"
                type="text"
                className="form-input"
                placeholder="e.g. AI Research Seminar"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (formErrors.title)
                    setFormErrors((prev) => ({ ...prev, title: undefined }));
                }}
                disabled={createBookingMutation.isPending}
                required
              />
              {formErrors.title && (
                <span className="form-error" role="alert">
                  {formErrors.title}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="booking-date">
                Date
              </label>
              <input
                id="booking-date"
                type="date"
                className="form-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={createBookingMutation.isPending}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="booking-start">
                  Start Time
                </label>
                <input
                  id="booking-start"
                  type="time"
                  className="form-input"
                  value={startTimeStr}
                  onChange={(e) => {
                    setStartTimeStr(e.target.value);
                    if (formErrors.time)
                      setFormErrors((prev) => ({ ...prev, time: undefined }));
                  }}
                  disabled={createBookingMutation.isPending}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="booking-end">
                  End Time
                </label>
                <input
                  id="booking-end"
                  type="time"
                  className="form-input"
                  value={endTimeStr}
                  onChange={(e) => {
                    setEndTimeStr(e.target.value);
                    if (formErrors.time)
                      setFormErrors((prev) => ({ ...prev, time: undefined }));
                  }}
                  disabled={createBookingMutation.isPending}
                  required
                />
              </div>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
              Times are in local timezone ({timeZoneName}). Back-to-back slots are supported.
            </p>

            {formErrors.time && (
              <span
                className="form-error"
                role="alert"
                style={{ display: 'block', marginBottom: 'var(--space-3)' }}
              >
                {formErrors.time}
              </span>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={createBookingMutation.isPending}
            >
              {createBookingMutation.isPending ? 'Confirming slot...' : 'Reserve Slot'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
