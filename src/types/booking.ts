import type { PaymentStatus } from './payment';

/**
 * Domain entity - represents a booking as stored in the system
 */
export interface Booking {
  id: string;
  activityId: string;
  userId: string;
  participants: number;
  createdAt: string;
  paymentId?: string;
  paymentStatus?: PaymentStatus;
}

/**
 * Request DTO for creating a new booking
 */
export interface CreateBookingRequest {
  activityId: string;
  participants: number;
}

export type { PaymentStatus };

/**
 * Activity information included in booking responses
 */
export interface BookingActivityInfo {
  name: string;
  slug: string;
  price: number;
  date: string;
  duration: number;
  location: string;
  status: string;
}

/**
 * Response DTO for booking retrieval - includes booking details with activity information and payment status
 */
export interface BookingResponse {
  id: string;
  activityId: string;
  userId: string;
  participants: number;
  createdAt: string;
  paymentId?: string;
  paymentStatus: PaymentStatus;
  activity: BookingActivityInfo;
}

/**
 * Validation error response format
 * Returned when validation fails (HTTP 400)
 * @deprecated Use ValidationError from '../types/error' instead
 */
export type { ValidationError } from './error';

/**
 * Reason why an activity cannot be booked - same codes as the client's BookabilityReason
 */
export type UnbookableReason = 'draft' | 'cancelled' | 'done' | 'sold-out' | 'past-date';
