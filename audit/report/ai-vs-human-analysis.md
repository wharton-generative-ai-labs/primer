# AI vs Human Analysis

This audit used AI-generated reviews as a starting point for human expert validation—a practical workflow that reflects how organizations might realistically integrate AI into security assessments.

## Actual Methodology

The review process was sequential, not blind:

1. **AI Review** — Claude analyzed each security category through static code analysis
2. **Human Review** — A security expert reviewed AI findings, validated or disputed each one, and added new findings through runtime testing

This differs from a controlled blind study. The human reviewer had full access to AI findings before beginning their review, with explicit guidance on where to focus validation effort.

## What We Observed

### AI Tendency Toward Conservative Severity

The AI flagged three HIGH severity findings that human review downgraded:

| Finding | AI Assessment | Human Assessment | Reason for Downgrade |
|---------|---------------|------------------|---------------------|
| WS-1: No socket auth | HIGH / Blocker | MEDIUM / Acceptable | Can't do anything useful without valid session ID |
| WS-2: Client session IDs | HIGH / Blocker | MEDIUM / Acceptable | UUIDs have 122-bit entropy; no cross-user leakage |
| AUTH-1: Open registration | HIGH / Blocker | MEDIUM / Documentation | Deployer responsibility; no-role users get 403 |

In each case, the AI identified a real architectural pattern but assessed severity based on theoretical attack vectors. Human review applied practical exploitability analysis—asking "could this actually be exploited in this deployment context?"

### Human Value-Add: Runtime Verification

Human review contributed what static analysis cannot:

- **Live testing** confirmed unauthenticated sockets connect but can't trigger LLM calls
- **Session ID investigation** traced generation code to confirm cryptographic randomness
- **Leakage vector audit** verified session IDs aren't exposed cross-user
- **Route spot-checks** found specific authorization gaps (storage API)

The human reviewer spent 90 minutes on auth and 2.5 hours on WebSockets—primarily validating AI findings rather than discovering net-new issues.

### AI Value-Add: Comprehensive Coverage

AI review provided thorough static analysis that would take humans significantly longer:

- Systematic examination of every file in scope
- Consistent documentation format
- No fatigue-related oversights
- Identification of patterns across the codebase

## Practical Implications

For organizations considering AI-assisted security review:

**AI as triage, human as validation.** The workflow that emerged naturally—AI generates candidates, human validates—appears effective. AI's conservative bias creates a "fail-safe" orientation where potential issues are flagged for human review rather than missed entirely.

**Context calibration matters.** AI severity ratings improved when given deployment context (PoC vs production, trusted users vs public). Without context, AI defaults to worst-case assumptions.

**Runtime testing remains essential.** Several key conclusions (session ID entropy, actual route behavior) required human investigation that static analysis couldn't provide.

## Limitations

This was a single audit with one AI model and one human reviewer. The sequential methodology means we can't isolate what the human would have found independently. A controlled study would require parallel blind reviews, which this audit did not implement.
