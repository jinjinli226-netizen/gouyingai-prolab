import type {
    UniversalBoundaryKind,
    UniversalContinuityState,
    UniversalGenerationSegment,
    UniversalSegmentPlan,
    UniversalSourceReconstruction,
    UniversalTimelineUnit,
} from "./types";

const TIME_TOLERANCE_SECONDS = 0.001;

type SegmentSlice = {
    originalUnitId: string;
    sourceStartSeconds: number;
    sourceEndSeconds: number;
    boundaryAfter: UniversalBoundaryKind;
    continuityIn: UniversalContinuityState;
    continuityOut: UniversalContinuityState;
};

export function planUniversalRemakeSegments(
    reconstruction: UniversalSourceReconstruction,
    options: { maxDurationSeconds: number },
): UniversalSegmentPlan {
    const maxDurationSeconds = options.maxDurationSeconds;
    if (!Number.isFinite(maxDurationSeconds) || maxDurationSeconds <= 0) {
        return needsRefinement(maxDurationSeconds, ["视频模型最大时长必须是大于 0 的有限数字"]);
    }

    const timelineIssues = validateTimeline(reconstruction);
    if (timelineIssues.length) return needsRefinement(maxDurationSeconds, timelineIssues);

    const expanded = expandTimelineUnits(reconstruction.timelineUnits, maxDurationSeconds);
    if (expanded.issues.length) return needsRefinement(maxDurationSeconds, expanded.issues);

    const segments: UniversalGenerationSegment[] = [];
    let current: SegmentSlice[] = [];

    for (const slice of expanded.slices) {
        const nextDuration = current.length
            ? slice.sourceEndSeconds - current[0].sourceStartSeconds
            : slice.sourceEndSeconds - slice.sourceStartSeconds;
        if (current.length && nextDuration > maxDurationSeconds + TIME_TOLERANCE_SECONDS) {
            segments.push(buildSegment(segments.length, current));
            current = [];
        }
        current.push(slice);
    }
    if (current.length) segments.push(buildSegment(segments.length, current));

    return { status: "ready", maxDurationSeconds, segments, issues: [] };
}

function validateTimeline(reconstruction: UniversalSourceReconstruction): string[] {
    const issues: string[] = [];
    const units = reconstruction.timelineUnits;
    if (!units.length) return ["原片重建结果没有时间单元"];
    if (Math.abs(units[0].sourceStartSeconds) > TIME_TOLERANCE_SECONDS) issues.push("时间轴必须从 0 秒开始");

    units.forEach((unit, index) => {
        if (!unit.id.trim()) issues.push(`时间单元 ${index + 1} 缺少稳定 ID`);
        if (!Number.isFinite(unit.sourceStartSeconds) || !Number.isFinite(unit.sourceEndSeconds) || unit.sourceEndSeconds <= unit.sourceStartSeconds) {
            issues.push(`时间单元 ${unit.id || index + 1} 的起止时间无效`);
        }
        if (index > 0) {
            const previous = units[index - 1];
            if (Math.abs(previous.sourceEndSeconds - unit.sourceStartSeconds) > TIME_TOLERANCE_SECONDS) {
                issues.push(`时间单元 ${previous.id} 与 ${unit.id} 之间存在空洞或重叠`);
            }
        }
    });

    const finalEnd = units.at(-1)?.sourceEndSeconds ?? 0;
    if (Math.abs(finalEnd - reconstruction.durationSeconds) > TIME_TOLERANCE_SECONDS) {
        issues.push("时间轴没有连续覆盖到原片结尾");
    }
    return issues;
}

function expandTimelineUnits(units: UniversalTimelineUnit[], maxDurationSeconds: number): { slices: SegmentSlice[]; issues: string[] } {
    const slices: SegmentSlice[] = [];
    const issues: string[] = [];

    for (const unit of units) {
        let cursor = unit.sourceStartSeconds;
        let continuityIn = unit.startContinuity;
        const points = [...unit.safeContinuationPoints]
            .filter((point) => point.atSeconds > unit.sourceStartSeconds + TIME_TOLERANCE_SECONDS && point.atSeconds < unit.sourceEndSeconds - TIME_TOLERANCE_SECONDS)
            .sort((left, right) => left.atSeconds - right.atSeconds);

        while (unit.sourceEndSeconds - cursor > maxDurationSeconds + TIME_TOLERANCE_SECONDS) {
            const latestAllowed = cursor + maxDurationSeconds;
            const point = points.filter((candidate) => candidate.atSeconds > cursor + TIME_TOLERANCE_SECONDS && candidate.atSeconds <= latestAllowed + TIME_TOLERANCE_SECONDS).at(-1);
            if (!point) {
                issues.push(`时间单元 ${unit.id} 超过模型时长上限，且没有可用的安全延续点`);
                break;
            }
            slices.push({
                originalUnitId: unit.id,
                sourceStartSeconds: cursor,
                sourceEndSeconds: point.atSeconds,
                boundaryAfter: "continuous",
                continuityIn,
                continuityOut: point.continuity,
            });
            cursor = point.atSeconds;
            continuityIn = point.continuity;
        }

        if (issues.length) continue;
        slices.push({
            originalUnitId: unit.id,
            sourceStartSeconds: cursor,
            sourceEndSeconds: unit.sourceEndSeconds,
            boundaryAfter: unit.boundaryAfter,
            continuityIn,
            continuityOut: unit.endContinuity,
        });
    }

    return { slices: issues.length ? [] : slices, issues };
}

function buildSegment(index: number, slices: SegmentSlice[]): UniversalGenerationSegment {
    const first = slices[0];
    const last = slices.at(-1) ?? first;
    const timelineUnitIds = [...new Set(slices.map((slice) => slice.originalUnitId))];
    return {
        id: `segment-${index + 1}`,
        index,
        sourceStartSeconds: first.sourceStartSeconds,
        sourceEndSeconds: last.sourceEndSeconds,
        durationSeconds: last.sourceEndSeconds - first.sourceStartSeconds,
        timelineUnitIds,
        boundaryAfter: last.boundaryAfter,
        continuityIn: first.continuityIn,
        continuityOut: last.continuityOut,
    };
}

function needsRefinement(maxDurationSeconds: number, issues: string[]): UniversalSegmentPlan {
    return { status: "needs-refinement", maxDurationSeconds, segments: [], issues };
}

