/**
 * 字段路径通配符匹配。
 *
 * - "*" 匹配单层任意键
 * - 末尾 "*" 匹配任意后缀（包括空）
 * - 子级（更深 / 更具体）覆盖父级
 *
 * 例：
 *   pattern "data.likes.*.time" matches "data.likes.userA.time"
 *   pattern "data.likes.*"      matches "data.likes.userA"  and "data.likes.userA.time"
 *   pattern "*"                 matches single segment
 */

export function matchFieldPath(pattern: string, fieldPath: string): boolean {
  const patternParts = pattern.split(".");
  const pathParts = fieldPath.split(".");
  const lastIdx = patternParts.length - 1;

  // 末尾 "*" 视为「任意后缀」（包含 0 段及多段）
  if (patternParts[lastIdx] === "*") {
    const prefix = patternParts.slice(0, lastIdx);
    if (pathParts.length < prefix.length) return false;
    for (let i = 0; i < prefix.length; i++) {
      const p = prefix[i];
      const v = pathParts[i];
      if (p === undefined || v === undefined) return false;
      if (p !== "*" && p !== v) return false;
    }
    return true;
  }

  if (patternParts.length !== pathParts.length) return false;
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    const v = pathParts[i];
    if (p === undefined || v === undefined) return false;
    if (p !== "*" && p !== v) return false;
  }
  return true;
}

/** 找到最具体（最长）匹配的字段权限块；返回 null 表示无匹配。 */
export function findMostSpecificFieldMatch<T>(
  fieldsConfig: Record<string, T>,
  fieldPath: string
): { pattern: string; value: T } | null {
  let best: { pattern: string; value: T; depth: number } | null = null;

  for (const [pattern, value] of Object.entries(fieldsConfig)) {
    if (!matchFieldPath(pattern, fieldPath)) continue;
    const depth = pattern.split(".").length - (pattern.endsWith(".*") ? 1 : 0);
    if (!best || depth > best.depth) {
      best = { pattern, value, depth };
    }
  }
  return best ? { pattern: best.pattern, value: best.value } : null;
}
