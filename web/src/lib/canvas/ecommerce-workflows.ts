import { nanoid } from "nanoid";

import { NODE_DEFAULT_SIZE } from "@/constant/canvas";
import {
    CanvasNodeType,
    type CanvasNodeData,
    type EcommerceProductPlacement,
    type EcommerceStoryMode,
    type EcommerceStoryPlay,
    type EcommerceStoryVisualStyle,
    type EcommerceVideoCategory,
    type EcommerceWorkflowState,
} from "@/types/canvas";

export const ecommerceStoryModeOptions: Array<{ value: EcommerceStoryMode; label: string }> = [
    { value: "single", label: "单条剧情" },
    { value: "mini-series", label: "三集迷你短剧" },
    { value: "series", label: "连载短剧" },
];

export const ecommerceStoryVisualStyleOptions: Array<{ value: EcommerceStoryVisualStyle; label: string }> = [
    { value: "live-action", label: "真人短剧" },
    { value: "animated", label: "AI 漫剧" },
];

export const ecommerceStoryPlayOptions: Array<{ value: EcommerceStoryPlay; label: string; prompt: string }> = [
    { value: "auto", label: "智能混合", prompt: "" },
    { value: "comeback", label: "逆袭打脸", prompt: "采用逆袭打脸结构：先让主角陷入被轻视或受挫的处境，再用行动完成翻盘；商品只推动关键行动，不承担夸张、虚假的逆袭结果。" },
    { value: "misunderstanding", label: "情感误会", prompt: "采用情感误会结构：用一个可信的小误会建立关系冲突，通过新的信息自然化解误会，并让商品参与人物关系的推进。" },
    { value: "workplace", label: "职场救场", prompt: "采用职场救场结构：从紧迫任务、临时状况或社交尴尬切入，让商品通过具体使用动作帮助人物完成当下目标。" },
    { value: "family", label: "家庭关系", prompt: "采用家庭关系结构：围绕家人之间的需求差异、关心或代际沟通展开，用生活化行动完成温和转折。" },
    { value: "mystery", label: "悬疑揭秘", prompt: "采用悬疑揭秘结构：开场展示异常细节或未解释的结果，逐步给出线索，最后揭示商品在事件中的真实作用。" },
    { value: "comedy", label: "轻喜剧反差", prompt: "采用轻喜剧反差结构：人物预期与现实产生生活化反差，通过动作和反应制造笑点，再由商品自然完成解围。" },
];

export const ecommerceProductPlacementOptions: Array<{ value: EcommerceProductPlacement; label: string; prompt: string }> = [
    { value: "auto", label: "智能植入", prompt: "" },
    { value: "solution", label: "解决问题的工具", prompt: "让商品成为人物解决当下具体问题的工具，用可见使用动作证明作用，不直接口播硬推。" },
    { value: "gift", label: "推动关系的礼物", prompt: "让商品作为人物之间表达关心或缓和关系的礼物，商品价值通过对方的真实反应呈现。" },
    { value: "evidence", label: "揭晓身份的证据", prompt: "让商品包装、订单或使用痕迹成为揭示人物信息的关键证据，揭晓必须服务于剧情且不编造商品事实。" },
    { value: "keepsake", label: "贯穿全剧的信物", prompt: "让商品作为贯穿故事的信物或共同记忆，在关键镜头反复出现并推动人物做出选择。" },
    { value: "conflict", label: "触发冲突的道具", prompt: "让商品作为触发误会或冲突的道具，随后通过人物行动解释真相，结尾自然回到商品。" },
];

export type EcommerceStoryPlan = {
    title: string;
    concept: string;
    cast: string;
    continuity: string;
    episodes: Array<{
        title: string;
        script: string;
        videoPrompt: string;
    }>;
};

export type EcommerceNonStoryCategory = Exclude<EcommerceVideoCategory, "story">;

export type EcommerceVideoPlan = {
    category: EcommerceNonStoryCategory;
    title: string;
    details: Array<{ label: string; value: string }>;
    videoPrompt: string;
};

