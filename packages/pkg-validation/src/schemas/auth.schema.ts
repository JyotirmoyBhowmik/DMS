import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  deviceId: z.string().min(1, 'Device identifier is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
