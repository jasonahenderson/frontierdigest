import { ZodError } from "zod";
import { loadProfile, loadSources, loadDomain } from "./loader.js";

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    file: string;
    path: string;
    message: string;
  }>;
  warnings: Array<{
    file: string;
    message: string;
  }>;
}

export async function validateConfig(
  profilePath: string,
  sourcesPath: string,
): Promise<ValidationResult> {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];

  // Validate profile config
  let profile;
  try {
    profile = await loadProfile(profilePath);
  } catch (err) {
    if (err instanceof ZodError) {
      for (const issue of err.issues) {
        errors.push({
          file: profilePath,
          path: issue.path.join("."),
          message: issue.message,
        });
      }
    } else {
      errors.push({
        file: profilePath,
        path: "",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Validate sources config
  let sources;
  try {
    sources = await loadSources(sourcesPath);
  } catch (err) {
    if (err instanceof ZodError) {
      for (const issue of err.issues) {
        errors.push({
          file: sourcesPath,
          path: issue.path.join("."),
          message: issue.message,
        });
      }
    } else {
      errors.push({
        file: sourcesPath,
        path: "",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Warnings for profile
  if (profile) {
    if (profile.interests.include.length === 0) {
      warnings.push({
        file: profilePath,
        message: "No interests defined in interests.include — digest may lack focus",
      });
    }

    const { relevance_weight, recency_weight, source_weight, reinforcement_weight } =
      profile.ranking;
    if (
      relevance_weight === 0 &&
      recency_weight === 0 &&
      source_weight === 0 &&
      reinforcement_weight === 0
    ) {
      warnings.push({
        file: profilePath,
        message: "All ranking weights are 0 — scoring will be ineffective",
      });
    }
  }

  // Warnings for sources
  if (sources) {
    if (sources.length === 0) {
      warnings.push({
        file: sourcesPath,
        message: "No sources defined — nothing to fetch",
      });
    }

    if (sources.length > 0 && sources.every((s) => s.weight === 0)) {
      warnings.push({
        file: sourcesPath,
        message: "All source weights are 0 — no source will contribute to scoring",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function validateDomainConfig(
  domainPath: string,
): Promise<ValidationResult> {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];

  let domain;
  try {
    domain = await loadDomain(domainPath);
  } catch (err) {
    if (err instanceof ZodError) {
      for (const issue of err.issues) {
        errors.push({
          file: domainPath,
          path: issue.path.join("."),
          message: issue.message,
        });
      }
    } else {
      errors.push({
        file: domainPath,
        path: "",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (domain) {
    const d = domain.domain;

    // Warnings for profile interests
    if (d.profile.interests.include.length === 0) {
      warnings.push({
        file: domainPath,
        message:
          "No interests defined in domain.profile.interests.include — digest may lack focus",
      });
    }

    // Warnings for ranking weights
    const {
      relevance_weight,
      recency_weight,
      source_weight,
      reinforcement_weight,
    } = d.profile.ranking;
    if (
      relevance_weight === 0 &&
      recency_weight === 0 &&
      source_weight === 0 &&
      reinforcement_weight === 0
    ) {
      warnings.push({
        file: domainPath,
        message: "All ranking weights are 0 — scoring will be ineffective",
      });
    }

    // Warnings for sources
    if (d.sources.length === 0) {
      warnings.push({
        file: domainPath,
        message: "No sources defined — nothing to fetch",
      });
    }

    if (d.sources.length > 0 && d.sources.every((s) => s.weight === 0)) {
      warnings.push({
        file: domainPath,
        message:
          "All source weights are 0 — no source will contribute to scoring",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
