import crypto from "node:crypto";

import type { CanvasConnection, CanvasNode, CanvasSnapshot } from "./types.js";

export type CanvasRunStatus = "created" | "starting" | "running" | "dry_run_complete" | "completed" | "failed" | "cancelled";

export type CanvasRunRecord = {
    runId: string;
    templateCanvasId: string;
    runCanvasId?: string;
    status: CanvasRunStatus;
    createdAt: string;
    updatedAt: string;
    error?: string;
};

export type CanvasRunStartEvent = {
    runId: string;
    templateCanvasId: string;
    inputs: Record<string, unknown>;
};

export type CanvasRunOutput = {
    id: string;
    name: string;
    type: string;
    status?: string;
    remoteNodeId: string;
    value?: unknown;
};

type InternalRun = CanvasRunRecord & {
    inputs: Record<string, unknown>;
    template: CanvasSnapshot;
    snapshot?: CanvasSnapshot;
};

export class CanvasRunRegistry {
    private readonly runs = new Map<string, InternalRun>();

    private require(runId: string) {
        const run = this.runs.get(runId);
        if (!run) throw new Error(`找不到画布运行实例：${runId}`);
        return run;
    }

    create(templateValue: CanvasSnapshot, input: { canvasId: string; inputs: Record<string, unknown>; dryRun: boolean }): CanvasRunRecord {
        const template = clone(templateValue);
        const templateCanvasId = String(template.projectId || "");
        if (!templateCanvasId || templateCanvasId !== input.canvasId) throw new Error("画布运行的 canvasId 与当前母版不一致");
        validateTemplate(template, input.inputs);
        const now = new Date().toISOString();
        const record: InternalRun = {
            runId: `RUN-${crypto.randomUUID()}`,
            templateCanvasId,
            inputs: clone(input.inputs),
            template,
            status: input.dryRun ? "dry_run_complete" : "created",
            createdAt: now,
            updatedAt: now,
        };
        this.runs.set(record.runId, record);
        return publicRun(record);
    }

    startEvent(runId: string): CanvasRunStartEvent | null {
        const run = this.require(runId);
        if (run.status === "dry_run_complete" || terminal(run.status)) return null;
        if (run.status !== "created" && run.status !== "starting") throw new Error(`运行实例当前状态不能启动：${run.status}`);
        run.status = "starting";
        touch(run);
        return { runId: run.runId, templateCanvasId: run.templateCanvasId, inputs: clone(run.inputs) };
    }

    acknowledgeStart(runId: string, runCanvasId: string): CanvasRunRecord {
        const run = this.require(runId);
        if (terminal(run.status) || run.status === "dry_run_complete") return publicRun(run);
        if (!runCanvasId.trim()) return this.fail(runId, "网页没有返回独立运行画布 ID");
        run.runCanvasId = runCanvasId;
        run.status = "running";
        touch(run);
        return publicRun(run);
    }

    fail(runId: string, error: string): CanvasRunRecord {
        const run = this.require(runId);
        if (terminal(run.status)) return publicRun(run);
        run.status = "failed";
        run.error = error || "画布运行失败";
        touch(run);
        return publicRun(run);
    }

    cancel(runId: string): CanvasRunRecord {
        const run = this.require(runId);
        if (terminal(run.status) || run.status === "dry_run_complete") return publicRun(run);
        run.status = "cancelled";
        touch(run);
        return publicRun(run);
    }

    get(runId: string): CanvasRunRecord {
        return publicRun(this.require(runId));
    }

    getInternal(runId: string) {
        return this.require(runId);
    }

    updateCanvas(snapshotValue: CanvasSnapshot) {
        const snapshot = clone(snapshotValue);
        const canvasId = String(snapshot.projectId || "");
        if (!canvasId) return;
        for (const run of this.runs.values()) {
            if (run.runCanvasId !== canvasId) continue;
            run.snapshot = snapshot;
            if (run.status !== "running" && run.status !== "starting") continue;
            const failure = outputFailure(run);
            if (failure) {
                run.status = "failed";
                run.error = failure;
            } else if (requiredOutputsReady(run)) {
                run.status = "completed";
            } else {
                run.status = "running";
            }
            touch(run);
        }
    }

