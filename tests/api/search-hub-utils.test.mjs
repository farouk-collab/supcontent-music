import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  deriveTitleFromUrl,
  inferMediaTypeFromUrl,
  inferSourceFromUrl,
  parseEmbeddedMediaLink,
} = require("../../apps/api/dist/lib/searchHub.js");

test("detects direct audio and video links", () => {
  assert.equal(inferMediaTypeFromUrl("https://cdn.example.com/audio/demo.mp3"), "audio");
  assert.equal(inferMediaTypeFromUrl("https://cdn.example.com/video/demo.mp4"), "video");
});

test("infers supported sources from external urls", () => {
  assert.equal(inferSourceFromUrl("https://open.spotify.com/track/abc123"), "spotify");
  assert.equal(inferSourceFromUrl("https://youtu.be/dQw4w9WgXcQ"), "youtube");
  assert.equal(inferSourceFromUrl("https://cdn.example.com/video/demo.mp4"), "mp4");
});

test("parses spotify and youtube embeds", () => {
  assert.deepEqual(
    parseEmbeddedMediaLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123"),
    {
      type: "youtube-video",
      id: "dQw4w9WgXcQ",
      listId: "PL123",
      source: "YouTube",
      originalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123",
    }
  );

  assert.deepEqual(
    parseEmbeddedMediaLink("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"),
    {
      type: "spotify-playlist",
      id: "37i9dQZF1DXcBWIGoYBM5M",
      source: "Spotify",
      originalUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    }
  );
});

test("derives a readable fallback title from direct media urls", () => {
  assert.equal(
    deriveTitleFromUrl("https://cdn.example.com/audio/Ma%20demo.mp3", "Media importe"),
    "Ma demo.mp3"
  );
});
