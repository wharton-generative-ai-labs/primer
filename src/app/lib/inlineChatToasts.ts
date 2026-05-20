/**
 * Lightweight pub/sub store for inline chat-panel notifications.
 *
 * Non-destructive toasts (progress updates like "Character prompts are ready!")
 * are routed here instead of (or in addition to) the corner-toast Sonner.
 * The ChatPanel subscribes and renders them as inline pill items above the
 * delegation status line.
 */

export interface InlineChatToast {
  id: string;
  title: string;
  /** Auto-dismiss after this many ms. Defaults to 4000. */
  duration?: number;
}

type Listener = (toasts: InlineChatToast[]) => void;

let toasts: InlineChatToast[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function notify() {
  for (const fn of listeners) fn([...toasts]);
}

export function pushInlineChatToast(title: string, duration = 4000): string {
  const id = `ict-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  toasts = [...toasts, { id, title, duration }];
  notify();

  if (duration > 0) {
    const t = setTimeout(() => dismissInlineChatToast(id), duration);
    timers.set(id, t);
  }

  return id;
}

export function dismissInlineChatToast(id: string) {
  if (timers.has(id)) {
    clearTimeout(timers.get(id)!);
    timers.delete(id);
  }
  const before = toasts.length;
  toasts = toasts.filter((t) => t.id !== id);
  if (toasts.length !== before) notify();
}

export function subscribeToInlineChatToasts(fn: Listener): () => void {
  listeners.add(fn);
  fn([...toasts]);
  return () => listeners.delete(fn);
}
