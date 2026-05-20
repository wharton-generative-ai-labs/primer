/**
 * Tests for the inline chat-panel toast pub/sub.
 *
 * The store is a module-level singleton so listeners and timers persist
 * across `import` cycles in the same Jest worker. Each test re-imports the
 * module via `jest.isolateModules` to get a fresh state slate, which keeps
 * tests independent without adding test-only reset hooks to production
 * code.
 */

type ToastModule = typeof import('../inlineChatToasts');

function loadFresh(): ToastModule {
  let mod: ToastModule | undefined;
  jest.isolateModules(() => {
    // require inside isolateModules() ensures we get a brand-new copy of
    // the module's singleton state for every test.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../inlineChatToasts');
  });
  if (!mod) throw new Error('isolateModules did not load inlineChatToasts');
  return mod;
}

describe('inlineChatToasts', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a unique id from pushInlineChatToast', () => {
    const { pushInlineChatToast } = loadFresh();
    const a = pushInlineChatToast('a');
    const b = pushInlineChatToast('b');
    expect(a).not.toBe(b);
    expect(typeof a).toBe('string');
  });

  it('subscribing immediately delivers the current state (initially empty)', () => {
    const { subscribeToInlineChatToasts } = loadFresh();
    const fn = jest.fn();
    subscribeToInlineChatToasts(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith([]);
  });

  it('notifies subscribers when a toast is pushed', () => {
    const { pushInlineChatToast, subscribeToInlineChatToasts } = loadFresh();
    const fn = jest.fn();
    subscribeToInlineChatToasts(fn);
    fn.mockClear();

    pushInlineChatToast('hello');
    expect(fn).toHaveBeenCalledTimes(1);
    const delivered = fn.mock.calls[0][0];
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({ title: 'hello' });
  });

  it('fans notifications out to multiple subscribers', () => {
    const { pushInlineChatToast, subscribeToInlineChatToasts } = loadFresh();
    const a = jest.fn();
    const b = jest.fn();
    subscribeToInlineChatToasts(a);
    subscribeToInlineChatToasts(b);
    a.mockClear();
    b.mockClear();

    pushInlineChatToast('hi');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after the default duration (4000ms)', () => {
    const { pushInlineChatToast, subscribeToInlineChatToasts } = loadFresh();
    const fn = jest.fn();
    subscribeToInlineChatToasts(fn);
    fn.mockClear();

    pushInlineChatToast('soon-gone');
    expect(fn.mock.calls.at(-1)![0]).toHaveLength(1);

    jest.advanceTimersByTime(3999);
    expect(fn.mock.calls.at(-1)![0]).toHaveLength(1);

    jest.advanceTimersByTime(1);
    expect(fn.mock.calls.at(-1)![0]).toHaveLength(0);
  });

  it('honors a custom duration', () => {
    const { pushInlineChatToast, subscribeToInlineChatToasts } = loadFresh();
    const fn = jest.fn();
    subscribeToInlineChatToasts(fn);
    fn.mockClear();

    pushInlineChatToast('slow', 10_000);
    jest.advanceTimersByTime(4_000);
    expect(fn.mock.calls.at(-1)![0]).toHaveLength(1);
    jest.advanceTimersByTime(6_000);
    expect(fn.mock.calls.at(-1)![0]).toHaveLength(0);
  });

  it('duration: 0 disables auto-dismiss', () => {
    const { pushInlineChatToast, subscribeToInlineChatToasts } = loadFresh();
    const fn = jest.fn();
    subscribeToInlineChatToasts(fn);
    fn.mockClear();

    pushInlineChatToast('sticky', 0);
    jest.advanceTimersByTime(60_000);
    expect(fn.mock.calls.at(-1)![0]).toHaveLength(1);
  });

  it('manual dismiss removes the toast and notifies', () => {
    const {
      pushInlineChatToast,
      dismissInlineChatToast,
      subscribeToInlineChatToasts,
    } = loadFresh();
    const fn = jest.fn();
    subscribeToInlineChatToasts(fn);
    fn.mockClear();

    const id = pushInlineChatToast('bye');
    fn.mockClear();
    dismissInlineChatToast(id);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0]).toHaveLength(0);
  });

  it('manual dismiss cancels the auto-dismiss timer (no double-notify)', () => {
    const {
      pushInlineChatToast,
      dismissInlineChatToast,
      subscribeToInlineChatToasts,
    } = loadFresh();
    const fn = jest.fn();
    subscribeToInlineChatToasts(fn);
    fn.mockClear();

    const id = pushInlineChatToast('cancel-me');
    dismissInlineChatToast(id);
    fn.mockClear();

    jest.advanceTimersByTime(10_000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('dismissing an unknown id is a no-op (no notify)', () => {
    const { dismissInlineChatToast, subscribeToInlineChatToasts } = loadFresh();
    const fn = jest.fn();
    subscribeToInlineChatToasts(fn);
    fn.mockClear();

    dismissInlineChatToast('does-not-exist');
    expect(fn).not.toHaveBeenCalled();
  });

  it('unsubscribing stops further notifications', () => {
    const { pushInlineChatToast, subscribeToInlineChatToasts } = loadFresh();
    const fn = jest.fn();
    const unsubscribe = subscribeToInlineChatToasts(fn);
    fn.mockClear();
    unsubscribe();

    pushInlineChatToast('after-unsub');
    expect(fn).not.toHaveBeenCalled();
  });

  it('preserves push order when multiple toasts are live concurrently', () => {
    const { pushInlineChatToast, subscribeToInlineChatToasts } = loadFresh();
    const fn = jest.fn();
    subscribeToInlineChatToasts(fn);
    fn.mockClear();

    pushInlineChatToast('first', 0);
    pushInlineChatToast('second', 0);
    pushInlineChatToast('third', 0);

    const last = fn.mock.calls.at(-1)![0];
    expect(last.map((t: { title: string }) => t.title)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });
});
