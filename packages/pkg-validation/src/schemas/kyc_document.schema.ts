import { z } from 'zod';

export const KYCDocumentTypeEnum = z.enum(['GSTIN', 'PAN', 'TRADE_LICENSE', 'FSSAI', 'DRUG_LICENSE', 'BANK_PROOF']);
export const KYCVerificationStatusEnum = z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED']);

export const CreateKYCDocumentSchema = z.object({
  distributorId: z.string().uuid({ message: 'distributorId must be a valid UUID' }),
  documentType: KYCDocumentTypeEnum,
  documentNumber: z.string().min(1, { message: 'documentNumber is required' }).max(100),
  documentUrl: z.string().url().max(1024).optional(),
  expiresAt: z.string().optional(),
});

export const VerifyKYCDocumentSchema = z.object({
  verifiedBy: z.string().uuid({ message: 'verifiedBy must be a valid UUID' }),
  expiresAt: z.string().optional(),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export const RejectKYCDocumentSchema = z.object({
  rejectionReason: z.string().min(1, { message: 'rejectionReason is required' }),
  version: z.number().int().positive({ message: 'version is required for optimistic locking' }),
});

export type CreateKYCDocumentDTO = z.infer<typeof CreateKYCDocumentSchema>;
export type VerifyKYCDocumentDTO = z.infer<typeof VerifyKYCDocumentSchema>;
export type RejectKYCDocumentDTO = z.infer<typeof RejectKYCDocumentSchema>;
