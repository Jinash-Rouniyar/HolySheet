import 'server-only';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

/**
 * Provider registry. Claude is primary (best tool-use + extended thinking);
 * OpenAI is the fallback. Model ids are env-overridable so the deployment can
 * track the latest frontier model without a code change.
 */
export function getModel(): LanguageModel {
  const provider =
    process.env.AGENT_PROVIDER ??
    (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai');

  if (provider === 'openai') {
    return openai(process.env.AGENT_MODEL ?? 'gpt-4o');
  }
  return anthropic(process.env.AGENT_MODEL ?? 'claude-sonnet-4-5');
}

export function isAnthropic(): boolean {
  const provider =
    process.env.AGENT_PROVIDER ??
    (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai');
  return provider === 'anthropic';
}

/**
 * Extended-thinking provider options. Only Anthropic supports this; passing it
 * to other providers is ignored by the AI SDK. Streamed thinking deltas surface
 * as `thinking_delta` events for the collapsible Thinking block.
 */
export function thinkingOptions(): Record<string, unknown> | undefined {
  if (!isAnthropic()) return undefined;
  const budget = Number(process.env.AGENT_THINKING_BUDGET ?? 6000);
  if (!Number.isFinite(budget) || budget <= 0) return undefined;
  return {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: budget },
    },
  };
}
