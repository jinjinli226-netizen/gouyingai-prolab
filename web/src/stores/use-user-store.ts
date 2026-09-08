import { create } from "zustand";

export type LocalUser = {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
};

type UserStore = {
    user: LocalUser | null;
    accessToken: string;
    setSession: (user: LocalUser | null, accessToken: string) => void;
    clearSession: () => void;
};

export const useUserStore = create<UserStore>()((set) => ({
    user: null,
    accessToken: "",
    setSession: (user, accessToken) => set({ user, accessToken }),
    clearSession: () => set({ user: null }),
}));
