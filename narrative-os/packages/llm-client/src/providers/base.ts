import type { Message, LLMOptions, LLMStreamChunk } from "../types";

export abstract class BaseProvider {
  abstract readonly name: string;
  abstract streamChat(
    messages: Message[],
    options: LLMOptions,
  ): AsyncGenerator<LLMStreamChunk>;
}
