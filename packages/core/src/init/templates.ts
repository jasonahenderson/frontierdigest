export const TEMPLATES: Record<
  string,
  { description: string; filename: string }
> = {
  "ai-frontier": {
    description: "AI and machine learning frontier",
    filename: "ai-frontier.yaml",
  },
  "quantum-computing": {
    description: "Quantum computing developments",
    filename: "quantum-computing.yaml",
  },
  "brain-science": {
    description: "Neuroscience and brain research",
    filename: "brain-science.yaml",
  },
};

export function listTemplates(): Array<{ id: string; description: string }> {
  return Object.entries(TEMPLATES).map(([id, t]) => ({
    id,
    description: t.description,
  }));
}

export function getTemplatePath(templateId: string): string | null {
  const template = TEMPLATES[templateId];
  if (!template) return null;
  return `configs/domains/${template.filename}`;
}
