# 八爪鱼 MCP Server

八爪鱼 MCP Server 用于把八爪鱼云采集能力接入支持 MCP 的 AI 客户端。它提供一组聚焦的工具接口，用于搜索模板、校验参数、创建云采集任务，并导出结构化数据。

当 AI 助手或 Agent 需要将自然语言采集需求转化为八爪鱼任务时，通常会使用以下流程：

```text
search_templates -> execute_task -> export_data
```

![八爪鱼 MCP 工作流概览](https://image.bazhuayu.com/ue2vpx3x.yho.jpg)

## 准备工作

接入客户端前，请准备：

- 一个八爪鱼账号。
- 一个支持 MCP 的客户端，例如 ChatGPT、Claude、Claude Code、Codex CLI、Cursor、VS Code GitHub Copilot 或 Gemini CLI。
- 一种认证方式：
  - OAuth Bearer token，通常由客户端发起浏览器授权流程。
  - API Key，通过 `x-api-key` HTTP 请求头发送。

如果同一个请求同时包含 `Authorization` 和 `x-api-key`，服务端会优先使用 `x-api-key`。

## 快速开始

### 托管 Streamable HTTP 服务

使用以下托管 MCP 服务地址：

```text
https://mcp.bazhuayu.com
```

MCP 客户端应连接根地址。该服务使用 MCP Streamable HTTP，不应配置成普通 REST API 工具。

### OAuth 连接

#### 适用场景

当客户端支持浏览器授权时，优先使用 OAuth。该模式适合托管客户端和交互式开发工具，用户通过八爪鱼授权流程完成登录和授权。

#### Claude Code

添加托管 MCP 服务：

```bash
claude mcp add --transport http bazhuayu https://mcp.bazhuayu.com
```

在 Claude Code 会话中打开 MCP 菜单：

```text
/mcp
```

选择已配置的 `bazhuayu` 服务，然后选择 `Authorize`。

#### Codex CLI

添加托管 MCP 服务：

```bash
codex mcp add bazhuayu --url https://mcp.bazhuayu.com
```

在 Codex 会话中打开 MCP 菜单：

```text
/mcp
```

选择已配置的八爪鱼服务，然后选择 `Authorize` 完成授权。

#### 通用配置

对于支持 HTTP MCP server 配置的客户端，可以使用：

```json
{
  "mcpServers": {
    "bazhuayu": {
      "type": "http",
      "url": "https://mcp.bazhuayu.com"
    }
  }
}
```

客户端收到 MCP OAuth challenge 后，应发起浏览器授权流程。

#### 授权完成后

授权完成后，客户端应能列出八爪鱼 MCP 工具。如果工具没有出现，请重新连接 MCP 服务或重启客户端。

### API Key 连接

#### 适用场景

当客户端可以发送自定义 HTTP 请求头时，可以使用 API Key。该模式适合 CLI 客户端、内部工具和自动化环境，前提是 API Key 能被安全保存。

必需请求头：

```text
x-api-key: YOUR_API_KEY
```

#### Claude Code

添加带 API Key 请求头的 MCP 服务：

```bash
claude mcp add --transport http --header "x-api-key: YOUR_API_KEY" bazhuayu https://mcp.bazhuayu.com
```

在 Claude Code 中打开 MCP 菜单确认服务状态：

```text
/mcp
```

#### Codex CLI

建议将 API Key 存放在环境变量中，并通过 `env_http_headers` 发送：

```toml
[mcp_servers.bazhuayu]
url = "https://mcp.bazhuayu.com"

[mcp_servers.bazhuayu.env_http_headers]
"x-api-key" = "BAZHUAYU_API_KEY"
```

启动 Codex CLI 前设置环境变量：

```bash
export BAZHUAYU_API_KEY="YOUR_API_KEY"
```

#### 通用配置

对于支持 JSON MCP 配置的客户端，添加 `x-api-key` 请求头：

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

#### 配置完成后

配置完成后，请重启或重新连接 MCP 客户端。此时客户端应能直接初始化服务，不需要再跳转 OAuth 授权页面。

### 客户端配置

#### ChatGPT

1. 打开 Settings。
2. 进入 Apps and Connectors。
3. 如果工作区要求，启用 Developer Mode。
4. 创建新的 app。
5. 设置 MCP URL：

   ```text
   https://mcp.bazhuayu.com
   ```

6. 如果页面要求填写 OAuth Client ID 和 Client Secret，可以留空。
7. 保存后按页面提示完成浏览器授权。

#### Claude

1. 打开 Connectors 或 Integrations 设置。
2. 添加自定义 connector。
3. 输入：

   ```text
   https://mcp.bazhuayu.com
   ```

4. 点击 Connect，并完成授权。

#### Claude Code

使用上文的 OAuth 或 API Key 命令完成配置，然后在会话中输入 `/mcp`，确认 `bazhuayu` 服务可用且已完成授权。

#### Codex CLI

使用上文的 OAuth 命令，或在 `~/.codex/config.toml` 中配置 API Key。修改配置后，重新启动 Codex CLI，并通过 `/mcp` 确认服务状态。

#### Cursor

1. 打开 Cursor Settings。
2. 进入 Tools and MCP。
3. 添加新的 MCP server。
4. 将服务配置为 HTTP MCP server：

   ```json
   {
     "mcpServers": {
       "bazhuayu": {
         "type": "http",
         "url": "https://mcp.bazhuayu.com"
       }
     }
   }
   ```

5. 如果使用 API Key 认证，添加 `x-api-key` 请求头：

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

6. 保存配置后，在 Cursor Agent 模式中确认八爪鱼工具可用。

#### VS Code

可以使用 VS Code 的 MCP 配置文件或命令面板完成配置。工作区配置文件可以放在 `.vscode/mcp.json`：

```json
{
  "servers": {
    "bazhuayu": {
      "type": "http",
      "url": "https://mcp.bazhuayu.com"
    }
  }
}
```

如果使用 API Key 认证：

```json
{
  "servers": {
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

保存文件后，在 VS Code MCP Servers 视图中启动服务，并在 GitHub Copilot Agent 模式中使用。

## 工具选择

默认情况下，MCP 会话会暴露全部公开工具。

只暴露核心采集流程工具：

```text
https://mcp.bazhuayu.com?includeTools=search_templates,execute_task,export_data
```

隐藏指定工具：

```text
https://mcp.bazhuayu.com?excludeTools=redeem_coupon_code
```

工具选择在 MCP 初始化时生效。修改 URL 参数后，需要重新连接客户端。

推荐工具集合：

| 场景 | 工具 |
| --- | --- |
| 标准采集流程 | `search_templates`、`execute_task`、`export_data` |
| 已有任务查询和导出 | `search_tasks`、`export_data` |
| 已有任务控制 | `search_tasks`、`start_or_stop_task` |
| 资源码或优惠码兑换 | `redeem_coupon_code` |

## 可用工具

| 工具 | 默认启用 | 用途 |
| --- | --- | --- |
| `search_templates` | 是 | 搜索八爪鱼模板库。 |
| `execute_task` | 是 | 校验参数，创建任务并启动云采集。 |
| `export_data` | 是 | 导出任务结果，返回预览数据和下载链接。 |
| `search_tasks` | 是 | 搜索当前授权账号下已有任务。 |
| `start_or_stop_task` | 是 | 启动或停止已有云采集任务。 |
| `redeem_coupon_code` | 是 | 兑换优惠码、促销码或资源码。 |

### `search_templates`

在创建采集任务前搜索八爪鱼模板库。

每次调用只能使用一种选择方式：

- `keyword`：按主题、网站或使用场景搜索。
- `id`：按模板 ID 精确查询。
- `slug`：按模板 slug 或别名精确查询。

关键词搜索会返回匹配模板，并在可能时返回 `recommendedTemplateName`。精确查询可以返回模板的 `inputSchema`、source-backed 选项和输出字段信息。

优先选择 execution mode 支持云采集的模板。

### `execute_task`

校验模板参数，创建任务，并启动云采集。

重要参数：

- `templateName`：来自 `search_templates` 的模板名称。
- `parameters`：业务参数，必须使用 `inputSchema[].field` 作为 key。
- `taskName`：可选的任务名称，便于后续恢复和识别。
- `validateOnly`：为 `true` 时只校验参数，不创建任务。
- `targetMaxRows`：MCP Tasks 模式下的可选停止阈值，属于尽力而为。

对于 source-backed 字段，应传入选项的 `key`。对于 MultiInput 字段，即使只有一个值，也应传入 `string[]`。

如果客户端支持 MCP Tasks，`execute_task` 可以以 task 模式运行，并通过 MCP task API 跟进进度。如果客户端不支持 MCP Tasks，该工具会返回已启动的八爪鱼 `taskId`，客户端可在约 10-30 秒后调用 `export_data`。

### `export_data`

在任务采集完成后导出数据。

输入参数：

- `taskId`：来自 `execute_task` 或已有八爪鱼任务。
- `exportFileType`：`EXCEL`、`CSV`、`HTML`、`JSON` 或 `XML`，默认是 `JSON`。
- `previewRows`：返回的预览行数，默认 5 行，最多 20 行。

可能返回的状态：

- `collecting`：任务仍在采集。
- `exporting`：导出文件仍在生成。
- `exported`：导出完成。
- `no_data`：导出完成，但没有采集到数据。

如果返回 `sampleData`，客户端应优先以表格形式展示。如果返回 `exportFileUrl`，应始终展示给用户。

### `search_tasks`

搜索当前授权账号下已有的八爪鱼任务。

支持筛选：

- `keyword`
- `status`：`Running`、`Stopped`、`Completed` 或 `Failed`
- `taskIds`
- `page` 和 `size`

当用户已有任务但不知道准确 `taskId` 时，可以先调用该工具，再继续导出或控制任务。

### `start_or_stop_task`

启动或停止已有八爪鱼云采集任务。

输入参数：

- `taskId`
- `action`：`start` 或 `stop`

工具会返回请求是否已接受、任务是否已经运行或停止，以及是否因为权限、余额或任务状态需要用户处理。

### `redeem_coupon_code`

为当前用户兑换优惠码、促销码或资源码。

输入参数：

- `code`

仅当用户已经提供兑换码并希望领取权益时使用。

## 资源与 UI

服务端注册了 MCP 资源：

```text
bazhuayu://workflow
```

该资源说明核心采集流程和参数规则，供支持 MCP resources 的客户端读取。

服务端也可以为支持的客户端提供 UI 元数据，例如模板搜索结果和任务搜索结果的可视化展示。实际渲染能力取决于客户端。

## 长任务

云采集是异步执行过程。服务端在配置启用时支持 MCP Tasks。

当 MCP Tasks 可用时：

- `execute_task` 可以创建 MCP task。
- 客户端可以通过 `tasks/get` 或 `tasks/result` 跟进进度。
- `targetMaxRows` 可以请求达到行数阈值后停止任务，但该行为是尽力而为。

当 MCP Tasks 不可用时：

- `execute_task` 会启动八爪鱼云云采集任务并返回 `accepted`。
- 等待约 10-30 秒。
- 使用返回的 `taskId` 调用 `export_data`。

## 会话与安全

服务端使用 MCP 会话，并保持请求作用域认证。

安全特性：

- OAuth 模式使用 `Authorization` 请求头。
- API Key 模式使用 `x-api-key`。
- 如果两种认证同时存在，API Key 优先。
- Redis 会话元数据不会保存原始 JWT 或原始 API Key。
- 会话恢复时，客户端仍需要在当前请求中提供有效认证。
- 八爪鱼 API 访问会在每次请求中按需创建。
- 共享 HTTP 客户端不会保存固定的用户认证请求头。

## 限制与性能

任务能否成功取决于账号权限、余额、额度、模板是否支持云采集、目标网站状态和导出状态。

部分模板只支持本地采集，无法通过云端 MCP Server 运行。此时应使用八爪鱼客户端运行或调试模板。

`targetMaxRows` 是尽力而为。由于停止动作依赖轮询和下游任务状态，最终采集行数可能超过请求阈值。

## 故障排查

### Unauthorized

确认客户端发送了以下任一认证信息：

```text
Authorization: Bearer YOUR_TOKEN
```

或：

```text
x-api-key: YOUR_API_KEY
```

排查问题时，建议只保留一种认证方式。

### 找不到合适模板

尝试使用更具体的关键词，例如目标网站、数据类型、地区或业务场景。优先选择支持云采集的模板。

### 缺少参数

先使用 `validateOnly=true` 调用 `execute_task`。根据返回的 `inputSchema` 和 source options 组装 `parameters`。

### 导出还没准备好

如果 `export_data` 返回 `collecting` 或 `exporting`，等待 10-30 秒后，使用同一个 `taskId` 和 `exportFileType` 再次调用。

### Session not found

重新连接 MCP 客户端，并确认新请求仍然携带认证信息。启用 Redis 恢复时，Redis 只保存会话元数据；当前请求仍然需要提供认证。

### 客户端看不到选择的工具

检查 `includeTools` 和 `excludeTools` URL 参数。工具选择在 MCP 初始化时生效，修改 URL 后需要重新连接客户端。

## 支持与资源

- [八爪鱼官网](https://www.bazhuayu.com/)
- [八爪鱼客户端下载](https://www.bazhuayu.com/download)
