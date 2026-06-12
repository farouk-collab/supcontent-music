import test from "node:test";
import assert from "node:assert/strict";

import { parseEmbeddedMediaLink } from "../../apps/web/src/lib/mediaParsers.js";

test("parses youtube playlists", () => {
  assert.deepEqual(
    parseEmbeddedMediaLink("https://www.youtube.com/playlist?list=PLbpi6ZahtOH6Ar_3GPy3workFmzvH3EKPF"),
    {
      type: "youtube-playlist",
      id: "PLbpi6ZahtOH6Ar_3GPy3workFmzvH3EKPF",
      source: "YouTube",
    }
  );
});

test("parses spotify albums", () => {
  assert.deepEqual(
    parseEmbeddedMediaLink("https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc"),
    {
      type: "spotify-album",
      id: "2noRn2Aes5aoNVsU6iWThc",
      source: "Spotify",
    }
  );
});

test("rejects unsupported links", () => {
  assert.equal(parseEmbeddedMediaLink("https://example.com/file.pdf"), null);
});
