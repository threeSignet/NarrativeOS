import { LLMClient, type Message, type ToolDefinitionForLLM, type ToolCall } from "@narrative-os/llm-client";
import { toolRegistry } from "./registry";
import type { CompanionEvent, ToolContext } from "./types";
import { buildCompanionSystemPrompt } from "./prompts";
import { db, projects } from "@narrative-os/database";
import { eq } from "drizzle-orm";

const MAX_ITERATIONS = 10;

export class CompanionAgent {
  private llm = new LLMClient();

  private async buildSystemPrompt(ctx: ToolContext): Promise<string> {
    // Query project info for dynamic prompt
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, ctx.projectId));

    return buildCompanionSystemPrompt({
      genre: project?.genre || undefined,
      style: project?.style || undefined,
      projectTitle: project?.title || undefined,
      customRules: (project?.customRules as Record<string, unknown>) || undefined,
    });
  }

  async *run(
    messages: Message[],
    ctx: ToolContext
  ): AsyncGenerator<CompanionEvent> {
    const toolDefs = toolRegistry.getToolDefinitions();
    const toolsForLLM: ToolDefinitionForLLM[] = toolDefs.map((d) => ({
      type: "function" as const,
      function: { name: d.name, description: d.description, parameters: d.parameters },
    }));

    const systemPrompt = await this.buildSystemPrompt(ctx);

    const allMessages: Message[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    let iteration = 0;
    let totalToolCalls = 0;

    while (iteration < MAX_ITERATIONS) {
      iteration++;

      let fullText = "";
      let reasoning = "";
      let toolCalls: ToolCall[] | undefined;

      for await (const chunk of this.llm.stream(allMessages, {
        caller: "companion",
        projectId: ctx.projectId,
        sessionId: ctx.sessionId,
        callerRefType: "companion",
        callerRefId: ctx.sessionId,
        tools: toolsForLLM,
        timeoutMs: 120000,
      })) {
        if (chunk.modelInfo) {
          yield { type: "model_info", info: chunk.modelInfo };
        }
        if (chunk.usage) {
          yield { type: "usage", usage: chunk.usage };
        }
        if (!chunk.done && chunk.text) {
          fullText += chunk.text;
          yield { type: "text", content: chunk.text };
        }
        if (chunk.done) {
          if (chunk.usage) yield { type: "usage", usage: chunk.usage };
          toolCalls = chunk.toolCalls;
          if (chunk.reasoning) reasoning = chunk.reasoning;
        }
      }

      if (!toolCalls || toolCalls.length === 0) {
        yield { type: "done", summary: { toolCallsCount: totalToolCalls, iterations: iteration } };
        return;
      }

      // Add assistant message with tool_calls to history
      // DeepSeek V4 thinking mode requires reasoning_content on assistant messages with tool_calls
      const assistantMsg: Message = {
        role: "assistant",
        content: fullText,
        tool_calls: toolCalls,
        reasoning_content: reasoning, // always include, even if empty
      };
      allMessages.push(assistantMsg);

      for (const tc of toolCalls) {
        // Special handling: update_activity is fire-and-forget (no tool_call/tool_result SSE events)
        if (tc.function.name === "update_activity") {
          let activityArgs: Record<string, unknown>;
          try {
            activityArgs = JSON.parse(tc.function.arguments);
          } catch {
            activityArgs = {};
          }
          yield { type: "activity", text: String(activityArgs.text || ""), color: String(activityArgs.color || "#c4b5fd") };
          allMessages.push({ role: "tool", content: "ok", tool_call_id: tc.id });
          continue;
        }

        totalToolCalls++;
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }

        yield { type: "tool_call", id: tc.id, name: tc.function.name, args };

        const tool = toolRegistry.getTool(tc.function.name);
        if (!tool) {
          const errMsg = `Unknown tool: ${tc.function.name}`;
          allMessages.push({ role: "tool", content: JSON.stringify({ error: errMsg }), tool_call_id: tc.id });
          yield { type: "tool_result", id: tc.id, result: { error: errMsg } };
          continue;
        }

        try {
          const result = await tool.execute(args, ctx);
          allMessages.push({ role: "tool", content: JSON.stringify(result.data), tool_call_id: tc.id });
          yield { type: "tool_result", id: tc.id, result: result.data, display: result.display };
        } catch (err: any) {
          const errorResult = { error: err.message };
          allMessages.push({ role: "tool", content: JSON.stringify(errorResult), tool_call_id: tc.id });
          yield { type: "tool_result", id: tc.id, result: errorResult };
        }
      }
    }

    yield { type: "done", summary: { toolCallsCount: totalToolCalls, iterations: iteration } };
  }
}
