/**
 * 动态权限 $dynamic:{path} 评估。
 *
 * 用法：
 *   "$dynamic:likes.$user"
 *     仅允许 likes 下以当前 userId 为键的子节点变化
 *
 *   "$dynamic:comments.$user.userId"
 *     不仅键必须等于 userId，且值（必须是对象）的 userId 字段也必须等于 userId
 *
 * 实现要点：
 *   - 仅对发生变化（新增 / 修改 / 删除）的键校验
 *   - $user 段强制等于当前 userId
 *   - * 段允许任意键
 *   - 路径片段超过 2 时，剩余路径段须能在新增/变更值上"路由"到 userId
 */

export interface DynamicCheckInput {
  /** 完整权限字符串（含 $dynamic: 前缀） */
  perm: string;
  /** 当前字段路径（用 . 分割），例如 "data.likes" */
  fieldPath: string;
  /** 当前字段的新值（提交方） */
  dataValue: unknown;
  /** 该字段当前持久化值（用于 diff） */
  currentValue: unknown;
  /** 当前用户 id */
  userId: string;
}

function shallowEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function checkValueAtPath(value: unknown, path: string[], userId: string): boolean {
  if (path.length === 0) return value === userId;
  const head = path[0];
  if (head === undefined) return false;
  const rest = path.slice(1);

  if (value == null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;

  if (head === "*") {
    for (const k of Object.keys(obj)) {
      if (!checkValueAtPath(obj[k], rest, userId)) return false;
    }
    return true;
  }
  if (head === "$user") {
    // $user 在中间段不绑定键，只递归到下层。常规用法是放结尾。
    return checkValueAtPath(value, rest, userId);
  }
  return checkValueAtPath(obj[head], rest, userId);
}

function keyMatches(key: string, segment: string, userId: string): boolean {
  if (segment === "$user") return key === userId;
  if (segment === "*") return true;
  return key === segment;
}

export function checkDynamicPermission(input: DynamicCheckInput): boolean {
  if (!input.perm.startsWith("$dynamic:")) return false;

  const dynamicPath = input.perm.slice("$dynamic:".length);
  const parts = dynamicPath.split(".");

  // 第一段必须等于 fieldPath 最末段（与原实现一致：把整段路径绑到当前字段）
  // 兼容：当 fieldPath = "data.likes"，dynamicPath = "likes.$user" 时，parts[0] = "likes"
  const fieldLast = input.fieldPath.split(".").pop();
  if (parts[0] !== fieldLast) return false;

  // 只允许对象/数组容器
  const next = input.dataValue;
  if (next == null || typeof next !== "object") return false;

  const segment = parts[1] ?? "$user";
  const valueChecker = parts.length > 2 ? parts.slice(2) : null;

  const currentObj =
    input.currentValue && typeof input.currentValue === "object"
      ? (input.currentValue as Record<string, unknown>)
      : {};

  const nextObj = Array.isArray(next)
    ? Object.fromEntries(next.map((v, i) => [String(i), v]))
    : (next as Record<string, unknown>);

  const allKeys = new Set([...Object.keys(currentObj), ...Object.keys(nextObj)]);

  for (const key of allKeys) {
    const before = currentObj[key];
    const after = nextObj[key];

    if (shallowEq(before, after)) continue; // 未变更

    if (!keyMatches(key, segment, input.userId)) return false;

    // 删除（after undefined）只需键校验即可，无需值路径校验
    if (after === undefined) continue;

    if (valueChecker) {
      if (!checkValueAtPath(after, valueChecker, input.userId)) return false;
    }
  }

  return true;
}
