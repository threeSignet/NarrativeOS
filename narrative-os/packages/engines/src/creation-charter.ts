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
  const lines: string[] = ["## 创作宪章"];
  lines.push(`### 故事种子\n${charter.storySeed}`);
  lines.push(
    `### 主线蓝图\n结构：${charter.mainLineBlueprint.structureMode}\n总卷数：${charter.mainLineBlueprint.totalVolumes}，总章数：${charter.mainLineBlueprint.totalChapters}`
  );
  lines.push(
    `### 核心角色\n${charter.coreCharacters
      .map((c) => `- ${c.name}（${c.role}）：${c.personality}，动机：${c.motivation}`)
      .join("\n")}`
  );
  lines.push(
    `### 世界法则\n${charter.worldRules.map((r) => `- [${r.category}] ${r.rule}`).join("\n")}`
  );
  lines.push(
    `### 叙事法则\n风格：${charter.narrativeRules.writingStyle}，节奏：${charter.narrativeRules.pace}，视角：${charter.narrativeRules.pov}，基调：${charter.narrativeRules.tone}`
  );
  return lines.join("\n\n");
}
