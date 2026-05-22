export const STEP_STATUS = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'INTERRUPTED'] as const;

export type StepStatus = (typeof STEP_STATUS)[number];

export interface AgentProfile {
  id: string;
  name: string;
  command: string;
  argsTemplate: string[];
  env?: Record<string, string>;
}

export interface ProjectGroup {
  id: string;
  name: string;
  projectPath: string;
  description?: string;
}

export interface Step {
  id: string;
  name: string;
  agentProfileId?: string;
  taskTemplate?: string;
}

export interface FlowTemplate {
  id: string;
  name: string;
  steps: Step[];
}

export interface StepRun {
  id: string;
  stepId: string;
  status: StepStatus;
  startedAt?: string;
  endedAt?: string;
  output?: string;
  error?: string;
}

export interface FlowRun {
  id: string;
  flowTemplateId: string;
  projectGroupId: string;
  status: StepStatus;
  stepRuns: StepRun[];
  startedAt: string;
  endedAt?: string;
}

export interface AppConfig {
  projectGroups: ProjectGroup[];
  agentProfiles: AgentProfile[];
  flowTemplates: FlowTemplate[];
}

function ensureNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function parseStep(input: unknown): Step {
  if (typeof input !== 'object' || input === null) {
    throw new Error('step must be an object');
  }

  const raw = input as Record<string, unknown>;
  const step: Step = {
    id: ensureNonEmptyString(raw.id, 'step.id'),
    name: ensureNonEmptyString(raw.name, 'step.name')
  };

  if (raw.agentProfileId !== undefined) {
    step.agentProfileId = ensureNonEmptyString(raw.agentProfileId, 'step.agentProfileId');
  }
  if (raw.taskTemplate !== undefined) {
    step.taskTemplate = ensureNonEmptyString(raw.taskTemplate, 'step.taskTemplate');
  }

  return step;
}

export function parseFlowTemplate(input: unknown): FlowTemplate {
  if (typeof input !== 'object' || input === null) {
    throw new Error('flow template must be an object');
  }

  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.steps)) {
    throw new Error('steps must be an array');
  }
  if (raw.steps.length === 0) {
    throw new Error('steps must not be empty');
  }

  return {
    id: ensureNonEmptyString(raw.id, 'flowTemplate.id'),
    name: ensureNonEmptyString(raw.name, 'flowTemplate.name'),
    steps: raw.steps.map(parseStep)
  };
}

export function parseConfig(input: unknown): AppConfig {
  if (typeof input !== 'object' || input === null) {
    throw new Error('config must be an object');
  }

  const raw = input as Record<string, unknown>;
  const projectGroups = Array.isArray(raw.projectGroups) ? raw.projectGroups : [];
  const agentProfiles = Array.isArray(raw.agentProfiles) ? raw.agentProfiles : [];
  const flowTemplates = Array.isArray(raw.flowTemplates) ? raw.flowTemplates : [];

  return {
    projectGroups: projectGroups.map((item) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error('project group must be an object');
      }
      const record = item as Record<string, unknown>;
      const result: ProjectGroup = {
        id: ensureNonEmptyString(record.id, 'projectGroup.id'),
        name: ensureNonEmptyString(record.name, 'projectGroup.name'),
        projectPath: ensureNonEmptyString(record.projectPath, 'projectGroup.projectPath')
      };
      if (record.description !== undefined) {
        result.description = ensureNonEmptyString(record.description, 'projectGroup.description');
      }
      return result;
    }),
    agentProfiles: agentProfiles.map((item) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error('agent profile must be an object');
      }
      const record = item as Record<string, unknown>;
      const argsTemplate = Array.isArray(record.argsTemplate) ? record.argsTemplate : [];
      if (!argsTemplate.every((v) => typeof v === 'string')) {
        throw new Error('agentProfile.argsTemplate must be string[]');
      }

      const result: AgentProfile = {
        id: ensureNonEmptyString(record.id, 'agentProfile.id'),
        name: ensureNonEmptyString(record.name, 'agentProfile.name'),
        command: ensureNonEmptyString(record.command, 'agentProfile.command'),
        argsTemplate
      };
      if (record.env !== undefined) {
        if (typeof record.env !== 'object' || record.env === null || Array.isArray(record.env)) {
          throw new Error('agentProfile.env must be a string map');
        }
        const envEntries = Object.entries(record.env as Record<string, unknown>);
        if (!envEntries.every(([, value]) => typeof value === 'string')) {
          throw new Error('agentProfile.env must be a string map');
        }
        result.env = Object.fromEntries(envEntries) as Record<string, string>;
      }
      return result;
    }),
    flowTemplates: flowTemplates.map(parseFlowTemplate)
  };
}
