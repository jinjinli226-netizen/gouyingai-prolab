import {
    VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
    type ViralEventFunction,
    type ViralEventPriority,
    type ViralMustKeepEvent,
    type ViralObjectFingerprint,
    type ViralObjectKind,
    type ViralObjectRole,
    type ViralSourceEvidence,
} from "./viral-video-domain";

export type ViralVideoSourceRecognition = {
    objects: ViralObjectFingerprint[];
    mustKeepEvents: ViralMustKeepEvent[];
    sourceEvidence: ViralSourceEvidence[];
    audioEvidenceAvailable: boolean;
};

const objectKinds = new Set<ViralObjectKind>(["product", "person", "scene", "vehicle", "wardrobe", "animal", "prop"]);
const objectRoles = new Set<ViralObjectRole>(["hero-product", "supporting-object", "character", "environment"]);
const fallbackObjectKindByRole: Record<ViralObjectRole, ViralObjectKind> = {
    "hero-product": "product",
    "supporting-object": "prop",
    character: "person",
    environment: "scene",
};
const eventPriorities = new Set<ViralEventPriority>(["P0", "P1", "P2"]);
const eventFunctions = new Set<ViralEventFunction>(["hook", "spectacle", "reveal", "product_proof", "cta", "transition", "context", "other"]);

export function buildViralVideoEvidenceFrameTimes(durationSeconds: number, maxFrames = 24, visualChangeCandidates: number[] = []): number[] {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(maxFrames) || maxFrames < 1) return [];
    const limit = Math.max(1, Math.floor(maxFrames));
    const endSeconds = Number(Math.max(0, durationSeconds - 0.01).toFixed(3));
    const prioritized = [
        0,
        endSeconds,
        ...visualChangeCandidates,
        Math.min(endSeconds, 0.25),
        Math.min(endSeconds, 0.6),
        Math.min(endSeconds, 1.2),
        durationSeconds * 0.25,
        durationSeconds * 0.5,
        durationSeconds * 0.75,
    ];
    const selected = new Set<number>();
    for (const value of prioritized) {
        if (selected.size >= limit) break;
        if (!Number.isFinite(value) || value < 0 || value > durationSeconds) continue;
        selected.add(Number(Math.min(endSeconds, value).toFixed(3)));
    }
    const fillCount = Math.max(limit * 2, Math.ceil(durationSeconds * 2) + 1);
    for (let index = 0; index < fillCount && selected.size < limit; index += 1) {
        selected.add(Number(((endSeconds * index) / Math.max(1, fillCount - 1)).toFixed(3)));
    }
    return [...selected].sort((left, right) => left - right);
}

export function parseViralVideoSourceRecognition(value: unknown, sourceDurationSeconds: number): ViralVideoSourceRecognition {
    if (!Number.isFinite(sourceDurationSeconds) || sourceDurationSeconds <= 0) throw new Error("sourceDurationSeconds 必须大于 0");
    const record = requireRecord(value, "原片结构化识别");
    const audioEvidenceAvailable = record.audioEvidenceAvailable === true;
    const sourceEvidence = parseEvidence(record.sourceEvidence, sourceDurationSeconds, audioEvidenceAvailable);
    const evidenceIds = new Set(sourceEvidence.map((evidence) => evidence.id));
    const objects = parseObjects(record.objects);
    const objectIds = new Set(objects.map((object) => object.id));
    const mustKeepEvents = parseEvents(record.mustKeepEvents, sourceDurationSeconds, objectIds, evidenceIds);
    return { objects, mustKeepEvents, sourceEvidence, audioEvidenceAvailable };
}

export function findViralVideoSourceRecognitionQualityIssues(recognition: ViralVideoSourceRecognition, sourceDurationSeconds: number): string[] {
    const issues: string[] = [];
    const events = recognition.mustKeepEvents;
    const p0Events = events.filter((event) => event.priority === "P0");
    if (!recognition.objects.some((object) => object.kind === "product" && object.role === "hero-product")) issues.push("缺少可确认的核心商品对象指纹");
    if (!p0Events.some((event) => event.function === "hook" && event.sourceStartSeconds <= 0.1)) issues.push("缺少覆盖视频开头的 P0 钩子事件");
    if (!p0Events.some((event) => event.function === "spectacle")) issues.push("缺少 P0 核心视觉爆点事件");
    if (!p0Events.some((event) => event.function === "product_proof")) issues.push("缺少 P0 商品证明事件");
    if (!events.length || sourceDurationSeconds - events[events.length - 1].sourceEndSeconds > 0.5) issues.push("必保事件未覆盖原片结尾");
    if (recognition.audioEvidenceAvailable && !recognition.sourceEvidence.some((evidence) => evidence.kind === "audio" || evidence.kind === "transcript")) issues.push("已声明音轨可用但缺少声音证据");
    return [...new Set(issues)];
}

