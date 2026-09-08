import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
    UNIVERSAL_CAPABILITY_REGISTRY,
    applyUniversalRemakeBindings,
    compileUniversalRemakeCandidates,
    createUniversalDirectorPromptRequest,
    createUniversalDirectorPromptRepairRequest,
    parseUniversalDirectorPromptPlan,
    planUniversalRemakeSegments,
    resolveUniversalRemakeBindings,
    compareUniversalRemakeFidelity,
} from "../src/lib/universal-viral-remake/index.ts";

const coverageFor = (facts) => UNIVERSAL_CAPABILITY_REGISTRY.map(({ family }) => {
    const factIds = facts.filter((fact) => fact.family === family).map((fact) => fact.id);
    return {
        family,
        status: factIds.length ? "observed" : "not-applicable",
        factIds,
        reason: factIds.length ? "原片可直接观察" : "本单元没有该类内容",
        importance: factIds.length ? "critical" : "supporting",
    };
});

function physicalTemplate() {
    const facts = [
        {
            id: "fact-pose",
            family: "pose-deformation",
            dimension: "蓄力姿态",
            predicate: "@actor 背向镜头前倾下蹲并连续发力颤抖",
            participantRoles: [{ placeholderId: "@actor", role: "动作主体" }],
            startSeconds: 0,
            endSeconds: 2.6,
            evidenceIds: ["native-video"],
            importance: "critical",
            confidence: 0.98,
            beforeState: "背向镜头站立",
            afterState: "前倾下蹲并保持身体下后方朝向镜头",
        },
        {
            id: "fact-path",
            family: "motion-path",
            dimension: "连续出现和下落路径",
            predicate: "@object 从 @actor 身体下后方逐渐出现，连续向下移动至 @receiver",
            participantRoles: [
                { placeholderId: "@object", role: "移动对象" },
                { placeholderId: "@actor", role: "来源主体" },
                { placeholderId: "@receiver", role: "接收对象" },
            ],
            startSeconds: 2.6,
            endSeconds: 5.3,
            evidenceIds: ["native-video"],
            importance: "critical",
            confidence: 0.98,
            beforeState: "@object 完全不可见",
            afterState: "@object 接触 @receiver",
        },
        {
            id: "fact-terminal",
            family: "state-transition",
            dimension: "接触后的终止状态",
            predicate: "@object 与 @receiver 接触后完成原片对应的可见结果",
            participantRoles: [
                { placeholderId: "@object", role: "目标物" },
                { placeholderId: "@receiver", role: "承接物" },
            ],
            startSeconds: 5.3,
            endSeconds: 8.033,
            evidenceIds: ["native-video"],
            importance: "critical",
            confidence: 0.96,
            beforeState: "刚刚接触",
            afterState: "完成终止状态",
        },
    ];
    const reconstruction = {
        schemaVersion: 3,
        id: "reconstruction-director",
        sourceVideoId: "source-video",
        durationSeconds: 8.033,
        aspectRatio: "9:16",
        entities: [
            { id: "actor", placeholderId: "@actor", kind: "other", identityFacts: "原片拟人主体", sourceAliases: ["原片拟人主体"], behavioralRole: "背向镜头发力", physicalInstanceCount: 1, evidenceIds: ["native-video"], confidence: 1 },
            { id: "object", placeholderId: "@object", kind: "prop", identityFacts: "原片被排出物", sourceAliases: ["原片被排出物"], behavioralRole: "从主体下后方出现", physicalInstanceCount: 1, evidenceIds: ["native-video"], confidence: 1 },
            { id: "receiver", placeholderId: "@receiver", kind: "prop", identityFacts: "原片承接物", sourceAliases: ["原片承接物"], behavioralRole: "承接目标物", physicalInstanceCount: 1, evidenceIds: ["native-video"], confidence: 1 },
        ],
        timelineUnits: [{
            id: "unit-1",
            sourceStartSeconds: 0,
            sourceEndSeconds: 8.033,
            parentShotIndex: 0,
            direction: "单镜头中主体背向镜头蓄力，目标物连续出现并到达承接物",
            structuralInvariants: [{ id: "single-take", dimension: "连续单镜头", description: "全程同一机位连续发生，禁止切镜头", participantPlaceholderIds: ["@actor", "@object", "@receiver"], evidenceIds: ["native-video"], importance: "critical", confidence: 0.99 }],
            eventFacts: facts,
            capabilityCoverage: coverageFor(facts),
            placeholderIds: ["@actor", "@object", "@receiver"],
            evidenceIds: ["native-video"],
            boundaryAfter: "none",
            safeContinuationPoints: [],
            startContinuity: { facts: [{ dimension: "初始构图", description: "主体背向镜头，承接物位于身体下方", participantPlaceholderIds: ["@actor", "@receiver"] }] },
            endContinuity: { facts: [{ dimension: "最终构图", description: "目标物完成与承接物的终止关系", participantPlaceholderIds: ["@object", "@receiver"] }] },
        }],
        canonicalPrompt: "单镜头连续复刻",
        evidence: [{ id: "native-video", atSeconds: 0, kind: "video", description: "完整连续原视频" }],
        verification: { status: "verified", confidence: 1, issues: [], repaired: false },
    };
    const replacements = [
        { id: "tiny-character", kind: "other", identityFacts: "米白与黑色蜘蛛纹理的Q版小人", referenceAssetIds: ["character-image"], confidence: 1 },
        { id: "phone-case", kind: "prop", identityFacts: "米白黑色蜘蛛纹理防摔手机壳", referenceAssetIds: ["case-image"], confidence: 1 },
        { id: "phone", kind: "prop", identityFacts: "唯一一台铜橙色智能手机", referenceAssetIds: ["phone-image"], confidence: 1 },
    ];
    const explicit = [
        { sourceEntityId: "actor", replacementEntityId: "tiny-character" },
        { sourceEntityId: "object", replacementEntityId: "phone-case" },
        { sourceEntityId: "receiver", replacementEntityId: "phone" },
    ];
    const bindings = resolveUniversalRemakeBindings(reconstruction.entities, replacements, explicit).bindings;
    const bound = applyUniversalRemakeBindings(reconstruction, replacements, bindings, []);
    const segmentPlan = planUniversalRemakeSegments(reconstruction, { maxDurationSeconds: 15 });
    assert.equal(segmentPlan.status, "ready");
    const fidelity = compareUniversalRemakeFidelity({ source: reconstruction, candidate: bound, patches: [] });
    assert.equal(fidelity.passed, true);
    return { id: "template-director", ...bound, segmentPlan, fidelity, patches: [] };
}

