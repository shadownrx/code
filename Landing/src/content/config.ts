import { defineCollection, z } from 'astro:content';

const docs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    section: z.enum(['Empezar', 'Guías']),
    order: z.number(),
  }),
});

export const collections = { docs };