    listOutputs(runId: string): CanvasRunOutput[] {
        const run = this.require(runId);
        return collectOutputs(run);
    }

    outputReference(outputId: string) {
        const separator = outputId.indexOf(":");
        if (separator < 1) throw new Error("产物 ID 格式无效");
        const runId = outputId.slice(0, separator);
        const nodeId = outputId.slice(separator + 1);
        const run = this.require(runId);
        const exists = collectOutputNodes(run).some((item) => item.node.id === nodeId);
        if (!exists) throw new Error("找不到运行产物");
        return { runId, runCanvasId: run.runCanvasId, nodeId };
    }

    download(runId: string, outputId: string) {
        const run = this.require(runId);
        const output = collectOutputNodes(run).find((item) => outputIdFor(run.runId, item.node.id) === outputId);
        if (!output) throw new Error("找不到运行产物");
        const metadata = output.node.metadata || {};
        const rawContent = metadata.content ?? metadata.value;
        const mimeType = String(metadata.mimeType || defaultMime(output.type));
        let url = typeof rawContent === "string" ? rawContent : "";
        if (output.type === "text" && url && !looksLikeUrl(url)) url = `data:${mimeType};charset=utf-8,${encodeURIComponent(url)}`;
        if (!url || !looksLikeUrl(url)) throw new Error("产物需要由已连接网页解析下载地址");
        return clean({
            outputId,
            url,
            mimeType,
            sizeBytes: typeof metadata.bytes === "number" ? metadata.bytes : undefined,
            sha256: typeof metadata.sha256 === "string" ? metadata.sha256 : undefined,
        });
    }
}

function validateTemplate(template: CanvasSnapshot, inputs: Record<string, unknown>) {
    const nodes = template.nodes || [];
    const inputNodes = nodes.filter((node) => role(node) === "input");
    const outputNodes = nodes.filter((node) => role(node) === "output");
    const runnerNodes = nodes.filter((node) => node.metadata?.runOnStart === true || role(node) === "runner");
    const missingStructure = [
        !inputNodes.length ? "输入节点" : "",
        !outputNodes.length ? "输出节点" : "",
        !runnerNodes.length ? "运行节点" : "",
    ].filter(Boolean);
    if (missingStructure.length) throw new Error(`画布模板缺少${missingStructure.join("、")}`);
    const missingInputs = inputNodes
        .filter((node) => node.metadata?.required === true)
        .map(inputKey)
        .filter((key) => empty(inputs[key]));
    if (missingInputs.length) throw new Error(`画布运行缺少必填输入：${missingInputs.join("、")}`);
}

function requiredOutputsReady(run: InternalRun) {
    if (!run.snapshot) return false;
    const roots = (run.template.nodes || []).filter((node) => role(node) === "output");
    const required = roots.filter((node) => node.metadata?.required === true);
    const targets = required.length ? required : roots;
    return targets.length > 0 && targets.every((root) => readyOutputNodes(run.snapshot!, root.id).length > 0);
}

function outputFailure(run: InternalRun) {
    if (!run.snapshot) return "";
    const roots = (run.template.nodes || []).filter((node) => role(node) === "output" && node.metadata?.required === true);
    for (const root of roots) {
        const nodes = reachableNodes(run.snapshot, root.id);
        const failed = nodes.find((node) => String(node.metadata?.status || "").toLowerCase() === "error");
        if (failed) return String(failed.metadata?.errorDetails || `${root.title || outputKey(root)} 生成失败`);
        const currentRoot = (run.snapshot.nodes || []).find((node) => node.id === root.id);
        if (currentRoot?.metadata?.status === "success" && readyOutputNodes(run.snapshot, root.id).length === 0) return `${root.title || outputKey(root)} 未产生可用产物`;
    }
    return "";
}

