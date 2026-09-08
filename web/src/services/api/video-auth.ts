export function videoRequestNeedsClientApiKey(baseUrl: string, gatewayBaseUrl: string) {
    const gateway = gatewayBaseUrl.trim().replace(/\/+$/, "");
    return !gateway || baseUrl.trim().replace(/\/+$/, "") !== gateway;
}
