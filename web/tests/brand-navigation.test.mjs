import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("runtime branding uses GouYingAi assets and copy", () => {
    const indexHtml = read("index.html");
    const topNav = read("src/components/layout/app-top-nav.tsx");
    const home = read("src/pages/home/index.tsx");
    const assistant = read("src/components/canvas/canvas-assistant-panel.tsx");
    const localAgent = read("src/components/canvas/canvas-local-agent-panel.tsx");

    assert.match(indexHtml, /<title>GouYingAi<\/title>/);
    assert.match(indexHtml, /href="\/gouyingai-mark\.png"/);
    assert.match(topNav, /src="\/gouyingai-mark\.png"/);
    assert.match(topNav, />GouYingAi</);

    for (const source of [topNav, home, assistant, localAgent]) {
        assert.doesNotMatch(source, /ProLab/);
    }
});

test("runtime has provider-neutral defaults and no upstream navigation links", () => {
    const config = read("src/stores/use-config-store.ts");
    const clientInit = read("src/components/layout/client-root-init.tsx");
    const userActions = read("src/components/layout/user-status-actions.tsx");
    const home = read("src/pages/home/index.tsx");
    const canvasProject = read("src/pages/canvas/project.tsx");

    assert.match(config, /const OPENAI_BASE_URL = "";/);
    assert.doesNotMatch(config, /kiligai\.com|prorisehub\.com/);
    assert.doesNotMatch(clientInit, /DEFAULT_UPSTREAM/);
    assert.doesNotMatch(clientInit, /QuickConnectModal|apiKey|baseUrl/);
    assert.equal(existsSync(new URL("../src/components/onboarding/quick-connect-modal.tsx", import.meta.url)), false);
    assert.doesNotMatch(userActions, /GitHubLink|DOCS_URL|VersionReleaseModal/);
    assert.doesNotMatch(home, /canvas\.best|DOCS_URL/);
    assert.doesNotMatch(canvasProject, /DOCS_URL/);
    assert.equal(existsSync(new URL("../src/components/layout/github-link.tsx", import.meta.url)), false);
    assert.equal(existsSync(new URL("../src/hooks/use-version-check.ts", import.meta.url)), false);
});

test("runtime persistence and export identifiers use gouyingai", () => {
    const paths = [
        "src/lib/localforage-storage.ts",
        "src/stores/use-config-store.ts",
        "src/stores/use-asset-store.ts",
        "src/stores/use-theme-store.ts",
        "src/stores/canvas/use-canvas-store.ts",
        "src/services/image-storage.ts",
        "src/services/file-storage.ts",
        "src/services/app-sync.ts",
        "src/pages/image/index.tsx",
        "src/pages/video/index.tsx",
        "src/pages/assets/asset-transfer.ts",
        "src/lib/canvas/canvas-export.ts",
        "src/types/canvas-export.ts",
    ];

    for (const path of paths) {
        const source = read(path);
        assert.doesNotMatch(source, /["']prolab(?::|["'])/i, path);
        assert.match(source, /gouyingai/i, path);
    }
});

test("all product-owned local storage keys use the gouyingai namespace", () => {
    const agentStore = read("src/stores/canvas/use-canvas-agent-store.ts");
    const agentPanel = read("src/components/canvas/canvas-local-agent-panel.tsx");
    const configModal = read("src/components/layout/app-config-modal.tsx");
    const imageTools = read("src/components/canvas/canvas-image-toolbar-tools.tsx");

    for (const source of [agentStore, agentPanel, configModal, imageTools]) {
        assert.doesNotMatch(source, /["']canvas-(?:agent|image-quick-tools)/, source);
    }
    assert.match(agentStore, /gouyingai:canvas_agent_panel_width/);
    assert.match(agentStore, /gouyingai:canvas_agent_url/);
    assert.match(agentStore, /gouyingai:canvas_agent_token/);
    assert.match(imageTools, /gouyingai:image_quick_tools_v6/);
});

test("desktop navigation is viewport-centered with stronger animated active state", () => {
    const topNav = read("src/components/layout/app-top-nav.tsx");

    assert.match(topNav, /relative mx-auto flex h-full/);
    assert.match(topNav, /absolute left-1\/2 top-1\/2/);
    assert.match(topNav, /-translate-x-1\/2 -translate-y-1\/2/);
    assert.match(topNav, /lg:flex/);
    assert.match(topNav, /!bg-cyan-50/);
    assert.match(topNav, /dark:!bg-cyan-900/);
    assert.match(topNav, /dark:ring-cyan-700/);
    assert.match(topNav, /after:scale-x-100/);
    assert.match(topNav, /duration-200/);
});

test("home omits the release status badge and navigation calls assets 资产", () => {
    const home = read("src/pages/home/index.tsx");
    const navigation = read("src/constant/navigation-tools.ts");

    assert.doesNotMatch(home, /APP_VERSION|Pro Canvas/);
    assert.match(navigation, /slug: "assets",\s*label: "资产"/);
    assert.doesNotMatch(navigation, /label: "我的素材"/);
});