function collectOutputs(run: InternalRun): CanvasRunOutput[] {
    return collectOutputNodes(run).map(({ node, root, index, type }) => {
        const metadata = node.metadata || {};
        const value = metadata.content ?? metadata.value ?? metadata.storageKey;
        return clean({
            id: outputIdFor(run.runId, node.id),
            name: `${outputKey(root)}${index > 0 ? `-${index + 1}` : ""}`,
            type,
            status: String(metadata.status || "ready"),
            remoteNodeId: node.id,
            value,
        }) as CanvasRunOutput;
    });
}

function collectOutputNodes(run: InternalRun) {
    if (!run.snapshot) return [] as Array<{ node: CanvasNode; root: CanvasNode; index: number; type: string }>;
    const seen = new Set<string>();
    const result: Array<{ node: CanvasNode; root: CanvasNode; index: number; type: string }> = [];
    for (const root of (run.template.nodes || []).filter((node) => role(node) === "output")) {
        readyOutputNodes(run.snapshot, root.id).forEach((node, index) => {
            if (seen.has(node.id)) return;
            seen.add(node.id);
            result.push({ node, root, index, type: String(node.metadata?.dataType || root.metadata?.dataType || node.type || "unknown") });
        });
    }
    return result;
}

function readyOutputNodes(snapshot: CanvasSnapshot, rootId: string) {
    return reachableNodes(snapshot, rootId).filter((node) => {
        const metadata = node.metadata || {};
        const status = String(metadata.status || "").toLowerCase();
        const hasValue = metadata.content !== undefined || metadata.value !== undefined || metadata.storageKey !== undefined;
        return hasValue && status !== "loading" && status !== "error";
    });
}

function reachableNodes(snapshot: CanvasSnapshot, rootId: string) {
    const nodes = new Map((snapshot.nodes || []).map((node) => [node.id, node]));
    const outgoing = new Map<string, string[]>();
    for (const connection of (snapshot.connections || []) as CanvasConnection[]) {
        outgoing.set(connection.fromNodeId, [...(outgoing.get(connection.fromNodeId) || []), connection.toNodeId]);
    }
    const result: CanvasNode[] = [];
    const queue = [rootId];
    const visited = new Set<string>();
    while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const node = nodes.get(id);
        if (node) result.push(node);
        queue.push(...(outgoing.get(id) || []));
    }
    return result;
}

function role(node: CanvasNode) {
    return String(node.metadata?.contractRole || node.metadata?.role || "").toLowerCase();
}

function inputKey(node: CanvasNode) {
    return String(node.metadata?.inputKey || node.title || node.id);
}

function outputKey(node: CanvasNode) {
    return String(node.metadata?.outputKey || node.title || node.id);
}

function empty(value: unknown) {
    return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function terminal(status: CanvasRunStatus) {
    return status === "completed" || status === "failed" || status === "cancelled";
}

function touch(run: InternalRun) {
    run.updatedAt = new Date().toISOString();
}

function publicRun(run: InternalRun): CanvasRunRecord {
    return clean({ runId: run.runId, templateCanvasId: run.templateCanvasId, runCanvasId: run.runCanvasId, status: run.status, createdAt: run.createdAt, updatedAt: run.updatedAt, error: run.error }) as CanvasRunRecord;
}

function outputIdFor(runId: string, nodeId: string) {
    return `${runId}:${nodeId}`;
}

function defaultMime(type: string) {
    if (type === "video") return "video/mp4";
    if (type === "audio") return "audio/mpeg";
    if (type === "image") return "image/png";
    if (type === "json") return "application/json";
    return "text/plain";
}

function looksLikeUrl(value: string) {
    return /^(https?:|data:|blob:)/i.test(value);
}

function clean<T extends Record<string, unknown>>(value: T) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function clone<T>(value: T): T {
    return structuredClone(value);
}
