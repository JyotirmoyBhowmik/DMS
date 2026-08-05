export class BusinessRules {
  static validateCreditLimit(outstandingAmount: number, orderValue: number, limit: number): boolean {
    return outstandingAmount + orderValue <= limit;
  }

  static calculateDiscount(baseValue: number, discountPercentage: number): number {
    if (discountPercentage < 0 || discountPercentage > 100) {
      throw new Error('Discount percentage must be between 0 and 100');
    }
    return parseFloat((baseValue * (discountPercentage / 100)).toFixed(2));
  }
}
