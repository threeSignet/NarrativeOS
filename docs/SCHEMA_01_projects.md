# NarrativeOSPlus — 项目表设计（projects）

> 综合竞品A + NarrativeOS + 用户需求的设计方案
> 状态：✅ 已确认（单平台、核心创意等）

---

## 核心设计理念

**一个项目 = 一本小说**，每本小说只绑定一个平台。

项目不是孤立的容器，而是**连接作者、AI、平台的枢纽**。

```
作者（你）
    │
    ├─→ 创建项目《创业神话》
    │       │
    │       ├─→ 绑定平台：起点
    │       │   账号：xxx
    │       │   密码：***
    │       │   笔名：另一个马甲
    │       │
    │       ├─→ 小说类型：都市重生
    │       ├─→ 核心创意：穷学生重生回高三，靠先知优势创业逆袭
    │       ├─→ 目标字数：300万字
    │       ├─→ 目标章节：1000章
    │       │
    │       ├─→ AI配置：默认模型=Claude-4，风格=热血燃向
    │       ├─→ 规则绑定：去AI味规则v2、对话规则
    │       │
    │       └─→ 项目启动
    │               │
    │               ├─→ 世界观设定
    │               ├─→ 角色创建
    │               ├─→ 大纲生成
    │               └─→ 正文写作 → 平台发布
```

---

## 表设计

### 主表：projects（小说项目）

