// CLI entry for the dev-time harness.
// Usage: bun run src/app/lib/harness/bin/run.ts <experience-id> [--agent <key>] [--model <id>]

import './preamble';
import readline from 'node:readline';
import { Harness } from '../Harness';
import { Autoplayer } from '../autoplay';
import { stateSnapshot } from '../state';

// Shutdown hook registered by main() once the harness is booted. Used by
// the outer crash path so the NDJSON sink flushes its final buffer before
// the process exits — otherwise you lose the events that explain the crash.
let crashShutdown: (() => Promise<void>) | null = null;

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  // Positional ending in .ndjson resumes a prior session at that path.
  const positional = args.find(a => !a.startsWith('--'));
  const resumePath = positional?.endsWith('.ndjson') ? positional : undefined;
  const experienceId = resumePath ? '' : positional ?? '';
  if (!resumePath && !experienceId) {
    console.error(
      'usage: run <experience-id> [--agent key] [--model id] [--silent] [--max-auto N]\n' +
        '       run <ndjson-path>     (resume a previous session)',
    );
    process.exit(2);
  }
  const cap = parseInt(flag('max-auto') ?? '10', 10);

  const harness = new Harness();
  try {
    if (resumePath) {
      await harness.resume({
        ndjsonPath: resumePath,
        modelOverride: flag('model'),
        silent: args.includes('--silent'),
      });
    } else {
      await harness.boot({
        experienceId,
        startAgent: flag('agent'),
        modelOverride: flag('model'),
        outDir: flag('out'),
        silent: args.includes('--silent'),
      });
      if (!args.includes('--no-kickoff')) await harness.kickoff();
    }
  } catch (e) {
    console.error(resumePath ? 'resume failed:' : 'boot failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }
  const announceLog = () => console.log(`session saved → ${harness.getRunFile()}`);
  crashShutdown = async () => {
    await harness.shutdown('crash').catch(() => {});
    announceLog();
  };

  let autoplayer: Autoplayer | null = null;
  let autoplayPromise: Promise<unknown> | null = null;
  let quitting = false;
  let sending = false;

  // Catch Ctrl-C so the NDJSON gets a clean session.end record + the user
  // sees the file path. A second SIGINT bails out fast.
  process.on('SIGINT', () => {
    if (quitting) process.exit(130);
    quit('sigint').catch(() => process.exit(130));
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = () => rl.question('> ', line => handle(line));

  const quit = async (reason: string) => {
    if (quitting) return;
    quitting = true;
    autoplayer?.stop(reason);
    if (autoplayPromise) await autoplayPromise.catch(() => {});
    await harness.shutdown(reason).catch(() => {});
    announceLog();
    rl.close();
    process.exit(0);
  };

  const handle = async (raw: string) => {
    const line = raw.trim();
    if (!line) return prompt();
    if (line === '/quit' || line === '/q') {
      await quit('user-quit');
      return;
    }
    if (line === '/state') {
      console.log(JSON.stringify(stateSnapshot(harness.getState()), null, 2));
      return prompt();
    }
    if (line === '/auto') {
      if (autoplayer) {
        console.log('autoplay already running. /stop to halt.');
        return prompt();
      }
      try {
        autoplayer = new Autoplayer(harness, { cap });
      } catch (e) {
        console.error('autoplay init failed:', e instanceof Error ? e.message : e);
        autoplayer = null;
        return prompt();
      }
      autoplayPromise = autoplayer.run().finally(() => {
        autoplayer = null;
        autoplayPromise = null;
        prompt();
      });
      // Don't re-prompt — autoplay drives the conversation; prompt resumes when done.
      return;
    }
    if (line === '/stop') {
      if (!autoplayer) {
        console.log('autoplay not running');
      } else {
        autoplayer.stop('user-stop');
      }
      return prompt();
    }
    if (line === '/help') {
      console.log(
        '/state            dump state\n' +
          '/auto             start autoplay (claude as student)\n' +
          '/stop             halt autoplay\n' +
          '/quit             exit\n' +
          '(anything else)   send to agent',
      );
      return prompt();
    }
    if (autoplayer) {
      console.log('autoplay running — /stop first to send a manual line');
      return prompt();
    }
    if (sending) {
      // Enter-spamming while a send is in flight races the shared chat
      // history in ai.ts; drop extra lines with a visible hint.
      console.log('still sending previous line — wait for reply');
      return prompt();
    }
    sending = true;
    try {
      await harness.send(line);
    } catch (e) {
      console.error('send failed:', e instanceof Error ? e.message : e);
    } finally {
      sending = false;
    }
    prompt();
  };

  // Stdin EOF (piped input or user Ctrl-D) routes through quit() so the
  // NDJSON gets a clean session.end + the file path is announced.
  rl.on('close', () => {
    if (!quitting) quit('eof').catch(() => process.exit(1));
  });
  prompt();
}

main().catch(async e => {
  console.error(e);
  if (crashShutdown) await crashShutdown().catch(() => {});
  process.exit(1);
});
