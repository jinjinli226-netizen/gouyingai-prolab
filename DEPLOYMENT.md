# GouYingAi 本地部署说明

这份文档用于在另一台电脑上从 GitHub 重新部署项目。项目由两个服务组成：

- 前端：Vite，端口 `3000`
- Gateway：Node.js，端口 `8788`

## 一、运行环境

建议使用：

- Windows 10/11、macOS 或 Linux
- Node.js 20 或更高版本
- pnpm 9 或更高版本
- 可访问 npm registry 的网络

项目已经把 FFmpeg 作为 Gateway 的本地依赖安装，不需要另外把 FFmpeg 加入系统 PATH。

## 二、获取代码

```bash
git clone <你的 GitHub 仓库地址>
cd prolab
```

如果仓库名称不是 `prolab`，进入实际 clone 出来的目录即可。

## 三、安装依赖

在项目根目录执行：

```bash
pnpm --dir gateway install
pnpm --dir web install
```

如果电脑没有 pnpm，可以先执行：

```bash
npm install --global pnpm
```

Windows PowerShell 如果阻止脚本执行，可以改用 `pnpm.cmd`，或者在管理员 PowerShell 中执行：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 四、配置 Gateway

复制环境变量模板：

### Windows PowerShell

```powershell
Copy-Item gateway\.env.example gateway\.env
```

### macOS/Linux

```bash
cp gateway/.env.example gateway/.env
```

本地模式至少确认以下配置存在：

```env
PORT=8788
GATEWAY_HOST=0.0.0.0
GATEWAY_LOCAL_MODE=1
GATEWAY_DATA_FILE=./data/local-store.json
GATEWAY_PUBLIC_URL=http://127.0.0.1:8788
GATEWAY_ENCRYPTION_KEY=请替换成64位十六进制密钥
```

生成新的加密密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

把输出内容填入 `GATEWAY_ENCRYPTION_KEY`。不要把 `gateway/.env` 提交到 GitHub。

## 五、启动项目

在项目根目录执行：

```bash
pnpm dev
```

这个命令会同时启动：

- Gateway：`http://127.0.0.1:8788`
- 前端：`http://127.0.0.1:3000`

浏览器打开：

```text
http://127.0.0.1:3000
```

停止服务时，在启动窗口按 `Ctrl+C`。

## 六、局域网访问

启动日志会显示类似下面的地址：

```text
Network: http://192.168.1.100:3000/
```

其他电脑访问这个 `Network` 地址即可。局域网访问失败时检查：

1. 两台电脑是否在同一个局域网；
2. Windows 防火墙是否允许 Node.js 访问专用网络；
3. Gateway 的 `GATEWAY_ALLOWED_ORIGINS` 是否包含前端地址；
4. 3000 和 8788 端口是否被其他程序占用。

不要把本地 Gateway 端口直接暴露到公网。生产环境应使用 HTTPS、身份认证和反向代理。

## 七、管理后台和模型配置

打开：

```text
http://127.0.0.1:3000/admin
```

在管理后台配置渠道、模型和 API Key。API Key 由 Gateway 加密后写入本地数据文件，不要把真实 Key 写进 `.env.example`、源码或 GitHub。

## 八、本地数据位置

本地模式的数据默认在：

```text
gateway/data/local-store.json
gateway/data/canvas-artifacts/
```

其中：

- `local-store.json` 保存渠道、模型、任务和运行状态；
- `canvas-artifacts/` 保存画布上传的图片、视频、音频等文件；
- 前端画布和素材还会保存在浏览器 IndexedDB 中。

这些内容属于机器本地数据，默认被 `.gitignore` 排除，不应提交到 GitHub。

迁移到另一台电脑时，需要单独复制 `gateway/data/`，并在浏览器中导出/导入画布和素材；仅 clone GitHub 仓库不会带上这些本地数据。

## 九、检查服务是否正常

### Windows PowerShell

```powershell
Invoke-WebRequest http://127.0.0.1:3000/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8788/health -UseBasicParsing
```

两个请求都返回 `200` 即表示服务已启动。

### macOS/Linux

```bash
curl -I http://127.0.0.1:3000/
curl http://127.0.0.1:8788/health
```

## 十、常见问题

### 1. 页面打不开

确认启动窗口没有报错，并检查端口：

```powershell
Get-NetTCPConnection -State Listen | Where-Object LocalPort -in 3000,8788
```

### 2. 管理后台显示 Gateway 未启动

确认 Gateway 健康检查：

```text
http://127.0.0.1:8788/health
```

然后刷新管理后台。

### 3. 端口被占用

Windows：

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000,8788
```

结束确认属于本项目的旧 Node 进程后，再执行 `pnpm dev`。

### 4. 依赖安装时报构建脚本被禁止

项目的 `gateway/pnpm-workspace.yaml` 已声明允许 `ffmpeg-static` 和 `esbuild` 的安装脚本。重新安装依赖即可：

```bash
pnpm --dir gateway install
```

### 5. 生成任务重启后是否还在

Gateway 的任务状态保存在 `gateway/data/local-store.json`，服务重启后会恢复未完成任务。浏览器画布本身仍依赖浏览器 IndexedDB；要跨电脑使用，需要执行画布导出/导入。

## 十一、后台运行（Windows）

如果不希望服务依赖当前终端窗口，可以用“任务计划程序”创建一个登录时运行的任务，执行：

```text
node <项目绝对路径>\scripts\start-local.mjs
```

工作目录设置为项目根目录，并勾选“如果任务失败，重新启动”。不要直接关闭 Gateway 或前端进程，否则另一台电脑无法访问。

