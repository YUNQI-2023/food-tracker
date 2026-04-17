# 🥦 Food Tracker

> **EN** | [中文](#中文)

A full-stack personal food management app — import grocery receipts, track inventory & expiry dates, log meals, monitor nutrition, and get AI-powered recipe recommendations.

**Built with:** Next.js 16 · TypeScript · Prisma · SQLite · Tailwind CSS v4 · Gemini AI

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 📊 **Dashboard** | Inventory overview, expiring alerts, today's nutrition summary, weekly calorie chart |
| 📥 **Import** | Parse Walmart receipts via CSV upload, text paste, or PDF. Preview & edit before saving |
| 📦 **Inventory** | Expiry status badges, filter by category/status, quick actions (use / restock / open / finish) |
| 🍽️ **Meals** | Log meals from inventory items, auto-calculate nutrition, browse history by date |
| 📈 **Nutrition** | Daily calorie & macro charts with 7 / 14 / 30-day views |
| 👨‍🍳 **Recipes** | Rule-based scoring engine + Gemini AI recommendations, prioritising expiring ingredients |

---

## 🏗️ Tech Stack

```
Frontend    Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Recharts
Backend     Next.js API Routes · Prisma ORM · SQLite
Validation  Zod v4 (runtime schema validation including AI response)
Parsing     PapaParse (CSV) · pdf-parse (PDF text extraction)
AI          Google Gemini 2.5 Flash (structured JSON output, Zod-validated)
Nutrition   USDA FoodData Central API · Open Food Facts API (with local cache)
```

---

## 🧠 Technical Highlights

### Two-Tier Recipe Recommendation
- **Rule engine** scores pre-seeded recipes against current inventory:
  `score = coverage × 0.5 + expiring_matches × 15 − missing × 20 + full_bonus`
- **AI layer** calls Gemini 2.5 Flash with a structured inventory prompt, constrains output to a strict JSON schema, and validates the response with Zod — gracefully degrades if the API key is absent

### Expiry Date Logic (4-level fallback)
1. Explicit `expiryDate` (if manually set)
2. `openedDate + openedShelfLifeDays` (if item is opened)
3. `estimatedExpiryDate` (if available)
4. `purchaseDate + shelfLifeDays` (default)

### Nutrition Enrichment Pipeline
External nutrition data is fetched from USDA / Open Food Facts, normalised by food name, and persisted in a local cache to avoid redundant API calls.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up database (generate Prisma client + push schema + seed data)
npm run setup

# 3. (Optional) Enable AI recipe recommendations
echo "GEMINI_API_KEY=your_key_here" > .env

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the app is pre-loaded with sample data so you can explore immediately.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/              # API route handlers (dashboard / imports / inventory / meals / nutrition / recipes)
│   ├── dashboard/        # Dashboard page
│   ├── imports/          # Receipt import page
│   ├── inventory/        # Inventory management page
│   ├── meals/            # Meal logging page
│   ├── nutrition/        # Nutrition tracking page
│   └── recipes/          # Recipe recommendations page
├── components/           # Shared UI components
└── lib/
    ├── ai/recipe-ai.ts   # Gemini AI integration + Zod validation
    ├── recipe-scoring.ts # Rule-based recipe scoring engine
    ├── import-parser.ts  # CSV / text / PDF parser
    ├── expiry.ts         # Expiry date calculation
    ├── nutrition/        # USDA & Open Food Facts providers + cache
    └── schemas.ts        # Zod validation schemas
prisma/
├── schema.prisma         # Database schema
└── seed.ts               # Sample data seed
```

---

## 🛠️ Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run setup` | Init DB: generate client + push schema + seed |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:seed` | Re-seed sample data |

---

## 📝 Notes & Limitations

- **Single user** — no authentication layer
- **Local only** — SQLite, no cloud database
- **Walmart-tuned parser** — works with generic CSV/text too
- **Approximate nutrition** — per-100g averages, not exact product data
- **Text-based PDF only** — no image OCR

---

---

<a name="中文"></a>

# 🥦 Food Tracker（食材管理助手）

> [EN](#-food-tracker) | **中文**

一个全栈个人食材管理应用 —— 导入购物小票、追踪库存与保质期、记录饮食、监控营养摄入，并获得 AI 智能食谱推荐。

**技术栈：** Next.js 16 · TypeScript · Prisma · SQLite · Tailwind CSS v4 · Gemini AI

---

## ✨ 功能模块

| 模块 | 说明 |
|------|------|
| 📊 **仪表盘** | 库存概览、临期食材提醒、今日营养汇总、周卡路里图表 |
| 📥 **导入购物记录** | 解析 Walmart 小票（CSV 上传 / 文字粘贴 / PDF 上传），导入前可预览编辑 |
| 📦 **库存管理** | 保质期状态标签、按分类/状态筛选、快捷操作（使用 / 补货 / 开封 / 用完）|
| 🍽️ **饮食记录** | 从库存中选食材记录餐食，自动计算营养，按日期查看历史 |
| 📈 **营养追踪** | 每日卡路里与宏量营养素图表，支持 7 / 14 / 30 天视图 |
| 👨‍🍳 **食谱推荐** | 规则引擎评分 + Gemini AI 推荐，优先消耗临期食材 |

---

## 🏗️ 技术栈

```
前端    Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Recharts
后端    Next.js API Routes · Prisma ORM · SQLite
校验    Zod v4（含 AI 响应结构校验）
解析    PapaParse（CSV）· pdf-parse（PDF 文字提取）
AI      Google Gemini 2.5 Flash（结构化 JSON 输出，Zod 校验）
营养    USDA FoodData Central API · Open Food Facts API（本地缓存）
```

---

## 🧠 技术亮点

### 双层食谱推荐系统

- **规则引擎**：对预置食谱按当前库存打分：
  `分数 = 覆盖率 × 0.5 + 临期匹配 × 15 − 缺失食材 × 20 + 全覆盖奖励`
- **AI 层**：将库存摘要格式化为 prompt 传给 Gemini 2.5 Flash，限定输出为严格 JSON schema，并用 Zod 做运行时校验；未配置 API Key 时自动降级为规则引擎

### 保质期计算（四级优先级）

1. 手动设置的精确到期日
2. 开封日期 + 开封后保质天数
3. 系统估算到期日
4. 购买日期 + 标准保质天数（兜底）

### 营养数据丰富化流程

从 USDA / Open Food Facts 获取营养数据，经食材名称标准化后写入本地缓存，避免重复请求外部 API。

---

## 🚀 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库（生成 Prisma 客户端 + 推送 schema + 写入示例数据）
npm run setup

# 3. （可选）启用 AI 食谱推荐
echo "GEMINI_API_KEY=你的密钥" > .env

# 4. 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，应用已预载示例数据，可直接体验所有功能。

---

## 📁 项目结构

```
src/
├── app/
│   ├── api/              # API 路由（dashboard / imports / inventory / meals / nutrition / recipes）
│   ├── dashboard/        # 仪表盘页面
│   ├── imports/          # 小票导入页面
│   ├── inventory/        # 库存管理页面
│   ├── meals/            # 饮食记录页面
│   ├── nutrition/        # 营养追踪页面
│   └── recipes/          # 食谱推荐页面
├── components/           # 公共 UI 组件
└── lib/
    ├── ai/recipe-ai.ts   # Gemini AI 集成 + Zod 校验
    ├── recipe-scoring.ts # 规则引擎食谱评分
    ├── import-parser.ts  # CSV / 文字 / PDF 解析器
    ├── expiry.ts         # 保质期计算逻辑
    ├── nutrition/        # USDA & Open Food Facts 数据提供层 + 缓存
    └── schemas.ts        # Zod 数据校验 schema
prisma/
├── schema.prisma         # 数据库 schema
└── seed.ts               # 示例数据
```

---

## 🛠️ 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run setup` | 初始化数据库（生成客户端 + 推送 schema + 写入示例数据）|
| `npm run db:studio` | 打开 Prisma Studio（可视化数据库浏览器）|
| `npm run db:seed` | 重新写入示例数据 |

---

## 📝 说明与限制

- **单用户** — 无需登录，无鉴权层
- **本地运行** — SQLite，无云端数据库
- **解析器针对 Walmart 优化** — 也兼容通用 CSV / 文字格式
- **营养数据近似** — 基于每 100g 通用均值，非特定产品精确数据
- **PDF 仅支持文字版** — 不支持图片 OCR
