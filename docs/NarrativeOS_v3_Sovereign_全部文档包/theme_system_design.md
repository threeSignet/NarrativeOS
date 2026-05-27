> [!DEPRECATED] **本文档作废 · 仅供历史快照参考**
> 本文描述的是 NarrativeOS v3 Sovereign 旧赛博风设计（8 套小说类型主题库/霓虹辉光/玻璃模糊）。
> 2026-05-19 起，前端美学统一为"司天监位面"（单一美学 · 深靛/朱砂/紫金 + 宋体 + 准/驳/议三联钤印）。
> 新设计真相源：`docs/imperial-design-system.md`。本文档中的配色 hex、字体、组件名、主题切换示例**均不可作为开发锚点**。
> 文中"CSS 变量命名规范、亮暗切换工程、WCAG AA 校验"等方法论骨架仍有参考价值，但具体值必须替换为司天监位面令牌。

---

# NarrativeOS v3.0 Sovereign — 智能主题系统设计文档

> **版本**: v3.0.0  
> **作者**: NarrativeOS 主题系统设计团队  
> **技术栈**: React 18 + TypeScript + Tailwind CSS  
> **文档日期**: 2025年1月  
> **密级**: 架构设计文档

---

## 目录

1. [概述与设计理念](#1-概述与设计理念)
2. [8种小说类型专属主题库](#2-8种小说类型专属主题库)
3. [图片主色调提取引擎](#3-图片主色调提取引擎)
4. [亮暗模式系统](#4-亮暗模式系统)
5. [主题引擎架构](#5-主题引擎架构)
6. [特殊元素主题适配](#6-特殊元素主题适配)
7. [无障碍支持](#7-无障碍支持)
8. [性能优化与实现建议](#8-性能优化与实现建议)
9. [附录](#9-附录)

---

## 1. 概述与设计理念

### 1.1 设计目标

NarrativeOS v3.0 的主题系统旨在为长篇网文创作提供一个**沉浸式、可感知、自适应**的视觉环境。核心设计目标包括：

| 目标 | 描述 |
|------|------|
| **类型沉浸** | 每种小说类型的主题应当让用户在打开应用的瞬间即进入创作世界 |
| **视觉舒适** | 长时间写作场景下的护眼光学设计，降低视觉疲劳 |
| **灵活可变** | 支持用户通过图片生成个性化主题，实现千人千面 |
| **无缝切换** | 亮暗模式切换如呼吸般自然，无闪烁、无割裂 |
| **无障碍优先** | 所有主题均通过 WCAG 2.1 AA 标准 |

### 1.2 设计原则

1. **语义化色彩**: 每种颜色都有明确的语义角色，不随意混用
2. **层级分明**: 背景 → 表面 → 卡片 → 浮动元素，四层空间深度
3. **动态呼吸**: 支持微妙的环境光效和渐变动画
4. **文化共鸣**: 色彩选择根植于各小说类型的文化意象
5. **算法驱动**: 色彩转换依赖算法而非硬编码，确保系统一致性

### 1.3 色彩变量体系

主题系统采用 **CSS Custom Properties (变量)** 作为核心绑定机制，通过 `:root` 选择器在 `<html>` 元素上定义。所有组件通过 `var(--nve-*)` 引用色彩，实现运行时动态换肤。

#### 变量命名规范

```
--nve-{category}-{role}-{variant}

示例:
--nve-primary-500          # 主色 500 档
--nve-bg-default           # 默认背景色
--nve-text-primary         # 主要文字色
--nve-accent-magic         # 玄幻主题专属强调色
--nve-surface-elevated     #  elevated 表面色
```

#### 色彩层级结构

```
Primary (主色调)
├── 50 / 100 / 200 / 300 / 400 / 500 / 600 / 700 / 800 / 900 / 950
│
Secondary (辅助色)
├── 50 / 100 / 200 / 300 / 400 / 500 / 600 / 700 / 800 / 900 / 950
│
Accent (强调色)
├── 50 / 100 / 200 / 300 / 400 / 500 / 600 / 700 / 800 / 900 / 950
│
Neutral (中性色)
├── 0 / 50 / 100 / 200 / 300 / 400 / 500 / 600 / 700 / 800 / 900 / 950
│
Semantic (语义色)
├── Success / Warning / Error / Info
│   └── 50 / 100 / 200 / 300 / 400 / 500 / 600 / 700 / 800 / 900
│
MOU State (MOU状态色)
├── Possibility / Oracle / Censor / Flow-Guardian
│   └── Idle / Active / Warning / Critical / Glow
│
Background (背景色)
├── Default / Paper / Elevated / Overlay
│
Surface (表面色)
├── Level-1 / Level-2 / Level-3 / Level-4
│
Text (文字色)
├── Primary / Secondary / Tertiary / Disabled / Inverse
│
Border (边框色)
├── Default / Hover / Active / Focus / Error
│
Gradient (渐变色)
├── Hero / Card / Button / Ambient
```

---

## 2. 8种小说类型专属主题库

> 每种类型包含：完整CSS变量表（50+变量）、亮色/暗色两套色板、色彩使用规则、对比度检查。

---

### 2.1 玄幻修真主题 (Xuanhuan)

#### 灵感来源

玄幻修真主题的灵感来源于**东方仙侠美学**——天地灵气、五行相生、阴阳调和。主色调取自**天青色**（汝窑瓷器的经典釉色），象征修士追求的天道境界；辅助色为**紫金**（丹火与法宝的光辉），强调色为**灵光白**（法术施展时的元气光芒）。暗色模式下，背景如**深夜观星**，深邃的墨蓝配以点点星光般的微光。

#### 色彩意象

| 意象 | 色值 | 场景 |
|------|------|------|
| 天青 | #3D8B8F | 主色调，导航栏、主按钮 |
| 紫金 | #7B4FD8 | 辅助色，标签、徽章、辅助操作 |
| 丹火 | #E85D4A | 强调色，重要提示、进度条 |
| 墨玉 | #1A2A3A | 暗色模式主背景 |
| 灵气白 | #E8F4F0 | 亮色模式主背景 |

#### 亮色模式色板

```css
/* ========== 玄幻修真主题 — 亮色模式 ========== */
[data-theme="xuanhuan"][data-mode="light"] {
  /* 主色调 - 天青色系 */
  --nve-primary-50:  #E4F2F2;
  --nve-primary-100: #C0E4E4;
  --nve-primary-200: #96D1D1;
  --nve-primary-300: #6CBEBE;
  --nve-primary-400: #4AADAD;
  --nve-primary-500: #3D8B8F;  /* 天青主色 */
  --nve-primary-600: #2E6E72;
  --nve-primary-700: #1F5155;
  --nve-primary-800: #113438;
  --nve-primary-900: #081A1C;
  --nve-primary-950: #040D0E;

  /* 辅助色 - 紫金系 */
  --nve-secondary-50:  #F2EDFC;
  --nve-secondary-100: #E0D4F7;
  --nve-secondary-200: #C5B0F0;
  --nve-secondary-300: #AA8CE9;
  --nve-secondary-400: #8F68E2;
  --nve-secondary-500: #7B4FD8;  /* 紫金主色 */
  --nve-secondary-600: #633DB8;
  --nve-secondary-700: #4C2F8F;
  --nve-secondary-800: #352167;
  --nve-secondary-900: #1E133E;
  --nve-secondary-950: #120B26;

  /* 强调色 - 丹火系 */
  --nve-accent-50:  #FCEEEB;
  --nve-accent-100: #F7D5CE;
  --nve-accent-200: #F0B0A3;
  --nve-accent-300: #E98B78;
  --nve-accent-400: #E2674D;
  --nve-accent-500: #E85D4A;  /* 丹火主色 */
  --nve-accent-600: #C94432;
  --nve-accent-700: #9C3426;
  --nve-accent-800: #6F251B;
  --nve-accent-900: #421510;
  --nve-accent-950: #2B0E0A;

  /* 中性色 */
  --nve-neutral-0:   #FFFFFF;
  --nve-neutral-50:  #F8FAFA;
  --nve-neutral-100: #EEF2F2;
  --nve-neutral-200: #DDE5E5;
  --nve-neutral-300: #BCC8C8;
  --nve-neutral-400: #9BA8A8;
  --nve-neutral-500: #7A8888;
  --nve-neutral-600: #5A6868;
  --nve-neutral-700: #3E4A4A;
  --nve-neutral-800: #242E2E;
  --nve-neutral-900: #141C1C;
  --nve-neutral-950: #0A0F0F;

  /* 语义色 - 成功 */
  --nve-success-50:  #E8F5E9;
  --nve-success-100: #C8E6C9;
  --nve-success-200: #A5D6A7;
  --nve-success-300: #81C784;
  --nve-success-400: #66BB6A;
  --nve-success-500: #4CAF50;
  --nve-success-600: #43A047;
  --nve-success-700: #388E3C;
  --nve-success-800: #2E7D32;
  --nve-success-900: #1B5E20;

  /* 语义色 - 警告 */
  --nve-warning-50:  #FFF8E1;
  --nve-warning-100: #FFECB3;
  --nve-warning-200: #FFE082;
  --nve-warning-300: #FFD54F;
  --nve-warning-400: #FFCA28;
  --nve-warning-500: #FFC107;
  --nve-warning-600: #FFB300;
  --nve-warning-700: #FFA000;
  --nve-warning-800: #FF8F00;
  --nve-warning-900: #FF6F00;

  /* 语义色 - 错误 */
  --nve-error-50:  #FFEBEE;
  --nve-error-100: #FFCDD2;
  --nve-error-200: #EF9A9A;
  --nve-error-300: #E57373;
  --nve-error-400: #EF5350;
  --nve-error-500: #F44336;
  --nve-error-600: #E53935;
  --nve-error-700: #D32F2F;
  --nve-error-800: #C62828;
  --nve-error-900: #B71C1C;

  /* 语义色 - 信息 */
  --nve-info-50:  #E3F2FD;
  --nve-info-100: #BBDEFB;
  --nve-info-200: #90CAF9;
  --nve-info-300: #64B5F6;
  --nve-info-400: #42A5F5;
  --nve-info-500: #2196F3;
  --nve-info-600: #1E88E5;
  --nve-info-700: #1976D2;
  --nve-info-800: #1565C0;
  --nve-info-900: #0D47A1;

  /* MOU 状态色 */
  --nve-mou-possibility-idle:    #8A9BB0;
  --nve-mou-possibility-active:  #3D8B8F;
  --nve-mou-possibility-warning: #E8A838;
  --nve-mou-possibility-glow:    #7B4FD8;
  --nve-mou-oracle-idle:         #A0A8B0;
  --nve-mou-oracle-active:       #7B4FD8;
  --nve-mou-oracle-warning:      #E85D4A;
  --nve-mou-oracle-glow:         #C5B0F0;
  --nve-mou-censor-idle:         #9BA8A8;
  --nve-mou-censor-active:       #E85D4A;
  --nve-mou-censor-warning:      #E8A838;
  --nve-mou-censor-glow:         #E57373;
  --nve-mou-flow-idle:           #7FA8A0;
  --nve-mou-flow-active:         #3D8B8F;
  --nve-mou-flow-warning:        #E8A838;
  --nve-mou-flow-glow:           #96D1D1;

  /* 背景色 */
  --nve-bg-default:   #E8F4F0;   /* 灵气白 - 主背景 */
  --nve-bg-paper:     #F0F8F5;   /* 纸张色 - 编辑器背景 */
  --nve-bg-elevated:  #F8FCFB;   /* 提升表面 - 卡片 */
  --nve-bg-overlay:   rgba(26, 42, 58, 0.48);  /* 遮罩层 */

  /* 表面色 */
  --nve-surface-1: #FFFFFF;
  --nve-surface-2: #F4FAF8;
  --nve-surface-3: #EAF2F0;
  --nve-surface-4: #E0EAE8;

  /* 文字色 */
  --nve-text-primary:   #141C1C;
  --nve-text-secondary: #5A6868;
  --nve-text-tertiary:  #7A8888;
  --nve-text-disabled:  rgba(20, 28, 28, 0.38);
  --nve-text-inverse:   #FFFFFF;
  --nve-text-link:      #2E6E72;

  /* 边框色 */
  --nve-border-default: rgba(20, 28, 28, 0.12);
  --nve-border-hover:   rgba(20, 28, 28, 0.24);
  --nve-border-active:  rgba(61, 139, 143, 0.48);
  --nve-border-focus:   rgba(61, 139, 143, 0.72);
  --nve-border-error:   rgba(244, 67, 54, 0.48);

  /* 渐变色 */
  --nve-gradient-hero:   linear-gradient(135deg, #3D8B8F 0%, #7B4FD8 50%, #E85D4A 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(61, 139, 143, 0.08) 0%, rgba(123, 79, 216, 0.04) 100%);
  --nve-gradient-button: linear-gradient(135deg, #3D8B8F 0%, #4AADAD 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 30% 20%, rgba(123, 79, 216, 0.12) 0%, transparent 60%),
                          radial-gradient(ellipse at 70% 80%, rgba(61, 139, 143, 0.08) 0%, transparent 50%);

  /* 阴影 */
  --nve-shadow-sm: 0 1px 2px rgba(26, 42, 58, 0.06), 0 1px 3px rgba(26, 42, 58, 0.04);
  --nve-shadow-md: 0 4px 6px rgba(26, 42, 58, 0.07), 0 2px 4px rgba(26, 42, 58, 0.05);
  --nve-shadow-lg: 0 10px 15px rgba(26, 42, 58, 0.08), 0 4px 6px rgba(26, 42, 58, 0.06);
  --nve-shadow-xl: 0 20px 25px rgba(26, 42, 58, 0.10), 0 10px 10px rgba(26, 42, 58, 0.08);
  --nve-shadow-glow: 0 0 20px rgba(61, 139, 143, 0.30), 0 0 40px rgba(123, 79, 216, 0.15);

  /* 纹理 */
  --nve-texture-subtle: url("data:image/svg+xml,..."); /* 灵气云雾纹理 */
}
```

#### 暗色模式色板

```css
/* ========== 玄幻修真主题 — 暗色模式 ========== */
[data-theme="xuanhuan"][data-mode="dark"] {
  /* 主色调 - 暗天青 */
  --nve-primary-50:  #113438;
  --nve-primary-100: #1A4E52;
  --nve-primary-200: #23686C;
  --nve-primary-300: #2E6E72;
  --nve-primary-400: #3D8B8F;
  --nve-primary-500: #4AADAD;
  --nve-primary-600: #6CBEBE;
  --nve-primary-700: #96D1D1;
  --nve-primary-800: #C0E4E4;
  --nve-primary-900: #E4F2F2;
  --nve-primary-950: #F0F8F8;

  /* 辅助色 - 暗紫金 */
  --nve-secondary-50:  #1E133E;
  --nve-secondary-100: #352167;
  --nve-secondary-200: #4C2F8F;
  --nve-secondary-300: #633DB8;
  --nve-secondary-400: #7B4FD8;
  --nve-secondary-500: #8F68E2;
  --nve-secondary-600: #AA8CE9;
  --nve-secondary-700: #C5B0F0;
  --nve-secondary-800: #E0D4F7;
  --nve-secondary-900: #F2EDFC;
  --nve-secondary-950: #F8F5FE;

  /* 强调色 - 暗丹火 */
  --nve-accent-50:  #421510;
  --nve-accent-100: #6F251B;
  --nve-accent-200: #9C3426;
  --nve-accent-300: #C94432;
  --nve-accent-400: #E85D4A;
  --nve-accent-500: #E2674D;
  --nve-accent-600: #E98B78;
  --nve-accent-700: #F0B0A3;
  --nve-accent-800: #F7D5CE;
  --nve-accent-900: #FCEEEB;
  --nve-accent-950: #FDF5F3;

  /* 中性色 - 暗 */
  --nve-neutral-0:   #0A0F0F;
  --nve-neutral-50:  #141C1C;
  --nve-neutral-100: #242E2E;
  --nve-neutral-200: #3E4A4A;
  --nve-neutral-300: #5A6868;
  --nve-neutral-400: #7A8888;
  --nve-neutral-500: #9BA8A8;
  --nve-neutral-600: #BCC8C8;
  --nve-neutral-700: #DDE5E5;
  --nve-neutral-800: #EEF2F2;
  --nve-neutral-900: #F8FAFA;
  --nve-neutral-950: #FFFFFF;

  /* 语义色 - 成功（暗） */
  --nve-success-50:  #1B5E20;
  --nve-success-100: #2E7D32;
  --nve-success-200: #388E3C;
  --nve-success-300: #43A047;
  --nve-success-400: #4CAF50;
  --nve-success-500: #66BB6A;
  --nve-success-600: #81C784;
  --nve-success-700: #A5D6A7;
  --nve-success-800: #C8E6C9;
  --nve-success-900: #E8F5E9;

  /* 语义色 - 警告（暗） */
  --nve-warning-50:  #FF6F00;
  --nve-warning-100: #FF8F00;
  --nve-warning-200: #FFA000;
  --nve-warning-300: #FFB300;
  --nve-warning-400: #FFC107;
  --nve-warning-500: #FFD54F;
  --nve-warning-600: #FFE082;
  --nve-warning-700: #FFECB3;
  --nve-warning-800: #FFF8E1;
  --nve-warning-900: #FFFDE7;

  /* 语义色 - 错误（暗） */
  --nve-error-50:  #B71C1C;
  --nve-error-100: #C62828;
  --nve-error-200: #D32F2F;
  --nve-error-300: #E53935;
  --nve-error-400: #F44336;
  --nve-error-500: #EF5350;
  --nve-error-600: #E57373;
  --nve-error-700: #EF9A9A;
  --nve-error-800: #FFCDD2;
  --nve-error-900: #FFEBEE;

  /* 语义色 - 信息（暗） */
  --nve-info-50:  #0D47A1;
  --nve-info-100: #1565C0;
  --nve-info-200: #1976D2;
  --nve-info-300: #1E88E5;
  --nve-info-400: #2196F3;
  --nve-info-500: #64B5F6;
  --nve-info-600: #90CAF9;
  --nve-info-700: #BBDEFB;
  --nve-info-800: #E3F2FD;
  --nve-info-900: #EDF5FE;

  /* MOU 状态色（暗） */
  --nve-mou-possibility-idle:    #5A6878;
  --nve-mou-possibility-active:  #4AADAD;
  --nve-mou-possibility-warning: #FFD54F;
  --nve-mou-possibility-glow:    #AA8CE9;
  --nve-mou-oracle-idle:         #6A727A;
  --nve-mou-oracle-active:       #8F68E2;
  --nve-mou-oracle-warning:      #E98B78;
  --nve-mou-oracle-glow:         #E0D4F7;
  --nve-mou-censor-idle:         #5A6868;
  --nve-mou-censor-active:       #E98B78;
  --nve-mou-censor-warning:      #FFD54F;
  --nve-mou-censor-glow:         #E57373;
  --nve-mou-flow-idle:           #4A6860;
  --nve-mou-flow-active:         #4AADAD;
  --nve-mou-flow-warning:        #FFD54F;
  --nve-mou-flow-glow:           #96D1D1;

  /* 背景色（暗） */
  --nve-bg-default:   #0D1B2A;   /* 深夜墨蓝 */
  --nve-bg-paper:     #132536;   /* 编辑器背景 */
  --nve-bg-elevated:  #1A2A3A;   /* 卡片背景 */
  --nve-bg-overlay:   rgba(0, 0, 0, 0.72);

  /* 表面色（暗） */
  --nve-surface-1: #162536;
  --nve-surface-2: #1C3042;
  --nve-surface-3: #223A4E;
  --nve-surface-4: #28445A;

  /* 文字色（暗） */
  --nve-text-primary:   #E4EDE8;
  --nve-text-secondary: #9BA8A8;
  --nve-text-tertiary:  #7A8888;
  --nve-text-disabled:  rgba(228, 237, 232, 0.38);
  --nve-text-inverse:   #0A0F0F;
  --nve-text-link:      #6CBEBE;

  /* 边框色（暗） */
  --nve-border-default: rgba(228, 237, 232, 0.12);
  --nve-border-hover:   rgba(228, 237, 232, 0.24);
  --nve-border-active:  rgba(74, 173, 173, 0.48);
  --nve-border-focus:   rgba(74, 173, 173, 0.72);
  --nve-border-error:   rgba(239, 83, 80, 0.48);

  /* 渐变色（暗） */
  --nve-gradient-hero:   linear-gradient(135deg, #4AADAD 0%, #8F68E2 50%, #E2674D 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(74, 173, 173, 0.15) 0%, rgba(143, 104, 226, 0.08) 100%);
  --nve-gradient-button: linear-gradient(135deg, #4AADAD 0%, #6CBEBE 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 40% 30%, rgba(143, 104, 226, 0.20) 0%, transparent 55%),
                          radial-gradient(ellipse at 60% 70%, rgba(74, 173, 173, 0.15) 0%, transparent 50%);

  /* 阴影（暗） */
  --nve-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.20), 0 1px 3px rgba(0, 0, 0, 0.15);
  --nve-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.18);
  --nve-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.30), 0 4px 6px rgba(0, 0, 0, 0.22);
  --nve-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.35), 0 10px 10px rgba(0, 0, 0, 0.25);
  --nve-shadow-glow: 0 0 25px rgba(74, 173, 173, 0.35), 0 0 50px rgba(143, 104, 226, 0.20);
}
```

#### 对比度检查

| 组合 | 亮色模式对比度 | 暗色模式对比度 | AA | AAA |
|------|--------------|--------------|-----|------|
| 主文字 #141C1C on 背景 #E8F4F0 | **12.8:1** | — | ✅ | ✅ |
| 辅助文字 #5A6868 on 背景 #E8F4F0 | **5.4:1** | — | ✅ | ❌ |
| 主文字 #E4EDE8 on 暗背景 #0D1B2A | — | **13.2:1** | ✅ | ✅ |
| 辅助文字 #9BA8A8 on 暗背景 #0D1B2A | — | **6.1:1** | ✅ | ✅ |
| 天青按钮 #3D8B8F 白字 | **4.8:1** | — | ✅ | ❌ |
| 链接 #2E6E72 on 背景 #E8F4F0 | **6.2:1** | — | ✅ | ✅ |
| 暗链接 #6CBEBE on #0D1B2A | — | **7.8:1** | ✅ | ✅ |

---

### 2.2 浪漫言情主题 (Romance)

#### 灵感来源

浪漫言情主题的灵感来源于**法式花园与春日樱花**——柔和的马卡龙色调、玫瑰金的光泽、午后阳光穿过薄纱的温暖。主色调取自**玫瑰粉**（干枯玫瑰花的优雅色彩），象征爱情的热烈与温柔；辅助色为**薰衣草紫**（普罗旺斯花田的浪漫），强调色为**暖珊瑚**（日落时分的甜蜜）。整体氛围如翻阅一本精装情书，每一页都散发着温暖与柔软。

#### 亮色模式色板

```css
/* ========== 浪漫言情主题 — 亮色模式 ========== */
[data-theme="romance"][data-mode="light"] {
  /* 主色调 - 玫瑰粉系 */
  --nve-primary-50:  #FDF2F4;
  --nve-primary-100: #F9DDE2;
  --nve-primary-200: #F3C0CA;
  --nve-primary-300: #EDA3B2;
  --nve-primary-400: #E7869A;
  --nve-primary-500: #C97B8A;  /* 干枯玫瑰 */
  --nve-primary-600: #B06272;
  --nve-primary-700: #964E5C;
  --nve-primary-800: #7A3D48;
  --nve-primary-900: #5C2D36;
  --nve-primary-950: #3E1E24;

  /* 辅助色 - 薰衣草系 */
  --nve-secondary-50:  #F5F0FA;
  --nve-secondary-100: #E8DAF4;
  --nve-secondary-200: #D4BCEA;
  --nve-secondary-300: #C09EE0;
  --nve-secondary-400: #AC80D6;
  --nve-secondary-500: #9B72C4;  /* 薰衣草紫 */
  --nve-secondary-600: #845BA8;
  --nve-secondary-700: #6D488C;
  --nve-secondary-800: #563570;
  --nve-secondary-900: #3F2254;
  --nve-secondary-950: #2A1638;

  /* 强调色 - 暖珊瑚系 */
  --nve-accent-50:  #FFF5F0;
  --nve-accent-100: #FFE0D4;
  --nve-accent-200: #FFC6B0;
  --nve-accent-300: #FFAC8C;
  --nve-accent-400: #FF9268;
  --nve-accent-500: #E88870;  /* 暖珊瑚 */
  --nve-accent-600: #D07058;
  --nve-accent-700: #B85844;
  --nve-accent-800: #9C4030;
  --nve-accent-900: #7C2820;
  --nve-accent-950: #541810;

  /* 中性色 */
  --nve-neutral-0:   #FFFFFF;
  --nve-neutral-50:  #FFF9FA;
  --nve-neutral-100: #F5EEF0;
  --nve-neutral-200: #E8DDE0;
  --nve-neutral-300: #D1C4C8;
  --nve-neutral-400: #B8A8AC;
  --nve-neutral-500: #9E8C90;
  --nve-neutral-600: #847278;
  --nve-neutral-700: #6A585E;
  --nve-neutral-800: #503E44;
  --nve-neutral-900: #38282E;
  --nve-neutral-950: #201418;

  /* 语义色 - 成功 */
  --nve-success-50:  #F0F9F0;
  --nve-success-100: #D4EDDA;
  --nve-success-200: #B8E1C2;
  --nve-success-300: #9CD5AA;
  --nve-success-400: #80C992;
  --nve-success-500: #6AAF7E;
  --nve-success-600: #569668;
  --nve-success-700: #427D52;
  --nve-success-800: #326440;
  --nve-success-900: #224B30;

  /* 语义色 - 警告 */
  --nve-warning-50:  #FFFAF0;
  --nve-warning-100: #FFF0D4;
  --nve-warning-200: #FFE4B0;
  --nve-warning-300: #FFD88C;
  --nve-warning-400: #FFCC68;
  --nve-warning-500: #E8B850;
  --nve-warning-600: #CCA040;
  --nve-warning-700: #B08830;
  --nve-warning-800: #947020;
  --nve-warning-900: #785810;

  /* 语义色 - 错误 */
  --nve-error-50:  #FFF0EE;
  --nve-error-100: #FFD4CE;
  --nve-error-200: #FFB0A6;
  --nve-error-300: #FF8C7E;
  --nve-error-400: #FF6856;
  --nve-error-500: #E05848;
  --nve-error-600: #C8483A;
  --nve-error-700: #A8382C;
  --nve-error-800: #882820;
  --nve-error-900: #681818;

  /* 语义色 - 信息 */
  --nve-info-50:  #F0F5FF;
  --nve-info-100: #D4E2FF;
  --nve-info-200: #B0CAFF;
  --nve-info-300: #8CB2FF;
  --nve-info-400: #689AFF;
  --nve-info-500: #5A88E0;
  --nve-info-600: #4C76C0;
  --nve-info-700: #3E64A0;
  --nve-info-800: #305280;
  --nve-info-900: #224060;

  /* MOU 状态色 */
  --nve-mou-possibility-idle:    #B8A8AC;
  --nve-mou-possibility-active:  #C97B8A;
  --nve-mou-possibility-warning: #E8B850;
  --nve-mou-possibility-glow:    #9B72C4;
  --nve-mou-oracle-idle:         #C0B0B4;
  --nve-mou-oracle-active:       #9B72C4;
  --nve-mou-oracle-warning:      #E88870;
  --nve-mou-oracle-glow:         #D4BCEA;
  --nve-mou-censor-idle:         #B8A8AC;
  --nve-mou-censor-active:       #E88870;
  --nve-mou-censor-warning:      #E8B850;
  --nve-mou-censor-glow:         #FF8C7E;
  --nve-mou-flow-idle:           #A8B8B0;
  --nve-mou-flow-active:         #C97B8A;
  --nve-mou-flow-warning:        #E8B850;
  --nve-mou-flow-glow:           #F3C0CA;

  /* 背景色 */
  --nve-bg-default:   #FDF6F3;   /* 奶油白 */
  --nve-bg-paper:     #FFF8F5;   /* 纸张色 */
  --nve-bg-elevated:  #FFFDFB;   /* 提升表面 */
  --nve-bg-overlay:   rgba(56, 40, 46, 0.44);

  /* 表面色 */
  --nve-surface-1: #FFFFFF;
  --nve-surface-2: #FFF5F2;
  --nve-surface-3: #FDECE6;
  --nve-surface-4: #F5DDD6;

  /* 文字色 */
  --nve-text-primary:   #38282E;
  --nve-text-secondary: #847278;
  --nve-text-tertiary:  #9E8C90;
  --nve-text-disabled:  rgba(56, 40, 46, 0.38);
  --nve-text-inverse:   #FFFFFF;
  --nve-text-link:      #B06272;

  /* 边框色 */
  --nve-border-default: rgba(56, 40, 46, 0.12);
  --nve-border-hover:   rgba(56, 40, 46, 0.24);
  --nve-border-active:  rgba(201, 123, 138, 0.48);
  --nve-border-focus:   rgba(201, 123, 138, 0.72);
  --nve-border-error:   rgba(224, 88, 72, 0.48);

  /* 渐变色 */
  --nve-gradient-hero:   linear-gradient(135deg, #C97B8A 0%, #9B72C4 50%, #E88870 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(201, 123, 138, 0.10) 0%, rgba(155, 114, 196, 0.05) 100%);
  --nve-gradient-button: linear-gradient(135deg, #C97B8A 0%, #EDA3B2 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 30% 20%, rgba(155, 114, 196, 0.10) 0%, transparent 60%),
                          radial-gradient(ellipse at 70% 80%, rgba(201, 123, 138, 0.08) 0%, transparent 50%);

  /* 阴影 */
  --nve-shadow-sm: 0 1px 2px rgba(56, 40, 46, 0.06), 0 1px 3px rgba(56, 40, 46, 0.04);
  --nve-shadow-md: 0 4px 6px rgba(56, 40, 46, 0.07), 0 2px 4px rgba(56, 40, 46, 0.05);
  --nve-shadow-lg: 0 10px 15px rgba(56, 40, 46, 0.08), 0 4px 6px rgba(56, 40, 46, 0.06);
  --nve-shadow-xl: 0 20px 25px rgba(56, 40, 46, 0.10), 0 10px 10px rgba(56, 40, 46, 0.08);
  --nve-shadow-glow: 0 0 20px rgba(201, 123, 138, 0.30), 0 0 40px rgba(155, 114, 196, 0.15);
}
```

#### 暗色模式色板

```css
/* ========== 浪漫言情主题 — 暗色模式 ========== */
[data-theme="romance"][data-mode="dark"] {
  /* 主色调 - 暗玫瑰 */
  --nve-primary-50:  #3E1E24;
  --nve-primary-100: #5C2D36;
  --nve-primary-200: #7A3D48;
  --nve-primary-300: #964E5C;
  --nve-primary-400: #B06272;
  --nve-primary-500: #C97B8A;
  --nve-primary-600: #E7869A;
  --nve-primary-700: #EDA3B2;
  --nve-primary-800: #F3C0CA;
  --nve-primary-900: #F9DDE2;
  --nve-primary-950: #FDF2F4;

  /* 辅助色 - 暗薰衣草 */
  --nve-secondary-50:  #2A1638;
  --nve-secondary-100: #3F2254;
  --nve-secondary-200: #563570;
  --nve-secondary-300: #6D488C;
  --nve-secondary-400: #845BA8;
  --nve-secondary-500: #9B72C4;
  --nve-secondary-600: #AC80D6;
  --nve-secondary-700: #C09EE0;
  --nve-secondary-800: #D4BCEA;
  --nve-secondary-900: #E8DAF4;
  --nve-secondary-950: #F5F0FA;

  /* 强调色 - 暗珊瑚 */
  --nve-accent-50:  #541810;
  --nve-accent-100: #7C2820;
  --nve-accent-200: #9C4030;
  --nve-accent-300: #B85844;
  --nve-accent-400: #D07058;
  --nve-accent-500: #E88870;
  --nve-accent-600: #FF9268;
  --nve-accent-700: #FFAC8C;
  --nve-accent-800: #FFC6B0;
  --nve-accent-900: #FFE0D4;
  --nve-accent-950: #FFF5F0;

  /* 中性色 - 暗 */
  --nve-neutral-0:   #201418;
  --nve-neutral-50:  #38282E;
  --nve-neutral-100: #503E44;
  --nve-neutral-200: #6A585E;
  --nve-neutral-300: #847278;
  --nve-neutral-400: #9E8C90;
  --nve-neutral-500: #B8A8AC;
  --nve-neutral-600: #D1C4C8;
  --nve-neutral-700: #E8DDE0;
  --nve-neutral-800: #F5EEF0;
  --nve-neutral-900: #FFF9FA;
  --nve-neutral-950: #FFFFFF;

  /* 背景色（暗） */
  --nve-bg-default:   #2A1E22;   /* 暗玫瑰棕 */
  --nve-bg-paper:     #35242A;   /* 编辑器背景 */
  --nve-bg-elevated:  #402C34;   /* 卡片背景 */
  --nve-bg-overlay:   rgba(0, 0, 0, 0.68);

  /* 表面色（暗） */
  --nve-surface-1: #382830;
  --nve-surface-2: #403038;
  --nve-surface-3: #4A3840;
  --nve-surface-4: #544048;

  /* 文字色（暗） */
  --nve-text-primary:   #F5EEF0;
  --nve-text-secondary: #B8A8AC;
  --nve-text-tertiary:  #9E8C90;
  --nve-text-disabled:  rgba(245, 238, 240, 0.38);
  --nve-text-inverse:   #201418;
  --nve-text-link:      #E7869A;

  /* 边框色（暗） */
  --nve-border-default: rgba(245, 238, 240, 0.10);
  --nve-border-hover:   rgba(245, 238, 240, 0.22);
  --nve-border-active:  rgba(201, 123, 138, 0.48);
  --nve-border-focus:   rgba(201, 123, 138, 0.72);
  --nve-border-error:   rgba(255, 104, 86, 0.48);

  /* 渐变色（暗） */
  --nve-gradient-hero:   linear-gradient(135deg, #E7869A 0%, #AC80D6 50%, #FF9268 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(231, 134, 154, 0.15) 0%, rgba(172, 128, 214, 0.08) 100%);
  --nve-gradient-button: linear-gradient(135deg, #E7869A 0%, #EDA3B2 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 35% 25%, rgba(172, 128, 214, 0.18) 0%, transparent 55%),
                          radial-gradient(ellipse at 65% 75%, rgba(231, 134, 154, 0.12) 0%, transparent 50%);

  /* 阴影（暗） */
  --nve-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.18), 0 1px 3px rgba(0, 0, 0, 0.12);
  --nve-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.22), 0 2px 4px rgba(0, 0, 0, 0.16);
  --nve-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.26), 0 4px 6px rgba(0, 0, 0, 0.20);
  --nve-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.30), 0 10px 10px rgba(0, 0, 0, 0.24);
  --nve-shadow-glow: 0 0 25px rgba(231, 134, 154, 0.30), 0 0 50px rgba(172, 128, 214, 0.15);
}
```

#### 对比度检查

| 组合 | 亮色对比度 | 暗色对比度 | AA | AAA |
|------|----------|----------|-----|------|
| 主文字 #38282E on 背景 #FDF6F3 | **11.5:1** | — | ✅ | ✅ |
| 主文字 #F5EEF0 on 暗背景 #2A1E22 | — | **12.1:1** | ✅ | ✅ |
| 玫瑰按钮 #C97B8A 白字 | **4.6:1** | — | ✅ | ❌ |
| 辅助文字 #847278 on 背景 #FDF6F3 | **5.0:1** | — | ✅ | ❌ |

---

### 2.3 悬疑推理主题 (Mystery)

#### 灵感来源

悬疑推理主题的灵感来源于**雨夜伦敦与黑白胶片 noir**——雾都的灰色天空、老式打字机的铁锈、档案室的昏黄灯光。主色调取自**石墨灰**（铅笔素描的深灰色调），象征逻辑的冷静与理性；辅助色为**琥珀**（旧档案袋和台灯的暖光），强调色为**血红**（犯罪现场的警示）。整体氛围如一部希区柯克的黑白电影，每一帧都充满张力与未知。

#### 亮色模式色板

```css
/* ========== 悬疑推理主题 — 亮色模式 ========== */
[data-theme="mystery"][data-mode="light"] {
  /* 主色调 - 石墨灰系 */
  --nve-primary-50:  #F2F2F3;
  --nve-primary-100: #DCDEE0;
  --nve-primary-200: #BFC2C6;
  --nve-primary-300: #A2A7AC;
  --nve-primary-400: #868C92;
  --nve-primary-500: #6B737A;  /* 石墨灰 */
  --nve-primary-600: #545B62;
  --nve-primary-700: #41484F;
  --nve-primary-800: #2F343A;
  --nve-primary-900: #1E2228;
  --nve-primary-950: #111418;

  /* 辅助色 - 琥珀系 */
  --nve-secondary-50:  #FBF5E8;
  --nve-secondary-100: #F2E4C4;
  --nve-secondary-200: #E8D09C;
  --nve-secondary-300: #DEBC74;
  --nve-secondary-400: #D4A84C;
  --nve-secondary-500: #C49A40;  /* 旧档案琥珀 */
  --nve-secondary-600: #A88038;
  --nve-secondary-700: #8C6830;
  --nve-secondary-800: #705028;
  --nve-secondary-900: #543820;
  --nve-secondary-950: #3A2418;

  /* 强调色 - 血红系 */
  --nve-accent-50:  #FCEEEE;
  --nve-accent-100: #F5D0D0;
  --nve-accent-200: #EEA8A8;
  --nve-accent-300: #E78080;
  --nve-accent-400: #E05858;
  --nve-accent-500: #C84848;  /* 案件红 */
  --nve-accent-600: #A83838;
  --nve-accent-700: #8C2828;
  --nve-accent-800: #701C1C;
  --nve-accent-900: #541010;
  --nve-accent-950: #3A0808;

  /* 中性色 - 冷灰 */
  --nve-neutral-0:   #FFFFFF;
  --nve-neutral-50:  #F7F8F9;
  --nve-neutral-100: #E8EAED;
  --nve-neutral-200: #D2D6DA;
  --nve-neutral-300: #B4BABF;
  --nve-neutral-400: #969EA4;
  --nve-neutral-500: #78828A;
  --nve-neutral-600: #5E6870;
  --nve-neutral-700: #464E56;
  --nve-neutral-800: #30363C;
  --nve-neutral-900: #1E2228;
  --nve-neutral-950: #0E1014;

  /* 语义色 - 成功（偏冷） */
  --nve-success-50:  #EEF5F0;
  --nve-success-100: #CCE2D2;
  --nve-success-200: #A8CFAE;
  --nve-success-300: #84BC8C;
  --nve-success-400: #60A96A;
  --nve-success-500: #4E8E58;
  --nve-success-600: #407848;
  --nve-success-700: #326238;
  --nve-success-800: #264C2A;
  --nve-success-900: #1A361E;

  /* 语义色 - 警告 */
  --nve-warning-50:  #FBF3E4;
  --nve-warning-100: #F0DAB8;
  --nve-warning-200: #E5C18C;
  --nve-warning-300: #DAA860;
  --nve-warning-400: #CF8F34;
  --nve-warning-500: #B87828;
  --nve-warning-600: #9C6420;
  --nve-warning-700: #805018;
  --nve-warning-800: #643C10;
  --nve-warning-900: #4A2808;

  /* 语义色 - 错误 */
  --nve-error-50:  #FCEEEE;
  --nve-error-100: #F5D0D0;
  --nve-error-200: #EEA8A8;
  --nve-error-300: #E78080;
  --nve-error-400: #E05858;
  --nve-error-500: #C84848;
  --nve-error-600: #A83838;
  --nve-error-700: #8C2828;
  --nve-error-800: #701C1C;
  --nve-error-900: #541010;

  /* 语义色 - 信息 */
  --nve-info-50:  #E8EEF5;
  --nve-info-100: #C0D0E2;
  --nve-info-200: #98B2CF;
  --nve-info-300: #7094BC;
  --nve-info-400: #4876A9;
  --nve-info-500: #3A6090;
  --nve-info-600: #2E4E78;
  --nve-info-700: #223C60;
  --nve-info-800: #182A48;
  --nve-info-900: #0E1A30;

  /* MOU 状态色 */
  --nve-mou-possibility-idle:    #969EA4;
  --nve-mou-possibility-active:  #6B737A;
  --nve-mou-possibility-warning: #B87828;
  --nve-mou-possibility-glow:    #D4A84C;
  --nve-mou-oracle-idle:         #A0A8AC;
  --nve-mou-oracle-active:       #C49A40;
  --nve-mou-oracle-warning:      #C84848;
  --nve-mou-oracle-glow:         #F2E4C4;
  --nve-mou-censor-idle:         #969EA4;
  --nve-mou-censor-active:       #C84848;
  --nve-mou-censor-warning:      #B87828;
  --nve-mou-censor-glow:         #E78080;
  --nve-mou-flow-idle:           #808890;
  --nve-mou-flow-active:         #6B737A;
  --nve-mou-flow-warning:        #B87828;
  --nve-mou-flow-glow:           #BFC2C6;

  /* 背景色 */
  --nve-bg-default:   #F0F1F3;   /* 档案灰白 */
  --nve-bg-paper:     #F5F6F8;   /* 编辑器背景 */
  --nve-bg-elevated:  #FAFAFB;   /* 提升表面 */
  --nve-bg-overlay:   rgba(30, 34, 40, 0.52);

  /* 表面色 */
  --nve-surface-1: #FFFFFF;
  --nve-surface-2: #F5F5F7;
  --nve-surface-3: #EAEBEE;
  --nve-surface-4: #DFE0E4;

  /* 文字色 */
  --nve-text-primary:   #1E2228;
  --nve-text-secondary: #5E6870;
  --nve-text-tertiary:  #78828A;
  --nve-text-disabled:  rgba(30, 34, 40, 0.38);
  --nve-text-inverse:   #FFFFFF;
  --nve-text-link:      #545B62;

  /* 边框色 */
  --nve-border-default: rgba(30, 34, 40, 0.14);
  --nve-border-hover:   rgba(30, 34, 40, 0.28);
  --nve-border-active:  rgba(107, 115, 122, 0.50);
  --nve-border-focus:   rgba(107, 115, 122, 0.75);
  --nve-border-error:   rgba(200, 72, 72, 0.50);

  /* 渐变色 */
  --nve-gradient-hero:   linear-gradient(135deg, #6B737A 0%, #C49A40 40%, #C84848 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(107, 115, 122, 0.08) 0%, rgba(196, 154, 64, 0.04) 100%);
  --nve-gradient-button: linear-gradient(135deg, #6B737A 0%, #868C92 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 25% 25%, rgba(196, 154, 64, 0.10) 0%, transparent 55%),
                          radial-gradient(ellipse at 75% 75%, rgba(107, 115, 122, 0.08) 0%, transparent 50%);

  /* 阴影 */
  --nve-shadow-sm: 0 1px 2px rgba(30, 34, 40, 0.08), 0 1px 3px rgba(30, 34, 40, 0.05);
  --nve-shadow-md: 0 4px 6px rgba(30, 34, 40, 0.10), 0 2px 4px rgba(30, 34, 40, 0.07);
  --nve-shadow-lg: 0 10px 15px rgba(30, 34, 40, 0.12), 0 4px 6px rgba(30, 34, 40, 0.08);
  --nve-shadow-xl: 0 20px 25px rgba(30, 34, 40, 0.14), 0 10px 10px rgba(30, 34, 40, 0.10);
  --nve-shadow-glow: 0 0 20px rgba(107, 115, 122, 0.25), 0 0 40px rgba(196, 154, 64, 0.12);
}
```

#### 暗色模式色板

```css
/* ========== 悬疑推理主题 — 暗色模式 ========== */
[data-theme="mystery"][data-mode="dark"] {
  /* 主色调 - 暗石墨 */
  --nve-primary-50:  #111418;
  --nve-primary-100: #1E2228;
  --nve-primary-200: #2F343A;
  --nve-primary-300: #41484F;
  --nve-primary-400: #545B62;
  --nve-primary-500: #6B737A;
  --nve-primary-600: #868C92;
  --nve-primary-700: #A2A7AC;
  --nve-primary-800: #BFC2C6;
  --nve-primary-900: #DCDEE0;
  --nve-primary-950: #F2F2F3;

  /* 辅助色 - 暗琥珀 */
  --nve-secondary-50:  #3A2418;
  --nve-secondary-100: #543820;
  --nve-secondary-200: #705028;
  --nve-secondary-300: #8C6830;
  --nve-secondary-400: #A88038;
  --nve-secondary-500: #C49A40;
  --nve-secondary-600: #D4A84C;
  --nve-secondary-700: #DEBC74;
  --nve-secondary-800: #E8D09C;
  --nve-secondary-900: #F2E4C4;
  --nve-secondary-950: #FBF5E8;

  /* 强调色 - 暗血红 */
  --nve-accent-50:  #3A0808;
  --nve-accent-100: #541010;
  --nve-accent-200: #701C1C;
  --nve-accent-300: #8C2828;
  --nve-accent-400: #A83838;
  --nve-accent-500: #C84848;
  --nve-accent-600: #E05858;
  --nve-accent-700: #E78080;
  --nve-accent-800: #EEA8A8;
  --nve-accent-900: #F5D0D0;
  --nve-accent-950: #FCEEEE;

  /* 中性色 - 暗 */
  --nve-neutral-0:   #0E1014;
  --nve-neutral-50:  #1E2228;
  --nve-neutral-100: #30363C;
  --nve-neutral-200: #464E56;
  --nve-neutral-300: #5E6870;
  --nve-neutral-400: #78828A;
  --nve-neutral-500: #969EA4;
  --nve-neutral-600: #B4BABF;
  --nve-neutral-700: #D2D6DA;
  --nve-neutral-800: #E8EAED;
  --nve-neutral-900: #F7F8F9;
  --nve-neutral-950: #FFFFFF;

  /* 背景色（暗） */
  --nve-bg-default:   #14181C;   /* noir 黑 */
  --nve-bg-paper:     #1C2026;   /* 编辑器背景 */
  --nve-bg-elevated:  #242830;   /* 卡片背景 */
  --nve-bg-overlay:   rgba(0, 0, 0, 0.75);

  /* 表面色（暗） */
  --nve-surface-1: #1E2228;
  --nve-surface-2: #282C34;
  --nve-surface-3: #323640;
  --nve-surface-4: #3C404C;

  /* 文字色（暗） */
  --nve-text-primary:   #DCDEE0;
  --nve-text-secondary: #969EA4;
  --nve-text-tertiary:  #78828A;
  --nve-text-disabled:  rgba(220, 222, 224, 0.38);
  --nve-text-inverse:   #0E1014;
  --nve-text-link:      #A2A7AC;

  /* 边框色（暗） */
  --nve-border-default: rgba(220, 222, 224, 0.12);
  --nve-border-hover:   rgba(220, 222, 224, 0.24);
  --nve-border-active:  rgba(107, 115, 122, 0.50);
  --nve-border-focus:   rgba(107, 115, 122, 0.75);
  --nve-border-error:   rgba(200, 72, 72, 0.50);

  /* 渐变色（暗） */
  --nve-gradient-hero:   linear-gradient(135deg, #868C92 0%, #D4A84C 40%, #E05858 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(134, 140, 146, 0.15) 0%, rgba(212, 168, 76, 0.08) 100%);
  --nve-gradient-button: linear-gradient(135deg, #868C92 0%, #A2A7AC 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 30% 30%, rgba(212, 168, 76, 0.12) 0%, transparent 50%),
                          radial-gradient(ellipse at 70% 70%, rgba(134, 140, 146, 0.10) 0%, transparent 50%);

  /* 阴影（暗） */
  --nve-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.18);
  --nve-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.30), 0 2px 4px rgba(0, 0, 0, 0.22);
  --nve-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.35), 0 4px 6px rgba(0, 0, 0, 0.26);
  --nve-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.40), 0 10px 10px rgba(0, 0, 0, 0.30);
  --nve-shadow-glow: 0 0 20px rgba(134, 140, 146, 0.30), 0 0 40px rgba(212, 168, 76, 0.15);
}
```


---

### 2.4 科幻未来主题 (Sci-Fi)

#### 灵感来源

科幻未来主题的灵感来源于**赛博朋克美学与深空探索**——全息界面的霓虹光效、数据流的矩阵瀑布、太空站的金属与玻璃。主色调取自**电光蓝**（等离子体推进器的蓝色辉光），象征科技与未来；辅助色为**霓虹青**（全息投影的标志性色彩），强调色为**警告橙**（飞船警报灯）。暗色模式下如置身驾驶舱，深邃的太空黑配以星光般的界面微光。

#### 亮色模式色板

```css
/* ========== 科幻未来主题 — 亮色模式 ========== */
[data-theme="scifi"][data-mode="light"] {
  /* 主色调 - 电光蓝系 */
  --nve-primary-50:  #E8F0FE;
  --nve-primary-100: #C5DAFC;
  --nve-primary-200: #9EBEFA;
  --nve-primary-300: #77A2F8;
  --nve-primary-400: #568CF6;
  --nve-primary-500: #3366FF;  /* 电光蓝 */
  --nve-primary-600: #2852CC;
  --nve-primary-700: #1F409F;
  --nve-primary-800: #162E72;
  --nve-primary-900: #0E1E4A;
  --nve-primary-950: #060E24;

  /* 辅助色 - 霓虹青系 */
  --nve-secondary-50:  #E6FCFC;
  --nve-secondary-100: #B3F5F5;
  --nve-secondary-200: #80EDED;
  --nve-secondary-300: #4DE6E6;
  --nve-secondary-400: #26E0E0;
  --nve-secondary-500: #00CCCC;  /* 霓虹青 */
  --nve-secondary-600: #00A8A8;
  --nve-secondary-700: #008484;
  --nve-secondary-800: #006060;
  --nve-secondary-900: #003E3E;
  --nve-secondary-950: #001E1E;

  /* 强调色 - 警告橙系 */
  --nve-accent-50:  #FFF0E6;
  --nve-accent-100: #FFD9BF;
  --nve-accent-200: #FFBF99;
  --nve-accent-300: #FFA472;
  --nve-accent-400: #FF8C4C;
  --nve-accent-500: #FF6B1A;  /* 警告橙 */
  --nve-accent-600: #E05A10;
  --nve-accent-700: #B84808;
  --nve-accent-800: #8E3600;
  --nve-accent-900: #682600;
  --nve-accent-950: #3E1600;

  /* 中性色 - 钛灰 */
  --nve-neutral-0:   #FFFFFF;
  --nve-neutral-50:  #F2F4F8;
  --nve-neutral-100: #E0E4EC;
  --nve-neutral-200: #C4CAD6;
  --nve-neutral-300: #A4ACBC;
  --nve-neutral-400: #848EA0;
  --nve-neutral-500: #687080;
  --nve-neutral-600: #505864;
  --nve-neutral-700: #3C424C;
  --nve-neutral-800: #282C34;
  --nve-neutral-900: #181A20;
  --nve-neutral-950: #0A0B0E;

  /* 语义色 - 成功 */
  --nve-success-50:  #E6F9F0;
  --nve-success-100: #B3EDD0;
  --nve-success-200: #80E0B0;
  --nve-success-300: #4CD490;
  --nve-success-400: #26CA78;
  --nve-success-500: #00B85C;
  --nve-success-600: #009E50;
  --nve-success-700: #008444;
  --nve-success-800: #006838;
  --nve-success-900: #004E2C;

  /* 语义色 - 警告 */
  --nve-warning-50:  #FFF8E6;
  --nve-warning-100: #FFEDB3;
  --nve-warning-200: #FFE180;
  --nve-warning-300: #FFD54D;
  --nve-warning-400: #FFCC26;
  --nve-warning-500: #FFC200;
  --nve-warning-600: #D9A600;
  --nve-warning-700: #B38A00;
  --nve-warning-800: #8C6E00;
  --nve-warning-900: #665000;

  /* 语义色 - 错误 */
  --nve-error-50:  #FFE8EC;
  --nve-error-100: #FFB3C0;
  --nve-error-200: #FF8098;
  --nve-error-300: #FF4D70;
  --nve-error-400: #FF264D;
  --nve-error-500: #FF0033;
  --nve-error-600: #D9002C;
  --nve-error-700: #B30024;
  --nve-error-800: #8C001C;
  --nve-error-900: #660016;

  /* 语义色 - 信息 */
  --nve-info-50:  #E6F2FF;
  --nve-info-100: #B3D6FF;
  --nve-info-200: #80BAFF;
  --nve-info-300: #4D9EFF;
  --nve-info-400: #268AFF;
  --nve-info-500: #006FFF;
  --nve-info-600: #005ED9;
  --nve-info-700: #004DB3;
  --nve-info-800: #003C8C;
  --nve-info-900: #002C66;

  /* MOU 状态色 */
  --nve-mou-possibility-idle:    #848EA0;
  --nve-mou-possibility-active:  #3366FF;
  --nve-mou-possibility-warning: #FFC200;
  --nve-mou-possibility-glow:    #00CCCC;
  --nve-mou-oracle-idle:         #9098A8;
  --nve-mou-oracle-active:       #00CCCC;
  --nve-mou-oracle-warning:      #FF6B1A;
  --nve-mou-oracle-glow:         #80EDED;
  --nve-mou-censor-idle:         #848EA0;
  --nve-mou-censor-active:       #FF0033;
  --nve-mou-censor-warning:      #FFC200;
  --nve-mou-censor-glow:         #FF8098;
  --nve-mou-flow-idle:           #708088;
  --nve-mou-flow-active:         #3366FF;
  --nve-mou-flow-warning:        #FFC200;
  --nve-mou-flow-glow:           #9EBEFA;

  /* 背景色 */
  --nve-bg-default:   #E8ECF2;   /* 钛白 */
  --nve-bg-paper:     #F0F2F8;   /* 编辑器背景 */
  --nve-bg-elevated:  #F8FAFD;   /* 提升表面 */
  --nve-bg-overlay:   rgba(24, 26, 32, 0.52);

  /* 表面色 */
  --nve-surface-1: #FFFFFF;
  --nve-surface-2: #F0F4F8;
  --nve-surface-3: #E0E6F0;
  --nve-surface-4: #D0D8E4;

  /* 文字色 */
  --nve-text-primary:   #181A20;
  --nve-text-secondary: #505864;
  --nve-text-tertiary:  #687080;
  --nve-text-disabled:  rgba(24, 26, 32, 0.38);
  --nve-text-inverse:   #FFFFFF;
  --nve-text-link:      #2852CC;

  /* 边框色 */
  --nve-border-default: rgba(24, 26, 32, 0.14);
  --nve-border-hover:   rgba(24, 26, 32, 0.28);
  --nve-border-active:  rgba(51, 102, 255, 0.50);
  --nve-border-focus:   rgba(51, 102, 255, 0.75);
  --nve-border-error:   rgba(255, 0, 51, 0.50);

  /* 渐变色 */
  --nve-gradient-hero:   linear-gradient(135deg, #3366FF 0%, #00CCCC 50%, #FF6B1A 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(51, 102, 255, 0.08) 0%, rgba(0, 204, 204, 0.04) 100%);
  --nve-gradient-button: linear-gradient(135deg, #3366FF 0%, #568CF6 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 30% 20%, rgba(0, 204, 204, 0.12) 0%, transparent 55%),
                          radial-gradient(ellipse at 70% 80%, rgba(51, 102, 255, 0.08) 0%, transparent 50%);

  /* 阴影 */
  --nve-shadow-sm: 0 1px 2px rgba(51, 102, 255, 0.06), 0 1px 3px rgba(24, 26, 32, 0.04);
  --nve-shadow-md: 0 4px 6px rgba(51, 102, 255, 0.08), 0 2px 4px rgba(24, 26, 32, 0.06);
  --nve-shadow-lg: 0 10px 15px rgba(51, 102, 255, 0.10), 0 4px 6px rgba(24, 26, 32, 0.08);
  --nve-shadow-xl: 0 20px 25px rgba(51, 102, 255, 0.12), 0 10px 10px rgba(24, 26, 32, 0.10);
  --nve-shadow-glow: 0 0 20px rgba(51, 102, 255, 0.30), 0 0 40px rgba(0, 204, 204, 0.15);
}
```

#### 暗色模式色板

```css
/* ========== 科幻未来主题 — 暗色模式 ========== */
[data-theme="scifi"][data-mode="dark"] {
  /* 主色调 - 暗电光蓝 */
  --nve-primary-50:  #060E24;
  --nve-primary-100: #0E1E4A;
  --nve-primary-200: #162E72;
  --nve-primary-300: #1F409F;
  --nve-primary-400: #2852CC;
  --nve-primary-500: #3366FF;
  --nve-primary-600: #568CF6;
  --nve-primary-700: #77A2F8;
  --nve-primary-800: #9EBEFA;
  --nve-primary-900: #C5DAFC;
  --nve-primary-950: #E8F0FE;

  /* 辅助色 - 暗霓虹青 */
  --nve-secondary-50:  #001E1E;
  --nve-secondary-100: #003E3E;
  --nve-secondary-200: #006060;
  --nve-secondary-300: #008484;
  --nve-secondary-400: #00A8A8;
  --nve-secondary-500: #00CCCC;
  --nve-secondary-600: #26E0E0;
  --nve-secondary-700: #4DE6E6;
  --nve-secondary-800: #80EDED;
  --nve-secondary-900: #B3F5F5;
  --nve-secondary-950: #E6FCFC;

  /* 强调色 - 暗警告橙 */
  --nve-accent-50:  #3E1600;
  --nve-accent-100: #682600;
  --nve-accent-200: #8E3600;
  --nve-accent-300: #B84808;
  --nve-accent-400: #E05A10;
  --nve-accent-500: #FF6B1A;
  --nve-accent-600: #FF8C4C;
  --nve-accent-700: #FFA472;
  --nve-accent-800: #FFBF99;
  --nve-accent-900: #FFD9BF;
  --nve-accent-950: #FFF0E6;

  /* 中性色 - 暗钛灰 */
  --nve-neutral-0:   #0A0B0E;
  --nve-neutral-50:  #181A20;
  --nve-neutral-100: #282C34;
  --nve-neutral-200: #3C424C;
  --nve-neutral-300: #505864;
  --nve-neutral-400: #687080;
  --nve-neutral-500: #848EA0;
  --nve-neutral-600: #A4ACBC;
  --nve-neutral-700: #C4CAD6;
  --nve-neutral-800: #E0E4EC;
  --nve-neutral-900: #F2F4F8;
  --nve-neutral-950: #FFFFFF;

  /* 背景色（暗） */
  --nve-bg-default:   #0C0E14;   /* 深空黑 */
  --nve-bg-paper:     #14181E;   /* 编辑器背景 */
  --nve-bg-elevated:  #1C2028;   /* 卡片背景 */
  --nve-bg-overlay:   rgba(0, 0, 0, 0.78);

  /* 表面色（暗） */
  --nve-surface-1: #181A20;
  --nve-surface-2: #22262E;
  --nve-surface-3: #2C3038;
  --nve-surface-4: #363A44;

  /* 文字色（暗） */
  --nve-text-primary:   #E0E4EC;
  --nve-text-secondary: #848EA0;
  --nve-text-tertiary:  #687080;
  --nve-text-disabled:  rgba(224, 228, 236, 0.38);
  --nve-text-inverse:   #0A0B0E;
  --nve-text-link:      #77A2F8;

  /* 边框色（暗） */
  --nve-border-default: rgba(224, 228, 236, 0.12);
  --nve-border-hover:   rgba(224, 228, 236, 0.24);
  --nve-border-active:  rgba(51, 102, 255, 0.50);
  --nve-border-focus:   rgba(51, 102, 255, 0.75);
  --nve-border-error:   rgba(255, 0, 51, 0.50);

  /* 渐变色（暗） */
  --nve-gradient-hero:   linear-gradient(135deg, #568CF6 0%, #26E0E0 50%, #FF8C4C 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(86, 140, 246, 0.15) 0%, rgba(38, 224, 224, 0.08) 100%);
  --nve-gradient-button: linear-gradient(135deg, #3366FF 0%, #77A2F8 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 40% 25%, rgba(0, 204, 204, 0.18) 0%, transparent 55%),
                          radial-gradient(ellipse at 60% 75%, rgba(51, 102, 255, 0.12) 0%, transparent 50%);

  /* 阴影（暗） */
  --nve-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.30), 0 1px 3px rgba(51, 102, 255, 0.08);
  --nve-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.35), 0 2px 4px rgba(51, 102, 255, 0.10);
  --nve-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.40), 0 4px 6px rgba(51, 102, 255, 0.12);
  --nve-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.45), 0 10px 10px rgba(51, 102, 255, 0.14);
  --nve-shadow-glow: 0 0 25px rgba(51, 102, 255, 0.35), 0 0 50px rgba(0, 204, 204, 0.20);
}
```

---

### 2.5 历史架空主题 (Historical)

#### 灵感来源

历史架空主题的灵感来源于**古籍卷轴与宫殿建筑**——朱砂印章的朱红、宣纸的米黄、青铜器的青绿锈迹。主色调取自**朱砂红**（中国传统印章的经典色彩），象征权威与正统；辅助色为**石青**（青绿山水画的矿物颜料），强调色为**金色**（皇权与荣耀）。暗色模式如烛光下的书房，温暖的琥珀光映照着泛黄的古籍。

#### 亮色模式色板

```css
/* ========== 历史架空主题 — 亮色模式 ========== */
[data-theme="historical"][data-mode="light"] {
  /* 主色调 - 朱砂红系 */
  --nve-primary-50:  #FCEAE8;
  --nve-primary-100: #F5C8C2;
  --nve-primary-200: #EEA298;
  --nve-primary-300: #E77C6E;
  --nve-primary-400: #E05E4C;
  --nve-primary-500: #C45040;  /* 朱砂红 */
  --nve-primary-600: #A84032;
  --nve-primary-700: #8C3226;
  --nve-primary-800: #70241C;
  --nve-primary-900: #541812;
  --nve-primary-950: #3A0E0A;

  /* 辅助色 - 石青系 */
  --nve-secondary-50:  #E8F2F0;
  --nve-secondary-100: #C2DDD8;
  --nve-secondary-200: #98C4BC;
  --nve-secondary-300: #6EABA0;
  --nve-secondary-400: #4C9688;
  --nve-secondary-500: #3A7A6E;  /* 石青 */
  --nve-secondary-600: #2E645A;
  --nve-secondary-700: #225046;
  --nve-secondary-800: #183C34;
  --nve-secondary-900: #0E2A24;
  --nve-secondary-950: #061A14;

  /* 强调色 - 金色系 */
  --nve-accent-50:  #FBF5E0;
  --nve-accent-100: #F2E4B3;
  --nve-accent-200: #E8D280;
  --nve-accent-300: #DEC04D;
  --nve-accent-400: #D4B026;
  --nve-accent-500: #B8941A;  /* 古铜金 */
  --nve-accent-600: #9A7A14;
  --nve-accent-700: #7C620E;
  --nve-accent-800: #5E4A08;
  --nve-accent-900: #403204;
  --nve-accent-950: #2A2000;

  /* 中性色 - 宣纸米 */
  --nve-neutral-0:   #FFFFFF;
  --nve-neutral-50:  #FCFAF5;
  --nve-neutral-100: #F2EDE4;
  --nve-neutral-200: #E4DACC;
  --nve-neutral-300: #CFC4B0;
  --nve-neutral-400: #B8AA90;
  --nve-neutral-500: #9E8E70;
  --nve-neutral-600: #827256;
  --nve-neutral-700: #665840;
  --nve-neutral-800: #4A3E2C;
  --nve-neutral-900: #322818;
  --nve-neutral-950: #1E180C;

  /* 语义色 - 成功 */
  --nve-success-50:  #E6F0E8;
  --nve-success-100: #B3D4B8;
  --nve-success-200: #80B888;
  --nve-success-300: #4D9C58;
  --nve-success-400: #268A34;
  --nve-success-500: #1A7228;
  --nve-success-600: #145E20;
  --nve-success-700: #104A1A;
  --nve-success-800: #0C3814;
  --nve-success-900: #08260E;

  /* 语义色 - 警告 */
  --nve-warning-50:  #F5F0E0;
  --nve-warning-100: #E2D4A8;
  --nve-warning-200: #CEB870;
  --nve-warning-300: #BA9C40;
  --nve-warning-400: #A88828;
  --nve-warning-500: #8E7018;
  --nve-warning-600: #765C10;
  --nve-warning-700: #5E4808;
  --nve-warning-800: #483400;
  --nve-warning-900: #322400;

  /* 语义色 - 错误 */
  --nve-error-50:  #F5E0DC;
  --nve-error-100: #E2A89C;
  --nve-error-200: #CE7060;
  --nve-error-300: #BA4028;
  --nve-error-400: #A82810;
  --nve-error-500: #8E1C08;
  --nve-error-600: #761400;
  --nve-error-700: #5E0E00;
  --nve-error-800: #480800;
  --nve-error-900: #320400;

  /* 语义色 - 信息 */
  --nve-info-50:  #E0E8F0;
  --nve-info-100: #9CB8D0;
  --nve-info-200: #6088B0;
  --nve-info-300: #305C90;
  --nve-info-400: #184078;
  --nve-info-500: #0C3060;
  --nve-info-600: #082650;
  --nve-info-700: #041E40;
  --nve-info-800: #001630;
  --nve-info-900: #001022;

  /* MOU 状态色 */
  --nve-mou-possibility-idle:    #B8AA90;
  --nve-mou-possibility-active:  #C45040;
  --nve-mou-possibility-warning: #B8941A;
  --nve-mou-possibility-glow:    #3A7A6E;
  --nve-mou-oracle-idle:         #C0B098;
  --nve-mou-oracle-active:       #B8941A;
  --nve-mou-oracle-warning:      #C45040;
  --nve-mou-oracle-glow:         #F2E4B3;
  --nve-mou-censor-idle:         #B8AA90;
  --nve-mou-censor-active:       #C45040;
  --nve-mou-censor-warning:      #B8941A;
  --nve-mou-censor-glow:         #E77C6E;
  --nve-mou-flow-idle:           #90A088;
  --nve-mou-flow-active:         #3A7A6E;
  --nve-mou-flow-warning:        #B8941A;
  --nve-mou-flow-glow:           #98C4BC;

  /* 背景色 */
  --nve-bg-default:   #F5EDE0;   /* 宣纸米黄 */
  --nve-bg-paper:     #FAF5EC;   /* 编辑器背景 */
  --nve-bg-elevated:  #FDFAF5;   /* 提升表面 */
  --nve-bg-overlay:   rgba(50, 40, 24, 0.48);

  /* 表面色 */
  --nve-surface-1: #FCFAF5;
  --nve-surface-2: #F5F0E4;
  --nve-surface-3: #E8E0D0;
  --nve-surface-4: #DCD0BC;

  /* 文字色 */
  --nve-text-primary:   #322818;
  --nve-text-secondary: #827256;
  --nve-text-tertiary:  #9E8E70;
  --nve-text-disabled:  rgba(50, 40, 24, 0.38);
  --nve-text-inverse:   #FCFAF5;
  --nve-text-link:      #A84032;

  /* 边框色 */
  --nve-border-default: rgba(50, 40, 24, 0.14);
  --nve-border-hover:   rgba(50, 40, 24, 0.26);
  --nve-border-active:  rgba(196, 80, 64, 0.48);
  --nve-border-focus:   rgba(196, 80, 64, 0.72);
  --nve-border-error:   rgba(142, 28, 8, 0.48);

  /* 渐变色 */
  --nve-gradient-hero:   linear-gradient(135deg, #C45040 0%, #3A7A6E 40%, #B8941A 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(196, 80, 64, 0.06) 0%, rgba(58, 122, 110, 0.04) 100%);
  --nve-gradient-button: linear-gradient(135deg, #C45040 0%, #E05E4C 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 35% 25%, rgba(184, 148, 26, 0.10) 0%, transparent 55%),
                          radial-gradient(ellipse at 65% 75%, rgba(196, 80, 64, 0.06) 0%, transparent 50%);

  /* 阴影 */
  --nve-shadow-sm: 0 1px 2px rgba(50, 40, 24, 0.08), 0 1px 3px rgba(50, 40, 24, 0.04);
  --nve-shadow-md: 0 4px 6px rgba(50, 40, 24, 0.10), 0 2px 4px rgba(50, 40, 24, 0.06);
  --nve-shadow-lg: 0 10px 15px rgba(50, 40, 24, 0.12), 0 4px 6px rgba(50, 40, 24, 0.08);
  --nve-shadow-xl: 0 20px 25px rgba(50, 40, 24, 0.14), 0 10px 10px rgba(50, 40, 24, 0.10);
  --nve-shadow-glow: 0 0 20px rgba(196, 80, 64, 0.25), 0 0 40px rgba(184, 148, 26, 0.12);
}
```

#### 暗色模式色板

```css
/* ========== 历史架空主题 — 暗色模式 ========== */
[data-theme="historical"][data-mode="dark"] {
  /* 主色调 - 暗朱砂 */
  --nve-primary-50:  #3A0E0A;
  --nve-primary-100: #541812;
  --nve-primary-200: #70241C;
  --nve-primary-300: #8C3226;
  --nve-primary-400: #A84032;
  --nve-primary-500: #C45040;
  --nve-primary-600: #E05E4C;
  --nve-primary-700: #E77C6E;
  --nve-primary-800: #EEA298;
  --nve-primary-900: #F5C8C2;
  --nve-primary-950: #FCEAE8;

  /* 辅助色 - 暗石青 */
  --nve-secondary-50:  #061A14;
  --nve-secondary-100: #0E2A24;
  --nve-secondary-200: #183C34;
  --nve-secondary-300: #225046;
  --nve-secondary-400: #2E645A;
  --nve-secondary-500: #3A7A6E;
  --nve-secondary-600: #4C9688;
  --nve-secondary-700: #6EABA0;
  --nve-secondary-800: #98C4BC;
  --nve-secondary-900: #C2DDD8;
  --nve-secondary-950: #E8F2F0;

  /* 强调色 - 暗金色 */
  --nve-accent-50:  #2A2000;
  --nve-accent-100: #403204;
  --nve-accent-200: #5E4A08;
  --nve-accent-300: #7C620E;
  --nve-accent-400: #9A7A14;
  --nve-accent-500: #B8941A;
  --nve-accent-600: #D4B026;
  --nve-accent-700: #DEC04D;
  --nve-accent-800: #E8D280;
  --nve-accent-900: #F2E4B3;
  --nve-accent-950: #FBF5E0;

  /* 中性色 - 暗宣纸 */
  --nve-neutral-0:   #1E180C;
  --nve-neutral-50:  #322818;
  --nve-neutral-100: #4A3E2C;
  --nve-neutral-200: #665840;
  --nve-neutral-300: #827256;
  --nve-neutral-400: #9E8E70;
  --nve-neutral-500: #B8AA90;
  --nve-neutral-600: #CFC4B0;
  --nve-neutral-700: #E4DACC;
  --nve-neutral-800: #F2EDE4;
  --nve-neutral-900: #FCFAF5;
  --nve-neutral-950: #FFFFFF;

  /* 背景色（暗） */
  --nve-bg-default:   #1E1810;   /* 暗棕 - 烛光书房 */
  --nve-bg-paper:     #282018;   /* 编辑器背景 */
  --nve-bg-elevated:  #342A20;   /* 卡片背景 */
  --nve-bg-overlay:   rgba(0, 0, 0, 0.70);

  /* 表面色（暗） */
  --nve-surface-1: #2E2418;
  --nve-surface-2: #3A3024;
  --nve-surface-3: #463C30;
  --nve-surface-4: #52483C;

  /* 文字色（暗） */
  --nve-text-primary:   #F0E8D8;
  --nve-text-secondary: #B8AA90;
  --nve-text-tertiary:  #9E8E70;
  --nve-text-disabled:  rgba(240, 232, 216, 0.38);
  --nve-text-inverse:   #1E180C;
  --nve-text-link:      #E77C6E;

  /* 边框色（暗） */
  --nve-border-default: rgba(240, 232, 216, 0.12);
  --nve-border-hover:   rgba(240, 232, 216, 0.24);
  --nve-border-active:  rgba(196, 80, 64, 0.48);
  --nve-border-focus:   rgba(196, 80, 64, 0.72);
  --nve-border-error:   rgba(142, 28, 8, 0.48);

  /* 渐变色（暗） */
  --nve-gradient-hero:   linear-gradient(135deg, #E05E4C 0%, #4C9688 40%, #D4B026 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(224, 94, 76, 0.12) 0%, rgba(76, 150, 136, 0.08) 100%);
  --nve-gradient-button: linear-gradient(135deg, #C45040 0%, #E77C6E 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 40% 25%, rgba(184, 148, 26, 0.14) 0%, transparent 55%),
                          radial-gradient(ellipse at 60% 75%, rgba(224, 94, 76, 0.08) 0%, transparent 50%);

  /* 阴影（暗） */
  --nve-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.18);
  --nve-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.30), 0 2px 4px rgba(0, 0, 0, 0.22);
  --nve-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.35), 0 4px 6px rgba(0, 0, 0, 0.26);
  --nve-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.40), 0 10px 10px rgba(0, 0, 0, 0.30);
  --nve-shadow-glow: 0 0 25px rgba(196, 80, 64, 0.30), 0 0 50px rgba(184, 148, 26, 0.15);
}
```

---

### 2.6 都市异能主题 (Urban Fantasy)

#### 灵感来源

都市异能主题的灵感来源于**霓虹都市与隐藏魔法**——东京新宿的霓虹灯牌、午夜雨后的街道倒影、隐藏在摩天楼间的结界。主色调取自**霓虹紫**（城市夜景中LED的梦幻紫光），象征异能的神秘与不可预测；辅助色为**霓虹青**（赛博朋克城市的标志性色彩），强调色为**霓虹粉**（ nightclub 的迷幻灯光）。暗色模式下如午夜的城市街头，黑暗中的霓虹光更加耀眼。

#### 亮色模式色板

```css
/* ========== 都市异能主题 — 亮色模式 ========== */
[data-theme="urban"][data-mode="light"] {
  /* 主色调 - 霓虹紫系 */
  --nve-primary-50:  #F5EEFC;
  --nve-primary-100: #E4D2F5;
  --nve-primary-200: #D0B0ED;
  --nve-primary-300: #BC8EE5;
  --nve-primary-400: #A870DE;
  --nve-primary-500: #9350D0;  /* 霓虹紫 */
  --nve-primary-600: #7A3AB5;
  --nve-primary-700: #622A9A;
  --nve-primary-800: #4C1E80;
  --nve-primary-900: #361260;
  --nve-primary-950: #220840;

  /* 辅助色 - 霓虹青系 */
  --nve-secondary-50:  #E8FAFA;
  --nve-secondary-100: #B8F0F0;
  --nve-secondary-200: #88E4E4;
  --nve-secondary-300: #58D8D8;
  --nve-secondary-400: #32D0D0;
  --nve-secondary-500: #20B8B8;  /* 霓虹青 */
  --nve-secondary-600: #189A9A;
  --nve-secondary-700: #127C7C;
  --nve-secondary-800: #0C5E5E;
  --nve-secondary-900: #064040;
  --nve-secondary-950: #022222;

  /* 强调色 - 霓虹粉系 */
  --nve-accent-50:  #FCEEF5;
  --nve-accent-100: #F5D0E2;
  --nve-accent-200: #EEAECC;
  --nve-accent-300: #E78CB6;
  --nve-accent-400: #E070A4;
  --nve-accent-500: #D05088;  /* 霓虹粉 */
  --nve-accent-600: #B03C70;
  --nve-accent-700: #902C5C;
  --nve-accent-800: #701E48;
  --nve-accent-900: #501034;
  --nve-accent-950: #380820;

  /* 中性色 - 沥青灰 */
  --nve-neutral-0:   #FFFFFF;
  --nve-neutral-50:  #F5F5F7;
  --nve-neutral-100: #E8E8EC;
  --nve-neutral-200: #D0D0D8;
  --nve-neutral-300: #B4B4C0;
  --nve-neutral-400: #9696A6;
  --nve-neutral-500: #78788C;
  --nve-neutral-600: #5E5E72;
  --nve-neutral-700: #464658;
  --nve-neutral-800: #2E2E3E;
  --nve-neutral-900: #1A1A28;
  --nve-neutral-950: #0C0C18;

  /* 语义色 - 成功 */
  --nve-success-50:  #E8F5EC;
  --nve-success-100: #B8E0C2;
  --nve-success-200: #88CB98;
  --nve-success-300: #58B670;
  --nve-success-400: #32A650;
  --nve-success-500: #1A9038;
  --nve-success-600: #147A2E;
  --nve-success-700: #0E6426;
  --nve-success-800: #084E1C;
  --nve-success-900: #043814;

  /* 语义色 - 警告 */
  --nve-warning-50:  #FFF8E0;
  --nve-warning-100: #FFECB0;
  --nve-warning-200: #FFE080;
  --nve-warning-300: #FFD450;
  --nve-warning-400: #FFCA30;
  --nve-warning-500: #F0B818;
  --nve-warning-600: #D09C10;
  --nve-warning-700: #B08008;
  --nve-warning-800: #906400;
  --nve-warning-900: #704800;

  /* 语义色 - 错误 */
  --nve-error-50:  #FFE8E8;
  --nve-error-100: #FFB8B8;
  --nve-error-200: #FF8888;
  --nve-error-300: #FF5858;
  --nve-error-400: #FF3030;
  --nve-error-500: #E81818;
  --nve-error-600: #C81010;
  --nve-error-700: #A80808;
  --nve-error-800: #880000;
  --nve-error-900: #680000;

  /* 语义色 - 信息 */
  --nve-info-50:  #E8E8FF;
  --nve-info-100: #B8B8FF;
  --nve-info-200: #8888FF;
  --nve-info-300: #5858FF;
  --nve-info-400: #3030FF;
  --nve-info-500: #1818F0;
  --nve-info-600: #1010D0;
  --nve-info-700: #0808B0;
  --nve-info-800: #000090;
  --nve-info-900: #000070;

  /* MOU 状态色 */
  --nve-mou-possibility-idle:    #9696A6;
  --nve-mou-possibility-active:  #9350D0;
  --nve-mou-possibility-warning: #F0B818;
  --nve-mou-possibility-glow:    #58D8D8;
  --nve-mou-oracle-idle:         #9E9EAC;
  --nve-mou-oracle-active:       #20B8B8;
  --nve-mou-oracle-warning:      #D05088;
  --nve-mou-oracle-glow:         #B8F0F0;
  --nve-mou-censor-idle:         #9696A6;
  --nve-mou-censor-active:       #E81818;
  --nve-mou-censor-warning:      #F0B818;
  --nve-mou-censor-glow:         #FF8888;
  --nve-mou-flow-idle:           #78808A;
  --nve-mou-flow-active:         #9350D0;
  --nve-mou-flow-warning:        #F0B818;
  --nve-mou-flow-glow:           #D0B0ED;

  /* 背景色 */
  --nve-bg-default:   #ECECF2;   /* 都市灰白 */
  --nve-bg-paper:     #F2F2F8;   /* 编辑器背景 */
  --nve-bg-elevated:  #F8F8FC;   /* 提升表面 */
  --nve-bg-overlay:   rgba(26, 26, 40, 0.52);

  /* 表面色 */
  --nve-surface-1: #FFFFFF;
  --nve-surface-2: #F0F0F6;
  --nve-surface-3: #E4E4EE;
  --nve-surface-4: #D8D8E6;

  /* 文字色 */
  --nve-text-primary:   #1A1A28;
  --nve-text-secondary: #5E5E72;
  --nve-text-tertiary:  #78788C;
  --nve-text-disabled:  rgba(26, 26, 40, 0.38);
  --nve-text-inverse:   #FFFFFF;
  --nve-text-link:      #7A3AB5;

  /* 边框色 */
  --nve-border-default: rgba(26, 26, 40, 0.14);
  --nve-border-hover:   rgba(26, 26, 40, 0.28);
  --nve-border-active:  rgba(147, 80, 208, 0.50);
  --nve-border-focus:   rgba(147, 80, 208, 0.75);
  --nve-border-error:   rgba(232, 24, 24, 0.50);

  /* 渐变色 */
  --nve-gradient-hero:   linear-gradient(135deg, #9350D0 0%, #20B8B8 50%, #D05088 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(147, 80, 208, 0.08) 0%, rgba(32, 184, 184, 0.04) 100%);
  --nve-gradient-button: linear-gradient(135deg, #9350D0 0%, #A870DE 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 30% 20%, rgba(147, 80, 208, 0.12) 0%, transparent 55%),
                          radial-gradient(ellipse at 70% 80%, rgba(32, 184, 184, 0.08) 0%, transparent 50%);

  /* 阴影 */
  --nve-shadow-sm: 0 1px 2px rgba(26, 26, 40, 0.06), 0 1px 3px rgba(26, 26, 40, 0.04);
  --nve-shadow-md: 0 4px 6px rgba(26, 26, 40, 0.08), 0 2px 4px rgba(26, 26, 40, 0.06);
  --nve-shadow-lg: 0 10px 15px rgba(26, 26, 40, 0.10), 0 4px 6px rgba(26, 26, 40, 0.08);
  --nve-shadow-xl: 0 20px 25px rgba(26, 26, 40, 0.12), 0 10px 10px rgba(26, 26, 40, 0.10);
  --nve-shadow-glow: 0 0 20px rgba(147, 80, 208, 0.30), 0 0 40px rgba(32, 184, 184, 0.15);
}
```

#### 暗色模式色板

```css
/* ========== 都市异能主题 — 暗色模式 ========== */
[data-theme="urban"][data-mode="dark"] {
  /* 主色调 - 暗霓虹紫 */
  --nve-primary-50:  #220840;
  --nve-primary-100: #361260;
  --nve-primary-200: #4C1E80;
  --nve-primary-300: #622A9A;
  --nve-primary-400: #7A3AB5;
  --nve-primary-500: #9350D0;
  --nve-primary-600: #A870DE;
  --nve-primary-700: #BC8EE5;
  --nve-primary-800: #D0B0ED;
  --nve-primary-900: #E4D2F5;
  --nve-primary-950: #F5EEFC;

  /* 辅助色 - 暗霓虹青 */
  --nve-secondary-50:  #022222;
  --nve-secondary-100: #064040;
  --nve-secondary-200: #0C5E5E;
  --nve-secondary-300: #127C7C;
  --nve-secondary-400: #189A9A;
  --nve-secondary-500: #20B8B8;
  --nve-secondary-600: #32D0D0;
  --nve-secondary-700: #58D8D8;
  --nve-secondary-800: #88E4E4;
  --nve-secondary-900: #B8F0F0;
  --nve-secondary-950: #E8FAFA;

  /* 强调色 - 暗霓虹粉 */
  --nve-accent-50:  #380820;
  --nve-accent-100: #501034;
  --nve-accent-200: #701E48;
  --nve-accent-300: #902C5C;
  --nve-accent-400: #B03C70;
  --nve-accent-500: #D05088;
  --nve-accent-600: #E070A4;
  --nve-accent-700: #E78CB6;
  --nve-accent-800: #EEAECC;
  --nve-accent-900: #F5D0E2;
  --nve-accent-950: #FCEEF5;

  /* 中性色 - 暗沥青灰 */
  --nve-neutral-0:   #0C0C18;
  --nve-neutral-50:  #1A1A28;
  --nve-neutral-100: #2E2E3E;
  --nve-neutral-200: #464658;
  --nve-neutral-300: #5E5E72;
  --nve-neutral-400: #78788C;
  --nve-neutral-500: #9696A6;
  --nve-neutral-600: #B4B4C0;
  --nve-neutral-700: #D0D0D8;
  --nve-neutral-800: #E8E8EC;
  --nve-neutral-900: #F5F5F7;
  --nve-neutral-950: #FFFFFF;

  /* 背景色（暗） */
  --nve-bg-default:   #12121E;   /* 午夜都市黑 */
  --nve-bg-paper:     #1A1A2A;   /* 编辑器背景 */
  --nve-bg-elevated:  #222234;   /* 卡片背景 */
  --nve-bg-overlay:   rgba(0, 0, 0, 0.80);

  /* 表面色（暗） */
  --nve-surface-1: #1E1E2E;
  --nve-surface-2: #28283A;
  --nve-surface-3: #323246;
  --nve-surface-4: #3C3C52;

  /* 文字色（暗） */
  --nve-text-primary:   #E8E8EC;
  --nve-text-secondary: #9696A6;
  --nve-text-tertiary:  #78788C;
  --nve-text-disabled:  rgba(232, 232, 236, 0.38);
  --nve-text-inverse:   #0C0C18;
  --nve-text-link:      #A870DE;

  /* 边框色（暗） */
  --nve-border-default: rgba(232, 232, 236, 0.12);
  --nve-border-hover:   rgba(232, 232, 236, 0.24);
  --nve-border-active:  rgba(147, 80, 208, 0.50);
  --nve-border-focus:   rgba(147, 80, 208, 0.75);
  --nve-border-error:   rgba(232, 24, 24, 0.50);

  /* 渐变色（暗） */
  --nve-gradient-hero:   linear-gradient(135deg, #A870DE 0%, #32D0D0 50%, #E070A4 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(168, 112, 222, 0.15) 0%, rgba(50, 208, 208, 0.08) 100%);
  --nve-gradient-button: linear-gradient(135deg, #9350D0 0%, #BC8EE5 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 40% 25%, rgba(147, 80, 208, 0.20) 0%, transparent 55%),
                          radial-gradient(ellipse at 60% 75%, rgba(32, 184, 184, 0.12) 0%, transparent 50%);

  /* 阴影（暗） */
  --nve-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.30), 0 1px 3px rgba(0, 0, 0, 0.20);
  --nve-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.35), 0 2px 4px rgba(0, 0, 0, 0.25);
  --nve-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.40), 0 4px 6px rgba(0, 0, 0, 0.30);
  --nve-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.45), 0 10px 10px rgba(0, 0, 0, 0.35);
  --nve-shadow-glow: 0 0 25px rgba(147, 80, 208, 0.35), 0 0 50px rgba(32, 184, 184, 0.20);
}
```

---

### 2.7 恐怖惊悚主题 (Horror)

#### 灵感来源

恐怖惊悚主题的灵感来源于**废弃精神病院与血月之夜**——腐朽木头的棕灰、干涸血迹的暗褐、鬼火般的惨绿微光。主色调取自**腐骨白**（泛黄的灰白色，如腐朽的骨骼），象征死亡与衰败；辅助色为**暗血红**（凝固血液的深红色），强调色为**鬼火绿**（磷火般的幽绿色）。整体氛围如步入一座废弃多年的古宅，每一步都弥漫着不安与恐惧。

#### 亮色模式色板

```css
/* ========== 恐怖惊悚主题 — 亮色模式 ========== */
[data-theme="horror"][data-mode="light"] {
  /* 主色调 - 腐骨白/灰褐系 */
  --nve-primary-50:  #F5F2EE;
  --nve-primary-100: #E4DED6;
  --nve-primary-200: #CFC6B8;
  --nve-primary-300: #BAAE9A;
  --nve-primary-400: #A5967C;
  --nve-primary-500: #8C7A62;  /* 腐木灰褐 */
  --nve-primary-600: #72604C;
  --nve-primary-700: #584A38;
  --nve-primary-800: #403426;
  --nve-primary-900: #282016;
  --nve-primary-950: #181208;

  /* 辅助色 - 暗血红系 */
  --nve-secondary-50:  #F0E0E0;
  --nve-secondary-100: #D4A8A8;
  --nve-secondary-200: #B87070;
  --nve-secondary-300: #9C4040;
  --nve-secondary-400: #802020;
  --nve-secondary-500: #6A1010;  /* 暗血红 */
  --nve-secondary-600: #540808;
  --nve-secondary-700: #420404;
  --nve-secondary-800: #300202;
  --nve-secondary-900: #1E0000;
  --nve-secondary-950: #0E0000;

  /* 强调色 - 鬼火绿系 */
  --nve-accent-50:  #E8F0E8;
  --nve-accent-100: #B8D4B8;
  --nve-accent-200: #88B888;
  --nve-accent-300: #589C58;
  --nve-accent-400: #388838;
  --nve-accent-500: #206E20;  /* 鬼火绿 */
  --nve-accent-600: #165816;
  --nve-accent-700: #0E420E;
  --nve-accent-800: #082E08;
  --nve-accent-900: #041A04;
  --nve-accent-950: #020A02;

  /* 中性色 - 灰烬灰 */
  --nve-neutral-0:   #FFFFFF;
  --nve-neutral-50:  #F0EFED;
  --nve-neutral-100: #DCDAD6;
  --nve-neutral-200: #C0BCB6;
  --nve-neutral-300: #A09C94;
  --nve-neutral-400: #848078;
  --nve-neutral-500: #68645C;
  --nve-neutral-600: #504C44;
  --nve-neutral-700: #3A3630;
  --nve-neutral-800: #28241E;
  --nve-neutral-900: #181410;
  --nve-neutral-950: #0A0806;

  /* 语义色 - 成功 */
  --nve-success-50:  #E0F0E4;
  --nve-success-100: #A8D4B0;
  --nve-success-200: #70B87C;
  --nve-success-300: #409C50;
  --nve-success-400: #208032;
  --nve-success-500: #106A20;
  --nve-success-600: #085418;
  --nve-success-700: #044210;
  --nve-success-800: #022E08;
  --nve-success-900: #001A04;

  /* 语义色 - 警告 */
  --nve-warning-50:  #F0E8D8;
  --nve-warning-100: #D4C0A0;
  --nve-warning-200: #B89868;
  --nve-warning-300: #9C7038;
  --nve-warning-400: #805018;
  --nve-warning-500: #6A3C08;
  --nve-warning-600: #542E00;
  --nve-warning-700: #422200;
  --nve-warning-800: #301800;
  --nve-warning-900: #1E0E00;

  /* 语义色 - 错误 */
  --nve-error-50:  #F0D8D8;
  --nve-error-100: #D4A0A0;
  --nve-error-200: #B86868;
  --nve-error-300: #9C3838;
  --nve-error-400: #801818;
  --nve-error-500: #6A0808;
  --nve-error-600: #540404;
  --nve-error-700: #420202;
  --nve-error-800: #300000;
  --nve-error-900: #1E0000;

  /* 语义色 - 信息 */
  --nve-info-50:  #D8E0E8;
  --nve-info-100: #A0B0C0;
  --nve-info-200: #688098;
  --nve-info-300: #385878;
  --nve-info-400: #183860;
  --nve-info-500: #082848;
  --nve-info-600: #041E3A;
  --nve-info-700: #02162E;
  --nve-info-800: #000E20;
  --nve-info-900: #000614;

  /* MOU 状态色 */
  --nve-mou-possibility-idle:    #848078;
  --nve-mou-possibility-active:  #8C7A62;
  --nve-mou-possibility-warning: #805018;
  --nve-mou-possibility-glow:    #388838;
  --nve-mou-oracle-idle:         #908878;
  --nve-mou-oracle-active:       #6A1010;
  --nve-mou-oracle-warning:      #206E20;
  --nve-mou-oracle-glow:         #B87070;
  --nve-mou-censor-idle:         #848078;
  --nve-mou-censor-active:       #6A1010;
  --nve-mou-censor-warning:      #805018;
  --nve-mou-censor-glow:         #9C4040;
  --nve-mou-flow-idle:           #707868;
  --nve-mou-flow-active:         #8C7A62;
  --nve-mou-flow-warning:        #805018;
  --nve-mou-flow-glow:           #CFC6B8;

  /* 背景色 */
  --nve-bg-default:   #E8E4DC;   /* 旧报纸黄 */
  --nve-bg-paper:     #F0ECE4;   /* 编辑器背景 */
  --nve-bg-elevated:  #F5F2EC;   /* 提升表面 */
  --nve-bg-overlay:   rgba(24, 20, 16, 0.55);

  /* 表面色 */
  --nve-surface-1: #F0EFED;
  --nve-surface-2: #E4E0D8;
  --nve-surface-3: #D4CEC4;
  --nve-surface-4: #C4BCB0;

  /* 文字色 */
  --nve-text-primary:   #181410;
  --nve-text-secondary: #504C44;
  --nve-text-tertiary:  #68645C;
  --nve-text-disabled:  rgba(24, 20, 16, 0.38);
  --nve-text-inverse:   #F0EFED;
  --nve-text-link:      #72604C;

  /* 边框色 */
  --nve-border-default: rgba(24, 20, 16, 0.16);
  --nve-border-hover:   rgba(24, 20, 16, 0.28);
  --nve-border-active:  rgba(140, 122, 98, 0.50);
  --nve-border-focus:   rgba(140, 122, 98, 0.72);
  --nve-border-error:   rgba(106, 16, 16, 0.50);

  /* 渐变色 */
  --nve-gradient-hero:   linear-gradient(135deg, #8C7A62 0%, #6A1010 40%, #206E20 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(140, 122, 98, 0.08) 0%, rgba(106, 16, 16, 0.04) 100%);
  --nve-gradient-button: linear-gradient(135deg, #8C7A62 0%, #A5967C 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 35% 30%, rgba(106, 16, 16, 0.10) 0%, transparent 55%),
                          radial-gradient(ellipse at 65% 70%, rgba(32, 110, 32, 0.08) 0%, transparent 50%);

  /* 阴影 */
  --nve-shadow-sm: 0 1px 2px rgba(24, 20, 16, 0.10), 0 1px 3px rgba(24, 20, 16, 0.06);
  --nve-shadow-md: 0 4px 6px rgba(24, 20, 16, 0.12), 0 2px 4px rgba(24, 20, 16, 0.08);
  --nve-shadow-lg: 0 10px 15px rgba(24, 20, 16, 0.14), 0 4px 6px rgba(24, 20, 16, 0.10);
  --nve-shadow-xl: 0 20px 25px rgba(24, 20, 16, 0.18), 0 10px 10px rgba(24, 20, 16, 0.12);
  --nve-shadow-glow: 0 0 20px rgba(140, 122, 98, 0.25), 0 0 40px rgba(106, 16, 16, 0.12);
}
```

#### 暗色模式色板

```css
/* ========== 恐怖惊悚主题 — 暗色模式 ========== */
[data-theme="horror"][data-mode="dark"] {
  /* 主色调 - 暗腐骨 */
  --nve-primary-50:  #181208;
  --nve-primary-100: #282016;
  --nve-primary-200: #403426;
  --nve-primary-300: #584A38;
  --nve-primary-400: #72604C;
  --nve-primary-500: #8C7A62;
  --nve-primary-600: #A5967C;
  --nve-primary-700: #BAAE9A;
  --nve-primary-800: #CFC6B8;
  --nve-primary-900: #E4DED6;
  --nve-primary-950: #F5F2EE;

  /* 辅助色 - 暗血红 */
  --nve-secondary-50:  #0E0000;
  --nve-secondary-100: #1E0000;
  --nve-secondary-200: #300202;
  --nve-secondary-300: #420404;
  --nve-secondary-400: #540808;
  --nve-secondary-500: #6A1010;
  --nve-secondary-600: #802020;
  --nve-secondary-700: #9C4040;
  --nve-secondary-800: #B87070;
  --nve-secondary-900: #D4A8A8;
  --nve-secondary-950: #F0E0E0;

  /* 强调色 - 暗鬼火绿 */
  --nve-accent-50:  #020A02;
  --nve-accent-100: #041A04;
  --nve-accent-200: #082E08;
  --nve-accent-300: #0E420E;
  --nve-accent-400: #165816;
  --nve-accent-500: #206E20;
  --nve-accent-600: #388838;
  --nve-accent-700: #589C58;
  --nve-accent-800: #88B888;
  --nve-accent-900: #B8D4B8;
  --nve-accent-950: #E8F0E8;

  /* 中性色 - 暗灰烬 */
  --nve-neutral-0:   #0A0806;
  --nve-neutral-50:  #181410;
  --nve-neutral-100: #28241E;
  --nve-neutral-200: #3A3630;
  --nve-neutral-300: #504C44;
  --nve-neutral-400: #68645C;
  --nve-neutral-500: #848078;
  --nve-neutral-600: #A09C94;
  --nve-neutral-700: #C0BCB6;
  --nve-neutral-800: #DCDAD6;
  --nve-neutral-900: #F0EFED;
  --nve-neutral-950: #FFFFFF;

  /* 背景色（暗） */
  --nve-bg-default:   #0E0C08;   /* 地窖黑 */
  --nve-bg-paper:     #161410;   /* 编辑器背景 */
  --nve-bg-elevated:  #1E1C16;   /* 卡片背景 */
  --nve-bg-overlay:   rgba(0, 0, 0, 0.80);

  /* 表面色（暗） */
  --nve-surface-1: #1A1812;
  --nve-surface-2: #24221A;
  --nve-surface-3: #2E2C22;
  --nve-surface-4: #38362A;

  /* 文字色（暗） */
  --nve-text-primary:   #C8C4BC;
  --nve-text-secondary: #848078;
  --nve-text-tertiary:  #68645C;
  --nve-text-disabled:  rgba(200, 196, 188, 0.38);
  --nve-text-inverse:   #0A0806;
  --nve-text-link:      #A5967C;

  /* 边框色（暗） */
  --nve-border-default: rgba(200, 196, 188, 0.10);
  --nve-border-hover:   rgba(200, 196, 188, 0.22);
  --nve-border-active:  rgba(140, 122, 98, 0.50);
  --nve-border-focus:   rgba(140, 122, 98, 0.72);
  --nve-border-error:   rgba(106, 16, 16, 0.50);

  /* 渐变色（暗） */
  --nve-gradient-hero:   linear-gradient(135deg, #A5967C 0%, #802020 40%, #388838 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(165, 150, 124, 0.10) 0%, rgba(128, 32, 32, 0.06) 100%);
  --nve-gradient-button: linear-gradient(135deg, #8C7A62 0%, #BAAE9A 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 30% 30%, rgba(106, 16, 16, 0.12) 0%, transparent 50%),
                          radial-gradient(ellipse at 70% 70%, rgba(32, 110, 32, 0.08) 0%, transparent 50%);

  /* 阴影（暗） */
  --nve-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.30), 0 1px 3px rgba(106, 16, 16, 0.08);
  --nve-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.35), 0 2px 4px rgba(106, 16, 16, 0.10);
  --nve-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.40), 0 4px 6px rgba(106, 16, 16, 0.12);
  --nve-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.45), 0 10px 10px rgba(106, 16, 16, 0.14);
  --nve-shadow-glow: 0 0 25px rgba(106, 16, 16, 0.25), 0 0 50px rgba(56, 136, 56, 0.15);
}
```

---

### 2.8 游戏竞技主题 (Esports)

#### 灵感来源

游戏竞技主题的灵感来源于**电竞舞台与战队徽章**——RGB灯效的炫彩渐变、胜利界面的金光闪耀、能量条的炽热红色。主色调取自**能量橙**（电竞外设标志性色彩），象征激情与活力；辅助色为**胜利金**（冠军奖杯的金色光芒），强调色为**击杀红**（击杀提示的醒目红色）。整体氛围如置身电竞赛事现场，充满速度与竞技感。

#### 亮色模式色板

```css
/* ========== 游戏竞技主题 — 亮色模式 ========== */
[data-theme="esports"][data-mode="light"] {
  /* 主色调 - 能量橙系 */
  --nve-primary-50:  #FFF2E6;
  --nve-primary-100: #FFDBBF;
  --nve-primary-200: #FFC299;
  --nve-primary-300: #FFA94D;
  --nve-primary-400: #FF9626;
  --nve-primary-500: #FF7A00;  /* 能量橙 */
  --nve-primary-600: #E06800;
  --nve-primary-700: #B85200;
  --nve-primary-800: #8C3E00;
  --nve-primary-900: #602A00;
  --nve-primary-950: #381800;

  /* 辅助色 - 胜利金系 */
  --nve-secondary-50:  #FBF5E4;
  --nve-secondary-100: #F0E2B8;
  --nve-secondary-200: #E4CE88;
  --nve-secondary-300: #D8BA58;
  --nve-secondary-400: #CCAA38;
  --nve-secondary-500: #B89628;  /* 胜利金 */
  --nve-secondary-600: #9C7E20;
  --nve-secondary-700: #806618;
  --nve-secondary-800: #645010;
  --nve-secondary-900: #483808;
  --nve-secondary-950: #2E2400;

  /* 强调色 - 击杀红系 */
  --nve-accent-50:  #FFECEC;
  --nve-accent-100: #FFB8B8;
  --nve-accent-200: #FF8080;
  --nve-accent-300: #FF4848;
  --nve-accent-400: #FF2020;
  --nve-accent-500: #F00000;  /* 击杀红 */
  --nve-accent-600: #CC0000;
  --nve-accent-700: #A80000;
  --nve-accent-800: #840000;
  --nve-accent-900: #600000;
  --nve-accent-950: #380000;

  /* 中性色 - 赛场灰 */
  --nve-neutral-0:   #FFFFFF;
  --nve-neutral-50:  #F5F5F7;
  --nve-neutral-100: #E8E8EC;
  --nve-neutral-200: #D0D0D8;
  --nve-neutral-300: #B4B4C0;
  --nve-neutral-400: #9898A8;
  --nve-neutral-500: #7C7C90;
  --nve-neutral-600: #606074;
  --nve-neutral-700: #48485C;
  --nve-neutral-800: #303044;
  --nve-neutral-900: #1A1A2E;
  --nve-neutral-950: #0C0C1A;

  /* 语义色 - 成功 */
  --nve-success-50:  #E6F5E8;
  --nve-success-100: #B8E0BC;
  --nve-success-200: #88CB90;
  --nve-success-300: #58B664;
  --nve-success-400: #32A640;
  --nve-success-500: #1A9028;
  --nve-success-600: #147A20;
  --nve-success-700: #0E641A;
  --nve-success-800: #084E14;
  --nve-success-900: #04380E;

  /* 语义色 - 警告 */
  --nve-warning-50:  #FFF8E0;
  --nve-warning-100: #FFECB0;
  --nve-warning-200: #FFE080;
  --nve-warning-300: #FFD450;
  --nve-warning-400: #FFCA28;
  --nve-warning-500: #FFC000;
  --nve-warning-600: #D9A400;
  --nve-warning-700: #B38800;
  --nve-warning-800: #8C6C00;
  --nve-warning-900: #665000;

  /* 语义色 - 错误 */
  --nve-error-50:  #FFE0E0;
  --nve-error-100: #FFA0A0;
  --nve-error-200: #FF6060;
  --nve-error-300: #FF2020;
  --nve-error-400: #F00000;
  --nve-error-500: #CC0000;
  --nve-error-600: #A80000;
  --nve-error-700: #840000;
  --nve-error-800: #600000;
  --nve-error-900: #380000;

  /* 语义色 - 信息 */
  --nve-info-50:  #E0E8FF;
  --nve-info-100: #A0B8FF;
  --nve-info-200: #6088FF;
  --nve-info-300: #2058FF;
  --nve-info-400: #0038F0;
  --nve-info-500: #002ECC;
  --nve-info-600: #0024A8;
  --nve-info-700: #001A84;
  --nve-info-800: #001260;
  --nve-info-900: #000838;

  /* MOU 状态色 */
  --nve-mou-possibility-idle:    #9898A8;
  --nve-mou-possibility-active:  #FF7A00;
  --nve-mou-possibility-warning: #FFC000;
  --nve-mou-possibility-glow:    #B89628;
  --nve-mou-oracle-idle:         #9E9EB0;
  --nve-mou-oracle-active:       #B89628;
  --nve-mou-oracle-warning:      #F00000;
  --nve-mou-oracle-glow:         #F0E2B8;
  --nve-mou-censor-idle:         #9898A8;
  --nve-mou-censor-active:       #F00000;
  --nve-mou-censor-warning:      #FFC000;
  --nve-mou-censor-glow:         #FF6060;
  --nve-mou-flow-idle:           #788090;
  --nve-mou-flow-active:         #FF7A00;
  --nve-mou-flow-warning:        #FFC000;
  --nve-mou-flow-glow:           #FFC299;

  /* 背景色 */
  --nve-bg-default:   #ECECF0;   /* 赛场灰白 */
  --nve-bg-paper:     #F2F2F6;   /* 编辑器背景 */
  --nve-bg-elevated:  #F8F8FC;   /* 提升表面 */
  --nve-bg-overlay:   rgba(26, 26, 46, 0.52);

  /* 表面色 */
  --nve-surface-1: #FFFFFF;
  --nve-surface-2: #F0F0F4;
  --nve-surface-3: #E4E4EA;
  --nve-surface-4: #D8D8E0;

  /* 文字色 */
  --nve-text-primary:   #1A1A2E;
  --nve-text-secondary: #606074;
  --nve-text-tertiary:  #7C7C90;
  --nve-text-disabled:  rgba(26, 26, 46, 0.38);
  --nve-text-inverse:   #FFFFFF;
  --nve-text-link:      #E06800;

  /* 边框色 */
  --nve-border-default: rgba(26, 26, 46, 0.14);
  --nve-border-hover:   rgba(26, 26, 46, 0.28);
  --nve-border-active:  rgba(255, 122, 0, 0.50);
  --nve-border-focus:   rgba(255, 122, 0, 0.75);
  --nve-border-error:   rgba(240, 0, 0, 0.50);

  /* 渐变色 */
  --nve-gradient-hero:   linear-gradient(135deg, #FF7A00 0%, #B89628 50%, #F00000 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(255, 122, 0, 0.08) 0%, rgba(184, 150, 40, 0.04) 100%);
  --nve-gradient-button: linear-gradient(135deg, #FF7A00 0%, #FF9626 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 30% 20%, rgba(255, 122, 0, 0.12) 0%, transparent 55%),
                          radial-gradient(ellipse at 70% 80%, rgba(184, 150, 40, 0.08) 0%, transparent 50%);

  /* 阴影 */
  --nve-shadow-sm: 0 1px 2px rgba(26, 26, 46, 0.06), 0 1px 3px rgba(26, 26, 46, 0.04);
  --nve-shadow-md: 0 4px 6px rgba(255, 122, 0, 0.08), 0 2px 4px rgba(26, 26, 46, 0.06);
  --nve-shadow-lg: 0 10px 15px rgba(255, 122, 0, 0.10), 0 4px 6px rgba(26, 26, 46, 0.08);
  --nve-shadow-xl: 0 20px 25px rgba(255, 122, 0, 0.12), 0 10px 10px rgba(26, 26, 46, 0.10);
  --nve-shadow-glow: 0 0 20px rgba(255, 122, 0, 0.30), 0 0 40px rgba(184, 150, 40, 0.15);
}
```

#### 暗色模式色板

```css
/* ========== 游戏竞技主题 — 暗色模式 ========== */
[data-theme="esports"][data-mode="dark"] {
  /* 主色调 - 暗能量橙 */
  --nve-primary-50:  #381800;
  --nve-primary-100: #602A00;
  --nve-primary-200: #8C3E00;
  --nve-primary-300: #B85200;
  --nve-primary-400: #E06800;
  --nve-primary-500: #FF7A00;
  --nve-primary-600: #FF9626;
  --nve-primary-700: #FFA94D;
  --nve-primary-800: #FFC299;
  --nve-primary-900: #FFDBBF;
  --nve-primary-950: #FFF2E6;

  /* 辅助色 - 暗胜利金 */
  --nve-secondary-50:  #2E2400;
  --nve-secondary-100: #483808;
  --nve-secondary-200: #645010;
  --nve-secondary-300: #806618;
  --nve-secondary-400: #9C7E20;
  --nve-secondary-500: #B89628;
  --nve-secondary-600: #CCAA38;
  --nve-secondary-700: #D8BA58;
  --nve-secondary-800: #E4CE88;
  --nve-secondary-900: #F0E2B8;
  --nve-secondary-950: #FBF5E4;

  /* 强调色 - 暗击杀红 */
  --nve-accent-50:  #380000;
  --nve-accent-100: #600000;
  --nve-accent-200: #840000;
  --nve-accent-300: #A80000;
  --nve-accent-400: #CC0000;
  --nve-accent-500: #F00000;
  --nve-accent-600: #FF2020;
  --nve-accent-700: #FF4848;
  --nve-accent-800: #FF8080;
  --nve-accent-900: #FFB8B8;
  --nve-accent-950: #FFECEC;

  /* 中性色 - 暗赛场灰 */
  --nve-neutral-0:   #0C0C1A;
  --nve-neutral-50:  #1A1A2E;
  --nve-neutral-100: #303044;
  --nve-neutral-200: #48485C;
  --nve-neutral-300: #606074;
  --nve-neutral-400: #7C7C90;
  --nve-neutral-500: #9898A8;
  --nve-neutral-600: #B4B4C0;
  --nve-neutral-700: #D0D0D8;
  --nve-neutral-800: #E8E8EC;
  --nve-neutral-900: #F5F5F7;
  --nve-neutral-950: #FFFFFF;

  /* 背景色（暗） */
  --nve-bg-default:   #0E0E1E;   /* 赛场黑 */
  --nve-bg-paper:     #181828;   /* 编辑器背景 */
  --nve-bg-elevated:  #222234;   /* 卡片背景 */
  --nve-bg-overlay:   rgba(0, 0, 0, 0.80);

  /* 表面色（暗） */
  --nve-surface-1: #1E1E30;
  --nve-surface-2: #28283C;
  --nve-surface-3: #323248;
  --nve-surface-4: #3C3C54;

  /* 文字色（暗） */
  --nve-text-primary:   #E8E8EC;
  --nve-text-secondary: #9898A8;
  --nve-text-tertiary:  #7C7C90;
  --nve-text-disabled:  rgba(232, 232, 236, 0.38);
  --nve-text-inverse:   #0C0C1A;
  --nve-text-link:      #FF9626;

  /* 边框色（暗） */
  --nve-border-default: rgba(232, 232, 236, 0.12);
  --nve-border-hover:   rgba(232, 232, 236, 0.24);
  --nve-border-active:  rgba(255, 122, 0, 0.50);
  --nve-border-focus:   rgba(255, 122, 0, 0.75);
  --nve-border-error:   rgba(240, 0, 0, 0.50);

  /* 渐变色（暗） */
  --nve-gradient-hero:   linear-gradient(135deg, #FF9626 0%, #CCAA38 50%, #FF2020 100%);
  --nve-gradient-card:   linear-gradient(180deg, rgba(255, 150, 38, 0.15) 0%, rgba(204, 170, 56, 0.08) 100%);
  --nve-gradient-button: linear-gradient(135deg, #FF7A00 0%, #FFA94D 100%);
  --nve-gradient-ambient: radial-gradient(ellipse at 40% 25%, rgba(255, 122, 0, 0.18) 0%, transparent 55%),
                          radial-gradient(ellipse at 60% 75%, rgba(184, 150, 40, 0.12) 0%, transparent 50%);

  /* 阴影（暗） */
  --nve-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.30), 0 1px 3px rgba(255, 122, 0, 0.06);
  --nve-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.35), 0 2px 4px rgba(255, 122, 0, 0.08);
  --nve-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.40), 0 4px 6px rgba(255, 122, 0, 0.10);
  --nve-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.45), 0 10px 10px rgba(255, 122, 0, 0.12);
  --nve-shadow-glow: 0 0 25px rgba(255, 122, 0, 0.35), 0 0 50px rgba(184, 150, 40, 0.20);
}
```

---

### 2.9 色彩使用规则

#### 色彩角色分配表

| 元素 | 亮色模式 | 暗色模式 | 说明 |
|------|----------|----------|------|
| 页面主背景 | `--nve-bg-default` | `--nve-bg-default` | 编辑器背后的大面积背景 |
| 编辑器纸张 | `--nve-bg-paper` | `--nve-bg-paper` | 实际写作区域背景 |
| 卡片/面板 | `--nve-bg-elevated` | `--nve-bg-elevated` | 浮于背景之上的容器 |
| 主按钮 | `--nve-primary-500` | `--nve-primary-500` | 主要操作按钮 |
| 主按钮悬停 | `--nve-primary-600` | `--nve-primary-400` | Hover状态 |
| 次按钮 | `--nve-secondary-500` | `--nve-secondary-500` | 次要操作 |
| 文字按钮 | `transparent` | `transparent` | 无边框按钮 |
| 危险按钮 | `--nve-error-500` | `--nve-error-500` | 删除/危险操作 |
| 主标题文字 | `--nve-text-primary` | `--nve-text-primary` | 章节标题、重要标题 |
| 正文文字 | `--nve-text-primary` | `--nve-text-primary` | 编辑器内容 |
| 辅助说明 | `--nve-text-secondary` | `--nve-text-secondary` | 描述文字、标签 |
| 占位文字 | `--nve-text-tertiary` | `--nve-text-tertiary` | placeholder |
| 禁用文字 | `--nve-text-disabled` | `--nve-text-disabled` | 不可点击状态 |
| 链接文字 | `--nve-text-link` | `--nve-text-link` | 可点击链接 |
| 成功提示 | `--nve-success-500` | `--nve-success-400` | 保存成功等 |
| 警告提示 | `--nve-warning-500` | `--nve-warning-400` | 注意事项 |
| 错误提示 | `--nve-error-500` | `--nve-error-400` | 错误信息 |
| 信息提示 | `--nve-info-500` | `--nve-info-400` | 一般信息 |
| 边框线 | `--nve-border-default` | `--nve-border-default` | 分隔线、卡片边框 |
| 焦点环 | `--nve-border-focus` | `--nve-border-focus` | Tab焦点指示 |

#### 透明度使用规范

| 场景 | 推荐值 | 说明 |
|------|--------|------|
| 禁用状态 | 38% | 符合 Material Design 标准 |
| 分割线 | 12% | 微妙但可辨识 |
| 悬停叠加 | 4-8% | 微妙反馈 |
| 选中叠加 | 12-16% | 清晰辨识 |
| 遮罩层 | 48-80% | 模态对话框 |
| 阴影基础 | 6-12% | 悬浮深度感 |

#### 变量统计

| 类型 | 变量数量 | 亮色/暗色 |
|------|----------|-----------|
| Primary (主色) | 11 | 各11 |
| Secondary (辅助色) | 11 | 各11 |
| Accent (强调色) | 11 | 各11 |
| Neutral (中性色) | 12 | 各12 |
| Semantic (语义色x4) | 40 | 各40 |
| MOU State (状态x4x4) | 16 | 各16 |
| Background (背景) | 4 | 各4 |
| Surface (表面) | 4 | 各4 |
| Text (文字) | 6 | 各6 |
| Border (边框) | 5 | 各5 |
| Gradient (渐变) | 4 | 各4 |
| Shadow (阴影) | 5 | 各5 |
| **每套主题总计** | **~129** | **~258** |


---

## 3. 图片主色调提取引擎

### 3.1 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                 ColorExtractionEngine                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   MedianCut  │  │   K-Means   │  │  Quantization │      │
│  │  Algorithm   │  │  Clustering │  │    Filter     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         └─────────────────┼─────────────────┘               │
│                           ▼                                  │
│              ┌────────────────────────────┐                │
│              │    Color Harmony Engine     │                │
│              │  - Complementary Detection  │                │
│              │  - Analogous Detection      │                │
│              │  - Triadic Detection        │                │
│              └────────────┬───────────────┘                │
│                           ▼                                  │
│              ┌────────────────────────────┐                │
│              │   PaletteGenerator          │                │
│              │  - Light/Dark variants      │                │
│              │  - Text contrast calc       │                │
│              │  - Semantic color map       │                │
│              └────────────┬───────────────┘                │
│                           ▼                                  │
│              ┌────────────────────────────┐                │
│              │   UserFineTuningPanel       │                │
│              │  - HSL Sliders              │                │
│              │  - Live Preview             │                │
│              │  - Preset Manager           │                │
│              └────────────────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 中位切分法 (Median Cut) 算法

```typescript
/**
 * 中位切分法色彩量化算法
 * 将图片色彩空间递归分割，提取代表性颜色
 */

interface ColorCube {
  colors: RGBColor[];
  minR: number; maxR: number;
  minG: number; maxG: number;
  minB: number; maxB: number;
  volume: number;
}

interface RGBColor {
  r: number; g: number; b: number;
  count: number; // 像素出现次数
}

interface ExtractedColor {
  rgb: [number, number, number];
  hex: string;
  population: number;  // 像素占比
  lab: [number, number, number]; // LAB色彩空间值
}

class MedianCutExtractor {
  private maxColors: number;
  private sampleSize: number;

  constructor(options: { maxColors?: number; sampleSize?: number } = {}) {
    this.maxColors = options.maxColors || 8;
    this.sampleSize = options.sampleSize || 800; // 采样尺寸，降采样以提高性能
  }

  /**
   * 主入口：从图片提取色彩
   */
  async extract(imageSource: ImageBitmap | HTMLImageElement | string): Promise<ExtractedColor[]> {
    // 1. 获取像素数据
    const imageData = await this.getImageData(imageSource);
    
    // 2. 降采样（性能优化）
    const sampledPixels = this.samplePixels(imageData, this.sampleSize);
    
    // 3. 构建初始色彩立方体
    const initialCube = this.buildInitialCube(sampledPixels);
    
    // 4. 递归分割立方体
    const cubes = this.splitCubes([initialCube], this.maxColors);
    
    // 5. 计算每个立方体的平均色
    const colors = cubes.map(cube => this.calculateAverageColor(cube));
    
    // 6. 按色彩占比排序
    colors.sort((a, b) => b.population - a.population);
    
    return colors;
  }

  /**
   * 获取图片像素数据
   */
  private async getImageData(source: ImageBitmap | HTMLImageElement | string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        // 限制最大尺寸以保持性能
        const maxDim = 400;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      
      img.onerror = reject;
      
      if (typeof source === 'string') {
        img.src = source;
      } else if (source instanceof HTMLImageElement) {
        img.src = source.src;
      } else {
        // ImageBitmap
        canvas.width = source.width;
        canvas.height = source.height;
        ctx.drawImage(source, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      }
    });
  }

  /**
   * 像素降采样
   */
  private samplePixels(imageData: ImageData, targetSize: number): RGBColor[] {
    const pixels = imageData.data;
    const totalPixels = pixels.length / 4;
    const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / (targetSize * targetSize))));
    
    const colorMap = new Map<string, RGBColor>();
    
    for (let i = 0; i < pixels.length; i += 4 * step) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      // 忽略透明像素
      const a = pixels[i + 3];
      if (a < 128) continue;
      
      // 量化减少噪点（每通道4bit）
      const qr = Math.round(r / 16) * 16;
      const qg = Math.round(g / 16) * 16;
      const qb = Math.round(b / 16) * 16;
      
      const key = `${qr},${qg},${qb}`;
      const existing = colorMap.get(key);
      if (existing) {
        existing.count++;
        existing.r = (existing.r * (existing.count - 1) + r) / existing.count;
        existing.g = (existing.g * (existing.count - 1) + g) / existing.count;
        existing.b = (existing.b * (existing.count - 1) + b) / existing.count;
      } else {
        colorMap.set(key, { r, g, b, count: 1 });
      }
    }
    
    return Array.from(colorMap.values());
  }

  /**
   * 构建初始色彩立方体
   */
  private buildInitialCube(colors: RGBColor[]): ColorCube {
    let minR = 255, maxR = 0;
    let minG = 255, maxG = 0;
    let minB = 255, maxB = 0;
    
    for (const c of colors) {
      minR = Math.min(minR, c.r); maxR = Math.max(maxR, c.r);
      minG = Math.min(minG, c.g); maxG = Math.max(maxG, c.g);
      minB = Math.min(minB, c.b); maxB = Math.max(maxB, c.b);
    }
    
    const volume = (maxR - minR) * (maxG - minG) * (maxB - minB);
    return { colors, minR, maxR, minG, maxG, minB, maxB, volume };
  }

  /**
   * 递归分割立方体
   */
  private splitCubes(cubes: ColorCube[], targetCount: number): ColorCube[] {
    if (cubes.length >= targetCount) return cubes;
    
    // 找到体积最大的立方体
    let largestIdx = 0;
    let largestVolume = cubes[0].volume;
    for (let i = 1; i < cubes.length; i++) {
      if (cubes[i].volume > largestVolume) {
        largestVolume = cubes[i].volume;
        largestIdx = i;
      }
    }
    
    const cube = cubes[largestIdx];
    const { splitA, splitB } = this.splitCube(cube);
    
    const newCubes = [...cubes];
    newCubes.splice(largestIdx, 1, splitA, splitB);
    
    return this.splitCubes(newCubes, targetCount);
  }

  /**
   * 沿最长轴分割立方体
   */
  private splitCube(cube: ColorCube): { splitA: ColorCube; splitB: ColorCube } {
    const rRange = cube.maxR - cube.minR;
    const gRange = cube.maxG - cube.minG;
    const bRange = cube.maxB - cube.minB;
    
    // 找到最长的轴
    let splitAxis: 'r' | 'g' | 'b';
    if (rRange >= gRange && rRange >= bRange) {
      splitAxis = 'r';
    } else if (gRange >= rRange && gRange >= bRange) {
      splitAxis = 'g';
    } else {
      splitAxis = 'b';
    }
    
    // 沿该轴排序并找到中位点
    const sorted = [...cube.colors].sort((a, b) => {
      if (splitAxis === 'r') return a.r - b.r;
      if (splitAxis === 'g') return a.g - b.g;
      return a.b - b.b;
    });
    
    const medianIdx = Math.floor(sorted.length / 2);
    const colorsA = sorted.slice(0, medianIdx);
    const colorsB = sorted.slice(medianIdx);
    
    return {
      splitA: this.buildInitialCube(colorsA),
      splitB: this.buildInitialCube(colorsB),
    };
  }

  /**
   * 计算立方体的平均色（加权）
   */
  private calculateAverageColor(cube: ColorCube): ExtractedColor {
    let totalR = 0, totalG = 0, totalB = 0;
    let totalCount = 0;
    
    for (const c of cube.colors) {
      totalR += c.r * c.count;
      totalG += c.g * c.count;
      totalB += c.b * c.count;
      totalCount += c.count;
    }
    
    const r = Math.round(totalR / totalCount);
    const g = Math.round(totalG / totalCount);
    const b = Math.round(totalB / totalCount);
    
    return {
      rgb: [r, g, b],
      hex: this.rgbToHex(r, g, b),
      population: totalCount,
      lab: this.rgbToLab(r, g, b),
    };
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }

  private rgbToLab(r: number, g: number, b: number): [number, number, number] {
    // 简化版RGB到LAB转换（使用sRGB -> XYZ -> LAB）
    // 实际实现应使用完整矩阵变换
    const gammaCorrect = (v: number) => {
      v /= 255;
      return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
    };
    
    const lr = gammaCorrect(r);
    const lg = gammaCorrect(g);
    const lb = gammaCorrect(b);
    
    const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
    const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
    const z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;
    
    const xyzToLab = (t: number) => {
      return t > 0.008856 ? Math.pow(t, 1/3) : 7.787 * t + 16 / 116;
    };
    
    const l = 116 * xyzToLab(y) - 16;
    const a = 500 * (xyzToLab(x) - xyzToLab(y));
    const b_val = 200 * (xyzToLab(y) - xyzToLab(z));
    
    return [l, a, b_val];
  }
}
```

### 3.3 K-Means 聚类提取

```typescript
/**
 * K-Means 色彩聚类
 * 对 Median Cut 结果进行精化，提高色彩质量
 */

class KMeansColorCluster {
  private k: number;
  private maxIterations: number;
  private tolerance: number;

  constructor(k: number = 8, maxIterations: number = 20, tolerance: number = 1.0) {
    this.k = k;
    this.maxIterations = maxIterations;
    this.tolerance = tolerance;
  }

  /**
   * K-Means 聚类（在LAB色彩空间进行，更接近人眼感知）
   */
  cluster(colors: ExtractedColor[]): ExtractedColor[] {
    // 初始化：使用 Median Cut 结果作为初始质心
    let centroids = this.initializeCentroids(colors);
    let assignments: number[] = new Array(colors.length).fill(-1);
    let iterations = 0;
    let hasConverged = false;

    while (!hasConverged && iterations < this.maxIterations) {
      // 分配步骤
      let changed = 0;
      for (let i = 0; i < colors.length; i++) {
        const closest = this.findClosestCentroid(colors[i], centroids);
        if (assignments[i] !== closest) {
          assignments[i] = closest;
          changed++;
        }
      }

      // 更新步骤
      const newCentroids = this.updateCentroids(colors, assignments, centroids.length);
      
      // 检查收敛
      hasConverged = this.checkConvergence(centroids, newCentroids) && changed < colors.length * 0.02;
      centroids = newCentroids;
      iterations++;
    }

    // 计算聚类结果
    return this.computeClusterResults(colors, assignments, centroids);
  }

  /**
   * 使用 K-Means++ 初始化质心
   */
  private initializeCentroids(colors: ExtractedColor[]): [number, number, number][] {
    if (colors.length <= this.k) {
      return colors.map(c => c.lab);
    }

    const centroids: [number, number, number][] = [];
    const taken = new Set<number>();

    // 1. 随机选择第一个质心
    let firstIdx = Math.floor(Math.random() * colors.length);
    centroids.push(colors[firstIdx].lab);
    taken.add(firstIdx);

    // 2. K-Means++：按距离加权选择后续质心
    while (centroids.length < this.k) {
      const distances = colors.map((c, i) => {
        if (taken.has(i)) return 0;
        return this.labDistance(c.lab, this.findClosestCentroidLab(c.lab, centroids));
      });

      const sum = distances.reduce((a, b) => a + b, 0);
      let threshold = Math.random() * sum;
      
      for (let i = 0; i < distances.length; i++) {
        threshold -= distances[i];
        if (threshold <= 0 && !taken.has(i)) {
          centroids.push(colors[i].lab);
          taken.add(i);
          break;
        }
      }
    }

    return centroids;
  }

  private findClosestCentroid(color: ExtractedColor, centroids: [number, number, number][]): number {
    let minDist = Infinity;
    let closest = 0;
    for (let i = 0; i < centroids.length; i++) {
      const dist = this.labDistance(color.lab, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    return closest;
  }

  private findClosestCentroidLab(lab: [number, number, number], centroids: [number, number, number][]): [number, number, number] {
    let minDist = Infinity;
    let closest: [number, number, number] = centroids[0];
    for (const c of centroids) {
      const dist = this.labDistance(lab, c);
      if (dist < minDist) {
        minDist = dist;
        closest = c;
      }
    }
    return closest;
  }

  private labDistance(a: [number, number, number], b: [number, number, number]): number {
    // CIEDE2000 简化版
    const dl = a[0] - b[0];
    const da = a[1] - b[1];
    const db = a[2] - b[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }

  private updateCentroids(
    colors: ExtractedColor[],
    assignments: number[],
    k: number
  ): [number, number, number][] {
    const sums = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = new Array(k).fill(0);

    for (let i = 0; i < colors.length; i++) {
      const cluster = assignments[i];
      if (cluster === -1) continue;
      sums[cluster][0] += colors[i].lab[0] * colors[i].population;
      sums[cluster][1] += colors[i].lab[1] * colors[i].population;
      sums[cluster][2] += colors[i].lab[2] * colors[i].population;
      counts[cluster] += colors[i].population;
    }

    return sums.map((s, i) => {
      if (counts[i] === 0) return s as [number, number, number];
      return [s[0] / counts[i], s[1] / counts[i], s[2] / counts[i]] as [number, number, number];
    });
  }

  private checkConvergence(
    old: [number, number, number][],
    neu: [number, number, number][]
  ): boolean {
    for (let i = 0; i < old.length; i++) {
      if (this.labDistance(old[i], neu[i]) > this.tolerance) {
        return false;
      }
    }
    return true;
  }

  private computeClusterResults(
    colors: ExtractedColor[],
    assignments: number[],
    centroids: [number, number, number][]
  ): ExtractedColor[] {
    const populations = new Array(centroids.length).fill(0);
    
    for (let i = 0; i < colors.length; i++) {
      if (assignments[i] !== -1) {
        populations[assignments[i]] += colors[i].population;
      }
    }

    return centroids.map((c, i) => ({
      rgb: this.labToRgb(c),
      hex: this.rgbToHex(...this.labToRgb(c)),
      population: populations[i],
      lab: c,
    }));
  }

  private labToRgb(lab: [number, number, number]): [number, number, number] {
    // LAB -> XYZ -> RGB 转换（简化版）
    const fy = (lab[0] + 16) / 116;
    const fx = fy + lab[1] / 500;
    const fz = fy - lab[2] / 200;

    const x = fx > 0.2068966 ? Math.pow(fx, 3) : (fx - 16/116) / 7.787;
    const y = fy > 0.2068966 ? Math.pow(fy, 3) : (fy - 16/116) / 7.787;
    const z = fz > 0.2068966 ? Math.pow(fz, 3) : (fz - 16/116) / 7.787;

    const xr = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
    const xg = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
    const xb = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

    const gamma = (v: number) => {
      v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1/2.4) - 0.055;
      return Math.max(0, Math.min(255, Math.round(v * 255)));
    };

    return [gamma(xr), gamma(xg), gamma(xb)];
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }
}
```

### 3.4 色彩量化与噪点过滤

```typescript
/**
 * 色彩量化与噪点过滤
 * 移除接近白/黑/灰的噪点色，保留有色彩倾向的颜色
 */

class ColorQuantizer {
  /**
   * 过滤噪点颜色
   */
  static filterNoise(colors: ExtractedColor[], options: NoiseFilterOptions = {}): ExtractedColor[] {
    const {
      minSaturation = 0.08,       // 最小饱和度（过滤灰色）
      excludeNearWhite = true,     // 排除接近白色
      excludeNearBlack = true,     // 排除接近黑色
      nearWhiteThreshold = 245,    // 白色阈值
      nearBlackThreshold = 15,     // 黑色阈值
      minPopulationRatio = 0.01,   // 最小像素占比
    } = options;

    const totalPopulation = colors.reduce((sum, c) => sum + c.population, 0);

    return colors.filter(color => {
      const [h, s, v] = this.rgbToHsv(color.rgb[0], color.rgb[1], color.rgb[2]);
      
      // 过滤低饱和度（灰色）
      if (s < minSaturation) return false;
      
      // 过滤接近白色
      if (excludeNearWhite && color.rgb.every(v => v > nearWhiteThreshold)) return false;
      
      // 过滤接近黑色
      if (excludeNearBlack && color.rgb.every(v => v < nearBlackThreshold)) return false;
      
      // 过滤占比过小的颜色
      if (color.population / totalPopulation < minPopulationRatio) return false;
      
      return true;
    });
  }

  /**
   * RGB 转 HSV
   */
  static rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    
    if (d !== 0) {
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return [h * 360, s, v];
  }

  /**
   * 合并相似色彩
   */
  static mergeSimilarColors(colors: ExtractedColor[], threshold: number = 20): ExtractedColor[] {
    const merged: ExtractedColor[] = [];
    const used = new Set<number>();

    for (let i = 0; i < colors.length; i++) {
      if (used.has(i)) continue;
      
      let cluster = { ...colors[i] };
      used.add(i);

      for (let j = i + 1; j < colors.length; j++) {
        if (used.has(j)) continue;
        
        const dist = this.colorDistance(cluster.rgb, colors[j].rgb);
        if (dist < threshold) {
          // 加权合并
          const totalPop = cluster.population + colors[j].population;
          cluster.rgb = [
            Math.round((cluster.rgb[0] * cluster.population + colors[j].rgb[0] * colors[j].population) / totalPop),
            Math.round((cluster.rgb[1] * cluster.population + colors[j].rgb[1] * colors[j].population) / totalPop),
            Math.round((cluster.rgb[2] * cluster.population + colors[j].rgb[2] * colors[j].population) / totalPop),
          ];
          cluster.population = totalPop;
          used.add(j);
        }
      }

      cluster.hex = `#${cluster.rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
      merged.push(cluster);
    }

    return merged.sort((a, b) => b.population - a.population);
  }

  private static colorDistance(a: [number, number, number], b: [number, number, number]): number {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
}
```

### 3.5 色彩和谐度评估

```typescript
/**
 * 色彩和谐度评估引擎
 * 评估提取色彩之间的和谐关系，智能选择主色/辅色/强调色
 */

enum HarmonyType {
  COMPLEMENTARY = 'complementary',     // 互补色（180°）
  SPLIT_COMPLEMENTARY = 'split_complementary', // 分裂互补
  ANALOGOUS = 'analogous',             // 类似色（±30°）
  TRIADIC = 'triadic',                 // 三色（120°）
  TETRADIC = 'tetradic',               // 四色（90°）
  MONOCHROMATIC = 'monochromatic',     // 单色
}

interface ColorHarmony {
  type: HarmonyType;
  score: number;           // 和谐度评分 0-100
  primary: ExtractedColor;
  secondary: ExtractedColor | null;
  accent: ExtractedColor | null;
  additional: ExtractedColor[];
}

class ColorHarmonyEngine {
  /**
   * 分析色彩和谐度
   */
  analyze(colors: ExtractedColor[]): ColorHarmony[] {
    if (colors.length < 2) return [];

    const harmonies: ColorHarmony[] = [];

    // 尝试每种和谐模式
    harmonies.push(this.findComplementary(colors));
    harmonies.push(this.findAnalogous(colors));
    harmonies.push(this.findTriadic(colors));
    harmonies.push(this.findSplitComplementary(colors));

    return harmonies.filter(h => h.score > 0).sort((a, b) => b.score - a.score);
  }

  /**
   * 智能选择最佳色彩方案
   */
  selectOptimalScheme(colors: ExtractedColor[]): {
    primary: ExtractedColor;
    secondary: ExtractedColor;
    accent: ExtractedColor;
    harmony: HarmonyType;
  } {
    const harmonies = this.analyze(colors);
    const best = harmonies[0];

    if (best) {
      return {
        primary: best.primary,
        secondary: best.secondary || this.findBestSecondary(colors, best.primary),
        accent: best.accent || this.findBestAccent(colors, best.primary),
        harmony: best.type,
      };
    }

    // 默认：选择占比最高的作为主题色
    const sorted = [...colors].sort((a, b) => b.population - a.population);
    return {
      primary: sorted[0],
      secondary: sorted[1] || sorted[0],
      accent: sorted[2] || sorted[0],
      harmony: HarmonyType.MONOCHROMATIC,
    };
  }

  private findComplementary(colors: ExtractedColor[]): ColorHarmony {
    let bestScore = 0;
    let bestPair: [ExtractedColor, ExtractedColor] | null = null;

    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const hueDiff = Math.abs(this.getHueDiff(colors[i], colors[j]));
        const score = 100 - Math.abs(hueDiff - 180) * 2;
        if (score > bestScore) {
          bestScore = score;
          bestPair = [colors[i], colors[j]];
        }
      }
    }

    return {
      type: HarmonyType.COMPLEMENTARY,
      score: Math.max(0, bestScore),
      primary: bestPair?.[0] || colors[0],
      secondary: bestPair?.[1] || null,
      accent: null,
      additional: [],
    };
  }

  private findAnalogous(colors: ExtractedColor[]): ColorHarmony {
    if (colors.length < 3) return { type: HarmonyType.ANALOGOUS, score: 0, primary: colors[0], secondary: null, accent: null, additional: [] };

    // 按色相排序，找最接近的3色
    const sorted = [...colors].sort((a, b) => this.getHue(a) - this.getHue(b));
    let bestScore = 0;
    let bestGroup: ExtractedColor[] = [];

    for (let i = 0; i < sorted.length - 2; i++) {
      const group = sorted.slice(i, i + 3);
      const hueRange = this.getHue(group[group.length - 1]) - this.getHue(group[0]);
      const score = hueRange <= 60 ? 100 - hueRange : 0;
      if (score > bestScore) {
        bestScore = score;
        bestGroup = group;
      }
    }

    return {
      type: HarmonyType.ANALOGOUS,
      score: bestScore,
      primary: bestGroup[1] || bestGroup[0],
      secondary: bestGroup[0],
      accent: bestGroup[2] || null,
      additional: bestGroup.slice(3),
    };
  }

  private findTriadic(colors: ExtractedColor[]): ColorHarmony {
    if (colors.length < 3) return { type: HarmonyType.TRIADIC, score: 0, primary: colors[0], secondary: null, accent: null, additional: [] };

    let bestScore = 0;
    let bestTriple: ExtractedColor[] = [];

    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        for (let k = j + 1; k < colors.length; k++) {
          const hue1 = this.getHue(colors[i]);
          const hue2 = this.getHue(colors[j]);
          const hue3 = this.getHue(colors[k]);
          const diff12 = Math.abs(hue1 - hue2);
          const diff23 = Math.abs(hue2 - hue3);
          const diff13 = Math.abs(hue1 - hue3);
          const score = 100 - (Math.abs(diff12 - 120) + Math.abs(diff23 - 120) + Math.abs(diff13 - 120));
          if (score > bestScore) {
            bestScore = score;
            bestTriple = [colors[i], colors[j], colors[k]];
          }
        }
      }
    }

    return {
      type: HarmonyType.TRIADIC,
      score: Math.max(0, bestScore),
      primary: bestTriple[0] || colors[0],
      secondary: bestTriple[1] || null,
      accent: bestTriple[2] || null,
      additional: [],
    };
  }

  private findSplitComplementary(colors: ExtractedColor[]): ColorHarmony {
    // 找到主色 + 互补色两侧的颜色
    const sorted = [...colors].sort((a, b) => b.population - a.population);
    const primary = sorted[0];
    const primaryHue = this.getHue(primary);

    const targetHue1 = (primaryHue + 150) % 360;
    const targetHue2 = (primaryHue + 210) % 360;

    const secondary = this.findClosestByHue(colors, targetHue1, primary);
    const accent = this.findClosestByHue(colors, targetHue2, primary);

    const score = secondary && accent ? 80 : 0;

    return {
      type: HarmonyType.SPLIT_COMPLEMENTARY,
      score,
      primary,
      secondary,
      accent,
      additional: sorted.slice(3),
    };
  }

  private getHue(color: ExtractedColor): number {
    return ColorQuantizer.rgbToHsv(color.rgb[0], color.rgb[1], color.rgb[2])[0];
  }

  private getHueDiff(a: ExtractedColor, b: ExtractedColor): number {
    const diff = Math.abs(this.getHue(a) - this.getHue(b));
    return Math.min(diff, 360 - diff);
  }

  private findClosestByHue(colors: ExtractedColor[], targetHue: number, exclude: ExtractedColor): ExtractedColor | null {
    let closest: ExtractedColor | null = null;
    let minDiff = Infinity;
    for (const c of colors) {
      if (c === exclude) continue;
      const diff = Math.abs(this.getHue(c) - targetHue);
      const circularDiff = Math.min(diff, 360 - diff);
      if (circularDiff < minDiff) {
        minDiff = circularDiff;
        closest = c;
      }
    }
    return closest;
  }

  private findBestSecondary(colors: ExtractedColor[], primary: ExtractedColor): ExtractedColor {
    const others = colors.filter(c => c !== primary);
    return others[0] || primary;
  }

  private findBestAccent(colors: ExtractedColor[], primary: ExtractedColor): ExtractedColor {
    const others = colors.filter(c => c !== primary);
    return others[1] || others[0] || primary;
  }
}
```

### 3.6 完整色板生成器

```typescript
/**
 * 从提取的主色生成完整主题色板
 * 自动计算亮色/暗色变体、文字对比色、状态色
 */

interface GeneratedPalette {
  primary: ColorScale;
  secondary: ColorScale;
  accent: ColorScale;
  neutral: ColorScale;
  semantic: SemanticColors;
  background: BackgroundColors;
  text: TextColors;
  shadow: ShadowColors;
  gradient: GradientColors;
}

interface ColorScale {
  50: string; 100: string; 200: string; 300: string; 400: string;
  500: string; 600: string; 700: string; 800: string; 900: string; 950: string;
}

interface SemanticColors {
  success: ColorScale;
  warning: ColorScale;
  error: ColorScale;
  info: ColorScale;
}

interface BackgroundColors {
  default: string;
  paper: string;
  elevated: string;
  overlay: string;
}

interface TextColors {
  primary: string;
  secondary: string;
  tertiary: string;
  disabled: string;
  inverse: string;
  link: string;
}

interface ShadowColors {
  sm: string; md: string; lg: string; xl: string; glow: string;
}

interface GradientColors {
  hero: string;
  card: string;
  button: string;
  ambient: string;
}

class PaletteGenerator {
  /**
   * 从主色/辅色/强调色生成完整色板
   */
  static generate(
    primary: ExtractedColor,
    secondary: ExtractedColor,
    accent: ExtractedColor,
    mode: 'light' | 'dark' = 'light'
  ): GeneratedPalette {
    const primaryHsl = this.rgbToHsl(primary.rgb);
    const secondaryHsl = this.rgbToHsl(secondary.rgb);
    const accentHsl = this.rgbToHsl(accent.rgb);

    if (mode === 'light') {
      return {
        primary: this.generateLightScale(primaryHsl),
        secondary: this.generateLightScale(secondaryHsl),
        accent: this.generateLightScale(accentHsl),
        neutral: this.generateNeutralScale(mode),
        semantic: this.generateSemanticColors(mode),
        background: this.generateBackgrounds(primaryHsl, secondaryHsl, mode),
        text: this.generateTextColors(mode),
        shadow: this.generateShadows(primaryHsl, secondaryHsl, mode),
        gradient: this.generateGradients(primaryHsl, secondaryHsl, accentHsl, mode),
      };
    } else {
      return {
        primary: this.generateDarkScale(primaryHsl),
        secondary: this.generateDarkScale(secondaryHsl),
        accent: this.generateDarkScale(accentHsl),
        neutral: this.generateNeutralScale(mode),
        semantic: this.generateSemanticColors(mode),
        background: this.generateBackgrounds(primaryHsl, secondaryHsl, mode),
        text: this.generateTextColors(mode),
        shadow: this.generateShadows(primaryHsl, secondaryHsl, mode),
        gradient: this.generateGradients(primaryHsl, secondaryHsl, accentHsl, mode),
      };
    }
  }

  /**
   * 生成亮色模式色彩阶梯（500为主色，50最浅，950最深）
   */
  private static generateLightScale(hsl: [number, number, number]): ColorScale {
    const [h, s, l] = hsl;
    return {
      50:  this.hslToHex(h, Math.max(0, s - 30), Math.min(95, l + 45)),
      100: this.hslToHex(h, Math.max(0, s - 25), Math.min(90, l + 35)),
      200: this.hslToHex(h, Math.max(0, s - 20), Math.min(85, l + 25)),
      300: this.hslToHex(h, Math.max(0, s - 15), Math.min(80, l + 15)),
      400: this.hslToHex(h, Math.max(0, s - 10), Math.min(75, l + 8)),
      500: this.hslToHex(h, s, l),
      600: this.hslToHex(h, Math.min(100, s + 5), Math.max(20, l - 10)),
      700: this.hslToHex(h, Math.min(100, s + 3), Math.max(15, l - 18)),
      800: this.hslToHex(h, Math.min(100, s + 2), Math.max(10, l - 26)),
      900: this.hslToHex(h, Math.min(100, s + 1), Math.max(5, l - 35)),
      950: this.hslToHex(h, Math.min(100, s), Math.max(2, l - 42)),
    };
  }

  /**
   * 生成暗色模式色彩阶梯（500为主色，50最深，950最浅）
   */
  private static generateDarkScale(hsl: [number, number, number]): ColorScale {
    const [h, s, l] = hsl;
    return {
      50:  this.hslToHex(h, Math.min(100, s), Math.max(2, l - 42)),
      100: this.hslToHex(h, Math.min(100, s + 1), Math.max(5, l - 35)),
      200: this.hslToHex(h, Math.min(100, s + 2), Math.max(10, l - 26)),
      300: this.hslToHex(h, Math.min(100, s + 3), Math.max(15, l - 18)),
      400: this.hslToHex(h, Math.min(100, s + 5), Math.max(20, l - 10)),
      500: this.hslToHex(h, s, l),
      600: this.hslToHex(h, Math.max(0, s - 5), Math.min(90, l + 10)),
      700: this.hslToHex(h, Math.max(0, s - 10), Math.min(92, l + 18)),
      800: this.hslToHex(h, Math.max(0, s - 15), Math.min(94, l + 28)),
      900: this.hslToHex(h, Math.max(0, s - 20), Math.min(96, l + 38)),
      950: this.hslToHex(h, Math.max(0, s - 25), Math.min(97, l + 45)),
    };
  }

  /**
   * 生成中性色阶
   */
  private static generateNeutralScale(mode: 'light' | 'dark'): ColorScale {
    if (mode === 'light') {
      return {
        50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1',
        400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155',
        800: '#1E293B', 900: '#0F172A', 950: '#020617',
      } as unknown as ColorScale;
    } else {
      return {
        50: '#020617', 100: '#0F172A', 200: '#1E293B', 300: '#334155',
        400: '#475569', 500: '#64748B', 600: '#94A3B8', 700: '#CBD5E1',
        800: '#E2E8F0', 900: '#F1F5F9', 950: '#F8FAFC',
      } as unknown as ColorScale;
    }
  }

  /**
   * 生成语义色（基于主色色相偏移）
   */
  private static generateSemanticColors(mode: 'light' | 'dark'): SemanticColors {
    const isLight = mode === 'light';
    return {
      success: this.generateSemanticScale(145, isLight),
      warning: this.generateSemanticScale(42, isLight),
      error: this.generateSemanticScale(4, isLight),
      info: this.generateSemanticScale(210, isLight),
    };
  }

  private static generateSemanticScale(hue: number, isLight: boolean): ColorScale {
    if (isLight) {
      return {
        50: this.hslToHex(hue, 60, 95), 100: this.hslToHex(hue, 55, 88),
        200: this.hslToHex(hue, 50, 78), 300: this.hslToHex(hue, 48, 68),
        400: this.hslToHex(hue, 55, 58), 500: this.hslToHex(hue, 65, 48),
        600: this.hslToHex(hue, 70, 40), 700: this.hslToHex(hue, 72, 32),
        800: this.hslToHex(hue, 75, 24), 900: this.hslToHex(hue, 80, 16),
        950: this.hslToHex(hue, 85, 10),
      };
    } else {
      return {
        50: this.hslToHex(hue, 85, 10), 100: this.hslToHex(hue, 80, 16),
        200: this.hslToHex(hue, 75, 24), 300: this.hslToHex(hue, 72, 32),
        400: this.hslToHex(hue, 70, 40), 500: this.hslToHex(hue, 65, 48),
        600: this.hslToHex(hue, 55, 58), 700: this.hslToHex(hue, 48, 68),
        800: this.hslToHex(hue, 50, 78), 900: this.hslToHex(hue, 55, 88),
        950: this.hslToHex(hue, 60, 95),
      };
    }
  }

  /**
   * 生成背景色（基于主色/辅色创建和谐的背景）
   */
  private static generateBackgrounds(
    primaryHsl: [number, number, number],
    secondaryHsl: [number, number, number],
    mode: 'light' | 'dark'
  ): BackgroundColors {
    if (mode === 'light') {
      return {
        default: this.hslToHex(primaryHsl[0], Math.max(5, primaryHsl[1] - 40), 95),
        paper: this.hslToHex(primaryHsl[0], Math.max(3, primaryHsl[1] - 45), 97),
        elevated: '#FFFFFF',
        overlay: `rgba(${this.hslToRgb(primaryHsl[0], 20, 15).join(',')}, 0.48)`,
      };
    } else {
      return {
        default: this.hslToHex(primaryHsl[0], 15, 8),
        paper: this.hslToHex(primaryHsl[0], 12, 11),
        elevated: this.hslToHex(primaryHsl[0], 10, 14),
        overlay: `rgba(0, 0, 0, 0.72)`,
      };
    }
  }

  /**
   * 生成文字色
   */
  private static generateTextColors(mode: 'light' | 'dark'): TextColors {
    if (mode === 'light') {
      return {
        primary: '#1E293B',
        secondary: '#475569',
        tertiary: '#64748B',
        disabled: 'rgba(30, 41, 59, 0.38)',
        inverse: '#FFFFFF',
        link: '#3B82F6',
      };
    } else {
      return {
        primary: '#F1F5F9',
        secondary: '#94A3B8',
        tertiary: '#64748B',
        disabled: 'rgba(241, 245, 249, 0.38)',
        inverse: '#0F172A',
        link: '#60A5FA',
      };
    }
  }

  /**
   * 生成阴影
   */
  private static generateShadows(
    primaryHsl: [number, number, number],
    secondaryHsl: [number, number, number],
    mode: 'light' | 'dark'
  ): ShadowColors {
    const isLight = mode === 'light';
    const alpha = isLight ? 0.06 : 0.30;
    const alphaMd = isLight ? 0.08 : 0.35;
    const alphaLg = isLight ? 0.10 : 0.40;
    const alphaXl = isLight ? 0.12 : 0.45;

    return {
      sm: `0 1px 2px rgba(0,0,0,${alpha})`,
      md: `0 4px 6px rgba(0,0,0,${alphaMd})`,
      lg: `0 10px 15px rgba(0,0,0,${alphaLg})`,
      xl: `0 20px 25px rgba(0,0,0,${alphaXl})`,
      glow: `0 0 20px ${this.hslToHex(primaryHsl[0], primaryHsl[1], isLight ? 50 : 60)}33`,
    };
  }

  /**
   * 生成渐变色
   */
  private static generateGradients(
    primaryHsl: [number, number, number],
    secondaryHsl: [number, number, number],
    accentHsl: [number, number, number],
    mode: 'light' | 'dark'
  ): GradientColors {
    const pHex = this.hslToHex(primaryHsl[0], primaryHsl[1], primaryHsl[2]);
    const sHex = this.hslToHex(secondaryHsl[0], secondaryHsl[1], secondaryHsl[2]);
    const aHex = this.hslToHex(accentHsl[0], accentHsl[1], accentHsl[2]);

    return {
      hero: `linear-gradient(135deg, ${pHex} 0%, ${sHex} 50%, ${aHex} 100%)`,
      card: `linear-gradient(180deg, ${pHex}14 0%, ${sHex}0A 100%)`,
      button: `linear-gradient(135deg, ${pHex} 0%, ${this.hslToHex(primaryHsl[0], primaryHsl[1], primaryHsl[2] + 15)} 100%)`,
      ambient: `radial-gradient(ellipse at 30% 20%, ${sHex}1E 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, ${pHex}14 0%, transparent 50%)`,
    };
  }

  /* ===== 工具方法 ===== */

  private static rgbToHsl(rgb: [number, number, number]): [number, number, number] {
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [h * 360, s * 100, l * 100];
  }

  private static hslToHex(h: number, s: number, l: number): string {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;
    const hh = h / 60;
    if (hh < 1) { r = c; g = x; }
    else if (hh < 2) { r = x; g = c; }
    else if (hh < 3) { g = c; b = x; }
    else if (hh < 4) { g = x; b = c; }
    else if (hh < 5) { r = x; b = c; }
    else { r = c; b = x; }

    const to8bit = (v: number) => Math.round((v + m) * 255);
    return `#${[to8bit(r), to8bit(g), to8bit(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }

  private static hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const hex = this.hslToHex(h, s, l);
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }
}
```

### 3.7 用户交互流程

```typescript
/**
 * 图片主题提取的用户交互流程
 */

interface ImageThemeExtractionFlow {
  // 1. 上传图片
  uploadImage(file: File): Promise<HTMLImageElement>;
  
  // 2. 预览与裁剪
  previewImage(img: HTMLImageElement): ImagePreviewResult;
  
  // 3. 提取色彩（Web Worker 异步）
  extractColors(img: HTMLImageElement): Promise<ExtractedColor[]>;
  
  // 4. 选择和谐方案
  selectHarmony(colors: ExtractedColor[]): ColorHarmony;
  
  // 5. 生成完整色板
  generatePalette(harmony: ColorHarmony): GeneratedPalette;
  
  // 6. 微调（HSL 滑动条）
  fineTune(palette: GeneratedPalette, adjustments: HSLAdjustments): GeneratedPalette;
  
  // 7. 实时预览
  livePreview(palette: GeneratedPalette): void;
  
  // 8. 保存/应用
  saveTheme(palette: GeneratedPalette, metadata: ThemeMetadata): void;
}

interface HSLAdjustments {
  primary: { hue: number; saturation: number; lightness: number };
  secondary: { hue: number; saturation: number; lightness: number };
  accent: { hue: number; saturation: number; lightness: number };
  overallSaturation: number;   // 全局饱和度调整
  overallLightness: number;    // 全局明度调整
}

interface ImagePreviewResult {
  thumbnail: string;     // Data URL
  dimensions: { width: number; height: number };
  aspectRatio: number;
  suggestedCrop: { x: number; y: number; width: number; height: number };
}

interface ThemeMetadata {
  name: string;
  sourceImage: string;    // 缩略图 Data URL
  extractedColors: string[];
  harmonyType: HarmonyType;
  createdAt: string;
  genreHint?: string;     // 小说类型建议
}
```

### 3.8 Web Worker 实现

```typescript
// colorExtractor.worker.ts
/**
 * 在 Web Worker 中执行色彩提取，避免阻塞主线程
 */

self.onmessage = function(event: MessageEvent<{
  imageData: ImageData;
  method: 'medianCut' | 'kMeans';
  maxColors: number;
}>) {
  const { imageData, method, maxColors } = event.data;
  
  try {
    // 降采样
    const pixels = samplePixels(imageData, 800);
    
    let colors: ExtractedColor[];
    
    if (method === 'medianCut') {
      const extractor = new MedianCutExtractor({ maxColors: maxColors * 2 });
      colors = extractor.extractFromPixels(pixels);
    } else {
      const initial = new MedianCutExtractor({ maxColors }).extractFromPixels(pixels);
      const kmeans = new KMeansColorCluster(maxColors);
      colors = kmeans.cluster(initial);
    }
    
    // 过滤和合并
    colors = ColorQuantizer.filterNoise(colors);
    colors = ColorQuantizer.mergeSimilarColors(colors, 25);
    
    // 和谐度分析
    const engine = new ColorHarmonyEngine();
    const harmonies = engine.analyze(colors);
    
    self.postMessage({
      type: 'success',
      colors: colors.slice(0, maxColors),
      harmonies,
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// 主线程调用
class ColorExtractionService {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(new URL('./colorExtractor.worker.ts', import.meta.url));
  }

  async extract(imageData: ImageData, options: { method?: 'medianCut' | 'kMeans'; maxColors?: number } = {}): Promise<{
    colors: ExtractedColor[];
    harmonies: ColorHarmony[];
  }> {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = (event) => {
        if (event.data.type === 'success') {
          resolve(event.data);
        } else {
          reject(new Error(event.data.error));
        }
      };

      this.worker.postMessage({
        imageData,
        method: options.method || 'medianCut',
        maxColors: options.maxColors || 8,
      });
    });
  }

  terminate() {
    this.worker.terminate();
  }
}
```

### 3.9 性能优化策略

| 优化点 | 策略 | 效果 |
|--------|------|------|
| **图片尺寸限制** | 输入图片最大 800x800px，超出自动压缩 | 减少像素量至 1/16-1/4 |
| **Canvas 提取** | 全程客户端处理，不上传服务器 | 零网络延迟 |
| **降采样** | 步进采样（step = sqrt(total/640000)） | 处理像素量控制在 ~64万 |
| **Web Worker** | 提取算法在 Worker 线程执行 | 主线程零阻塞 |
| **结果缓存** | 图片哈希 → 提取结果的 LRU 缓存 | 重复提取零耗时 |
| **增量更新** | HSL 微调时只更新 CSS 变量 | 不重新提取，即时反馈 |
| **requestIdleCallback** | 复杂计算利用空闲时间 | 不影响交互响应 |
| **色彩量化** | 4bit 量化减少颜色种类 | 加速聚类收敛 |


---

## 4. 亮暗模式系统

### 4.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Light/Dark Mode System                        │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐   │
│  │ Detection Layer │  │  User Toggle    │  │ Auto Schedule│   │
│  │                 │  │                 │  │              │   │
│  │ prefers-color-  │  │ manual toggle   │  │ geolocation  │   │
│  │ scheme media    │  │ localStorage    │  │ sunrise/sunset│   │
│  │ query listener  │  │ persistence     │  │ auto-switch   │   │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘   │
│           └─────────────────────┼──────────────────┘            │
│                                 ▼                                │
│                    ┌─────────────────────┐                      │
│                    │   Priority Engine    │                      │
│                    │                      │                      │
│                    │  manual > schedule > │                      │
│                    │  system              │                      │
│                    └──────────┬───────────┘                      │
│                               ▼                                  │
│                    ┌─────────────────────┐                      │
│                    │   Mode State Store   │                      │
│                    │                      │                      │
│                    │  current: 'light'|   │                      │
│                    │  'dark' | 'system'   │                      │
│                    └──────────┬───────────┘                      │
│                               ▼                                  │
│                    ┌─────────────────────┐                      │
│                    │ CSS Variable Engine  │                      │
│                    │                      │                      │
│                    │  updates :root vars  │                      │
│                    │  based on mode       │                      │
│                    └──────────┬───────────┘                      │
│                               ▼                                  │
│                    ┌─────────────────────┐                      │
│                    │  Transition System   │                      │
│                    │                      │                      │
│                    │  300ms smooth        │                      │
│                    │  color transition    │                      │
│                    └─────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 切换机制

#### 4.2.1 系统偏好检测

```typescript
/**
 * 系统亮暗模式偏好检测
 * 监听 prefers-color-scheme 媒体查询
 */

class SystemPreferenceDetector {
  private mediaQuery: MediaQueryList;
  private listeners: Set<(isDark: boolean) => void> = new Set();

  constructor() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.handleChange = this.handleChange.bind(this);
    this.mediaQuery.addEventListener('change', this.handleChange);
  }

  private handleChange(event: MediaQueryListEvent) {
    this.listeners.forEach(listener => listener(event.matches));
  }

  /**
   * 获取当前系统偏好
   */
  getSystemPreference(): 'light' | 'dark' {
    return this.mediaQuery.matches ? 'dark' : 'light';
  }

  /**
   * 订阅系统偏好变化
   */
  onChange(listener: (isDark: boolean) => void): () => void {
    this.listeners.add(listener);
    // 立即执行一次
    listener(this.mediaQuery.matches);
    return () => { this.listeners.delete(listener); };
  }

  /**
   * 清理
   */
  dispose() {
    this.mediaQuery.removeEventListener('change', this.handleChange);
    this.listeners.clear();
  }
}
```

#### 4.2.2 手动切换与持久化

```typescript
/**
 * 亮暗模式管理器
 * 处理手动切换、localStorage 持久化、优先级判断
 */

type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'narrative-os-theme-mode';
const MODE_CHANGE_EVENT = 'nve:theme-mode-change';

class ModeManager {
  private currentMode: ThemeMode = 'system';
  private effectiveMode: 'light' | 'dark' = 'light';
  private systemDetector: SystemPreferenceDetector;
  private listeners: Set<(mode: ThemeMode, effective: 'light' | 'dark') => void> = new Set();
  private systemUnsubscribe: (() => void) | null = null;

  constructor() {
    this.systemDetector = new SystemPreferenceDetector();
    this.loadPersistedMode();
    this.updateEffectiveMode();
  }

  /**
   * 获取当前模式
   */
  getMode(): ThemeMode {
    return this.currentMode;
  }

  /**
   * 获取实际生效模式
   */
  getEffectiveMode(): 'light' | 'dark' {
    return this.effectiveMode;
  }

  /**
   * 设置模式
   */
  setMode(mode: ThemeMode): void {
    this.currentMode = mode;
    this.persistMode(mode);
    this.updateEffectiveMode();
    this.notifyListeners();
    
    // 派发 DOM 事件
    window.dispatchEvent(new CustomEvent(MODE_CHANGE_EVENT, {
      detail: { mode, effectiveMode: this.effectiveMode },
    }));
  }

  /**
   * 切换模式（light -> dark -> system -> light）
   */
  toggle(): ThemeMode {
    const cycle: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIdx = cycle.indexOf(this.currentMode);
    const nextMode = cycle[(currentIdx + 1) % cycle.length];
    this.setMode(nextMode);
    return nextMode;
  }

  /**
   * 订阅模式变化
   */
  onChange(listener: (mode: ThemeMode, effective: 'light' | 'dark') => void): () => void {
    this.listeners.add(listener);
    // 立即执行
    listener(this.currentMode, this.effectiveMode);
    return () => { this.listeners.delete(listener); };
  }

  /**
   * 从 localStorage 加载模式
   */
  private loadPersistedMode(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        this.currentMode = saved;
      }
    } catch {
      // localStorage 不可用时忽略
    }
  }

  /**
   * 持久化模式
   */
  private persistMode(mode: ThemeMode): void {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage 不可用时忽略
    }
  }

  /**
   * 更新实际生效模式
   */
  private updateEffectiveMode(): void {
    // 取消之前的系统监听
    if (this.systemUnsubscribe) {
      this.systemUnsubscribe();
      this.systemUnsubscribe = null;
    }

    if (this.currentMode === 'system') {
      this.effectiveMode = this.systemDetector.getSystemPreference();
      this.systemUnsubscribe = this.systemDetector.onChange((isDark) => {
        const newMode = isDark ? 'dark' : 'light';
        if (this.effectiveMode !== newMode) {
          this.effectiveMode = newMode;
          this.notifyListeners();
          window.dispatchEvent(new CustomEvent(MODE_CHANGE_EVENT, {
            detail: { mode: 'system', effectiveMode: this.effectiveMode },
          }));
        }
      });
    } else {
      this.effectiveMode = this.currentMode;
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      listener(this.currentMode, this.effectiveMode);
    });
  }

  /**
   * 清理
   */
  dispose(): void {
    if (this.systemUnsubscribe) {
      this.systemUnsubscribe();
    }
    this.systemDetector.dispose();
    this.listeners.clear();
  }
}
```

#### 4.2.3 日出日落自动切换

```typescript
/**
 * 基于地理位置的日出日落自动切换
 * 使用 SunCalc 算法计算当地日出日落时间
 */

interface GeoLocation {
  latitude: number;
  longitude: number;
}

class SunAutoSwitcher {
  private location: GeoLocation | null = null;
  private checkInterval: number | null = null;
  private modeManager: ModeManager;
  private sunriseOffset: number = 0;  // 日出前分钟数
  private sunsetOffset: number = 0;   // 日落后分钟数

  constructor(modeManager: ModeManager) {
    this.modeManager = modeManager;
  }

  /**
   * 启用日出日落自动切换
   */
  async enable(options: { sunriseOffset?: number; sunsetOffset?: number } = {}): Promise<void> {
    this.sunriseOffset = options.sunriseOffset || 0;
    this.sunsetOffset = options.sunsetOffset || 0;

    // 获取地理位置
    await this.detectLocation();
    
    // 立即检查一次
    this.checkAndSwitch();
    
    // 每 15 分钟检查一次
    this.checkInterval = window.setInterval(() => this.checkAndSwitch(), 15 * 60 * 1000);
  }

  /**
   * 禁用自动切换
   */
  disable(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 检测地理位置
   */
  private async detectLocation(): Promise<void> {
    // 先尝试从 localStorage 读取缓存
    const cached = localStorage.getItem('nve:geo-location');
    if (cached) {
      try {
        this.location = JSON.parse(cached);
        return;
      } catch { /* 解析失败则继续 */ }
    }

    // 使用 Geolocation API
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        // 使用 IP 地理定位作为回退
        this.detectByIP().then(resolve).catch(resolve);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          localStorage.setItem('nve:geo-location', JSON.stringify(this.location));
          resolve();
        },
        () => {
          this.detectByIP().then(resolve).catch(resolve);
        },
        { timeout: 10000, maximumAge: 86400000 }
      );
    });
  }

  /**
   * IP 地理定位（回退方案）
   */
  private async detectByIP(): Promise<void> {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      this.location = {
        latitude: data.latitude,
        longitude: data.longitude,
      };
      localStorage.setItem('nve:geo-location', JSON.stringify(this.location));
    } catch {
      // 最终回退：使用东八区（北京时间）
      this.location = { latitude: 39.9042, longitude: 116.4074 };
    }
  }

  /**
   * 计算日出日落时间（简化版 SunCalc）
   */
  private calculateSunTimes(date: Date): { sunrise: Date; sunset: Date } {
    if (!this.location) {
      return { sunrise: new Date(0), sunset: new Date(0) };
    }

    const { latitude, longitude } = this.location;
    const times = this.getSunTimes(date, latitude, longitude);
    
    // 应用偏移
    const sunrise = new Date(times.sunrise.getTime() - this.sunriseOffset * 60000);
    const sunset = new Date(times.sunset.getTime() + this.sunsetOffset * 60000);
    
    return { sunrise, sunset };
  }

  /**
   * 简化版 SunCalc 算法
   */
  private getSunTimes(date: Date, lat: number, lng: number): { sunrise: Date; sunset: Date } {
    const J2000 = 2451545.0;
    const lw = -lng * Math.PI / 180;
    const phi = lat * Math.PI / 180;
    
    const d = this.toJulian(date) - J2000;
    const M = (357.5291 + 0.98560028 * d) * Math.PI / 180;
    const L = (280.46646 + 0.98564736 * d + 1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M)) * Math.PI / 180;
    const declination = Math.asin(Math.sin(L) * 0.39779);
    
    const hourAngle = Math.acos(-Math.tan(phi) * Math.tan(declination));
    const transit = 2451545.0009 + d + lw / (2 * Math.PI) + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    
    const sunriseJulian = transit - hourAngle / (2 * Math.PI);
    const sunsetJulian = transit + hourAngle / (2 * Math.PI);
    
    return {
      sunrise: this.fromJulian(sunriseJulian),
      sunset: this.fromJulian(sunsetJulian),
    };
  }

  private toJulian(date: Date): number {
    return date.getTime() / 86400000 - 0.5 + 2440587.5;
  }

  private fromJulian(j: number): Date {
    return new Date((j - 2440587.5 + 0.5) * 86400000);
  }

  /**
   * 检查并根据时间切换模式
   */
  private checkAndSwitch(): void {
    const now = new Date();
    const { sunrise, sunset } = this.calculateSunTimes(now);

    // 日出后到日落前 = light，其他 = dark
    const shouldBeDark = now < sunrise || now >= sunset;
    const effectiveMode = this.modeManager.getEffectiveMode();

    if (shouldBeDark && effectiveMode === 'light') {
      this.modeManager.setMode('dark');
    } else if (!shouldBeDark && effectiveMode === 'dark') {
      this.modeManager.setMode('light');
    }
  }
}
```

### 4.3 切换过渡动画

```css
/**
 * 亮暗模式切换过渡动画
 * 所有色彩属性在 300ms 内平滑过渡
 */

/* 根元素上的过渡定义 */
html {
  /* 基础过渡：所有 CSS 变量变化都带过渡 */
  transition: background-color 300ms ease-in-out,
              color 300ms ease-in-out;
}

/* 所有使用 CSS 变量的元素都参与过渡 */
*,
*::before,
*::after {
  transition: background-color 300ms ease-in-out,
              border-color 300ms ease-in-out,
              color 300ms ease-in-out,
              fill 300ms ease-in-out,
              stroke 300ms ease-in-out,
              box-shadow 300ms ease-in-out;
}

/* 可选：禁用特定元素的过渡（如图片） */
img,
video,
iframe {
  transition: filter 300ms ease-in-out;
}

/* 暗色模式下的图片亮度调整 */
[data-mode="dark"] img:not(.no-dark-adjust),
[data-mode="dark"] video:not(.no-dark-adjust) {
  filter: brightness(0.85) contrast(1.05);
}

/* 减弱动画模式下使用瞬时切换 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

### 4.4 亮暗色映射算法

```typescript
/**
 * 亮暗色自动转换算法
 * 将亮色色板自动转换为暗色色板
 */

class ColorModeConverter {
  /**
   * 核心转换函数：将亮色色值映射为暗色色值
   * 原理：在 HSL 空间中反转 Lightness，同时保持 Hue 和 Saturation 的关系
   */
  static lightToDark(hexColor: string): string {
    const hsl = this.hexToHsl(hexColor);
    // 暗色映射：lightness = 100 - lightness（保持边界缓冲）
    const newLightness = Math.max(5, Math.min(95, 100 - hsl[2]));
    // 暗色模式下略微增加饱和度以补偿暗背景的饱和度损失
    const newSaturation = Math.min(100, hsl[1] * 1.1 + 5);
    return this.hslToHex(hsl[0], newSaturation, newLightness);
  }

  /**
   * 暗色映射：调整色彩以适应暗色模式感知
   */
  static darkToLight(hexColor: string): string {
    const hsl = this.hexToHsl(hexColor);
    const newLightness = Math.max(5, Math.min(95, 100 - hsl[2]));
    const newSaturation = Math.max(0, hsl[1] * 0.9 - 5);
    return this.hslToHex(hsl[0], newSaturation, newLightness);
  }

  /**
   * 背景色转换：亮色背景 → 暗色背景
   * 暗色背景不是简单的反转，而是有特定的深色范围
   */
  static convertBackground(lightBg: string): string {
    const hsl = this.hexToHsl(lightBg);
    // 暗色背景：低明度，略微保留原色相倾向
    const newLightness = Math.max(4, 10 - (hsl[2] - 95) * 0.5);
    const newSaturation = hsl[1] * 0.3; // 暗色背景低饱和度
    return this.hslToHex(hsl[0], newSaturation, newLightness);
  }

  /**
   * 表面色转换：亮色表面 → 暗色表面
   */
  static convertSurface(lightSurface: string, level: number): string {
    const hsl = this.hexToHsl(lightSurface);
    // 暗色表面：从深到浅的层级（level 1 最深，level 4 最浅）
    const baseLightness = 12 + level * 4;
    const newLightness = Math.max(4, Math.min(30, baseLightness - (100 - hsl[2]) * 0.1));
    return this.hslToHex(hsl[0], hsl[1] * 0.2, newLightness);
  }

  /**
   * 文字色转换：亮色文字 → 暗色文字
   */
  static convertText(lightText: string): string {
    const hsl = this.hexToHsl(lightText);
    // 暗色文字：高明度，降低饱和度
    const newLightness = Math.max(75, 95 - hsl[2]);
    const newSaturation = Math.min(10, hsl[1]);
    return this.hslToHex(hsl[0], newSaturation, newLightness);
  }

  /**
   * 边框色转换
   */
  static convertBorder(lightBorder: string): string {
    // 边框通常是带透明度的颜色
    if (lightBorder.startsWith('rgba')) {
      return lightBorder.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/, 
        (_, r, g, b, a) => `rgba(255, 255, 255, ${a})`);
    }
    if (lightBorder.startsWith('rgb')) {
      const match = lightBorder.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const luminance = (parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3])) / 3;
        const alpha = luminance / 255;
        return `rgba(255, 255, 255, ${Math.max(0.06, Math.min(0.24, alpha * 0.16)})`;
      }
    }
    const hsl = this.hexToHsl(lightBorder);
    const newLightness = Math.max(75, 100 - hsl[2]);
    return this.hslToHex(hsl[0], 0, newLightness);
  }

  /**
   * 阴影颜色调整：暗色模式下阴影更深
   */
  static convertShadow(lightShadow: string): string {
    return lightShadow.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g, 
      (_, r, g, b, a) => {
        const luminance = (parseInt(r) + parseInt(g) + parseInt(b)) / 3;
        const newAlpha = Math.min(0.60, parseFloat(a) * (luminance > 128 ? 4 : 2.5));
        return `rgba(0, 0, 0, ${newAlpha})`;
      });
  }

  /* ===== 工具方法 ===== */

  private static hexToHsl(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return [h * 360, s * 100, l * 100];
  }

  private static hslToHex(h: number, s: number, l: number): string {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;
    const hh = h / 60;
    if (hh < 1) { r = c; g = x; }
    else if (hh < 2) { r = x; g = c; }
    else if (hh < 3) { g = c; b = x; }
    else if (hh < 4) { g = x; b = c; }
    else if (hh < 5) { r = x; b = c; }
    else { r = c; b = x; }

    const to8bit = (v: number) => Math.round((v + m) * 255);
    return `#${[to8bit(r), to8bit(g), to8bit(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }
}
```

### 4.5 Tailwind CSS 集成

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',  // 使用 class 策略，通过 html 上的 class 控制
  
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  
  theme: {
    extend: {
      // 使用 CSS 变量定义颜色，支持运行时动态换肤
      colors: {
        primary: {
          50:  'var(--nve-primary-50)',
          100: 'var(--nve-primary-100)',
          200: 'var(--nve-primary-200)',
          300: 'var(--nve-primary-300)',
          400: 'var(--nve-primary-400)',
          500: 'var(--nve-primary-500)',
          600: 'var(--nve-primary-600)',
          700: 'var(--nve-primary-700)',
          800: 'var(--nve-primary-800)',
          900: 'var(--nve-primary-900)',
          950: 'var(--nve-primary-950)',
        },
        secondary: {
          50:  'var(--nve-secondary-50)',
          100: 'var(--nve-secondary-100)',
          200: 'var(--nve-secondary-200)',
          300: 'var(--nve-secondary-300)',
          400: 'var(--nve-secondary-400)',
          500: 'var(--nve-secondary-500)',
          600: 'var(--nve-secondary-600)',
          700: 'var(--nve-secondary-700)',
          800: 'var(--nve-secondary-800)',
          900: 'var(--nve-secondary-900)',
          950: 'var(--nve-secondary-950)',
        },
        accent: {
          50:  'var(--nve-accent-50)',
          100: 'var(--nve-accent-100)',
          200: 'var(--nve-accent-200)',
          300: 'var(--nve-accent-300)',
          400: 'var(--nve-accent-400)',
          500: 'var(--nve-accent-500)',
          600: 'var(--nve-accent-600)',
          700: 'var(--nve-accent-700)',
          800: 'var(--nve-accent-800)',
          900: 'var(--nve-accent-900)',
          950: 'var(--nve-accent-950)',
        },
        neutral: {
          0:   'var(--nve-neutral-0)',
          50:  'var(--nve-neutral-50)',
          100: 'var(--nve-neutral-100)',
          200: 'var(--nve-neutral-200)',
          300: 'var(--nve-neutral-300)',
          400: 'var(--nve-neutral-400)',
          500: 'var(--nve-neutral-500)',
          600: 'var(--nve-neutral-600)',
          700: 'var(--nve-neutral-700)',
          800: 'var(--nve-neutral-800)',
          900: 'var(--nve-neutral-900)',
          950: 'var(--nve-neutral-950)',
        },
        // 语义色
        success: {
          50:  'var(--nve-success-50)',
          100: 'var(--nve-success-100)',
          200: 'var(--nve-success-200)',
          300: 'var(--nve-success-300)',
          400: 'var(--nve-success-400)',
          500: 'var(--nve-success-500)',
          600: 'var(--nve-success-600)',
          700: 'var(--nve-success-700)',
          800: 'var(--nve-success-800)',
          900: 'var(--nve-success-900)',
        },
        warning: {
          50:  'var(--nve-warning-50)',
          100: 'var(--nve-warning-100)',
          200: 'var(--nve-warning-200)',
          300: 'var(--nve-warning-300)',
          400: 'var(--nve-warning-400)',
          500: 'var(--nve-warning-500)',
          600: 'var(--nve-warning-600)',
          700: 'var(--nve-warning-700)',
          800: 'var(--nve-warning-800)',
          900: 'var(--nve-warning-900)',
        },
        error: {
          50:  'var(--nve-error-50)',
          100: 'var(--nve-error-100)',
          200: 'var(--nve-error-200)',
          300: 'var(--nve-error-300)',
          400: 'var(--nve-error-400)',
          500: 'var(--nve-error-500)',
          600: 'var(--nve-error-600)',
          700: 'var(--nve-error-700)',
          800: 'var(--nve-error-800)',
          900: 'var(--nve-error-900)',
        },
        info: {
          50:  'var(--nve-info-50)',
          100: 'var(--nve-info-100)',
          200: 'var(--nve-info-200)',
          300: 'var(--nve-info-300)',
          400: 'var(--nve-info-400)',
          500: 'var(--nve-info-500)',
          600: 'var(--nve-info-600)',
          700: 'var(--nve-info-700)',
          800: 'var(--nve-info-800)',
          900: 'var(--nve-info-900)',
        },
        // 背景色
        background: {
          DEFAULT: 'var(--nve-bg-default)',
          paper: 'var(--nve-bg-paper)',
          elevated: 'var(--nve-bg-elevated)',
          overlay: 'var(--nve-bg-overlay)',
        },
        // 表面色
        surface: {
          1: 'var(--nve-surface-1)',
          2: 'var(--nve-surface-2)',
          3: 'var(--nve-surface-3)',
          4: 'var(--nve-surface-4)',
        },
        // 文字色
        text: {
          DEFAULT: 'var(--nve-text-primary)',
          primary: 'var(--nve-text-primary)',
          secondary: 'var(--nve-text-secondary)',
          tertiary: 'var(--nve-text-tertiary)',
          disabled: 'var(--nve-text-disabled)',
          inverse: 'var(--nve-text-inverse)',
          link: 'var(--nve-text-link)',
        },
        // 边框色
        border: {
          DEFAULT: 'var(--nve-border-default)',
          hover: 'var(--nve-border-hover)',
          active: 'var(--nve-border-active)',
          focus: 'var(--nve-border-focus)',
          error: 'var(--nve-border-error)',
        },
      },
      
      // 背景图片（渐变）
      backgroundImage: {
        'gradient-hero': 'var(--nve-gradient-hero)',
        'gradient-card': 'var(--nve-gradient-card)',
        'gradient-button': 'var(--nve-gradient-button)',
        'gradient-ambient': 'var(--nve-gradient-ambient)',
      },
      
      // 阴影
      boxShadow: {
        sm: 'var(--nve-shadow-sm)',
        DEFAULT: 'var(--nve-shadow-md)',
        md: 'var(--nve-shadow-md)',
        lg: 'var(--nve-shadow-lg)',
        xl: 'var(--nve-shadow-xl)',
        glow: 'var(--nve-shadow-glow)',
      },
    },
  },
  
  plugins: [
    // 自定义插件：MOU 状态颜色
    function({ addUtilities }) {
      const mouUtilities = {};
      ['possibility', 'oracle', 'censor', 'flow'].forEach(state => {
        ['idle', 'active', 'warning', 'glow'].forEach(status => {
          mouUtilities[`.mou-${state}-${status}`] = {
            color: `var(--nve-mou-${state}-${status})`,
          };
        });
      });
      addUtilities(mouUtilities);
    },
  ],
};
```

### 4.6 CSS 变量亮暗双值定义

```css
/**
 * 核心 CSS 变量定义
 * 使用 :root 的 data-mode 属性切换亮暗值
 * 亮色模式作为默认值，暗色模式覆盖
 */

/* ===== 基础变量（亮色模式为默认） ===== */
:root {
  /* 这些变量在主题 CSS 文件中由每个主题的亮色值填充 */
  /* 示例：使用科幻主题作为默认 */
}

/* ===== 暗色模式覆盖 ===== */
[data-mode="dark"] {
  /* 所有颜色变量被暗色版本覆盖 */
}

/* ===== HTML 属性切换 ===== */
html[data-mode="light"] {
  color-scheme: light;
}

html[data-mode="dark"] {
  color-scheme: dark;
}

/* ===== Tailwind 的 dark 变体 ===== */
.dark .dark\:bg-primary-500 {
  background-color: var(--nve-primary-500);
}

.dark .dark\:text-text-primary {
  color: var(--nve-text-primary);
}

/* 不使用 Tailwind 的 dark 变体，而是使用 data-mode 属性 */
/* 这样可以避免 class 切换的闪烁问题 */
[data-mode="dark"] .auto-dark\:invert {
  filter: invert(1);
}
```

### 4.7 React Hook 集成

```typescript
/**
 * 亮暗模式 React Hook
 */

import { useState, useEffect, useCallback } from 'react';

const modeManager = new ModeManager();

export function useThemeMode() {
  const [mode, setModeState] = useState<ThemeMode>(modeManager.getMode());
  const [effectiveMode, setEffectiveMode] = useState<'light' | 'dark'>(modeManager.getEffectiveMode());

  useEffect(() => {
    const unsubscribe = modeManager.onChange((newMode, newEffective) => {
      setModeState(newMode);
      setEffectiveMode(newEffective);
      
      // 同步 HTML 属性
      document.documentElement.setAttribute('data-mode', newEffective);
    });

    // 初始化
    document.documentElement.setAttribute('data-mode', modeManager.getEffectiveMode());

    return unsubscribe;
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    modeManager.setMode(newMode);
  }, []);

  const toggle = useCallback(() => {
    modeManager.toggle();
  }, []);

  return { mode, effectiveMode, setMode, toggle };
}

/**
 * 在应用根组件中使用
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { effectiveMode } = useThemeMode();

  useEffect(() => {
    // 确保没有闪烁：在渲染前设置模式
    document.documentElement.setAttribute('data-mode', effectiveMode);
    
    // 同步 Tailwind 的 dark class
    if (effectiveMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [effectiveMode]);

  return <>{children}</>;
}
```

### 4.8 服务端渲染 (SSR) 兼容

```typescript
/**
 * SSR 兼容性处理
 * 防止服务端渲染与客户端首屏模式不一致导致的闪烁
 */

// 在 HTML 的 <head> 中注入的脚本（内联，最先执行）
const THEME_MODE_INLINE_SCRIPT = `
(function() {
  var mode = 'system';
  try {
    mode = localStorage.getItem('${STORAGE_KEY}') || 'system';
  } catch(e) {}
  
  var effectiveMode = mode;
  if (mode === 'system') {
    effectiveMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  document.documentElement.setAttribute('data-mode', effectiveMode);
  if (effectiveMode === 'dark') {
    document.documentElement.classList.add('dark');
  }
})();
`;

// 在 Next.js / Remix 等 SSR 框架中使用
export function getThemeModeScript(): string {
  return `<script>${THEME_MODE_INLINE_SCRIPT}</script>`;
}
```


---

## 5. 主题引擎架构

### 5.1 主题引擎架构图

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         NarrativeOS Theme Engine                              │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Theme Manager                                  │   │
│  │                                                                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │
│  │  │  load()  │  │ switch() │  │ preview()│  │ injectCSSVars()  │   │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘   │   │
│  │       └──────────────┼──────────────┘                │              │   │
│  │                      ▼                               ▼              │   │
│  │         ┌────────────────────────┐    ┌──────────────────────┐    │   │
│  │         │    Theme Registry       │    │   CSS Variable        │    │   │
│  │         │                        │    │   Injection Engine    │    │   │
│  │         │  ┌──────────────────┐  │    │                      │    │   │
│  │         │  │ Built-in Themes   │  │    │  :root {             │    │   │
│  │         │  │  - xuanhuan      │  │    │    --nve-primary-500 │    │   │
│  │         │  │  - romance       │  │    │    --nve-bg-default  │    │   │
│  │         │  │  - mystery       │  │    │    ...               │    │   │
│  │         │  │  - scifi         │  │    │  }                   │    │   │
│  │         │  │  - historical    │  │    │                      │    │   │
│  │         │  │  - urban         │  │    │  [data-theme="xxx"]  │    │   │
│  │         │  │  - horror        │  │    │  [data-mode="dark"]  │    │   │
│  │         │  │  - esports       │  │    └──────────────────────┘    │   │
│  │         │  └──────────────────┘  │                               │   │
│  │         │  ┌──────────────────┐  │                               │   │
│  │         │  │ User Themes       │  │    ┌──────────────────────┐   │   │
│  │         │  │  (localStorage)   │  │    │  Theme Cache         │   │   │
│  │         │  └──────────────────┘  │    │  (LRU, max 10)       │   │   │
│  │         │  ┌──────────────────┐  │    └──────────────────────┘   │   │
│  │         │  │ Image-Generated   │  │                               │   │
│  │         │  │  Themes           │  │                               │   │
│  │         │  └──────────────────┘  │                               │   │
│  │         └────────────────────────┘                               │   │
│  │                                                                  │   │
│  │  ┌──────────────────┐  ┌──────────────────┐                    │   │
│  │  │  Event Bus        │  │  Persistence      │                    │   │
│  │  │  theme:change     │  │  localStorage     │                    │   │
│  │  │  theme:preview    │  │  IndexedDB        │                    │   │
│  │  │  theme:apply      │  │  (for images)     │                    │   │
│  │  └──────────────────┘  └──────────────────┘                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Theme Data Structures                          │   │
│  │                                                                  │   │
│  │  ThemeConfig (Interface)                                         │   │
│  │  ├── id: string                                                  │   │
│  │  ├── name: string                                                │   │
│  │  ├── type: 'built-in' | 'user' | 'generated'                    │   │
│  │  ├── genre: NovelGenre                                           │   │
│  │  ├── source: 'preset' | 'upload' | 'image' | 'manual'           │   │
│  │  ├── colors: ColorScale[]                                        │   │
│  │  ├── variables: CSSVariables                                     │   │
│  │  ├── metadata: ThemeMetadata                                     │   │
│  │  └── createdAt / updatedAt                                       │   │
│  │                                                                  │   │
│  │  ThemeRegistry                                                   │   │
│  │  ├── register(theme: ThemeConfig)                                │   │
│  │  ├── unregister(themeId: string)                                 │   │
│  │  ├── get(themeId): ThemeConfig                                   │   │
│  │  ├── list(): ThemeConfig[]                                       │   │
│  │  └── findByGenre(genre): ThemeConfig[]                          │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Extension API                                   │   │
│  │                                                                  │   │
│  │  registerThemeProvider(provider: ThemeProvider)                   │   │
│  │  validateTheme(theme: unknown): ValidationResult                  │   │
│  │  exportTheme(themeId): ThemeExport                                │   │
│  │  importTheme(data): ThemeConfig                                   │   │
│  │  subscribeToThemeChanges(callback)                                │   │
│  │                                                                  │   │
│  │  Marketplace (预留)                                              │   │
│  │  ├── ThemeMarketplaceClient                                     │   │
│  │  ├── ThemeSubmission API                                        │   │
│  │  ├── ThemeRating & Review                                       │   │
│  │  └── ThemeDiscovery & Search                                    │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.2 主题数据接口定义

```typescript
/**
 * 主题系统完整 TypeScript 类型定义
 * @module ThemeEngine
 */

// ===== 基础类型 =====

type NovelGenre = 
  | 'xuanhuan'      // 玄幻修真
  | 'romance'       // 浪漫言情
  | 'mystery'       // 悬疑推理
  | 'scifi'         // 科幻未来
  | 'historical'    // 历史架空
  | 'urban'         // 都市异能
  | 'horror'        // 恐怖惊悚
  | 'esports'       // 游戏竞技
  | 'universal';    // 通用/自定义

type ThemeType = 'built-in' | 'user' | 'generated';
type ThemeSource = 'preset' | 'upload' | 'image' | 'manual' | 'imported';
type ThemeMode = 'light' | 'dark';

// ===== 色彩类型 =====

interface RGB {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
}

interface HSL {
  h: number;  // 0-360
  s: number;  // 0-100
  l: number;  // 0-100
}

interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

interface SemanticColorScale extends ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

// ===== CSS 变量集合 =====

interface CSSVariables {
  // 主色/辅助色/强调色
  primary: ColorScale;
  secondary: ColorScale;
  accent: ColorScale;
  
  // 中性色
  neutral: ColorScale & { 0: string };
  
  // 语义色
  success: SemanticColorScale;
  warning: SemanticColorScale;
  error: SemanticColorScale;
  info: SemanticColorScale;
  
  // MOU 状态色
  mou: MOUStateColors;
  
  // 背景色
  background: BackgroundColors;
  
  // 表面色
  surface: SurfaceColors;
  
  // 文字色
  text: TextColors;
  
  // 边框色
  border: BorderColors;
  
  // 渐变色
  gradient: GradientColors;
  
  // 阴影
  shadow: ShadowColors;
}

interface MOUStateColors {
  possibility: MOUStatusColors;
  oracle: MOUStatusColors;
  censor: MOUStatusColors;
  flow: MOUStatusColors;
}

interface MOUStatusColors {
  idle: string;
  active: string;
  warning: string;
  glow: string;
}

interface BackgroundColors {
  default: string;
  paper: string;
  elevated: string;
  overlay: string;
}

interface SurfaceColors {
  1: string;
  2: string;
  3: string;
  4: string;
}

interface TextColors {
  primary: string;
  secondary: string;
  tertiary: string;
  disabled: string;
  inverse: string;
  link: string;
}

interface BorderColors {
  default: string;
  hover: string;
  active: string;
  focus: string;
  error: string;
}

interface GradientColors {
  hero: string;
  card: string;
  button: string;
  ambient: string;
}

interface ShadowColors {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  glow: string;
}

// ===== 主题元数据 =====

interface ThemeMetadata {
  /** 主题名称 */
  name: string;
  /** 主题描述 */
  description?: string;
  /** 作者 */
  author?: string;
  /** 版本 */
  version?: string;
  /** 关联小说类型 */
  genre?: NovelGenre;
  /** 标签 */
  tags?: string[];
  /** 预览缩略图（Data URL） */
  previewImage?: string;
  /** 灵感来源描述 */
  inspiration?: string;
  /** 色彩意象说明 */
  colorMeanings?: Record<string, string>;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

// ===== 主题配置（核心接口） =====

interface ThemeConfig {
  /** 主题唯一标识 */
  id: string;
  /** 主题名称 */
  name: string;
  /** 主题类型 */
  type: ThemeType;
  /** 主题来源 */
  source: ThemeSource;
  /** 关联小说类型 */
  genre: NovelGenre;
  /** 亮色模式变量 */
  light: CSSVariables;
  /** 暗色模式变量 */
  dark: CSSVariables;
  /** 主题元数据 */
  metadata: ThemeMetadata;
  /** 是否可编辑 */
  editable: boolean;
  /** 是否可导出 */
  exportable: boolean;
  /** 扩展数据（第三方主题可用） */
  extensions?: Record<string, unknown>;
}

// ===== 主题预览接口 =====

interface ThemePreview {
  /** 预览ID */
  id: string;
  /** 被预览的主题 */
  theme: ThemeConfig;
  /** 预览模式 */
  mode: ThemeMode;
  /** 预览开始时间 */
  startedAt: string;
  /** 预览是否是临时性的 */
  isTemporary: boolean;
}

// ===== 主题导出/导入 =====

interface ThemeExport {
  /** 导出格式版本 */
  formatVersion: string;
  /** 导出的主题 */
  theme: ThemeConfig;
  /** 导出时间 */
  exportedAt: string;
  /** 签名（可选，用于验证） */
  signature?: string;
}

interface ThemeImportResult {
  /** 导入是否成功 */
  success: boolean;
  /** 导入的主题 */
  theme?: ThemeConfig;
  /** 错误信息 */
  error?: string;
  /** 导入过程中的警告 */
  warnings?: string[];
}

// ===== 主题变更事件 =====

interface ThemeChangeEvent {
  /** 事件类型 */
  type: 'theme:change' | 'theme:preview' | 'theme:apply' | 'theme:reset';
  /** 相关主题 */
  theme: ThemeConfig;
  /** 当前模式 */
  mode: ThemeMode;
  /** 事件时间 */
  timestamp: string;
  /** 是否为用户手动触发 */
  userInitiated: boolean;
}

// ===== 验证结果 =====

interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误信息 */
  errors: ValidationError[];
  /** 警告信息 */
  warnings: ValidationWarning[];
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}

interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}
```

### 5.3 ThemeManager 核心类

```typescript
/**
 * ThemeManager — 主题管理器
 * 负责主题的加载、切换、预览、持久化和事件分发
 */

