import { z } from "zod";

export const StepResultSchema = z.object({
  name: z.string(),
  status: z.enum(["completed", "failed", "skipped"]),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  item_count: z.number().int().min(0).optional(),
  error: z.string().optional(),
});

export type StepResult = z.infer<typeof StepResultSchema>;

export const RunManifestSchema = z.object({
  id: z.string(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  status: z.enum(["running", "completed", "failed"]),
  profile_snapshot: z.record(z.string(), z.unknown()),
  steps: z.array(StepResultSchema),
});

export type RunManifest = z.infer<typeof RunManifestSchema>;
