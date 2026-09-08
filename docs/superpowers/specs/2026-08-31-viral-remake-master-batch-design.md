# 爆款母版复刻与可配置批量生产设计

## 目标

把 GouYingAI 无限画布中的“爆款复刻”从提示词驱动的单次重制，升级为可验证、可复用、可批量扩产的完整复刻工作流。

用户只需要提供一条参考视频，并可选上传商品、人物、场景或道具参考图。系统自动完成原片对象识别、上传素材识别、替换关系匹配、完整事件时间轴、角色与服装连续性、复刻执行稿、成片生成和生成后质检。用户不需要手写商品描述。

“1000 条”是系统容量目标，不是默认动作。生成数量默认 1，用户可在 1–1000 之间自由设置；单条精修和批量生产使用同一套工作流。

## 产品边界

### 复刻的定义

本工作流追求“结构与事件层面的完整复刻”，不是逐像素复制原视频：

- 保留原片关键事件、动作顺序、镜头功能、时间比例、口播节奏、声音节点、服装变化和 CTA 位置。
- 只替换用户指定的人物、商品、场景、服装或道具。
- 所有新画面均重新生成；最终成片不得因为模型默认时长而静默删除开头、结尾或关键爆点。
- 纯 AI 重新生成无法承诺逐像素 100% 相同，因此用可计算的复刻评分和通过率验收。

### 批量的定义

批量不是把同一提示词换随机种子重复抽卡，也不是生成 N 份互相改写剧情的脚本。

系统先从参考视频生成唯一一份“爆款母版”，再按一份批量配方编译出 N 份完整实例清单。每份实例继承同一爆款结构，同时在允许变化的槽位中形成受控差异。每个实例对应一个完整视频任务和一个结果项，不按动作节拍拆成多个付费视频任务。

## 用户流程

1. 用户选择或上传一条参考视频，进入爆款复刻。
2. 系统自动识别原片中的人物、核心商品、场景、车辆、服装、动物和关键物品。
3. 用户可选上传多组参考图。系统自动判断每组素材属于商品、人物、场景、造型或道具，生成对象指纹，并自动匹配原片对象。
4. 画布显示“复刻需求”大卡片：参考视频、识别对象、替换关系、目标时长、画幅、语言和生成要求都可以修改。商品描述不是必填项。
5. 用户确认后，系统完成语义动作节拍拉片并生成唯一一份“爆款母版/复刻执行稿”。
6. 执行稿显示角色设定、分场景服装时间线、关键事件时间轴、画面、口播和声音。详细镜头参数默认折叠。
7. 关键事件覆盖门禁通过后，用户设置生成数量 1–1000。数量默认 1；试跑、自动质检和达标后扩产均为可选能力。
8. 系统编译实例清单并提交完整视频任务。任务在后台持续运行，刷新页面后仍可恢复状态。
9. 结果进入一个“成片结果库”复合节点，不在画布铺开数百或数千个普通视频节点。

## 画布信息架构

画布只保留五类主卡片：

1. **参考视频**：现有视频节点。
2. **复刻素材与对象识别**：需求、原片对象、上传对象和替换关系。
3. **爆款母版/复刻执行稿**：角色、服装、事件、镜头、口播和声音。
4. **批量生产**：数量、变量槽位、模型、费用预估、试跑策略和任务状态。
5. **成片结果库**：虚拟列表、评分、筛选、预览、重试和下载。

顶部工具条只保留一个随状态变化的主操作：

- 未分析：`开始识别与拉片`
- 已识别：`生成复刻执行稿`
- 执行稿可用：`生成复刻视频`
- 正在运行：显示进度，不再展示“复刻方案数”“变体”或“重新生成方案”

重新分析、修改模型和高级参数放入次级操作，不与主流程争夺注意力。

## 核心数据模型

### 对象指纹

```ts
type ViralObjectKind = "product" | "person" | "scene" | "vehicle" | "wardrobe" | "animal" | "prop";

type ViralObjectFingerprint = {
    id: string;
    origin: "source-video" | "uploaded-reference";
    kind: ViralObjectKind;
    name: string;
    role: "hero-product" | "supporting-object" | "character" | "environment";
    visualFacts: {
        colors: string[];
        materials: string[];
        shape: string;
        markings: string[];
        packaging: string;
        distinctiveFeatures: string[];
    };
    functionalFacts: string[];
    shotIndexes: number[];
    referenceAssetIds: string[];
    representativeFrameIds: string[];
    confidence: number;
};
```

对象指纹只保存可观察事实。看不清的品牌、功能、材质或人物身份保持为空，不允许推测。

### 替换关系

```ts
type ViralReplacementBinding = {
    id: string;
    sourceObjectId: string;
    replacementObjectId: string;
    mode: "auto" | "user-confirmed" | "user-created";
    confidence: number;
    reason: string;
};
```

绑定优先级：

1. 用户在某个原片对象下直接上传素材，视为显式绑定。
2. 原片只有一个核心商品且上传素材只有一个商品时自动绑定。
3. 多对象场景按叙事角色、用户要求和对象种类计算匹配置信度。
4. 存在多个近似候选或置信度不足时显示待确认，不擅自生成。

