import { z } from 'zod';

export const createIssueSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120, 'Title is too long'),
  description: z.string().trim().max(1000, 'Description is too long').optional(),
  severity: z.coerce.number().int().min(1).max(5),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  addressText: z.string().trim().max(200).optional(),
});