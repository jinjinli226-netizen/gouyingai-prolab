import { nanoid } from "nanoid";

import { NODE_DEFAULT_SIZE } from "@/constant/canvas";
import { CanvasNodeType, type CanvasNodeData, type JewelryProductImageType, type JewelryProductWorkflowState } from "@/types/canvas";

export const jewelryProductImageOptions: Array<{ value: JewelryProductImageType; label: string; description: string }> = [
    { value: "hero", label: "商品首图", description: "奶油白缎面高端珠宝商业摄影" },
    { value: "side", label: "侧面图", description: "清晰呈现戒托、爪镶与戒臂侧面" },
    { value: "back", label: "背面图", description: "展示戒指底部、内圈和背面结构" },
    { value: "upright", label: "立式侧面", description: "戒指立起展示整体高度与结构" },
    { value: "handheld", label: "手持展示", description: "手指轻捏戒指的微距细节图" },
    { value: "box", label: "戒指盒图", description: "无 Logo 浅色戒指盒陈列" },
    { value: "wearing", label: "佩戴图", description: "自然佩戴或替换可选姿势参考中的戒指" },
    { value: "gesture", label: "手势变体", description: "新的自然佩戴手势，保持商品一致" },
    { value: "sketch", label: "设计线稿", description: "灰白草稿纸上的黑白铅笔设计稿" },
];

export const defaultJewelryProductImageTypes = jewelryProductImageOptions.map((item) => item.value);

export function buildJewelryProductWorkflowProject() {
    const productNodeId = nanoid();
    const heroTemplateNodeId = nanoid();
    const wearingReferenceNodeId = nanoid();
    const imageSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
    const nodes: CanvasNodeData[] = [
        buildUploadNode(productNodeId, "上传戒指商品原图（必填）", 260, 180, imageSpec.width, imageSpec.height),
        buildUploadNode(heroTemplateNodeId, "可选：上传首图背景模板", 260, 620, imageSpec.width, imageSpec.height),
        buildUploadNode(wearingReferenceNodeId, "可选：上传佩戴姿势参考", 260, 1060, imageSpec.width, imageSpec.height),
    ];
    const workflow: JewelryProductWorkflowState = {
        kind: "jewelry-product-images",
        productNodeId,
        heroTemplateNodeId,
        wearingReferenceNodeId,
        outputTypes: defaultJewelryProductImageTypes,
        batchCount: 1,
    };
    return { title: "AI 珠宝商品图", nodes, connections: [], workflow, viewport: { x: 100, y: 90, k: 0.68 } };
}

export function buildJewelryProductPrompt(type: JewelryProductImageType, variantIndex: number, hasHeroTemplate: boolean, hasWearingReference: boolean) {
    const option = jewelryProductImageOptions.find((item) => item.value === type)!;
    const sourceGuide = [
        "参考图1是需要销售的真实戒指商品，也是商品外观的唯一事实来源。精确保持主石切割形状、主石比例、镶口和爪数、配石数量与位置、戒臂轮廓、金属颜色、厚度和所有可见结构，不得重新设计、简化、增删或替换商品。",
        hasHeroTemplate && type === "hero" ? "参考图2只用于首图的背景、构图、缎面材质与光线关系；必须删除其中原有戒指并换成参考图1的戒指，不得混合两枚戒指的任何结构。" : "",
        hasWearingReference && (type === "wearing" || type === "gesture")
            ? "参考图2只用于手部姿势、视角和画面关系；移除其中原有戒指并准确替换为参考图1的戒指，不得继承原戒指的宝石、戒托或戒臂。"
            : "",
    ]
        .filter(Boolean)
        .join(" ");
    const taskPrompt: Record<JewelryProductImageType, string> = {
        hero: "生成真实感十足的戒指商品首图。若提供背景模板，严格沿用模板的背景、构图和光线；否则使用精致奶油白或浅米白缎面微距场景，褶皱自然，柔和温暖侧光，浅景深，细腻珠光质感。戒指略低于画面中心，单枚戒指，正面英雄角度，对焦锐利，最大限度展现宝石火彩和金属光泽，极简奢华的高端珠宝商业摄影。",
        side: "生成同一枚戒指的纯侧面 Etsy 商品图，清晰展示主石高度、镶爪、戒托、配石和戒臂结构。单枚戒指、单一侧面视角，置于奶油白或浅米白缎面，构图干净，柔和暖侧光，浅景深，珠宝微距商业摄影。",
        back: "生成同一枚戒指的背面与底部 Etsy 商品图，清晰展示内圈、戒托底部、镶嵌背面和戒臂闭合结构。单枚戒指、单一背面视角，不出现任何数字或符号，奶油白缎面背景，柔和暖光，微距写实商业摄影。",
        upright: "让同一枚戒指稳定立起，生成立式侧面 Etsy 商品图，完整呈现戒圈、戒托高度、宝石厚度与侧面结构。单枚戒指、单一视角，奶油白缎面背景，柔和暖光和真实接触阴影，微距写实商业摄影。",
        handheld: "生成一只自然真实的手用指尖轻轻捏住同一枚戒指的商品展示图，微距聚焦戒指，手部只作为比例与使用情境，不遮挡主石、镶爪和戒臂关键细节。皮肤真实、手指结构正确、背景简洁、高端珠宝商业摄影。",
        box: "将同一枚戒指自然陈列在一个浅色、无品牌、无 Logo 的高级戒指盒中，盒体为象牙白或浅米色柔软材质，微距聚焦戒指细节，构图克制，柔和暖光，真实接触阴影和高端珠宝商业摄影质感。",
        wearing: "生成同一枚戒指自然佩戴在无名指上的真实佩戴图。若提供手部参考，沿用其手势、视角与构图并准确替换原戒指；否则生成简洁自然的优雅手部姿势。戒指尺寸和透视必须与手指吻合，不悬浮、不穿模，重点清晰展示商品。",
        gesture: "生成另一种自然的戒指佩戴手势，与普通平铺手背姿势明显不同，但仍清晰展示同一枚戒指。可以轻微弯曲手指或采用生活化展示动作，保持戒指设计、尺寸和全部细节不变，手部解剖准确，画面真实简洁。",
        sketch: "把同一枚戒指准确转化为专业黑白铅笔珠宝设计稿，保留主石切割轮廓、镶爪、配石、戒托和戒臂结构。使用细腻铅笔线、结构辅助线和轻微明暗排线，灰白色草稿纸背景，单枚戒指，1:1 构图，不增加文字标注。",
    };
    return [
        sourceGuide,
        taskPrompt[type],
        `这是第 ${variantIndex + 1} 套结果，只允许改变镜头和细微摆放，不得改变商品设计。`,
        "统一成品要求：1:1 方图，2K 级清晰度，写实细节，适合 Etsy 等电商平台。画面只能有一枚目标戒指；不要文字、数字、符号、品牌、Logo、水印、价格、标签、边框或拼图；不要多余戒指、重复宝石、改变主石形状、改变金属颜色、错误镶爪、畸形手指、融合手指、悬浮或穿模。",
        `任务名称：${option.label}。直接输出成品图片，不要输出说明。`,
    ].join("\n\n");
}

function buildUploadNode(id: string, title: string, x: number, y: number, width: number, height: number): CanvasNodeData {
    return { id, type: CanvasNodeType.Image, title, position: { x, y }, width, height, metadata: { content: "", status: "idle" } };
}