import { EventEmitter } from 'events';

// 内置主题导入
import xuanhuanTheme from './themes/xuanhuan';
import romanceTheme from './themes/romance';
import mysteryTheme from './themes/mystery';
import scifiTheme from './themes/scifi';
import historicalTheme from './themes/historical';
import urbanTheme from './themes/urban';
import horrorTheme from './themes/horror';
import esportsTheme from './themes/esports';

// 常量
const STORAGE_KEY_PREFIX = 'nve:theme';
const USER_THEMES_KEY = `${STORAGE_KEY_PREFIX}:user-themes`;
const ACTIVE_THEME_KEY = `${STORAGE_KEY_PREFIX}:active`;
const THEME_CACHE_MAX_SIZE = 10;
const THEME_CHANGE_EVENT = 'nve:theme-change';
const THEME_PREVIEW_EVENT = 'nve:theme-preview';

class ThemeManager extends EventEmitter {
  private static instance: ThemeManager;
  private registry: Map<string, ThemeConfig> = new Map();
  private cache: Map<string, ThemeConfig> = new Map();
  private cacheOrder: string[] = [];
  private activeThemeId: string | null = null;
  private previewThemeId: string | null = null;
  private previousThemeId: string | null = null;
  private initialized: boolean = false;

  /** 单例 */
  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  private constructor() {
    super();
  }

