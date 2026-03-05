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
        return checkUserRole(context.userId, targetRole);
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
 * 检查用户对特定字段是否有指定权限
 * @param permissions 记录的权限配置 JSON 字符串
 * @param userId 当前用户 ID
 * @param appId 应用 ID
 * @param ownerId 记录所有者 ID
 * @param fieldPath 字段路径，如 "data.title" 或 "data.metadata.comments"
 * @param action 操作类型: read, write, delete
 */
/**
 * 检查动态路径权限
 * @param perm 权限字符串，如 "$dynamic:likes.$user"
 * @param fieldPath 字段路径，如 "likes"
 * @param dataValue 要写入的数据
 * @param userId 当前用户ID
 * @param currentValue 当前数据（用于比较变更）
 * @returns 是否有权限
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

  // 解析动态路径，如 "likes.$user" 或 "comments.$user"
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
  // 对于 $dynamic:likes.$user，检查 dataValue 中相对于 currentValue 新增、变更或删除的键
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

    // 如果有第三层（如 comments.$user.*），递归检查
    if (pathParts.length > 2) {
      const hasPermission = checkDynamicPath(dataValue[key], pathParts, 2, userId);
      if (!hasPermission) {
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
 * 递归检查动态路径（用于嵌套结构）
 * @param data 当前数据
 * @param pathParts 路径部分数组
 * @param index 当前检查的路径索引
 * @param userId 当前用户ID
 * @returns 是否有权限
 */
function checkDynamicPath(
  data: any,
  pathParts: string[],
  index: number,
  userId: string
): boolean {
  // 如果已经检查完所有路径部分，说明有权限
  if (index >= pathParts.length) {
    return true;
  }

  // 如果数据不是对象，无法继续检查
  if (data == null || typeof data !== "object") {
    return false;
  }

  const part = pathParts[index];

  // 检查数据中的每个键
  for (const key of Object.keys(data)) {
    let matches = false;

    if (part === "$user") {
      // 键必须等于当前用户ID
      matches = key === userId;
    } else if (part === "*") {
      // 通配符，匹配任意值
      matches = true;
    } else {
      // 固定值匹配
      matches = key === part;
    }

    if (!matches) {
      return false;
    }

    // 递归检查下一层
    const hasPermission = checkDynamicPath(data[key], pathParts, index + 1, userId);
    if (!hasPermission) {
      return false;
    }
  }

  return true;
}

export async function checkFieldPermission(
  permissions: string,
  userId: string,
  appId: string,
  ownerId: string | null,
  fieldPath: string,
  action: "read" | "write" | "delete",
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
  
  if (fieldActionPerms) {
    for (const perm of fieldActionPerms) {
      if (perm === "$all" || perm === "$anyone" || perm === "$public") {
        return true;
      }
      // 检查动态权限（如果有数据值）
      if (perm.startsWith("$dynamic:") && dataValue !== undefined) {
        if (checkDynamicPermission(perm, fieldPath, dataValue, userId, currentValue)) {
          return true;
        }
      }
    }
  }

  // 2. 检查默认权限中的公开权限（所有模式都适用）
  const defaultConfig = permConfig.default || {};
  const defaultActionPerms = defaultConfig[action];
  if (Array.isArray(defaultActionPerms)) {
    for (const perm of defaultActionPerms) {
      if (perm === "$all" || perm === "$anyone" || perm === "$public") {
        return true;
      }
    }
  }

  // 限制授权模式下，只能访问自己的数据或公开数据
  // 但动态权限在 restricted 模式下也应该被检查
  if (authType === "restricted") {
    // 再次检查动态权限（如果有数据值）
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

  // 3. 完整授权模式下，检查字段特定权限（使用异步版本以支持 $role）
  // 使用新的权限查找逻辑（支持通配符和继承）
  if (fieldActionPerms) {
    for (const perm of fieldActionPerms) {
      if (await resolvePermissionVariableAsync(perm, context)) {
        return true;
      }
    }
  }

  // 4. 完整授权模式下，检查默认权限（使用异步版本以支持 $role）
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
        if (await resolvePermissionVariableAsync(perm, context)) {
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
          if (await resolvePermissionVariableAsync(perm, context)) {
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
