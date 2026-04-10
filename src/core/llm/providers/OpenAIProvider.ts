import OpenAI from 'openai';
import { LLMMessage, LLMProvider, LLMResponse, LLMToolCall, LLMToolDefinition } from '../types';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  async generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName: string = 'gpt-4o'
  ): Promise<LLMResponse> {
    const openaiMessages = this.mapMessages(messages, systemInstruction);

    const openaiTools = tools?.map(t => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      }
    }));

    const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: modelName,
      messages: openaiMessages,
    };
    if (openaiTools && openaiTools.length > 0) {
      params.tools = openaiTools;
    }

    const result = await this.client.chat.completions.create(params);

    const choice = result.choices[0];
    const content = choice?.message?.content || null;
    let toolCalls: LLMToolCall[] = [];

    if (choice?.message?.tool_calls) {
      toolCalls = choice.message.tool_calls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        }
      }));
    }

    const usage = result.usage ? {
      promptTokens: result.usage.prompt_tokens || 0,
      completionTokens: result.usage.completion_tokens || 0,
      totalTokens: result.usage.total_tokens || 0,
    } : undefined;

    return {
      content,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
      finishReason: choice?.finish_reason || undefined,
      raw: result,
      request: {
        contents: openaiMessages,
        systemInstruction,
        tools: openaiTools,
      }
    };
  }

  private mapMessages(messages: LLMMessage[], systemInstruction?: string): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemInstruction) {
      result.push({ role: 'system', content: systemInstruction });
    }

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      if (msg.role === 'tool' && msg.name) {
        // Find the matching tool_call id from the previous assistant message
        const toolCallId = this.findToolCallId(messages, msg.name);
        result.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: toolCallId,
        });
        continue;
      }

      if (msg.role === 'assistant') {
        const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
        };

        if (msg.content) {
          assistantMsg.content = msg.content;
        }

        if (msg.tool_calls && msg.tool_calls.length > 0) {
          assistantMsg.tool_calls = msg.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            }
          }));
        }

        result.push(assistantMsg);
        continue;
      }

      // User message — may include images
      if (msg.images && msg.images.length > 0) {
        const contentParts: OpenAI.ChatCompletionContentPart[] = [];
        if (msg.content) {
          contentParts.push({ type: 'text', text: msg.content });
        }
        for (const img of msg.images) {
          const dataUrl = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
          contentParts.push({
            type: 'image_url',
            image_url: { url: dataUrl },
          });
        }
        result.push({ role: 'user', content: contentParts });
      } else {
        result.push({ role: 'user', content: msg.content });
      }
    }

    return result;
  }

  private findToolCallId(messages: LLMMessage[], toolName: string): string {
    // Walk backward to find the assistant message that called this tool
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'assistant' && m.tool_calls) {
        const tc = m.tool_calls.find(tc => tc.function.name === toolName);
        if (tc) return tc.id;
      }
    }
    return `call_${Math.random().toString(36).substring(7)}`;
  }
}
