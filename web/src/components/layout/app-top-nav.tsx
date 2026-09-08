import { Menu } from "lucide-react";
import { Button, Tooltip } from "antd";
import { Link, useLocation } from "react-router-dom";

import { adminNavigationTool, navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { isGatewayConfigured } from "@/services/gateway-admin";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useCanvasAgentStore } from "@/stores/canvas/use-canvas-agent-store";
import { useConfigStore } from "@/stores/use-config-store";

export function AppTopNav() {
    const { pathname } = useLocation();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const autoConnectRef = useRef(false);
    const agentToken = useCanvasAgentStore((state) => state.token);
    const agentEnabled = useCanvasAgentStore((state) => state.enabled);
    const agentConnected = useCanvasAgentStore((state) => state.connected);
    const connectAgent = useCanvasAgentStore((state) => state.connectAgent);
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const slug = pathname.split("/").filter(Boolean)[0];
    const activeToolSlug = navigationTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;

    useEffect(() => {
        if (autoConnectRef.current || agentEnabled || agentConnected || !agentToken.trim()) return;
        autoConnectRef.current = true;
        connectAgent();
    }, [agentConnected, agentEnabled, agentToken, connectAgent]);

    return (
        <>
            {!hideHeader ? (
                <header className="sticky top-0 z-20 h-14 shrink-0 border-b border-stone-200 bg-background/90 backdrop-blur-xl dark:border-stone-800">
                    <div className="relative mx-auto flex h-full max-w-7xl items-stretch justify-between gap-5 px-6">
                        <div className="flex min-w-0 items-center">
                            <Link to="/" className="flex h-full shrink-0 items-center gap-2 text-sm font-semibold leading-none tracking-tight text-stone-950 transition hover:text-stone-600 dark:text-stone-100 dark:hover:text-stone-300">
                                <img src="/gouyingai-mark.png" alt="" className="size-7 shrink-0 object-contain" />
                                <span className="text-base font-medium">GouYingAi</span>
                            </Link>

                            <button
                                type="button"
                                className="ml-3 inline-flex size-8 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 lg:hidden dark:text-stone-300 dark:hover:text-white"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label="打开导航菜单"
                                title="导航菜单"
                            >
                                <Menu className="size-5" />
                            </button>

                        </div>

                        <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 lg:flex">
                            {navigationTools.map((tool) => {
                                const Icon = tool.icon;
                                const active = tool.slug === activeToolSlug;
                                return (
                                    <Link
                                        key={tool.slug}
                                        to={`/${tool.slug}`}
                                        className={cn(
                                            "relative flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm leading-6 transition-all duration-200 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-cyan-500 after:transition-transform after:duration-200",
                                            active
                                                ? "!bg-cyan-50 font-semibold text-cyan-950 shadow-sm ring-1 ring-inset ring-cyan-200 after:scale-x-100 dark:!bg-cyan-900 dark:ring-cyan-700 dark:text-cyan-100"
                                                : "text-stone-500 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                                        )}
                                    >
                                        <Icon className="size-4" />
                                        <span className="truncate">{tool.label}</span>
                                    </Link>
                                );
                            })}
                            {isGatewayConfigured ? (
                                <Link
                                    key={adminNavigationTool.slug}
                                    to={`/${adminNavigationTool.slug}`}
                                    className={cn(
                                        "relative flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm leading-6 transition-all duration-200 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-cyan-500 after:transition-transform after:duration-200",
                                        slug === adminNavigationTool.slug
                                            ? "!bg-cyan-50 font-semibold text-cyan-950 shadow-sm ring-1 ring-inset ring-cyan-200 after:scale-x-100 dark:!bg-cyan-900 dark:ring-cyan-700 dark:text-cyan-100"
                                            : "text-stone-500 hover:bg-stone-100 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                                    )}
                                >
                                    <adminNavigationTool.icon className="size-4" />
                                    <span className="truncate">{adminNavigationTool.label}</span>
                                </Link>
                            ) : null}
                        </nav>

                        <div className="my-auto flex h-9 min-w-0 items-center justify-end gap-2 justify-self-end whitespace-nowrap">
                            <CodexStatusButton />
                            <UserStatusActions />
                        </div>
                    </div>
                </header>
            ) : null}

            <MobileNavDrawer open={mobileNavOpen} activeToolSlug={activeToolSlug} onClose={() => setMobileNavOpen(false)} />
            <AppConfigModal />
        </>
    );
}

function CodexStatusButton() {
    const connected = useCanvasAgentStore((state) => state.connected);
    const enabled = useCanvasAgentStore((state) => state.enabled);
    const activity = useCanvasAgentStore((state) => state.activity);
    const connectError = useCanvasAgentStore((state) => state.connectError);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const color = connectError ? "#dc2626" : connected ? "#16a34a" : enabled ? "#d97706" : "currentColor";
    const title = connectError || (connected ? activity || "Codex 已连接" : enabled ? "Codex 连接中" : "Codex 未连接");
    return (
        <Tooltip title={title}>
            <Button type="text" shape="circle" className="relative !h-8 !w-8 !min-w-8" onClick={() => openConfigDialog(false, "codex")} aria-label="Codex 连接状态">
                <span className="mx-auto block size-4" style={{ background: color, WebkitMask: "url(/icons/openai.svg) center / contain no-repeat", mask: "url(/icons/openai.svg) center / contain no-repeat" }} />
                <span className="absolute right-1 top-1 size-2 rounded-full border border-background" style={{ background: color }} />
            </Button>
        </Tooltip>
    );
}
