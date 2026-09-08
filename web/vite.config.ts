import { request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { request as httpsRequest } from "node:https";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { parseChangelog } from "./src/lib/release";

const webDir = dirname(fileURLToPath(import.meta.url));
const localVersion = readFileSync(resolve(webDir, "../VERSION"), "utf8").trim() || "dev";
const localChangelog = readFileSync(resolve(webDir, "../CHANGELOG.md"), "utf8");
const localUpstreamProxyPath = "/__gouyingai_upstream/";

function localUpstreamProxyPlugin(): Plugin {
    const middleware = (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => {
        if (!request.url?.startsWith(localUpstreamProxyPath)) return next();
        if (!isLoopbackRequest(request)) return sendProxyError(response, 403, "本地中转只允许本机访问");

        const target = parseUpstreamTarget(request.url);
        if (!target) return sendProxyError(response, 400, "无效或不安全的上游地址");

        const headers = { ...request.headers, host: target.host };
        delete headers.origin;
        delete headers.referer;
        const send = target.protocol === "https:" ? httpsRequest : httpRequest;
        const upstreamRequest = send(target, { method: request.method, headers }, (upstreamResponse) => {
            response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
            upstreamResponse.pipe(response);
        });
        upstreamRequest.on("error", () => sendProxyError(response, 502, "本地中转无法连接到配置的上游地址"));
        request.pipe(upstreamRequest);
    };

    return {
        name: "gouyingai-local-upstream-proxy",
        configureServer(server) {
            server.middlewares.use(middleware);
        },
        configurePreviewServer(server) {
            server.middlewares.use(middleware);
        },
    };
}

function parseUpstreamTarget(requestUrl: string) {
    const incoming = new URL(requestUrl, "http://gouyingai.local");
    const remainingPath = incoming.pathname.slice(localUpstreamProxyPath.length);
    const separator = remainingPath.indexOf("/");
    if (separator <= 0) return null;
    try {
        const origin = decodeURIComponent(remainingPath.slice(0, separator));
        const upstream = new URL(origin);
        if (upstream.origin !== origin || isUnsafeUpstream(upstream)) return null;
        return new URL(`${remainingPath.slice(separator)}${incoming.search}`, upstream);
    } catch {
        return null;
    }
}

function isLoopbackRequest(request: IncomingMessage) {
    const address = request.socket.remoteAddress?.replace(/^::ffff:/, "") || "";
    return address === "127.0.0.1" || address === "::1";
}

function isUnsafeUpstream(url: URL) {
    if (url.protocol !== "http:" && url.protocol !== "https:") return true;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.includes(":")) return true;
    const parts = hostname.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

function sendProxyError(response: ServerResponse, status: number, message: string) {
    if (response.headersSent) return response.end();
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: { message } }));
}

export default defineConfig({
    base: process.env.VITE_BASE || "/",
    plugins: [react(), localUpstreamProxyPlugin()],
    resolve: {
        alias: {
            "@": resolve(webDir, "src"),
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify(localVersion),
        __APP_RELEASES__: JSON.stringify(parseChangelog(localChangelog)),
    },
});
