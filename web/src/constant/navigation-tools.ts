import { Diamond, FileText, ImagePlus, Images, Maximize2, Settings2, ShieldCheck, ShoppingBag, Video } from "lucide-react";

export const navigationTools = [
    {
        slug: "canvas",
        label: "我的画布",
        icon: Maximize2,
    },
    {
        slug: "ecommerce",
        label: "AI批量带货系统",
        icon: ShoppingBag,
    },
    {
        slug: "jewelry",
        label: "AI珠宝商品图",
        icon: Diamond,
    },
    {
        slug: "image",
        label: "生图工作台",
        icon: ImagePlus,
    },
    {
        slug: "video",
        label: "视频创作台",
        icon: Video,
    },
    {
        slug: "prompts",
        label: "提示词库",
        icon: FileText,
    },
    {
        slug: "assets",
        label: "资产",
        icon: Images,
    },
    {
        slug: "config",
        label: "用户偏好",
        icon: Settings2,
    },
] as const;

export type NavigationToolSlug = (typeof navigationTools)[number]["slug"];

export const adminNavigationTool = {
    slug: "admin",
    label: "管理后台",
    icon: ShieldCheck,
} as const;
