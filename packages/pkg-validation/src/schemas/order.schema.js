"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaceOrderSchema = exports.OrderItemSchema = void 0;
const zod_1 = require("zod");
exports.OrderItemSchema = zod_1.z.object({
    skuId: zod_1.z.string().uuid('skuId must be a valid UUID'),
    quantity: zod_1.z.number().int().positive('Quantity must be greater than zero'),
    price: zod_1.z.number().positive('Price must be greater than zero'),
});
exports.PlaceOrderSchema = zod_1.z.object({
    outletId: zod_1.z.string().uuid('outletId must be a valid UUID'),
    items: zod_1.z.array(exports.OrderItemSchema).min(1, 'Order must contain at least one item'),
    notes: zod_1.z.string().optional(),
});
//# sourceMappingURL=order.schema.js.map