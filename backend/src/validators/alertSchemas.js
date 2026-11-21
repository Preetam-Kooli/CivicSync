import { z } from 'zod';

export const createAlertSchema = z
  .object({
    kind: z.enum(['flood', 'road_closure', 'fire', 'weather', 'general']),
    severity: z.enum(['info', 'warning', 'critical']),
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120, 'Title is too long'),
    message: z.string().trim().min(3, 'Message must be at least 3 characters').max(500, 'Message is too long'),
    hours: z.coerce.number().int().refine((h) => [1, 3, 6, 12, 24, 48, 72].includes(h), 'Choose a duration from the list'),
    // Where it applies (all optional): a place name, and/or a pin with a radius in metres
    locationName: z.string().trim().max(120).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radiusM: z.coerce.number().int().refine((r) => [100, 250, 500, 1000, 2000, 5000].includes(r), 'Choose a radius from the list').optional(),
  })
  .refine((d) => (d.latitude === undefined) === (d.longitude === undefined), {
    message: 'Choose a point on the map',
    path: ['latitude'],
  });