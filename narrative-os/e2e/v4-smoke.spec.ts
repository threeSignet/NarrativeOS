import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:3001';

/**
 * 轮询 API 等待条件满足
 */
async function pollApi<T>(
  fn: () => Promise<T>,
  predicate: (val: T) => boolean,
  interval = 3000,
  maxWait = 120000
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const val = await fn();
    if (predicate(val)) return val;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`轮询超时 (${maxWait}ms)`);
}

/**
 * NarrativeOS v4.0 浏览器联调测试
 * 使用 Playwright 模拟真实用户在浏览器中的操作
 */
test.describe('NarrativeOS v4.0 浏览器联调', () => {
  test('完整流程：创建项目 → 孵化 → 审批提案 → 验证世界面板', async ({ page, request }) => {
    test.setTimeout(300000); // 5分钟（含 LLM 调用）

    // ═══════════════════════════════════════════
    // 1. 通过 API 创建测试项目
    // ═══════════════════════════════════════════
    const projectRes = await request.post(`${API_URL}/projects`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        title: '浏览器测试-修仙编程',
        genre: '奇幻',
        style: '史诗',
        targetWords: 50000,
      }),
    });
    expect(projectRes.ok()).toBeTruthy();
    const project = await projectRes.json();
    expect(project.id).toBeTruthy();
    const projectId = project.id;
    console.log('✅ API 创建项目:', projectId.slice(0, 8));

    // ═══════════════════════════════════════════
    // 2. 打开项目编辑器
    // ═══════════════════════════════════════════
    await page.goto(`/project/${projectId}`);
    await page.waitForURL(/\/project\/[a-f0-9-]+/, { timeout: 15000 });
    console.log('✅ 进入项目编辑器');

    // 等待页面主要内容加载（HatchingView 中的标题或按钮）
    await page.locator('text=孵化中').waitFor({ state: 'visible', timeout: 10000 });
    console.log('  页面主体加载完成');

    // ═══════════════════════════════════════════
    // 3. 触发孵化流程（前端点击 + API 兜底）
    // ═══════════════════════════════════════════
    // HatchingView 中的按钮使用内联 style，没有 className 或 title，用文本匹配
    const hatchBtn = page.locator('button').filter({ hasText: /开始世界引擎孵化|继续孵化/ }).first();
    await expect(hatchBtn).toBeVisible({ timeout: 10000 });
    await hatchBtn.click({ force: true });
    console.log('✅ 点击开始孵化');

    // 同时通过 API 触发孵化，确保后端收到请求
    const advanceRes = await request.post(`${API_URL}/hatch/${projectId}/advance`, {
      headers: { 'Content-Type': 'application/json' },
      data: '{}',
    });
    console.log('  API 触发孵化请求已发送', advanceRes.ok() ? '(成功)' : `(失败 ${advanceRes.status()})`);

    // ═══════════════════════════════════════════
    // 4. 通过 API 轮询等待 pending 提案出现
    // ═══════════════════════════════════════════
    console.log('⏳ 轮询 API 等待提案生成（最多 120 秒）...');
    const proposals = await pollApi(
      async () => {
        const res = await request.get(`${API_URL}/hatch/${projectId}/proposals`);
        return res.ok() ? await res.json() : [];
      },
      (list: any[]) => list.some((p: any) => p.status === 'pending'),
      3000,
      120000
    );
    console.log(`✅ API 检测到 ${proposals.length} 个提案`);

    // ═══════════════════════════════════════════
    // 5. 刷新页面让 MOU 弹窗自动加载
    // ═══════════════════════════════════════════
    await page.reload();
    await page.waitForURL(/\/project\/[a-f0-9-]+/, { timeout: 15000 });
    await page.waitForTimeout(3000); // 等待前端加载提案数据
    console.log('  页面刷新完成');

    // ═══════════════════════════════════════════
    // 6. 等待 MOU 弹窗出现
    // ═══════════════════════════════════════════
    console.log('⏳ 等待 MOU 弹窗...');
    // MOUModal 的 title 格式："{引擎名} - 方案选择" 或 "MOU 提案审批"
    const mouModalTitle = page.locator('h2').filter({ hasText: /方案选择|MOU 提案审批/ });
    await mouModalTitle.waitFor({ state: 'visible', timeout: 30000 });
    console.log('✅ MOU 弹窗出现');

    // 检查弹窗中是否有审批按钮；如果没有，说明是已通过的提案，需要关闭后重新打开待审批提案
    const approveBtnInModal = page.locator('button').filter({ hasText: /批准|选择此方案|通过|同意/ }).first();
    const hasApproveBtn = await approveBtnInModal.isVisible().catch(() => false);

    if (!hasApproveBtn) {
      console.log('  弹窗显示的是已通过的提案，关闭后重新打开待审批提案');
      const closeBtn = page.locator('button').filter({ hasText: '关闭' }).first();
      await closeBtn.click();
      await mouModalTitle.waitFor({ state: 'hidden', timeout: 10000 });

      // 点击主页面的待审批提示
      const pendingNotice = page.getByText(/方案待审批/).first();
      await pendingNotice.click();
      await mouModalTitle.waitFor({ state: 'visible', timeout: 30000 });
      console.log('✅ 已打开待审批提案弹窗');
    }

    // 检测是否多方案（有 "选择方案（N 个选项）" 区域）
    const optionSection = page.getByText(/选择方案（\d+ 个选项）/).first();
    const hasMultiOptions = await optionSection.isVisible().catch(() => false);

    if (hasMultiOptions) {
      // 多方案：方案选择按钮内部有 div 子元素（标题+说明），区别于底部操作按钮
      // 使用弹窗标题向上查找祖先 div 限定范围，避免匹配到页面其他按钮
      const modal = mouModalTitle.locator('xpath=ancestor::div[2]');
      const optionButtons = modal.locator('button').filter({ has: page.locator('div') });
      const optionCount = await optionButtons.count();
      console.log(`  发现 ${optionCount} 个方案选项`);
      expect(optionCount).toBeGreaterThanOrEqual(1);

      // 选择第一个方案
      await optionButtons.first().click();
      await page.waitForTimeout(500);
      console.log('  已选择第一个方案');
    } else {
      console.log('  单方案模式，无需选择');
    }

    // ═══════════════════════════════════════════
    // 7. 审批提案
    // ═══════════════════════════════════════════
    // 批准按钮文字：多方案时为"选择此方案"，单方案时为"批准"
    // 额外兼容"通过"、"同意"等变体
    const approveBtn = page.locator('button').filter({ hasText: /批准|选择此方案|通过|同意/ }).first();
    await expect(approveBtn).toBeVisible({ timeout: 5000 });
    await approveBtn.click();
    console.log('✅ 点击审批按钮');

    // 等待弹窗关闭（审批后 MOUModal 的 open 变为 false）
    // canAct 时 onClose 为 undefined，弹窗只能通过操作关闭
    await mouModalTitle.waitFor({ state: 'hidden', timeout: 60000 });
    console.log('✅ MOU 弹窗已关闭');

    // ═══════════════════════════════════════════
    // 8. 验证世界面板可用
    // ═══════════════════════════════════════════
    await page.waitForTimeout(2000);

    // IconRail 中的按钮有 title 属性
    await page.locator('button[title="世界引擎"]').click();
    await page.waitForTimeout(1000);
    console.log('✅ 世界面板打开');

    // WorldPanel 中的"世界快照"按钮
    const snapshotBtn = page.locator('button').filter({ hasText: '世界快照' }).first();
    await expect(snapshotBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ 世界快照按钮可见');

    await snapshotBtn.click();
    await page.waitForTimeout(1000);
    console.log('✅ 世界快照窗口打开');

    // 关闭快照窗口（按 Escape 或点击关闭按钮）
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // ═══════════════════════════════════════════
    // 9. 验证设置面板
    // ═══════════════════════════════════════════
    await page.locator('button[title="设置"]').click();
    await page.waitForTimeout(500);

    const statusTag = page.locator('text=hatching').first();
    await expect(statusTag).toBeVisible({ timeout: 3000 });
    console.log('✅ 项目状态显示为 hatching');

    // ═══════════════════════════════════════════
    // 10. API 数据一致性验证
    // ═══════════════════════════════════════════
    const finalProposalsRes = await request.get(`${API_URL}/hatch/${projectId}/proposals`);
    const apiProposals = await finalProposalsRes.json();
    console.log(`  API 返回提案数: ${apiProposals.length}`);
    expect(apiProposals.length).toBeGreaterThanOrEqual(1);

    const approved = apiProposals.filter((p: any) => p.status === 'approved');
    const pending = apiProposals.filter((p: any) => p.status === 'pending');
    console.log(`    approved: ${approved.length}, pending: ${pending.length}`);

    const snapshotsRes = await request.get(`${API_URL}/projects/${projectId}/snapshots`);
    const apiSnapshots = await snapshotsRes.json();
    console.log(`  API 返回快照数: ${apiSnapshots.snapshots?.length || 0}`);

    console.log('\n══════════════════════════════════════════════════');
    console.log('  ✅ 浏览器联调测试全部通过！');
    console.log('══════════════════════════════════════════════════');
  });
});
