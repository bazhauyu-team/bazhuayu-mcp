const lines = (...segments: string[]) => segments.join('\n');

const messages = {
  errors: {
    task: {
      start: {
        noPermission: '没有权限启动，只有模板任务才能使用试用额度来启动。请升级套餐为团队版或企业版。'
      }
    },
    selfCorrection: {
      cloudTaskPermissionDenied: {
        title: '错误：当前账号没有权限运行云采集任务。',
        body: {
          rootCause:
            '你当前的账号等级是 {currentAccountLevel}（{currentLevelName}），没有权限执行云采集任务。',
          requiredLevels:
            '云采集任务需要以下账号等级之一：{allowedLevelNames}。'
        },
        template: lines(
          '{title}',
          '',
          '[根因]:',
          '{rootCause}',
          '',
          '{requiredLevels}',
          '',
          '[为什么会这样]:',
          '云采集任务会占用 八爪鱼 云端资源，因此会受到账号等级限制。',
          '',
          '[建议告诉用户]:',
          '"你当前的 {currentLevelName} 账号还不能运行云采集任务。你可以先开通试用、升级套餐，或者改用桌面端本地执行。"',
          '',
          '[可执行操作]:',
          '1. 试用入口：{trialUrl}',
          '2. 升级套餐：{upgradeUrl}',
          '3. 桌面端下载：{downloadUrl}',
          '',
          '[技术信息]:',
          '- 当前账号等级：{currentAccountLevel}（{currentLevelName}）',
          '- 所需等级：{allowedAccountLevels}（{allowedLevelNames}）',
          '- 试用链接：{trialUrl}',
          '- 升级链接：{upgradeUrl}',
          '- 下载链接：{downloadUrl}',
          '',
          '[不要这样做]:',
          '- 不要在用户未升级或未开通试用前继续尝试启动云任务。',
          '- 不要只说“检查权限”而不给出下一步操作。'
        )
      },
      taskAlreadyRunning: {
        title: '错误：任务正在运行中。',
        template: lines(
          '{title}',
          '',
          '[根因]:',
          '任务“{taskId}”{taskNameSuffix} 当前正在云端执行。',
          '运行中的任务不能再次启动。',
          '',
          '[建议告诉用户]:',
          '“这个任务已经在运行中。你可以查看进度、停止后重启，或者继续监控它。”',
          '',
          '[恢复步骤]:',
          '1. 用 `export_data(taskId: "{taskId}")` 查看进度或预览数据。',
          '2. 如果用户要重启，先用 `start_or_stop_task(taskId: "{taskId}", action: "stop")` 停止当前运行。',
          '3. 只有在用户要新建模板任务时才使用 `execute_task`。',
          '',
          '[技术信息]:',
          '- 任务 ID：{taskId}',
          '{taskNameDetail}',
          '- 当前状态：Running',
          '',
          '[不要这样做]:',
          '- 不要直接再次启动同一个正在运行的任务。',
          '- 不要默认用户一定要重启。'
        )
      },
      taskNotRunning: {
        title: '错误：任务当前未在运行。',
        template: lines(
          '{title}',
          '',
          '[根因]:',
          '任务“{taskId}”{taskNameSuffix} 当前并未执行。',
          '{statusLine}',
          '未运行的任务不能被停止。',
          '',
          '[建议告诉用户]:',
          '“这个任务当前没有在运行。你可以启动它、查看状态，或者如果它已经跑完了就尝试导出数据。”',
          '',
          '[恢复步骤]:',
          '1. 用 `start_or_stop_task(taskId: "{taskId}", action: "start")` 启动已有任务。',
          '2. 如果任务可能已经完成，可用 `export_data(taskId: "{taskId}")` 查看。',
          '3. 如果需要别的模板，可用 `search_templates`。',
          '',
          '[技术信息]:',
          '- 任务 ID：{taskId}',
          '{taskNameDetail}',
          '{currentStatusDetail}',
          '',
          '[不要这样做]:',
          '- 不要说这个任务已经被成功停止。',
          '- 不要对同一个未运行任务重复执行 stop。'
        )
      },
      insufficientCredits: {
        title: '错误：启动任务所需积分不足。',
        template: lines(
          '{title}',
          '',
          '[根因]:',
          '当前账号没有足够积分来执行该任务。',
          '{currentBalanceLine}',
          '{estimatedCostLine}',
          '',
          '[需要用户操作]:',
          '用户需要先充值积分或升级套餐，然后才能继续启动任务。',
          '',
          '[建议告诉用户]:',
          '“你的账号积分不足，暂时无法运行这个任务。请先充值或升级套餐后再试。”',
          '',
          '[技术信息]:',
          '{taskIdDetail}',
          '{currentBalanceDetail}',
          '{estimatedCostDetail}',
          '',
          '[不要这样做]:',
          '- 不要在积分不足的情况下重复发起同样的启动请求。',
          '- 不要建议不存在的绕过方式。'
        )
      },
      taskNoData: {
        title: '错误：没有可导出的数据。',
        template: lines(
          '{title}',
          '',
          '[根因]:',
          '任务“{taskId}”{taskNameSuffix} 当前没有可导出的数据。',
          '{hasRunBeforeExplanation}',
          '',
          '[建议告诉用户]:',
          '{userMessage}',
          '',
          '[恢复步骤]:',
          '{recoverySteps}',
          '',
          '[技术信息]:',
          '- 任务 ID：{taskId}',
          '{taskNameDetail}',
          '- 是否运行过：{hasRunBeforeLabel}',
          '',
          '[不要这样做]:',
          '- 不要只说导出失败而不解释“当前没有新数据”。',
          '- 不要在没有新数据前重复导出。'
        )
      },
      templateLocalOnly: {
        title: '错误：该任务无法在云端启动。',
        body: {
          taskLabel: '[任务]:',
          rootCause:
            '该任务使用的模板 ID 为 {templateId}（"{templateName}"），其 runOn=1（仅本地）。',
          executionConstraint:
            'runOn=1 的模板只能在用户本地电脑上的 八爪鱼 桌面应用中执行。'
        },
        template: lines(
          '{title}',
          '',
          '{taskLabel}',
          '"{taskId}"',
          '',
          '[根因]:',
          '{rootCause}',
          '{executionConstraint}',
          '该模板不支持云端执行。',
          '',
          '[建议告诉用户]:',
          '“这个任务使用的是仅本地模板。你可以改用桌面端执行，或者换成支持云端的模板。”',
          '',
          '[恢复步骤]:',
          '1. 用 `search_templates(keyword: "{websiteHint}")` 查找支持云端的替代模板。',
          '2. 优先使用 `recommendedTemplateName`；否则选择 `executionMode` 包含 "Cloud" 的模板。',
          '3. 选中后用 `execute_task` 创建并启动新的云任务。',
          '',
          '[技术信息]:',
          '- 任务 ID：{taskId}',
          '- 模板 ID：{templateId}',
          '- 模板名称：{templateName}',
          '- Template runOn: 1 (Local Only)',
          '{accountLimitDetail}',
          '',
          '[不要这样做]:',
          '- 不要再次尝试在云端启动这个仅本地模板。',
          '- 不要建议修改任务级别的执行模式。'
        )
      },
      dataExportFailed: {
        title: '错误：通过 API 导出任务数据失败。',
        template: lines(
          '{title}',
          '',
          '[根因]:',
          'MCP 服务端无法从任务“{taskId}”{taskNameSuffix} 导出数据。',
          '错误详情：{errorMessage}',
          '',
          '[建议告诉用户]:',
          '“通过 API 导出失败了，但数据仍然可以在 八爪鱼 控制台中查看和下载。请使用下面的控制台链接继续操作。”',
          '',
          '[兜底方式]:',
          '- 控制台链接：{consoleUrl}',
          '',
          '[技术信息]:',
          '- 任务 ID：{taskId}',
          '{taskNameDetail}',
          '- 控制台链接：{consoleUrl}',
          '- 错误：{errorMessage}',
          '',
          '[不要这样做]:',
          '- 不要告诉用户数据丢失了。',
          '- 不要承诺重试 API 导出一定立即成功。'
        )
      },
      parameterValidationFailed: {
        title: '错误：参数校验失败。',
        template: lines(
          '{title}',
          '',
          '[参数]:',
          '"{parameterName}"',
          '',
          '[根因]:',
          '提供的参数值{toolSuffix}不符合预期格式。',
          '提供值：{providedValuePretty}',
          '预期格式：{expectedFormat}',
          '',
          '[如何修复]:',
          '1. 按照预期格式重新构造参数。',
          '2. 参考示例值：{example}',
          '3. 如果仍不确定，就向用户确认。',
          '',
          '[技术信息]:',
          '- 参数名：{parameterName}',
          '{toolDetail}',
          '- 提供值：{providedValueCompact}',
          '- 预期：{expectedFormat}',
          '- 示例：{example}',
          '',
          '[不要这样做]:',
          '- 不要用同样的非法值重复重试。',
          '- 不要编造参数值。'
        )
      },
      generic: {
        title: '错误：操作执行失败。',
        template: lines(
          '{title}',
          '',
          '[操作]:',
          '{operation}',
          '',
          '[错误信息]:',
          '{errorMessage}',
          '',
          '[恢复建议]:',
          '{recoverySuggestion}',
          '',
          '[建议告诉用户]:',
          '“我在执行 {operation} 时遇到了问题。{recoverySuggestion}”'
        )
      }
    }
  },
  tools: {
    startOrStopTask: {
      title: '启动或停止任务',
      description: '通过 taskId 启动或停止现有的 八爪鱼 任务。使用 action=`start` 或 `stop`。'
    },
    searchTasks: {
      title: '搜索任务',
      description:
        '搜索当前用户已有的 八爪鱼 任务。可在调用 export_data 或 start_or_stop_task 之前用它查找 taskId。支持分页、关键词、状态和显式 taskIds 过滤。如果已经展示 UI 列表，回复中只给简短摘要，不要重复完整任务列表。',
      actionPromptTemplates: {
        start: '尝试启动或重新启动任务 {taskId}。',
        stop: '尝试停止任务 {taskId}。'
      }
    },
    searchTemplates: {
      title: '搜索模板',
      description:
        '在调用 `execute_task` 前先找到合适的 八爪鱼 模板。必须且只能使用一种选择方式：`keyword` 用于搜索，`id` 用于精确模板 id，`slug` 用于精确别名。关键词模式返回 `recommendedTemplateName`、标准化的 `templates[]` 和轻量级 source summaries；每个模板包含 `templateName` 以及面向 AI 的 `executionMode`，例如 "Cloud"、"Local only" 或 "Cloud and local"。精确查询会返回包含完整 `inputSchema` 的单个 `template`，若模板带有 source-backed 字段，还可能返回根级 `sourceOptions`。当存在 `outputSchema` 时，它描述了模板可采集的字段，也可作为后续模板链路的候选输入。优先使用 `recommendedTemplateName`，或选择 `executionMode` 包含 "Cloud" 的模板；仅本地模板会附带桌面端提示。',
      useTemplatePromptTemplate: '我想要使用 [{templateName}] 模板来执行采集，请帮我准备需要传入的参数。'
    },
    exportData: {
      title: '导出数据',
      description:
        '为一个已有的 bazhuayu `taskId` 在执行完成后导出数据。该工具仍可能返回 `collecting`、`exporting`、`exported` 或 `no_data`，但如果任务来自 `execute_task`，在执行完成前应优先使用 MCP `tasks/get` 和 `tasks/result` 跟进运行状态。如果状态是 `collecting` 或 `exporting`，等待 10-30 秒后再次调用 `export_data`。默认最多返回 5 行预览。如果存在 `sampleData`，无论 `exportFileType` 是什么（包括 `JSON`），都应以表格形式展示，并默认优先使用它。除非用户明确要求基于文件提取，否则不要下载或解析 `exportFileUrl`。只要结果里存在 `exportFileUrl`，就应始终向用户展示它。'
    },
    executeTask: {
      title: '校验参数或启动云任务',
      description:
        '这个工具有两种模式：`validateOnly=true` 会同步校验 `templateName` 和参数，但不创建任务；正常执行则会创建并启动一个 bazhuayu 云任务。建议传入 `taskName`，这样如果客户端在拿到 task id 前断开，后续还能更安全地恢复同一次运行。validate-only 结果会返回 `status`、`canExecuteNow`、`blockingIssues` 和 `nextAction`，因此 success 也可能表示“当前还不能直接执行”。\n\n对于非 `validateOnly` 调用，只要客户端支持 MCP task，MCP Tasks 模式就是首选推荐。如果客户端支持 MCP task，应使用 task 模式调用 `execute_task`，并用 `tasks/get` 和 `tasks/result` 跟进运行状态。direct call 仅作为兼容性兜底路径，供 MCP task 支持不足的客户端使用；在该兜底路径下，`execute_task` 会在创建并启动成功后立即返回 `accepted` 和 bazhuayu `taskId`，后续应等待约 10-30 秒后再调用 `export_data(taskId)`，把它作为采集进度和导出进度的轮询入口，而不是在同一个请求里等待最终完成。仍兼容旧别名 `slug`。\n\n`parameters` 是 JSON 对象字符串，用来兼容无法发送 object 类型参数的 MCP 客户端，例如 `"{\\"search_keyword\\":[\\"phone\\"],\\"site\\":\\"United States\\"}"`。服务端会先校验它能解析成 JSON 对象，校验通过才会执行。`targetMaxRows` 是 MCP task 模式下的可选阈值停止控制。传入正整数时，服务端会在 extractedCount 达到阈值后尽力请求 `stopTask`，但它不是硬上限，因为轮询和停止请求都是 best-effort。`targetMaxRows=0` 或省略该字段，都表示不启用阈值停止，让任务自然运行到结束。参数必须使用 `inputSchema[].field` 作为 key。对于 source-backed 字段，先从精确模板查询获取根级 `sourceOptions`，再从 `validateOnly=true` 的结果中获取依赖级 `sourceOptions`，并把选中的 option `key` 作为字段值传入。MultiInput 字段必须使用 `string[]`，即使只有一个值也一样。未映射的 key 会以 `unmapped_parameters` 失败。'
    },
    redeemCouponCode: {
      title: '兑换优惠码',
      description:
        '为当前用户兑换促销码、优惠券或资源码。当用户已经给出兑换码并希望领取权益时使用。回复时必须直接使用结果中的 `displayMessage` 原文，不要自行改写。'
    }
  }
};

export default messages;