const ecommerceVideoPlanSpecs: Record<
    EcommerceNonStoryCategory,
    {
        role: string;
        direction: string;
        fields: Array<{ key: string; label: string; instruction: string }>;
    }
> = {
    "hard-ad": {
        role: "美区 DTC 品牌的数字人口播广告导演和直效文案策划",
        direction: "策划一条由原创数字人正面出镜的强转化口播广告。核心必须是人物的英文口播、可信表演、手持或使用商品的动作以及与口播对应的产品特写；只选择一个最有图片依据的卖点角度。",
        fields: [
            { key: "hook", label: "前三秒钩子", instruction: "精确英文开场台词与开场动作，不能用无事实依据的夸张数字" },
            { key: "presenter", label: "数字人设定", instruction: "原创出镜人的年龄段、外观、穿着、语气、表演状态和美国使用场景" },
            { key: "spokenScript", label: "完整英文口播", instruction: "可在一条短视频内自然说完的逐字英文口播稿" },
            { key: "productShots", label: "商品镜头", instruction: "口播过程中插入的商品特写、持握和使用动作" },
            { key: "performance", label: "表演与声音", instruction: "眼神、停顿、语速、口型同步、环境声和音乐要求" },
        ],
    },
    "visual-seeding": {
        role: "美区生活方式品牌的视觉导演和软广短片策划",
        direction: "策划一条以画面感和使用体验为核心的视觉种草短片。禁止把它写成数字人正面推销或完整口播广告；通过环境、材质、手部动作、产品细节和镜头之间的视觉联系让观众产生兴趣。默认无口播，只有确有必要时允许一句很轻的英文旁白。",
        fields: [
            { key: "visualConcept", label: "视觉概念", instruction: "一句话说明这条软广独有的视觉体验和种草角度" },
            { key: "moodAndArtDirection", label: "氛围与美术", instruction: "真实美国生活场景、时间、色彩、光线、材质和摄影质感" },
            { key: "shotSequence", label: "无口播镜头序列", instruction: "按顺序写清每个画面、动作、商品出现方式和自然转场，不套口播结构" },
            { key: "soundAndVoice", label: "声音方案", instruction: "环境音、音乐节奏；如需轻旁白写出唯一一句英文原文，否则明确 no voiceover" },
        ],
    },
    "pain-comparison": {
        role: "美区电商合规创意策略师和问题解决型短视频导演",
        direction: "策划一条可验证、不过度承诺的痛点对比视频。必须围绕具体使用情境建立“未使用时的麻烦—实际使用过程—可观察的体验变化”，前后应是同一人物、同一环境和可信连续时间，不能制造医疗疗效、极端改造或虚假竞品对照。",
        fields: [
            { key: "audiencePain", label: "具体痛点", instruction: "目标人群、发生情境和一个能被镜头看见的真实麻烦" },
            { key: "beforeMoment", label: "使用前画面", instruction: "不丑化人物、不贬低竞品的使用前动作和状态" },
            { key: "productUse", label: "使用过程", instruction: "商品如何进入、如何被使用以及必须拍清楚的步骤" },
            { key: "credibleOutcome", label: "可信结果", instruction: "只写图片事实能支持或纯体验层面的可观察改善" },
            { key: "comparisonGuardrails", label: "合规边界", instruction: "本条禁止出现的功效、数据、极端变化和误导性表达" },
        ],
    },
    "remix-explainer": {
        role: "美区社媒电商的混剪导演、解说文案和声音编辑",
        direction: "策划一条 AI 配音驱动的素材混剪解说视频。核心是先写完整英文解说，再为每句解说匹配独立素材镜头；画面以商品全景、局部、手部演示和使用场景为主，不设置持续出镜的口播主播，也不写成剧情短剧。",
        fields: [
            { key: "editorialAngle", label: "解说主题", instruction: "一个明确的信息组织角度和观众看完能理解的重点" },
            { key: "voiceoverScript", label: "完整英文配音", instruction: "可在短视频内读完的逐字英文 AI 配音稿" },
            { key: "assetShotList", label: "逐句素材表", instruction: "按配音句子逐项匹配商品全景、细节、演示、场景或图形化镜头" },
            { key: "editRhythm", label: "剪辑结构", instruction: "镜头长度变化、切点、转场、字幕关键词与结尾定格" },
            { key: "soundDesign", label: "声音设计", instruction: "配音音色、语速、音乐、音效和混音层级" },
        ],
    },
};

