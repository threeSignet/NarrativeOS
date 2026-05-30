// narrative-os/packages/pipeline/src/handlers/change-tracker.ts
import { db, settingItemChanges } from "@narrative-os/database";

const TRACKED_FIELDS = [
  "content.location",
  "content.current_location",
  "content.status",
  "content.owner_id",
  "content.affiliation",
  "content.power_level",
  "content.alive",
  "content.territory",
  "content.headquarters",
];

export function isTrackedField(fieldPath: string): boolean {
  return TRACKED_FIELDS.some((f) => fieldPath === f || fieldPath.startsWith(f + "."));
}

function getValueByPath(obj: any, path: string): any {
  return path.split(".").reduce((o, p) => o?.[p], obj);
}

export async function recordChange(opts: {
  projectId: string;
  settingItemId: string;
  sourceType: "chapter_commit" | "manual_edit" | "proposal_approval" | "retcon" | "refinement";
  sourceId?: string;
  fieldPath: string;
  oldValue: any;
  newValue: any;
  chapterNumber?: number;
  changeReason?: string;
  changedBy?: string;
}): Promise<void> {
  if (!isTrackedField(opts.fieldPath)) return;
  await db.insert(settingItemChanges).values({
    projectId: opts.projectId,
    settingItemId: opts.settingItemId,
    sourceType: opts.sourceType,
    sourceId: opts.sourceId,
    fieldPath: opts.fieldPath,
    oldValue: opts.oldValue,
    newValue: opts.newValue,
    chapterNumber: opts.chapterNumber,
    changeReason: opts.changeReason,
    changedBy: opts.changedBy || "system",
  });
}

export async function detectItemChanges(
  projectId: string,
  itemId: string,
  oldContent: Record<string, unknown>,
  newContent: Record<string, unknown>,
  opts: {
    sourceType: "chapter_commit" | "manual_edit" | "proposal_approval" | "retcon" | "refinement";
    sourceId?: string;
    chapterNumber?: number;
    changeReason?: string;
  }
): Promise<void> {
  for (const field of TRACKED_FIELDS) {
    const oldVal = getValueByPath(oldContent, field);
    const newVal = getValueByPath(newContent, field);
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      await recordChange({
        projectId,
        settingItemId: itemId,
        sourceType: opts.sourceType,
        sourceId: opts.sourceId,
        fieldPath: field,
        oldValue: oldVal,
        newValue: newVal,
        chapterNumber: opts.chapterNumber,
        changeReason: opts.changeReason,
      });
    }
  }
}
