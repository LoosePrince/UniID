/**
 * 跨模块事件定义。Realtime / Webhook / Audit 等订阅这些事件。
 * 新增事件类型须同步更新 `EventMap` 并保证 payload 字段稳定。
 */

export type DomainEventMap = {
  "record.created": {
    appId: string;
    dataType: string;
    recordId: string;
    ownerId: string | null;
    data: unknown;
    actorId: string | null;
    at: number;
  };
  "record.updated": {
    appId: string;
    dataType: string;
    recordId: string;
    ownerId: string | null;
    before: unknown;
    after: unknown;
    actorId: string | null;
    at: number;
  };
  "record.deleted": {
    appId: string;
    dataType: string;
    recordId: string;
    ownerId: string | null;
    actorId: string | null;
    at: number;
  };
  "file.uploaded": {
    appId: string | null;
    ownerId: string;
    fileId: string;
    objectKey: string;
    size: number;
    mimeType: string;
    at: number;
  };
  "file.deleted": {
    appId: string | null;
    ownerId: string;
    fileId: string;
    at: number;
  };
  "auth.login": {
    userId: string;
    sessionId: string;
    ip: string | null;
    at: number;
  };
  "auth.logout": {
    userId: string;
    sessionId: string;
    at: number;
  };
  "auth.email_verified": {
    userId: string;
    email: string;
    at: number;
  };
  "auth.password_reset": {
    userId: string;
    at: number;
  };
  "authorization.granted": {
    userId: string;
    appId: string;
    authType: "full" | "restricted";
    at: number;
  };
  "authorization.revoked": {
    userId: string;
    appId: string;
    at: number;
  };
  "schema.activated": {
    appId: string;
    dataType: string;
    version: number;
    at: number;
  };
};

export type DomainEventName = keyof DomainEventMap;
export type DomainEventPayload<E extends DomainEventName> = DomainEventMap[E];

export interface DomainEventEnvelope<E extends DomainEventName = DomainEventName> {
  id: string;
  name: E;
  payload: DomainEventPayload<E>;
  at: number;
}
