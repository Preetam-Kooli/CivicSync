import { z } from 'zod';

export const createAlertSchema = z.object({
  kind: z.enum(['flood', 'road_closure', 'fire', 'weather', 'general']),
  severity: z.enum(['info', 'warning', 'critical']),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120, 'Title is too long'),
  message: z.string().trim().min(3, 'Message must be at least 3 characters').max(500, 'Message is too long'),
  hours: z.coerce
    .number()
    .int()
    .refine((h) => [1, 3, 6, 12, 24, 48, 72].includes(h), 'Choose a duration from the list'),
});