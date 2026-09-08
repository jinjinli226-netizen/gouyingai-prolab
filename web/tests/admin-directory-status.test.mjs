import assert from "node:assert/strict";
import test from "node:test";

import { adminDirectoryStatus } from "../src/pages/admin/admin-directory-status.ts";

test("admin directory distinguishes Gateway offline from a successful empty catalog", () => {
    assert.deepEqual(adminDirectoryStatus(0, 0, "Failed to fetch"), {
        channelCount: "--",
        modelCount: "--",
        errorMessage: "无法连接 GouYingAi Gateway，请确认本地项目已通过统一入口启动。",
    });
    assert.deepEqual(adminDirectoryStatus(0, 0, ""), {
        channelCount: "0",
        modelCount: "0",
        errorMessage: "",
    });
});
