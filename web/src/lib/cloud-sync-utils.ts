export function isSupabaseConfigReady(url: string | undefined, anonKey: string | undefined) {
    return Boolean(url?.trim() && anonKey?.trim());
}

export function supabaseMediaPath(userId: string, storageKey: string) {
    const safeUserId = userId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeStorageKey = storageKey
        .trim()
        .split(/[\\/]+/)
        .filter((part) => part && part !== "." && part !== "..")
        .join("_")
        .replace(/[^a-zA-Z0-9_.-]/g, "_");
    return `${safeUserId}/${safeStorageKey}`;
}

export function newerRecord<T extends Record<string, unknown>>(first: T, second: T, timeKey = "updatedAt") {
    const firstTime = recordTime(first[timeKey]);
    const secondTime = recordTime(second[timeKey]);
    return firstTime >= secondTime ? first : second;
}

function recordTime(value: unknown) {
    if (typeof value === "number") return value;
    if (typeof value === "string") return Date.parse(value) || 0;
    return 0;
}
