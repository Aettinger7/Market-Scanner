import { z } from 'zod';
import { insertSignalSchema, signals } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  scan: {
    run: {
      method: 'POST' as const,
      path: '/api/scan/run',
      responses: {
        200: z.object({ message: z.string() }),
        500: errorSchemas.internal,
      },
    },
    latest: {
      method: 'GET' as const,
      path: '/api/scan/latest',
      responses: {
        200: z.array(z.custom<typeof signals.$inferSelect>()),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type SignalResponse = z.infer<typeof api.scan.latest.responses[200]>;
