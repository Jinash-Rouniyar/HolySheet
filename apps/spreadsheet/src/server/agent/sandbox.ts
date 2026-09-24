import 'server-only';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Scratch-dir jail with time/output caps. Not a security boundary against a
 * hostile model — public deploys should run the app in a container.
 */

const OUTPUT_CAP = 100_000; // chars per stream
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_TIMEOUT_MS = 120_000;

function sandboxRoot(): string {
  const root = process.env.AGENT_SANDBOX_ROOT?.trim();
  if (root && root.length > 0) return path.resolve(root);
  return path.join(os.tmpdir(), 'celina-agent-sandbox');
}

function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'default';
}

export async function getScratchDir(sessionId: string): Promise<string> {
  const dir = path.join(sandboxRoot(), sanitizeSessionId(sessionId));
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function confinePath(
  sessionId: string,
  relOrAbs: string,
): Promise<string> {
  const scratch = await getScratchDir(sessionId);
  const resolved = path.resolve(scratch, relOrAbs);
  const rel = path.relative(scratch, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Path escapes the session sandbox: ${relOrAbs}`);
  }
  return resolved;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

function clampTimeout(ms: number | undefined): number {
  if (!ms || !Number.isFinite(ms)) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(ms, 1000), MAX_TIMEOUT_MS);
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<ExecResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(command, args, {
      cwd,
      // Do not inherit API keys. Cast: Next marks ProcessEnv keys as required.
      env: {
        PATH: process.env.PATH ?? '',
        HOME: cwd,
        TMPDIR: cwd,
        LANG: process.env.LANG ?? 'en_US.UTF-8',
      } as unknown as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < OUTPUT_CAP) stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < OUTPUT_CAP) stderr += chunk.toString('utf8');
    });

    const finish = (code: number | null) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout.slice(0, OUTPUT_CAP),
        stderr: stderr.slice(0, OUTPUT_CAP),
        exitCode: code,
        timedOut,
      });
    };

    child.on('error', (err) => {
      stderr += `\n[spawn error] ${err.message}`;
      finish(null);
    });
    child.on('close', (code) => finish(code));
  });
}

export async function runBash(
  sessionId: string,
  command: string,
  timeoutMs?: number,
): Promise<ExecResult> {
  const cwd = await getScratchDir(sessionId);
  return runCommand('bash', ['-lc', command], cwd, clampTimeout(timeoutMs));
}

export async function runPython(
  sessionId: string,
  code: string,
  timeoutMs?: number,
): Promise<ExecResult> {
  const cwd = await getScratchDir(sessionId);
  const bin = process.env.AGENT_PYTHON_BIN ?? 'python3';
  // Avoid shell-escaping the snippet.
  const file = path.join(cwd, `.snippet_${Date.now()}.py`);
  await fs.writeFile(file, code, 'utf8');
  try {
    return await runCommand(bin, [file], cwd, clampTimeout(timeoutMs));
  } finally {
    await fs.rm(file, { force: true }).catch(() => {});
  }
}

export async function readSandboxFile(
  sessionId: string,
  relPath: string,
): Promise<string> {
  const abs = await confinePath(sessionId, relPath);
  return fs.readFile(abs, 'utf8');
}

export async function writeSandboxFile(
  sessionId: string,
  relPath: string,
  content: string,
): Promise<void> {
  const abs = await confinePath(sessionId, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
}

export async function listSandbox(
  sessionId: string,
  relPath = '.',
): Promise<string[]> {
  const abs = await confinePath(sessionId, relPath);
  const entries = await fs.readdir(abs, { withFileTypes: true });
  return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
}