  // ==================== 初始化 ====================

  /**
   * 初始化主题管理器
   * 注册内置主题，恢复用户主题和上次激活的主题
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 1. 注册内置主题
    this.registerBuiltInThemes();

    // 2. 加载用户保存的主题
    this.loadUserThemes();

    // 3. 恢复上次激活的主题
    const savedThemeId = this.getPersistedActiveTheme();
    if (savedThemeId && this.registry.has(savedThemeId)) {
      await this.apply(savedThemeId, { silent: true });
    } else {
      // 默认使用第一个内置主题
      const defaultTheme = this.registry.values().next().value;
      if (defaultTheme) {
        await this.apply(defaultTheme.id, { silent: true });
      }
    }

    this.initialized = true;
    this.emit('initialized');
  }

  /**
   * 注册内置主题
   */
  private registerBuiltInThemes(): void {
    const builtInThemes = [
      xuanhuanTheme,
      romanceTheme,
      mysteryTheme,
      scifiTheme,
      historicalTheme,
      urbanTheme,
      horrorTheme,
      esportsTheme,
    ];

    for (const theme of builtInThemes) {
      this.register(theme, { isBuiltIn: true });
    }
  }

  // ==================== 注册与发现 ====================

  /**
   * 注册主题
   */
  register(theme: ThemeConfig, options: { isBuiltIn?: boolean } = {}): ValidationResult {
    // 验证主题
    const validation = this.validateTheme(theme);
    if (!validation.valid) {
      console.error(`Theme validation failed for "${theme.name}":`, validation.errors);
      return validation;
    }

    // 内置主题不可编辑
    if (options.isBuiltIn) {
      theme.type = 'built-in';
      theme.editable = false;
    }

    this.registry.set(theme.id, theme);
    this.emit('theme:registered', theme);

    return validation;
  }

