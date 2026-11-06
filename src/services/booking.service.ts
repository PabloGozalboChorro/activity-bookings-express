import {
  Booking,
  BookingResponse,
  CreateBookingRequest,
  PaymentStatus,
  ValidationError,
} from '../types/booking';
import { ActivityService } from './activity.service';
import { PaymentService } from './payment.service';
import { logger } from '../utils/logger';
import { JsonRepository } from '../repositories/json.repository';

export class BookingService {
  private repository: JsonRepository<Booking>;
  private activityService: ActivityService;
  private paymentService: PaymentService;

  constructor(
    activityService: ActivityService,
    paymentService: PaymentService,
    repository?: JsonRepository<Booking>
  ) {
    this.activityService = activityService;
    this.paymentService = paymentService;
    
    if (repository) {
      this.repository = repository;
    } else {
      // Fallback: own file-backed repository when none is injected
      this.repository = new JsonRepository<Booking>('db/bookings.json');
      this.repository.load();
    }
  }

  /**
   * Creates a new booking.
   * Charges via mock gateway first; on success creates payment and booking.
   * Throws if validation fails, activity not found, capacity exceeded, or payment fails.
   */
  create(req: CreateBookingRequest, userId: string): Booking {
    const errors = this.validateCreate(req);
    if (errors.length > 0) {
      throw new Error('Validation failed');
    }

    const activity = this.activityService.getById(req.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    const availableCapacity = this.calculateAvailableCapacity(req.activityId);
    if (req.participants > availableCapacity) {
      throw new Error(`Capacity exceeded. Available: ${availableCapacity}, Requested: ${req.participants}`);
    }

    const amount = activity.price * req.participants;
    const bookingId = `booking-${this.repository.getNextId()}`;

    const payment = this.paymentService.createForBooking(
      bookingId,
      amount,
      userId,
      req.activityId
    );

    const now = new Date().toISOString();
    const paymentStatus: PaymentStatus = 'paid';

    const booking: Booking = {
      id: bookingId,
      activityId: req.activityId,
      userId,
      participants: req.participants,
      createdAt: now,
      paymentId: payment.id,
      paymentStatus,
    };

    this.repository.create(booking);
    logger.info('BookingService', 'Booking created', {
      id: bookingId,
      activityId: req.activityId,
      participants: req.participants,
      paymentId: payment.id,
    });
    return booking;
  }

  /**
   * Retrieves all bookings for a specific activity
   * Returns array of bookings filtered by activityId
   */
  getBookingsByActivityId(activityId: string): Booking[] {
    return this.repository.getAll().filter((booking) => booking.activityId === activityId);
  }

  /**
   * Calculates available capacity for an activity
   * Returns available capacity as activity.maxParticipants minus sum of participants from existing bookings
   */
  calculateAvailableCapacity(activityId: string): number {
    const activity = this.activityService.getById(activityId);
    if (!activity) {
      return 0;
    }

    const existingBookings = this.getBookingsByActivityId(activityId);
    const totalBookedParticipants = existingBookings.reduce((sum, booking) => sum + booking.participants, 0);
    const availableCapacity = activity.maxParticipants - totalBookedParticipants;

    return Math.max(0, availableCapacity);
  }

  /**
   * Retrieves all bookings for a specific user
   * Returns array of bookings filtered by userId
   */
  getAllByUserId(userId: string): Booking[] {
    return this.repository.getAll().filter((booking) => booking.userId === userId);
  }

  /**
   * Retrieves a booking by ID
   * Returns undefined if not found
   */
  getById(id: string): Booking | undefined {
    return this.repository.getById(id);
  }

  /**
   * Retrieves a booking by ID and validates it belongs to the user
   * Throws if booking not found or does not belong to user
   */
  getUserBookingById(id: string, userId: string): Booking {
    const booking = this.getById(id);
    if (!booking) {
      throw new Error('Booking not found');
    }
    if (booking.userId !== userId) {
      throw new Error('Booking not found');
    }
    return booking;
  }

  /**
   * Enriches booking with activity information
   * Returns booking response with activity details
   */
  enrichBookingWithActivity(booking: Booking): BookingResponse {
    const activity = this.activityService.getById(booking.activityId);
    if (!activity) {
      throw new Error('Activity not found');
    }

    return {
      id: booking.id,
      activityId: booking.activityId,
      userId: booking.userId,
      participants: booking.participants,
      createdAt: booking.createdAt,
      paymentId: booking.paymentId,
      paymentStatus: this.enrichBookingWithPaymentStatus(booking),
      activity: {
        name: activity.name,
        slug: activity.slug,
        price: activity.price,
        date: activity.date,
        duration: activity.duration,
        location: activity.location,
        status: activity.status,
      },
    };
  }

  /**
   * Resolves payment status for a booking.
   * Uses stored paymentStatus when present; otherwise 'pending'.
   */
  enrichBookingWithPaymentStatus(booking: Booking): PaymentStatus {
    return booking.paymentStatus ?? 'pending';
  }

  /**
   * Validates create request
   * Returns array of all validation errors (empty if valid)
   */
  validateCreate(data: unknown): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== 'object') {
      return [{ field: 'body', message: 'Request body must be a valid JSON object' }];
    }

    const req = data as Record<string, unknown>;

    // Validate activityId
    if (!req.activityId || typeof req.activityId !== 'string' || req.activityId.trim() === '') {
      errors.push({ field: 'activityId', message: 'Activity ID is required and must be a non-empty string' });
    }

    // Validate participants
    if (typeof req.participants !== 'number' || req.participants < 1) {
      errors.push({
        field: 'participants',
        message: 'Participants is required and must be a positive number (at least 1)',
      });
    }

    return errors;
  }
}