const selectableStoryPlays = ecommerceStoryPlayOptions.filter((item) => item.value !== "auto");
const selectablePlacements = ecommerceProductPlacementOptions.filter((item) => item.value !== "auto");

const ecommerceCharacterCardTemplate = [
    "Generate one clean character reference card containing exactly the recurring cast described below. Every listed character is standing naturally, shown from head to toe with both feet and any footwear fully visible, in a straight front view against a pure white seamless background with only a simple soft grounding shadow. Keep all faces, hands, clothing, footwear, and silhouettes unobstructed. If the story requires multiple recurring characters, arrange all of them side by side at the same visual scale on the same uncluttered sheet; do not add anyone who is not listed.",
    "The style in the generated picture is: {{STYLE}}",
    "The appearance of the characters in the generated image is: {{APPEARANCE}}",
    "This appearance section is authoritative. Preserve each character's stated age, ethnicity, facial geometry, skin tone, body proportion, hairstyle, wardrobe, accessories, and distinguishing traits. Make every face newly invented and clearly distinguishable from the others. The internal casting identity is {{IDENTITY}}; use it only as a randomization seed and never render it.",
    "Clean, uncluttered pure white background with zero noise and no distracting details. No environment, furniture, scenery, product, typography, labels, logos, watermark, border, split-screen inset, or decorative card UI.",
    "Negative prompt: {{NEGATIVE}}",
];

const ecommerceLiveActionCharacterStyle = [
    "US-market live-action drama photorealistic style, ultra-high resolution, depicting living breathing humans with natural blood flow and warmth",
    "skin texture resembling dry sandpaper with visible raw details, a strictly flat non-reflective matte and lightly powdered chalky finish, light-absorbing skin surface, zero specular reflection, gloss-free rendering",
    "natural skin tone with authentic imperfections and organic texture, visible pores and fine vellus hair, realistic skin topography and natural ruddiness, raw unretouched photography",
    "authentic facial features matching each character's specified ethnicity, age-appropriate proportions and realistic anatomy for adults, children, and elderly characters, natural small head-to-body proportion, highly expressive eyes and narrative-driven but controlled facial expressions",
    "historically or culturally accurate hairstyle and wardrobe only when the story specification calls for them; otherwise practical contemporary American styling; voluminous dry matte hair strands with individual hair detail",
    "garments with photorealistic material fidelity, smooth low-frequency fabric texture, noise-free detail-reduced textile surface, soft matte fabric finish, no visible grain or distracting clothing micro-texture",
    "environmental details obeying real-world physics, all scene reflections eliminated, flat overcast global diffuse lighting, zero directional light, heavily diffused softbox lighting, subtle subsurface scattering with zero surface gloss, matte skin shader, dry matte complexion",
    "dark areas retaining natural detail and strictly avoiding crushed pure black",
].join(", ");

const ecommerceAnimatedCharacterStyle = [
    "original high-end modern US commercial animated drama character design, polished cinematic 3D and 2D hybrid rendering without imitating any existing animation, comic, artist, studio, or franchise",
    "full-body production character reference quality, anatomically coherent age-appropriate proportions, distinctive original facial geometry, expressive eyes, controlled natural expressions, and clearly readable silhouettes",
    "matte surfaces, soft global diffuse lighting, zero oily or plastic sheen, detailed but uncluttered hair shapes, clean practical wardrobe with smooth low-frequency textile rendering and consistent material colors",
    "subtle dimensional form without harsh contours, believable fabric drape and real-world grounding, no exaggerated superhero anatomy",
].join(", ");

