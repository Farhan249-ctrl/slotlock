export type Role = 'STUDENT' | 'ADMIN';

export type BookingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface Hall {
  id: number;
  name: string;
  capacity: number;
}

export interface Booking {
  id: number;
  hallId: number;
  hallName: string;
  userId: number;
  userName: string;
  title: string;
  startTime: string; // ISO UTC
  endTime: string;   // ISO UTC
  status: BookingStatus;
  createdAt: string; // ISO UTC
}

export interface CreateBookingPayload {
  hallId: number;
  title: string;
  startTime: string;
  endTime: string;
}

export class SlotTakenError extends Error {
  constructor() {
    super('That slot was just taken. Pick another time.');
    this.name = 'SlotTakenError';
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