```sql
CREATE TABLE projects (
  -- ═══════════════════════════════════════════════
  -- ① 主键
  -- ═══════════════════════════════════════════════
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- ═══════════════════════════════════════════════
  -- ② 基础信息（作者填写的）
  -- ═══════════════════════════════════════════════
  title TEXT NOT NULL,                    -- 小说标题
  subtitle TEXT,                          -- 副标题/系列名
  
  -- 作者信息
  author_pen_name TEXT,                   -- 本项目专属笔名
  author_real_name TEXT,                  -- 真实姓名（可选，签约用）
  author_id_card TEXT,                    -- 身份证号（加密，签约用）
  author_qq TEXT,                         -- QQ号
  author_phone TEXT,                      -- 手机号
  author_email TEXT,                      -- 邮箱

  -- 小说类型与核心创意
  novel_type TEXT NOT NULL,               -- 小说类型
    CHECK(novel_type IN (
      'xianxia',          -- 仙侠
      'wuxia',            -- 武侠
      'urban',            -- 都市
      'scifi',            -- 科幻
      'fantasy',          -- 奇幻
      'history',          -- 历史
      'romance',          -- 言情
      'suspense',         -- 悬疑
      'game',             -- 游戏
      'military',         -- 军事
      'supernatural',     -- 灵异
      'fanfic',           -- 同人
      'light_novel',      -- 轻小说
      'other'             -- 其他
    )),
  novel_sub_type TEXT,                    -- 子类型标签，逗号分隔
    -- 如 "重生,系统流,创业,商战"
  
  core_concept TEXT NOT NULL,             -- 核心创意/一句话简介
    -- 如：穷学生重生回高三，靠先知优势创业逆袭
  synopsis TEXT,                          -- 小说简介/故事梗概（2000字以内）
  
  -- 题材标签
  tags TEXT,                              -- JSON 标签数组
    -- 如 ["重生","系统","创业","商战","校园","逆袭"]
  target_audience TEXT,                   -- 目标读者
    CHECK(target_audience IN (
      'male',             -- 男频
      'female',           -- 女频
      'universal',        -- 全年龄
      'shounen',          -- 少年向
      'shoujo',           -- 少女向
      'danmei'            -- 耽美
    )),

  -- ═══════════════════════════════════════════════
  -- ③ 平台信息（单平台）
  -- ═══════════════════════════════════════════════
  platform_name TEXT,                     -- 发布平台
    CHECK(platform_name IN (
      'qidian',           -- 起点中文网
      'jjwxc',            -- 晋江文学城
      'fanqie',           -- 番茄小说
      '7k7k',             -- 七猫小说
      'hongxiu',          -- 红袖添香
      'yunqi',            -- 云起书院
      'sfacg',            -- SF轻小说
      'chuangshi',        -- 创世中文网
      'bilibili',         -- 哔哩哔哩
      'webnovel',         -- Webnovel（国际站）
      'amazon',           -- Amazon KDP
      'custom'            -- 自定义/自建
    )),
  platform_book_id TEXT,                  -- 平台侧小说ID
  platform_book_url TEXT,                 -- 平台链接
  platform_nickname TEXT,                 -- 该平台上的笔名（可不同于 author_pen_name）
  platform_status TEXT DEFAULT 'inactive',  -- 平台侧状态
    CHECK(platform_status IN (
      'inactive',         -- 未关联
      'draft',             -- 草稿（平台未发布）
      'reviewing',         -- 审核中
      'rejected',          -- 被拒稿
      'signed',            -- 已签约
      'serializing',       -- 连载中
      'completed',         -- 已完结
      'removed'            -- 下架
    )),
  
  -- 平台账号（内联存储）
  platform_account TEXT,                  -- 平台登录账号
  -- ⚠️ 密码加密存储（见下方加密方案）
  platform_password_encrypted TEXT,       -- AES-256-GCM 加密
  platform_password_iv TEXT,              -- 加密IV
  
  -- 同步配置
  auto_sync INTEGER DEFAULT 0,            -- 是否自动同步
  sync_mode TEXT DEFAULT 'manual',        -- 同步模式
    CHECK(sync_mode IN ('manual','auto_draft','auto_publish')),
  last_synced_chapter_id TEXT,            -- 最后同步的章节
  last_synced_at TEXT,                    -- 最后同步时间

  -- ═══════════════════════════════════════════════
  -- ④ 写作目标（字数与进度管理）
  -- ═══════════════════════════════════════════════
  -- 总目标
  target_total_words INTEGER,             -- 目标总字数（如 3000000 = 300万字）
  target_chapter_count INTEGER,             -- 目标章节数（如 1000）
  target_daily_words INTEGER DEFAULT 2000,  -- 日更目标字数
  target_chapter_words INTEGER DEFAULT 3000, -- 每章目标字数
  expected_end_date TEXT,                 -- 预计完本日期
  
  -- 分卷目标
  target_volume_count INTEGER,            -- 目标卷数
  words_per_volume INTEGER,               -- 每卷目标字数

  -- ═══════════════════════════════════════════════
  -- ⑤ 项目状态（生命周期）
  -- ═══════════════════════════════════════════════
  status TEXT NOT NULL DEFAULT 'draft',
    CHECK(status IN (
      'draft',             -- 草稿：刚创建
      'worldbuilding',     -- 世界观构建中
      'outlining',         -- 大纲设计阶段
      'writing',           -- 正式写作中
      'paused',            -- 暂停
      'completed',         -- 已完本
      'revision',          -- 修订/二稿
      'published',         -- 已发布
      'archived'           -- 归档
    )),

  -- ═══════════════════════════════════════════════
  -- ⑥ AI写作配置（项目级预设）
  -- ═══════════════════════════════════════════════
  default_model_id TEXT,                  -- 默认LLM模型
  default_writing_style TEXT,             -- 默认写作风格
    CHECK(default_writing_style IN (
      'hardcore_realism',   -- 硬核写实
      'light_humor',        -- 轻松幽默
      'hot_blooded',        -- 热血燃向
      'delicate_literary',  -- 细腻文艺
      'dark_depressing',    -- 暗黑压抑
      'witty_roast'         -- 诙谐吐槽
    )),
  default_pace TEXT DEFAULT 'medium',      -- 默认叙事节奏
    CHECK(default_pace IN ('fast','medium','slow')),
  default_content_focus TEXT,             -- JSON 默认内容侧重
    -- 如 ["combat","dialogue","plot"]
  custom_rules TEXT,                      -- JSON 绑定的规则ID列表
    -- 如 ["rule_001","rule_002"]

  -- ═══════════════════════════════════════════════
  -- ⑦ 版本与统计（实时/缓存）
  -- ═══════════════════════════════════════════════
  version INTEGER NOT NULL DEFAULT 1,       -- 项目版本
  total_words INTEGER NOT NULL DEFAULT 0,   -- 当前总字数
  total_chapters INTEGER NOT NULL DEFAULT 0, -- 当前章节数
  total_volumes INTEGER NOT NULL DEFAULT 0,  -- 当前卷数
  
  latest_chapter_number INTEGER DEFAULT 0,  -- 最新章节编号
  latest_chapter_id TEXT,                 -- 最新章节ID
  latest_volume_id TEXT,                  -- 当前卷ID

  -- 写作统计
  words_today INTEGER DEFAULT 0,            -- 今日字数
  words_this_week INTEGER DEFAULT 0,      -- 本周字数
  words_this_month INTEGER DEFAULT 0,     -- 本月字数
  words_trend TEXT,                       -- JSON 近7天字数趋势
    -- 如 [2000,3500,0,4000,3000,0,5000]
  
  streak_days INTEGER DEFAULT 0,          -- 连续更新天数
  max_streak_days INTEGER DEFAULT 0,      -- 最高连续更新记录
  last_writing_date TEXT,                 -- 最后写作日期
  total_writing_hours REAL DEFAULT 0,     -- 累计写作时长（小时）

  -- ═══════════════════════════════════════════════
  -- ⑧ 封面与文件
  -- ═══════════════════════════════════════════════
  cover_image TEXT,                       -- 封面图路径
  outline_file TEXT,                      -- 大纲文件路径
  manuscript_path TEXT,                   -- 正文存储目录

  -- ═══════════════════════════════════════════════
  -- ⑨ 时间管理
  -- ═══════════════════════════════════════════════
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  first_published_at TEXT,                -- 首次发布时间
  last_published_at TEXT,                 -- 最后发布时间
  completed_at TEXT,                      -- 完本时间
  archived_at TEXT,                       -- 归档时间

  -- ═══════════════════════════════════════════════
  -- ⑩ 审计与软删除
  -- ═══════════════════════════════════════════════
  created_by TEXT NOT NULL,               -- 创建者
  is_deleted INTEGER NOT NULL DEFAULT 0,    -- 软删除标记
  deleted_at TEXT,                        -- 删除时间
  deleted_reason TEXT                     -- 删除原因
);

-- 索引
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_novel_type ON projects(novel_type);
CREATE INDEX idx_projects_platform ON projects(platform_name);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);
```

