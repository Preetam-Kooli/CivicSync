import { z } from 'zod';

const DEPARTMENTS = ['public_service', 'streetlight', 'flood', 'road', 'fire'];

// Note: 'super_admin' is NOT allowed here. A super admin can only be created
// from the command line (createSuperAdmin.js), never from the website.
export const createInviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
    role: z.enum(['staff', 'admin']),
    department: z.enum(DEPARTMENTS).optional(),
  })
  .refine((d) => d.role !== 'staff' || Boolean(d.department), {
    message: 'Choose a department for staff accounts',
    path: ['department'],
  });