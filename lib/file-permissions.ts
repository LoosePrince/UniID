import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSystemAdmin } from "@/lib/permissions";

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

export async function canUpload(user: User): Promise<boolean> {
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

export async function canDeleteFile(file: { ownerId: string }, user: User): Promise<boolean> {
  const policy = await getFilePolicy();
  if (policy.delete.ownerCanDelete && file.ownerId === user.id) return true;
  if (policy.delete.adminCanManageAll && (await isSystemAdmin(user.id))) return true;
  return false;
}

export async function canDownloadFile(file: { ownerId: string }, user: User): Promise<boolean> {
  const policy = await getFilePolicy();
  if (!policy.download.ownerOnly) return true;
  if (file.ownerId === user.id) return true;
  if (policy.download.adminCanDownloadAll && (await isSystemAdmin(user.id))) return true;
  return false;
}

export async function canUseShareToken(): Promise<boolean> {
  const policy = await getFilePolicy();
  return policy.download.allowShareToken;
}
