import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long'),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .max(254, 'Email is too long'),

  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number')
    .optional(),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[a-z]/, 'Password needs a lowercase letter')
    .regex(/[A-Z]/, 'Password needs an uppercase letter')
    .regex(/[0-9]/, 'Password needs a number'),
});

// Login only checks the SHAPE of the input. It deliberately does not
// enforce password strength rules (that would reveal our policy to attackers).
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .max(254, 'Email is too long'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(72, 'Password is too long'),
  portal: z.enum(['citizen', 'admin']),
});