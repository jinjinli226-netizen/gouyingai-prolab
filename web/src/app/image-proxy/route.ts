import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_PROXY_TIMEOUT_MS = 120000;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

export async function GET(request: NextRequest) {
    const target = request.nextUrl.searchParams.get("url") || "";
    if (!target) return new Response("Missing url", { status: 400 });

    let url: URL;
    try {
        url = new URL(target);
    } catch {
        return new Response("Invalid url", { status: 400 });
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return new Response("Unsupported scheme", { status: 400 });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_PROXY_TIMEOUT_MS);
    try {
        const upstream = await fetch(url, { signal: controller.signal });
        if (!upstream.ok || !upstream.body) {
            return new Response(`Upstream ${upstream.status}`, { status: 502 });
        }
        const length = Number(upstream.headers.get("content-length") || 0);
        if (length && length > MAX_IMAGE_BYTES) return new Response("Image too large", { status: 413 });

        const headers = new Headers();
        const contentType = upstream.headers.get("content-type") || "application/octet-stream";
        headers.set("content-type", contentType);
        const cacheControl = upstream.headers.get("cache-control");
        if (cacheControl) headers.set("cache-control", cacheControl);
        return new Response(upstream.body, { status: 200, headers });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return new Response("Image proxy timeout", { status: 504 });
        return new Response(error instanceof Error ? error.message : "Image proxy error", { status: 502 });
    } finally {
        clearTimeout(timer);
    }
}
