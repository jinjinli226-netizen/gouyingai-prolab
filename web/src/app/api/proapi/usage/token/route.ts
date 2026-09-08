import { NextResponse } from "next/server";

import { proApiRootUrl } from "@/lib/pro-spec/proapi-usage";

type UsageRequest = {
    baseUrl?: string;
    apiKey?: string;
};

export async function POST(request: Request) {
    const body = (await request.json().catch(() => ({}))) as UsageRequest;
    const baseUrl = body.baseUrl?.trim();
    const apiKey = body.apiKey?.trim();
    if (!baseUrl || !apiKey) return NextResponse.json({ success: false, message: "缺少 Base URL 或 API Key" }, { status: 400 });

    let rootUrl: URL;
    try {
        rootUrl = new URL(proApiRootUrl(baseUrl));
    } catch {
        return NextResponse.json({ success: false, message: "Base URL 格式不正确" }, { status: 400 });
    }
    if (rootUrl.protocol !== "https:") return NextResponse.json({ success: false, message: "Base URL 必须使用 HTTPS" }, { status: 400 });

    try {
        const response = await fetch(`${rootUrl.toString().replace(/\/+$/, "")}/api/usage/token`, {
            method: "GET",
            headers: { Authorization: `Bearer ${apiKey}` },
            cache: "no-store",
        });
        const payload = await response.json().catch(() => ({ success: false, message: `额度查询失败：HTTP ${response.status}` }));
        return NextResponse.json(payload, { status: response.status });
    } catch {
        return NextResponse.json({ success: false, message: "额度查询失败，请检查网络或 Base URL" }, { status: 502 });
    }
}
