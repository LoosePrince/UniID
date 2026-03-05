import { prisma } from "./prisma";

/**
 * 解析权限配置中的变量
 * @param perm 权限字符串
 * @param context 上下文信息
 */
function resolvePermissionVariable(
  perm: string,
  context: {
    userId: string;
    ownerId: string | null;
    appId: string;
    appAdmin: boolean;
    systemAdmin: boolean;
  }
): boolean {
  // 系统管理员拥有所有权限
  if (context.systemAdmin) {
    return true;
  }

  // 记录所有者拥有所有权限
  if (context.ownerId === context.userId) {
    return true;
  }

  switch (perm) {
    case "$owner":
      return context.ownerId === context.userId;
    case "$app_admin":
      return context.appAdmin;
    case "$all":
    case "$anyone":
      return true;
    case "$public":
      // 公开权限，所有人可访问
      return true;
    case "$app":
      // 应用自身权限
      return false;
    default:
      // 检查特定用户权限: $user:{id}
      if (perm.startsWith("$user:")) {
        const targetUserId = perm.slice(6);
        return targetUserId === context.userId;
      }
      // 检查特定角色权限: $role:{role}
      if (perm.startsWith("$role:")) {
        // 需要查询用户角色，这里简化处理
        return false;
      }
      // 直接匹配用户ID
      return perm === context.userId;
  }
}

/**
 * 检查用户是否是系统管理员 (role=admin)
 * 系统管理员拥有所有权限
 */
export async function isSystemAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  return user?.role === "admin";
}

/**
 * 检查用户是否是应用管理员
 * 应用管理员拥有等同于 owner_id 的权限
 */
