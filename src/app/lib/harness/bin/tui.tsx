// Ink TUI variant of the harness REPL.
// Usage: npm run harness:tui [<experience-id>] [--agent key] [--max-auto N] [--model id]
//        npm run harness:tui <run-file.ndjson>   (resume a previous session)
// With no experience id, shows a picker listing every experience under storage/.

import './preamble';
import path from 'node:path';
import React, { useEffect, useState } from 'react';
import { render, Text } from 'ink';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; stack: string | null }
> {
  state = { error: null as Error | null, stack: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    process.stderr.write(
      `\nTUI render error: ${error.message}\nComponent stack:${info.componentStack}\n`,
    );
    process.exitCode = 1;
  }
  render() {
    if (this.state.error) {
      return (
        <Text color="red">
          TUI crashed: {this.state.error.message} (see stderr for component stack)
        </Text>
      );
    }
    return this.props.children;
  }
}
import { Harness } from '../Harness';
import { App } from '../tui/App';
import { Picker, ExperienceItem } from '../tui/Picker';

interface LauncherProps {
  storageRoot: string;
  initialId?: string;
  startAgent?: string;
  modelOverride?: string;
  outDir?: string;
  resumePath?: string;
  cap: number;
  onHarness: (h: Harness) => void;
}

const Launcher: React.FC<LauncherProps> = ({
  storageRoot,
  initialId,
  startAgent,
  modelOverride,
  outDir,
  resumePath,
  cap,
  onHarness,
}) => {
  const [pickedId, setPickedId] = useState<string | undefined>(initialId);
  const [harness, setHarness] = useState<Harness | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (harness) return;
    if (!resumePath && !pickedId) return;
    const h = new Harness();
    const startup = resumePath
      ? h.resume({ ndjsonPath: resumePath, modelOverride, silent: true })
      : h.boot({
          experienceId: pickedId!,
          startAgent,
          modelOverride,
          outDir,
          silent: true,
        });
    startup
      .then(() => {
        // Mount the App immediately so the kickoff turn streams into the UI
        // rather than blocking the loading screen for several seconds.
        setHarness(h);
        onHarness(h);
        // Resume already has prior history; do not kickoff a fresh turn.
        if (!resumePath) {
          h.kickoff().catch(() => {
            /* errors surface via the chat error line */
          });
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [pickedId, harness, startAgent, modelOverride, outDir, resumePath, onHarness]);

  if (error) return <Text color="red">{error}</Text>;
  if (!resumePath && !pickedId)
    return (
      <Picker
        storageRoot={storageRoot}
        onPick={(item: ExperienceItem) => setPickedId(item.id)}
      />
    );
  if (!harness)
    return <Text dimColor>{resumePath ? `resuming ${resumePath}…` : `booting ${pickedId}…`}</Text>;
  return <App harness={harness} cap={cap} />;
};

function parseArgs(argv: string[]) {
  const flagsWithValues = new Set(['agent', 'model', 'max-auto', 'out']);
  const flag = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  // Drop --foo and the value that follows it; what's left is the positional.
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      if (flagsWithValues.has(a.slice(2))) i += 1;
      continue;
    }
    positional.push(a);
  }
  return { positional, flag };
}

async function main() {
  const { positional, flag } = parseArgs(process.argv.slice(2));
  // Positional ending in .ndjson resumes a prior session at that path.
  const resumePath = positional[0]?.endsWith('.ndjson') ? positional[0] : undefined;
  const initialId = resumePath ? undefined : positional[0];
  const cap = parseInt(flag('max-auto') ?? '10', 10);
  const storageRoot = path.join(process.cwd(), 'storage');

  let harnessRef: Harness | null = null as Harness | null;
  // Catch SIGINT so a Ctrl-C still gets the file path printed and the
  // NDJSON sink flushed cleanly.
  let interrupted = false;
  process.on('SIGINT', async () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    if (harnessRef) {
      await harnessRef.shutdown('sigint').catch(() => {});
      console.log(`\nsession saved → ${harnessRef.getRunFile()}`);
    }
    process.exit(130);
  });

  const { waitUntilExit } = render(
    <ErrorBoundary>
      <Launcher
        storageRoot={storageRoot}
        initialId={initialId}
        startAgent={flag('agent')}
        modelOverride={flag('model')}
        outDir={flag('out')}
        resumePath={resumePath}
        cap={cap}
        onHarness={h => (harnessRef = h)}
      />
    </ErrorBoundary>,
  );
  await waitUntilExit();
  if (harnessRef) console.log(`session saved → ${harnessRef.getRunFile()}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
