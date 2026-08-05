import { z } from 'zod';
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    deviceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
    deviceId: string;
}, {
    password: string;
    email: string;
    deviceId: string;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
//# sourceMappingURL=auth.schema.d.ts.map