/**
 * Tests for @elvatis_com/agent-backends
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(() => '/usr/bin/claude'),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
  };
});

import { execSync } from 'child_process';
import * as fs from 'fs';
import {
  formatPrompt,
  buildMinimalEnv,
  buildBackendConfig,
  ensureGitRepo,
  detectInstalledClis,
  type ChatMessage,
} from '../index';

describe('@elvatis_com/agent-backends', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ── formatPrompt ──────────────────────────────────────────────────────

  describe('formatPrompt', () => {
    it('returns empty for no messages', () => {
      expect(formatPrompt([])).toBe('');
    });

    it('returns plain text for single user message', () => {
      expect(formatPrompt([{ role: 'user', content: 'Hello' }])).toBe('Hello');
    });

    it('formats multi-role conversation with labels', () => {
      const msgs: ChatMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ];
      const result = formatPrompt(msgs);
      expect(result).toContain('[System]');
      expect(result).toContain('[User]');
      expect(result).toContain('[Assistant]');
    });

    it('handles content parts array', () => {
      const msgs: ChatMessage[] = [{
        role: 'user',
        content: [{ type: 'text', text: 'Part A' }, { type: 'text', text: 'Part B' }],
      }];
      expect(formatPrompt(msgs)).toContain('Part A');
      expect(formatPrompt(msgs)).toContain('Part B');
    });

    it('truncates long messages', () => {
      const result = formatPrompt([{ role: 'user', content: 'x'.repeat(5000) }]);
      expect(result.length).toBeLessThan(5000);
      expect(result).toContain('truncated');
    });

    it('keeps system message even with many user messages', () => {
      const msgs: ChatMessage[] = [
        { role: 'system', content: 'SYSTEM' },
        ...Array.from({ length: 25 }, (_, i) => ({ role: 'user' as const, content: `M${i}` })),
      ];
      const result = formatPrompt(msgs);
      expect(result).toContain('SYSTEM');
      expect(result).toContain('M24');
    });

    it('handles null/undefined content', () => {
      expect(formatPrompt([{ role: 'user', content: null }])).toBe('');
      expect(formatPrompt([{ role: 'user', content: undefined }])).toBe('');
    });

    it('handles object content', () => {
      const result = formatPrompt([{ role: 'user', content: { key: 'val' } }]);
      expect(result).toContain('key');
    });
  });

  // ── buildMinimalEnv ───────────────────────────────────────────────────

  describe('buildMinimalEnv', () => {
    it('sets NO_COLOR and TERM', () => {
      const env = buildMinimalEnv();
      expect(env.NO_COLOR).toBe('1');
      expect(env.TERM).toBe('dumb');
    });

    it('passes through PATH', () => {
      const env = buildMinimalEnv();
      if (process.env.PATH) expect(env.PATH).toBe(process.env.PATH);
    });

    it('passes through API keys when set', () => {
      const orig = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'sk-test';
      expect(buildMinimalEnv().ANTHROPIC_API_KEY).toBe('sk-test');
      if (orig) process.env.ANTHROPIC_API_KEY = orig;
      else delete process.env.ANTHROPIC_API_KEY;
    });

    it('omits unset env vars', () => {
      const orig = process.env.CODEX_API_KEY;
      delete process.env.CODEX_API_KEY;
      expect(buildMinimalEnv().CODEX_API_KEY).toBeUndefined();
      if (orig) process.env.CODEX_API_KEY = orig;
    });
  });

  // ── buildBackendConfig ────────────────────────────────────────────────

  describe('buildBackendConfig', () => {
    it('builds gemini config', () => {
      const c = buildBackendConfig('cli-gemini/gemini-2.5-pro', 'prompt', '/ws');
      expect(c.cmd).toBe('gemini');
      expect(c.args).toContain('gemini-2.5-pro');
      expect(c.stdinPrompt).toBe('prompt');
      expect(c.cwd).toBe('/ws');
      expect(c.shell).toBe(false);
    });

    it('gemini defaults cwd to tmpdir', () => {
      const c = buildBackendConfig('cli-gemini/gemini-2.5-flash', 'p');
      expect(c.cwd).toBeTruthy();
      expect(c.cwd).not.toBe('');
    });

    it('builds claude config with correct flags', () => {
      const c = buildBackendConfig('cli-claude/claude-sonnet-4-6', 'p', '/ws');
      expect(c.cmd).toBe('claude');
      expect(c.args).toContain('--permission-mode');
      expect(c.args).toContain('plan');
      expect(c.args).toContain('claude-sonnet-4-6');
    });

    it('builds codex config with shell=true', () => {
      (fs.existsSync as any).mockReturnValue(false);
      const c = buildBackendConfig('openai-codex/gpt-5.3-codex', 'p', '/ws');
      expect(c.cmd).toBe('codex');
      expect(c.shell).toBe(true);
      expect(c.args).toContain('--full-auto');
    });

    it('codex calls ensureGitRepo when workdir set', () => {
      (fs.existsSync as any).mockReturnValue(false);
      buildBackendConfig('openai-codex/gpt-5.3-codex', 'p', '/ws');
      expect(execSync).toHaveBeenCalledWith('git init', expect.objectContaining({ cwd: '/ws' }));
    });

    it('builds opencode config (prompt in args, empty stdin)', () => {
      const c = buildBackendConfig('opencode/default', 'my prompt');
      expect(c.cmd).toBe('opencode');
      expect(c.args).toContain('my prompt');
      expect(c.stdinPrompt).toBe('');
    });

    it('builds pi config (prompt in args, empty stdin)', () => {
      const c = buildBackendConfig('pi/default', 'my prompt');
      expect(c.cmd).toBe('pi');
      expect(c.stdinPrompt).toBe('');
    });

    it('throws for unknown prefix', () => {
      expect(() => buildBackendConfig('unknown/model', 'p')).toThrow('Unknown model');
    });
  });

  // ── ensureGitRepo ─────────────────────────────────────────────────────

  describe('ensureGitRepo', () => {
    it('runs git init when no .git dir', () => {
      (fs.existsSync as any).mockReturnValue(false);
      ensureGitRepo('/dir');
      expect(execSync).toHaveBeenCalledWith('git init', expect.objectContaining({ cwd: '/dir' }));
    });

    it('skips when .git exists', () => {
      (fs.existsSync as any).mockReturnValue(true);
      ensureGitRepo('/dir');
      expect(execSync).not.toHaveBeenCalledWith('git init', expect.anything());
    });
  });

  // ── detectInstalledClis ───────────────────────────────────────────────

  describe('detectInstalledClis', () => {
    it('checks 5 CLIs', () => {
      (execSync as any).mockReturnValue('/usr/bin/claude');
      const clis = detectInstalledClis();
      expect(clis).toHaveLength(5);
      expect(clis.map(c => c.name)).toEqual(['claude', 'gemini', 'codex', 'opencode', 'pi']);
    });

    it('marks missing CLIs as unavailable', () => {
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd.includes('gemini')) return '/usr/bin/gemini';
        throw new Error('not found');
      });
      const clis = detectInstalledClis();
      expect(clis.find(c => c.name === 'gemini')?.available).toBe(true);
      expect(clis.find(c => c.name === 'claude')?.available).toBe(false);
    });
  });
});
