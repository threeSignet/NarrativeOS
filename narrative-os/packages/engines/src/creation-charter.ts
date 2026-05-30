// narrative-os/packages/engines/src/creation-charter.ts
import { db, projects } from "@narrative-os/database";
import { eq } from "drizzle-orm";
import type { CreationCharter } from "./types";

export async function loadCreationCharter(projectId: string): Promise<CreationCharter | null> {
  const [project] = await db
    .select({ creationCharter: projects.creationCharter })
    .from(projects)
    .where(eq(projects.id, projectId));
  return (project?.creationCharter as CreationCharter) || null;
}

export function formatCharterForPrompt(charter: CreationCharter): string {
  if (!charter) return "";

  const lines: string[] = ["## 创作宪章"];

  // 故事种子
  lines.push(`### 故事种子\n${charter.storySeed || "（未指定）"}`);

  // 主线蓝图
  const blueprint = charter.mainLineBlueprint;
  if (blueprint) {
    lines.push(
      `### 主线蓝图\n结构：${blueprint.structureMode || "未指定"}\n总卷数：${blueprint.totalVolumes || 0}，总章数：${blueprint.totalChapters || 0}`
    );
  } else {
    lines.push(`### 主线蓝图\n（未指定）`);
  }

  // 核心角色
  const characters = charter.coreCharacters || [];
  if (characters.length > 0) {
    lines.push(
      `### 核心角色\n${characters
        .map((c) => `- ${c.name || "未命名"}（${c.role || "未知角色"}）：${c.personality || "无描述"}，动机：${c.motivation || "未说明"}`)
        .join("\n")}`
    );
  } else {
    lines.push(`### 核心角色\n（未指定）`);
  }

  // 世界法则
  const rules = charter.worldRules || [];
  if (rules.length > 0) {
    lines.push(
      `### 世界法则\n${rules.map((r) => `- [${r.category || "未分类"}] ${r.rule || "未描述"}`).join("\n")}`
    );
  } else {
    lines.push(`### 世界法则\n（未指定）`);
  }

  // 叙事法则
  const narrative = charter.narrativeRules;
  if (narrative) {
    lines.push(
      `### 叙事法则\n风格：${narrative.writingStyle || "未指定"}，节奏：${narrative.pace || "未指定"}，视角：${narrative.pov || "未指定"}，基调：${narrative.tone || "未指定"}`
    );
  } else {
    lines.push(`### 叙事法则\n（未指定）`);
  }

  return lines.join("\n\n");
}
