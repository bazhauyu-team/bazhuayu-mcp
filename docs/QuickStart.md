# QuickStart：连接八爪鱼 MCP Server

> English: [quickstart.en.md](quickstart.en.md)

这份文档面向 MCP 客户端集成方，帮助你把八爪鱼 MCP Server 接入 ChatGPT、Claude、OpenClaw、Cursor、VS Code GitHub Copilot、Gemini CLI、Claude Code 或 Codex CLI，并跑通一次模板搜索、任务创建和数据导出流程。

如果你还不了解 MCP 或八爪鱼 MCP 的定位，可以先阅读 [Overview](Overview.md)。

## 1. 准备

### 1.1 八爪鱼账号

你需要一个八爪鱼账号。

任意八爪鱼账号都可以连接 MCP。免费版和基础版用户每周可获得 2,000 条 MCP 采集免费记录，开始使用不需要先升级套餐。

### 1.2 支持 MCP 的客户端

准备一个 MCP-compatible client，例如：

- ChatGPT
- Claude
- OpenClaw
- Cursor
- VS Code GitHub Copilot
- Gemini CLI
- Claude Code
- Codex CLI

## 2. 配置

### 2.1 服务地址

中文版服务地址：

```text
https://mcp.bazhuayu.com
```

### 2.2 使用 Claude Code 配置（推荐）

OAuth 方式：

```bash
claude mcp add --transport http bazhuayu https://mcp.bazhuayu.com
```

API Key 方式：

```bash
claude mcp add --transport http --header "x-api-key: your-api-key" bazhuayu https://mcp.bazhuayu.com
```

### 2.3 手动修改 Claude Code 配置（备选）

如果不使用 `claude mcp add` 命令，也可以手动修改 Claude Code 的用户级配置文件。该文件通常位于：

```text
~/.claude.json
```

可加入如下配置：

```json
{
  "mcpServers": {
    "bazhuayu": {
      "type": "http",
      "url": "https://mcp.bazhuayu.com",
      "headers": {
        "x-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

### 2.4 使用 Codex CLI 配置

Codex CLI 的 MCP 配置文件通常位于：

```text
~/.codex/config.toml
```

OAuth 方式：

```toml
[mcp_servers.bazhuayu]
url = "https://mcp.bazhuayu.com"
```

API Key 方式建议通过环境变量保存密钥，并通过 `x-api-key` 请求头发送：

```toml
[mcp_servers.bazhuayu]
url = "https://mcp.bazhuayu.com"

[mcp_servers.bazhuayu.env_http_headers]
"x-api-key" = "BAZHUAYU_API_KEY"
```

然后在启动 Codex CLI 前设置环境变量：

```bash
export BAZHUAYU_API_KEY="your-api-key"
```

也可以用命令添加 OAuth 连接：

```bash
codex mcp add bazhuayu --url https://mcp.bazhuayu.com
```

## 3. 使用

核心工具有 3 个：

- `search_templates`：用于模板搜索
- `execute_task`：用于创建任务前的参数校验，以及创建并启动任务
- `export_data`：用于导出数据

### 3.1 search_templates：搜索模板

可以直接向客户端提问：

```text
有没有 微博 模板？
```

客户端会调用 `search_templates` 查找可用模板。优先使用返回结果中的推荐模板。

预期结果：客户端会展示一个或多个相关模板，并说明推荐使用哪个模板。如果没有合适的云端模板，通常会提示你换关键词或选择其他模板。

### 3.2 execute_task：创建并启动任务

继续对客户端说：

```text
使用第一个模板。我要抓取 DeepSeek、Claude、OpenAI 这三个关键词
```

客户端会调用 `execute_task`。该工具会根据模板参数创建云任务，并启动采集。

补充提示：如果客户端或工作流需要先确认参数，可以让它先使用 `validateOnly=true` 做参数预检，再正式创建任务。

预期结果：任务创建成功后，客户端会告诉你任务已经启动，或返回可继续跟进的任务信息。如果参数缺失，客户端会提示需要补充哪些字段。

### 3.3 export_data：导出数据

任务启动后，对客户端说：

```text
导出刚才的任务数据为 csv 格式。
```

执行此命令会在云端执行数据导出操作。等待导出完成后，工具会返回表格预览数据和下载链接。

预期结果：导出完成后，你会看到少量表格预览数据和下载链接。如果任务仍在采集或导出中，客户端会提示稍后重试。

### 3.4 一句话完成整个流程

也可以直接一句话完成模板搜索、任务创建和数据导出：

```text
我想要采集微博搜索模板，关键词是 DeepSeek Claude OpenAI 这三个，然后导出 csv 格式数据给我
```

## 4. 补充说明

### 4.1 OAuth 认证

在 ChatGPT 网页版和 Claude 网页版配置好 MCP 之后，OAuth 方式会自动跳转到八爪鱼登录授权页面。登录后点击允许即可完成授权。

在 Codex CLI 和 Claude Code 中配置好 MCP 之后，可以在会话里输入：

```text
/mcp
```

然后选择配置好的 MCP 服务，并选择 `Authorize` 完成授权。

### 4.2 ChatGPT 配置指导

1. 打开 Apps/Connectors 设置

   进入 Settings -> Apps & Connectors。部分界面也可以从个人头像进入 Customize ChatGPT。

2. 启用 Developer Mode

   进入 Advanced settings，打开 Developer Mode (Beta)。

3. 创建八爪鱼 app

   点击 Create app。Name 填写 `八爪鱼`，MCP URL 填写 `https://mcp.bazhuayu.com`。OAuth Client ID 和 Secret 留空，确认提示后创建 app。

4. 通过 OAuth 授权

   ChatGPT 会跳转到八爪鱼。登录并点击 Allow。

### 4.3 Claude 网页版配置指导

1. 打开 Connectors 设置

   在 Claude 侧边栏进入 Customize -> Connectors。部分团队或旧界面可能显示为 Settings -> Integrations。

2. 添加服务地址

   点击添加按钮，选择 Add custom connector，输入：

   ```text
   https://mcp.bazhuayu.com
   ```

3. 通过 OAuth 授权

   点击 Connect。浏览器会打开授权窗口，登录并点击 Allow。

### 4.4 API Key 与 JWT 同时存在

如果同一个请求同时带有 `x-api-key` 和 `Authorization`，服务端会优先使用 `x-api-key`。建议一个客户端只配置一种认证方式，方便排查问题。

## 5. 常见问题

### OAuth 授权没有跳转或授权失败

确认 MCP 服务地址填写正确。中文版应使用：

```text
https://mcp.bazhuayu.com
```

如果是在 Claude Code 或 Codex CLI 中配置 OAuth，进入会话后输入 `/mcp`，选择对应服务，再选择 `Authorize`。

### API Key 方式返回未授权

检查请求头是否为 `x-api-key`，并确认 API Key 没有多余空格。Claude Code 命令中应类似：

```bash
claude mcp add --transport http --header "x-api-key: your-api-key" bazhuayu https://mcp.bazhuayu.com
```

### 找不到合适模板

换一个更具体的关键词再试。例如把“社媒”改成“微博搜索”，把“商品”改成具体平台或商品类型。模板是否可用也取决于当前模板库和云运行支持情况。

### 任务创建时提示参数缺失

让客户端先执行参数预检，或明确告诉客户端使用哪个模板、关键词、地区、链接等必要信息。不同模板需要的参数不同。

### 导出时暂时没有数据

任务可能仍在采集或导出中。等待一段时间后，再让客户端导出刚才的任务数据。
