import {
  checkRecordPermission,
  isSystemAdmin
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

/**
 * 保留的 DataSchema.dataType：与应用数据并列，用于配置该应用下文件的上传/下载/删除权限。
 * defaultPermissions 使用与业务记录相同的结构：`default.read`（下载）、`default.write`（上传）、`default.delete`（删除）。
 */
export const FILE_SCHEMA_DATA_TYPE = "file";

/** 文件鉴权用的主体（与 Prisma FileObject 一致） */
export type FilePermissionSubject = {
  ownerId: string;
  appId: string | null;
};

/**
 * 从 FileObject 查询结果构造鉴权主体（避免部分环境下 Prisma 类型未包含 appId 的告警）
 */
export function toFilePermissionSubject(row: unknown): FilePermissionSubject {
  const r = row as { ownerId: string; appId?: string | null };
  return { ownerId: r.ownerId, appId: r.appId ?? null };
}

type FilePolicy = {
  upload: {
    allowAuthenticated: boolean;
    allowedRoles: string[];
  };
  download: {
    ownerOnly: boolean;
    adminCanDownloadAll: boolean;
    allowShareToken: boolean;
  };
  delete: {
    ownerCanDelete: boolean;
    adminCanManageAll: boolean;
  };
};

const DEFAULT_POLICY: FilePolicy = {
  upload: {
    allowAuthenticated: false,
    allowedRoles: ["admin"]
  },
  download: {
    ownerOnly: true,
    adminCanDownloadAll: true,
    allowShareToken: true
  },
  delete: {
    ownerCanDelete: true,
    adminCanManageAll: true
  }
};

function safeParsePolicy(value: string | null): FilePolicy {
  if (!value) return DEFAULT_POLICY;
  try {
    const parsed = JSON.parse(value) as Partial<FilePolicy>;
    return {
      upload: {
        allowAuthenticated: parsed.upload?.allowAuthenticated ?? DEFAULT_POLICY.upload.allowAuthenticated,
        allowedRoles: parsed.upload?.allowedRoles ?? DEFAULT_POLICY.upload.allowedRoles
      },
      download: {
        ownerOnly: parsed.download?.ownerOnly ?? DEFAULT_POLICY.download.ownerOnly,
        adminCanDownloadAll:
          parsed.download?.adminCanDownloadAll ?? DEFAULT_POLICY.download.adminCanDownloadAll,
        allowShareToken: parsed.download?.allowShareToken ?? DEFAULT_POLICY.download.allowShareToken
      },
      delete: {
        ownerCanDelete: parsed.delete?.ownerCanDelete ?? DEFAULT_POLICY.delete.ownerCanDelete,
        adminCanManageAll: parsed.delete?.adminCanManageAll ?? DEFAULT_POLICY.delete.adminCanManageAll
      }
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

export async function getFilePolicy(): Promise<FilePolicy> {
  const client = prisma as unknown as {
    globalConfig?: { findUnique: (args: { where: { key: string } }) => Promise<{ key: string; value: string } | null> };
  };
  if (!client.globalConfig) return DEFAULT_POLICY;
  const config = await client.globalConfig.findUnique({
    where: { key: "file_policy" }
  });
  return safeParsePolicy(config?.value ?? null);
}

/** 读取应用下「文件」类 DataSchema 的 defaultPermissions（取最高版本且 isActive=1） */
export async function getFileSchemaDefaultPermissions(
  appId: string
): Promise<string | null> {
  const row = await prisma.dataSchema.findFirst({
    where: {
      appId,
      dataType: FILE_SCHEMA_DATA_TYPE,
      isActive: 1
    },
    orderBy: { version: "desc" }
  });
  const raw = row?.defaultPermissions?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export async function canUpload(
  user: User,
  appId: string | null
): Promise<boolean> {
  if (appId) {
    const permStr = await getFileSchemaDefaultPermissions(appId);
    if (permStr) {
      return checkRecordPermission(
        permStr,
        user.id,
        appId,
        user.id,
        "write",
        "full"
      );
    }
  }
  const policy = await getFilePolicy();
  if (policy.upload.allowAuthenticated) return true;
  return policy.upload.allowedRoles.includes(user.role);
}

export async function canManageAllFiles(userId: string): Promise<boolean> {
  const policy = await getFilePolicy();
  if (!policy.delete.adminCanManageAll && !policy.download.adminCanDownloadAll) {
    return false;
  }
  return isSystemAdmin(userId);
}

export async function canDeleteFile(
  file: FilePermissionSubject,
  user: User
): Promise<boolean> {
  if (file.appId) {
    const permStr = await getFileSchemaDefaultPermissions(file.appId);
    if (permStr) {
      return checkRecordPermission(
        permStr,
        user.id,
        file.appId,
        file.ownerId,
        "delete",
        "full"
      );
    }
  }
  const policy = await getFilePolicy();
  if (policy.delete.ownerCanDelete && file.ownerId === user.id) return true;
  if (policy.delete.adminCanManageAll && (await isSystemAdmin(user.id))) return true;
  return false;
}

export async function canDownloadFile(
  file: FilePermissionSubject,
  user: User
): Promise<boolean> {
  if (file.appId) {
    const permStr = await getFileSchemaDefaultPermissions(file.appId);
    if (permStr) {
      return checkRecordPermission(
        permStr,
        user.id,
        file.appId,
        file.ownerId,
        "read",
        "full"
      );
    }
  }
  const policy = await getFilePolicy();
  if (!policy.download.ownerOnly) return true;
  if (file.ownerId === user.id) return true;
  if (policy.download.adminCanDownloadAll && (await isSystemAdmin(user.id))) return true;
  return false;
}

/** 未登录：仅当应用配置了 file Schema 且 read 含 `$public` 时为 true */
export async function canDownloadFileUnauthenticated(
  file: FilePermissionSubject
): Promise<boolean> {
  if (!file.appId) return false;
  const permStr = await getFileSchemaDefaultPermissions(file.appId);
  if (!permStr) return false;
  return checkRecordPermission(
    permStr,
    null,
    file.appId,
    file.ownerId,
    "read",
    "full"
  );
}

export async function canUseShareToken(): Promise<boolean> {
  const policy = await getFilePolicy();
  return policy.download.allowShareToken;
}