const validPlannerOutput = {
    segments: [{
        index: 0,
        roleLabels: { "@actor": "Q版小人", "@object": "手机壳", "@receiver": "手机" },
        promptTemplate: [
            "Duration: 8.033 seconds",
            "Aspect ratio: 9:16",
            "Style: 手机实拍、电影级写实、单镜头一镜到底、零切换",
            "",
            "VISUAL REFERENCES",
            "Q版小人：{{identity:@actor}}",
            "手机壳：{{identity:@object}}",
            "手机：{{identity:@receiver}}",
            "",
            "SCENE",
            "暖光木质桌面，固定机位，Q版小人背向镜头，手机平放在身体下方。",
            "",
            "TIME-CODED CONTINUOUS ACTION",
            "0-2.6s——Q版小人始终背向镜头，前倾下蹲并连续发力颤抖；手机壳完全不可见。",
            "2.6-5.3s——手机壳从Q版小人身体下后方逐渐露出，保持完整刚性，沿连续向下路径移动到唯一一台手机上方，全程不切镜头。",
            "5.3-8.033s——手机壳接触手机并顺势完整套入手机，最终只有一台手机和一个已安装的手机壳。",
            "",
            "NEGATIVE CONSTRAINTS",
            "禁止正面站立、禁止直接手持展示、禁止跳切、禁止复制手机或手机壳、禁止手机壳提前出现。",
        ].join("\n"),
        coveredFactIds: ["fact-pose", "fact-path", "fact-terminal"],
        targetTerminalState: "手机壳接触手机并顺势完整套入手机，最终只有一台手机和一个已安装的手机壳。",
    }],
};

