# Contributing to agent-backends

Thanks for your interest in contributing. `@elvatis_com/agent-backends` is the
shared abstraction for detecting, configuring, and spawning CLI-based AI agents
(Claude, Gemini, Codex, OpenCode, Pi) as subprocesses. It exists so that adding
a backend or fixing a spawn pattern is one change rather than two.

Because this package is consumed by other projects, its public API is the
product. Treat every exported signature as a contract.

## Getting started

1. Fork the repository and create a feature branch from `main`.
2. Install dependencies with `npm install` (Node 18 or newer, per `engines`).
3. Read `README.md` and `src/index.ts` before changing an exported signature.
4. Keep changes focused and small.

## Repository layout

- `src/index.ts` the entire public surface: CLI detection, prompt formatting,
  and agent spawning.
- `src/__tests__/` the vitest suite covering that surface.
- `dist/` build output from `tsc`. Generated, never edited by hand, and the
  only directory published to npm (see `files` in `package.json`).

## Contribution rules

- **The exported API is a contract.** `conduit-vscode` and `aahp-runner` both
  depend on this package. A change to an exported type or function signature is
  a breaking change for them: call it out in the pull request and bump the
  version accordingly.
- **Keep backends symmetrical.** A new CLI backend should be detectable,
  configurable, and spawnable through the same functions as the existing ones,
  rather than adding a parallel code path for one vendor.
- **Default to `shell: false` for new backends.** `runCli` spawns argv-style,
  and a backend opts into a shell only by setting `shell: true` in its spec.
  Prompts and working directories are caller-supplied, so anything reaching a
  shell string can be interpreted rather than passed through. If a new backend
  genuinely needs a shell, say why in the pull request and keep the prompt on
  stdin rather than in `args`.
- **Cover changes with tests.** Add or update a case in `src/__tests__/` in the
  same change; `npm test` must pass.
- **No em dashes** in code, comments, or documentation. Use a regular hyphen or
  restructure the sentence.

## Verifying a change

```bash
npm test        # vitest suite
npm run build   # tsc, must compile clean
```

Both must pass before you open a pull request.

## Pull request process

1. Open a Pull Request against `main` with a clear description.
2. Link any relevant issues and state whether the public API changed.
3. Update `README.md` in the same pull request if behaviour or the API changed.
4. Confirm no secrets are in the commit history.

For major changes (a new backend, a change to the spawn model, or anything
breaking), open an issue first to discuss design and scope.

## Security

Do not report vulnerabilities through a public issue. Follow
[SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE).
