import type { UniversalCapabilityFamily, UniversalTimelineUnit } from "./types";

export type UniversalCapabilityDefinition = {
    family: UniversalCapabilityFamily;
    label: string;
    inspectFor: readonly string[];
};

export const UNIVERSAL_CAPABILITY_REGISTRY: readonly UniversalCapabilityDefinition[] = [
    {
        family: "entity-identity",
        label: "实体与身份",
        inspectFor: ["稳定实体", "物理实例数量", "多视角与多实例区分", "身份外观", "行为角色"],
    },
    {
        family: "temporal-boundary",
        label: "时间与事件边界",
        inspectFor: ["开始", "结束", "动作发生点", "接触与释放时刻", "并发关系", "节奏"],
    },
    {
        family: "spatial-geometry",
        label: "空间几何",
        inspectFor: ["画面区域", "深度顺序", "相对位置", "朝向", "来源区域", "目标区域", "构图比例"],
    },
    {
        family: "pose-deformation",
        label: "姿态与形变",
        inspectFor: ["主体姿态", "关节状态", "弯曲", "旋转", "压缩", "拉伸", "形变过程"],
    },
    {
        family: "motion-path",
        label: "运动与路径",
        inspectFor: ["运动主体", "受作用对象", "方向", "路径", "速度变化", "连续性", "释放与稳定"],
    },
    {
        family: "relation-contact",
        label: "关系与接触",
        inspectFor: ["接触", "抓取", "拉推", "进入离开", "附着分离", "碰撞遮挡", "可见因果"],
    },
    {
        family: "state-transition",
        label: "状态变化",
        inspectFor: ["出现消失", "位置变化", "包含关系", "装配关系", "物理状态", "终止状态"],
    },
    {
        family: "camera-edit",
        label: "镜头与剪辑",
        inspectFor: ["景别", "机位", "角度", "运镜", "焦点", "剪辑", "转场", "连续性"],
    },
    {
        family: "scene-treatment",
        label: "场景与画面处理",
        inspectFor: ["环境", "光线", "色彩", "材质", "氛围", "视觉特效", "连续背景"],
    },
    {
        family: "text-audio",
        label: "文字与声音",
        inspectFor: ["画面文字", "对白", "旁白", "音效", "音乐", "视听同步", "结构性静音"],
    },
] as const;

export const UNIVERSAL_CAPABILITY_FAMILIES = UNIVERSAL_CAPABILITY_REGISTRY.map((item) => item.family);

export function hasCompleteUniversalCapabilityCoverage(unit: Pick<UniversalTimelineUnit, "eventFacts" | "capabilityCoverage">): boolean {
    if (!Array.isArray(unit.eventFacts) || !Array.isArray(unit.capabilityCoverage)) return false;
    if (unit.capabilityCoverage.length !== UNIVERSAL_CAPABILITY_FAMILIES.length) return false;
    const factById = new Map(unit.eventFacts.map((fact) => [fact.id, fact]));
    const seen = new Set<string>();
    for (const coverage of unit.capabilityCoverage) {
        if (!coverage || !UNIVERSAL_CAPABILITY_FAMILIES.includes(coverage.family) || seen.has(coverage.family)) return false;
        if (!["observed", "not-observed", "not-applicable", "uncertain"].includes(coverage.status)) return false;
        if (!Array.isArray(coverage.factIds) || !coverage.reason?.trim() || !["critical", "supporting"].includes(coverage.importance)) return false;
        if (coverage.status === "observed") {
            if (!coverage.factIds.length || coverage.factIds.some((id) => factById.get(id)?.family !== coverage.family)) return false;
        } else if (coverage.factIds.length) return false;
        if (coverage.status === "uncertain" && coverage.importance === "critical") return false;
        seen.add(coverage.family);
    }
    return unit.eventFacts.every((fact) => unit.capabilityCoverage.some((coverage) => coverage.status === "observed" && coverage.factIds.includes(fact.id)));
}
