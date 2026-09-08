import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { localServices } from "../scripts/start-local.mjs";

test("local startup owns the Gateway and frontend service definitions", () => {
    assert.deepEqual(localServices.map(({ name, port }) => ({ name, port })), [
        { name: "Gateway", port: 8788 },
        { name: "Frontend", port: 3000 },
    ]);
    for (const service of localServices) {
        assert.equal(existsSync(service.entry), true, `${service.name} entry must exist`);
        assert.equal(existsSync(service.cwd), true, `${service.name} cwd must exist`);
    }
    assert.deepEqual(
        localServices.find((service) => service.name === "Gateway")?.args,
        ["watch", "--env-file=.env", "src/index.ts"],
        "local development must reload the Gateway when its source changes",
    );
});
