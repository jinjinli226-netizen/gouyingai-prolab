export type ViralVideoGenerationSegment = {
    title: string;
    durationSeconds: number;
    prompt: string;
    shotPrompts: Array<{ index: number; prompt: string }>;
};

export type ViralVideoGenerationPlan = {
    title: string;
    originalityRules: string;
    productContinuity: string;
    elementPlan?: {
        characters: string;
        product: string;
        scenes: string;
        content: string;
    };
    continuityRules?: string;
    masterPrompt: string;
    segments: ViralVideoGenerationSegment[];
};

export function buildViralVideoMasterPrompt(
    masterPrompt: string,
    replacementBrief = "",
    replacementManifest = "",
) {
    const brief = replacementBrief.trim();
    const manifest = replacementManifest.trim();
    return [
        brief
            ? [
                "【用户改造要求（最高优先级，必须逐条执行）】",
                brief,
                "以上要求必须原样落实到动作、对象关系和最终结果中，不得省略、改回原片对象或被通用剧情替代。",
            ].join("\n")
            : "",
        manifest
            ? [
                "【已确认替换关系（硬约束）】",
                manifest,
                "所有已绑定对象必须按上述来源到替换对象的关系执行，禁止交换角色、混用参考图或继续使用被替换的原片对象。",
            ].join("\n")
            : "",
        "【AI 策划生成的完整成片提示词】",
        masterPrompt.trim(),
    ].filter(Boolean).join("\n\n");
}

export function viralVideoModelMaxDurationSeconds(modelName: string) {
    const value = modelName.trim();
    if (!/^minimax-h3-autodl(?:-|$)/i.test(value)) return 15;
    const variant = value.replace(/^minimax-h3-autodl-?/i, "");
    return /^(?:auto)$|15s|first-last|no-pic|lip-sync/i.test(variant) ? 15 : 10;
}

export function buildViralVideoSingleGeneration(
    plan: ViralVideoGenerationPlan,
    maxDurationSeconds: number,
    hasReplacementImages = true,
    replacementManifest = "",
) {
    const elementPlan = plan.elementPlan || {
        characters: plan.originalityRules,
        product: plan.productContinuity,
        scenes: "沿用完整主提示词中的统一场景方案。",
        content: "沿用完整主提示词中的统一内容方案。",
    };
    const continuityRules = plan.continuityRules?.trim() || `${plan.originalityRules.trim()} ${plan.productContinuity.trim()}`;
    const sourceDurationSeconds = plan.segments.reduce((total, segment) => total + segment.durationSeconds, 0);
    const durationSeconds = Math.min(maxDurationSeconds, Math.max(1, Math.ceil(sourceDurationSeconds - 0.000001)));
    const timeline = plan.segments
        .map((segment, segmentIndex) => [
            `【原片结构段 ${segmentIndex + 1}：${segment.title}】`,
            segment.prompt.trim(),
            segment.shotPrompts.map((shot) => `镜头 ${shot.index}：${shot.prompt.trim()}`).join("\n\n"),
        ].join("\n\n"))
        .join("\n\n");
    const compressionRule = sourceDurationSeconds > durationSeconds
        ? `原片结构总时长约 ${sourceDurationSeconds.toFixed(2)} 秒；本次必须在 ${durationSeconds} 秒内按比例压缩全部镜头节奏，保持镜头顺序、钩子和收束，不得拆成多条视频。`
        : `本次输出一条约 ${durationSeconds} 秒的完整视频，不得拆成多个分段文件。`;
    const replacementGuard = hasReplacementImages
        ? `上传的全部替换参考图按照以下绑定关系使用；同一对象的多张图片是同一身份或物体的多角度资料，不是多个变体，禁止跨对象混用：\n${replacementManifest || "由参考图内容自动匹配原片中的替换对象。"}\n人物必须保持身份、面孔、发型、体型和服装稳定；商品或道具必须保持包装轮廓、比例、颜色、材质、标签方向和可见标识稳定；场景必须保持空间结构、光线和关键陈设稳定。禁止商品漂浮、融化、拉伸、变形、复制、穿模、凭空出现或突然消失；其他物体遵守同样规则。人物拿取或使用时必须存在真实接触、遮挡和接触阴影，并符合重力与手部受力。`
        : "本次没有商品参考图，也没有其他替换素材；直接纯 AI 重建原片结构，只能使用重新生成的原创人物和无品牌通用对象，不得沿用或推断原片商品与品牌。所有对象必须符合真实重力、接触、遮挡和接触阴影，禁止漂浮、融化、拉伸、变形、复制、穿模、凭空出现或突然消失。";

    return {
        durationSeconds,
        prompt: [
            `【完整成片：${plan.title}】`,
            "【全片统一主提示词】",
            plan.masterPrompt.trim(),
            "【方案级固定元素】",
            `人物：${elementPlan.characters.trim()}\n商品/替换对象：${elementPlan.product.trim()}\n场景：${elementPlan.scenes.trim()}\n内容：${elementPlan.content.trim()}`,
            "【全片连续性规则】",
            continuityRules,
            "【强制原创换角规则】",
            plan.originalityRules.trim(),
            "原片人物只用于理解角色关系、动作位置和镜头功能，所有出镜人物必须重新选角并生成全新外貌、发型、服装和身体特征，不得沿用原片人物形象。人物数量和角色关系按剧本决定，不强制单一主角；同一人物跨镜头必须保持身份与造型稳定。",
            "【替换素材与商品一致性规则】",
            plan.productContinuity.trim(),
            replacementGuard,
            "【文字规则】",
            "视频模型只生成干净画面，禁止生成乱码字幕、伪文字、宣传标题或界面文字；所需文案留给后期叠加。",
            "【完整镜头结构】",
            timeline,
            "【单条成片硬约束】",
            compressionRule,
        ].join("\n\n"),
    };
}

export function buildViralVideoSingleGenerations(
    plans: ViralVideoGenerationPlan[],
    maxDurationSeconds: number,
    hasReplacementImages: boolean,
    replacementManifest = "",
) {
    return plans.map((plan) => buildViralVideoSingleGeneration(plan, maxDurationSeconds, hasReplacementImages, replacementManifest));
}
