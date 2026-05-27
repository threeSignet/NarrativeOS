import { Hono } from "hono";
import { stream } from "hono/streaming";
import { db, sessions } from "@narrative-os/database";
import { handleChat } from "../services/chat";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  const result = await db.insert(sessions).values({
    projectId: body.project_id,
    type: body.type || "hatching",
    title: body.title,
  }).returning();
  return c.json(result[0]);
});

app.post("/:id/messages", async (c) => {
  const sessionId = c.req.param("id");
  let body;
  try {
    body = await c.req.json();
  } catch {
    body = await c.req.parseBody() as Record<string, string>;
  }

  return stream(c, async (s) => {
    s.write(`event: start\n\n`);

    for await (const text of handleChat(sessionId, body.content || body)) {
      if (text === "[DONE]") {
        s.write(`event: end\ndata: [DONE]\n\n`);
        break;
      }
      s.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
  });
});

export default app;