const ecommerceCharacterCardNegativePrompt = [
    "cropped head", "cropped feet", "seated pose", "rear view", "profile-only view", "action pose", "floating body", "extra people", "duplicate person", "cloned face", "merged bodies", "extra limbs", "missing limbs", "deformed hands", "visible muscle structure", "visible muscle undulations", "pronounced muscle definition", "blocky facial planes", "strong facial contours", "light reflection", "glossy finish", "sheen", "oily skin", "greasy sheen", "shiny face", "specular spots", "skin gloss", "wet appearance", "wet hair", "moist or translucent facial quality", "silicone skin", "plastic-like skin", "porcelain-like skin", "crushed pure black", "harsh artificial lighting", "intense directional lighting", "harsh facial shadows", "heavily retouched indoor photography", "excessive sharpening", "visible grain", "fabric noise", "textile grain", "sharp fabric texture", "clothing micro-details", "high-frequency textile patterns", "blurry low-resolution imagery", "hand-painted oil painting style", "CGI effects in live-action mode", "unattractive or incoherent costume styling", "celebrity likeness", "public figure likeness", "existing movie or TV character", "copyrighted character", "known IP", "text", "logo", "watermark", "product", "props", "scenery", "colored background",
]
    .map((item) => `no ${item}`)
    .join(", ");

export const ecommerceWorkflowDefinitions: Array<{
    category: EcommerceVideoCategory;
    title: string;
    shortTitle: string;
    description: string;
}> = [
    {
        category: "hard-ad",
        title: "AI 硬广（数字人口播带货）",
        shortTitle: "硬广",
        description: "数字人面向镜头讲解商品，配合产品特写快速完成卖点表达和行动引导。",
    },
    {
        category: "visual-seeding",
        title: "AI 视觉种草（AI 软广、无口播 / 轻旁白）",
        shortTitle: "视觉种草",
        description: "用氛围、场景和真实使用动作建立吸引力，可无口播或只使用轻旁白。",
    },
    {
        category: "story",
        title: "AI 剧情带货（故事植入）",
        shortTitle: "剧情",
        description: "AI 按商品和所选方向动态策划人物、剧情与场景。",
    },
    {
        category: "pain-comparison",
        title: "AI 痛点对比短视频",
        shortTitle: "痛点对比",
        description: "先呈现具体使用痛点，再通过商品使用过程展示可信、合规的改善。",
    },
    {
        category: "remix-explainer",
        title: "AI 混剪解说（AI 配音 + 素材拼接）",
        shortTitle: "混剪解说",
        description: "围绕商品图自动规划素材镜头、节奏和 AI 配音，生成解说型短视频。",
    },
];

export function getEcommerceWorkflowDefinition(category: EcommerceVideoCategory) {
    return ecommerceWorkflowDefinitions.find((item) => item.category === category) || ecommerceWorkflowDefinitions[0];
}

export function buildEcommerceWorkflowProject(category: EcommerceVideoCategory) {
    const definition = getEcommerceWorkflowDefinition(category);
    const productNodeId = nanoid();
    const productSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
    const productNode: CanvasNodeData = {
        id: productNodeId,
        type: CanvasNodeType.Image,
        title: "上传商品图",
        position: { x: 600, y: 220 },
        width: productSpec.width,
        height: productSpec.height,
        metadata: { content: "", status: "idle" },
    };
    const workflow: EcommerceWorkflowState = {
        kind: "ecommerce-video",
        category,
        productNodeId,
        batchCount: 1,
        ...(category === "story"
            ? { storyMode: "single" as const, storyVisualStyle: "live-action" as const, storyPlay: "auto" as const, productPlacement: "auto" as const, seriesEpisodes: 5 }
            : {}),
    };

    return { title: definition.title, nodes: [productNode], connections: [], workflow, viewport: { x: 40, y: 80, k: 0.72 } };
}

export function getEcommerceStoryEpisodeCount(workflow: EcommerceWorkflowState) {
    if (workflow.category !== "story" || (workflow.storyMode || "single") === "single") return 1;
    if (workflow.storyMode === "mini-series") return 3;
    return Math.max(3, Math.min(20, workflow.seriesEpisodes || 5));
}

export function getEcommerceOutputCount(workflow: EcommerceWorkflowState) {
    const creativeCount = Math.max(1, Math.min(100, workflow.batchCount || 1));
    return creativeCount * getEcommerceStoryEpisodeCount(workflow);
}

