"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessRules = void 0;
class BusinessRules {
    static validateCreditLimit(outstandingAmount, orderValue, limit) {
        return outstandingAmount + orderValue <= limit;
    }
    static calculateDiscount(baseValue, discountPercentage) {
        if (discountPercentage < 0 || discountPercentage > 100) {
            throw new Error('Discount percentage must be between 0 and 100');
        }
        return parseFloat((baseValue * (discountPercentage / 100)).toFixed(2));
    }
}
exports.BusinessRules = BusinessRules;
//# sourceMappingURL=business.rules.js.map