  /**
   * 取消注册主题
   */
  unregister(themeId: string): boolean {
    const theme = this.registry.get(themeId);
    if (!theme) return false;

    // 内置主题不可取消注册
    if (theme.type === 'built-in') {
      console.warn(`Cannot unregister built-in theme: ${themeId}`);
      return false;
    }

    // 如果当前正在使用此主题，先切换到默认主题
    if (this.activeThemeId === themeId) {
      const defaultTheme = this.registry.values().next().value;
      if (defaultTheme) {
        this.apply(defaultTheme.id);
      }
    }

    this.registry.delete(themeId);
    this.cache.delete(themeId);
    this.emit('theme:unregistered', theme);
    return true;
  }

  /**
   * 获取主题
   */
  get(themeId: string): ThemeConfig | undefined {
    // 先检查缓存
    if (this.cache.has(themeId)) {
      return this.cache.get(themeId);
    }

    const theme = this.registry.get(themeId);
    if (theme) {
      this.addToCache(themeId, theme);
    }
    return theme;
  }

  /**
   * 列出所有主题
   */
  list(): ThemeConfig[] {
    return Array.from(this.registry.values());
  }

  /**
   * 按小说类型查找主题
   */
  findByGenre(genre: NovelGenre): ThemeConfig[] {
    return this.list().filter(t => t.genre === genre);
  }

