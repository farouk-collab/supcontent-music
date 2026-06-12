import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildOauthSuccessRedirect,
  decodeOauthReturnTo,
} = require("../../apps/api/dist/lib/oauth.js");

test("decodeOauthReturnTo falls back cleanly on invalid payload", () => {
  assert.equal(decodeOauthReturnTo("not-base64", "http://localhost:4173"), "http://localhost:4173");
});

test("buildOauthSuccessRedirect normalizes web targets to auth page", () => {
  const redirect = buildOauthSuccessRedirect("http://localhost:4173/profil", "http://localhost:4173", {
    oauth: "google",
    accessToken: "a",
    refreshToken: "b",
  });

  const url = new URL(redirect);
  assert.equal(url.origin, "http://localhost:4173");
  assert.equal(url.pathname, "/connexion/connexion.html");
  assert.equal(url.searchParams.get("oauth"), "google");
});

test("buildOauthSuccessRedirect preserves custom mobile deep links", () => {
  const redirect = buildOauthSuccessRedirect("supcontentmusic://auth/callback", "http://localhost:4173", {
    oauth: "google",
    accessToken: "a",
    refreshToken: "b",
  });

  const url = new URL(redirect);
  assert.equal(url.protocol, "supcontentmusic:");
  assert.equal(url.hostname, "auth");
  assert.equal(url.pathname, "/callback");
  assert.equal(url.searchParams.get("refreshToken"), "b");
});
