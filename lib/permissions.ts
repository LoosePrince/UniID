import { prisma } from "./prisma";

/**
 * 检查用户是否具有指定角色
 * @param userId 用户ID
 * @param role 角色名称
 * @returns 是否具有该角色
 */
async function checkUserRole(userId: string, role: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  return user?.role === role;
}

/**
 * 解析权限配置中的变量（异步版本）
 * @param perm 权限字符串
 * @param context 上下文信息
 */
async function resolvePermissionVariableAsync(
  perm: string,
  context: {
    userId: string;
    ownerId: string | null;
    appId: string;
    appAdmin: boolean;
    systemAdmin: boolean;
  }
): Promise<boolean> {
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
      // 应用管理员权限
      return context.appAdmin;
    default:
      // 检查特定用户权限: $user:{id}
      if (perm.startsWith("$user:")) {
        const targetUserId = perm.slice(6);
        return targetUserId === context.userId;
      }
      // 检查特定角色权限: $role:{role}
      if (perm.startsWith("$role:")) {
        const targetRole = perm.slice(6);
        return await checkUserRole(context.userId, targetRole);
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
    where: { id: appId },
    select: { ownerId: true }
  });

  if (!app) {
    return false;
  }

  // 检查是否是应用所有者
  if (app.ownerId === userId) {
    return true;
  }

  // 检查是否在 AppAdmin 表中
  const admin = await prisma.appAdmin.findUnique({
    where: {
      appId_userId: {
        appId,
        userId
      }
    }
  });

  return !!admin;
}

/**
 * 获取应用的所有管理员 ID 列表（包括 owner）
 */