export function getEcommerceStoryTaskDetails(workflow: EcommerceWorkflowState, taskIndex: number) {
    const totalEpisodes = getEcommerceStoryEpisodeCount(workflow);
    const creativeIndex = Math.floor(taskIndex / totalEpisodes);
    const episodeIndex = taskIndex % totalEpisodes;
    const selectedPlay = workflow.storyPlay || "auto";
    const play = selectedPlay === "auto" ? selectableStoryPlays[creativeIndex % selectableStoryPlays.length] : ecommerceStoryPlayOptions.find((item) => item.value === selectedPlay)!;
    const selectedPlacement = workflow.productPlacement || "auto";
    const placement = selectedPlacement === "auto" ? selectablePlacements[selectableStoryPlays.indexOf(play) % selectablePlacements.length] : ecommerceProductPlacementOptions.find((item) => item.value === selectedPlacement)!;
    return { creativeIndex, episodeIndex, totalEpisodes, play, placement };
}

function getEcommerceOriginalUsCastIdentity(creativeIndex: number, generationSeed: number) {
    return `${generationSeed.toString(36)}-${creativeIndex + 1}`;
}

export function buildEcommerceVideoPlannerPrompt(category: EcommerceNonStoryCategory, creativeIndex: number, total: number, generationSeed: number) {
    const definition = getEcommerceWorkflowDefinition(category);
    const spec = ecommerceVideoPlanSpecs[category];
    const identityCode = `${generationSeed.toString(36)}-${category}-${creativeIndex + 1}`;
    const fieldSchema = spec.fields.map((field) => `"${field.key}":"${field.instruction}"`).join(",");
    return [
        `你是${spec.role}。请先识别随消息附带的商品图，再为“${definition.title}”策划本批次第 ${creativeIndex + 1}/${total} 条原创竖屏带货视频。目标市场和文化语境为美国，成片中的口播、旁白和可见营销语言使用自然英文。`,
        `本类内容的不可替换定义：${spec.direction}`,
        `差异化种子：${identityCode}。它只用于让本条的创意角度、开场、人物或场景、镜头顺序和声音设计区别于同批其他视频，不得显示在画面或台词中。不要退化成其他分类：硬广必须由数字人口播驱动；视觉种草必须由画面和体验驱动；痛点对比必须由可信的使用前、过程和结果驱动；混剪解说必须由 AI 配音和逐句素材匹配驱动。`,
        "事实与合规边界：只能使用商品图明确可见或可以可靠识别的信息。不得猜测或编造功效、成分、材质、规格、价格、折扣、认证、销量、排名、用户见证、医学结论、竞品结论或夸张前后变化。不确定的商品信息不要写；不要虚构屏幕文字。",
        "videoPrompt 必须是可以原样提交给视频模型的完整英文生成提示词。它需要吸收本类全部策划字段，明确 9:16 成片、场景、人物或手部、商品保持要求、逐镜头动作、所需英文原文、镜头语言、转场、声音和本类禁止项；不能只复述策划摘要。",
        "只返回一个可解析的 JSON 对象，不要 Markdown、代码围栏或额外解释。字段必须严格如下，不要增加、缺少或改名：",
        `{"title":"本条中文创意短标题",${fieldSchema},"videoPrompt":"本类专用的完整英文视频生成提示词"}`,
    ].join("\n\n");
}

export function parseEcommerceVideoPlan(category: EcommerceNonStoryCategory, content: string): EcommerceVideoPlan {
    const record = parsePlanRecord(content, "AI 视频策划");
    const spec = ecommerceVideoPlanSpecs[category];
    const title = planText(record.title);
    const videoPrompt = planText(record.videoPrompt);
    const details = spec.fields.map((field) => ({ label: field.label, value: planText(record[field.key]) }));
    if (!title || !videoPrompt || details.some((item) => !item.value)) throw new Error(`${getEcommerceWorkflowDefinition(category).shortTitle}策划字段不完整`);
    return { category, title, details, videoPrompt };
}

