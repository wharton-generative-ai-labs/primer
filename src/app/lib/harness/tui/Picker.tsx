// Experience picker shown when the TUI is launched with no experience id.
// Lists every folder under storage/ that contains an experience.json,
// reads the title + description out so designers can recognize them by
// name rather than by directory slug.

import React, { useEffect, useState } from 'react';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Box, Text, useApp, useInput } from 'ink';

export interface ExperienceItem {
  id: string;
  title: string;
  description: string;
}

interface Props {
  storageRoot: string;
  onPick: (item: ExperienceItem) => void;
}

export const Picker: React.FC<Props> = ({ storageRoot, onPick }) => {
  const { exit } = useApp();
  const [items, setItems] = useState<ExperienceItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    listExperiences(storageRoot)
      .then(setItems)
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [storageRoot]);

  useInput((_input, key) => {
    if (!items) return;
    if (key.upArrow) setCursor(c => (c - 1 + items.length) % items.length);
    else if (key.downArrow) setCursor(c => (c + 1) % items.length);
    else if (key.return) onPick(items[cursor]);
    else if (key.escape || (key.ctrl && _input === 'c')) exit();
  });

  if (error) return <Text color="red">picker error: {error}</Text>;
  if (!items) return <Text dimColor>scanning {storageRoot}…</Text>;
  if (items.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No experiences found under {storageRoot}.</Text>
        <Text dimColor>Place an experience folder there and try again.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Choose an experience (↑↓ select, Enter, Esc cancel)</Text>
      <Box marginTop={1} flexDirection="column">
        {items.map((item, i) => (
          <Box key={item.id} flexDirection="column">
            <Text color={i === cursor ? 'green' : undefined}>
              {i === cursor ? '› ' : '  '}
              <Text bold>{item.title}</Text>
              <Text dimColor>  ({item.id})</Text>
            </Text>
            {i === cursor && item.description ? (
              <Text dimColor>      {item.description}</Text>
            ) : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export async function listExperiences(storageRoot: string): Promise<ExperienceItem[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(storageRoot);
  } catch {
    return [];
  }
  const items: ExperienceItem[] = [];
  for (const entry of entries) {
    const cfgPath = path.join(storageRoot, entry, 'experience.json');
    try {
      const raw = await fs.readFile(cfgPath, 'utf8');
      const cfg = JSON.parse(raw);
      items.push({
        id: entry,
        title: cfg.title ?? entry,
        description: cfg.description ?? '',
      });
    } catch {
      // not an experience folder — skip
    }
  }
  return items.sort((a, b) => a.title.localeCompare(b.title));
}
