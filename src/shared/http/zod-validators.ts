import { z } from "zod";

/** CUID-like ID（Prisma default `cuid()` 实际是 cuid v1，宽松 24-32 长度小写字母数字）。 */
export const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_-]+$/i, "ID 含非法字符");

export const dataTypeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/, "dataType 只能含小写字母/数字/_/-");

export const usernameSchema = z
  .string()
  .min(3, "用户名至少 3 位")
  .max(32)
  .regex(/^[a-zA-Z0-9_-]+$/, "用户名只能含字母/数字/_/-");

export const passwordSchema = z.string().min(8, "密码至少 8 位").max(128);

export const emailSchema = z.string().email().optional();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  cursor: z.string().optional()
});

export const domainSchema = z
  .string()
  .min(3)
  .max(253)
  // host[:port]，允许 localhost
  .regex(
    /^(localhost(:\d{1,5})?|((?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,}(:\d{1,5})?)$/,
    "域名格式不合法"
  );

export const cuidSchema = idSchema;
