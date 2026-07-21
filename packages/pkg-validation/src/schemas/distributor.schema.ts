import { z } from 'zod';

export const CreateDistributorSchema = z.object({
  id: z.string().uuid({ message: 'Invalid Distributor ID format (must be UUID)' }),
  name: z.string()
    .trim()
    .min(1, { message: 'Distributor name cannot be empty' })
    .max(255, { message: 'Distributor name cannot exceed 255 characters' }),
  region: z.string()
    .trim()
    .min(1, { message: 'Region cannot be empty' })
    .max(100, { message: 'Region cannot exceed 100 characters' }),
  creditLimit: z.number()
    .int({ message: 'Credit limit must be an integer (cents/paise)' })
    .nonnegative({ message: 'Credit limit cannot be negative' }),
});

export const UpdateDistributorSchema = z.object({
  id: z.string().uuid({ message: 'Invalid Distributor ID format' }),
  name: z.string()
    .trim()
    .min(1, { message: 'Distributor name cannot be empty' })
    .max(255, { message: 'Distributor name cannot exceed 255 characters' })
    .optional(),
  region: z.string()
    .trim()
    .min(1, { message: 'Region cannot be empty' })
    .max(100, { message: 'Region cannot exceed 100 characters' })
    .optional(),
  creditLimit: z.number()
    .int({ message: 'Credit limit must be an integer (cents/paise)' })
    .nonnegative({ message: 'Credit limit cannot be negative' })
    .optional(),
  version: z.number()
    .int()
    .positive({ message: 'Version must be a positive integer' }),
});

export const ListDistributorsSchema = z.object({
  page: z.string().optional().transform(val => val ? Math.max(1, parseInt(val, 10)) : 1),
  pageSize: z.string().optional().transform(val => val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 25),
  region: z.string().trim().optional(),
});