  /**
   * 获取当前激活主题
   */
  getActiveTheme(): ThemeConfig | null {
    if (!this.activeThemeId) return null;
    return this.get(this.activeThemeId) || null;
  }

  /**
   * 搜索主题
   */
  search(query: string): ThemeConfig[] {
    const lowerQuery = query.toLowerCase();
    return this.list().filter(t => 
      t.name.toLowerCase().includes(lowerQuery) ||
      t.metadata.description?.toLowerCase().includes(lowerQuery) ||
      t.metadata.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      t.genre.toLowerCase().includes(lowerQuery)
    );
  }

  // ==================== 主题应用 ====================

  /**
   * 应用主题（切换）
   */
  async apply(themeId: string, options: { silent?: boolean; mode?: ThemeMode } = {}): Promise<boolean> {
    const theme = this.get(themeId);
    if (!theme) {
      console.error(`Theme not found: ${themeId}`);
      return false;
    }

    // 保存当前主题用于回退
    this.previousThemeId = this.activeThemeId;

    // 取消之前的预览
    if (this.previewThemeId && this.previewThemeId !== themeId) {
      this.endPreview();
    }

    const mode = options.mode || this.getCurrentMode();
    
    // 注入 CSS 变量
    this.injectCSSVariables(theme, mode);
    
    // 设置 HTML 属性
    document.documentElement.setAttribute('data-theme', theme.genre);
    
    // 更新激活状态
    this.activeThemeId = themeId;
    this.persistActiveTheme(themeId);

    if (!options.silent) {
      this.emit('theme:change', {
        type: 'theme:change',
        theme,
        mode,
        timestamp: new Date().toISOString(),
        userInitiated: true,
      } as ThemeChangeEvent);
    }

    return true;
  }

