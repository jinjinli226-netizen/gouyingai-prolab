import type { ReactNode } from "react";
import { useEffect } from "react";

import { fetchGatewayCatalog, isGatewayConfigured, syncGatewayCatalog } from "@/services/gateway-admin";
import { isSupabaseConfigured, supabase } from "@/services/supabase-client";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

export function ClientRootInit({ children }: { children: ReactNode }) {
    const hydrated = useConfigStore((state) => state.hydrated);
    const applyServerModels = useConfigStore((state) => state.applyServerModels);
    const setSession = useUserStore((state) => state.setSession);

    useEffect(() => {
        if (!hydrated || !isGatewayConfigured) return;
        if (!isSupabaseConfigured || !supabase) {
            void syncGatewayCatalog(fetchGatewayCatalog, applyServerModels).catch(() => undefined);
            return;
        }
        const client = supabase;
        let cancelled = false;
        const applyAuthSession = async (token: string | undefined) => {
            if (!token) {
                setSession(null, "");
                return;
            }
            const { data } = await client.auth.getUser(token);
            if (cancelled) return;
            setSession(
                data.user
                    ? {
                          id: data.user.id,
                          username: data.user.email || data.user.id,
                          displayName: data.user.user_metadata?.display_name || data.user.email || "用户",
                          avatarUrl: "",
                      }
                    : null,
                token,
            );
            if (isGatewayConfigured && data.user) {
                try {
                    await syncGatewayCatalog(fetchGatewayCatalog, (catalog) => {
                        if (!cancelled) applyServerModels(catalog);
                    });
                } catch {
                    // 网关不可用时保留空目录，避免继续使用浏览器旧渠道。
                }
            }
        };
        void (async () => {
            const { data } = await client.auth.getSession();
            await applyAuthSession(data.session?.access_token);
        })();
        const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
            void applyAuthSession(session?.access_token);
        });
        return () => {
            cancelled = true;
            subscription.subscription.unsubscribe();
        };
    }, [applyServerModels, hydrated, setSession]);

    return <>{children}</>;
}
