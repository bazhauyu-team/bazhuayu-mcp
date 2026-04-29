import test from 'node:test';
import assert from 'node:assert/strict';

const {
  extractBearerToken,
  looksLikeJwtToken,
  extractApiKeyFromHeaders
} = await import('../dist/utils/request-auth.js');

test('extractApiKeyFromHeaders prefers x-api-key', () => {
  const apiKey = extractApiKeyFromHeaders('Bearer ignored-token', 'op_sk_header_value');
  assert.equal(apiKey, 'op_sk_header_value');
});

test('extractApiKeyFromHeaders accepts opaque bearer token as api key', () => {
  const apiKey = extractApiKeyFromHeaders('Bearer op_sk_bearer_value', undefined);
  assert.equal(apiKey, 'op_sk_bearer_value');
});

test('extractApiKeyFromHeaders keeps JWT-like bearer token for JWT flow', () => {
  const jwtLike = 'aaa.bbb.ccc';
  assert.equal(looksLikeJwtToken(jwtLike), true);
  const apiKey = extractApiKeyFromHeaders(`Bearer ${jwtLike}`, undefined);
  assert.equal(apiKey, undefined);
});

test('extractBearerToken trims standard bearer prefix', () => {
  assert.equal(extractBearerToken('Bearer   abc123   '), 'abc123');
});
