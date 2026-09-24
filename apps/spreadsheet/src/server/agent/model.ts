import 'server-only';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

/** Terra by default: Luna drops too many sheet tools. Sol via AGENT_MODEL=gpt-5.6-sol. */
function resolveProvider(): 'openai' | 'anthropic' {
  const explicit = process.env.AGENT_PROVIDER?.toLowerCase();
  if (explicit === 'openai' || explicit === 'anthropic') return explicit;
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'openai';
}

export function getModel(): LanguageModel {
  const provider = resolveProvider();
  if (provider === 'openai') {
    const id = process.env.AGENT_MODEL ?? 'gpt-5.6-terra';
    // Chat Completions cannot combine function tools with reasoning traces.
    return openai.responses(id);
  }
  return anthropic(process.env.AGENT_MODEL ?? 'claude-sonnet-4-5');
}

export function isAnthropic(): boolean {
  return resolveProvider() === 'anthropic';
}

/** Maps to the same thinking_delta UI on both providers. */
export function thinkingOptions(): Record<string, unknown> | undefined {
  if (isAnthropic()) {
    const budget = Number(process.env.AGENT_THINKING_BUDGET ?? 6000);
    if (!Number.isFinite(budget) || budget <= 0) return undefined;
    return {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: budget },
      },
    };
  }

  const effort = (process.env.AGENT_REASONING_EFFORT ?? 'medium').toLowerCase();
  if (effort === 'none' || effort === '0' || effort === 'off') return undefined;
  return {
    openai: {
      reasoningEffort: effort,
      // `auto` often yields an empty summary on Terra/Sol.
      reasoningSummary: process.env.AGENT_REASONING_SUMMARY ?? 'detailed',
    },
  };
}
