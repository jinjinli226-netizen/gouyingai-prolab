export function adminDirectoryStatus(channelCount: number, modelCount: number, loadError: string) {
    const offline = Boolean(loadError);
    return {
        channelCount: offline ? "--" : String(channelCount),
        modelCount: offline ? "--" : String(modelCount),
        errorMessage: offline ? "无法连接 GouYingAi Gateway，请确认本地项目已通过统一入口启动。" : "",
    };
}
