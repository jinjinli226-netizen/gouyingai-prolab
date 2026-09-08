import { createClient } from "@supabase/supabase-js";
import { createLocalCanvasJobRepository, createSupabaseCanvasJobRepository } from "./canvas-job-repository.js";
import { createLocalViralBatchRepository, createSupabaseViralBatchRepository } from "./viral-batch-repository.js";
import { ViralBatchCoordinator } from "./viral-batch-coordinator.js";
import { CanvasJobRunner } from "./canvas-job-runner.js";
import { loadCanvasJobRunnerSettings } from "./canvas-job-settings.js";
import { createAudioJobHandler } from "./canvas-job-handlers/audio-job-handler.js";
import { createLocalCapabilityRuntimes, createSupabaseCapabilityRuntimes } from "./canvas-job-handlers/capability-runtime.js";
import { createImageJobHandler } from "./canvas-job-handlers/image-job-handler.js";
import { createTextJobHandler, createViralTextJobHandler } from "./canvas-job-handlers/text-job-handler.js";
import { createViralQualityJobHandler } from "./canvas-job-handlers/viral-quality-job-handler.js";
import { createLocalVideoJobRuntime, createSupabaseVideoJobRuntime, createVideoJobHandler } from "./canvas-job-handlers/video-job-handler.js";
import { LocalStore } from "./local-store.js";
import { createLocalGatewayApp } from "./local-server.js";
import { createGatewayApp } from "./server.js";
const port = Number(process.env.PORT) || 8788;
if (process.env.GATEWAY_LOCAL_MODE === "1") {
    const host = process.env.GATEWAY_HOST || "127.0.0.1";
    const storePath = process.env.GATEWAY_DATA_FILE || new URL("../data/local-store.json", import.meta.url).pathname;
    const store = new LocalStore(storePath);
    const app = createLocalGatewayApp(store);
    const capabilityRuntimes = createLocalCapabilityRuntimes(store);
    const canvasJobs = createLocalCanvasJobRepository(store);
    const coordinator = new ViralBatchCoordinator(createLocalViralBatchRepository(store), canvasJobs);
    const runner = new CanvasJobRunner({
        repository: canvasJobs,
        handler: durableJobHandler({
            video: createVideoJobHandler(createLocalVideoJobRuntime(store)),
            text: createTextJobHandler(capabilityRuntimes.text),
            image: createImageJobHandler(capabilityRuntimes.image),
            audio: createAudioJobHandler(capabilityRuntimes.audio),
            analysis: createViralTextJobHandler(capabilityRuntimes.text, "viral-analysis"),
            plan: createViralTextJobHandler(capabilityRuntimes.text, "viral-plan"),
        }),
        settings: loadCanvasJobRunnerSettings(),
    });
    const server = app.listen(port, host, () => {
        runner.start();
        coordinator.start();
        console.log(`GouYingAi Gateway (local mode) listening on http://${host}:${port}`);
        console.log(`Data file: ${storePath}`);
    });
    registerRunnerShutdown(runner, server, coordinator);
}
else {
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const anonKey = process.env.SUPABASE_ANON_KEY || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("生产 Gateway 缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    }
    const host = process.env.GATEWAY_HOST || "0.0.0.0";
    const auth = createClient(supabaseUrl, anonKey || serviceRoleKey, { auth: { persistSession: false } });
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const app = createGatewayApp({ auth, admin, memoryTasks: new Map() });
    const capabilityRuntimes = createSupabaseCapabilityRuntimes(admin);
    const canvasJobs = createSupabaseCanvasJobRepository(admin);
    const coordinator = new ViralBatchCoordinator(createSupabaseViralBatchRepository(admin), canvasJobs);
    const runner = new CanvasJobRunner({
        repository: canvasJobs,
        handler: durableJobHandler({
            video: createVideoJobHandler(createSupabaseVideoJobRuntime(admin)),
            text: createTextJobHandler(capabilityRuntimes.text),
            image: createImageJobHandler(capabilityRuntimes.image),
            audio: createAudioJobHandler(capabilityRuntimes.audio),
            analysis: createViralTextJobHandler(capabilityRuntimes.text, "viral-analysis"),
            plan: createViralTextJobHandler(capabilityRuntimes.text, "viral-plan"),
        }),
        settings: loadCanvasJobRunnerSettings(),
    });
    const server = app.listen(port, host, () => {
        runner.start();
        coordinator.start();
        console.log(`GouYingAi Gateway listening on http://${host}:${port}`);
    });
    registerRunnerShutdown(runner, server, coordinator);
}
function durableJobHandler(handlers) {
    const quality = createViralQualityJobHandler();
    return async (context) => {
        if (context.job.kind === "video" || context.job.kind === "viral-video")
            return handlers.video(context);
        if (context.job.kind === "viral-quality")
            return quality(context);
        if (context.job.kind === "viral-analysis")
            return handlers.analysis(context);
        if (context.job.kind === "viral-plan")
            return handlers.plan(context);
        if (context.job.kind === "text" || context.job.kind === "image" || context.job.kind === "audio")
            return handlers[context.job.kind](context);
        throw new Error(`Gateway 尚未注册 ${context.job.kind} 任务处理器`);
    };
}
function registerRunnerShutdown(runner, server, coordinator) {
    let stopping = false;
    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.once(signal, () => {
            if (stopping)
                return;
            stopping = true;
            runner.stop();
            coordinator.stop();
            server.close(() => process.exit(0));
            setTimeout(() => process.exit(0), 500).unref();
        });
    }
}
//# sourceMappingURL=index.js.map