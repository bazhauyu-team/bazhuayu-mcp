import test from 'node:test';
import assert from 'node:assert/strict';

const {
  hasRequestAuthCredentials
} = await import('../dist/utils/request-auth.js');

test('hasRequestAuthCredentials returns true for jwt bearer token', () => {
  assert.equal(typeof hasRequestAuthCredentials, 'function');
  assert.equal(hasRequestAuthCredentials('Bearer aaa.bbb.ccc', undefined), true);
});

test('hasRequestAuthCredentials returns true for x-api-key header', () => {
  assert.equal(hasRequestAuthCredentials(undefined, 'op_sk_demo_key'), true);
});

test('hasRequestAuthCredentials returns false when no auth headers are present', () => {
  assert.equal(hasRequestAuthCredentials(undefined, undefined), false);
});
