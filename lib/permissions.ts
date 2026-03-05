import { prisma } from "./prisma";

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
 */
export async function checkRecordPermission(
  permissions: string,
  userId: string,
  appId: string,
  ownerId: string | null,
  action: "read" | "write" | "delete"
): Promise<boolean> {
  // 记录所有者有所有权限
  if (ownerId === userId) {
    return true;
  }

  // 检查是否是系统管理员 (role=admin)
  const systemAdmin = await isSystemAdmin(userId);
  if (systemAdmin) {
    return true;
  }

  // 检查是否是应用管理员
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
