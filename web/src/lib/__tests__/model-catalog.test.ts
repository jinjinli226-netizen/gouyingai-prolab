import { describe, expect, test } from "bun:test";

import * as modelPicker from "../../components/model-picker";
import * as gatewayAdmin from "../../services/gateway-admin";

describe("gateway model catalog refresh", () => {
    test("applies the newest catalog after an admin mutation", async () => {
        const catalog = [{ id: "text-model", modelName: "gpt-5.6-sol", displayName: "gpt-5.6-sol", capability: "text" as const, options: {} }];
        let applied: typeof catalog | undefined;
        const syncGatewayCatalog = (
            gatewayAdmin as unknown as {
                syncGatewayCatalog?: (fetchCatalog: () => Promise<typeof catalog>, applyCatalog: (next: typeof catalog) => void) => Promise<void>;
            }
        ).syncGatewayCatalog;

        expect(typeof syncGatewayCatalog).toBe("function");
        await syncGatewayCatalog?.(
            async () => catalog,
            (next) => {
                applied = next;
            },
        );

        expect(JSON.stringify(applied)).toBe(JSON.stringify(catalog));
    });
});

describe("missing model guidance", () => {
    test("points an empty text-model picker to the admin page", () => {
        const emptyModelLabel = (
            modelPicker as unknown as {
                emptyModelLabel?: (config: { models: string[] }, capability?: "image" | "video" | "text" | "audio") => string;
            }
        ).emptyModelLabel;

        expect(typeof emptyModelLabel).toBe("function");
        expect(emptyModelLabel?.({ models: [] }, "text")).toBe("暂无已发布的文本模型，请到管理后台添加并发布");
    });
});
