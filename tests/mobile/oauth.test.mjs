import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGoogleOAuthTokens } from '../../apps/mobile/src/oauth.mjs';

test('extracts Google OAuth tokens from a valid callback URL', () => {
  const tokens = extractGoogleOAuthTokens(
    'supcontentmusic://auth/callback?accessToken=abc&refreshToken=def&oauth=google'
  );

  assert.deepEqual(tokens, { accessToken: 'abc', refreshToken: 'def' });
});

test('ignores non-Google or incomplete callback URLs', () => {
  assert.equal(
    extractGoogleOAuthTokens('supcontentmusic://auth/callback?accessToken=abc&refreshToken=def&oauth=github'),
    null
  );
  assert.equal(
    extractGoogleOAuthTokens('supcontentmusic://auth/callback?accessToken=abc&oauth=google'),
    null
  );
});
