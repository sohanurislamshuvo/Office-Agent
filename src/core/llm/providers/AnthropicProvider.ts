import Anthropic from '@anthropic-ai/sdk';
import { LLMMessage, LLMProvider, LLMResponse, LLMToolCall, LLMToolDefinition } from '../types';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  async generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName: string = 'claude-sonnet-4-20250514'
  ): Promise<LLMResponse> {
    const anthropicMessages = this.mapMessages(messages);

    const anthropicTools = tools?.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
    }));

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: modelName,
      max_tokens: 4096,
      messages: anthropicMessages,
    };

    if (systemInstruction) {
      params.system = systemInstruction;
    }
    if (anthropicTools && anthropicTools.length > 0) {
      params.tools = anthropicTools;
    }

    const result = await this.client.messages.create(params);

    let content: string | null = null;
    const toolCalls: LLMToolCall[] = [];

    for (const block of result.content) {
      if (block.type === 'text') {
        content = (content || '') + block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          }
        });
      }
    }

    const usage = {
      promptTokens: result.usage.input_tokens,
      completionTokens: result.usage.output_tokens,
      totalTokens: result.usage.input_tokens + result.usage.output_tokens,
    };

    return {
      content,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
      finishReason: result.stop_reason || undefined,
      raw: result,
      request: {
        contents: anthropicMessages,
        systemInstruction,
        tools: anthropicTools,
      }
    };
  }

  private mapMessages(messages: LLMMessage[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      if (msg.role === 'tool' && msg.name) {
        // Anthropic expects tool results as user messages with tool_result content blocks
        const toolUseId = this.findToolUseId(messages, msg.name);
        result.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: msg.content,
          }],
        });
        continue;
      }

      if (msg.role === 'assistant') {
        const contentBlocks: Anthropic.ContentBlockParam[] = [];

        if (msg.content) {
          contentBlocks.push({ type: 'text', text: msg.content });
        }

        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            contentBlocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input: JSON.parse(tc.function.arguments),
            });
          }
        }

        if (contentBlocks.length > 0) {
          result.push({ role: 'assistant', content: contentBlocks });
        }
        continue;
      }

      // User message — may include images
      if (msg.images && msg.images.length > 0) {
        const contentBlocks: Anthropic.ContentBlockParam[] = [];
        if (msg.content) {
          contentBlocks.push({ type: 'text', text: msg.content });
        }
        for (const img of msg.images) {
          const base64Match = img.match(/^data:(image\/[a-z]+);base64,(.+)$/);
          if (base64Match) {
            contentBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: base64Match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Match[2],
              },
            });
          } else {
            contentBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: img,
              },
            });
          }
        }
        result.push({ role: 'user', content: contentBlocks });
      } else {
        result.push({ role: 'user', content: msg.content });
      }
    }

    return result;
  }

  private findToolUseId(messages: LLMMessage[], toolName: string): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'assistant' && m.tool_calls) {
        const tc = m.tool_calls.find(tc => tc.function.name === toolName);
        if (tc) return tc.id;
      }
    }
    return `toolu_${Math.random().toString(36).substring(7)}`;
  }
}
