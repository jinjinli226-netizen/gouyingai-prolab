import type { ViralExecutionBeat, ViralMustKeepEvent, ViralRemakeTemplate } from "./viral-video-domain";

type DurationTemplate = Pick<ViralRemakeTemplate, "sourceDurationSeconds" | "targetDurationSeconds"> & {
    events: Array<Pick<ViralMustKeepEvent, "id" | "priority" | "targetStartSeconds" | "targetEndSeconds"> & Record<string, unknown>>;
    beats: Array<Pick<ViralExecutionBeat, "id" | "sourceEventId" | "startSeconds" | "endSeconds"> & Record<string, unknown>>;
};

export type ViralDurationRouteCapability = { maxSeconds: number; supportsContinuation: boolean };
export type ViralDurationPlan =
    | { status: "ready"; targetDurationSeconds: number; paidTaskCount: 1; strategy: "direct" | "continuation" | "compression"; segments: Array<{ startSeconds: number; endSeconds: number; durationSeconds: number }> }
    | { status: "blocked"; targetDurationSeconds: number; paidTaskCount: 0; strategy: "blocked"; segments: []; reason: string };

export function planViralDurationExecution(template: DurationTemplate, capability: ViralDurationRouteCapability, options: { targetDurationSeconds?: number; allowCompression?: boolean; minP0Seconds?: number } = {}): ViralDurationPlan {
    const targetDurationSeconds = positive(options.targetDurationSeconds) || positive(template.targetDurationSeconds) || positive(template.sourceDurationSeconds);
    if (!targetDurationSeconds) return blocked(0, "来源视频时长无效，无法创建完整成片任务");
    if (!positive(capability.maxSeconds)) return blocked(targetDurationSeconds, "当前视频路由没有有效的时长能力");
    if (targetDurationSeconds <= capability.maxSeconds + 0.000001) {
        return { status: "ready", targetDurationSeconds, paidTaskCount: 1, strategy: "direct", segments: [{ startSeconds: 0, endSeconds: targetDurationSeconds, durationSeconds: targetDurationSeconds }] };
    }
    if (capability.supportsContinuation) {
        const segments = [];
        for (let startSeconds = 0; startSeconds < targetDurationSeconds; startSeconds += capability.maxSeconds) {
            const endSeconds = Math.min(targetDurationSeconds, startSeconds + capability.maxSeconds);
            segments.push({ startSeconds, endSeconds, durationSeconds: endSeconds - startSeconds });
        }
        return { status: "ready", targetDurationSeconds, paidTaskCount: 1, strategy: "continuation", segments };
    }
    if (options.allowCompression === false) return blocked(targetDurationSeconds, `当前路由单条最多 ${capability.maxSeconds} 秒，且不支持连续扩展`);
    const compression = compressViralTemplateTimeline(template, capability.maxSeconds, { minP0Seconds: options.minP0Seconds ?? 0.75 });
    if (compression.status === "blocked") return blocked(targetDurationSeconds, compression.reason);
    return { status: "ready", targetDurationSeconds: capability.maxSeconds, paidTaskCount: 1, strategy: "compression", segments: [{ startSeconds: 0, endSeconds: capability.maxSeconds, durationSeconds: capability.maxSeconds }] };
}

export function compressViralTemplateTimeline<T extends DurationTemplate>(template: T, targetDurationSeconds: number, options: { minP0Seconds?: number } = {}): ({ status: "ready" } & T) | { status: "blocked"; reason: string } {
    const target = positive(targetDurationSeconds);
    if (!target) return { status: "blocked", reason: "目标时长必须大于 0" };
    const minP0Seconds = Math.max(0, options.minP0Seconds ?? 0.75);
    const p0Count = template.events.filter((event) => event.priority === "P0").length;
    if (p0Count * minP0Seconds > target + 0.000001) return { status: "blocked", reason: `目标时长不足以容纳 ${p0Count} 个 P0 事件（每个至少 ${minP0Seconds} 秒）` };
    const sourceDuration = positive(template.targetDurationSeconds) || positive(template.sourceDurationSeconds);
    if (!sourceDuration) return { status: "blocked", reason: "母版时长无效" };
    const sourceEvents = [...template.events].sort((left, right) => left.targetStartSeconds - right.targetStartSeconds);
    const originalDurations = sourceEvents.map((event) => Math.max(0.001, event.targetEndSeconds - event.targetStartSeconds));
    const floors = sourceEvents.map((event) => (event.priority === "P0" ? Math.min(minP0Seconds, target) : 0));
    const floorTotal = floors.reduce((sum, value) => sum + value, 0);
    const residualWeights = originalDurations.map((duration, index) => Math.max(0, duration - floors[index]));
    const residualTotal = residualWeights.reduce((sum, value) => sum + value, 0);
    let cursor = 0;
    const events = sourceEvents.map((event, index) => {
        const duration = floors[index] + (residualTotal ? ((target - floorTotal) * residualWeights[index]) / residualTotal : (target - floorTotal) / Math.max(1, sourceEvents.length));
        const start = cursor;
        cursor += duration;
        return { ...event, targetStartSeconds: start, targetEndSeconds: cursor };
    });
    if (events.length) events[events.length - 1].targetEndSeconds = target;
    const eventById = new Map(events.map((event) => [event.id, event]));
    const beats = template.beats.map((beat) => {
        const event = eventById.get(beat.sourceEventId);
        return event ? { ...beat, startSeconds: event.targetStartSeconds, endSeconds: event.targetEndSeconds } : { ...beat };
    });
    return { ...template, status: "ready", targetDurationSeconds: target, events, beats };
}

function positive(value: number | undefined): number {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function blocked(targetDurationSeconds: number, reason: string): ViralDurationPlan {
    return { status: "blocked", targetDurationSeconds, paidTaskCount: 0, strategy: "blocked", segments: [], reason };
}
