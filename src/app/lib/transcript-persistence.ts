
/**
 * Persistable subset of a transcript item — only the fields the markdown
 * formatter looks at. Defined separately from {@link TranscriptItem} so the
 * formatter unit tests don't need to construct full items (with `expanded`,
 * `createdAtMs`, etc.).
 */
export interface PersistableTranscriptMessage {
  itemId: string;
  type: 'MESSAGE' | 'BREADCRUMB';
  role?: 'user' | 'assistant';
  title?: string;
  timestamp?: string;
  isHidden?: boolean;
  agentName?: string;
}

const PLACEHOLDER_TRANSCRIBING = '[Transcribing...]';

/**
 * Filter to only the items the conversation_transcript artifact should
 * include: committed user/assistant text messages. Excludes:
 *  - breadcrumbs (workflow phase changes, tool calls, errors, handoffs)
 *  - hidden messages (system-only / internal)
 *  - empty messages (in-flight assistant streams that haven't received
 *    their first delta — once content lands the next persistence pass
 *    picks them up)
 *  - the user-side "[Transcribing...]" placeholder (becomes real text once
 *    the realtime API completes the audio transcription)
 */
export function filterPersistableMessages(
  items: ReadonlyArray<PersistableTranscriptMessage>,
): PersistableTranscriptMessage[] {
  return items.filter((item) => {
    if (item.type !== 'MESSAGE') return false;
    if (item.role !== 'user' && item.role !== 'assistant') return false;
    if (item.isHidden) return false;
    const text = item.title ?? '';
    if (!text.trim()) return false;
    if (text === PLACEHOLDER_TRANSCRIBING) return false;
    return true;
  });
}

function speakerLabel(item: PersistableTranscriptMessage): string {
  if (item.role === 'user') return 'User';
  // Prefer the active-agent name (Intake, Mentor, etc.) so multi-agent
  // experiences keep speaker identity in the transcript. Fallback to
  // "Assistant" if the agent label hasn't been stamped on the item yet.
  return item.agentName?.trim() || 'Assistant';
}

function formatMessageBlock(item: PersistableTranscriptMessage): string {
  const speaker = speakerLabel(item);
  const ts = item.timestamp?.trim();
  const header = ts ? `**${speaker}** (${ts}):` : `**${speaker}**:`;
  const body = (item.title ?? '').trim();
  return `${header}\n${body}`;
}

/**
 * Render the full conversation_transcript markdown artifact body. Output is
 * deterministic — same input produces same output — so the artifact write
 * path can skip duplicate writes by string-comparing against the last write.
 *
 * Format:
 *
 * ```
 * # Conversation Transcript
 *
 * **User** (12:34:56 PM):
 * …their text…
 *
 * **Intake** (12:35:02 PM):
 * …assistant reply…
 * ```
 */
export function formatTranscriptMarkdown(
  items: ReadonlyArray<PersistableTranscriptMessage>,
): string {
  const persistable = filterPersistableMessages(items);
  const header = '# Conversation Transcript';
  if (persistable.length === 0) {
    return `${header}\n\n_No conversation yet._\n`;
  }
  const blocks = persistable.map(formatMessageBlock).join('\n\n');
  return `${header}\n\n${blocks}\n`;
}
