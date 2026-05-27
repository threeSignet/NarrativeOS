import { db, discussions, sessions, projects } from "@narrative-os/database";
import { LLMClient } from "@narrative-os/llm-client";
import { eq } from "drizzle-orm";
import type { Message } from "@narrative-os/llm-client";

let llm: LLMClient | null = null;
function getLLM(): LLMClient {
  if (!llm) llm = new LLMClient();
  return llm;
}

export async function* handleChat(sessionId: string, userContent: string) {
  // 1. 查 session
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });
  if (!session) throw new Error("Session not found");

  // 2. 写 user 消息
  await db.insert(discussions).values({
    projectId: session.projectId,
    sessionId,
    role: "user",
    content: userContent,
  });

  // 3. 查项目信息
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, session.projectId),
  });

  // 4. 组装 messages（Phase 0：只有 system + user input，不读历史）
  const messages: Message[] = [
    {
      role: "system",
      content: `你是一个小说创作助手。当前项目：《${project?.title || "未命名"}》，类型：${project?.genre || "未知"}。请帮助作者完善设定。`,
    },
    { role: "user", content: userContent },
  ];

  // 5. 调 LLM（流式）
  let fullResponse = "";
  for await (const chunk of getLLM().stream(messages, {
    caller: "chat-service",
    projectId: session.projectId,
    sessionId,
    callerRefType: "session",
    callerRefId: sessionId,
  })) {
    if (chunk.done) break;
    fullResponse += chunk.text;
    yield chunk.text;
  }

  // 6. 写 assistant 消息
  await db.insert(discussions).values({
    projectId: session.projectId,
    sessionId,
    role: "assistant",
    content: fullResponse,
  });

  yield "[DONE]";
}