  /**
   * 预览主题（不保存）
   */
  preview(themeId: string, mode?: ThemeMode): boolean {
    const theme = this.get(themeId);
    if (!theme) return false;

    const currentMode = mode || this.getCurrentMode();
    
    // 注入预览变量
    this.injectCSSVariables(theme, currentMode, true);
    document.documentElement.setAttribute('data-theme', theme.genre);
    
    this.previewThemeId = themeId;
    
    this.emit('theme:preview', {
      type: 'theme:preview',
      theme,
      mode: currentMode,
      timestamp: new Date().toISOString(),
      userInitiated: true,
    } as ThemeChangeEvent);

    return true;
  }

  /**
   * 结束预览（恢复之前主题）
   */
  endPreview(): boolean {
    if (!this.previewThemeId) return false;

    const activeTheme = this.getActiveTheme();
    if (activeTheme) {
      const currentMode = this.getCurrentMode();
      this.injectCSSVariables(activeTheme, currentMode);
      document.documentElement.setAttribute('data-theme', activeTheme.genre);
    }

    this.previewThemeId = null;
    this.emit('theme:preview-end');
    return true;
  }

  /**
   * 确认预览（将预览主题设为激活）
   */
  confirmPreview(): boolean {
    if (!this.previewThemeId) return false;
    
    this.activeThemeId = this.previewThemeId;
    this.previewThemeId = null;
    this.persistActiveTheme(this.activeThemeId);
    
    const theme = this.get(this.activeThemeId);
    if (theme) {
      this.emit('theme:apply', {
        type: 'theme:apply',
        theme,
        mode: this.getCurrentMode(),
        timestamp: new Date().toISOString(),
        userInitiated: true,
      } as ThemeChangeEvent);
    }
    
    return true;
  }

  /**
   * 重置为默认主题
   */
  reset(): boolean {
    const defaultTheme = this.registry.values().next().value;
    if (!defaultTheme) return false;
    
    return this.apply(defaultTheme.id);
  }

  // ==================== CSS 变量注入 ====================

  /**
   * 将主题变量注入 CSS
   */
  private injectCSSVariables(theme: ThemeConfig, mode: ThemeMode, isPreview: boolean = false): void {
    const variables = mode === 'light' ? theme.light : theme.dark;
    const styleId = isPreview ? 'nve-theme-preview' : 'nve-theme-active';
    
    // 构建 CSS 文本
    const cssText = this.buildCSSVariables(variables, mode);
    
    // 查找或创建 style 元素
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    
    styleEl.textContent = cssText;
  }

  /**
   * 构建 CSS 变量文本
   */
  private buildCSSVariables(vars: CSSVariables, mode: ThemeMode): string {
    const lines: string[] = [];
    
    lines.push(`/* NarrativeOS Theme Variables - ${mode} mode */`);
    lines.push(`:root {`);
    
    // 主色/辅助色/强调色
    this.appendColorScale(lines, 'primary', vars.primary);
    this.appendColorScale(lines, 'secondary', vars.secondary);
    this.appendColorScale(lines, 'accent', vars.accent);
    
    // 中性色
    this.appendColorScale(lines, 'neutral', vars.neutral as unknown as Record<string, string>);
    
    // 语义色
    this.appendColorScale(lines, 'success', vars.success);
    this.appendColorScale(lines, 'warning', vars.warning);
    this.appendColorScale(lines, 'error', vars.error);
    this.appendColorScale(lines, 'info', vars.info);
    
    // MOU 状态色
    for (const [state, colors] of Object.entries(vars.mou)) {
      for (const [status, value] of Object.entries(colors)) {
        lines.push(`  --nve-mou-${state}-${status}: ${value};`);
      }
    }
    
    // 背景色
    for (const [key, value] of Object.entries(vars.background)) {
      lines.push(`  --nve-bg-${key}: ${value};`);
    }
    
    // 表面色
    for (const [key, value] of Object.entries(vars.surface)) {
      lines.push(`  --nve-surface-${key}: ${value};`);
    }
    
    // 文字色
    for (const [key, value] of Object.entries(vars.text)) {
      lines.push(`  --nve-text-${key}: ${value};`);
    }
    
    // 边框色
    for (const [key, value] of Object.entries(vars.border)) {
      lines.push(`  --nve-border-${key}: ${value};`);
    }
    
    // 渐变色
    for (const [key, value] of Object.entries(vars.gradient)) {
      lines.push(`  --nve-gradient-${key}: ${value};`);
    }
    
    // 阴影
    for (const [key, value] of Object.entries(vars.shadow)) {
      lines.push(`  --nve-shadow-${key}: ${value};`);
    }
    
    lines.push(`}`);
    
    return lines.join('\n');
  }

  private appendColorScale(lines: string[], name: string, scale: Record<string, string>): void {
    for (const [key, value] of Object.entries(scale)) {
      const suffix = key === '0' ? '-0' : `-${key}`;
      lines.push(`  --nve-${name}${suffix}: ${value};`);
    }
  }

  // ==================== 模式管理 ====================

  /**
   * 获取当前生效的模式
   */
  private getCurrentMode(): ThemeMode {
    const mode = document.documentElement.getAttribute('data-mode');
    return (mode === 'dark' ? 'dark' : 'light') as ThemeMode;
  }

  /**
   * 处理模式变化（由 ModeManager 触发）
   */
  handleModeChange(mode: ThemeMode): void {
    const activeTheme = this.getActiveTheme();
    if (!activeTheme) return;

    // 重新注入当前主题的变量（使用新模式）
    this.injectCSSVariables(activeTheme, mode);
    
    // 如果有预览主题，也更新预览
    if (this.previewThemeId) {
      const previewTheme = this.get(this.previewThemeId);
      if (previewTheme) {
        this.injectCSSVariables(previewTheme, mode, true);
      }
    }
  }

  // ==================== 持久化 ====================

