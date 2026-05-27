import { Hono } from "hono";
import { stream } from "hono/streaming";
import { LLMClient } from "@narrative-os/llm-client";
import type { Message } from "@narrative-os/llm-client";

const app = new Hono();

const SYSTEM_PROMPT = `你是一位资深小说创意总监。用户会提供一个小说的基本信息（标题、类型、风格、目标字数），你需要基于这些信息，为用户生成 3~5 个各具特色的核心创意方向。

要求：
1. 每个方向包含：方向名称、一句话概述（20字以内）、核心卖点、差异点
2. 方向之间要有明显差异，覆盖不同的叙事角度、主题深度、情感基调
3. 语言精炼有力，像对作者说话一样直接

输出严格的 JSON 数组格式，不要输出其他任何内容：
[
  {
    "name": "方向名称",
    "summary": "一句话概述",
    "hook": "核心卖点",
    "diff": "与其他方向的差异"
  }
]`;

interface BrainstormInput {
  title: string;
  genre: string;
  style?: string;
  target_words?: number;
}

/**
 * POST /brainstorm/stream
 * 流式生成创意方向
 */
app.post("/stream", async (c) => {
  const body = await c.req.json<BrainstormInput>();

  if (!body.title || !body.genre) {
    return c.json({ error: "title and genre are required" }, 400);
  }

  const llm = new LLMClient();

  const userPrompt = [
    `小说标题：${body.title}`,
    `类型：${body.genre}`,
    body.style ? `风格：${body.style}` : "",
    body.target_words ? `目标字数：${body.target_words.toLocaleString()} 字` : "",
  ].filter(Boolean).join("\n");

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  return stream(c, async (s) => {
    let fullText = "";
    try {
      for await (const chunk of llm.stream(messages, {
        caller: "brainstorm",
        tier: "lightweight",
        temperature: 0.8,
      })) {
        if (chunk.done) break;
        fullText += chunk.text;
        s.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }

      // 尝试解析 JSON
      let directions: unknown[] = [];
      try {
        const jsonMatch = fullText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          directions = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // LLM 输出可能不是有效 JSON，返回原始文本
      }

      s.write(`event: done\ndata: ${JSON.stringify({
        raw: fullText,
        directions,
      })}\n\n`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      s.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    }
  });
});

/**
 * POST /brainstorm
 * 非流式生成创意方向
 */
app.post("/", async (c) => {
  const body = await c.req.json<BrainstormInput>();

  if (!body.title || !body.genre) {
    return c.json({ error: "title and genre are required" }, 400);
  }

  const llm = new LLMClient();

  const userPrompt = [
    `小说标题：${body.title}`,
    `类型：${body.genre}`,
    body.style ? `风格：${body.style}` : "",
    body.target_words ? `目标字数：${body.target_words.toLocaleString()} 字` : "",
  ].filter(Boolean).join("\n");

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  let fullText = "";
  for await (const chunk of llm.stream(messages, {
    caller: "brainstorm",
    tier: "lightweight",
    temperature: 0.8,
  })) {
    if (chunk.done) break;
    fullText += chunk.text;
  }

  let directions: unknown[] = [];
  try {
    const jsonMatch = fullText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      directions = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // fallback to raw text
  }

  return c.json({
    raw: fullText,
    directions,
  });
});

export default app;
