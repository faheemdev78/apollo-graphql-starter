import { z } from 'zod';
import { ROLES, TASK_PRIORITIES, TASK_STATUSES } from '../domain/enums';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Expected a MongoDB id');

export const roleSchema = z.enum(ROLES);
export const taskStatusSchema = z.enum(TASK_STATUSES);
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);

const emailSchema = z
  .string()
  .trim()
  .max(254)
  .email('Enter a valid email')
  .transform((value) => value.toLowerCase());

const nameSchema = z.string().trim().min(1).max(80);
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(72);

export const registerSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const updateProfileSchema = z
  .object({
    name: nameSchema.nullish(),
    avatarUrl: z.string().trim().url('Enter a valid URL').max(500).nullable().optional(),
  })
  .refine((value) => value.name != null || value.avatarUrl !== undefined, {
    message: 'Provide at least one field to update',
  });

export const searchSchema = z.string().trim().min(1).max(80);

const projectKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(10)
  .regex(/^[A-Za-z][A-Za-z0-9]+$/, 'Key must start with a letter and use only letters and digits')
  .transform((value) => value.toUpperCase());

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  key: projectKeySchema,
  description: z.string().trim().max(2000).nullish(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: 'Provide at least one field to update',
  });

export const addProjectMemberSchema = z.object({
  projectId: objectIdSchema,
  userId: objectIdSchema,
  role: roleSchema,
});

const labelSchema = z.array(z.string().trim().min(1).max(24)).max(8);

export const createTaskSchema = z.object({
  projectId: objectIdSchema,
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(5000).nullish(),
  status: taskStatusSchema.nullish(),
  priority: taskPrioritySchema.nullish(),
  assigneeId: objectIdSchema.nullish(),
  dueDate: z.date().nullish(),
  labels: labelSchema.nullish(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(140).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: objectIdSchema.nullable().optional(),
    dueDate: z.date().nullable().optional(),
    labels: labelSchema.optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field to update',
  });

export const taskFilterSchema = z.object({
  status: taskStatusSchema.nullish(),
  priority: taskPrioritySchema.nullish(),
  assigneeId: objectIdSchema.nullish(),
  search: z.string().trim().min(1).max(80).nullish(),
});
