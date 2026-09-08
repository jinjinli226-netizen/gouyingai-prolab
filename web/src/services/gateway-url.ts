export function resolveGatewayBaseUrl(configuredUrl: string, pageUrl = typeof window === "undefined" ? "" : window.location.href) {
    const normalized = configuredUrl.trim().replace(/\/+$/, "");
    if (!normalized || !pageUrl) return normalized;
    try {
        const gateway = new URL(normalized);
        const page = new URL(pageUrl);
        if (!isLocalHostname(gateway.hostname) || !isLocalHostname(page.hostname)) return normalized;
        gateway.hostname = page.hostname;
        return gateway.toString().replace(/\/+$/, "");
    } catch {
        return normalized;
    }
}

function isLocalHostname(hostname: string) {
    if (["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return true;
    const parts = hostname.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}
