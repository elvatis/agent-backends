# @elvatis_com/agent-backends

Shared agent backend abstraction for CLI-based AI agent spawning. Single source of truth for how CLI agents (Claude, Gemini, Codex, OpenCode, Pi) are detected, configured, and spawned as subprocesses.

**Current version:** 1.0.0

## Why

Both [conduit-vscode](https://github.com/elvatis/conduit-vscode) and [aahp-runner](https://github.com/homeofe/aahp-runner) spawn CLI agents with similar logic but different implementations. This package extracts the shared core so adding a new agent backend or fixing a spawn pattern requires one update, not two.

## Install

```bash
npm install @elvatis_com/agent-backends
```

## API

### `detectInstalledClis(): CliInfo[]`

Check which CLI tools are available on the system.

```typescript
import { detectInstalledClis } from '@elvatis_com/agent-backends';

const clis = detectInstalledClis();
// [{ name: 'claude', available: true, path: '/usr/bin/claude' }, ...]
```

### `formatPrompt(messages: ChatMessage[]): string`

Serialize a chat conversation (system/user/assistant messages) into a single prompt string for CLI stdin.

```typescript
import { formatPrompt } from '@elvatis_com/agent-backends';

const prompt = formatPrompt([
  { role: 'system', content: 'You are a coding assistant' },
  { role: 'user', content: 'Fix the auth bug' },
]);
```

Features:
- System messages always included regardless of conversation length
- Truncates individual messages at 4000 chars
- Keeps last 20 non-system messages
- Handles content part arrays (multimodal messages)

### `buildBackendConfig(model: string, prompt: string, workdir?: string): BackendConfig`

Build the CLI command configuration for a given model. Returns the command, args, stdin prompt, and working directory.

```typescript
import { buildBackendConfig } from '@elvatis_com/agent-backends';

const config = buildBackendConfig('cli-claude/claude-sonnet-4-6', 'Fix the bug', '/my/project');
// { cmd: 'claude', args: ['-p', '--output-format', 'text', ...], stdinPrompt: '...', cwd: '...', shell: false }
```

Supported model prefixes:
- `cli-gemini/` (Gemini CLI)
- `cli-claude/` (Claude Code CLI)
- `openai-codex/` (OpenAI Codex CLI)
- `opencode/` (OpenCode)
- `pi/` (Pi)

### `runCli(cmd, args, prompt, timeoutMs, cwd?, shell?): Promise<CliRunResult>`

Run a CLI subprocess with stdin prompt delivery and output capture.

```typescript
import { runCli } from '@elvatis_com/agent-backends';

const result = await runCli('claude', ['-p', '--output-format', 'text'], 'Hello', 30_000, '/workspace');
console.log(result.stdout, result.exitCode);
```

### `spawnAgent(config: BackendConfig, timeoutMs: number): AgentHandle`

Spawn a background agent process with live output capture.

```typescript
import { buildBackendConfig, spawnAgent } from '@elvatis_com/agent-backends';

const config = buildBackendConfig('cli-gemini/gemini-2.5-pro', 'Implement feature X', '/project');
const handle = spawnAgent(config, 600_000);

// Live output
console.log(handle.output.join(''));

// Wait for completion
const result = await handle.result;
console.log('Exit code:', result.exitCode);

// Kill if needed
handle.kill();
```

### `buildMinimalEnv(): Record<string, string>`

Build a minimal, clean environment for subprocess spawning. Passes through essential vars (PATH, HOME, API keys) without leaking the full parent environment.

### `ensureGitRepo(dir: string): void`

Initialize a git repo if one doesn't exist (required by Codex).

## Types

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[] | unknown;
}

interface CliRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface CliInfo {
  name: string;
  available: boolean;
  path?: string;
}

interface BackendConfig {
  cmd: string;
  args: string[];
  stdinPrompt: string;
  cwd: string;
  shell: boolean;
}

interface AgentHandle {
  pid: number;
  output: string[];
  kill: () => void;
  result: Promise<CliRunResult>;
  process: ChildProcess;
}
```

## Testing

```bash
npm test        # run tests (26 tests)
npm run build   # compile TypeScript
```

## Related

- [conduit-vscode](https://github.com/elvatis/conduit-vscode): VS Code extension using this package
- [aahp-runner](https://github.com/homeofe/aahp-runner): Autonomous CLI agent runner

## License

Apache-2.0