### 必保事件

```ts
type ViralMustKeepEvent = {
    id: string;
    priority: "P0" | "P1" | "P2";
    sourceStartSeconds: number;
    sourceEndSeconds: number;
    targetStartSeconds: number;
    targetEndSeconds: number;
    parentShotIndex: number;
    description: string;
    startState: string;
    endState: string;
    involvedObjectIds: string[];
    narrativeFunction: string;
    audioCue: string;
};
```

P0 是开场钩子、核心反转、商品证明或必要 CTA。任意 P0 未映射时，执行稿不得通过覆盖门禁。

### 爆款母版

```ts
type ViralRemakeTemplate = {
    id: string;
    title: string;
    sourceDurationSeconds: number;
    targetDurationSeconds: number;
    aspectRatio: string;
    hookMechanism: string;
    narrativeStructure: string;
    objects: ViralObjectFingerprint[];
    bindings: ViralReplacementBinding[];
    characterBible: ViralCharacterBible;
    wardrobeTimeline: ViralWardrobeStage[];
    events: ViralMustKeepEvent[];
    beats: ViralExecutionBeat[];
    audioPlan: ViralAudioPlan;
    continuityRules: string[];
    coverage: ViralCoverageReport;
};
```

母版只有一份。“14 个动作节拍”表示执行时间轴，不表示 14 个方案或 14 个视频任务。

### 批量配方和实例

```ts
type ViralBatchRecipe = {
    count: number; // 1–1000，默认 1
    seed: number;
    fixedObjectIds: string[];
    variableSlots: ViralVariableSlot[];
    optionalPilotCount: number;
    autoContinueAfterPilot: boolean;
    maxQualityRetries: number;
};

type ViralCandidateManifest = {
    id: string;
    index: number;
    templateId: string;
    seed: number;
    slotSelections: Record<string, string>;
    fixedBindings: ViralReplacementBinding[];
    prompt: string;
};
```

实例编译器优先覆盖变量组合，再用随机种子产生微小差异。固定商品、人物或场景在整条视频中不得漂移。

## 识别与拉片

### 原片对象识别

当前 `replacementElements` 只提供对象名称、类别、描述和动作节拍索引。新链路把它升级为结构化对象指纹，并为核心对象保存跨镜头代表帧。

- 支持原始视频输入的视觉模型时，发送完整视频并读取音轨。
- 只能抽帧时，不再只依赖均匀的最多 24 帧。使用基础均匀帧、镜头变化帧和高运动候选帧的组合，并明确标记声音不可用。
- 每个核心商品必须至少有一个清晰代表帧；无法获得时标记低置信度，不把“识别到物品”当作商品识别成功。
- 质量门禁除动作节拍外，还检查核心商品、P0 事件和结尾覆盖。

### 上传素材识别

上传图片后创建独立的视觉识别任务：

- 自动判断对象类别。
- 提取颜色、材质、形状、图案、包装、可见标记、功能证据和多角度关系。
- 同一对象追加多张图片时合并指纹，不把多角度误认为多个变体。
- 识别结果写回素材卡，后续策划、视频生成和质检复用，不在每个批量实例中重复识别。

## 母版与时长处理

### 语义节拍

保留现有“真实剪辑镜头＋镜头内部语义动作节拍”的分析方式。一个一镜到底视频仍可以包含多个动作节拍；一个场景段也可以包含多个真实切点。

界面默认只显示：代表帧、原片时间、目标时间、画面动作、口播/声音、必保等级。镜头、构图、机位、光线和连续性放入可展开详情。

### 完整事件覆盖

母版生成后计算覆盖报告：

```ts
type ViralCoverageReport = {
    sourceEventCount: number;
    mappedEventCount: number;
    p0Count: number;
    mappedP0Count: number;
    sourceSceneCount: number;
    mappedSceneCount: number;
    sourceDialogueCount: number;
    mappedDialogueCount: number;
    passed: boolean;
    issues: string[];
};
```

通过条件：全部 P0、开场和结尾都已映射；时间轴从 0 连续覆盖到目标结尾；没有重叠、倒序或未解释的空洞。

### 时长策略

默认目标时长等于原片时长。用户主动缩短时，系统按事件重要度和时间比例压缩全部结构：

- P0 不得删除。
- P1 只允许缩短，不允许无提示删除。
- P2 可以合并，但必须在覆盖报告中显示。
- 如果模型不支持目标时长，在付费提交前停止并提示切换定制链路或模型，禁止静默截断。

## 角色、服装和声音

母版保留 Clipcat 工作流中有效的角色设定方式，但改成全局结构化约束：

- 固定身份：面孔、发型、体态、基础造型和人物关系。
- 服装时间线：每个场景阶段使用哪套服装，以及换装发生的真实边界。
- 表演规则：肢体、面向、情绪和商品展示动作。
- 上传人物图时以人物图为唯一身份事实，不再根据原片硬编码年龄或种族。

音频采用独立确定性层：先保存原片可确认的口播、停顿、字幕、音效和音乐节点，再为新成片生成或合成音轨。视频模型只负责画面时不得自行改写口播。

