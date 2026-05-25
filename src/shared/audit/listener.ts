/**
 * 把跨模块事件桥接到 AuditLog。
 *
 * 设计：单向监听 EventBus；audit 写入 best-effort（失败仅 log，不阻塞业务）。
 * 只覆盖"写"与"权限相关"事件（read 不审计，量太大）。
 */
import { bus } from "@/shared/bus";
import { AuditService } from "./service";

let booted = false;

export function ensureAuditListenersBooted() {
  if (booted) return;
  booted = true;

  bus.on("record.created", (env) => {
    const p = env.payload;
    AuditService.log({
      appId: p.appId,
      userId: p.actorId,
      action: "record.create",
      resourceType: "record",
      resourceId: p.recordId,
      after: { dataType: p.dataType, ownerId: p.ownerId }
    });
  });

  bus.on("record.updated", (env) => {
    const p = env.payload;
    AuditService.log({
      appId: p.appId,
      userId: p.actorId,
      action: "record.update",
      resourceType: "record",
      resourceId: p.recordId,
      before: p.before,
      after: p.after
    });
  });

  bus.on("record.deleted", (env) => {
    const p = env.payload;
    AuditService.log({
      appId: p.appId,
      userId: p.actorId,
      action: "record.delete",
      resourceType: "record",
      resourceId: p.recordId
    });
  });

  bus.on("file.uploaded", (env) => {
    const p = env.payload;
    AuditService.log({
      appId: p.appId,
      userId: p.ownerId,
      action: "file.upload",
      resourceType: "file",
      resourceId: p.fileId,
      after: { objectKey: p.objectKey, size: p.size, mimeType: p.mimeType }
    });
  });

  bus.on("file.deleted", (env) => {
    const p = env.payload;
    AuditService.log({
      appId: p.appId,
      userId: p.ownerId,
      action: "file.delete",
      resourceType: "file",
      resourceId: p.fileId
    });
  });

  bus.on("auth.login", (env) => {
    AuditService.log({
      userId: env.payload.userId,
      action: "auth.login",
      resourceType: "session",
      resourceId: env.payload.sessionId,
      ip: env.payload.ip
    });
  });

  bus.on("auth.logout", (env) => {
    AuditService.log({
      userId: env.payload.userId,
      action: "auth.logout",
      resourceType: "session",
      resourceId: env.payload.sessionId
    });
  });

  bus.on("authorization.granted", (env) => {
    AuditService.log({
      appId: env.payload.appId,
      userId: env.payload.userId,
      action: "authorization.grant",
      resourceType: "authorization",
      after: { authType: env.payload.authType }
    });
  });

  bus.on("authorization.revoked", (env) => {
    AuditService.log({
      appId: env.payload.appId,
      userId: env.payload.userId,
      action: "authorization.revoke",
      resourceType: "authorization"
    });
  });

  bus.on("schema.activated", (env) => {
    const p = env.payload;
    AuditService.log({
      appId: p.appId,
      action: "schema.activate",
      resourceType: "schema_version",
      after: { dataType: p.dataType, version: p.version }
    });
  });
}
