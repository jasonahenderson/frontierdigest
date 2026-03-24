import type { RunManifest, StepResult } from "../types/index.js";

export class RunTracker {
  private manifest: RunManifest;

  constructor(runId: string, profileSnapshot: Record<string, unknown>) {
    this.manifest = {
      id: runId,
      started_at: new Date().toISOString(),
      status: "running",
      profile_snapshot: profileSnapshot,
      steps: [],
    };
  }

  startStep(name: string): void {
    const step: StepResult = {
      name,
      status: "completed",
      started_at: new Date().toISOString(),
    };
    this.manifest.steps.push(step);
  }

  completeStep(name: string, itemCount?: number): void {
    const step = this.manifest.steps.find((s) => s.name === name);
    if (!step) return;
    step.completed_at = new Date().toISOString();
    step.status = "completed";
    if (itemCount !== undefined) {
      step.item_count = itemCount;
    }
  }

  failStep(name: string, error: string): void {
    const step = this.manifest.steps.find((s) => s.name === name);
    if (!step) return;
    step.completed_at = new Date().toISOString();
    step.status = "failed";
    step.error = error;
  }

  complete(): RunManifest {
    this.manifest.status = "completed";
    this.manifest.completed_at = new Date().toISOString();
    return this.manifest;
  }

  fail(error: string): RunManifest {
    this.manifest.status = "failed";
    this.manifest.completed_at = new Date().toISOString();
    return this.manifest;
  }

  getManifest(): RunManifest {
    return this.manifest;
  }
}
