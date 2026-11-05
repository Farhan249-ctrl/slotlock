import { apiFetch } from './client';
import {
  AuthResponse,
  Booking,
  BookingStatus,
  CreateBookingPayload,
  Hall,
  User,
} from './types';

export const api = {
  auth: {
    login: (credentials: { email: string; password: string }) =>
      apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    register: (userData: { name: string; email: string; password: string }) =>
      apiFetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    me: () => apiFetch<User>('/api/auth/me'),
  },

  halls: {
    list: () => apiFetch<Hall[]>('/api/halls'),
  },

  bookings: {
    listForHallAndDate: (hallId: number, date: string) =>
      apiFetch<Booking[]>(`/api/bookings?hallId=${hallId}&date=${date}`),

    listByStatus: (status: BookingStatus) =>
      apiFetch<Booking[]>(`/api/bookings?status=${status}`),

    listMine: () => apiFetch<Booking[]>('/api/bookings/mine'),

    create: (payload: CreateBookingPayload) =>
      apiFetch<Booking>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    updateStatus: (id: number, status: 'APPROVED' | 'REJECTED') =>
      apiFetch<Booking>(`/api/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    cancel: (id: number) =>
      apiFetch<Booking>(`/api/bookings/${id}/cancel`, {
        method: 'PATCH',
      }),
  },
};