export function formatEcommerceVideoPlan(plan: EcommerceVideoPlan, plannerPrompt: string) {
    return [
        `# ${plan.title}`,
        ...plan.details.map((item) => `## ${item.label}\n${item.value}`),
        `## 完整视频生成提示词\n${plan.videoPrompt}`,
        `## 完整 AI 策划提示词\n${plannerPrompt}`,
    ].join("\n\n");
}

export function buildEcommerceStoryPlannerPrompt(workflow: EcommerceWorkflowState, creativeIndex: number, generationSeed: number) {
    const totalEpisodes = getEcommerceStoryEpisodeCount(workflow);
    const { play, placement } = getEcommerceStoryTaskDetails(workflow, creativeIndex * totalEpisodes);
    const visualStyle = (workflow.storyVisualStyle || "live-action") === "animated" ? "原创现代美区 AI 漫剧" : "写实真人美区竖屏短剧";
    const identityCode = getEcommerceOriginalUsCastIdentity(creativeIndex, generationSeed);
    return [
        "你是美区电商竖屏短剧的创意策划。请先识别随消息附带的商品图，再为本套创意从零策划原创剧情。前端只提供方向与边界，具体故事、角色数量、角色性别、人物主次、人物关系、场景、换场方式、对白和镜头节奏全部由你根据商品与剧情需要决定。",
        `大方向：${visualStyle}；剧情玩法为“${play.label}”；商品植入方向为“${placement.label}”；共 ${totalEpisodes} 集，每集最多 15 秒；目标受众和文化语境为美国；创意随机标识为 ${identityCode}。把随机标识当作差异化种子，主动避开最常见的第一套构思，但不要在返回内容或画面中显示该标识。${play.prompt} ${placement.prompt}`,
        "创作要求：商品必须自然参与剧情，而不是套用固定的女主逆袭、男女搭档或单主角模板。可以固定一个场景，也可以在剧情需要时自然换场，但不得预设固定换场秒点。角色和场景数量以 15 秒内能看懂为准；连续多集只固定确实需要延续的人物与设定。不同集要有推进，不要把同一个段落重复改写。",
        "角色卡字段要求：cast 是后续角色卡模板中唯一会被动态替换的角色外观段。请按角色逐个写成可直接生图的完整英文外观说明，包含剧情身份、性别表达、准确年龄段、符合美国语境的族裔与面部特征、肤色、身高体型、头身比例、脸型与五官、发型发色、完整服装和鞋履、必要配饰、气质表情及可供多镜头识别的独特特征。只写剧本中确实需要跨镜头固定的角色，不默认女主、男主或单主角，也不要使用只有 attractive、beautiful、handsome 之类的空泛描述。",
        "真实性与原创边界：只能使用商品图中明确可见或可识别的事实，不得编造功效、成分、价格、认证、销量、用户见证或夸张前后对比。角色必须原创，不得引用、模仿或暗示真实人物、明星、公众人物、影视角色、艺术家或现有 IP；每套创意重新发明面孔、体态和造型，同一套多集才保持一致。英文对白必须自然口语化，并符合美国生活与消费语境。",
        `只返回一个可解析的 JSON 对象，不要 Markdown、代码围栏或额外解释。字段必须严格采用以下结构，episodes 必须恰好包含 ${totalEpisodes} 项：`,
        `{"title":"中文短标题","concept":"中文的一句话核心创意与人物关系","cast":"完整英文角色外观段。逐个描述所有需要固定的原创角色及其剧情身份、性别表达、年龄、族裔与面部特征、肤色、身高体型、头身比例、五官、发型、从上到下的服装鞋履、配饰、表情气质和稳定识别特征；人数和主次完全由剧本决定，不添加无用角色","continuity":"用英文描述多集需要保持的人物、服装、道具、场景或故事连续性；单集也要写必要的一致性要求","episodes":[{"title":"本集中文标题","script":"中文写清本集场景、人物动作、英文对白、商品如何介入、转折与结尾；不按固定秒点套模板","videoPrompt":"可直接交给视频模型的详细英文生成指令，明确人物、场景、动作、英文对白、商品展示、镜头与自然转场，保证 15 秒内可完成"}]}`,
    ].join("\n\n");
}

