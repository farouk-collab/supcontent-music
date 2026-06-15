import type { Response } from "express";

export type NotificationEvent = {
  kind: "follow" | "comment_reply" | "chat_message" | "refresh";
  actorId?: string;
  resourceId?: string;
};

const clients = new Map<string, Set<Response>>();

function writeEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function subscribeToNotifications(userId: string, res: Response) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const userClients = clients.get(userId) || new Set<Response>();
  userClients.add(res);
  clients.set(userId, userClients);
  writeEvent(res, "ready", { connected: true });

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 25000);

  return () => {
    clearInterval(heartbeat);
    userClients.delete(res);
    if (!userClients.size) clients.delete(userId);
  };
}

export function publishNotification(userId: string, event: NotificationEvent) {
  const userClients = clients.get(userId);
  if (!userClients?.size) return 0;
  for (const client of userClients) {
    writeEvent(client, "notification", {
      ...event,
      createdAt: new Date().toISOString(),
    });
  }
  return userClients.size;
}
