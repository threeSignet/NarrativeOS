/**
 * Pipeline 共享工具函数
 * 跨模块使用的通用辅助函数，避免重复定义
 */

/**
 * 在候选名称中做模糊匹配
 * 返回最佳匹配及其置信度（0-3），未匹配返回 null
 *
 * 置信度：
 * - 3: 精确匹配（忽略大小写和首尾空白）
 * - 2: 候选名以目标名开头 或 目标名以候选名开头
 * - 1: 互相包含
 */
export function fuzzyMatchInCandidates(
  name: string,
  candidates: string[]
): { name: string; confidence: number } | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;

  let best: { name: string; confidence: number } | null = null;

  for (const candidate of candidates) {
    const candLower = candidate.trim().toLowerCase();
    if (candLower === target) return { name: candidate.trim(), confidence: 3 };

    let confidence = 0;
    if (candLower.startsWith(target)) confidence = 3;
    else if (target.startsWith(candLower)) confidence = 2;
    else if (candLower.includes(target) || target.includes(candLower)) confidence = 1;

    if (confidence > (best?.confidence || 0)) {
      best = { name: candidate.trim(), confidence };
    }
  }

  return best;
}