export async function isAppAdmin(appId: string, userId: string): Promise<boolean> {
  const app = await prisma.app.findUnique({
    where: { id: appId }
  });

  if (!app) {
    return false;
  }

  // 检查是否是应用所有者
  if (app.ownerId === userId) {
    return true;
  }

  // 检查是否在 adminIds 列表中
  if (app.adminIds) {
    try {
      const adminIds: string[] = JSON.parse(app.adminIds);
      return adminIds.includes(userId);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * 获取应用的所有管理员 ID 列表（包括 owner）
 */
export async function getAppAdminIds(appId: string): Promise<string[]> {
  const app = await prisma.app.findUnique({
    where: { id: appId }
  });

  if (!app) {
    return [];
  }

  const adminIds: string[] = [];

  // 添加所有者
  if (app.ownerId) {
    adminIds.push(app.ownerId);
  }

  // 添加其他管理员
  if (app.adminIds) {
    try {
      const parsedIds: string[] = JSON.parse(app.adminIds);
      adminIds.push(...parsedIds);
    } catch {
      // 解析失败，忽略
    }
  }

  return [...new Set(adminIds)]; // 去重
}

/**
 * 检查用户对记录是否有指定权限
 * @param permissions 记录的权限配置 JSON 字符串
 * @param userId 当前用户 ID
 * @param appId 应用 ID
 * @param ownerId 记录所有者 ID
 * @param action 操作类型: read, write, delete
 * @param authType 授权类型: full(完整授权) 或 restricted(限制授权)
 */
export async function checkRecordPermission(
  permissions: string,
  userId: string,
  appId: string,
  ownerId: string | null,
  action: "read" | "write" | "delete",
  authType: "full" | "restricted" = "restricted"
): Promise<boolean> {
  // 记录所有者有所有权限
  if (ownerId === userId) {
    return true;
  }

  // 限制授权模式下，只能操作自己的数据
  if (authType === "restricted") {
    return false;
  }

  // 完整授权模式下，检查系统管理员权限
  const systemAdmin = await isSystemAdmin(userId);
  if (systemAdmin) {
    return true;
  }

  // 完整授权模式下，检查应用管理员权限
  const appAdmin = await isAppAdmin(appId, userId);
  if (appAdmin) {
    return true;
  }

  // 解析权限配置
  let permConfig: Record<string, any>;
  try {
    permConfig = JSON.parse(permissions);
  } catch {
    // 默认权限：只有所有者可读写
    return false;
  }

  // 获取当前操作的权限列表
  const actionPerms = permConfig[action] || permConfig.default?.[action];
  if (!Array.isArray(actionPerms)) {
    return false;
  }

  // 检查权限列表
  for (const perm of actionPerms) {
    if (perm === userId) {
      return true;
    }
    if (perm === "$owner" && ownerId === userId) {
      return true;
    }
    if (perm === "$app_admin" && appAdmin) {
      return true;
    }
    if (perm === "$anyone") {
      return true;
    }
  }

  return false;
}

/**
 * 添加应用管理员
 */
export async function addAppAdmin(appId: string, userId: string): Promise<boolean> {
  const app = await prisma.app.findUnique({
    where: { id: appId }
  });

  if (!app) {
    return false;
  }

  let adminIds: string[] = [];
  if (app.adminIds) {
    try {
      adminIds = JSON.parse(app.adminIds);
    } catch {
      adminIds = [];
    }
  }

  // 避免重复添加
  if (adminIds.includes(userId)) {
    return true;
  }

  // 不能添加 owner 为 admin（owner 已经是最高权限）
  if (app.ownerId === userId) {
    return true;
  }

  adminIds.push(userId);

  await prisma.app.update({
    where: { id: appId },
    data: { adminIds: JSON.stringify(adminIds) }
  });

  return true;
}

/**
 * 移除应用管理员
 */
export async function removeAppAdmin(appId: string, userId: string): Promise<boolean> {
  const app = await prisma.app.findUnique({
    where: { id: appId }
  });

  if (!app || !app.adminIds) {
    return false;
  }

  let adminIds: string[] = [];
  try {
    adminIds = JSON.parse(app.adminIds);
  } catch {
    return false;
  }

  const newAdminIds = adminIds.filter(id => id !== userId);

  if (newAdminIds.length === adminIds.length) {
    // 用户不在管理员列表中
    return false;
  }

  await prisma.app.update({
    where: { id: appId },
    data: {
      adminIds: newAdminIds.length > 0 ? JSON.stringify(newAdminIds) : null
    }
  });

  return true;
}

/**
 * 检查用户对特定字段是否有指定权限
 * @param permissions 记录的权限配置 JSON 字符串
 * @param userId 当前用户 ID
 * @param appId 应用 ID
 * @param ownerId 记录所有者 ID
 * @param fieldPath 字段路径，如 "data.title" 或 "data.metadata.comments"
 * @param action 操作类型: read, write, delete
 */
export async function checkFieldPermission(
  permissions: string,
  userId: string,
  appId: string,
  ownerId: string | null,
  fieldPath: string,
  action: "read" | "write" | "delete"
): Promise<boolean> {
  // 记录所有者有所有字段权限
  if (ownerId === userId) {
    return true;
  }

  // 检查系统管理员权限
  const systemAdmin = await isSystemAdmin(userId);
  if (systemAdmin) {
    return true;
  }

  // 检查应用管理员权限
  const appAdmin = await isAppAdmin(appId, userId);
  if (appAdmin) {
    return true;
  }

  // 解析权限配置
  let permConfig: Record<string, any>;
  try {
    permConfig = JSON.parse(permissions);
  } catch {
    // 默认权限：只有所有者可读写
    return false;
  }

  const context = {
    userId,
    ownerId,
    appId,
    appAdmin,
    systemAdmin
  };

  // 1. 检查字段特定权限
  const fieldsConfig = permConfig.fields || {};
  const fieldConfig = fieldsConfig[fieldPath];

  if (fieldConfig && typeof fieldConfig === "object") {
    const actionPerms = fieldConfig[action];
    if (Array.isArray(actionPerms)) {
      for (const perm of actionPerms) {
        if (resolvePermissionVariable(perm, context)) {
          return true;
        }
      }
    }
  }

  // 2. 检查默认权限
  const defaultConfig = permConfig.default || {};
  const defaultActionPerms = defaultConfig[action];
  if (Array.isArray(defaultActionPerms)) {
    for (const perm of defaultActionPerms) {
      if (resolvePermissionVariable(perm, context)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 合并权限配置
 * @param current 当前权限配置
 * @param updates 更新的权限配置
 */
export function mergeFieldPermissions(
  current: Record<string, any>,
  updates: Record<string, any>
): Record<string, any> {
  const merged = { ...current };

  // 合并 default 配置
  if (updates.default) {
    merged.default = { ...merged.default, ...updates.default };
  }

  // 合并 fields 配置
  if (updates.fields) {
    merged.fields = { ...merged.fields };
    for (const [fieldPath, fieldConfig] of Object.entries(updates.fields)) {
      if (merged.fields[fieldPath]) {
        merged.fields[fieldPath] = { ...merged.fields[fieldPath], ...fieldConfig };
      } else {
        merged.fields[fieldPath] = fieldConfig;
      }
    }
  }

  return merged;
}

/**
 * 过滤数据，只返回用户有权限读取的字段
 * @param data 原始数据
 * @param permissions 权限配置
 * @param userId 当前用户 ID
 * @param appId 应用 ID
 * @param ownerId 记录所有者 ID
 */
export async function filterReadableFields(
  data: Record<string, any>,
  permissions: string,
  userId: string,
  appId: string,
  ownerId: string | null
): Promise<Record<string, any>> {
  // 所有者有所有权限
  if (ownerId === userId) {
    return data;
  }

  // 系统管理员或应用管理员有所有权限
  const systemAdmin = await isSystemAdmin(userId);
  if (systemAdmin) return data;

  const appAdmin = await isAppAdmin(appId, userId);
  if (appAdmin) return data;

  // 解析权限配置
  let permConfig: Record<string, any>;
  try {
    permConfig = JSON.parse(permissions);
  } catch {
    // 默认权限：只有所有者可读
    return {};
  }

  const context = {
    userId,
    ownerId,
    appId,
    appAdmin,
    systemAdmin
  };

  const result: Record<string, any> = {};

  // 检查每个顶层字段
  for (const [key, value] of Object.entries(data)) {
    const fieldPath = `data.${key}`;

    // 检查字段特定读权限
    const fieldsConfig = permConfig.fields || {};
    const fieldConfig = fieldsConfig[fieldPath];

    let hasReadPermission = false;

    if (fieldConfig && Array.isArray(fieldConfig.read)) {
      for (const perm of fieldConfig.read) {
        if (resolvePermissionVariable(perm, context)) {
          hasReadPermission = true;
          break;
        }
      }
    }

    // 如果没有字段特定权限，检查默认权限
    if (!hasReadPermission) {
      const defaultConfig = permConfig.default || {};
      const defaultReadPerms = defaultConfig.read;
      if (Array.isArray(defaultReadPerms)) {
        for (const perm of defaultReadPerms) {
          if (resolvePermissionVariable(perm, context)) {
            hasReadPermission = true;
            break;
          }
        }
      }
    }

    if (hasReadPermission) {
      result[key] = value;
    }
  }

  return result;
}