export async function getAppAdminIds(appId: string): Promise<string[]> {
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: {
      admins: {
        select: { userId: true }
      }
    }
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
  if (app.admins) {
    adminIds.push(...app.admins.map(a => a.userId));
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
  userId: string | null,
  appId: string,
  ownerId: string | null,
  action: "read" | "write" | "delete",
  authType: "full" | "restricted" = "restricted"
): Promise<boolean> {
  // 未登录用户只能访问公开权限
  if (!userId) {
    // 解析权限配置，检查是否有 $public 权限
    let permConfig: Record<string, any>;
    try {
      permConfig = JSON.parse(permissions);
    } catch {
      return false;
    }

    const actionPerms = permConfig[action] || permConfig.default?.[action];
    if (Array.isArray(actionPerms)) {
      for (const perm of actionPerms) {
        if (perm === "$public") {
          return true;
        }
      }
    }
    return false;
  }

  // 记录所有者有所有权限
  if (ownerId === userId) {
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

  // 检查公开权限（所有模式都适用）
  for (const perm of actionPerms) {
    if (perm === "$all" || perm === "$anyone" || perm === "$public") {
      return true;
    }
  }

  // 限制授权模式下，只能访问自己的数据或公开数据
  // 不再检查管理员权限和特定用户权限
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

  const context = {
    userId,
    ownerId,
    appId,
    appAdmin,
    systemAdmin
  };

  // 完整授权模式下，检查其他权限（包括 $role:{role}）
  for (const perm of actionPerms) {
    if (perm === userId) {
      return true;
    }
    if (await resolvePermissionVariableAsync(perm, context)) {
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

  // 不能添加 owner 为 admin（owner 已经是最高权限）
  if (app.ownerId === userId) {
    return true;
  }

  await prisma.appAdmin.upsert({
    where: {
      appId_userId: {
        appId,
        userId
      }
    },
    update: {},
    create: {
      appId,
      userId,
      createdAt: Math.floor(Date.now() / 1000)
    }
  });

  return true;
}

/**
 * 移除应用管理员
 */
export async function removeAppAdmin(appId: string, userId: string): Promise<boolean> {
  try {
    await prisma.appAdmin.delete({
      where: {
        appId_userId: {
          appId,
          userId
        }
      }
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 匹配字段路径（支持通配符 *）
 * @param pattern 权限配置中的路径模式，如 "likes.*.time"
 * @param fieldPath 实际的字段路径，如 "likes.user123.time"
 * @returns 是否匹配
 */
function matchFieldPath(pattern: string, fieldPath: string): boolean {
  const patternParts = pattern.split('.');
  const pathParts = fieldPath.split('.');
  
  // 如果模式以 * 结尾，匹配任意后缀
  if (patternParts[patternParts.length - 1] === '*') {
    // 去掉 * 后比较前缀
    const prefixPattern = patternParts.slice(0, -1);
    const prefixPath = pathParts.slice(0, prefixPattern.length);
    
    if (prefixPattern.length > pathParts.length) {
      return false;
    }
    
    for (let i = 0; i < prefixPattern.length; i++) {
      if (prefixPattern[i] !== '*' && prefixPattern[i] !== prefixPath[i]) {
        return false;
      }
    }
    return true;
  }
  
  // 精确匹配长度
  if (patternParts.length !== pathParts.length) {
    return false;
  }
  
  // 逐部分匹配，* 匹配任意值
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] !== '*' && patternParts[i] !== pathParts[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * 查找字段权限（支持继承和覆盖）
 * 子级覆盖父级，最长匹配优先
 * @param fieldsConfig 字段权限配置
 * @param fieldPath 字段路径
 * @param action 操作类型
 * @returns 权限列表或 null
 */
function findFieldPermission(
  fieldsConfig: Record<string, any>,
  fieldPath: string,
  action: string
): string[] | null {
  // 收集所有匹配的模式
  const matches: { pattern: string; depth: number; perms: string[] }[] = [];
  
  for (const [pattern, config] of Object.entries(fieldsConfig)) {
    if (matchFieldPath(pattern, fieldPath)) {
      const actionPerms = config?.[action];
      if (Array.isArray(actionPerms)) {
        matches.push({
          pattern,
          depth: pattern.split('.').length,
          perms: actionPerms
        });
      }
    }
  }
  
  if (matches.length === 0) {
    return null;
  }
  
  // 按深度降序排序，最深的（最具体的）优先
  matches.sort((a, b) => b.depth - a.depth);
  
  // 返回最具体的匹配
  return matches[0].perms;
}

/**
 * 检查动态路径权限
 */
function checkDynamicPermission(
  perm: string,
  fieldPath: string,
  dataValue: any,
  userId: string,
  currentValue?: any
): boolean {
  if (!perm.startsWith("$dynamic:")) {
    return false;
  }

  // 解析动态路径，如 "likes.$user" 或 "comments.$user" 或 "comments.$user.userId"
  const dynamicPath = perm.slice(9); // 去掉 "$dynamic:" 前缀
  const pathParts = dynamicPath.split(".");

  // 第一个部分应该是字段名
  if (pathParts[0] !== fieldPath) {
    return false;
  }

  // 如果数据不是对象，无法检查
  if (dataValue == null || typeof dataValue !== "object") {
    return false;
  }

  // 只检查新增、变更或删除的键
  const secondPart = pathParts[1];
  const currentKeys = currentValue && typeof currentValue === "object" ? Object.keys(currentValue) : [];
  const newKeys = Object.keys(dataValue);

  // 检查新增或变更的键
  for (const key of newKeys) {
    // 跳过未变更的键（值相同）
    if (currentKeys.includes(key) && JSON.stringify(currentValue[key]) === JSON.stringify(dataValue[key])) {
      continue;
    }

    let matches = false;

    if (secondPart === "$user") {
      // 键必须等于当前用户ID
      matches = key === userId;
    } else if (secondPart === "*") {
      // 通配符，匹配任意值
      matches = true;
    } else {
      // 固定值匹配
      matches = key === secondPart;
    }

    if (!matches) {
      return false;
    }

    // 增强安全性：如果路径包含第三层（如 comments.$user.userId），
    // 强制要求 dataValue[key].userId === userId
    if (pathParts.length > 2) {
      const remainingPath = pathParts.slice(2);
      if (!checkValueAgainstPath(dataValue[key], remainingPath, userId)) {
        return false;
      }
    }
  }

  // 检查删除的键（在当前值中存在但在新值中不存在）
  for (const key of currentKeys) {
    if (!newKeys.includes(key)) {
      let matches = false;

      if (secondPart === "$user") {
        // 键必须等于当前用户ID
        matches = key === userId;
      } else if (secondPart === "*") {
        // 通配符，匹配任意值
        matches = true;
      } else {
        // 固定值匹配
        matches = key === secondPart;
      }

      if (!matches) {
        return false;
      }
    }
  }

  return true;
}

/**
 * 检查值是否符合路径约束（增强安全性）
 */
function checkValueAgainstPath(data: any, path: string[], expectedValue: string): boolean {
  if (path.length === 0) {
    return data === expectedValue;
  }

  if (data == null || typeof data !== "object") {
    return false;
  }

  const part = path[0];
  const remaining = path.slice(1);

  if (part === "*") {
    // 如果是通配符，检查所有键
    for (const key of Object.keys(data)) {
      if (!checkValueAgainstPath(data[key], remaining, expectedValue)) {
        return false;
      }
    }
    return true;
  } else if (part === "$user") {
    return checkValueAgainstPath(data, remaining, expectedValue); 
  } else {
    // 固定键匹配
    return checkValueAgainstPath(data[part], remaining, expectedValue);
  }
}

export async function checkFieldPermission(
  permissions: string,
  userId: string,
  appId: string,
  ownerId: string | null,
  fieldPath: string,
  action: "read" | "write" | "delete" | "create" | "update" | "increment" | "push",
  authType: "full" | "restricted" = "restricted",
  dataValue?: any,
  currentValue?: any
): Promise<boolean> {
  // 记录所有者有所有字段权限
  if (ownerId === userId) {
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

  // 1. 使用新的权限查找逻辑（支持通配符和继承）
  const fieldsConfig = permConfig.fields || {};
  
  // 查找字段特定权限（支持通配符匹配，子级覆盖父级）
  const fieldActionPerms = findFieldPermission(fieldsConfig, fieldPath, action);
  
  // 兼容旧的 write 权限
  let effectiveActionPerms = fieldActionPerms;
  if (!effectiveActionPerms && ["create", "update", "increment", "push"].includes(action)) {
    effectiveActionPerms = findFieldPermission(fieldsConfig, fieldPath, "write");
  }
  
  if (effectiveActionPerms) {
    for (const perm of effectiveActionPerms) {
      if (perm === "$all" || perm === "$anyone" || perm === "$public") {
        return true;
      }
      // 检查动态权限
      if (perm.startsWith("$dynamic:") && dataValue !== undefined) {
        if (checkDynamicPermission(perm, fieldPath, dataValue, userId, currentValue)) {
          return true;
        }
      }
    }
  }

  // 2. 检查默认权限中的公开权限
  const defaultConfig = permConfig.default || {};
  let defaultActionPerms = defaultConfig[action];
  
  if (!Array.isArray(defaultActionPerms) && ["create", "update", "increment", "push"].includes(action)) {
    defaultActionPerms = defaultConfig["write"];
  }

  if (Array.isArray(defaultActionPerms)) {
    for (const perm of defaultActionPerms) {
      if (perm === "$all" || perm === "$anyone" || perm === "$public") {
        return true;
      }
    }
  }

  // 限制授权模式
  if (authType === "restricted") {
    if (fieldActionPerms && dataValue !== undefined) {
      for (const perm of fieldActionPerms) {
        if (perm.startsWith("$dynamic:")) {
          if (checkDynamicPermission(perm, fieldPath, dataValue, userId, currentValue)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // 完整授权模式
  const systemAdmin = await isSystemAdmin(userId);
  if (systemAdmin) return true;

  const appAdmin = await isAppAdmin(appId, userId);
  if (appAdmin) return true;

  const context = { userId, ownerId, appId, appAdmin, systemAdmin };

  // 3. 完整授权模式下，检查字段特定权限
  if (effectiveActionPerms) {
    for (const perm of effectiveActionPerms) {
      if (await resolvePermissionVariableAsync(perm, context)) {
        return true;
      }
    }
  }

  // 4. 完整授权模式下，检查默认权限
  if (Array.isArray(defaultActionPerms)) {
    for (const perm of defaultActionPerms) {
      if (await resolvePermissionVariableAsync(perm, context)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 合并权限配置
 */
export function mergeFieldPermissions(
  current: Record<string, any>,
  updates: Record<string, any>
): Record<string, any> {
  const merged: Record<string, any> = { ...current };

  if (updates.default) {
    const currentDefault = (merged.default ?? {}) as Record<string, any>;
    const updatesDefault = updates.default as Record<string, any>;
    merged.default = { ...currentDefault, ...updatesDefault };
  }

  if (updates.fields) {
    const currentFields = (merged.fields ?? {}) as Record<string, Record<string, any>>;
    const updatesFields = updates.fields as Record<string, Record<string, any>>;

    const newFields: Record<string, Record<string, any>> = { ...currentFields };

    for (const [fieldPath, fieldConfig] of Object.entries(updatesFields)) {
      const existingConfig = newFields[fieldPath] ?? {};
      newFields[fieldPath] = { ...existingConfig, ...fieldConfig };
    }

    merged.fields = newFields;
  }

  return merged;
}

/**
 * 过滤数据，只返回用户有权限读取的字段
 */
export async function filterReadableFields(
  data: Record<string, any>,
  permissions: string,
  userId: string | null,
  appId: string,
  ownerId: string | null
): Promise<Record<string, any>> {
  if (ownerId === userId && userId !== null) {
    return data;
  }

  const systemAdmin = userId ? await isSystemAdmin(userId) : false;
  if (systemAdmin) return data;

  const appAdmin = userId ? await isAppAdmin(appId, userId) : false;
  if (appAdmin) return data;

  let permConfig: Record<string, any>;
  try {
    permConfig = JSON.parse(permissions);
  } catch {
    return {};
  }

  const context = {
    userId: userId || "",
    ownerId,
    appId,
    appAdmin,
    systemAdmin
  };

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const fieldPath = `data.${key}`;
    const fieldsConfig = permConfig.fields || {};
    
    // 使用 findFieldPermission 支持通配符
    const fieldReadPerms = findFieldPermission(fieldsConfig, fieldPath, "read");

    let hasReadPermission = false;

    if (Array.isArray(fieldReadPerms)) {
      for (const perm of fieldReadPerms) {
        if (userId === null) {
          if (perm === "$public") {
            hasReadPermission = true;
            break;
          }
        } else if (await resolvePermissionVariableAsync(perm, context)) {
          hasReadPermission = true;
          break;
        }
      }
    }

    if (!hasReadPermission) {
      const defaultConfig = permConfig.default || {};
      const defaultReadPerms = defaultConfig.read;
      if (Array.isArray(defaultReadPerms)) {
        for (const perm of defaultReadPerms) {
          if (userId === null) {
            if (perm === "$public") {
              hasReadPermission = true;
              break;
            }
          } else if (await resolvePermissionVariableAsync(perm, context)) {
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

/**
 * 获取合并后的有效权限
 */
export function getEffectivePermissions(
  defaultPermissions: string | null,
  permissionOverride: string | null
): string {
  const base = defaultPermissions 
    ? JSON.parse(defaultPermissions) 
    : { default: { read: ["$owner", "$app_admin"], write: ["$owner"], delete: ["$owner"] } };
    
  if (!permissionOverride) return JSON.stringify(base);
  
  try {
    return JSON.stringify(mergeFieldPermissions(base, JSON.parse(permissionOverride)));
  } catch {
    return JSON.stringify(base);
  }
}

/**
 * 检查授权作用域
 */
export function checkAuthorizationScope(
  scope: string | null,
  action: "read" | "write" | "delete",
  dataType: string
): boolean {
  if (!scope) return true; 
  
  try {
    const { actions, dataTypes } = JSON.parse(scope);
    if (actions && Array.isArray(actions) && !actions.includes(action)) return false;
    if (dataTypes && Array.isArray(dataTypes) && !dataTypes.includes(dataType)) return false;
    return true;
  } catch {
    return true; // 解析失败默认允许
  }
}