export function parseEcommerceStoryPlan(content: string, expectedEpisodes: number): EcommerceStoryPlan {
    const record = parsePlanRecord(content, "AI 剧情策划");
    const episodes = Array.isArray(record.episodes)
        ? record.episodes.map((item) => {
              const episode = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
              return { title: planText(episode.title), script: planText(episode.script), videoPrompt: planText(episode.videoPrompt) };
          })
        : [];
    const plan = {
        title: planText(record.title),
        concept: planText(record.concept),
        cast: planText(record.cast),
        continuity: planText(record.continuity),
        episodes,
    };
    if (!plan.title || !plan.concept || !plan.cast || episodes.length !== expectedEpisodes || episodes.some((episode) => !episode.title || !episode.script || !episode.videoPrompt)) {
        throw new Error(`AI 剧情策划格式不完整，需要恰好返回 ${expectedEpisodes} 集`);
    }
    return plan;
}

function parsePlanRecord(content: string, label: string) {
    const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error(`${label}没有返回有效 JSON`);
    let value: unknown;
    try {
        value = JSON.parse(trimmed.slice(start, end + 1));
    } catch {
        throw new Error(`${label}返回的 JSON 无法解析`);
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}格式不正确`);
    return value as Record<string, unknown>;
}

function planText(value: unknown) {
    if (typeof value === "string") return value.trim();
    if (value && typeof value === "object") return JSON.stringify(value);
    return "";
}

export function formatEcommerceStoryPlan(plan: EcommerceStoryPlan, characterPrompt?: string) {
    return [
        `# ${plan.title}`,
        plan.concept,
        `## 角色设定\n${plan.cast}`,
        plan.continuity ? `## 连续性\n${plan.continuity}` : "",
        ...plan.episodes.map((episode, index) => `## 第 ${index + 1} 集：${episode.title}\n${episode.script}\n\n视频指令：${episode.videoPrompt}`),
        characterPrompt ? `## 完整角色卡生图提示词\n${characterPrompt}` : "",
    ]
        .filter(Boolean)
        .join("\n\n");
}

export function buildEcommerceCharacterReferencePrompt(workflow: EcommerceWorkflowState, plan: EcommerceStoryPlan, creativeIndex: number, generationSeed: number) {
    const identityCode = getEcommerceOriginalUsCastIdentity(creativeIndex, generationSeed);
    const style = (workflow.storyVisualStyle || "live-action") === "animated" ? ecommerceAnimatedCharacterStyle : ecommerceLiveActionCharacterStyle;
    const appearance = [`Story concept and relationships: ${plan.concept}.`, `Recurring character appearance specification: ${plan.cast}.`, `Continuity requirements that affect appearance: ${plan.continuity}.`].join(" ");
    return ecommerceCharacterCardTemplate
        .join("\n\n")
        .replace("{{STYLE}}", style)
        .replace("{{APPEARANCE}}", appearance)
        .replace("{{IDENTITY}}", identityCode)
        .replace("{{NEGATIVE}}", ecommerceCharacterCardNegativePrompt);
}

