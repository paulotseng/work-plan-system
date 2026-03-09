# 工作计划管理系统 (Work Plan Management System)

> 版本: v2.3 | 最后更新: 2026-03-09

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [项目结构](#3-项目结构)
4. [开发环境配置](#4-开发环境配置)
5. [数据库架构](#5-数据库架构)
6. [编码规范](#6-编码规范)
7. [版本管理](#7-版本管理)
8. [部署指南](#8-部署指南)
9. [AI 协作规范](#9-ai-协作规范)
10. [功能清单](#10-功能清单)
11. [待办事项](#11-待办事项)

---

## 1. 项目概述

### 1.1 产品定位
企业级年度工作计划管理系统，用于团队任务规划、进度跟踪和协作管理。

### 1.2 目标用户
- 企业内部团队成员
- 管理员（可管理用户、系统参数等）

### 1.3 核心功能
- 工作计划的增删改查（CRUD）
- Excel 批量导入/导出
- 团队协作与权限管理
- 驾驶舱数据可视化
- 系统参数动态配置

---

## 2. 技术栈

### 2.1 前端 (Frontend)

| 技术 | 版本/说明 |
|------|----------|
| **框架** | Vue 3 (Composition API) |
| **加载方式** | CDN 直引，无构建工具 |
| **语言** | 原生 JavaScript (ES6+) |
| **样式** | 自定义 CSS (CSS Variables) |
| **字体** | Noto Sans SC (Google Fonts) |

```html
<!-- 核心依赖 CDN -->
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
```

### 2.2 后端/数据库 (Backend/Database)

| 技术 | 说明 |
|------|------|
| **BaaS 平台** | Supabase |
| **数据库** | PostgreSQL (Supabase 托管) |
| **认证** | Supabase Auth (邮箱+密码) |
| **权限控制** | Row Level Security (RLS) |
| **实时订阅** | Supabase Realtime (可选) |

### 2.3 部署方式

| 环境 | 方式 |
|------|------|
| **前端托管** | 静态文件托管 (可部署至 Vercel/Netlify/Cloudflare Pages) |
| **数据库** | Supabase Cloud (免费版或付费版) |
| **域名** | 可配置自定义域名 |

---

## 3. 项目结构

```
work-plan-system/
│
├── index.html          # 主入口文件 (HTML + Vue 模板)
├── app.js              # Vue 3 应用逻辑 (所有 JS 代码)
├── style.css           # 全局样式表
├── README.md           # 本文档
│
├── templates/          # (可选) Excel 导入模板
│   └── 工作计划导入模板.xlsx
│
└── docs/               # (可选) 文档目录
    └── api-docs.md
```

### 3.1 文件职责

| 文件 | 职责 | 行数参考 |
|------|------|---------|
| `index.html` | 页面结构、Vue 模板、组件布局 | ~1200 行 |
| `app.js` | 业务逻辑、数据管理、API 调用 | ~1500 行 |
| `style.css` | UI 样式、响应式布局、主题变量 | ~1900 行 |

---

## 4. 开发环境配置

### 4.1 Supabase 项目配置

1. 创建 Supabase 项目: https://supabase.com
2. 获取项目 URL 和 anon key
3. 在 `app.js` 中配置:

```javascript
const supabaseUrl = 'https://your-project-id.supabase.co';
const supabaseKey = 'your-anon-key';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
```

### 4.2 本地开发

```bash
# 方式1: 使用 VS Code Live Server 插件
# 右键 index.html -> Open with Live Server

# 方式2: 使用 Python 简易服务器
python -m http.server 8080

# 方式3: 使用 Node.js
npx serve .
```

### 4.3 环境变量 (推荐生产环境使用)

```env
# .env (需要构建工具支持)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 5. 数据库架构

### 5.1 核心表结构

#### `profiles` - 用户档案表
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    name TEXT,
    department TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `plans` - 工作计划表
```sql
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    category TEXT,           -- 职能分类
    sub_category TEXT,       -- 职能细分
    main_project TEXT,       -- 主项目名称
    sub_project TEXT,        -- 子项目名称
    description TEXT,        -- 任务描述
    scope TEXT[],            -- 覆盖范围 (数组)
    stage TEXT,              -- 任务阶段
    start_date DATE,         -- 开始日期
    end_date DATE,           -- 结束日期
    owner TEXT,              -- 负责人
    collaborators TEXT,      -- 协同人
    progress INTEGER DEFAULT 0,  -- 当前进度 (0-100)
    notes TEXT,              -- 备注
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `system_params` - 系统参数表 (v2.2+)
```sql
CREATE TABLE system_params (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,  -- 参数类别
    param_key TEXT NOT NULL, -- 参数键
    param_value TEXT,        -- 参数值
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `comments` - 评论/提醒表
```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES plans(id),
    user_id UUID REFERENCES profiles(id),
    type TEXT,               -- 'comment' | 'reminder'
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.2 RLS 策略示例

```sql
-- 用户只能查看和编辑自己的计划
CREATE POLICY "Users can view own plans" ON plans
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own plans" ON plans
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own plans" ON plans
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own plans" ON plans
    FOR DELETE USING (user_id = auth.uid());
```

---

## 6. 编码规范

### 6.1 JavaScript 规范

```javascript
// ✅ 推荐: Vue 3 Composition API
const { createApp, ref, computed, watch, onMounted } = Vue;

const app = createApp({
    setup() {
        // 响应式数据
        const plans = ref([]);
        const loading = ref(true);

        // 计算属性
        const filteredPlans = computed(() => {
            return plans.value.filter(p => p.progress < 100);
        });

        // 方法
        async function fetchData() {
            const { data, error } = await supabase.from('plans').select('*');
            if (!error) plans.value = data;
        }

        // 生命周期
        onMounted(() => {
            fetchData();
        });

        return { plans, loading, filteredPlans, fetchData };
    }
});

// ❌ 避免: Options API (本项目不使用)
```

### 6.2 CSS 规范

```css
/* ✅ 使用 CSS Variables (已定义在 :root) */
.my-component {
    color: var(--rem-blue);
    background: var(--bg-card);
    border-radius: var(--radius);
}

/* ✅ 命名规范: BEM 或 语义化 */
.plans-table { }           /* 组件 */
.plans-table .header-row-1 { }  /* 子元素 */
.btn-primary { }           /* 按钮 */
.scope-cell { }            /* 单元格 */

/* ❌ 避免: 硬编码颜色值 */
.bad-example {
    color: #6183E6;  /* 应使用 var(--rem-blue) */
}
```

### 6.3 命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| 变量 | camelCase | `filterCategory`, `selectedPlanIds` |
| 函数 | camelCase + 动词 | `handleAuth`, `fetchPlans`, `deletePlan` |
| 常量 | UPPER_SNAKE_CASE | `MAX_ADMIN_COUNT` |
| CSS 类 | kebab-case | `.scope-cell`, `.btn-primary` |
| 数据库字段 | snake_case | `user_id`, `created_at` |

---

## 7. 版本管理

### 7.1 版本号规则

采用语义化版本: `MAJOR.MINOR.PATCH`

- **MAJOR**: 重大架构变更
- **MINOR**: 新功能添加
- **PATCH**: Bug 修复

### 7.2 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| v2.3 | 2026-03-09 | 批量删除、子分类筛选、字段宽度优化、中文日期解析 |
| v2.2 | 2026-03-08 | 系统参数从硬编码改为数据库存储 |
| v2.1 | 2026-03-07 | 左侧菜单布局重构 |
| v2.0 | 2026-03-06 | 引入 Supabase 后端 |
| v1.0 | 2026-03-01 | 初始版本 (纯前端) |

### 7.3 Git 提交规范

```bash
# 提交格式
<type>(<scope>): <subject>

# 类型
feat:     新功能
fix:      Bug 修复
style:    样式调整
refactor: 重构
docs:     文档更新
chore:    构建/配置

# 示例
feat(plans): 添加批量删除功能
fix(auth): 修复登录状态丢失问题
style(table): 优化字段宽度
```

---

## 8. 部署指南

### 8.1 Vercel 部署 (推荐)

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 部署
vercel --prod
```

### 8.2 Netlify 部署

1. 连接 Git 仓库
2. 构建命令: (留空)
3. 发布目录: `.` 或 `/`

### 8.3 静态文件部署

直接上传 `index.html`, `app.js`, `style.css` 到任意静态托管服务。

### 8.4 域名配置

在托管平台配置自定义域名，并确保:
- HTTPS 已启用
- CORS 配置正确 (Supabase 设置)

---

## 9. AI 协作规范

### 9.1 重要约定

> **请所有 AI 助手仔细阅读并遵守以下规范**

#### 9.1.1 用户称呼
- 用户被称为 **"老大"** (不是"昴君"或其他称呼)
- 此设置为永久生效，已在 memory 中记录

#### 9.1.2 代码风格
- 遵循现有代码风格，不要大幅重构
- 新增功能时保持与现有代码一致性
- 修改前先阅读并理解现有逻辑

#### 9.1.3 CSS 修改规范
- 优先使用已定义的 CSS Variables
- 不要删除现有样式，除非明确要求
- 新增样式添加到文件末尾并注释说明

#### 9.1.4 数据库操作
- 所有数据库操作使用 Supabase Client
- 遵循 RLS 策略，不要绕过权限检查
- 新增表时同步创建 RLS 策略

#### 9.1.5 版本更新
- 重大更新时更新 README 版本号
- 在 `app.js` 顶部注释中记录版本变更

### 9.2 禁止事项

```markdown
❌ 不要做的事情:
- 不要在未经确认的情况下删除功能
- 不要引入新的构建工具 (Vite/Webpack 等)
- 不要更改现有 API 调用方式
- 不要修改 Supabase 配置 (除非明确要求)
- 不要创建 .env 文件 (当前项目无构建步骤)
- 不要在代码中硬编码敏感信息
```

### 9.3 AI 接手检查清单

```markdown
开始工作前，请确认:
[ ] 已阅读本文档全部内容
[ ] 已阅读 index.html 了解页面结构
[ ] 已阅读 app.js 了解业务逻辑
[ ] 已阅读 style.css 了解样式规范
[ ] 理解 Vue 3 Composition API
[ ] 理解 Supabase 基本用法
[ ] 知道用户被称为"老大"
```

### 9.4 常见任务指南

#### 添加新字段
1. 在 Supabase 中添加数据库字段
2. 在 `index.html` 表格中添加列
3. 在 `app.js` 中添加表单字段
4. 在 `style.css` 中添加必要的样式

#### 添加新页面
1. 在 `index.html` 中添加 HTML 结构
2. 在左侧菜单添加导航项
3. 在 `app.js` 中添加 `currentView` 判断
4. 确保样式一致

#### 修复 Bug
1. 先阅读相关代码理解逻辑
2. 定位问题原因
3. 最小化修改范围
4. 测试不影响其他功能

---

## 10. 功能清单

### 10.1 已完成功能

- [x] 用户注册/登录 (Supabase Auth)
- [x] 邮箱验证提示
- [x] 工作计划 CRUD
- [x] Excel 批量导入
- [x] Excel 模板下载
- [x] 中文日期格式解析 (3月2日)
- [x] 批量删除功能 (v2.3)
- [x] 子分类筛选联动 (v2.3)
- [x] 表头冻结 (sticky)
- [x] 操作列冻结
- [x] 驾驶舱数据看板
- [x] 异常任务检测
- [x] 评论/提醒功能
- [x] 用户管理 (管理员)
- [x] 代理导入 (管理员)
- [x] 系统参数管理 (v2.2+)
- [x] 可见性设置
- [x] 管理员数量限制 (最多3个)
- [x] 密码修改

### 10.2 计划功能

- [ ] 数据导出 Excel
- [ ] 甘特图视图
- [ ] 移动端适配优化
- [ ] 消息通知推送
- [ ] 操作日志记录
- [ ] 数据备份/恢复

---

## 11. 待办事项

### 优先级高
- [ ] 添加数据导出功能
- [ ] 优化移动端体验

### 优先级中
- [ ] 添加甘特图视图
- [ ] 完善错误处理提示

### 优先级低
- [ ] 添加深色模式
- [ ] 多语言支持

---

## 附录

### A. Supabase Dashboard

- 项目地址: https://supabase.com/dashboard
- 表编辑器: Table Editor
- SQL 编辑器: SQL Editor
- 认证管理: Authentication

### B. 常见问题

**Q: 登录后数据不显示?**
A: 检查 RLS 策略是否正确配置

**Q: Excel 导入失败?**
A: 检查日期格式，支持 yyyy-MM-dd 和 M月d日

**Q: 管理员权限丢失?**
A: 直接在 Supabase 控制台修改 profiles 表的 role 字段

### C. 联系方式

- 项目维护: AI 协作开发
- 技术支持: 请在项目中提出 Issue

---

*本文档由蕾姆 (AI 助手) 编写维护*

*最后更新: 2026-03-09 | 版本: v2.3*