function parseEvidence(value: unknown, durationSeconds: number, audioEvidenceAvailable: boolean): ViralSourceEvidence[] {
    if (!Array.isArray(value)) throw new Error("sourceEvidence 必须是数组");
    const seen = new Set<string>();
    return value.map((item, index) => {
        const record = requireRecord(item, `sourceEvidence[${index}]`);
        const id = nonEmptyString(record.id, `sourceEvidence[${index}].id`);
        if (seen.has(id)) throw new Error(`sourceEvidence[${index}].id 重复`);
        seen.add(id);
        const kind = enumValue(record.kind === "sound" ? "audio" : record.kind, ["frame", "audio", "subtitle", "transcript"] as const, `sourceEvidence[${index}].kind`);
        if (!audioEvidenceAvailable && (kind === "audio" || kind === "transcript")) throw new Error("采样帧分析不得返回音频证据");
        const startSeconds = boundedNumber(record.startSeconds, 0, durationSeconds, `sourceEvidence[${index}].startSeconds`);
        const endSeconds = record.endSeconds === undefined ? undefined : boundedNumber(record.endSeconds, startSeconds, durationSeconds, `sourceEvidence[${index}].endSeconds`);
        return {
            schemaVersion: VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
            id,
            kind,
            startSeconds,
            endSeconds,
            assetId: optionalString(record.assetId),
            description: stringValue(record.description, `sourceEvidence[${index}].description`),
            confidence: boundedNumber(record.confidence, 0, 1, `sourceEvidence[${index}].confidence`),
        };
    });
}

function parseObjects(value: unknown): ViralObjectFingerprint[] {
    if (!Array.isArray(value) || !value.length) throw new Error("objects 至少需要一个对象");
    const seen = new Set<string>();
    return value.map((item, index) => {
        const record = requireRecord(item, `objects[${index}]`);
        const id = nonEmptyString(record.id, `objects[${index}].id`);
        if (seen.has(id)) throw new Error(`objects[${index}].id 重复`);
        seen.add(id);
        const visualFacts = requireRecord(record.visualFacts, `objects[${index}].visualFacts`);
        const role = nonEmptyString(record.role, `objects[${index}].role`) as ViralObjectRole;
        if (!objectRoles.has(role)) throw new Error(`objects[${index}].role 无效`);
        const rawKind = nonEmptyString(record.kind, `objects[${index}].kind`) as ViralObjectKind;
        const kind = objectKinds.has(rawKind) ? rawKind : fallbackObjectKindByRole[role];
        return {
            schemaVersion: VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
            id,
            origin: "source-video",
            kind,
            name: nonEmptyString(record.name, `objects[${index}].name`),
            role,
            visualFacts: {
                colors: stringArray(visualFacts.colors, `objects[${index}].visualFacts.colors`),
                materials: stringArray(visualFacts.materials, `objects[${index}].visualFacts.materials`),
                shape: stringValue(visualFacts.shape, `objects[${index}].visualFacts.shape`),
                markings: stringArray(visualFacts.markings, `objects[${index}].visualFacts.markings`),
                packaging: stringValue(visualFacts.packaging, `objects[${index}].visualFacts.packaging`),
                distinctiveFeatures: stringArray(visualFacts.distinctiveFeatures, `objects[${index}].visualFacts.distinctiveFeatures`),
            },
            functionalFacts: stringArray(record.functionalFacts, `objects[${index}].functionalFacts`),
            shotIndexes: integerArray(record.shotIndexes, `objects[${index}].shotIndexes`),
            referenceAssetIds: stringArray(record.referenceAssetIds, `objects[${index}].referenceAssetIds`),
            representativeFrameIds: stringArray(record.representativeFrameIds, `objects[${index}].representativeFrameIds`),
            confidence: boundedNumber(record.confidence, 0, 1, `objects[${index}].confidence`),
        };
    });
}

