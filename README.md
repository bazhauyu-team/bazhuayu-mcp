# bazhuayu MCP Server

> [🇺🇸 English](README.en.md) | 🇨🇳 中文

这是一个面向 AI 工作流重新收敛后的 bazhuayu MCP Server。

当前 server 只保留 3 个核心 tools：

1. `search_templates`
2. `execute_task`
3. `export_data`

设计目标是减少调用链长度、降低 token 消耗、让模型更容易走通稳定的抓取工作流。

## 工作流

固定主链路：

`search_templates` → `execute_task` → `export_data`

说明：

- `search_templates` 负责按关键词搜索模板，并返回 `recommendedTemplate`
- `execute_task` 是同名双模式工具：`validateOnly=true` 时同步做参数预检；真正执行时会创建并启动 bazhuayu 云任务
- `export_data` 是非 task 客户端的后续跟进入口，也是在任务完成后拿导出元信息、预览数据和下载入口的统一工具

## 当前能力

### `search_templates`

- 返回云可运行模板
- 区分 API relevance 排序和 likes 排序
- 返回 `recommendedTemplate`
- 当最佳匹配是 local-only 模板时，明确给出桌面端引导

### `execute_task`

- 输入只需要 `templateName + parameters`
- 服务端自动补齐 UIParameters / TemplateParameters 的配对结构
- 支持 `validateOnly=true`，只做同步预检，不创建任务
- 支持可选 MCP task 模式
- task 模式下，用 `tasks/get` / `tasks/result` 跟进运行状态
- 非 task 模式下，create/start 成功后立即返回 `accepted + taskId`，后续调用 `export_data(taskId)`
- 支持 `targetMaxRows`
- `targetMaxRows > 0` 只在 task 模式下生效，用于阈值停止
- `targetMaxRows = 0` 或省略字段表示自然运行到结束

### `export_data`

- 默认 `preview` 不返回行数据，只返回导出元信息和 `viewAndExportUrl`
- 需要小规模预览时，传 `previewRows`
- 提供 `maxInlineRecords` 时返回更多内联行；`mode=inline` / `mode=summary` 可显式指定导出形态
- `mode=summary` 只返回列信息和样例行
- 预览数据中的字段值超过 200 个字符时，会截断为前 194 个字符并追加 `......`
- 任务还在运行时返回 `executing`，提示稍后重试
- 仅在 preview / inline 模式且本次返回了全部 pending rows 时才会 `markExported`

## 运行要求

- Node.js 18+
- npm 9+
- 可访问 bazhuayu Client API

## 安装

```bash
npm install
```

## 常用环境变量

```env
NODE_ENV=development
PORT=8080
HOST=0.0.0.0

SERVER_NAME=bazhuayu-mcp-server
SERVER_VERSION=1.0.0

CLIENTAPI_BASE_URL=https://pre-v2-clientapi.bazhuayu.com
OFFICIAL_SITE_URL=https://pre.bazhuayu.com

HTTP_TIMEOUT=30000
HTTP_RETRIES=3
HTTP_RETRY_DELAY=1000

SEARCH_TEMPLATE_PAGE_SIZE=8
EXECUTE_TASK_POLL_MAX_MINUTES=10

TRANSPORT_IDLE_TTL_SECONDS=1800
TRANSPORT_CLEANUP_INTERVAL_SECONDS=300

LOG_LEVEL=debug
LOG_ENABLE_CONSOLE=true
```

## 启动

```bash
npm run build
npm run start
```

开发环境：

```bash
npm run dev
```

## MCP 接入

服务监听：

- `POST /`
- `GET /`
- `DELETE /`

健康检查：

- `GET /hc`
- `GET /liveness`

认证方式：

- `Authorization: Bearer <token>`
- 或 `X-API-Key: <api-key>`

## Tool 示例

### 1. 搜索模板

```json
{
  "tool": "search_templates",
  "arguments": {
    "keyword": "amazon"
  }
}
```

### 2. 仅校验参数，不创建任务

```json
{
  "tool": "execute_task",
  "arguments": {
    "templateName": "amazon-product-scraper",
    "validateOnly": true,
    "parameters": {
      "SearchKeyword": ["iphone"]
    }
  }
}
```

### 3. 仅启动云任务，立即返回 `accepted`

```json
{
  "tool": "execute_task",
  "arguments": {
    "templateName": "amazon-product-scraper",
    "parameters": {
      "SearchKeyword": ["iphone"]
    }
  }
}
```

### 4. task 模式下按阈值停止

```json
{
  "tool": "execute_task",
  "arguments": {
    "templateName": "amazon-product-scraper",
    "parameters": {
      "SearchKeyword": ["iphone"]
    },
    "targetMaxRows": 100
  }
}
```

说明：

- 这条调用应使用 MCP task augmentation
- `targetMaxRows > 0` 时，服务端会在后台轮询并尽力在阈值处请求 `stopTask`
- `targetMaxRows = 0` 表示不启用阈值停止

### 5. 摘要导出

```json
{
  "tool": "export_data",
  "arguments": {
    "taskId": "your-task-id",
    "mode": "summary"
  }
}
```

### 6. 预览少量数据

```json
{
  "tool": "export_data",
  "arguments": {
    "taskId": "your-task-id",
    "previewRows": 3
  }
}
```

## 调试与验证

```bash
npm run build
npm test
```

当前测试覆盖重点：

- 模板推荐与 local-only 引导
- `execute_task.validateOnly`
- `execute_task` 的 non-task `accepted` 路径
- `targetMaxRows=0` 的自然完成语义
- 缺参与错参校验
- `export_data.summary` 不触发 `markExported`
- 默认 `export_data` 不返回预览行；传 `previewRows` 时返回经过截断处理的少量预览数据

## 设计取向

这个版本优先保证两件事：

1. 对模型来说更稳定：少工具、少低层参数、少误调用
2. 对服务端来说更稳定：更短调用链、更紧的 transport 生命周期、更轻的日志、更清晰的错误结构
