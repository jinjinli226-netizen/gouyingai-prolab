import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = path.resolve(process.cwd(), "src");

registerHooks({
    resolve(specifier, context, nextResolve) {
        const target = specifier.startsWith("@/") ? path.join(sourceRoot, specifier.slice(2)) : specifier.startsWith(".") && context.parentURL ? path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier) : "";
        if (!target) return nextResolve(specifier, context);
        const resolved = [target, `${target}.ts`, `${target}.tsx`, path.join(target, "index.ts"), path.join(target, "index.tsx")].find(existsSync);
        if (!resolved) return nextResolve(specifier, context);
        return { url: pathToFileURL(resolved).href, shortCircuit: true };
    },
    load(url, context, nextLoad) {
        if (!/\.tsx?$/.test(url)) return nextLoad(url, context);
        const source = readFileSync(new URL(url), "utf8");
        return {
            format: "module",
            source: ts.transpileModule(source, {
                compilerOptions: {
                    module: ts.ModuleKind.ESNext,
                    target: ts.ScriptTarget.ES2022,
                    jsx: ts.JsxEmit.ReactJSX,
                    esModuleInterop: true,
                },
                fileName: new URL(url).pathname,
            }).outputText,
            shortCircuit: true,
        };
    },
});
