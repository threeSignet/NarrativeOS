/**
 * NarrativeOS v4.0 端到端联调测试
 * 验证：宪章注入、多提案、geo-anchor、变更追踪、世界快照
 */

const BASE_URL = "http://localhost:3001";

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`❌ ${msg}`);
}

let projectId: string;
let charter: any;
let proposals: any[] = [];

async function runTests() {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  NarrativeOS v4.0 E2E 联调测试");
  console.log("══════════════════════════════════════════════════\n");

  // ── 1. 创建项目 ──
  console.log("[1/8] 创建测试项目...");
  const project = await api("/projects", {
    method: "POST",
    body: JSON.stringify({
      title: "E2E测试-修仙编程",
      genre: "奇幻",
      style: "史诗",
      targetWords: 50000,
    }),
  });
  assert(project.id, "项目创建失败");
  projectId = project.id;
  assert(project.status === "hatching", "项目状态应为 hatching");
  console.log("  ✅ 项目创建成功:", projectId.slice(0, 8));

  // ── 2. 设置创作宪章 ──
  console.log("[2/8] 设置创作宪章...");
  const charterRes = await api(`/projects/${projectId}/charter`, {
    method: "PATCH",
    body: JSON.stringify({
      charter: {
        storySeed: "修仙世界灵气是可编程系统",
        mainLineBlueprint: {
          structureMode: "three_act",
          acts: [],
          totalVolumes: 3,
          totalChapters: 60,
        },
        coreCharacters: [
          {
            name: "林墨",
            role: "protagonist",
            archetype: "天才程序员",
            personality: "冷静理性",
            motivation: "解开灵气源代码",
            growthArc: "从工具理性到理解人心",
          },
        ],
        worldRules: [
          { category: "power_system", rule: "灵气是二进制能量", implications: ["需要编译器"] },
        ],
        narrativeRules: {
          writingStyle: "硬科幻+修仙",
          pace: "medium",
          pov: "third_person_limited",
          tone: "严肃哲学",
          dialogueStyle: "简洁有力",
          descriptionDensity: "moderate",
        },
        version: 1,
        lastModifiedAt: new Date().toISOString(),
      },
    }),
  });
  assert(charterRes.success, "宪章保存失败");
  charter = charterRes.charter;
  assert(charter.storySeed, "宪章应有 storySeed");
  console.log("  ✅ 宪章设置成功");

  // ── 3. 验证宪章读取 ──
  console.log("[3/8] 验证宪章读取...");
  const charterRead = await api(`/projects/${projectId}/charter`);
  assert(charterRead.charter, "应能读取宪章");
  assert(charterRead.charter.version === 1, "宪章版本应为 1");
  console.log("  ✅ 宪章读取成功");

  // ── 4. 设置协作模式 ──
  console.log("[4/8] 设置协作模式...");
  const modeRes = await api(`/projects/${projectId}/mode`, {
    method: "PATCH",
    body: JSON.stringify({ mode: "plan" }),
  });
  assert(modeRes.success, "模式设置失败");
  assert(modeRes.mode === "plan", "模式应为 plan");
  console.log("  ✅ 协作模式设为 plan");

  // ── 5. 触发孵化 (tone) ──
  console.log("[5/8] 触发孵化 tone 引擎...");
  const sseRes = await fetch(`${BASE_URL}/hatch/${projectId}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const sseText = await sseRes.text();
  assert(sseText.includes('"engine":"tone"'), "SSE 应包含 tone 引擎");
  console.log("  ✅ tone 引擎触发成功");

  // 等待引擎完成
  await new Promise((r) => setTimeout(r, 15000));

  // ── 6. 验证多提案 ──
  console.log("[6/8] 验证多提案生成...");
  proposals = await api(`/hatch/${projectId}/proposals`);
  assert(Array.isArray(proposals), "应返回提案数组");
  assert(proposals.length > 0, "应有提案生成");

  const toneProposals = proposals.filter((p: any) => p.type === "tone");
  console.log(`  发现 ${toneProposals.length} 个 tone 提案`);

  // 验证 optionGroup
  const grouped = toneProposals.filter((p: any) => p.optionGroup);
  console.log(`  其中 ${grouped.length} 个有 optionGroup`);
  if (grouped.length > 0) {
    const og = grouped[0].optionGroup;
    const sameGroup = toneProposals.filter((p: any) => p.optionGroup === og);
    console.log(`  同组提案数: ${sameGroup.length}`);
    assert(sameGroup.length === grouped.length, "同组提案应一致");
  }
  console.log("  ✅ 多提案验证通过");

  // ── 7. 审批 tone 提案 ──
  console.log("[7/8] 审批 tone 提案...");
  const pendingTone = proposals.find((p: any) => p.type === "tone" && p.status === "pending");
  assert(pendingTone, "应有 pending tone 提案");
  const approveRes = await api(`/proposals/${pendingTone.id}/approve`, { method: "POST", body: "{}" });
  assert(approveRes.success, "审批失败");
  console.log("  ✅ tone 提案审批成功, itemsCreated:", approveRes.settingItemsCreated);

  // 等待后续引擎
  await new Promise((r) => setTimeout(r, 3000));

  // ── 8. 验证世界快照 ──
  console.log("[8/8] 验证世界快照...");
  const snapshotRes = await api(`/projects/${projectId}/snapshot`, {
    method: "POST",
    body: "{}",
  });
  assert(snapshotRes.success, "快照创建失败");
  assert(snapshotRes.snapshotId, "应有 snapshotId");
  console.log("  ✅ 世界快照创建成功:", snapshotRes.snapshotId.slice(0, 8));

  // 验证快照列表
  const snapshots = await api(`/projects/${projectId}/snapshots`);
  assert(Array.isArray(snapshots.snapshots), "应返回快照列表");
  assert(snapshots.snapshots.length > 0, "应有快照");
  console.log("  ✅ 快照列表读取成功, 数量:", snapshots.snapshots.length);

  // ── 9. 验证变更追踪 (需要已有 setting item) ──
  console.log("[9/9] 验证变更追踪...");
  const settings = await api(`/hatch/${projectId}/engines`);
  const toneEngine = settings.find((e: any) => e.type === "tone");
  assert(toneEngine?.items?.length > 0, "tone 引擎应有 confirmed items");
  const itemId = toneEngine.items[0].id;

  const changes = await api(`/settings/items/${itemId}/changes`);
  assert(Array.isArray(changes.changes), "应返回变更列表");
  console.log("  ✅ 变更追踪读取成功, 变更数:", changes.changes.length);

  // ── 10. 验证提案组查询 ──
  console.log("[10/10] 验证提案组查询...");
  if (pendingTone.optionGroup) {
    const groupRes = await api(`/proposals/${pendingTone.id}/group`);
    assert(groupRes.isMultiOption !== undefined, "应返回 isMultiOption");
    console.log("  ✅ 提案组查询成功, isMultiOption:", groupRes.isMultiOption);
  } else {
    console.log("  ⚠️ 该提案无 optionGroup, 跳过组查询");
  }

  console.log("\n══════════════════════════════════════════════════");
  console.log("  ✅ 所有 v4.0 E2E 测试通过!");
  console.log("══════════════════════════════════════════════════\n");
}

runTests().catch((err) => {
  console.error("\n══════════════════════════════════════════════════");
  console.error("  ❌ E2E 测试失败:", err.message);
  console.error("══════════════════════════════════════════════════\n");
  process.exit(1);
});
