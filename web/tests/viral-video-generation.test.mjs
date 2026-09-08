import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildViralVideoMasterPrompt, buildViralVideoSingleGeneration, buildViralVideoSingleGenerations, viralVideoModelMaxDurationSeconds } from "../src/lib/canvas/viral-video-generation.ts";
import { buildViralVideoPromptPlannerPrompt, parseViralVideoPromptPlan } from "../src/lib/canvas/viral-video-remake-workflow.ts";

describe("viral video single generation", () => {
    test("keeps the user's remake requirement verbatim at the top of the editable master prompt", () => {
        const requirement = "红色机器人拉出手机壳，并把手机壳完整安装到手机上。";
        const manifest = "参考图 1：原片人物「拟人生牛肉生物」 → 替换为「红色机器人」。";
        const prompt = buildViralVideoMasterPrompt("AI 策划生成的主提示词。", requirement, manifest);

        assert.ok(prompt.indexOf(requirement) < prompt.indexOf("AI 策划生成的主提示词"));
        assert.match(prompt, /用户改造要求（最高优先级，必须逐条执行）/);
        assert.match(prompt, /红色机器人拉出手机壳，并把手机壳完整安装到手机上/);
        assert.match(prompt, /原片人物「拟人生牛肉生物」 → 替换为「红色机器人」/);
    });

    test("limits AutoDL MiniMax H3 to one 10-second final task", () => {
        assert.equal(viralVideoModelMaxDurationSeconds("minimax-h3-autodl-multi-reference"), 10);
        assert.equal(viralVideoModelMaxDurationSeconds("other-video-model"), 15);
    });

    test("combines every source segment into exactly one paid video task", () => {
        const plan = {
            title: "爆款结构复刻",
            originalityRules: "把原片商务男性替换为全新原创女性创作者。",
            productContinuity: "商品包装、颜色与标签始终以商品参考图为准。",
            masterPrompt: "保持原片钩子、节奏和镜头顺序。",
            segments: [
                {
                    title: "动作开场",
                    durationSeconds: 12.45,
                    prompt: "人物完成开场动作。",
                    shotPrompts: [{ index: 1, prompt: "中景快速开场。" }],
                },
                {
                    title: "产品收束",
                    durationSeconds: 5.68,
                    prompt: "人物自然拿起商品完成收束。",
                    shotPrompts: [{ index: 2, prompt: "产品近景收尾。" }],
                },
            ],
        };
        const tasks = buildViralVideoSingleGenerations([plan], 15, true);
        const task = tasks[0];

        assert.equal(tasks.length, 1);
        assert.equal(task.durationSeconds, 15);
        assert.match(task.prompt, /动作开场/);
        assert.match(task.prompt, /产品收束/);
        assert.match(task.prompt, /镜头 1/);
        assert.match(task.prompt, /镜头 2/);
    });

    test("creates one paid task per creative plan instead of one per segment", () => {
        const makePlan = (title) => ({
            title,
            originalityRules: "全部人物重新生成。",
            productContinuity: "商品以参考图为唯一标准。",
            masterPrompt: "保留原片结构并完成原创替换。",
            segments: [
                { title: "开场", durationSeconds: 7, prompt: "开场动作。", shotPrompts: [{ index: 1, prompt: "原创人物完成开场动作，保持镜头稳定并建立清晰的商品展示动机。" }] },
                { title: "收束", durationSeconds: 7, prompt: "商品收束。", shotPrompts: [{ index: 2, prompt: "原创人物自然拿取商品完成收束，确保接触关系与商品形态稳定。" }] },
            ],
        });

        const tasks = buildViralVideoSingleGenerations([makePlan("创意 A"), makePlan("创意 B")], 15, true);

        assert.equal(tasks.length, 2);
        assert.match(tasks[0].prompt, /创意 A/);
        assert.match(tasks[1].prompt, /创意 B/);
    });

    test("submits character replacement and physical product consistency as hard constraints", () => {
        const task = buildViralVideoSingleGeneration({
            title: "换角带货",
            originalityRules: "所有人物均为新生成的原创角色，不沿用原片人物外貌。",
            productContinuity: "只使用商品参考图中的真实商品。",
            elementPlan: {
                characters: "固定为一名短发女性创作者，所有镜头保持同一面孔、服装与体态。",
                product: "固定使用参考图中的同一件商品。",
                scenes: "固定在同一间暖色厨房，空间方位不变。",
                content: "固定为发现问题、使用商品、展示结果的剧情。",
            },
            continuityRules: "人物、商品、服装、场景方位和动作承接跨镜头保持连续。",
            masterPrompt: "竖屏短视频。",
            segments: [
                {
                    title: "完整成片",
                    durationSeconds: 10,
                    prompt: "原创角色展示商品。",
                    shotPrompts: [{ index: 1, prompt: "角色手持商品。" }],
                },
            ],
        }, 15, true);

        assert.match(task.prompt, /所有人物均为新生成的原创角色/);
        assert.match(task.prompt, /只使用商品参考图中的真实商品/);
        assert.match(task.prompt, /人物数量和角色关系按剧本决定/);
        assert.match(task.prompt, /禁止商品漂浮、融化、拉伸、变形、复制/);
        assert.match(task.prompt, /真实接触、遮挡和接触阴影/);
        assert.match(task.prompt, /禁止生成乱码字幕/);
        assert.match(task.prompt, /固定为一名短发女性创作者/);
        assert.match(task.prompt, /固定使用参考图中的同一件商品/);
        assert.match(task.prompt, /固定在同一间暖色厨房/);
        assert.match(task.prompt, /发现问题、使用商品、展示结果/);
        assert.match(task.prompt, /人物、商品、服装、场景方位和动作承接跨镜头保持连续/);
    });

    test("does not claim an uploaded product reference when none exists", () => {
        const task = buildViralVideoSingleGeneration({
            title: "无商品替换",
            originalityRules: "全部人物重新生成。",
            productContinuity: "使用无品牌通用对象。",
            masterPrompt: "竖屏短视频。",
            segments: [{ title: "完整成片", durationSeconds: 8, prompt: "原创画面。", shotPrompts: [{ index: 1, prompt: "原创镜头。" }] }],
        }, 15, false);

        assert.doesNotMatch(task.prompt, /上传的商品图是唯一商品视觉标准/);
        assert.match(task.prompt, /本次没有商品参考图/);
        assert.match(task.prompt, /不得沿用或推断原片商品与品牌/);
    });

    test("treats an uploaded image as a generic replacement element instead of product-only input", () => {
        const analysis = {
            title: "街头反转",
            durationSeconds: 8,
            aspectRatio: "9:16",
            hook: "人物突然发现异常",
            narrativeStructure: "发现-反转",
            editRhythm: "快速",
            visualStyle: "纪实",
            soundStrategy: "环境音",
            transferableCore: "动作反转",
            shots: [{
                index: 1,
                parentShotIndex: 1,
                startSeconds: 0,
                endSeconds: 8,
                durationSeconds: 8,
                boundaryType: "first",
                boundaryReason: "视频开始时人物发现异常",
                startState: "人物空手站在街头",
                endState: "人物拿起道具并面向镜头",
                continuityFromPrevious: "首段",
                frameDescription: "人物在街头拿起道具",
                scene: "街头",
                characters: "一名人物",
                action: "拿起道具",
                dialogue: "",
                visibleText: "",
                narrativePurpose: "制造反转",
                shotSize: "中景",
                composition: "中心构图",
                cameraAngle: "平视",
                lensAndFocus: "主体清晰",
                cameraMovement: "跟拍",
                lightingAndColor: "日光",
                transition: "",
                musicAndSound: "环境音",
                replaceableElements: "人物、场景、道具",
                structuralMustKeep: "动作顺序",
            }],
        };

        const prompt = buildViralVideoPromptPlannerPrompt({
            analysis,
            replacementBrief: "",
            hasProductImage: true,
            maxSegmentSeconds: 15,
            variantIndex: 0,
            totalVariants: 1,
            generationSeed: 1,
        });

        assert.match(prompt, /商品、人物、场景或道具/);
        assert.match(prompt, /按替换对象分组/);
        assert.match(prompt, /不得把不同对象的参考图混用/);
        assert.match(prompt, /镜头\/动作节拍 1｜真实镜头 1/);
        assert.match(prompt, /开始=人物空手站在街头；结束=人物拿起道具并面向镜头/);
        assert.match(prompt, /承接上一节拍=首段/);
        assert.match(prompt, /elementPlan/);
        assert.match(prompt, /characters/);
        assert.match(prompt, /product/);
        assert.match(prompt, /scenes/);
        assert.match(prompt, /content/);
        assert.match(prompt, /continuityRules/);
        assert.match(prompt, /所有镜头必须继承同一套元素方案/);
        assert.match(prompt, /禁止每个镜头重新设计人物、商品、场景或内容/);
        assert.doesNotMatch(prompt, /商品图是唯一的商品事实来源/);
    });

    test("allows a source shot longer than the model limit so the final task can compress it", () => {
        const analysis = {
            title: "20 秒一镜到底",
            durationSeconds: 20,
            aspectRatio: "9:16",
            hook: "人物连续展示",
            narrativeStructure: "单镜头完成",
            editRhythm: "连续动作",
            visualStyle: "真实摄影",
            soundStrategy: "",
            transferableCore: "单镜头动作结构",
            shots: [{
                index: 1,
                startSeconds: 0,
                endSeconds: 20,
                durationSeconds: 20,
                frameDescription: "人物连续完成展示动作",
                scene: "室内",
                characters: "一名原创角色",
                action: "连续展示",
                dialogue: "",
                visibleText: "",
                narrativePurpose: "完成全部展示",
                shotSize: "中景",
                composition: "中心构图",
                cameraAngle: "平视",
                lensAndFocus: "主体清晰",
                cameraMovement: "固定",
                lightingAndColor: "自然光",
                transition: "",
                musicAndSound: "",
                replaceableElements: "人物与商品",
                structuralMustKeep: "连续动作",
            }],
        };

        assert.doesNotThrow(() => buildViralVideoPromptPlannerPrompt({ analysis, replacementBrief: "全部原创替换", hasProductImage: true, maxSegmentSeconds: 15, variantIndex: 0, totalVariants: 1, generationSeed: "test" }));
        const parsed = parseViralVideoPromptPlan(JSON.stringify({
            title: "单镜头压缩版",
            originalityRules: "重新生成全部人物。",
            productContinuity: "商品以参考图为准。",
            elementPlan: {
                characters: "固定原创人物。",
                product: "固定参考商品。",
                scenes: "固定室内场景。",
                content: "固定连续展示内容。",
            },
            continuityRules: "人物、商品和空间连续。",
            masterPrompt: "将完整结构压缩为单条成片。",
            shotPrompts: [{ index: 1, prompt: "在单条竖屏成片中完整保留人物连续展示的动作顺序、中心构图、平视机位与自然光质感，并按比例压缩节奏。" }],
            segments: [{ title: "完整结构", shotIndexes: [1], durationSeconds: 20, prompt: "保留整段连续动作。" }],
        }), analysis, 15);
        assert.equal(parsed.segments[0].durationSeconds, 20);
        assert.deepEqual(parsed.elementPlan, {
            characters: "固定原创人物。",
            product: "固定参考商品。",
            scenes: "固定室内场景。",
            content: "固定连续展示内容。",
        });
        assert.equal(parsed.continuityRules, "人物、商品和空间连续。");
    });
});
