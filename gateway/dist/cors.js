export function gatewayCorsOptions(environment = process.env, allowLoopback = false) {
    const allowedOrigins = new Set(String(environment.GATEWAY_ALLOWED_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean));
    return {
        credentials: true,
        origin(origin, callback) {
            if (!origin || isAllowedGatewayOrigin(origin, allowedOrigins, allowLoopback))
                return callback(null, true);
            return callback(new GatewayCorsError());
        },
    };
}
export const gatewayCorsErrorHandler = (error, _req, res, next) => {
    if (!(error instanceof GatewayCorsError))
        return next(error);
    res.status(403).json({ error: error.message });
};
class GatewayCorsError extends Error {
    constructor() {
        super("该网页来源不允许访问 Gateway");
    }
}
export function isAllowedGatewayOrigin(origin, allowedOrigins, allowLoopback) {
    const normalized = origin.trim().replace(/\/+$/, "");
    if (allowedOrigins.has(normalized))
        return true;
    if (!allowLoopback)
        return false;
    try {
        const url = new URL(normalized);
        return ["http:", "https:"].includes(url.protocol) && (["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || isPrivateIpv4(url.hostname));
    }
    catch {
        return false;
    }
}
function isPrivateIpv4(hostname) {
    const parts = hostname.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
        return false;
    return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}
//# sourceMappingURL=cors.js.map