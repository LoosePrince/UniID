import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { prisma } from "./prisma";
import vm from "node:vm";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export interface ValidationResult {
  valid: boolean;
  errors?: ErrorObject[] | string[];
  schemaVersion?: number;
  data?: any; // 返回处理后（如自动填充）的数据
}

const WILDCARD_PARTS = ["$user", "*"];

function isWildcardPart(part: string): boolean {
  return WILDCARD_PARTS.includes(part);
}

/**
 * 对单个路径递归应用自动填充（支持 $user / * 通配：只对已存在的键填充，不创建字面量键）
 */
function applyAutoFillAt(
  current: any,
  pathParts: string[],
  fillType: string,
  context: { userId: string; username?: string; prevData?: any },
  now: number
): void {
  if (pathParts.length === 0) return;

  if (pathParts.length === 1) {
    const lastPart = pathParts[0];
    switch (fillType) {
      case "$serverTime":
        current[lastPart] = now;
        break;
      case "$serverTimeMs":
        current[lastPart] = Date.now();
        break;
      case "$userId":
        current[lastPart] = context.userId;
        break;
      case "$username":
        current[lastPart] = context.username || "unknown";
        break;
      case "$uuid":
        if (!current[lastPart]) {
          current[lastPart] =
            Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
        }
        break;
      case "$prevValue":
        if (context.prevData) {
          let prev = context.prevData;
          for (const part of pathParts) {
            prev = prev?.[part];
          }
          current[lastPart] = prev;
        }
        break;
    }
    return;
  }

  const part = pathParts[0];
  const rest = pathParts.slice(1);

  if (isWildcardPart(part)) {
    // 通配符：只对已存在的键遍历，不创建 $user / * 字面量
    if (current != null && typeof current === "object" && !Array.isArray(current)) {
      for (const key of Object.keys(current)) {
        applyAutoFillAt(current[key], rest, fillType, context, now);
      }
    }
    return;
  }

  // 普通路径：导航并创建中间对象（仅非通配段）
  if (current[part] === undefined) {
    current[part] = {};
  }
  applyAutoFillAt(current[part], rest, fillType, context, now);
}

/**
 * 后端自动填充变量
 * 路径中的 $user、* 视为通配符：只对已有键应用填充，不创建 comments["$user"]["*"] 等无效结构。
 * @param data 当前数据
 * @param schemaObj Schema 对象（包含 autoFill 配置）
 * @param context 上下文信息 (userId, username, prevData)
 */
export function applyAutoFill(
  data: any,
  schemaObj: any,
  context: { userId: string; username?: string; prevData?: any }
): any {
  if (!schemaObj.autoFill || typeof schemaObj.autoFill !== "object") {
    return data;
  }

  const newData = JSON.parse(JSON.stringify(data));
  const now = Math.floor(Date.now() / 1000);

  for (const [fieldPath, fillType] of Object.entries(schemaObj.autoFill)) {
    const pathParts = fieldPath.split(".");
    applyAutoFillAt(newData, pathParts, fillType as string, context, now);
  }

  return newData;
}

/**
 * 在沙箱环境中执行自定义验证规则
 * @param data 要验证的数据
 * @param rules 自定义验证规则 (JS 代码字符串)
 * @returns 验证结果: true 或 错误消息字符串
 */
async function runCustomValidation(data: any, rules: string): Promise<true | string> {
  // 创建一个隔离的上下文
  const context = {
    data: JSON.parse(JSON.stringify(data)), // 深拷贝以防止副作用
    result: null as any,
    error: null as any,
    console: {
      log: (...args: any[]) => console.log("[Sandbox Log]:", ...args),
      error: (...args: any[]) => console.error("[Sandbox Error]:", ...args)
    }
  };

  vm.createContext(context);

  // 包装代码以支持 return 语句并捕获结果
  // 使用同步包装以确保可靠性，并设置执行超时时间以防止死循环
  const wrappedCode = `
    try {
      const validate = (data) => {
        ${rules}
      };
      result = validate(data);
    } catch (e) {
      error = e.message;
    }
  `;

  try {
    const script = new vm.Script(wrappedCode);
    // 设置执行超时时间为 100ms
    script.runInContext(context, { timeout: 100 });

    if (context.error) {
      return `Custom validation runtime error: ${context.error}`;
    }

    // 验证逻辑：返回 true 表示通过，返回字符串表示错误消息，其他值表示失败
    if (context.result === true) {
      return true;
    } else if (typeof context.result === "string") {
      return context.result;
    } else {
      return "Custom validation failed (rule did not return true)";
    }
  } catch (e: any) {
    if (e.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") {
      return "Custom validation timeout (max 100ms)";
    }
    return `Custom validation script error: ${e.message}`;
  }
}

/**
 * 验证数据是否符合指定的 Schema
 * @param appId 应用 ID
 * @param dataType 数据类型
 * @param data 要验证的数据
 * @param context 可选上下文（用于自动填充）
 * @returns 验证结果
 */
export async function validateData(
  appId: string,
  dataType: string,
  data: any,
  context?: { userId: string; username?: string; prevData?: any }
): Promise<ValidationResult> {
  // 1. 获取最新的活跃 Schema
  const activeSchema = await (prisma as any).dataSchema.findFirst({
    where: {
      appId,
      dataType,
      isActive: 1
    },
    orderBy: {
      version: "desc"
    }
  });

  // 2. 如果没有定义 Schema，视为不符合规则，拒绝存入
  if (!activeSchema) {
    return {
      valid: false,
      errors: [`No active schema defined for data type: ${dataType}. Please register a schema first via POST /api/schema/${appId}/${dataType}`]
    };
  }

  // 3. 执行 JSON Schema 验证
  try {
    const schemaObj = JSON.parse(activeSchema.schema);
    
    // 3.1 应用自动填充 (如果提供了上下文)
    let processedData = data;
    if (context) {
      processedData = applyAutoFill(data, schemaObj, context);
    }

    const validate = ajv.compile(schemaObj);
    const valid = validate(processedData);

    if (!valid) {
      return {
        valid: false,
        errors: validate.errors || ["Unknown validation error"],
        schemaVersion: activeSchema.version,
        data: processedData
      };
    }

    // 4. 执行自定义验证规则 (如果存在)
    if (activeSchema.validationRules) {
      const customResult = await runCustomValidation(processedData, activeSchema.validationRules);
      
      if (customResult !== true) {
        return {
          valid: false,
          errors: [customResult],
          schemaVersion: activeSchema.version,
          data: processedData
        };
      }
    }

    return {
      valid: true,
      schemaVersion: activeSchema.version,
      data: processedData
    };
  } catch (e: any) {
    return {
      valid: false,
      errors: [`Schema compilation or execution error: ${e.message}`],
      schemaVersion: activeSchema.version
    };
  }
}