---

## 关联表：project_daily_stats（项目每日统计）

```sql
CREATE TABLE project_daily_stats (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                    -- 日期 YYYY-MM-DD

  -- 写作数据
  words_added INTEGER DEFAULT 0,         -- 当日新增字数
  chapters_added INTEGER DEFAULT 0,        -- 当日新增章节数
  words_deleted INTEGER DEFAULT 0,         -- 当日删除字数
  words_edited INTEGER DEFAULT 0,        -- 当日修改字数（估算）
  
  -- 时间数据
  writing_minutes INTEGER DEFAULT 0,       -- 当日写作时长（分钟）
  
  -- AI互动数据
  ai_calls INTEGER DEFAULT 0,              -- AI调用次数
  proposals_generated INTEGER DEFAULT 0,   -- 生成提案数
  proposals_approved INTEGER DEFAULT 0,  -- 批准提案数
  proposals_rejected INTEGER DEFAULT 0,    -- 拒绝提案数
  proposals_modified INTEGER DEFAULT 0,    -- 修改后批准数
  
  -- 状态快照（日终记录）
  total_words_at_eod INTEGER,            -- 当日结束总字数
  total_chapters_at_eod INTEGER,         -- 当日结束章节数
  
  UNIQUE(project_id, date)
);

CREATE INDEX idx_project_stats_project_date ON project_daily_stats(project_id, date DESC);
CREATE INDEX idx_project_stats_date ON project_daily_stats(date DESC);
```

---

## 平台密码加密方案

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

// 从系统获取主密钥（三选一）
function getMasterKey(): Buffer {
  // 1. 环境变量
  const envKey = process.env.NARRATIVEOS_MASTER_KEY;
  if (envKey) return Buffer.from(envKey, 'hex');
  
  // 2. 本地配置文件（首次启动设置）
  // 3. OS keychain（Windows DPAPI / macOS Keychain）
  
  throw new Error('Master key not configured');
}

export function encryptPassword(plainPassword: string): {
  encrypted: string;
  iv: string;
} {
  const iv = crypto.randomBytes(IV_LENGTH);
  const masterKey = getMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  
  let encrypted = cipher.update(plainPassword, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: `${encrypted}:${authTag.toString('hex')}`,
    iv: iv.toString('hex')
  };
}

