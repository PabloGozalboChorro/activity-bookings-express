import { Payment, PaymentStatus } from '../types/payment';
import { MockPaymentGatewayAdapter } from '../types/payment';
import { logger } from '../utils/logger';
import { JsonRepository } from '../repositories/json.repository';

export class PaymentService {
  private repository: JsonRepository<Payment>;
  private gateway: MockPaymentGatewayAdapter;

  constructor(gateway: MockPaymentGatewayAdapter, repository?: JsonRepository<Payment>) {
    this.gateway = gateway;
    
    if (repository) {
      this.repository = repository;
    } else {
      // Fallback: own file-backed repository when none is injected
      this.repository = new JsonRepository<Payment>('db/payments.json');
      this.repository.load();
    }
  }

  /**
   * Charges via mock gateway and creates a payment on success.
   * Throws if gateway returns failure; no payment is created.
   */
  createForBooking(
    bookingId: string,
    amount: number,
    userId: string,
    activityId: string
  ): Payment {
    const result = this.gateway.charge(amount, {
      userId,
      bookingId,
      activityId,
    });

    if (!result.success) {
      throw new Error('Payment could not be processed');
    }

    const paymentId = `payment-${this.repository.getNextId()}`;
    const now = new Date().toISOString();
    const status: PaymentStatus = 'paid';

    const payment: Payment = {
      id: paymentId,
      bookingId,
      amount,
      status,
      createdAt: now,
    };

    this.repository.create(payment);
    logger.info('PaymentService', 'Payment created', {
      id: paymentId,
      bookingId,
      amount,
      status,
    });
    return payment;
  }

  getById(id: string): Payment | undefined {
    return this.repository.getById(id);
  }
}