describe("universal one-shot director prompt", () => {
    test("asks the planner for a natural generation prompt instead of an audit dump", () => {
        const prompt = createUniversalDirectorPromptRequest(physicalTemplate());

        assert.match(prompt, /Duration.*Aspect ratio.*Style/is);
        assert.match(prompt, /VISUAL REFERENCES.*SCENE.*SHOT BREAKDOWN.*NEGATIVE CONSTRAINTS/is);
        assert.match(prompt, /one continuous generation prompt/i);
        assert.match(prompt, /explicit target terminal state/i);
        assert.match(prompt, /critical fact IDs/i);
        assert.match(prompt, /identity:@actor/);
        assert.match(prompt, /不要输出.*能力覆盖|do not output.*capability coverage/i);
    });

    test("rejects a planner result that hides critical facts or leaves the target ending vague", () => {
        const missing = structuredClone(validPlannerOutput);
        missing.segments[0].coveredFactIds = ["fact-pose"];
        assert.throws(() => parseUniversalDirectorPromptPlan(missing, physicalTemplate()), /未覆盖.*fact-path|关键事实/);

        const vague = structuredClone(validPlannerOutput);
        vague.segments[0].targetTerminalState = "选择最接近的功能等价终止状态";
        vague.segments[0].promptTemplate = vague.segments[0].promptTemplate.replace(validPlannerOutput.segments[0].targetTerminalState, vague.segments[0].targetTerminalState);
        assert.throws(() => parseUniversalDirectorPromptPlan(vague, physicalTemplate()), /终止状态.*具体|模糊/);
    });

    test("does not trust covered fact IDs when the drafted prose reverses the verified orientation and path", () => {
        const contradicted = structuredClone(validPlannerOutput);
        contradicted.segments[0].promptTemplate = contradicted.segments[0].promptTemplate
            .replaceAll("背向镜头", "正向镜头")
            .replaceAll("身体下后方", "胸前")
            .replace("沿连续向下路径移动", "瞬间从正面掉落");

        const plan = parseUniversalDirectorPromptPlan(contradicted, physicalTemplate());
        const prompt = plan.segments[0].promptTemplate;

        assert.doesNotMatch(prompt, /正向镜头|胸前|瞬间从正面掉落/);
        assert.match(prompt, /背向镜头/);
        assert.match(prompt, /身体下后方逐渐出现/);
        assert.match(prompt, /连续向下移动/);
        assert.doesNotMatch(prompt, /fact-pose|fact-path|SOURCE EVENT GRAPH|置信度/);
    });

    test("does not repeat a whole-unit action summary inside every fact-locked time range", () => {
        const plan = parseUniversalDirectorPromptPlan(validPlannerOutput, physicalTemplate());
        const prompt = plan.segments[0].promptTemplate;
        const wholeUnitSummary = "单镜头中主体背向镜头蓄力，目标物连续出现并到达承接物";

        assert.equal(prompt.match(new RegExp(wholeUnitSummary, "g"))?.length ?? 0, 0);
        assert.match(prompt, /0-2\.6s.*背向镜头前倾下蹲并连续发力颤抖/);
        assert.match(prompt, /2\.6-5\.3s.*身体下后方逐渐出现.*连续向下移动/);
        assert.match(prompt, /5\.3-8\.033s.*手机壳.*手机.*接触后完成原片对应的可见结果/);
    });

    test("does not leak a future unit outcome into the opening scene or an uncovered lead-in range", () => {
        const template = physicalTemplate();
        template.timelineUnits[0].direction = "开场人物行走，未来爆炸结果和商品铺满地面";
        template.timelineUnits[0].startContinuity.facts = [];
        template.segmentPlan.segments[0].continuityIn.facts = [];
        template.timelineUnits[0].eventFacts[0].startSeconds = 1.8;

        const prompt = parseUniversalDirectorPromptPlan(validPlannerOutput, template).segments[0].promptTemplate;
        const executableSections = prompt.slice(0, prompt.indexOf("NEGATIVE CONSTRAINTS"));

        assert.doesNotMatch(executableSections, /未来爆炸结果|商品铺满地面/);
        assert.match(prompt, /0-1\.8s.*事件发生前状态.*背向镜头站立/);
        assert.match(prompt, /不得提前执行后续事件/);
    });

    test("keeps only scene entities used by the current segment in its SCENE section", () => {
        const template = physicalTemplate();
        template.entityManifest.push(
            { placeholderId: "@rail", sourceEntityId: "rail", kind: "scene", identityFacts: "乡村铁路", sourceAliases: ["铁路"], behavioralRole: "第一段场景", physicalInstanceCount: 1, referenceAssetIds: [] },
            { placeholderId: "@pool", sourceEntityId: "pool", kind: "scene", identityFacts: "泳池边", sourceAliases: ["泳池"], behavioralRole: "后续场景", physicalInstanceCount: 1, referenceAssetIds: [] },
        );
        template.timelineUnits[0].placeholderIds.push("@rail");
        const drafted = structuredClone(validPlannerOutput);
        drafted.segments[0].roleLabels = { ...drafted.segments[0].roleLabels, "@rail": "乡村铁路", "@pool": "泳池边" };
        drafted.segments[0].promptTemplate = drafted.segments[0].promptTemplate.replace(
            "手机：{{identity:@receiver}}",
            "手机：{{identity:@receiver}}\n乡村铁路：{{identity:@rail}}\n泳池边：{{identity:@pool}}",
        );

        const prompt = parseUniversalDirectorPromptPlan(drafted, template).segments[0].promptTemplate;
        const scene = prompt.slice(prompt.indexOf("SCENE"), prompt.indexOf("TIME-CODED CONTINUOUS ACTION"));

        assert.match(scene, /乡村铁路/);
        assert.doesNotMatch(scene, /泳池边/);
    });

    test("writes a concrete terminal state into the final timed action when the planner only paraphrases it", () => {
        const paraphrased = structuredClone(validPlannerOutput);
        paraphrased.segments[0].promptTemplate = paraphrased.segments[0].promptTemplate.replace(
            validPlannerOutput.segments[0].targetTerminalState,
            "手机壳接触后顺势安装完成，最后保持一个完整成品。",
        );

        const plan = parseUniversalDirectorPromptPlan(paraphrased, physicalTemplate());

        assert.match(plan.segments[0].promptTemplate, /5\.3-8\.033s.*手机壳接触手机并顺势完整套入手机/);
        assert.match(plan.segments[0].promptTemplate, /最终可见状态/);
    });

    test("rejects a prompt whose duration, aspect ratio, or local timecodes do not match the segment", () => {
        const wrongDuration = structuredClone(validPlannerOutput);
        wrongDuration.segments[0].promptTemplate = wrongDuration.segments[0].promptTemplate.replace("Duration: 8.033 seconds", "Duration: 15 seconds");
        assert.throws(() => parseUniversalDirectorPromptPlan(wrongDuration, physicalTemplate()), /时长.*不一致/);

        const wrongRatio = structuredClone(validPlannerOutput);
        wrongRatio.segments[0].promptTemplate = wrongRatio.segments[0].promptTemplate.replace("Aspect ratio: 9:16", "Aspect ratio: 16:9");
        assert.throws(() => parseUniversalDirectorPromptPlan(wrongRatio, physicalTemplate()), /画幅.*不一致/);

        const nonLocalTimeline = structuredClone(validPlannerOutput);
        nonLocalTimeline.segments[0].promptTemplate = nonLocalTimeline.segments[0].promptTemplate
            .replace("0-2.6s", "8.033-10.633s")
            .replace("2.6-5.3s", "10.633-13.333s")
            .replace("5.3-8.033s", "13.333-16.066s");
        assert.throws(() => parseUniversalDirectorPromptPlan(nonLocalTimeline, physicalTemplate()), /时间轴.*0 秒|本段时间轴/);
    });

    test("builds one strict repair request from the rejected draft and its exact validation error", () => {
        const request = createUniversalDirectorPromptRepairRequest(
            physicalTemplate(),
            "```json\n{\"segments\":[]}\n```",
            new Error("导演提示词分段数量与生成计划不一致"),
        );

        assert.match(request, /导演提示词分段数量与生成计划不一致/);
        assert.match(request, /\{\\"segments\\":\[\]\}/);
        assert.match(request, /corrected complete JSON/i);
        assert.match(request, /Duration.*Aspect ratio.*Style/is);
        assert.match(request, /SHOT BREAKDOWN|TIME-CODED CONTINUOUS ACTION/);
        assert.match(request, /Do not explain/i);
    });

    test("materializes a concise natural prompt and keeps batch identity substitution", () => {
        const template = physicalTemplate();
        template.directorPromptPlan = parseUniversalDirectorPromptPlan(validPlannerOutput, template);
        const candidates = compileUniversalRemakeCandidates(template, {
            count: 2,
            seed: 10,
            variableSlots: [{
                id: "case-color",
                targetPlaceholderId: "@object",
                options: [
                    { id: "white", identityFacts: "米白黑色蜘蛛纹理防摔手机壳", referenceAssetIds: ["white-case"] },
                    { id: "red", identityFacts: "鲜红蜂窝纹理蜘蛛主题防摔手机壳", referenceAssetIds: ["red-case"] },
                ],
            }],
        }, { modelId: "h3", maxDurationSeconds: 15, supportsContinuationFrame: true, generatesAudio: true });

        assert.match(candidates[0].segments[0].prompt, /米白黑色蜘蛛纹理防摔手机壳/);
        assert.match(candidates[1].segments[0].prompt, /鲜红蜂窝纹理蜘蛛主题防摔手机壳/);
        assert.match(candidates[0].segments[0].prompt, /TIME-CODED CONTINUOUS ACTION/);
        assert.match(candidates[0].segments[0].prompt, /手机壳接触手机并顺势完整套入手机/);
        assert.doesNotMatch(candidates[0].segments[0].prompt, /@actor|@object|@receiver|CAPABILITY COVERAGE|置信度|SOURCE-VERIFIED|UNIVERSAL VIRAL REMAKE/);
        assert.ok(candidates[0].segments[0].prompt.length < 2600);
    });

    test("uses the freshly fact-locked plan when compiling a persisted draft", () => {
        const template = physicalTemplate();
        const persistedDraft = structuredClone(validPlannerOutput);
        persistedDraft.segments[0].promptTemplate = persistedDraft.segments[0].promptTemplate.replace(
            /(\d+(?:\.\d+)?-\d+(?:\.\d+)?s——)/g,
            "$1单镜头中主体背向镜头蓄力，目标物连续出现并到达承接物；",
        );
        template.directorPromptPlan = persistedDraft;

        const [candidate] = compileUniversalRemakeCandidates(template, { count: 1, seed: 10, variableSlots: [] }, {
            modelId: "h3", maxDurationSeconds: 15, supportsContinuationFrame: true, generatesAudio: true,
        });

        assert.equal(candidate.segments[0].prompt.match(/单镜头中主体背向镜头蓄力，目标物连续出现并到达承接物/g)?.length ?? 0, 0);
    });

    test("revalidates a persisted director plan before a paid batch is compiled", () => {
        const template = physicalTemplate();
        template.directorPromptPlan = parseUniversalDirectorPromptPlan(validPlannerOutput, template);
        template.directorPromptPlan.segments[0].coveredFactIds = [];

        assert.throws(
            () => compileUniversalRemakeCandidates(template, { count: 1, seed: 1, variableSlots: [] }, { modelId: "h3", maxDurationSeconds: 15, supportsContinuationFrame: true, generatesAudio: true }),
            /关键事实|未覆盖/,
        );
    });
});