export function decryptPassword(encrypted: string, iv: string): string {
  const [ciphertext, authTagHex] = encrypted.split(':');
  const masterKey = getMasterKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM, 
    masterKey, 
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

> ⚠️ **安全红线**：
> - 密码绝不以明文存储
> - API 绝不返回解密后的密码（只返回是否已设置）
> - 导出/备份时密码字段脱敏
> - 主密钥丢失则密码不可恢复（设计如此）

---

## TypeScript 类型定义

```typescript
import { z } from 'zod';

// ─── 枚举 ───
export const NovelType = z.enum([
  'xianxia', 'wuxia', 'urban', 'scifi', 'fantasy',
  'history', 'romance', 'suspense', 'game', 'military',
  'supernatural', 'fanfic', 'light_novel', 'other'
]);

export const ProjectStatus = z.enum([
  'draft', 'worldbuilding', 'outlining', 'writing',
  'paused', 'completed', 'revision', 'published', 'archived'
]);

export const PlatformName = z.enum([
  'qidian', 'jjwxc', 'fanqie', '7k7k', 'hongxiu',
  'yunqi', 'sfacg', 'chuangshi', 'bilibili', 'webnovel',
  'amazon', 'custom'
]);

export const PlatformStatus = z.enum([
  'inactive', 'draft', 'reviewing', 'rejected',
  'signed', 'serializing', 'completed', 'removed'
]);

export const TargetAudience = z.enum([
  'male', 'female', 'universal', 'shounen', 'shoujo', 'danmei'
]);

export const WritingStyle = z.enum([
  'hardcore_realism', 'light_humor', 'hot_blooded',
  'delicate_literary', 'dark_depressing', 'witty_roast'
]);

export const Pace = z.enum(['fast', 'medium', 'slow']);

export const ContentFocus = z.enum([
  'combat', 'dialogue', 'psychological', 'environment',
  'plot', 'romance', 'daily', 'suspense'
]);

// ─── 创建项目输入（必填+可选）───
export const CreateProjectInputSchema = z.object({
  // 必填
  title: z.string().min(1).max(100),
  novel_type: NovelType,
  core_concept: z.string().min(1).max(500),
  
  // 基础信息
  subtitle: z.string().max(100).optional(),
  author_pen_name: z.string().max(50).optional(),
  author_real_name: z.string().max(50).optional(),
  author_qq: z.string().max(20).optional(),
  author_phone: z.string().max(20).optional(),
  author_email: z.string().email().optional(),
  
  // 类型与标签
  novel_sub_type: z.string().optional(),
    // 如 "重生,系统流,创业"
  tags: z.array(z.string()).optional(),
  target_audience: TargetAudience.optional(),
  
  // 简介
  synopsis: z.string().max(2000).optional(),
  
  // 平台（可选，创建时可不填）
  platform_name: PlatformName.optional(),
  platform_nickname: z.string().max(50).optional(),
  platform_account: z.string().optional(),
  platform_password: z.string().optional(),
    // ⚠️ 明文传入，后端加密存储
  
  // 写作目标
  target_total_words: z.number().int().min(1).optional(),
  target_chapter_count: z.number().int().min(1).optional(),
  target_daily_words: z.number().int().min(1).default(2000),
  target_chapter_words: z.number().int().min(1).default(3000),
  expected_end_date: z.string().datetime().optional(),
  target_volume_count: z.number().int().optional(),
  words_per_volume: z.number().int().optional(),
  
  // AI配置
  default_model_id: z.string().optional(),
  default_writing_style: WritingStyle.optional(),
  default_pace: Pace.default('medium'),
  default_content_focus: z.array(ContentFocus).optional(),
  custom_rules: z.array(z.string()).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

// ─── 完整 Project 类型（数据库返回）───
export const ProjectSchema = CreateProjectInputSchema.extend({
  id: z.string(),
  
  // 平台状态
  platform_book_id: z.string().optional(),
  platform_book_url: z.string().optional(),
  platform_status: PlatformStatus.default('inactive'),
  auto_sync: z.boolean().default(false),
  sync_mode: z.enum(['manual','auto_draft','auto_publish']).default('manual'),
  last_synced_chapter_id: z.string().optional(),
  last_synced_at: z.string().datetime().optional(),
  
  // 加密字段（API不返回）
  platform_password_encrypted: z.string().optional(),
  platform_password_iv: z.string().optional(),
  
  // 项目状态
  status: ProjectStatus,
  
  // 版本与统计
  version: z.number().int().default(1),
  total_words: z.number().int().default(0),
  total_chapters: z.number().int().default(0),
  total_volumes: z.number().int().default(0),
  latest_chapter_number: z.number().int().default(0),
  latest_chapter_id: z.string().optional(),
  latest_volume_id: z.string().optional(),
  
  // 写作统计
  words_today: z.number().int().default(0),
  words_this_week: z.number().int().default(0),
  words_this_month: z.number().int().default(0),
  words_trend: z.array(z.number().int()).optional(),
  streak_days: z.number().int().default(0),
  max_streak_days: z.number().int().default(0),
  last_writing_date: z.string().datetime().optional(),
  total_writing_hours: z.number().default(0),
  
  // 文件
  cover_image: z.string().optional(),
  outline_file: z.string().optional(),
  manuscript_path: z.string().optional(),
  
  // 时间
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  first_published_at: z.string().datetime().optional(),
  last_published_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  archived_at: z.string().datetime().optional(),
  
  // 审计
  created_by: z.string(),
  is_deleted: z.boolean().default(false),
  deleted_at: z.string().datetime().optional(),
  deleted_reason: z.string().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

// ─── API 响应用的安全类型（脱敏）───
export const ProjectSafeSchema = ProjectSchema.omit({
  platform_password_encrypted: true,
  platform_password_iv: true,
  author_id_card: true,
});

export type ProjectSafe = z.infer<typeof ProjectSafeSchema>;

// ─── 每日统计 ───
export const ProjectDailyStatSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  
  words_added: z.number().int().default(0),
  chapters_added: z.number().int().default(0),
  words_deleted: z.number().int().default(0),
  words_edited: z.number().int().default(0),
  
  writing_minutes: z.number().int().default(0),
  
  ai_calls: z.number().int().default(0),
  proposals_generated: z.number().int().default(0),
  proposals_approved: z.number().int().default(0),
  proposals_rejected: z.number().int().default(0),
  proposals_modified: z.number().int().default(0),
  
  total_words_at_eod: z.number().int().optional(),
  total_chapters_at_eod: z.number().int().optional(),
});

export type ProjectDailyStat = z.infer<typeof ProjectDailyStatSchema>;
```

---

## 项目状态流转图

```
                    作者创建项目
                          │
                          ▼
                    ┌─────────────┐
                    │    draft    │ 草稿
                    │   (新建)     │
                    └──────┬──────┘
                           │ 完成基本信息填写
                           ▼
                    ┌─────────────┐
                    │ worldbuilding│ 世界观构建中
                    │   (设定世界观) │
                    └──────┬──────┘
                           │ 世界观确认
                           ▼
                    ┌─────────────┐
                    │  outlining  │ 大纲设计
                    │   (设计大纲) │
                    └──────┬──────┘
                           │ 大纲确认
                           ▼
                    ┌─────────────┐
                    │   writing   │ 正式写作
                    │   (连载中)   │ ◄──────┐
                    └──────┬──────┘         │
                           │               │
              ┌────────────┼────────────┐   │
              │            │            │   │
              ▼            ▼            ▼   │
        ┌────────┐   ┌────────┐   ┌────────┐│
        │completed│   │ paused │   │revision││
        │ (完本)  │   │ (暂停) │   │ (修订) ││
        └────────┘   └───┬────┘   └────────┘│
                         │                  │
                         └──────────────────┘
                                    │
                                    │ 继续写作
                                    └────────┘
```

**所有状态变更走 MOU**：
- AI 检测到"世界观已完整"→ 生成提案"建议进入大纲阶段"→ 作者批准 → 状态变更
- 作者也可主动发起状态变更提案

---

## 已确认的设计要点

| # | 要点 | 说明 |
|---|------|------|
| 1 | 单平台 | 一个项目只绑定一个平台，字段内联在 projects 表 |
| 2 | 小说类型 | `novel_type` 枚举（仙侠/都市/科幻等14种）+ `novel_sub_type` 自由标签 |
| 3 | 核心创意 | `core_concept` 必填，一句话概括 |
| 4 | 字数设定 | `target_total_words` + `target_chapter_count` + `target_daily_words` + `target_chapter_words` |
| 5 | 作者信息 | 笔名/真名/QQ/手机/邮箱/身份证（可选，签约用） |
| 6 | 平台状态 | 8种状态：inactive → draft → reviewing → rejected → signed → serializing → completed → removed |
| 7 | 密码加密 | AES-256-GCM，主密钥来自环境变量或系统 keychain |
| 8 | 写作统计 | 今日/本周/本月字数、连续更新天数、7天趋势图 |
| 9 | AI配置 | 默认模型、风格、节奏、内容侧重、自定义规则 |

---

> **确认后进入下一个表**：> - `volumes + chapters`（卷/章节结构）
> - `world_settings`（世界观设定）
> - `characters`（角色系统）
> > 你选哪个？或者对 projects 表还有修改？