## 生成路由

用户界面只有一个“爆款复刻”，内部根据母版复杂度选择执行路径：

- 简单口播、单场景和模型原生支持完整时长：普通完整视频路径。
- 多场景、复杂物理事件、换装或时长超出普通能力：定制完整复刻路径。

无论内部如何执行，对用户和任务系统都满足：一个候选实例只提交一个完整视频编排任务，画布只接收一个完整成片结果项。分析节拍不得直接变成多个前端付费视频任务。

最终请求必须显式携带：对象绑定、商品指纹、人物身份、服装时间线、全部 P0 事件、目标时间轴、声音计划、原创规则和物理连续性规则。

## 批量编译与后台运行

### 可配置数量

- `count` 默认 1，范围 1–1000。
- 1000 是容量目标，不是默认值，也不是进入工作流后的强制任务。
- 用户点击提交前显示任务数、模型、单条预计价格、总预计费用和并发策略。

### 编译策略

批量编译器以母版为不可变骨架：

- 钩子机制、P0 事件、叙事顺序、时间结构、商品绑定和连续性是硬约束。
- 人物、服装、场景装饰、口播角度、视觉风格等只有被声明为变量槽位时才能变化。
- 每份实例清单先固定一套槽位选择，再生成整条视频，不允许镜头级重新抽取。
- 编译器验证组合容量、重复率和约束冲突；无法形成足够差异时明确提示，而不是伪造 1000 个随机种子版本。

### 持久化任务

复用现有 Gateway 画布任务和并发限制，增加批次级记录和协调器：

- 批次记录保存母版、配方、模型绑定、总数、状态和统计。
- 协调器按小窗口持续补充完整视频子任务，避免一次把大型提示词复制 1000 次写入请求。
- 页面刷新或关闭不取消任务。
- 支持暂停、继续、取消未提交项、单条重试和失败项批量重试。
- 任务列表通过批次 ID 分页读取，前端使用虚拟列表，不把所有结果展开成画布节点。

## 生成后质检

每条成片重新执行轻量拉片并生成质量报告：

```ts
type ViralQualityReport = {
    totalScore: number;
    eventCoverageScore: number;
    timelineScore: number;
    identityScore: number;
    productScore: number;
    audioScore: number;
    visualScore: number;
    missingP0EventIds: string[];
    issues: string[];
    decision: "pass" | "retry" | "review";
};
```

权重：关键事件 30%、时间与镜头顺序 20%、人物与服装 15%、商品 15%、声音 10%、视觉与构图 10%。

- 任意 P0 缺失时总分最高 79。
- 达到 90 且没有严重物理、人物或商品错误时通过。
- 自动重试次数由配方控制，默认 0，避免用户未授权的额外费用。
- “10 次中至少 8 次达到 90%”是母版认证指标，不是每条视频的无条件承诺。

## 状态机

```text
idle
  -> recognizing
  -> requirements_ready
  -> templating
  -> template_ready
  -> compiling
  -> ready_to_submit
  -> running
  -> partially_completed | completed | paused | failed
```

修改参考视频会使识别、母版和批次失效。修改替换素材会使对象绑定、母版实例和未提交批次失效，但不删除已经完成的历史成片。修改批量数量或变量槽位只重新编译实例，不重新拉片。

## 费用与错误保护

- 识别、母版和实例编译完成前不得创建付费视频任务。
- 生成按钮必须展示本次明确提交的数量和预计费用。
- 默认不自动试跑、不自动扩产、不自动付费重试。
- 模型不支持原片完整时长、参考类型或音频时，在提交前阻止。
- 识别置信度低、替换绑定歧义或 P0 覆盖失败时，不允许以“已完成复刻分析”进入生成。
- 批次创建使用幂等请求 ID，刷新或重复点击不得重复收费。

## 验收标准

1. 原片和上传商品都能生成结构化对象指纹，用户不填写商品描述也可继续。
2. 单一核心商品场景自动建立替换关系；多对象歧义时要求确认。
3. 一镜到底视频按可观察动作变化拆节拍，不按固定秒数切分。
4. 母版完整覆盖原片开场、全部 P0 和结尾；P0 缺失时禁止生成。
5. 默认目标时长跟随原片；缩短时不静默删除 P0。
6. 一份母版只有一个执行稿节点，动作节拍不再被称为变体。
7. 生成数量默认 1，可设置到 1000；数量变化不重新识别或拉片。
8. 每个候选只创建一个完整视频任务；批量结果集中在结果库复合节点。
9. 任务刷新后仍可恢复，支持暂停、继续、取消和失败重试。
10. 生成后报告能够识别缺失 P0，并将总分限制在 79 以下。
11. 用户未授权时不自动试跑、扩产或付费重试。
12. 画布保持整洁，默认只显示五类主卡片和一个主操作。

## 不在本轮范围

- 承诺逐像素 100% 复现。
- 创建爆款社区、模板交易市场或链接抓取平台。
- 默认强制生成 10 条试跑或 1000 条批量。
- 为每个动作节拍创建独立付费视频任务。
- 在画布同时铺开数百或数千个视频节点。
