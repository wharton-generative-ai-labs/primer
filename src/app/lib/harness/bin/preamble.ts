// Runs before any other import in the bin files. Sets env vars that affect
// how transitive modules (notably the pino logger) initialize themselves.
//
// LOG_LEVEL=info quiets the shared pino logger's debug stream, which is what
// makes the REPL unreadable otherwise. Do not touch NODE_ENV here — that
// re-routes production config paths (auth validation, dev-bypass gate) and
// breaks harness runs in dev environments.
process.env.LOG_LEVEL ??= 'info';

import 'dotenv/config';
