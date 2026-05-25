/**
 * 权限变量解析。
 *
 * 静态变量：
 *   $public          所有人（含未登录）
 *   $all / $anyone   所有已认证用户
 *   $owner           记录所有者
 *   $app_admin       应用管理员
 *   $system_admin    系统管理员（role=admin）
 *   $user:{id}       指定用户
 *   $role:{role}     指定角色
 *
 * 动态变量（含数据相关上下文）：
 *   $dynamic:{path}  动态路径，{path} 中的 $user 代表当前用户 id（由 dynamic.ts 处理）
 *   $function:{fnName}  当前请求由该函数发起（Functions 沙箱使用）
 */

export interface AuthContext {
  /** 当前用户 ID；未登录为 null */
  userId: string | null;
  /** 当前用户角色（user / admin / ...） */
  role: string | null;
  /** 是否系统管理员（role=admin） */
  systemAdmin: boolean;
  /** 是否是应用管理员（或 owner） */
  appAdmin: boolean;
  /** 当前应用 ID */
  appId: string;
  /** 当前授权类型：full | restricted */
  authType: "full" | "restricted";
  /** 资源 owner ID（记录/文件） */
  ownerId: string | null;
  /** 调用上下文：sdk | function | system */
  origin: "sdk" | "function" | "system";
  /** Functions 沙箱执行时携带 */
  functionName?: string;
}

export type VariableResult = "match" | "no-match" | "dynamic";

/**
 * 解析非动态变量；动态权限（$dynamic:） 留给 dynamic.ts 单独处理。
 *
 * 返回值：
 *   "match"     已确定匹配
 *   "no-match"  已确定不匹配
 *   "dynamic"   需要 dynamic.ts 在数据级再校验
 */
export function evaluateStaticVariable(perm: string, ctx: AuthContext): VariableResult {
  if (perm === "$public") return "match";

  if (ctx.userId == null) {
    // 未登录除 $public 外一律拒绝（动态变量需要 userId 也走 no-match）
    return "no-match";
  }

  switch (perm) {
    case "$all":
    case "$anyone":
      return "match";
    case "$owner":
      return ctx.ownerId === ctx.userId ? "match" : "no-match";
    case "$app_admin":
      return ctx.appAdmin ? "match" : "no-match";
    case "$system_admin":
      return ctx.systemAdmin ? "match" : "no-match";
  }

  if (perm.startsWith("$user:")) {
    return perm.slice("$user:".length) === ctx.userId ? "match" : "no-match";
  }

  if (perm.startsWith("$role:")) {
    return ctx.role === perm.slice("$role:".length) ? "match" : "no-match";
  }

  if (perm.startsWith("$function:")) {
    if (ctx.origin !== "function" || !ctx.functionName) return "no-match";
    return ctx.functionName === perm.slice("$function:".length) ? "match" : "no-match";
  }

  if (perm.startsWith("$dynamic:")) {
    return "dynamic";
  }

  // 字符串直接匹配 userId（向后保留 lib/permissions.ts 行为）
  return perm === ctx.userId ? "match" : "no-match";
}