function parseEvents(value: unknown, durationSeconds: number, objectIds: Set<string>, evidenceIds: Set<string>): ViralMustKeepEvent[] {
    if (!Array.isArray(value) || !value.length) throw new Error("mustKeepEvents 至少需要一个事件");
    const seen = new Set<string>();
    let previousStart = -1;
    return value.map((item, index) => {
        const record = requireRecord(item, `mustKeepEvents[${index}]`);
        const id = nonEmptyString(record.id, `mustKeepEvents[${index}].id`);
        if (seen.has(id)) throw new Error(`mustKeepEvents[${index}].id 重复`);
        seen.add(id);
        const priority = nonEmptyString(record.priority, `mustKeepEvents[${index}].priority`) as ViralEventPriority;
        const eventFunction = nonEmptyString(record.function, `mustKeepEvents[${index}].function`) as ViralEventFunction;
        if (!eventPriorities.has(priority)) throw new Error(`mustKeepEvents[${index}].priority 无效`);
        if (!eventFunctions.has(eventFunction)) throw new Error(`mustKeepEvents[${index}].function 无效`);
        const sourceStartSeconds = boundedNumber(record.sourceStartSeconds, 0, durationSeconds, `mustKeepEvents[${index}].sourceStartSeconds`);
        const sourceEndSeconds = boundedNumber(record.sourceEndSeconds, sourceStartSeconds, durationSeconds, `mustKeepEvents[${index}].sourceEndSeconds`);
        if (sourceEndSeconds <= sourceStartSeconds) throw new Error(`mustKeepEvents[${index}] 时长必须大于 0`);
        if (sourceStartSeconds < previousStart) throw new Error("mustKeepEvents 必须按时间升序排列");
        previousStart = sourceStartSeconds;
        const involvedObjectIds = stringArray(record.involvedObjectIds, `mustKeepEvents[${index}].involvedObjectIds`);
        if (involvedObjectIds.some((objectId) => !objectIds.has(objectId))) throw new Error(`mustKeepEvents[${index}] 引用了不存在的对象`);
        const eventEvidenceIds = stringArray(record.evidenceIds, `mustKeepEvents[${index}].evidenceIds`);
        if (eventEvidenceIds.some((evidenceId) => !evidenceIds.has(evidenceId))) throw new Error(`mustKeepEvents[${index}] 引用了不存在的证据`);
        return {
            schemaVersion: VIRAL_VIDEO_DOMAIN_SCHEMA_VERSION,
            id,
            priority,
            function: eventFunction,
            sourceStartSeconds,
            sourceEndSeconds,
            targetStartSeconds: sourceStartSeconds,
            targetEndSeconds: sourceEndSeconds,
            parentShotIndex: boundedNumber(record.parentShotIndex, 1, Number.MAX_SAFE_INTEGER, `mustKeepEvents[${index}].parentShotIndex`),
            description: nonEmptyString(record.description, `mustKeepEvents[${index}].description`),
            startState: stringValue(record.startState, `mustKeepEvents[${index}].startState`),
            endState: stringValue(record.endState, `mustKeepEvents[${index}].endState`),
            involvedObjectIds,
            audioCue: stringValue(record.audioCue, `mustKeepEvents[${index}].audioCue`),
            evidenceIds: eventEvidenceIds,
        };
    });
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} 格式不正确`);
    return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, field: string): string {
    const result = stringValue(value, field);
    if (!result) throw new Error(`${field} 不能为空`);
    return result;
}

function stringValue(value: unknown, field: string): string {
    if (typeof value !== "string") throw new Error(`${field} 必须是字符串`);
    return value.trim();
}

function optionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown, field: string): string[] {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${field} 必须是字符串数组`);
    return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

function integerArray(value: unknown, field: string): number[] {
    if (!Array.isArray(value) || value.some((item) => !Number.isInteger(item) || item < 1)) throw new Error(`${field} 必须是正整数数组`);
    return [...new Set(value as number[])];
}

function boundedNumber(value: unknown, min: number, max: number, field: string): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${field} 必须在 ${min} 到 ${max} 之间`);
    return value;
}

function enumValue<const T extends readonly string[]>(value: unknown, options: T, field: string): T[number] {
    if (typeof value !== "string" || !options.includes(value)) throw new Error(`${field} 无效`);
    return value as T[number];
}
