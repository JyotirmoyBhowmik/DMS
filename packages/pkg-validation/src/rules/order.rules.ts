import { ValidationError } from '../errors.js';

export class OrderRules {
  /**
   * Validate credit limit. Throws ValidationError if outstanding amount + order value exceeds limit.
   */
  static validateCreditLimit(outstandingAmount: number, orderValue: number, limit: number): void {
    if (outstandingAmount + orderValue > limit) {
      throw new ValidationError('Credit limit exceeded', [
        {
          path: 'orderValue',
          message: `Outstanding amount (${outstandingAmount}) + order value (${orderValue}) exceeds limit (${limit})`,
        },
      ]);
    }
  }

  /**
   * Validate journey window. Throws ValidationError if the current time is outside the allowed window.
   * @param currentTime - Current date/time
   * @param allowedDays - Array of day indices (0 = Sunday, 1 = Monday, etc.)
   * @param startHour - Business start hour (0-23)
   * @param endHour - Business end hour (0-23)
   */
  static validateJourneyWindow(
    currentTime: Date,
    allowedDays: number[],
    startHour: number,
    endHour: number
  ): void {
    const day = currentTime.getUTCDay();
    if (!allowedDays.includes(day)) {
      throw new ValidationError('Outside allowed journey days', [
        {
          path: 'journeyWindow',
          message: `Current day of week (${day}) is not in the allowed days: [${allowedDays.join(', ')}]`,
        },
      ]);
    }

    const hour = currentTime.getUTCHours();
    if (hour < startHour || hour >= endHour) {
      throw new ValidationError('Outside allowed journey hours', [
        {
          path: 'journeyWindow',
          message: `Current UTC hour (${hour}) is outside the allowed business window: ${startHour}:00 - ${endHour}:00 UTC`,
        },
      ]);
    }
  }
}
