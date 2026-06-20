/**
 * 统一错误码登记表。分类前缀清晰；新增时按字母序就近放入。
 */
export const ErrorCodes = {
  // AUTH 认证 / 会话
  AUTH_INVALID_CREDENTIALS: { http: 401, message: "用户名或密码错误" },
  AUTH_INVALID_TOKEN: { http: 401, message: "Token 无效或已过期" },
  AUTH_API_KEY_REVOKED: { http: 401, message: "API Key 已被吊销" },
  AUTH_TOKEN_EXPIRED: { http: 401, message: "Token 已过期" },
  AUTH_REFRESH_REUSED: { http: 401, message: "刷新令牌已被使用过，请重新登录" },
  AUTH_SESSION_NOT_FOUND: { http: 401, message: "会话不存在或已撤销" },
  AUTH_SESSION_REVOKED: { http: 401, message: "会话已被撤销" },
  AUTH_AUTHORIZATION_NOT_FOUND: { http: 401, message: "尚未授权该应用" },
  AUTH_AUTHORIZATION_REVOKED: { http: 401, message: "该应用的授权已被撤销" },
  AUTH_AUTHORIZATION_EXPIRED: { http: 401, message: "该应用的授权已过期" },
  AUTH_REGISTER_USERNAME_TAKEN: { http: 409, message: "用户名已被注册" },
  AUTH_REGISTER_EMAIL_TAKEN: { http: 409, message: "邮箱已被注册" },
  AUTH_CHANGE_PASSWORD_INVALID_OLD: { http: 400, message: "原密码不正确" },
  AUTH_EMAIL_ALREADY_VERIFIED: { http: 409, message: "邮箱已完成验证" },
  AUTH_EMAIL_REQUIRED: { http: 400, message: "当前账号未绑定邮箱" },
  AUTH_MFA_INVALID: { http: 401, message: "两步验证码无效" },
  AUTH_MFA_REQUIRED: { http: 401, message: "需要两步验证码" },
  AUTH_PARENT_ORIGIN_REQUIRED: { http: 400, message: "缺少 parent_origin 参数" },
  AUTH_PARENT_ORIGIN_MISMATCH: { http: 403, message: "parent_origin 与应用域名不匹配" },
  AUTH_RESET_TOKEN_INVALID: { http: 401, message: "重置密码链接无效或已过期" },
  AUTH_SAME_ORIGIN_REQUIRED: { http: 403, message: "该接口仅允许同源请求" },

  // APP 应用注册 / 域名
  APP_NOT_FOUND: { http: 404, message: "应用不存在" },
  APP_DOMAIN_TAKEN: { http: 409, message: "域名已被其它应用占用" },
  APP_ORIGIN_MISMATCH: { http: 403, message: "请求来源与应用注册的域名不匹配" },
  APP_FORBIDDEN: { http: 403, message: "无权操作该应用" },
  APP_DOMAIN_INVALID: { http: 400, message: "域名格式不合法" },
  APP_DOMAIN_VERIFY_FAILED: { http: 400, message: "域名验证失败" },

  // DATA 数据记录
  DATA_RECORD_NOT_FOUND: { http: 404, message: "记录不存在" },
  DATA_RECORD_FORBIDDEN: { http: 403, message: "无权访问该记录" },
  DATA_QUERY_LIMIT_EXCEEDED: { http: 400, message: "查询条目超出上限" },
  DATA_QUERY_INVALID: { http: 400, message: "查询条件不合法" },
  DATA_FIELD_NOT_FOUND: { http: 404, message: "字段不存在" },

  // SCHEMA
  SCHEMA_NOT_FOUND: { http: 404, message: "未配置该 dataType 的 Schema" },
  SCHEMA_INVALID: { http: 400, message: "JSON Schema 不合法" },
  SCHEMA_VERSION_CONFLICT: { http: 409, message: "Schema 版本冲突" },
  SCHEMA_REQUIRED: { http: 400, message: "写入前必须先注册 Schema" },

  // POLICY 权限
  POLICY_FORBIDDEN: { http: 403, message: "操作被权限策略拒绝" },
  POLICY_INVALID_DOCUMENT: { http: 400, message: "权限策略文档不合法" },

  // BUSINESS
  BUSINESS_INVALID_RULE: { http: 400, message: "业务规则文档不合法" },
  BUSINESS_WORKFLOW_FORBIDDEN: { http: 403, message: "业务流程状态流转被拒绝" },

  // FILE
  FILE_NOT_FOUND: { http: 404, message: "文件不存在" },
  FILE_TOO_LARGE: { http: 413, message: "文件超过大小上限" },
  FILE_UPLOAD_FAILED: { http: 500, message: "文件上传失败" },
  FILE_FORBIDDEN: { http: 403, message: "无权访问该文件" },
  FILE_SHARE_TOKEN_INVALID: { http: 401, message: "分享 token 无效或已过期" },
  FILE_MULTIPART_INVALID: { http: 400, message: "分片上传参数不合法" },

  // FUNCTION
  FUNC_NOT_FOUND: { http: 404, message: "函数不存在" },
  FUNC_FORBIDDEN: { http: 403, message: "无权调用该函数" },
  FUNC_TIMEOUT: { http: 504, message: "函数执行超时" },
  FUNC_OOM: { http: 507, message: "函数内存超限" },
  FUNC_RUNTIME_ERROR: { http: 500, message: "函数执行抛出异常" },
  FUNC_INVALID_SOURCE: { http: 400, message: "函数代码不合法" },

  // CRON
  CRON_NOT_FOUND: { http: 404, message: "定时任务不存在" },
  CRON_INVALID_EXPR: { http: 400, message: "cron 表达式不合法" },

  // WEBHOOK
  HOOK_NOT_FOUND: { http: 404, message: "Webhook 不存在" },
  HOOK_INVALID_URL: { http: 400, message: "Webhook 地址不合法" },

  // QUOTA / RATE
  QUOTA_EXCEEDED: { http: 429, message: "已超出应用配额" },
  RATE_LIMITED: { http: 429, message: "请求过于频繁" },

  // VALIDATION
  VALIDATION_FAILED: { http: 400, message: "请求参数校验失败" },

  // CORS
  CORS_ORIGIN_REJECTED: { http: 403, message: "Origin 不在允许列表中" },

  // INTERNAL
  INTERNAL_ERROR: { http: 500, message: "服务器内部错误" },
  NOT_IMPLEMENTED: { http: 501, message: "功能尚未实现" }
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
