import test from 'node:test';
import assert from 'node:assert/strict';

process.env.CLIENTAPI_BASE_URL = process.env.CLIENTAPI_BASE_URL || 'https://client-api.example.com';
process.env.OFFICIAL_SITE_URL = process.env.OFFICIAL_SITE_URL || 'https://bazhuayu.example.com';

const { SelfCorrectionErrorBuilder } = await import('../dist/errors/self-correction-errors.js');
const messages = (await import('../dist/config/messages.js')).default;

function renderTemplate(template, variables) {
  return template.replace(/\{(\w+)\}/g, (_match, key) => String(variables[key] ?? ''));
}

test('SelfCorrectionErrorBuilder is exposed from the errors domain', () => {
  assert.equal(typeof SelfCorrectionErrorBuilder.cloudTaskPermissionDenied, 'function');
});

test('cloudTaskPermissionDenied uses the shared messages entry for its title text', () => {
  const result = SelfCorrectionErrorBuilder.cloudTaskPermissionDenied({
    currentAccountLevel: 1,
    allowedAccountLevels: [3, 31]
  });

  assert.match(
    result.content[0].text,
    new RegExp(messages.errors.selfCorrection.cloudTaskPermissionDenied.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
  assert.match(
    result.content[0].text,
    new RegExp(
      renderTemplate(messages.errors.selfCorrection.cloudTaskPermissionDenied.body.rootCause, {
        currentAccountLevel: 1,
        currentLevelName: 'Free'
      }).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
  );
});

test('taskAlreadyRunning uses the shared messages entry for its title text', () => {
  const result = SelfCorrectionErrorBuilder.taskAlreadyRunning({
    taskId: 'task-1',
    taskName: 'Task 1'
  });

  assert.match(
    result.content[0].text,
    new RegExp(messages.errors.selfCorrection.taskAlreadyRunning.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
});

test('taskNotRunning uses the shared messages entry for its title text', () => {
  const result = SelfCorrectionErrorBuilder.taskNotRunning({
    taskId: 'task-2',
    taskName: 'Task 2',
    currentStatus: 'Stopped'
  });

  assert.match(
    result.content[0].text,
    new RegExp(messages.errors.selfCorrection.taskNotRunning.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
});

test('insufficientCredits uses the shared messages entry for its title text', () => {
  const result = SelfCorrectionErrorBuilder.insufficientCredits({
    taskId: 'task-3',
    currentBalance: 10,
    estimatedCost: 25
  });

  assert.match(
    result.content[0].text,
    new RegExp(messages.errors.selfCorrection.insufficientCredits.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
});

test('taskNoData uses the shared messages entry for its title text', () => {
  const result = SelfCorrectionErrorBuilder.taskNoData({
    taskId: 'task-4',
    taskName: 'Task 4',
    hasRunBefore: false
  });

  assert.match(
    result.content[0].text,
    new RegExp(messages.errors.selfCorrection.taskNoData.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
});

test('templateLocalOnly uses the shared messages entry for its title text', () => {
  const result = SelfCorrectionErrorBuilder.templateLocalOnly({
    taskId: 'task-5',
    templateId: 42,
    templateName: 'Amazon Product Scraper'
  });

  assert.match(
    result.content[0].text,
    new RegExp(messages.errors.selfCorrection.templateLocalOnly.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
  assert.match(
    result.content[0].text,
    new RegExp(messages.errors.selfCorrection.templateLocalOnly.body.taskLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
  assert.match(
    result.content[0].text,
    new RegExp(
      renderTemplate(messages.errors.selfCorrection.templateLocalOnly.body.rootCause, {
        templateId: 42,
        templateName: 'Amazon Product Scraper'
      }).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
  );
});

test('dataExportFailed uses the shared messages entry for its title text', () => {
  const result = SelfCorrectionErrorBuilder.dataExportFailed({
    taskId: 'task-6',
    taskName: 'Task 6',
    errorMessage: 'network timeout'
  });

  assert.match(
    result.content[0].text,
    new RegExp(messages.errors.selfCorrection.dataExportFailed.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
});

test('parameterValidationFailed uses the shared messages entry for its title text', () => {
  const result = SelfCorrectionErrorBuilder.parameterValidationFailed({
    parameterName: 'SearchKeyword',
    providedValue: 123,
    expectedFormat: 'string',
    example: 'iphone',
    tool: 'execute_task'
  });

  assert.match(
    result.content[0].text,
    new RegExp(messages.errors.selfCorrection.parameterValidationFailed.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
});

test('generic uses the shared messages entry for its title text', () => {
  const result = SelfCorrectionErrorBuilder.generic({
    operation: 'starting task',
    errorMessage: 'unknown failure',
    recoverySuggestion: 'Retry later.'
  });

  assert.match(
    result.content[0].text,
    new RegExp(messages.errors.selfCorrection.generic.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
});
