# 电商剧情带货工作流实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** 在现有 AI 剧情画布中增加成片模式、剧情玩法和商品植入选择，并复用当前批量视频接口生成单条、三集或连载视频。

**Architecture:** 剧情选项保存在现有 `EcommerceWorkflowState` 中，由画布顶部工具条直接更新。生成时先复用网站配置的多模态文本模型读取商品图，为每套创意生成结构化策划和逐集视频指令，再生成剧组定妆卡并将具体视频任务交给现有三并发队列。前端只固定创作方向与合规边界，不固定具体剧情、人物或场景。AI 硬广和 AI 口播继续走原有提示词与数量逻辑。

**Tech Stack:** React、TypeScript、Ant Design、Zustand、现有 Canvas 节点与视频生成服务。

---

### Task 1: 增加剧情工作流数据模型

**Files:**
- Modify: `web/src/types/canvas.ts`
- Modify: `web/src/lib/canvas/ecommerce-workflows.ts`

**Steps:**

1. 定义 `EcommerceStoryMode`、`EcommerceStoryPlay`、`EcommerceProductPlacement` 类型。
2. 为 `EcommerceWorkflowState` 增加可选剧情设置字段。
3. 在创建 AI 剧情项目时写入单条剧情、智能混合、智能植入、5 集的默认值。
4. 增加剧情选项定义、总任务数计算和结构化提示词生成函数。
5. 保持硬广、口播的原有提示词生成行为。

### Task 2: 在画布工具条增加剧情设置

**Files:**
- Modify: `web/src/components/canvas/ecommerce-canvas-bar.tsx`

**Steps:**

1. 仅在 `category === "story"` 时显示“剧情设置”按钮。
2. 使用轻量浮层提供成片模式、剧情玩法和商品植入选择。
3. 连载模式额外显示 3–20 集输入项。
4. 展示根据套数和模式算出的实际视频总数。
5. 当总数超过 100 时显示警告并禁用生成按钮。

### Task 3: 展开批量剧情任务并接入现有生成队列

**Files:**
- Modify: `web/src/pages/canvas/project.tsx`

**Steps:**

1. 将工具条的剧情设置变化写回当前画布工作流。
2. 点击生成时计算总任务数并校验不超过 100。
3. 为每个视频任务计算创意套数索引和当前集数。
4. 将结构化剧情设置传给提示词构造函数。
5. 多集输出节点标题包含“第 N 套 · 第 N 集”，单条和其他分类维持简洁编号。
6. 复用现有输出节点、连线、三并发生成和错误统计逻辑。

### Task 4: 更新待确认记录并核对改动

**Files:**
- Modify: `docs/content/docs/progress/pending-test.mdx`
- Check: `docs/content/docs/progress/todo.mdx`

**Steps:**

1. 在待确认记录中归纳 AI 剧情新增的设置与批量规则。
2. 检查 todo 是否存在对应事项；只有存在时才移动，避免无关文档改动。
3. 用 Git diff 核对只修改本功能相关文件。
4. 按用户和项目要求，不执行测试、语法检查或构建。

### Task 5: 自动生成原创美区固定角色

**Files:**
- Modify: `web/src/types/canvas.ts`
- Modify: `web/src/lib/canvas/ecommerce-workflows.ts`
- Modify: `web/src/components/canvas/ecommerce-canvas-bar.tsx`
- Modify: `web/src/pages/canvas/project.tsx`

**Steps:**

1. 增加真人短剧与 AI 漫剧风格选择。
2. 每次点击生成时由 AI 按剧本为每套创意创建新的原创美区剧组身份与定妆卡，人物数量、性别、主次和关系不预设。
3. 禁止角色生成提示词引用真实人物、明星、公众人物、影视角色、艺术家或现有 IP。
4. 将商品图和对应套数角色卡同时传给视频接口，同套多集共享该角色卡。
5. 角色卡只连接到所属套数的视频节点，避免重试时串入其他套数角色。

### Task 6: 接入网站 AI 文本模型动态编剧

1. 使用网站现有文本模型配置和多模态请求读取商品图。
2. 每套创意请求一次结构化策划，返回核心创意、剧组、连续性和逐集视频指令。
3. 前端提示词只限定美区、15 秒、所选玩法/植入方向、商品真实性和原创合规。
4. 将策划结果保存为画布文本节点，并作为角色卡与视频提示词的实际来源。
5. 文本模型未配置或结构化结果无效时明确终止，不使用固定剧本兜底。
