import test from 'node:test';
import assert from 'node:assert/strict';

process.env.CLIENTAPI_BASE_URL = process.env.CLIENTAPI_BASE_URL || 'https://client-api.example.com';
process.env.OFFICIAL_SITE_URL = process.env.OFFICIAL_SITE_URL || 'https://bazhuayu.example.com';

const messages = (await import('../dist/config/messages.js')).default;
const bzyMessages = (await import('../dist/config/messages.bzy.js')).default;
const opMessages = (await import('../dist/config/messages.op.js')).default;
const { startOrStopTaskTool, searchTasksTool } = await import('../dist/tools/task-tools.js');
const workflowToolsModule = await import('../dist/tools/workflow-tools.js');
const {
  searchTemplateTool,
  executeTaskTool
} = workflowToolsModule;
const { exportDataTool } = await import('../dist/tools/export-data-tool.js');
const { redeemCouponCodeTool } = await import('../dist/tools/marketing-tools.js');

test('bzy and op message variants keep the same task start error keys', () => {
  assert.deepEqual(
    Object.keys(bzyMessages.errors.task.start).sort(),
    Object.keys(opMessages.errors.task.start).sort()
  );
});

test('bzy and op message variants keep the same self-correction keys', () => {
  assert.deepEqual(
    Object.keys(bzyMessages.errors.selfCorrection.cloudTaskPermissionDenied).sort(),
    Object.keys(opMessages.errors.selfCorrection.cloudTaskPermissionDenied).sort()
  );
  assert.deepEqual(
    Object.keys(bzyMessages.errors.selfCorrection.taskAlreadyRunning).sort(),
    Object.keys(opMessages.errors.selfCorrection.taskAlreadyRunning).sort()
  );
  assert.deepEqual(
    Object.keys(bzyMessages.errors.selfCorrection.taskNotRunning).sort(),
    Object.keys(opMessages.errors.selfCorrection.taskNotRunning).sort()
  );
  assert.deepEqual(
    Object.keys(bzyMessages.errors.selfCorrection.insufficientCredits).sort(),
    Object.keys(opMessages.errors.selfCorrection.insufficientCredits).sort()
  );
  assert.deepEqual(
    Object.keys(bzyMessages.errors.selfCorrection.taskNoData).sort(),
    Object.keys(opMessages.errors.selfCorrection.taskNoData).sort()
  );
  assert.deepEqual(
    Object.keys(bzyMessages.errors.selfCorrection.templateLocalOnly).sort(),
    Object.keys(opMessages.errors.selfCorrection.templateLocalOnly).sort()
  );
  assert.deepEqual(
    Object.keys(bzyMessages.errors.selfCorrection.dataExportFailed).sort(),
    Object.keys(opMessages.errors.selfCorrection.dataExportFailed).sort()
  );
  assert.deepEqual(
    Object.keys(bzyMessages.errors.selfCorrection.parameterValidationFailed).sort(),
    Object.keys(opMessages.errors.selfCorrection.parameterValidationFailed).sort()
  );
  assert.deepEqual(
    Object.keys(bzyMessages.errors.selfCorrection.generic).sort(),
    Object.keys(opMessages.errors.selfCorrection.generic).sort()
  );
  assert.deepEqual(
    Object.keys(bzyMessages.errors.selfCorrection.cloudTaskPermissionDenied.body).sort(),
    Object.keys(opMessages.errors.selfCorrection.cloudTaskPermissionDenied.body).sort()
  );
  assert.deepEqual(
    Object.keys(bzyMessages.errors.selfCorrection.templateLocalOnly.body).sort(),
    Object.keys(opMessages.errors.selfCorrection.templateLocalOnly.body).sort()
  );
});

test('self-correction message variants provide shared templates for every scenario', () => {
  const keys = [
    'cloudTaskPermissionDenied',
    'taskAlreadyRunning',
    'taskNotRunning',
    'insufficientCredits',
    'taskNoData',
    'templateLocalOnly',
    'dataExportFailed',
    'parameterValidationFailed',
    'generic'
  ];

  for (const key of keys) {
    assert.equal(typeof opMessages.errors.selfCorrection[key].template, 'string');
    assert.equal(typeof bzyMessages.errors.selfCorrection[key].template, 'string');
  }
});