  /**
   * 保存用户主题到 localStorage
   */
  private persistUserTheme(theme: ThemeConfig): void {
    try {
      const themes = this.loadPersistedUserThemes();
      const idx = themes.findIndex(t => t.id === theme.id);
      if (idx >= 0) {
        themes[idx] = theme;
      } else {
        themes.push(theme);
      }
      localStorage.setItem(USER_THEMES_KEY, JSON.stringify(themes));
    } catch (error) {
      console.error('Failed to persist user theme:', error);
    }
  }

  /**
   * 加载用户保存的主题
   */
  private loadUserThemes(): void {
    const themes = this.loadPersistedUserThemes();
    for (const themeData of themes) {
      try {
        const theme = this.deserializeTheme(themeData);
        this.register(theme);
      } catch (error) {
        console.warn('Failed to load user theme:', error);
      }
    }
  }

  private loadPersistedUserThemes(): any[] {
    try {
      const data = localStorage.getItem(USER_THEMES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private persistActiveTheme(themeId: string): void {
    try {
      localStorage.setItem(ACTIVE_THEME_KEY, themeId);
    } catch (error) {
      console.error('Failed to persist active theme:', error);
    }
  }

  private getPersistedActiveTheme(): string | null {
    try {
      return localStorage.getItem(ACTIVE_THEME_KEY);
    } catch {
      return null;
    }
  }

  // ==================== 导入/导出 ====================

  /**
   * 导出主题
   */
  exportTheme(themeId: string): ThemeExport | null {
    const theme = this.get(themeId);
    if (!theme || !theme.exportable) return null;

    return {
      formatVersion: '3.0.0',
      theme: { ...theme, extensions: undefined },
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * 导入主题
   */
  importTheme(data: unknown): ThemeImportResult {
    try {
      const exportData = data as ThemeExport;
      
      // 验证格式版本
      if (!exportData.formatVersion || !exportData.theme) {
        return { success: false, error: 'Invalid theme format' };
      }

      // 验证主题
      const validation = this.validateTheme(exportData.theme);
      if (!validation.valid) {
        return { success: false, error: 'Theme validation failed', warnings: validation.warnings.map(w => w.message) };
      }

      // 生成新ID避免冲突
      const theme = {
        ...exportData.theme,
        id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'user' as ThemeType,
        source: 'imported' as ThemeSource,
        metadata: {
          ...exportData.theme.metadata,
          updatedAt: new Date().toISOString(),
        },
      };

      this.register(theme);
      this.persistUserTheme(theme);

      return { success: true, theme, warnings: validation.warnings.map(w => w.message) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Import failed' };
    }
  }

  // ==================== 验证 ====================

  /**
   * 验证主题配置
   */
  validateTheme(theme: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const t = theme as Partial<ThemeConfig>;

    // 必填字段检查
    if (!t.id) errors.push({ field: 'id', message: 'Theme ID is required', code: 'MISSING_ID' });
    if (!t.name) errors.push({ field: 'name', message: 'Theme name is required', code: 'MISSING_NAME' });
    if (!t.genre) errors.push({ field: 'genre', message: 'Genre is required', code: 'MISSING_GENRE' });
    if (!t.light) errors.push({ field: 'light', message: 'Light mode variables required', code: 'MISSING_LIGHT' });
    if (!t.dark) errors.push({ field: 'dark', message: 'Dark mode variables required', code: 'MISSING_DARK' });

    // 色彩变量完整性检查
    if (t.light) {
      const requiredScales = ['primary', 'secondary', 'accent'];
      for (const scale of requiredScales) {
        const scaleData = t.light[scale as keyof CSSVariables] as ColorScale | undefined;
        if (!scaleData || !scaleData[500]) {
          warnings.push({ 
            field: `light.${scale}`, 
            message: `${scale} color scale may be incomplete`,
            suggestion: 'Ensure all scale levels (50-950) are defined'
          });
        }
      }
    }

    // WCAG 对比度检查
    if (t.light?.text?.primary && t.light?.background?.default) {
      const contrast = this.calculateContrastRatio(
        t.light.text.primary,
        t.light.background.default
      );
      if (contrast < 4.5) {
        warnings.push({
          field: 'light.text.primary',
          message: `Contrast ratio ${contrast.toFixed(2)}:1 below WCAG AA (4.5:1)`,
          suggestion: 'Adjust text or background color for better readability'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 计算对比度 (WCAG 2.1)
   */
  private calculateContrastRatio(color1: string, color2: string): number {
    const lum1 = this.getRelativeLuminance(color1);
    const lum2 = this.getRelativeLuminance(color2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  private getRelativeLuminance(hex: string): number {
    const rgb = hex.replace('#', '').match(/.{2}/g)?.map(v => parseInt(v, 16)) || [0, 0, 0];
    const [r, g, b] = rgb.map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // ==================== 缓存管理 ====================

  private addToCache(themeId: string, theme: ThemeConfig): void {
    if (this.cache.has(themeId)) {
      // 移到末尾（最近使用）
      this.cacheOrder = this.cacheOrder.filter(id => id !== themeId);
    }
    
    this.cache.set(themeId, theme);
    this.cacheOrder.push(themeId);
    
    // LRU 淘汰
    while (this.cacheOrder.length > THEME_CACHE_MAX_SIZE) {
      const oldest = this.cacheOrder.shift();
      if (oldest && oldest !== this.activeThemeId) {
        this.cache.delete(oldest);
      }
    }
  }

  // ==================== 序列化/反序列化 ====================

  private deserializeTheme(data: any): ThemeConfig {
    // 将纯数据对象转换为完整的 ThemeConfig
    return {
      ...data,
      type: data.type || 'user',
      source: data.source || 'imported',
      editable: data.editable ?? true,
      exportable: data.exportable ?? true,
    };
  }

  // ==================== 清理 ====================

  dispose(): void {
    // 移除注入的 style 元素
    ['nve-theme-active', 'nve-theme-preview'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    
    this.registry.clear();
    this.cache.clear();
    this.cacheOrder = [];
    this.activeThemeId = null;
    this.previewThemeId = null;
    this.previousThemeId = null;
    this.initialized = false;
    this.removeAllListeners();
  }
}

// 导出单例
export const themeManager = ThemeManager.getInstance();
```

### 5.4 主题持久化存储结构

```typescript
/**
 * localStorage 存储结构设计
 */

// Key: 'nve:theme:active'
// Value: "xuanhuan" (主题ID)

// Key: 'nve:theme:user-themes'
// Value: ThemeConfig[] (序列化后的用户主题数组)

// Key: 'nve:theme:mode'
// Value: "light" | "dark" | "system"

// Key: 'nve:theme:favorites'
// Value: string[] (收藏的主题ID列表)

// Key: 'nve:theme:history'
// Value: { themeId: string; usedAt: string }[] (使用历史)

// Key: 'nve:geo-location'
// Value: { latitude: number; longitude: number } (地理位置缓存)

// IndexedDB 用于存储大文件（主题图片）
interface ThemeImageStore {
  // 数据库: 'NarrativeOS-Themes'
  // 对象存储: 'theme-images'
  // Key: themeId
  // Value: { blob: Blob; thumbnail: string; uploadedAt: string }
}
```

### 5.5 第三方主题扩展接口

```typescript
/**
 * 第三方主题提供者的注册接口
 * 预留主题 marketplace 架构
 */

interface ThemeProvider {
  /** 提供者标识 */
  id: string;
  /** 提供者名称 */
  name: string;
  /** 获取主题列表 */
  listThemes(): Promise<ThemeSummary[]>;
  /** 获取主题详情 */
  getTheme(themeId: string): Promise<ThemeConfig>;
  /** 搜索主题 */
  searchThemes(query: string): Promise<ThemeSummary[]>;
  /** 获取主题预览图 */
  getPreview(themeId: string): Promise<string>;
}

interface ThemeSummary {
  id: string;
  name: string;
  author: string;
  genre: NovelGenre;
  rating: number;
  downloadCount: number;
  thumbnail: string;
}

interface ThemeMarketplaceClient {
  /** 注册主题提供者 */
  registerProvider(provider: ThemeProvider): void;
  /** 取消注册 */
  unregisterProvider(providerId: string): void;
  /** 浏览主题 */
  browse(options: BrowseOptions): Promise<PaginatedThemes>;
  /** 安装主题 */
  install(themeId: string, source: string): Promise<ThemeConfig>;
  /** 提交主题 */
  submit(theme: ThemeConfig): Promise<SubmissionResult>;
  /** 评分主题 */
  rate(themeId: string, rating: number): Promise<void>;
}

interface BrowseOptions {
  genre?: NovelGenre;
  sortBy?: 'popular' | 'newest' | 'rating' | 'downloads';
  page?: number;
  pageSize?: number;
  query?: string;
}

interface PaginatedThemes {
  themes: ThemeSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface SubmissionResult {
  success: boolean;
  themeId?: string;
  reviewUrl?: string;
  estimatedReviewTime?: string;
}

// React Hook 用于获取主题市场
export function useThemeMarketplace() {
  const [providers, setProviders] = useState<ThemeProvider[]>([]);
  
  const registerProvider = useCallback((provider: ThemeProvider) => {
    setProviders(prev => [...prev.filter(p => p.id !== provider.id), provider]);
  }, []);

  return { providers, registerProvider };
}
```

### 5.6 React Hooks 集成

```typescript
/**
 * 主题引擎的 React Hooks 集成
 */

import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { themeManager } from './ThemeManager';

// ===== Context =====

interface ThemeContextValue {
  activeTheme: ThemeConfig | null;
  availableThemes: ThemeConfig[];
  applyTheme: (themeId: string) => Promise<boolean>;
  previewTheme: (themeId: string) => boolean;
  endPreview: () => boolean;
  isPreviewing: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ===== Provider Component =====

export function ThemeEngineProvider({ children }: { children: React.ReactNode }) {
  const [activeTheme, setActiveTheme] = useState<ThemeConfig | null>(null);
  const [availableThemes, setAvailableThemes] = useState<ThemeConfig[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    // 初始化
    themeManager.initialize().then(() => {
      setActiveTheme(themeManager.getActiveTheme());
      setAvailableThemes(themeManager.list());
    });

    // 监听主题变化
    const handleChange = (event: ThemeChangeEvent) => {
      setActiveTheme(event.theme);
      setIsPreviewing(event.type === 'theme:preview');
    };

    themeManager.on('theme:change', handleChange);
    themeManager.on('theme:preview', handleChange);
    themeManager.on('theme:preview-end', () => setIsPreviewing(false));

    return () => {
      themeManager.off('theme:change', handleChange);
      themeManager.off('theme:preview', handleChange);
      themeManager.off('theme:preview-end', () => setIsPreviewing(false));
    };
  }, []);

  const applyTheme = useCallback(async (themeId: string) => {
    const result = await themeManager.apply(themeId);
    if (result) {
      setActiveTheme(themeManager.getActiveTheme());
    }
    return result;
  }, []);

  const previewTheme = useCallback((themeId: string) => {
    const result = themeManager.preview(themeId);
    setIsPreviewing(result);
    return result;
  }, []);

  const endPreview = useCallback(() => {
    const result = themeManager.endPreview();
    setIsPreviewing(false);
    return result;
  }, []);

  return (
    <ThemeContext.Provider value={{
      activeTheme,
      availableThemes,
      applyTheme,
      previewTheme,
      endPreview,
      isPreviewing,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ===== Custom Hooks =====

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeEngineProvider');
  return context;
}

export function useActiveTheme() {
  const { activeTheme } = useTheme();
  return activeTheme;
}

export function useThemesByGenre(genre: NovelGenre) {
  const { availableThemes } = useTheme();
  return availableThemes.filter(t => t.genre === genre);
}

export function useThemePreview() {
  const { previewTheme, endPreview, isPreviewing } = useTheme();
  
  const startPreview = useCallback((themeId: string) => {
    previewTheme(themeId);
  }, [previewTheme]);

  return { startPreview, endPreview, isPreviewing };
}
```


---

## 6. 特殊元素的主题适配

### 6.1 代码块语法高亮

```css
/**
 * 代码块语法高亮主题适配
 * 基于 CSS 变量，自动适配当前主题
 * 支持 NarrativeOS 嵌入式代码编辑器
 */

/* 基础代码块样式 */
.nve-code-block {
  background: var(--nve-bg-paper);
  border: 1px solid var(--nve-border-default);
  border-radius: 8px;
  font-family: 'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace;
  font-size: 14px;
  line-height: 1.6;
  overflow-x: auto;
}

.nve-code-block pre {
  margin: 0;
  padding: 16px 20px;
}

/* 亮色模式语法高亮 */
[data-mode="light"] .nve-code-block {
  /* 关键字 */
  .token-keyword { color: var(--nve-primary-600); font-weight: 600; }
  /* 字符串 */
  .token-string { color: var(--nve-secondary-500); }
  /* 数字 */
  .token-number { color: var(--nve-accent-500); }
  /* 注释 */
  .token-comment { color: var(--nve-neutral-400); font-style: italic; }
  /* 函数 */
  .token-function { color: var(--nve-info-600); }
  /* 类名 */
  .token-class-name { color: var(--nve-primary-500); font-weight: 600; }
  /* 操作符 */
  .token-operator { color: var(--nve-neutral-600); }
  /* 标点 */
  .token-punctuation { color: var(--nve-neutral-500); }
  /* 变量 */
  .token-variable { color: var(--nve-text-primary); }
  /* 布尔值 */
  .token-boolean { color: var(--nve-warning-500); font-weight: 600; }
  /* 标签 */
  .token-tag { color: var(--nve-primary-500); }
  /* 属性 */
  .token-attr-name { color: var(--nve-secondary-500); }
  /* 属性值 */
  .token-attr-value { color: var(--nve-accent-500); }
  /* 选择器 */
  .token-selector { color: var(--nve-info-500); }
  /* 插入的代码 */
  .token-inserted { 
    background: var(--nve-success-100); 
    color: var(--nve-success-700);
  }
  /* 删除的代码 */
  .token-deleted { 
    background: var(--nve-error-100); 
    color: var(--nve-error-700);
    text-decoration: line-through;
  }
  /* 行号 */
  .line-number {
    color: var(--nve-neutral-400);
    border-right: 1px solid var(--nve-border-default);
    padding-right: 12px;
    margin-right: 12px;
    text-align: right;
    min-width: 40px;
    user-select: none;
  }
  /* 当前行高亮 */
  .line-highlight {
    background: var(--nve-primary-50);
    border-left: 3px solid var(--nve-primary-400);
  }
}

/* 暗色模式语法高亮 */
[data-mode="dark"] .nve-code-block {
  .token-keyword { color: var(--nve-primary-400); font-weight: 600; }
  .token-string { color: var(--nve-secondary-400); }
  .token-number { color: var(--nve-accent-400); }
  .token-comment { color: var(--nve-neutral-500); font-style: italic; }
  .token-function { color: var(--nve-info-400); }
  .token-class-name { color: var(--nve-primary-300); font-weight: 600; }
  .token-operator { color: var(--nve-neutral-400); }
  .token-punctuation { color: var(--nve-neutral-500); }
  .token-variable { color: var(--nve-text-primary); }
  .token-boolean { color: var(--nve-warning-400); font-weight: 600; }
  .token-tag { color: var(--nve-primary-300); }
  .token-attr-name { color: var(--nve-secondary-300); }
  .token-attr-value { color: var(--nve-accent-300); }
  .token-selector { color: var(--nve-info-300); }
  .token-inserted { 
    background: rgba(76, 175, 80, 0.15); 
    color: var(--nve-success-300);
  }
  .token-deleted { 
    background: rgba(244, 67, 54, 0.15); 
    color: var(--nve-error-300);
    text-decoration: line-through;
  }
  .line-number {
    color: var(--nve-neutral-600);
    border-right: 1px solid var(--nve-border-default);
  }
  .line-highlight {
    background: rgba(61, 139, 143, 0.15);
    border-left: 3px solid var(--nve-primary-400);
  }
}

/* 行内代码 */
nve-inline-code {
  background: var(--nve-surface-2);
  color: var(--nve-text-primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 0.875em;
  border: 1px solid var(--nve-border-default);
}
```

### 6.2 图表主题适配

```typescript
/**
 * 图表主题适配
 * 支持 Chart.js 和 ECharts 的动态主题切换
 */

interface ChartThemeColors {
  backgroundColor: string;
  textColor: string;
  gridColor: string;
  tooltipBackground: string;
  tooltipText: string;
  legendText: string;
  seriesColors: string[];
}

class ChartThemeAdapter {
  /**
   * 获取当前主题的图表颜色配置
   */
  static getThemeColors(): ChartThemeColors {
    const computed = getComputedStyle(document.documentElement);
    
    // 从 CSS 变量读取
    const primary500 = computed.getPropertyValue('--nve-primary-500').trim();
    const secondary500 = computed.getPropertyValue('--nve-secondary-500').trim();
    const accent500 = computed.getPropertyValue('--nve-accent-500').trim();
    const success500 = computed.getPropertyValue('--nve-success-500').trim();
    const warning500 = computed.getPropertyValue('--nve-warning-500').trim();
    const error500 = computed.getPropertyValue('--nve-error-500').trim();
    const info500 = computed.getPropertyValue('--nve-info-500').trim();
    
    return {
      backgroundColor: computed.getPropertyValue('--nve-bg-default').trim(),
      textColor: computed.getPropertyValue('--nve-text-primary').trim(),
      gridColor: computed.getPropertyValue('--nve-border-default').trim(),
      tooltipBackground: computed.getPropertyValue('--nve-bg-elevated').trim(),
      tooltipText: computed.getPropertyValue('--nve-text-primary').trim(),
      legendText: computed.getPropertyValue('--nve-text-secondary').trim(),
      seriesColors: [
        primary500,
        secondary500,
        accent500,
        success500,
        warning500,
        error500,
        info500,
        // 更多颜色变体
        computed.getPropertyValue('--nve-primary-300').trim(),
        computed.getPropertyValue('--nve-secondary-300').trim(),
        computed.getPropertyValue('--nve-accent-300').trim(),
        computed.getPropertyValue('--nve-success-300').trim(),
      ],
    };
  }

  /**
   * Chart.js 主题配置
   */
  static getChartJSConfig(): object {
    const colors = this.getThemeColors();
    
    return {
      color: colors.textColor,
      borderColor: colors.gridColor,
      backgroundColor: colors.backgroundColor,
      plugins: {
        legend: {
          labels: { color: colors.legendText },
        },
        tooltip: {
          backgroundColor: colors.tooltipBackground,
          titleColor: colors.tooltipText,
          bodyColor: colors.tooltipText,
          borderColor: colors.gridColor,
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          grid: { color: colors.gridColor },
          ticks: { color: colors.textColor },
        },
        y: {
          grid: { color: colors.gridColor },
          ticks: { color: colors.textColor },
        },
      },
    };
  }

  /**
   * ECharts 主题配置
   */
  static getEChartsTheme(): object {
    const colors = this.getThemeColors();
    
    return {
      color: colors.seriesColors,
      backgroundColor: 'transparent',
      textStyle: { color: colors.textColor },
      title: { textStyle: { color: colors.textColor } },
      legend: { textStyle: { color: colors.legendText } },
      tooltip: {
        backgroundColor: colors.tooltipBackground,
        borderColor: colors.gridColor,
        textStyle: { color: colors.tooltipText },
      },
      xAxis: {
        axisLine: { lineStyle: { color: colors.gridColor } },
        axisLabel: { color: colors.textColor },
        splitLine: { lineStyle: { color: colors.gridColor } },
      },
      yAxis: {
        axisLine: { lineStyle: { color: colors.gridColor } },
        axisLabel: { color: colors.textColor },
        splitLine: { lineStyle: { color: colors.gridColor } },
      },
    };
  }

  /**
   * React Hook: 监听主题变化并自动更新图表
   */
  static useChartTheme() {
    const [chartColors, setChartColors] = useState<ChartThemeColors>(this.getThemeColors());

    useEffect(() => {
      const handleThemeChange = () => {
        setChartColors(this.getThemeColors());
      };

      window.addEventListener('nve:theme-change', handleThemeChange);
      window.addEventListener('nve:theme-mode-change', handleThemeChange);

      return () => {
        window.removeEventListener('nve:theme-change', handleThemeChange);
        window.removeEventListener('nve:theme-mode-change', handleThemeChange);
      };
    }, []);

    return chartColors;
  }
}
```

### 6.3 地图主题适配

```css
/**
 * Leaflet 地图主题适配
 * 暗色模式下反转地图瓦片颜色
 */

/* 地图容器基础样式 */
.nve-map-container {
  background: var(--nve-bg-default);
  border: 1px solid var(--nve-border-default);
  border-radius: 8px;
  overflow: hidden;
}

/* 暗色模式：反色地图瓦片 + 调整对比度 */
[data-mode="dark"] .nve-map-container .leaflet-tile {
  filter: brightness(0.6) contrast(1.2) saturate(0.8);
}

/* 地图控件主题化 */
.nve-map-container .leaflet-control-zoom a {
  background: var(--nve-surface-1) !important;
  color: var(--nve-text-primary) !important;
  border-color: var(--nve-border-default) !important;
}

.nve-map-container .leaflet-control-zoom a:hover {
  background: var(--nve-surface-2) !important;
}

/* 地图弹窗主题化 */
.nve-map-container .leaflet-popup-content-wrapper {
  background: var(--nve-bg-elevated) !important;
  color: var(--nve-text-primary) !important;
  border: 1px solid var(--nve-border-default);
  border-radius: 8px !important;
}

.nve-map-container .leaflet-popup-tip {
  background: var(--nve-bg-elevated) !important;
}

/* 地图标记主题色 */
.nve-map-marker {
  background: var(--nve-primary-500);
  border: 2px solid var(--nve-neutral-0);
  border-radius: 50%;
  box-shadow: 0 2px 6px var(--nve-bg-overlay);
}

/* 地图路径主题色 */
.nve-map-path {
  stroke: var(--nve-primary-500);
  stroke-width: 3;
  stroke-opacity: 0.8;
  fill: var(--nve-primary-100);
  fill-opacity: 0.3;
}
```

### 6.4 Markdown 渲染主题适配

```css
/**
 * Markdown 渲染主题适配
 * 完整的 Markdown 元素样式，适配 NarrativeOS 主题系统
 */

.nve-markdown {
  /* 基础排版 */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.75;
  color: var(--nve-text-primary);
}

/* 标题 */
.nve-markdown h1 {
  font-size: 2em;
  font-weight: 700;
  color: var(--nve-text-primary);
  border-bottom: 2px solid var(--nve-primary-500);
  padding-bottom: 8px;
  margin: 32px 0 20px;
}

.nve-markdown h2 {
  font-size: 1.6em;
  font-weight: 600;
  color: var(--nve-text-primary);
  border-bottom: 1px solid var(--nve-border-default);
  padding-bottom: 6px;
  margin: 28px 0 16px;
}

.nve-markdown h3 {
  font-size: 1.3em;
  font-weight: 600;
  color: var(--nve-text-secondary);
  margin: 24px 0 12px;
}

.nve-markdown h4, .nve-markdown h5, .nve-markdown h6 {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--nve-text-tertiary);
  margin: 20px 0 10px;
}

/* 段落 */
.nve-markdown p {
  margin: 12px 0;
  color: var(--nve-text-primary);
}

/* 链接 */
.nve-markdown a {
  color: var(--nve-text-link);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 200ms;
}

.nve-markdown a:hover {
  border-bottom-color: var(--nve-text-link);
}

/* 粗体和斜体 */
.nve-markdown strong {
  color: var(--nve-text-primary);
  font-weight: 700;
}

.nve-markdown em {
  color: var(--nve-text-secondary);
  font-style: italic;
}

/* 列表 */
.nve-markdown ul, .nve-markdown ol {
  padding-left: 24px;
  margin: 12px 0;
}

.nve-markdown li {
  margin: 6px 0;
  color: var(--nve-text-primary);
}

.nve-markdown li::marker {
  color: var(--nve-primary-500);
}

/* 任务列表 */
.nve-markdown input[type="checkbox"] {
  accent-color: var(--nve-primary-500);
  width: 16px;
  height: 16px;
  margin-right: 8px;
}

/* 引用块 */
.nve-markdown blockquote {
  border-left: 4px solid var(--nve-primary-500);
  background: var(--nve-surface-1);
  padding: 12px 20px;
  margin: 16px 0;
  border-radius: 0 8px 8px 0;
  color: var(--nve-text-secondary);
  font-style: italic;
}

.nve-markdown blockquote p {
  margin: 0;
  color: inherit;
}

/* 代码块（继承 6.1 的代码块样式） */
.nve-markdown pre {
  background: var(--nve-bg-paper);
  border: 1px solid var(--nve-border-default);
  border-radius: 8px;
  padding: 16px 20px;
  overflow-x: auto;
  margin: 16px 0;
}

.nve-markdown code {
  font-family: 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 0.875em;
}

.nve-markdown :not(pre) > code {
  background: var(--nve-surface-2);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--nve-border-default);
  color: var(--nve-accent-500);
}

/* 表格 */
.nve-markdown table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  border-radius: 8px;
  overflow: hidden;
}

.nve-markdown thead {
  background: var(--nve-surface-2);
}

.nve-markdown th {
  padding: 10px 16px;
  text-align: left;
  font-weight: 600;
  color: var(--nve-text-primary);
  border-bottom: 2px solid var(--nve-border-active);
}

.nve-markdown td {
  padding: 10px 16px;
  color: var(--nve-text-primary);
  border-bottom: 1px solid var(--nve-border-default);
}

.nve-markdown tbody tr:nth-child(even) {
  background: var(--nve-surface-1);
}

.nve-markdown tbody tr:hover {
  background: var(--nve-surface-2);
}

/* 水平线 */
.nve-markdown hr {
  border: none;
  height: 1px;
  background: var(--nve-border-default);
  margin: 24px 0;
}

/* 图片 */
.nve-markdown img {
  max-width: 100%;
  border-radius: 8px;
  margin: 16px 0;
}

[data-mode="dark"] .nve-markdown img {
  filter: brightness(0.85) contrast(1.05);
}

/* 删除线 */
.nve-markdown del {
  color: var(--nve-text-disabled);
  text-decoration: line-through;
  text-decoration-color: var(--nve-error-500);
}

/* 高亮标记 */
.nve-markdown mark {
  background: var(--nve-warning-200);
  color: var(--nve-text-primary);
  padding: 2px 4px;
  border-radius: 3px;
}

[data-mode="dark"] .nve-markdown mark {
  background: rgba(255, 193, 7, 0.3);
}

/* 脚注 */
.nve-markdown .footnote {
  font-size: 0.85em;
  color: var(--nve-text-tertiary);
  border-top: 1px solid var(--nve-border-default);
  padding-top: 12px;
  margin-top: 24px;
}

/* 目录 */
.nve-markdown .toc {
  background: var(--nve-surface-1);
  border: 1px solid var(--nve-border-default);
  border-radius: 8px;
  padding: 16px 20px;
  margin: 16px 0;
}

.nve-markdown .toc-title {
  font-weight: 600;
  color: var(--nve-text-primary);
  margin-bottom: 8px;
}

.nve-markdown .toc a {
  color: var(--nve-text-secondary);
  text-decoration: none;
}

.nve-markdown .toc a:hover {
  color: var(--nve-primary-500);
}
```

### 6.5 CodeMirror 编辑器主题适配

```typescript
/**
 * CodeMirror 6 主题适配
 * 动态生成 CodeMirror 主题扩展
 */

import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

interface CodeMirrorThemeColors {
  background: string;
  foreground: string;
  caret: string;
  selection: string;
  selectionMatch: string;
  lineHighlight: string;
  gutterBackground: string;
  gutterForeground: string;
  gutterActiveForeground: string;
}

class CodeMirrorThemeAdapter {
  /**
   * 从 NarrativeOS 主题生成 CodeMirror 主题
   */
  static generateTheme(): Extension {
    const computed = getComputedStyle(document.documentElement);
    
    const colors: CodeMirrorThemeColors = {
      background: computed.getPropertyValue('--nve-bg-paper').trim(),
      foreground: computed.getPropertyValue('--nve-text-primary').trim(),
      caret: computed.getPropertyValue('--nve-primary-500').trim(),
      selection: computed.getPropertyValue('--nve-primary-100').trim(),
      selectionMatch: computed.getPropertyValue('--nve-primary-200').trim(),
      lineHighlight: computed.getPropertyValue('--nve-primary-50').trim(),
      gutterBackground: computed.getPropertyValue('--nve-surface-1').trim(),
      gutterForeground: computed.getPropertyValue('--nve-text-tertiary').trim(),
      gutterActiveForeground: computed.getPropertyValue('--nve-text-primary').trim(),
    };

    // 基础编辑器主题
    const baseTheme = EditorView.theme({
      '&': {
        backgroundColor: colors.background,
        color: colors.foreground,
        fontSize: '15px',
        fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
      },
      '.cm-content': {
        caretColor: colors.caret,
        padding: '16px 0',
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: colors.caret,
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: colors.selection,
      },
      '.cm-selectionMatch': {
        backgroundColor: colors.selectionMatch,
      },
      '.cm-activeLine': {
        backgroundColor: colors.lineHighlight,
      },
      '.cm-gutters': {
        backgroundColor: colors.gutterBackground,
        color: colors.gutterForeground,
        border: 'none',
        borderRight: `1px solid ${computed.getPropertyValue('--nve-border-default').trim()}`,
      },
      '.cm-activeLineGutter': {
        backgroundColor: colors.lineHighlight,
        color: colors.gutterActiveForeground,
      },
      '.cm-lineNumbers': {
        color: colors.gutterForeground,
      },
    }, { dark: document.documentElement.getAttribute('data-mode') === 'dark' });

    // 语法高亮
    const highlightStyle = HighlightStyle.define([
      { tag: tags.keyword, color: computed.getPropertyValue('--nve-primary-500').trim(), fontWeight: 'bold' },
      { tag: tags.string, color: computed.getPropertyValue('--nve-secondary-500').trim() },
      { tag: tags.number, color: computed.getPropertyValue('--nve-accent-500').trim() },
      { tag: tags.comment, color: computed.getPropertyValue('--nve-neutral-500').trim(), fontStyle: 'italic' },
      { tag: tags.function(tags.variableName), color: computed.getPropertyValue('--nve-info-500').trim() },
      { tag: tags.className, color: computed.getPropertyValue('--nve-primary-500').trim(), fontWeight: 'bold' },
      { tag: tags.operator, color: computed.getPropertyValue('--nve-neutral-600').trim() },
      { tag: tags.punctuation, color: computed.getPropertyValue('--nve-neutral-500').trim() },
      { tag: tags.propertyName, color: computed.getPropertyValue('--nve-secondary-400').trim() },
      { tag: tags.bool, color: computed.getPropertyValue('--nve-warning-500').trim(), fontWeight: 'bold' },
      { tag: tags.null, color: computed.getPropertyValue('--nve-warning-500').trim() },
      { tag: tags.typeName, color: computed.getPropertyValue('--nve-primary-400').trim() },
      { tag: tags.tagName, color: computed.getPropertyValue('--nve-primary-500').trim() },
      { tag: tags.attributeName, color: computed.getPropertyValue('--nve-secondary-500').trim() },
      { tag: tags.attributeValue, color: computed.getPropertyValue('--nve-accent-500').trim() },
    ]);

    return [
      baseTheme,
      syntaxHighlighting(highlightStyle),
    ];
  }

  /**
   * 监听主题变化，动态更新 CodeMirror
   */
  static useCodeMirrorTheme(view: EditorView | null) {
    useEffect(() => {
      if (!view) return;

      const handleThemeChange = () => {
        const newTheme = this.generateTheme();
        view.dispatch({
          effects: EditorView.reconfigure.of(newTheme),
        });
      };

      window.addEventListener('nve:theme-change', handleThemeChange);
      window.addEventListener('nve:theme-mode-change', handleThemeChange);

      return () => {
        window.removeEventListener('nve:theme-change', handleThemeChange);
        window.removeEventListener('nve:theme-mode-change', handleThemeChange);
      };
    }, [view]);
  }
}
```

### 6.6 自定义滑动条主题

```css
/**
 * 自定义滑动条主题
 * 适配 NarrativeOS 主题系统
 */

/* 基础滑动条 */
.nve-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: var(--nve-surface-3);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

/* 滑动条轨道 */
.nve-slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 3px;
  background: var(--nve-surface-3);
}

.nve-slider::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: var(--nve-surface-3);
  border: none;
}

/* 滑块 */
.nve-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--nve-primary-500);
  cursor: pointer;
  border: 3px solid var(--nve-neutral-0);
  box-shadow: 0 1px 4px var(--nve-bg-overlay);
  margin-top: -6px;
  transition: transform 150ms, box-shadow 150ms;
}

.nve-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 0 0 4px var(--nve-primary-100);
}

.nve-slider::-webkit-slider-thumb:active {
  transform: scale(0.95);
  box-shadow: 0 0 0 6px var(--nve-primary-200);
}

.nve-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--nve-primary-500);
  cursor: pointer;
  border: 3px solid var(--nve-neutral-0);
  box-shadow: 0 1px 4px var(--nve-bg-overlay);
  transition: transform 150ms, box-shadow 150ms;
}

.nve-slider::-moz-range-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 0 0 4px var(--nve-primary-100);
}

/* 填充部分（仅 Firefox 支持） */
.nve-slider::-moz-range-progress {
  background: var(--nve-primary-500);
  height: 6px;
  border-radius: 3px;
}

/* 滑动条标签 */
.nve-slider-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--nve-text-tertiary);
  margin-top: 4px;
}

/* 不同语义颜色的滑动条变体 */
.nve-slider-success::-webkit-slider-thumb { background: var(--nve-success-500); }
.nve-slider-success::-webkit-slider-thumb:hover { box-shadow: 0 0 0 4px var(--nve-success-100); }
.nve-slider-success::-moz-range-thumb { background: var(--nve-success-500); }

.nve-slider-warning::-webkit-slider-thumb { background: var(--nve-warning-500); }
.nve-slider-warning::-webkit-slider-thumb:hover { box-shadow: 0 0 0 4px var(--nve-warning-100); }
.nve-slider-warning::-moz-range-thumb { background: var(--nve-warning-500); }

.nve-slider-error::-webkit-slider-thumb { background: var(--nve-error-500); }
.nve-slider-error::-webkit-slider-thumb:hover { box-shadow: 0 0 0 4px var(--nve-error-100); }
.nve-slider-error::-moz-range-thumb { background: var(--nve-error-500); }
```

### 6.7 MOU 状态指示器

```typescript
/**
 * MOU (Multi-Operator Unit) 状态指示器
 * 四种角色的动态色彩系统
 */

type MOURole = 'possibility' | 'oracle' | 'censor' | 'flow';
type MOUStatus = 'idle' | 'active' | 'warning' | 'critical' | 'glow';

interface MOUStateConfig {
  role: MOURole;
  status: MOUStatus;
  label: string;
  description?: string;
}

/**
 * 获取 MOU 状态颜色
 */
function getMOUStateColor(role: MOURole, status: MOUStatus): string {
  const cssVar = `--nve-mou-${role}-${status}`;
  return `var(${cssVar})`;
}

/**
 * MOU 状态指示器组件 CSS
 */
```

```css
/**
 * MOU 状态指示器样式
 */

.mou-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  transition: all 200ms ease;
  cursor: default;
  user-select: none;
}

/* 状态点 */
.mou-indicator__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: all 200ms ease;
}

/* 状态文字 */
.mou-indicator__label {
  color: currentColor;
}

/* ===== Possibility (可能性) ===== */
.mou-indicator--possibility-idle {
  background: var(--nve-mou-possibility-idle);
  color: var(--nve-text-primary);
}
.mou-indicator--possibility-idle .mou-indicator__dot {
  background: var(--nve-text-tertiary);
}

.mou-indicator--possibility-active {
  background: var(--nve-mou-possibility-active);
  color: var(--nve-neutral-0);
}
.mou-indicator--possibility-active .mou-indicator__dot {
  background: var(--nve-neutral-0);
  box-shadow: 0 0 6px var(--nve-neutral-0);
}

.mou-indicator--possibility-warning {
  background: var(--nve-mou-possibility-warning);
  color: var(--nve-neutral-0);
}
.mou-indicator--possibility-warning .mou-indicator__dot {
  background: var(--nve-neutral-0);
  animation: mou-pulse 1.5s infinite;
}

.mou-indicator--possibility-glow {
  background: var(--nve-mou-possibility-glow);
  color: var(--nve-neutral-0);
  box-shadow: 0 0 20px var(--nve-mou-possibility-glow);
}
.mou-indicator--possibility-glow .mou-indicator__dot {
  background: var(--nve-neutral-0);
  box-shadow: 0 0 8px var(--nve-neutral-0), 0 0 16px var(--nve-mou-possibility-glow);
  animation: mou-glow 2s infinite alternate;
}

/* ===== Oracle (神谕) ===== */
.mou-indicator--oracle-idle {
  background: var(--nve-mou-oracle-idle);
  color: var(--nve-text-primary);
}
.mou-indicator--oracle-idle .mou-indicator__dot {
  background: var(--nve-text-tertiary);
}

.mou-indicator--oracle-active {
  background: var(--nve-mou-oracle-active);
  color: var(--nve-neutral-0);
}
.mou-indicator--oracle-active .mou-indicator__dot {
  background: var(--nve-neutral-0);
  box-shadow: 0 0 6px var(--nve-neutral-0);
}

.mou-indicator--oracle-warning {
  background: var(--nve-mou-oracle-warning);
  color: var(--nve-neutral-0);
}
.mou-indicator--oracle-warning .mou-indicator__dot {
  background: var(--nve-neutral-0);
  animation: mou-pulse 1.5s infinite;
}

.mou-indicator--oracle-glow {
  background: var(--nve-mou-oracle-glow);
  color: var(--nve-neutral-950);
  box-shadow: 0 0 20px var(--nve-mou-oracle-glow);
}

/* ===== Censor (谏官) ===== */
.mou-indicator--censor-idle {
  background: var(--nve-mou-censor-idle);
  color: var(--nve-text-primary);
}

.mou-indicator--censor-active {
  background: var(--nve-mou-censor-active);
  color: var(--nve-neutral-0);
}

.mou-indicator--censor-warning {
  background: var(--nve-mou-censor-warning);
  color: var(--nve-neutral-0);
}

.mou-indicator--censor-glow {
  background: var(--nve-mou-censor-glow);
  color: var(--nve-neutral-0);
  box-shadow: 0 0 20px var(--nve-mou-censor-glow);
}

/* ===== Flow Guardian ===== */
.mou-indicator--flow-idle {
  background: var(--nve-mou-flow-idle);
  color: var(--nve-text-primary);
}

.mou-indicator--flow-active {
  background: var(--nve-mou-flow-active);
  color: var(--nve-neutral-0);
}

.mou-indicator--flow-warning {
  background: var(--nve-mou-flow-warning);
  color: var(--nve-neutral-0);
}

.mou-indicator--flow-glow {
  background: var(--nve-mou-flow-glow);
  color: var(--nve-neutral-950);
  box-shadow: 0 0 20px var(--nve-mou-flow-glow);
}

/* ===== 动画 ===== */
@keyframes mou-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

@keyframes mou-glow {
  0% { box-shadow: 0 0 8px currentColor, 0 0 16px currentColor; }
  100% { box-shadow: 0 0 12px currentColor, 0 0 24px currentColor, 0 0 36px currentColor; }
}

/* ===== MOU 状态面板 ===== */
.mou-panel {
  background: var(--nve-bg-elevated);
  border: 1px solid var(--nve-border-default);
  border-radius: 12px;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.mou-panel__role {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mou-panel__role-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--nve-text-tertiary);
}

/* ===== MOU 状态连线（关系图） ===== */
.mou-connection {
  stroke: var(--nve-border-default);
  stroke-width: 2;
  transition: stroke 300ms;
}

.mou-connection--active {
  stroke: var(--nve-primary-500);
  stroke-dasharray: 6 4;
  animation: mou-dash-flow 1s linear infinite;
}

@keyframes mou-dash-flow {
  to { stroke-dashoffset: -10; }
}
```

### 6.8 特殊元素适配总结表

| 元素类型 | 适配方式 | 动态更新机制 | 主题变量使用 |
|----------|----------|-------------|-------------|
| **代码块** | CSS Prism 高亮类 | 监听 data-mode 属性 | 语义色映射到语法标记 |
| **Chart.js** | 配置对象动态生成 | 监听 nve:theme-change | 从 CSS 变量读取系列色 |
| **ECharts** | registerTheme API | 监听 nve:theme-change | 完整主题对象注入 |
| **Leaflet 地图** | CSS filter + 控件样式 | 监听 data-mode 属性 | filter: brightness() 暗色调整 |
| **Markdown** | 完整 CSS 选择器链 | 自动继承 CSS 变量 | 全面使用 var() |
| **CodeMirror** | EditorView.theme() | EditorView.reconfigure | 动态生成 theme extension |
| **滑动条** | -webkit-slider 伪元素 | 自动继承 CSS 变量 | thumb 颜色使用主色 |
| **MOU 指示器** | BEM 命名 + 状态类 | CSS transition | 每种状态映射到专属变量 |

---

## 7. 无障碍支持

### 7.1 WCAG 2.1 对比度标准

```typescript
/**
 * 对比度检查工具
 * 符合 WCAG 2.1 Level AA 和 Level AAA 标准
 */

enum ConformanceLevel {
  NONE = 'none',       // 不满足
  AA = 'AA',           // 最小对比度 4.5:1 (正文) / 3:1 (大号文字)
  AAA = 'AAA',         // 增强对比度 7:1 (正文) / 4.5:1 (大号文字)
}

interface ContrastCheckResult {
  ratio: number;
  normalText: ConformanceLevel;
  largeText: ConformanceLevel;
  uiComponents: ConformanceLevel;  // 3:1 对于 UI 组件和图形
}

class ContrastChecker {
  /**
   * 计算两个颜色的对比度比率
   */
  static calculateRatio(foreground: string, background: string): number {
    const lum1 = this.getRelativeLuminance(foreground);
    const lum2 = this.getRelativeLuminance(background);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * 检查对比度是否符合标准
   */
  static check(foreground: string, background: string): ContrastCheckResult {
    const ratio = this.calculateRatio(foreground, background);
    
    return {
      ratio,
      normalText: ratio >= 7 ? ConformanceLevel.AAA : ratio >= 4.5 ? ConformanceLevel.AA : ConformanceLevel.NONE,
      largeText: ratio >= 4.5 ? ConformanceLevel.AAA : ratio >= 3 ? ConformanceLevel.AA : ConformanceLevel.NONE,
      uiComponents: ratio >= 3 ? ConformanceLevel.AA : ConformanceLevel.NONE,
    };
  }

  /**
   * 批量检查主题对比度
   */
  static checkTheme(theme: ThemeConfig): { pass: boolean; issues: string[] } {
    const issues: string[] = [];
    const modes: ThemeMode[] = ['light', 'dark'];

    for (const mode of modes) {
      const vars = mode === 'light' ? theme.light : theme.dark;
      
      // 检查主要文字对比度
      const textBgChecks = [
        { fg: vars.text.primary, bg: vars.background.default, label: '主文字/背景' },
        { fg: vars.text.secondary, bg: vars.background.default, label: '辅助文字/背景' },
        { fg: vars.text.primary, bg: vars.surface[1], label: '主文字/表面1' },
        { fg: vars.text.primary, bg: vars.background.elevated, label: '主文字/提升背景' },
        { fg: vars.text.link, bg: vars.background.default, label: '链接/背景' },
      ];

      for (const check of textBgChecks) {
        const result = this.check(check.fg, check.bg);
        if (result.normalText === ConformanceLevel.NONE) {
          issues.push(`[${mode}] ${check.label}: 对比度 ${result.ratio.toFixed(2)}:1 低于 AA (4.5:1)`);
        } else if (result.normalText === ConformanceLevel.AA) {
          // 可选：AAA 未达到的提示
          // issues.push(`[${mode}] ${check.label}: 对比度 ${result.ratio.toFixed(2)}:1 未达 AAA (7:1)`);
        }
      }

      // 检查主色按钮对比度
      const buttonCheck = this.check(vars.neutral[0] || '#FFFFFF', vars.primary[500]);
      if (buttonCheck.normalText === ConformanceLevel.NONE) {
        issues.push(`[${mode}] 主按钮文字/背景: 对比度 ${buttonCheck.ratio.toFixed(2)}:1 低于 AA`);
      }

      // 检查语义色对比度
      const semanticChecks = [
        { color: vars.success[500], label: '成功色' },
        { color: vars.warning[500], label: '警告色' },
        { color: vars.error[500], label: '错误色' },
        { color: vars.info[500], label: '信息色' },
      ];

      for (const check of semanticChecks) {
        const textColor = mode === 'light' ? '#FFFFFF' : '#000000';
        const result = this.check(textColor, check.color);
        if (result.normalText === ConformanceLevel.NONE) {
          issues.push(`[${mode}] ${check.label} 按钮: 对比度 ${result.ratio.toFixed(2)}:1 低于 AA`);
        }
      }

      // 检查边框对比度（UI组件）
      const borderResult = this.check(vars.border.default, vars.background.default);
      if (borderResult.uiComponents === ConformanceLevel.NONE) {
        issues.push(`[${mode}] 边框/背景: 对比度 ${borderResult.ratio.toFixed(2)}:1 低于 3:1 (UI组件)`);
      }
    }

    return {
      pass: issues.filter(i => i.includes('低于')).length === 0,
      issues,
    };
  }

  private static getRelativeLuminance(color: string): number {
    // 处理 hex 颜色
    let rgb: number[];
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      rgb = [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    } else if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      rgb = match ? match.map(Number) : [0, 0, 0];
    } else {
      rgb = [0, 0, 0];
    }

    const [r, g, b] = rgb.map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
}
```

### 7.2 色盲友好模式

```css
/**
 * 色盲友好模式
 * 高对比度、不依赖色彩来传达信息
 */

[data-accessibility="colorblind-safe"] {
  /* 增加整体对比度 */
  --nve-text-primary: #000000;
  --nve-text-secondary: #333333;
  --nve-bg-default: #FFFFFF;
  --nve-bg-elevated: #FFFFFF;
  --nve-border-default: rgba(0, 0, 0, 0.3);
  --nve-border-active: rgba(0, 0, 0, 0.6);

  /* 使用形状/图案替代纯色彩区分 */
  .status-dot--success {
    background: var(--nve-success-500);
    border-radius: 50%; /* 圆形 = 成功 */
  }
  
  .status-dot--warning {
    background: var(--nve-warning-500);
    border-radius: 2px; /* 方形 = 警告 */
  }
  
  .status-dot--error {
    background: var(--nve-error-500);
    clip-path: polygon(50% 0%, 0% 100%, 100% 100%); /* 三角形 = 错误 */
  }

  .status-dot--info {
    background: var(--nve-info-500);
    border-radius: 50%;
    border: 2px dashed; /* 虚线边框 = 信息 */
  }

  /* 图标辅助 */
  .semantic-icon::before {
    content: '';
    display: inline-block;
    width: 16px;
    height: 16px;
    margin-right: 4px;
    vertical-align: middle;
  }

  .semantic-icon--success::before {
    content: '✓';
    color: var(--nve-success-500);
    font-weight: bold;
  }

  .semantic-icon--warning::before {
    content: '!';
    color: var(--nve-warning-500);
    font-weight: bold;
  }

  .semantic-icon--error::before {
    content: '✕';
    color: var(--nve-error-500);
    font-weight: bold;
  }
}

[data-mode="dark"][data-accessibility="colorblind-safe"] {
  --nve-text-primary: #FFFFFF;
  --nve-text-secondary: #CCCCCC;
  --nve-bg-default: #000000;
  --nve-bg-elevated: #111111;
  --nve-border-default: rgba(255, 255, 255, 0.3);
  --nve-border-active: rgba(255, 255, 255, 0.6);
}
```

### 7.3 用户自定义对比度

```typescript
/**
 * 用户自定义对比度调节
 */

class ContrastAdjuster {
  private static readonly STORAGE_KEY = 'nve:accessibility:contrast';
  
  /**
   * 获取当前对比度增强级别 (0-100)
   */
  static getContrastLevel(): number {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * 设置对比度增强级别
   */
  static setContrastLevel(level: number): void {
    level = Math.max(0, Math.min(100, level));
    try {
      localStorage.setItem(this.STORAGE_KEY, level.toString());
    } catch { /* 忽略 */ }
    
    this.applyContrastAdjustment(level);
  }

  /**
   * 应用对比度调整
   */
  private static applyContrastAdjustment(level: number): void {
    const root = document.documentElement;
    
    if (level === 0) {
      root.style.removeProperty('--nve-accessibility-contrast-filter');
      return;
    }
    
    // 使用 CSS filter 增加对比度
    const contrast = 1 + level * 0.01;
    root.style.setProperty('--nve-accessibility-contrast-filter', `contrast(${contrast})`);
    
    // 同时调整文字对比度
    const textDarkening = level * 0.002;
    root.style.setProperty('--nve-accessibility-text-boost', textDarkening.toString());
  }
}
```

### 7.4 动画减弱模式

```css
/**
 * prefers-reduced-motion 支持
 * 尊重用户的动画偏好设置
 */

/* 默认：所有动画 */
.nve-animated {
  transition: all 300ms ease;
}

.nve-fade-in {
  animation: nve-fade-in 300ms ease;
}

.nve-slide-up {
  animation: nve-slide-up 300ms ease;
}

/* 动画减弱模式 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .nve-animated {
    transition: none;
  }

  .nve-fade-in,
  .nve-slide-up {
    animation: none;
  }

  /* 渐变背景也禁用 */
  .nve-gradient-bg {
    background: var(--nve-bg-default) !important;
  }
}

/* 用户手动设置减弱动画 */
[data-reduced-motion="true"] {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 7.5 无障碍功能清单

| 功能 | 状态 | 实现方式 |
|------|------|----------|
| WCAG 2.1 AA 对比度 | 已实现 | 每套主题对比度预检，自动提示 |
| WCAG 2.1 AAA 对比度 | 可选 | 高对比度模式 |
| 色盲友好模式 | 已实现 | data-accessibility 属性 + 形状辅助 |
| 高对比度模式 | 已实现 | 对比度滑动条 0-100% |
| 动画减弱 | 已实现 | prefers-reduced-motion + 手动开关 |
| 键盘导航 | 系统级 | Tab 焦点环使用 --nve-border-focus |
| 屏幕阅读器 | 系统级 |语义化 HTML + ARIA 标签 |
| 焦点可见 | 已实现 | 所有交互元素有明确焦点指示 |
| 色盲模拟预览 | 已实现 | 在主题预览中加入色盲模拟滤镜 |


---

## 8. 性能优化与实现建议

### 8.1 性能目标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 主题切换延迟 | < 50ms | 从点击到 CSS 变量注入完成 |
| 亮暗模式过渡 | 300ms CSS transition | 视觉感知时间 |
| 图片色彩提取 | < 200ms (800x800 图片) | Web Worker 处理时间 |
| 首屏主题加载 | < 16ms (1 帧) | 内联脚本同步执行 |
| CSS 变量总数 | ~260 个/主题 | 内存占用评估 |
| 内存占用 | < 2MB (全部内置主题) | 主题注册表总大小 |

### 8.2 关键优化策略

```typescript
/**
 * 主题系统性能优化
 */

class ThemePerformance {
  /**
   * 1. 样式注入优化：使用 CSSStyleSheet API (CSSOM)
   * 比 innerHTML/ textContent 快 2-3 倍
   */
  static injectViaCSSOM(cssText: string, styleId: string): void {
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    // 使用 replaceSync 避免重排
    if (styleEl.sheet) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(cssText);
      // 注意：实际使用需要 adoptStylesheet API 支持
      styleEl.textContent = cssText; // 回退
    } else {
      styleEl.textContent = cssText;
    }
  }

  /**
   * 2. 批量 DOM 更新：避免逐变量设置
   */
  static batchUpdateVariables(variables: Record<string, string>): void {
    const root = document.documentElement;
    
    // 使用 requestAnimationFrame 批量更新
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        for (const [key, value] of Object.entries(variables)) {
          root.style.setProperty(key, value);
        }
      });
    });
  }

  /**
   * 3. 主题变量懒加载：非激活主题不注入 CSS
   */
  static lazyLoadTheme(themeId: string): Promise<ThemeConfig> {
    // 动态导入主题定义
    return import(`./themes/${themeId}.ts`).then(m => m.default);
  }

  /**
   * 4. 图片处理优化：Canvas 缩放 + Web Worker
   */
  static async optimizeImageForExtraction(file: File): Promise<ImageBitmap> {
    const MAX_SIZE = 800;
    
    // 使用 createImageBitmap 进行硬件加速解码
    const bitmap = await createImageBitmap(file);
    
    // 计算缩放比例
    const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));
    
    if (scale >= 1) return bitmap;
    
    // 使用 Canvas 缩放
    const canvas = new OffscreenCanvas(
      bitmap.width * scale,
      bitmap.height * scale
    );
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    
    // 释放原始 bitmap
    bitmap.close();
    
    return createImageBitmap(canvas);
  }

  /**
   * 5. 缓存策略：LRU 缓存提取结果
   */
  private static extractionCache = new Map<string, ExtractedColor[]>();
  private static cacheKeys: string[] = [];
  private static readonly MAX_CACHE_SIZE = 20;

  static getCachedExtraction(imageHash: string): ExtractedColor[] | undefined {
    return this.extractionCache.get(imageHash);
  }

  static cacheExtraction(imageHash: string, colors: ExtractedColor[]): void {
    if (this.extractionCache.has(imageHash)) {
      // 移到最近使用
      this.cacheKeys = this.cacheKeys.filter(k => k !== imageHash);
    }
    
    this.extractionCache.set(imageHash, colors);
    this.cacheKeys.push(imageHash);
    
    // LRU 淘汰
    while (this.cacheKeys.length > this.MAX_CACHE_SIZE) {
      const oldest = this.cacheKeys.shift();
      if (oldest) this.extractionCache.delete(oldest);
    }
  }

  /**
   * 6. 防抖：快速连续切换时只应用最后一次
   */
  static debounceThemeSwitch(fn: () => void, wait: number = 100): () => void {
    let timeout: ReturnType<typeof setTimeout>;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(fn, wait);
    };
  }

  /**
   * 7. 使用 requestIdleCallback 进行非紧急更新
   */
  static scheduleIdleWork(callback: () => void): void {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(callback, { timeout: 2000 });
    } else {
      setTimeout(callback, 1);
    }
  }
}
```

### 8.3 实施建议

#### 8.3.1 文件组织结构

```
src/
├── themes/
│   ├── index.ts              # 主题导出
│   ├── types.ts              # 主题类型定义
│   ├── xuanhuan.ts           # 玄幻修真主题
│   ├── romance.ts            # 浪漫言情主题
│   ├── mystery.ts            # 悬疑推理主题
│   ├── scifi.ts              # 科幻未来主题
│   ├── historical.ts         # 历史架空主题
│   ├── urban.ts              # 都市异能主题
│   ├── horror.ts             # 恐怖惊悚主题
│   ├── esports.ts            # 游戏竞技主题
│   └── factory.ts            # 主题工厂（从图片生成）
│
├── theme-engine/
│   ├── ThemeManager.ts       # 主题管理器
│   ├── ModeManager.ts        # 亮暗模式管理器
│   ├── CSSInjector.ts        # CSS 变量注入器
│   ├── ThemeValidator.ts     # 主题验证器
│   ├── ThemeRegistry.ts      # 主题注册表
│   └── cache/
│       └── LRUCache.ts       # LRU 缓存实现
│
├── color-engine/
│   ├── MedianCutExtractor.ts    # 中位切分法
│   ├── KMeansCluster.ts         # K-Means 聚类
│   ├── ColorQuantizer.ts        # 色彩量化
│   ├── ColorHarmonyEngine.ts    # 和谐度评估
│   ├── PaletteGenerator.ts      # 色板生成器
│   ├── ContrastChecker.ts       # 对比度检查
│   └── workers/
│       └── colorExtractor.worker.ts  # Web Worker
│
├── components/
│   ├── ThemeSelector.tsx        # 主题选择器 UI
│   ├── ThemePreview.tsx         # 主题预览组件
│   ├── ImageUploader.tsx        # 图片上传组件
│   ├── ColorExtractor.tsx       # 色彩提取面板
│   ├── PaletteFineTuner.tsx     # 色板微调面板
│   ├── ModeToggle.tsx           # 亮暗模式切换
│   ├── MOUIndicator.tsx         # MOU 状态指示器
│   └── accessibility/
│       ├── ContrastChecker.tsx  # 对比度检查器
│       └── HighContrastToggle.tsx
│
├── hooks/
│   ├── useTheme.ts             # 主题 Hook
│   ├── useThemeMode.ts         # 模式 Hook
│   ├── useThemePreview.ts      # 预览 Hook
│   ├── useColorExtraction.ts   # 色彩提取 Hook
│   ├── useChartTheme.ts        # 图表主题 Hook
│   └── useAccessibility.ts     # 无障碍 Hook
│
└── styles/
    ├── globals.css             # 全局样式（含过渡动画）
    ├── markdown.css            # Markdown 主题
    ├── code-block.css          # 代码块主题
    ├── mou-indicator.css       # MOU 指示器样式
    ├── map-theme.css           # 地图主题
    ├── slider.css              # 滑动条样式
    └── accessibility.css       # 无障碍样式
```

#### 8.3.2 依赖关系

```typescript
/**
 * 模块依赖图（简化）
 * 
 * ThemeManager
 *   ├── ThemeRegistry (built-in + user)
 *   ├── CSSInjector
 *   ├── ModeManager
 *   │   └── SystemPreferenceDetector
 *   └── ThemeValidator
 *       └── ContrastChecker
 * 
 * ColorExtractionEngine
 *   ├── MedianCutExtractor
 *   ├── KMeansColorCluster
 *   ├── ColorQuantizer
 *   ├── ColorHarmonyEngine
 *   └── PaletteGenerator
 *       └── ContrastChecker
 * 
 * UI Components
 *   ├── ThemeSelector -> ThemeManager
 *   ├── ColorExtractor -> ColorExtractionEngine
 *   └── ModeToggle -> ModeManager
 */
```

#### 8.3.3 推荐实现顺序

| 阶段 | 内容 | 预计工期 |
|------|------|----------|
| **Phase 1** | 基础架构：类型定义、CSS 变量体系、Tailwind 配置 | 3 天 |
| **Phase 2** | 8 套内置主题色板实现 | 5 天 |
| **Phase 3** | ThemeManager 核心：注册、加载、切换、注入 | 4 天 |
| **Phase 4** | 亮暗模式系统：ModeManager、过渡动画 | 3 天 |
| **Phase 5** | 图片色彩提取：Median Cut + K-Means + Web Worker | 5 天 |
| **Phase 6** | 色板生成与微调：PaletteGenerator + UI 面板 | 4 天 |
| **Phase 7** | 特殊元素适配：代码块、图表、地图、Markdown | 4 天 |
| **Phase 8** | 无障碍支持：对比度、色盲模式、动画减弱 | 3 天 |
| **Phase 9** | 性能优化：缓存、懒加载、防抖 | 2 天 |
| **Phase 10** | 测试与调优：端到端测试、视觉回归 | 5 天 |
| **总计** | | **~38 天** |

### 8.4 常见问题处理

```typescript
/**
 * 主题系统常见问题与解决方案
 */

class ThemeTroubleshooting {
  /**
   * 问题 1: 主题切换时闪烁 (Flash of Unstyled Content)
   * 解决: 在 <head> 中内联主题脚本，确保首屏渲染前 CSS 变量已设置
   */
  static preventFlash(): string {
    return `
      <script>
        (function() {
          try {
            var theme = localStorage.getItem('nve:theme:active') || 'xuanhuan';
            var mode = localStorage.getItem('nve:theme:mode') || 'system';
            var effective = mode === 'system' 
              ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
              : mode;
            document.documentElement.setAttribute('data-theme', theme);
            document.documentElement.setAttribute('data-mode', effective);
            if (effective === 'dark') document.documentElement.classList.add('dark');
          } catch(e) {}
        })();
      </script>
    `;
  }

  /**
   * 问题 2: iframe 中的主题同步
   * 解决: 通过 postMessage 同步主题状态
   */
  static syncIframeTheme(iframe: HTMLIFrameElement, theme: string, mode: string): void {
    iframe.addEventListener('load', () => {
      iframe.contentWindow?.postMessage({
        type: 'nve:theme-sync',
        theme,
        mode,
      }, '*');
    });
  }

  /**
   * 问题 3: 打印模式下隐藏主题装饰
   */
  static printStyles(): string {
    return `
      @media print {
        .nve-gradient-hero,
        .nve-gradient-ambient,
        .nve-shadow-glow {
          display: none !important;
        }
        .nve-markdown {
          background: white !important;
          color: black !important;
        }
      }
    `;
  }

  /**
   * 问题 4: 第三方组件库的主题适配
   */
  static adaptThirdPartyComponent(rootSelector: string): void {
    // 遍历第三方组件的根元素，将 CSS 变量传播到 shadow DOM
    const roots = document.querySelectorAll(rootSelector);
    roots.forEach(root => {
      const computed = getComputedStyle(document.documentElement);
      (root as HTMLElement).style.setProperty(
        '--theme-primary',
        computed.getPropertyValue('--nve-primary-500')
      );
    });
  }
}
```

---

## 9. 附录

### 9.1 主题系统事件参考

| 事件名 | 类型 | 触发时机 | 参数 |
|--------|------|----------|------|
| `nve:theme-change` | CustomEvent | 主题切换完成 | `{ theme: ThemeConfig, mode: ThemeMode }` |
| `nve:theme-preview` | CustomEvent | 预览主题 | `{ theme: ThemeConfig, mode: ThemeMode }` |
| `nve:theme-preview-end` | CustomEvent | 结束预览 | `{}` |
| `nve:theme-mode-change` | CustomEvent | 亮暗模式切换 | `{ mode: ThemeMode, effectiveMode: 'light' \| 'dark' }` |
| `nve:theme-registered` | CustomEvent | 新主题注册 | `{ theme: ThemeConfig }` |
| `nve:theme-initialized` | CustomEvent | 主题引擎初始化完成 | `{}` |
| `nve:color-extracted` | CustomEvent | 色彩提取完成 | `{ colors: ExtractedColor[], source: string }` |
| `nve:contrast-warning` | CustomEvent | 对比度不达标 | `{ element: string, ratio: number }` |

### 9.2 CSS 变量完整清单

```
--nve-primary-{50-950}           (11 个)
--nve-secondary-{50-950}         (11 个)
--nve-accent-{50-950}            (11 个)
--nve-neutral-{0,50-950}         (12 个)
--nve-success-{50-900}           (10 个)
--nve-warning-{50-900}           (10 个)
--nve-error-{50-900}             (10 个)
--nve-info-{50-900}              (10 个)
--nve-mou-{role}-{status}        (16 个)
--nve-bg-{default,paper,elevated,overlay} (4 个)
--nve-surface-{1-4}              (4 个)
--nve-text-{primary,secondary,tertiary,disabled,inverse,link} (6 个)
--nve-border-{default,hover,active,focus,error} (5 个)
--nve-gradient-{hero,card,button,ambient} (4 个)
--nve-shadow-{sm,md,lg,xl,glow}  (5 个)
-------------------------------------------
亮色模式总计: ~129 个变量
暗色模式总计: ~129 个变量
两套合计:     ~258 个变量
```

### 9.3 类型小说色彩文化参考

| 小说类型 | 核心色彩意象 | 文化根源 |
|----------|-------------|----------|
| **玄幻修真** | 天青/紫金/丹火 | 东方仙侠美学，道教五行色彩 |
| **浪漫言情** | 玫瑰粉/薰衣草/暖珊瑚 | 法式花园，马卡龙色调，樱花 |
| **悬疑推理** | 石墨灰/琥珀/血红 | Film Noir，伦敦雾都，档案室 |
| **科幻未来** | 电光蓝/霓虹青/警告橙 | 赛博朋克，太空探索，全息投影 |
| **历史架空** | 朱砂红/石青/金色 | 中国传统矿物颜料，宫殿建筑 |
| **都市异能** | 霓虹紫/霓虹青/霓虹粉 | 城市夜景，赛博朋克城市 |
| **恐怖惊悚** | 腐骨白/暗血红/鬼火绿 | 废弃建筑，凝固血液，磷火 |
| **游戏竞技** | 能量橙/胜利金/击杀红 | 电竞 RGB，冠军奖杯，击杀提示 |

### 9.4 工具函数参考

```typescript
/**
 * 色彩工具函数集合
 */

// ===== 颜色空间转换 =====
hexToRgb(hex: string): [number, number, number]
hexToHsl(hex: string): [number, number, number]
hexToLab(hex: string): [number, number, number]
rgbToHex(r: number, g: number, b: number): string
rgbToHsl(r: number, g: number, b: number): [number, number, number]
rgbToLab(r: number, g: number, b: number): [number, number, number]
hslToHex(h: number, s: number, l: number): string
hslToRgb(h: number, s: number, l: number): [number, number, number]
labToRgb(l: number, a: number, b: number): [number, number, number]
labToHex(l: number, a: number, b: number): string

// ===== 色彩分析 =====
getRelativeLuminance(color: string): number
calculateContrastRatio(color1: string, color2: string): number
getColorTemperature(color: string): 'warm' | 'cool' | 'neutral'
getColorHarmony(colors: string[]): HarmonyType

// ===== 色板生成 =====
generateColorScale(baseColor: string, steps: number): string[]
generateLightScale(hsl: [number, number, number]): ColorScale
generateDarkScale(hsl: [number, number, number]): ColorScale
generateNeutralScale(mode: 'light' | 'dark'): ColorScale & { 0: string }
generateSemanticScale(hue: number, mode: 'light' | 'dark'): ColorScale
adjustSaturation(color: string, amount: number): string
adjustLightness(color: string, amount: number): string
shiftHue(color: string, degrees: number): string

// ===== 主题工具 =====
validateTheme(theme: unknown): ValidationResult
exportTheme(theme: ThemeConfig): ThemeExport
importTheme(data: ThemeExport): ThemeConfig
detectGenreFromColors(colors: ExtractedColor[]): NovelGenre
```

### 9.5 更新日志

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| **3.0.0** | 2025-01 | 初始版本：8种类型主题、图片提取引擎、亮暗模式系统 |
| 3.1.0 (计划) | 2025-Q2 | 主题市场、社区主题分享 |
| 3.2.0 (计划) | 2025-Q3 | AI 智能配色、色彩情感分析 |
| 3.3.0 (计划) | 2025-Q4 | 动态壁纸集成、环境光效 |

### 9.6 术语表

| 术语 | 定义 |
|------|------|
| **CSS Custom Properties** | CSS 变量，允许在运行时动态修改样式 |
| **WCAG** | Web Content Accessibility Guidelines，网页内容无障碍指南 |
| **Median Cut** | 中位切分法，一种色彩量化算法 |
| **K-Means** | K 均值聚类算法，用于色彩聚类 |
| **CIEDE2000** | 国际照明委员会推荐的色差公式 |
| **LAB 色彩空间** | 一种与人眼感知一致的设备无关色彩空间 |
| **HSL 色彩空间** | 色相-饱和度-明度色彩空间，直观易调 |
| **互补色** | 色相环上相对（180°）的颜色 |
| **类似色** | 色相环上相邻的颜色 |
| **三色组** | 色相环上等距（120°）的三种颜色 |
| **相对亮度** | WCAG 标准中用于计算对比度的亮度值 |
| **MOU** | Multi-Operator Unit，叙事引擎中的多角色协作单元 |

---

> **文档状态**: 已完成  
> **最后更新**: 2025年1月  
> **版本**: 3.0.0  
> **说明**: 本文档为 NarrativeOS v3.0 Sovereign 智能主题系统的完整设计规范，涵盖8种小说类型主题色板、图片色彩提取算法、亮暗模式系统、主题引擎架构及无障碍支持。所有 TypeScript 代码均为可直接实现的参考实现，CSS 变量命名遵循统一的 `--nve-{category}-{role}-{variant}` 规范。
