/**
 * 工具定义 + 系统提示生成
 *
 * 为引擎和伴侣生成 LLM function calling 工具定义，
 * 以及注入到系统提示中的引擎地图和工具使用指南。
 *
 * 新增引擎自动适配：引擎地图从 ENGINE_REGISTRY 自动生成，
 * 工具参数描述从引擎地图自动拼接，无需手动维护。
 */
import type { ToolDefinitionForLLM } from "@narrative-os/llm-client";
import {
  formatEngineMapForPrompt,
  formatEngineListForToolDesc,
  formatQueryExamples,
} from "./engine-map";

// ── 工具定义 ──

/**
 * 构建 query_world_setting 工具的 LLM function calling 定义
 * 所有引擎和伴侣共用此定义
 */
export function buildQueryWorldSettingToolDef(): ToolDefinitionForLLM {
  const engineList = formatEngineListForToolDesc();
  const examples = formatQueryExamples();

  return {
    type: "function",
    function: {
      name: "query_world_setting",
      description: `查询项目中已确认的世界观设定数据。所有筛选条件可选且可自由组合。数据自动限定在当前项目范围内。

引擎说明：${engineList}

使用示例：
${examples}

注意事项：
- 所有筛选条件可以自由组合（如同时按 engine + keyword 筛选）
- 如果返回结果数量达到 limit，说明可能还有未返回的数据，请缩小筛选范围
- 多轮探索时，从上一轮结果中发现的线索可以作为下一轮的关键词
- 写作引擎查询的是【章节快照】——该章节开始写作时冻结的世界状态`,
      parameters: {
        type: "object",
        properties: {
          engine: {
            type: "string",
            description: `按产出引擎的名称筛选，如 "character"、"geography"、"faction" 等`,
          },
          type: {
            type: "string",
            description: "按设定类型筛选，如 \"character\"、\"power_system\"、\"geography\"",
          },
          name: {
            type: "string",
            description: "按条目名称搜索（不区分大小写的部分匹配）",
          },
          keyword: {
            type: "string",
            description: "在条目的名称、摘要和完整内容中搜索关键词",
          },
          subtype: {
            type: "string",
            description: "按条目子类型筛选，如 \"protagonist\"、\"faction_member\"、\"region\"、\"artifact\"",
          },
          namePattern: {
            type: "string",
            description: "SQL LIKE 风格的名称模糊匹配，如 \"林%\" 匹配以\"林\"开头的名称",
          },
          includeRelations: {
            type: "boolean",
            description: "设置为 true 以同时返回条目之间的关系（来源→目标，关系类型，标签）",
          },
          limit: {
            type: "integer",
            description: "最大返回行数，默认 50，最大 200",
          },
        },
        required: [],
      },
    },
  };
}

// ── 系统提示片段 ──

/**
 * 生成引擎地图系统提示文本
 * 包含完整的引擎列表、产出类型和依赖关系
 */
export function buildEngineMapPrompt(): string {
  return formatEngineMapForPrompt();
}

/**
 * 生成工具使用指南（注入到系统提示中）
 * 包含多轮深挖的使用示例和最佳实践
 */
export function buildToolUsageGuide(): string {
  return `
## 数据查询指南

你有一个 \`query_world_setting\` 工具可以查询已确认的世界观设定数据。

### 查询策略

1. **按引擎查询**：如果你需要某个引擎的所有产出，使用 \`engine\` 参数
2. **按类型查询**：如果你只需要某种类型的设定，使用 \`type\` 参数
3. **按名称搜索**：如果你知道条目的名称或部分名称，使用 \`name\` 参数
4. **关键词搜索**：如果你想找到与某个概念相关的所有设定，使用 \`keyword\` 参数
5. **子类型筛选**：如果你只想要某种子类型的条目（如只查主角），使用 \`subtype\` 参数
6. **带关系查询**：如果你需要了解条目之间的关联，设置 \`includeRelations: true\`

### 多轮深挖策略

你可以进行多轮查询来深入探索：

\`\`\`
第一轮：广泛查询 → 发现关键实体和线索
第二轮：按名称或类型深入 → 获取特定实体的完整信息
第三轮：关键词搜索 → 从上一轮发现的线索继续挖掘
第N轮：交叉关联 → 连接不同引擎的产出，发现深层联系
\`\`\`

每一轮查询的结果都可能触发下一轮查询——请主动探索，不要满足于表面信息。

### 注意事项

- 查询结果自动限定在当前项目范围内，无需指定 projectId
- 如果 \`total\` 等于 \`limit\`，说明可能还有未返回的数据，请缩小筛选条件
- 写作时查询的是【章节快照】——该章节开始写作时冻结的世界状态，不会受后续变更影响

### 名称引用铁律（最重要）
- **所有引用已确认条目的字段必须使用纯名称，不得附加描述**
  正确：allies=["星桥集团"]  headquarters="第四层·星桥记忆锚站"
  错误：allies=["星桥集团（秘密同盟）"]  headquarters="无固定总部"
- 如果你需要描述关系的性质，放在 relation 的 label 字段中，不要放在名称里
`;
}

/**
 * 组合：完整的工具相关系统提示片段
 * 包含引擎地图 + 工具使用指南
 */
export function buildToolSystemPromptSection(): string {
  return [
    buildEngineMapPrompt(),
    buildToolUsageGuide(),
  ].join("\n");
}
