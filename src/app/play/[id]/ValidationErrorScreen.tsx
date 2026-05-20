import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type { ValidationIssue } from '@/app/lib/ConfigAnalyzer';

import PlayShell from './PlayShell';

interface ValidationErrorScreenProps {
  experienceId: string;
  issues: ValidationIssue[];
}

/**
 * Pre-flight gate error screen. Listed when
 * {@link import('@/app/lib/experiences/validateExperienceForStart').validateExperienceForStart}
 * reports blocking issues. The "Continue anyway" CTA reloads the route with
 * `?bypassValidation=1`, which the RSC honors to skip the gate (e.g. so the
 * author can launch and inspect a partially-broken experience to fix it).
 */
export default function ValidationErrorScreen({
  experienceId,
  issues,
}: ValidationErrorScreenProps) {
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  return (
    <PlayShell title="Your experience is being prepared.">
      <div className="flex h-full flex-col items-center justify-center gap-6 px-4 py-12">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-lg">
          <h2 className="mb-2 text-2xl font-semibold text-gray-900">
            This experience has configuration problems
          </h2>
          <p className="mb-6 text-sm text-gray-600">
            We found {errors.length} blocking error{errors.length === 1 ? '' : 's'}
            {warnings.length > 0 ? ` and ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''}{' '}
            in <code className="rounded bg-gray-100 px-1">experience.json</code>.
            Fix them in the editor, or continue anyway to launch with the current configuration.
          </p>

          <IssueList title="Errors" issues={errors} tone="error" />
          {warnings.length > 0 && (
            <IssueList title="Warnings" issues={warnings} tone="warning" />
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/edit/${experienceId}`}>Open in editor</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Return home</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href={`/play/${experienceId}?bypassValidation=1`}>Continue anyway</Link>
            </Button>
          </div>
        </div>
      </div>
    </PlayShell>
  );
}

function IssueList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: ValidationIssue[];
  tone: 'error' | 'warning';
}) {
  if (issues.length === 0) return null;
  const palette =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-900'
      : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
        {title}
      </h3>
      <ul className={`space-y-2 rounded-lg border p-4 ${palette}`}>
        {issues.map((issue, i) => (
          <li key={i} className="text-sm">
            <div className="font-medium">{issue.message}</div>
            {issue.path && (
              <div className="mt-0.5 font-mono text-xs opacity-75">{issue.path}</div>
            )}
            {issue.suggestion && (
              <div className="mt-1 text-xs opacity-90">{issue.suggestion}</div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
