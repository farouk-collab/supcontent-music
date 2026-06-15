import assert from "node:assert/strict";

const apiBase = (process.env.SUPCONTENT_API_BASE || "http://localhost:1234").replace(/\/$/, "");
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const password = "DemoTest!2026";
const accounts = [];

async function request(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function register(label) {
  const account = {
    email: `e2e-${label}-${runId}@supcontent.local`,
    displayName: `E2E ${label} ${runId.slice(-6)}`,
  };
  const payload = await request("/auth/register", {
    method: "POST",
    body: { ...account, password },
  });

  const result = {
    ...account,
    id: payload.user.id,
    token: payload.accessToken,
  };
  accounts.push(result);
  return result;
}

async function waitForNotification(token, expectedKind, action) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`${apiBase}/notifications/stream`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    assert.equal(response.status, 200, "Le flux SSE doit être accessible");
    assert.ok(response.body, "Le flux SSE doit fournir un corps de réponse");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let actionStarted = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        throw new Error("Le flux SSE a été fermé avant la notification attendue");
      }

      buffer += decoder.decode(value, { stream: true });
      if (!actionStarted && buffer.includes("event: ready")) {
        actionStarted = true;
        await action();
      }

      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        if (!block.includes("event: notification")) continue;
        const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        const event = JSON.parse(dataLine.slice(6));
        if (event.kind === expectedKind) {
          controller.abort();
          return event;
        }
      }
    }
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function cleanup() {
  for (const account of accounts.reverse()) {
    try {
      await request("/auth/me", { method: "DELETE", token: account.token });
    } catch (error) {
      console.warn(`Nettoyage impossible pour ${account.email}: ${error.message}`);
    }
  }
}

try {
  const health = await request("/health");
  assert.equal(health.ok, true);

  const alice = await register("alice");
  const bob = await register("bob");

  const followEvent = await waitForNotification(bob.token, "follow", () =>
    request(`/follows/${bob.id}`, { method: "POST", token: alice.token }),
  );
  assert.equal(followEvent.actorId, alice.id);
  await request(`/follows/${alice.id}`, { method: "POST", token: bob.token });

  const reviewPayload = await request(`/social/media/track/e2e-${runId}/reviews`, {
    method: "POST",
    token: alice.token,
    body: { rating: 5, body: "Critique créée par la recette automatisée." },
  });

  const commentPayload = await request(`/social/reviews/${reviewPayload.review.id}/comments`, {
    method: "POST",
    token: bob.token,
    body: { body: "Commentaire de test." },
  });

  const replyEvent = await waitForNotification(bob.token, "comment_reply", () =>
    request(`/social/reviews/${reviewPayload.review.id}/comments`, {
      method: "POST",
      token: alice.token,
      body: {
        body: "Réponse de test.",
        parent_comment_id: commentPayload.comment.id,
      },
    }),
  );
  assert.equal(replyEvent.actorId, alice.id);

  const threadPayload = await request("/chat/threads", {
    method: "POST",
    token: alice.token,
    body: { target_user_id: bob.id },
  });
  const chatEvent = await waitForNotification(bob.token, "chat_message", () =>
    request(`/chat/threads/${threadPayload.thread.id}/messages`, {
      method: "POST",
      token: alice.token,
      body: { message_type: "text", body: "Message de recette." },
    }),
  );
  assert.equal(chatEvent.actorId, alice.id);

  const collectionPayload = await request("/collections", {
    method: "POST",
    token: alice.token,
    body: { name: `Recette ${runId}`, is_public: true },
  });
  await request(`/collections/${collectionPayload.collection.id}/items`, {
    method: "POST",
    token: alice.token,
    body: {
      media_type: "media",
      media_id: `e2e-${runId}`,
      item_kind: "media",
      external_source: "direct",
      title: "Piste de recette",
      source_url: "https://example.com/audio.mp3",
    },
  });

  const productPayload = await request("/shop/products", {
    method: "POST",
    token: bob.token,
    body: {
      title: `Instrumentale ${runId}`,
      type: "beat",
      genre: "Hip-hop",
      description: "Produit de recette automatisée.",
      license: "standard",
      price: 19.99,
      bpm: 96,
    },
  });
  await request("/shop/cart/items", {
    method: "POST",
    token: alice.token,
    body: { productId: productPayload.product.id },
  });
  const checkout = await request("/shop/checkout", {
    method: "POST",
    token: alice.token,
  });
  assert.equal(checkout.order.status, "paid");

  const notifications = await request("/notifications/me", { token: bob.token });
  assert.ok(notifications.followers.some((item) => item.id === alice.id));
  assert.ok(notifications.comment_replies.length >= 1);
  assert.ok(notifications.chat_messages.length >= 1);

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiBase,
        verified: [
          "inscription de deux comptes",
          "suivi mutuel et notification SSE",
          "critique, commentaire et réponse",
          "messagerie et notification SSE",
          "collection et ajout d'une piste",
          "produit, panier et commande de démonstration",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await cleanup();
}
