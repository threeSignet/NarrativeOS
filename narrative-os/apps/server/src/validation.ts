/**
 * 输入校验工具
 * 为关键路由提供基础的参数校验，防止无效输入进入业务逻辑
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 校验是否为合法 UUID，不合法返回错误信息 */
export function validateUUID(value: unknown, fieldName = "id"): string | null {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    return `Invalid UUID for ${fieldName}: ${String(value)}`;
  }
  return null;
}

/** 校验必填字符串字段非空 */
export function validateRequired(value: unknown, fieldName: string): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return `Field "${fieldName}" is required and must be a non-empty string`;
  }
  return null;
}

/** 批量校验，返回第一个错误或 null */
export function validateAll(...checks: (string | null)[]): string | null {
  for (const err of checks) {
    if (err) return err;
  }
  return null;
}
