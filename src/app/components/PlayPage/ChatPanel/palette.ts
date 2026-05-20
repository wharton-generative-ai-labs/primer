// Palette for agent accent color. Keyed by hash of agentKey so the same
// agent always gets the same tint across sessions. Deliberately muted —
// these show up as small avatars + name labels, not hero accents.

export type AgentPalette = { bg: string; text: string; ring: string };

export const AGENT_PALETTE: AgentPalette[] = [
  { bg: 'bg-penn-blue/10 dark:bg-penn-blue/30', text: 'text-brand dark:text-blue-200', ring: 'ring-penn-blue/30' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-200', ring: 'ring-emerald-300' },
  { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-700 dark:text-amber-200', ring: 'ring-amber-300' },
  { bg: 'bg-rose-100 dark:bg-rose-900', text: 'text-rose-700 dark:text-rose-200', ring: 'ring-rose-300' },
  { bg: 'bg-violet-100 dark:bg-violet-900', text: 'text-violet-700 dark:text-violet-200', ring: 'ring-violet-300' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-700 dark:text-cyan-200', ring: 'ring-cyan-300' },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function agentPalette(agentKey: string | undefined): AgentPalette {
  if (!agentKey) return AGENT_PALETTE[0];
  return AGENT_PALETTE[hashString(agentKey) % AGENT_PALETTE.length];
}

export function agentInitials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
