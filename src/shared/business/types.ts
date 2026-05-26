import type { AuthContext } from "@/shared/policy";
import type { DomainEventName } from "@/shared/bus";

export type BusinessOrigin = AuthContext["origin"] | "console" | "apiKey" | "cron";

export interface BusinessActorContext extends Omit<AuthContext, "origin"> {
  origin: BusinessOrigin;
  requestId?: string;
  ip?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  apiKeyId?: string | null;
  eventId?: string | null;
  auditId?: string | null;
}

export type DataCommandKind = "create" | "update" | "delete" | "fieldOps" | "transition";

export type DataFieldOperation =
  | { kind: "increment"; path: string; by: number }
  | { kind: "push"; path: string; value: unknown; uniq?: boolean }
  | { kind: "set"; path: string; value: unknown }
  | { kind: "unset"; path: string };

export interface DataCommandIntent {
  kind: DataCommandKind;
  appId: string;
  dataType: string;
  recordId?: string;
  ownerId?: string | null;
  data?: Record<string, unknown>;
  merge?: boolean;
  ops?: DataFieldOperation[];
  transition?: string;
  metadata?: Record<string, unknown>;
}

export interface DataChangeSet {
  before: Record<string, unknown> | null;
  submitted: Record<string, unknown>;
  after: Record<string, unknown> | null;
  changedPaths: string[];
}

export interface CommandContext {
  actor: BusinessActorContext;
  intent: DataCommandIntent;
  changeSet?: DataChangeSet;
}

export type BusinessConditionValue =
  | string
  | number
  | boolean
  | null
  | BusinessConditionValue[]
  | { [key: string]: BusinessConditionValue };

export type BusinessCondition = Record<string, BusinessConditionValue>;

export type MutationRuleOperation =
  | { type: "set"; path: string; value: unknown }
  | { type: "unset"; path: string }
  | { type: "increment"; path: string; by: number }
  | { type: "push"; path: string; value: unknown; uniq?: boolean };

export interface MutationRuleDocument {
  version: 1;
  id: string;
  dataType: string;
  description?: string;
  on: string[];
  when?: BusinessCondition | null;
  then: MutationRuleOperation[];
}

export interface MutationContext extends CommandContext {
  rule: MutationRuleDocument;
}

export interface WorkflowTransition {
  id: string;
  from: string | string[];
  to: string;
  action: string;
  subjects?: string[];
  using?: BusinessCondition | null;
  check?: BusinessCondition | null;
}

export interface WorkflowDocument {
  version: 1;
  id: string;
  dataType: string;
  stateField: string;
  transitions: WorkflowTransition[];
}

export interface WorkflowContext extends CommandContext {
  workflow: WorkflowDocument;
  transition: WorkflowTransition;
}

export interface BusinessEventEnvelope {
  id: string;
  appId: string;
  type: DomainEventName | string;
  resourceType: "record" | "file" | "function" | "schema" | "authorization" | "system";
  resourceId?: string | null;
  actor: Pick<BusinessActorContext, "userId" | "role" | "appId" | "origin" | "functionName">;
  before?: unknown;
  after?: unknown;
  diff?: string[];
  requestId?: string;
  causedByEventId?: string | null;
  createdAt: number;
}

export interface BusinessRuleTraceStep {
  step: string;
  ruleId?: string;
  detail: unknown;
}

export interface BusinessDecisionTrace {
  allow: boolean;
  reason: string;
  steps: BusinessRuleTraceStep[];
}