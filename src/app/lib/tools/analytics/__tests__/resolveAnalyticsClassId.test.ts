import { resolveAnalyticsClassId } from '../index';

describe('resolveAnalyticsClassId', () => {
  it('prefers explicit tool arg', () => {
    expect(
      resolveAnalyticsClassId(
        { classId: 'class-from-args' },
        { classId: 'class-from-context', sessionId: 'class_analytics_class-other' },
      ),
    ).toBe('class-from-args');
  });

  it('falls back to context.classId', () => {
    expect(
      resolveAnalyticsClassId(
        {},
        { classId: 'class-from-context', sessionId: 'sess_abc' },
      ),
    ).toBe('class-from-context');
  });

  it('parses synthetic class analytics session id', () => {
    expect(
      resolveAnalyticsClassId(
        {},
        { sessionId: 'class_analytics_class-17f5920a' },
      ),
    ).toBe('class-17f5920a');
  });

  it('returns null when class id cannot be resolved', () => {
    expect(resolveAnalyticsClassId({}, { sessionId: 'sess_abc' })).toBeNull();
  });
});
