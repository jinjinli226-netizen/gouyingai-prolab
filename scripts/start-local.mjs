import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { Socket } from "node:net";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export const localServices = [
    {
        name: "Gateway",
        port: 8788,
        cwd: join(root, "gateway"),
        entry: join(root, "gateway", "node_modules", "tsx", "dist", "cli.mjs"),
        args: ["watch", "--env-file=.env", "src/index.ts"],
    },
    {
        name: "Frontend",
        port: 3000,
        cwd: join(root, "web"),
        entry: join(root, "web", "node_modules", "vite", "bin", "vite.js"),
        args: ["--host", "0.0.0.0", "--port", "3000"],
    },
];

export async function startLocalServices() {
    const children = [];
    for (const service of localServices) {
        if (await isPortOpen(service.port)) {
            console.log(`${service.name} 已在 http://127.0.0.1:${service.port} 运行`);
            continue;
        }
        console.log(`正在启动 ${service.name}（端口 ${service.port}）...`);
        const child = spawn(process.execPath, [service.entry, ...service.args], {
            cwd: service.cwd,
            env: process.env,
            stdio: "inherit",
            windowsHide: true,
        });
        children.push({ service, child });
        await waitForPort(service.port, child);
    }
    if (!children.length) return;

    const stop = () => {
        for (const { child } of children) if (!child.killed) child.kill();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    await new Promise((done) => {
        for (const { service, child } of children) {
            child.once("exit", (code) => {
                console.error(`${service.name} 已退出${code === null ? "" : `（代码 ${code}）`}`);
                stop();
                process.exitCode = code || 0;
                done();
            });
        }
    });
}

function isPortOpen(port) {
    return new Promise((done) => {
        const socket = new Socket();
        socket.setTimeout(300);
        socket.once("connect", () => { socket.destroy(); done(true); });
        socket.once("timeout", () => { socket.destroy(); done(false); });
        socket.once("error", () => done(false));
        socket.connect(port, "127.0.0.1");
    });
}

async function waitForPort(port, child) {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`端口 ${port} 对应服务启动失败`);
        if (await isPortOpen(port)) return;
        await new Promise((done) => setTimeout(done, 150));
    }
    child.kill();
    throw new Error(`等待端口 ${port} 超时`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    startLocalServices().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
