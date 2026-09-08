import type { Channel } from "./types.js";
export declare function forwardGeminiChatCompletion(raw: Buffer, channel: Channel, modelName: string, apiKey: string): Promise<{
    status: number;
    payload: {
        error: {
            message: any;
        };
    };
} | {
    status: number;
    payload: {
        usage?: any;
        id: string;
        object: string;
        created: number;
        model: string;
        choices: {
            index: number;
            message: {
                role: string;
                content: any;
            };
            finish_reason: string;
        }[];
        error?: undefined;
    };
}>;
