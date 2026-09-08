import { CanvasNodeType } from "@/types/canvas";

export function reversePromptPreset(type: CanvasNodeType.Image | CanvasNodeType.Video) {
    if (type === CanvasNodeType.Video) {
        return `你是一名影视分镜导演和 AI 视频提示词专家。请以参考视频本身的实际画面为唯一依据，完整观看后反推出可复刻其叙事、镜头和节奏的视频生成脚本。

严格要求：
1. 不要只概述首尾画面；必须按真实切镜头和时间顺序覆盖整段视频。
2. 输出“逐镜头分镜表”，每个独立镜头单独一项。分镜条数由真实剪辑决定，不要根据预设时长或固定数量硬拆。
3. 每个分镜必须包含：时间段、时长、景别与构图、主体与动作、场景与道具、运镜与焦点、光线与色彩、声音或氛围、转场方式、该镜头的可直接生成提示词。
4. 最后输出“整片复刻主提示词”，将人物/主体一致性、关键动作、镜头运动、节奏、画风和声音氛围整合成一条可用于 AI 视频生成的完整提示词。
5. 不要解释分析方法，不要省略中段，不要用“若干镜头”合并描述；视频中没有的信息不要臆测。`;
    }
    return `请根据参考图片反推一段适合用于 AI 生图的提示词。

要求：
1. 只输出提示词正文，不要解释。
2. 覆盖主体、构图、风格、光线、色彩、材质、镜头和氛围。
3. 尽量写成可直接用于生图模型的完整提示词。`;
}

export function reversePromptReferenceLabel(type: CanvasNodeType.Image | CanvasNodeType.Video) {
    return type === CanvasNodeType.Video ? "参考视频" : "参考图片";
}
