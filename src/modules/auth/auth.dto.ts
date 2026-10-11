import { z } from 'zod';

export const signupSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters long')
      .max(100, 'Name must not exceed 100 characters')
      .trim(),
    age: z
      .union([
        z.number(),
        z.string().regex(/^\d+$/, 'Age must be a valid number').transform((v) => parseInt(v, 10)),
      ])
      .refine((val) => val >= 1 && val <= 120, {
        message: 'Age must be between 1 and 120',
      }),
    email: z
      .string()
      .email('Please provide a valid email address')
      .toLowerCase()
      .trim(),
    number: z.string().optional(),
    phoneNumber: z.string().optional(),
  })
  .refine((data) => Boolean(data.number || data.phoneNumber), {
    message: 'Phone number is required (provide "phoneNumber" or "number")',
    path: ['phoneNumber'],
  });

export const verifyOtpSchema = z.object({
  email: z
    .string()
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),
  otp: z
    .string()
    .regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});

export const loginRequestSchema = z.object({
  email: z
    .string()
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),
});

export const resendOtpSchema = z.object({
  email: z
    .string()
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),
  type: z.enum(['registration', 'login']).default('login'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  age: z
    .union([z.number(), z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10))])
    .refine((val) => val >= 1 && val <= 120, { message: 'Age must be between 1 and 120' })
    .optional(),
  phoneNumber: z.string().min(7).max(16).trim().optional(),
  avatar: z.string().url('Avatar must be a valid URL').optional(),
});