export function buildEcommerceVideoPrompt(workflow: EcommerceWorkflowState, index: number, total: number, generationSeed = 0, storyPlan?: EcommerceStoryPlan, videoPlan?: EcommerceVideoPlan) {
    if (workflow.category !== "story") {
        if (!videoPlan || videoPlan.category !== workflow.category) throw new Error("缺少当前分类的 AI 视频策划结果");
        return [
            videoPlan.videoPrompt,
            "Hard execution boundaries:",
            "1. The first reference image is the real product source. Preserve its product shape, packaging, color, proportions, logo, and visible text; do not replace or redesign it.",
            `2. Execute this specifically as ${getEcommerceWorkflowDefinition(workflow.category).title}. Do not convert it into another commerce format or a generic montage.`,
            "3. Do not invent claims, ingredients, materials, specifications, prices, discounts, certifications, sales figures, rankings, testimonials, medical results, competitor facts, or unsupported before-and-after changes.",
            `4. This is task ${index + 1}/${total}. Follow the AI-planned creative exactly instead of adding a generic hook, presenter, story, comparison, or voiceover structure that belongs to another task.`,
            "5. Produce one complete 9:16 commerce video ready for review, with coherent product continuity, natural US-market language when speech is requested, and no watermark.",
        ].join("\n");
    }

    const { creativeIndex, episodeIndex, totalEpisodes, play, placement } = getEcommerceStoryTaskDetails(workflow, index);
    if (!storyPlan) throw new Error("缺少 AI 剧情策划结果");
    const episodePlan = storyPlan.episodes[episodeIndex];
    if (!episodePlan) throw new Error(`AI 剧情策划缺少第 ${episodeIndex + 1} 集`);
    const identityCode = getEcommerceOriginalUsCastIdentity(creativeIndex, generationSeed);
    const visualStyle =
        (workflow.storyVisualStyle || "live-action") === "animated"
            ? "视觉风格采用原创高品质 AI 漫剧：现代美国商业动画质感，角色设计清晰、表情有戏、光影统一，不模仿任何已有漫画、动画、艺术家或工作室风格。"
            : "视觉风格采用写实真人美区竖屏短剧：自然肤质、真实摄影、生活化表演与美国商业短片质感，人物不是任何真实人物、明星或公众人物。";
    const seriesInstruction =
        totalEpisodes === 1
            ? "本条是独立剧情：在一条视频内完成 AI 策划的核心叙事与商品植入，不额外套用固定剧情结构。"
            : `这是第 ${creativeIndex + 1} 套连续短剧的第 ${episodeIndex + 1}/${totalEpisodes} 集。保持需要连续出现的人物外貌、身份关系、服装、故事设定和商品外观一致；承接上一集信息，同时让本集有独立进展${episodeIndex + 1 < totalEpisodes ? "，结尾留下明确但不过度拖延的下一集悬念" : "，本集完成主要矛盾并自然收束商品价值"}。`;

    return [
        "根据商品参考图制作竖屏剧情带货视频。准确保持商品外观、包装、颜色与可见文字，只使用图片中明确可见或可识别的商品事实；禁止编造功效、成分、价格、认证、真实用户见证和夸张前后对比。",
        `目标市场为美国。${visualStyle} 英文对白自然口语化，使用美国生活场景、文化语境和消费表达。`,
        `严格执行网站 AI 文本模型为本套生成的独立策划，不要替换成常见固定剧情。本套标题：${storyPlan.title}。核心创意：${storyPlan.concept}。角色设定：${storyPlan.cast}。连续性要求：${storyPlan.continuity}。内部剧组身份码为 ${identityCode}，只用于区分创意，不得出现在画面中。`,
        "参考素材说明：第一张参考图是必须准确保持的带货商品；第二张参考图是 AI 为本套剧情生成的原创角色卡。严格沿用角色卡中的人物外貌和服装，不要交换两张参考图的用途，不要擅自替换核心角色。同套多集只固定剧情需要连续出现的人物；某一集无需让角色卡中的所有人强行出镜。不得参考、模仿或暗示任何明星、公众人物、影视角色或现有 IP。",
        seriesInstruction,
        `剧情玩法：${play.label}。${play.prompt}`,
        `商品植入：${placement.label}。${placement.prompt}`,
        `本集标题：${episodePlan.title}。本集剧本：${episodePlan.script}`,
        `本集视频生成指令：${episodePlan.videoPrompt}`,
        "单集时长上限为 15 秒。具体节奏和场景切换服从上述 AI 策划，不设置固定换场秒点；确保观众能在短时长内看懂人物行动、商品介入和剧情结果，商品不能中途突然变成脱离人物的硬广口播。",
        `这是本次第 ${index + 1}/${total} 个视频任务、第 ${creativeIndex + 1} 套创意。不同创意套数必须更换人物关系、场景、开场钩子和核心角度；同一套连续剧必须保持设定一致。`,
        "发布时需按平台要求标注 AI 生成、虚构演绎和营销信息。",
    ].join("\n\n");
}
