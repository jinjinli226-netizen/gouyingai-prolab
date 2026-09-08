type ExternalCanvasNode = {
    id: string;
    type?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
};

type ExternalCanvasProject = {
    id: string;
    title: string;
    nodes: ExternalCanvasNode[];
    connections?: unknown[];
    [key: string]: unknown;
};

export type ExternalCanvasRunStart = {
    runId: string;
    templateCanvasId: string;
    inputs: Record<string, unknown>;
};

export function prepareExternalCanvasRun<T extends ExternalCanvasProject>(source: T, event: ExternalCanvasRunStart) {
    if (source.id !== event.templateCanvasId) throw new Error("当前网页不是运行实例指定的母版画布");
    const project = structuredClone(source);
    const runnerIds = project.nodes.filter(isRunner).map((node) => node.id);
    const outputNodes = project.nodes.filter((node) => role(node) === "output");
    if (!runnerIds.length || !outputNodes.length) throw new Error("画布模板缺少运行节点或输出节点");
    project.title = `${source.title} · ${event.runId.slice(0, 8)}`;
    project.nodes = project.nodes.map((node) => {
        if (role(node) !== "input") return node;
        const metadata = node.metadata || {};
        const key = String(metadata.inputKey || node.title || node.id);
        if (!Object.prototype.hasOwnProperty.call(event.inputs, key)) return node;
        const value = structuredClone(event.inputs[key]);
        const content = inputContent(value);
        return { ...node, metadata: { ...metadata, inputValue: value, content, status: "success", errorDetails: undefined } };
    });
    return { project, runnerIds };
}

export function resolveExternalRunOutput(node: ExternalCanvasNode, resolvedUrl: string) {
    if (!/^(https?:|data:|blob:)/i.test(resolvedUrl)) throw new Error("运行产物没有可用下载地址");
    const metadata = node.metadata || {};
    return clean({
        url: resolvedUrl,
        mimeType: String(metadata.mimeType || defaultMime(String(node.type || "file"))),
        sizeBytes: typeof metadata.bytes === "number" ? metadata.bytes : undefined,
        sha256: typeof metadata.sha256 === "string" ? metadata.sha256 : undefined,
    });
}

function isRunner(node: ExternalCanvasNode) {
    return node.metadata?.runOnStart === true || role(node) === "runner";
}

function role(node: ExternalCanvasNode) {
    return String(node.metadata?.contractRole || node.metadata?.role || "").toLowerCase();
}

function inputContent(value: unknown) {
    if (typeof value === "string") return value;
    if (value === undefined || value === null) return "";
    return JSON.stringify(value);
}

function defaultMime(type: string) {
    if (type === "video") return "video/mp4";
    if (type === "audio") return "audio/mpeg";
    if (type === "image") return "image/png";
    if (type === "text") return "text/plain";
    return "application/octet-stream";
}

function clean<T extends Record<string, unknown>>(value: T) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
