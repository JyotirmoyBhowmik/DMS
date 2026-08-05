import { z } from 'zod';
export declare const OrderItemSchema: z.ZodObject<{
    skuId: z.ZodString;
    quantity: z.ZodNumber;
    price: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    skuId: string;
    quantity: number;
    price: number;
}, {
    skuId: string;
    quantity: number;
    price: number;
}>;
export declare const PlaceOrderSchema: z.ZodObject<{
    outletId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        skuId: z.ZodString;
        quantity: z.ZodNumber;
        price: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        skuId: string;
        quantity: number;
        price: number;
    }, {
        skuId: string;
        quantity: number;
        price: number;
    }>, "many">;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    outletId: string;
    items: {
        skuId: string;
        quantity: number;
        price: number;
    }[];
    notes?: string | undefined;
}, {
    outletId: string;
    items: {
        skuId: string;
        quantity: number;
        price: number;
    }[];
    notes?: string | undefined;
}>;
export type OrderItemInput = z.infer<typeof OrderItemSchema>;
export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;
//# sourceMappingURL=order.schema.d.ts.map