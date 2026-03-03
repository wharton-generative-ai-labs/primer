export function generateUUID(): string {
  if (typeof globalThis !== 'undefined' &&
      typeof (globalThis as any).crypto !== 'undefined' &&
      typeof (globalThis as any).crypto.randomUUID === 'function') {
    return (globalThis as any).crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