test('template local-only recovery guidance uses search_templates executionMode in both languages', () => {
  assert.match(opMessages.errors.selfCorrection.templateLocalOnly.template, /executionMode/);
  assert.doesNotMatch(opMessages.errors.selfCorrection.templateLocalOnly.template, /Keep templates where `runOn`/);
  assert.match(bzyMessages.errors.selfCorrection.templateLocalOnly.template, /executionMode/);
  assert.doesNotMatch(bzyMessages.errors.selfCorrection.templateLocalOnly.template, /只保留 `runOn`/);
});

test('start_or_stop_task metadata is sourced from the stable messages entry', () => {
  assert.equal(startOrStopTaskTool.title, messages.tools.startOrStopTask.title);
  assert.equal(startOrStopTaskTool.description, messages.tools.startOrStopTask.description);
});

test('remaining tool metadata is sourced from the stable messages entry', () => {
  assert.equal(searchTasksTool.title, messages.tools.searchTasks.title);
  assert.equal(searchTasksTool.description, messages.tools.searchTasks.description);

  assert.equal(searchTemplateTool.title, messages.tools.searchTemplates.title);
  assert.equal(searchTemplateTool.description, messages.tools.searchTemplates.description);

  assert.equal(exportDataTool.title, messages.tools.exportData.title);
  assert.equal(exportDataTool.description, messages.tools.exportData.description);

  assert.equal(executeTaskTool.title, messages.tools.executeTask.title);
  assert.equal(executeTaskTool.description, messages.tools.executeTask.description);

  assert.equal(redeemCouponCodeTool.title, messages.tools.redeemCouponCode.title);
  assert.equal(redeemCouponCodeTool.description, messages.tools.redeemCouponCode.description);
});

test('search_templates descriptions preserve current AI-facing result field contract', () => {
  for (const description of [
    opMessages.tools.searchTemplates.description,
    bzyMessages.tools.searchTemplates.description
  ]) {
    assert.match(description, /recommendedTemplateName/);
    assert.match(description, /executionMode/);
  }
});

test('task action prompt templates are localized in bzy and op message variants', () => {
  assert.deepEqual(
    Object.keys(bzyMessages.tools.searchTasks.actionPromptTemplates).sort(),
    Object.keys(opMessages.tools.searchTasks.actionPromptTemplates).sort()
  );
  assert.equal(opMessages.tools.searchTasks.actionPromptTemplates.start, 'Try to start or restart task {taskId}.');
  assert.equal(opMessages.tools.searchTasks.actionPromptTemplates.stop, 'Try to stop task {taskId}.');
  assert.equal(bzyMessages.tools.searchTasks.actionPromptTemplates.start, '尝试启动或重新启动任务 {taskId}。');
  assert.equal(bzyMessages.tools.searchTasks.actionPromptTemplates.stop, '尝试停止任务 {taskId}。');
});

test('workflow-tools only exports workflow tools and not the authoritative export_data tool', () => {
  assert.equal('exportDataTool' in workflowToolsModule, false);
});

test('execute_task message metadata reflects task-mode and export follow-up contract', () => {
  assert.match(messages.tools.executeTask.description, /validateOnly/i);
  assert.match(messages.tools.executeTask.description, /accepted/i);
  assert.match(messages.tools.executeTask.description, /MCP Tasks mode/i);
  assert.match(messages.tools.executeTask.description, /tasks\/get/);
  assert.match(messages.tools.executeTask.description, /tasks\/result/);
  assert.match(messages.tools.executeTask.description, /export_data/);
  assert.match(messages.tools.executeTask.description, /targetMaxRows/i);
});

test('execute_task supports MCP tasks optionally so validateOnly can remain a synchronous preflight call', () => {
  assert.equal(executeTaskTool.taskRegistration.execution.taskSupport, 'optional');
  assert.equal(executeTaskTool.plainCallExecution, 'direct');
});
