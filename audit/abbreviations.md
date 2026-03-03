*[XSS]: Cross-Site Scripting
*[CSRF]: Cross-Site Request Forgery
*[SSRF]: Server-Side Request Forgery
*[SQL]: Structured Query Language
*[RCE]: Remote Code Execution
*[DoS]: Denial of Service
*[DDoS]: Distributed Denial of Service
*[API]: Application Programming Interface
*[JWT]: JSON Web Token
*[OAuth]: Open Authorization
*[CORS]: Cross-Origin Resource Sharing - security mechanism controlling which domains can access the server
*[CSP]: Content Security Policy - HTTP headers that restrict what resources can be loaded and executed
*[HSTS]: HTTP Strict Transport Security
*[PII]: Personally Identifiable Information
*[CVE]: Common Vulnerabilities and Exposures
*[SOC 2]: Service Organization Control 2 - audit standard for security, availability, and confidentiality
*[HIPAA]: Health Insurance Portability and Accountability Act - US healthcare data privacy regulation
*[OWASP]: Open Web Application Security Project
*[SAST]: Static Application Security Testing
*[DAST]: Dynamic Application Security Testing
*[MFA]: Multi-Factor Authentication
*[RBAC]: Role-Based Access Control
*[S3]: Amazon Simple Storage Service
*[SDK]: Software Development Kit
*[WSS]: WebSocket Secure
*[TLS]: Transport Layer Security
*[SSL]: Secure Sockets Layer
*[DNS]: Domain Name System
*[URL]: Uniform Resource Locator
*[UUID]: Universally Unique Identifier - 122-bit cryptographically random identifier
*[JSON]: JavaScript Object Notation
*[HTML]: HyperText Markup Language
*[HTTP]: HyperText Transfer Protocol
*[HTTPS]: HyperText Transfer Protocol Secure
*[Agent]: AI personality that interacts with users; can be frontend (voice-interactive) or backend (headless processing)
*[Frontend Agent]: Voice-interactive AI agent using OpenAI Realtime API for real-time conversation
*[Backend Agent]: Headless AI agent running server-side with access to file system and processing tools
*[Session ID]: Unique identifier for a session in format sess_{uuid} with 122-bit entropy
*[Artifact]: Document or file created during a session by an agent (markdown, code, diagrams, etc.)
*[Tool]: Action that AI agents can perform, such as changing scenes, creating artifacts, or delegating tasks
*[Tool Registry]: Centralized manager for tool registration, allowlisting, and execution
*[Delegation]: Architecture for frontend agents to hand off complex tasks to backend agents for processing
*[Scene]: Background image displayed during an experience that agents can switch dynamically
*[Matter Compiler]: System for programmatically modifying experiences at runtime
*[experience.json]: Main configuration file defining an experience's metadata, agents, resources, and tool access
*[Socket.IO]: WebSocket library enabling real-time bidirectional communication between frontend and backend
*[WebRTC]: Web Real-Time Communication protocol for peer-to-peer audio/video streaming
*[WebSocket]: Persistent bidirectional communication channel between browser and server
*[OpenAI Realtime API]: Voice-interactive API for real-time audio input/output with minimal latency
*[VAD]: Voice Activity Detection - algorithm detecting when a user is speaking vs. silent
*[Prompt Injection]: Security vulnerability where user input manipulates AI behavior by injecting instructions into prompts
*[Temperature]: AI parameter controlling randomness/creativity in responses (0.0 = deterministic, 1.0+ = creative)
*[Provider Adapter]: Format conversion layer between different AI providers (OpenAI, Anthropic, Google)
*[Next.js]: React framework providing server-side rendering, API routes, and static generation
*[NextAuth]: Authentication library for Next.js supporting OAuth, credentials, and session management
*[TypeScript]: Typed superset of JavaScript providing type safety and developer experience improvements
*[React]: JavaScript library for building user interfaces with component-based architecture
*[Zod]: TypeScript-first schema validation library for runtime type checking
*[AI-First Architecture]: Design philosophy where AI is a first-class architectural element with autonomy, not a bolted-on service
*[Tool Execution Pipeline]: System for validating, executing, and returning results from AI-requested tool calls
*[Rate Limiting]: Mechanism controlling request frequency to prevent abuse and billing attacks
*[Session Store]: In-memory Map tracking active sessions and their state
*[Room]: Socket.IO concept for isolating events to specific sessions or groups
*[Middleware]: Software component that sits between the client and server to process requests (e.g., authentication, validation)
*[Trust Boundary]: Point where data crosses from trusted to untrusted zones, requiring validation and security controls
*[Attack Surface]: Sum of all points where an unauthorized user could try to enter or extract data from a system
*[Session Hijacking]: Exploitation of a valid session by stealing or guessing the session identifier
*[Session Fixation]: Attack where attacker sets a user's session ID to a known value before they authenticate
*[Brute Force]: Attack method attempting all possible combinations to guess credentials or session IDs
*[Entropy]: Measure of randomness; higher entropy means harder to guess (e.g., 122-bit UUID provides strong entropy)
*[Sanitization]: Process of cleaning user input to remove potentially dangerous content before processing or display
*[Input Validation]: Verifying that user-supplied data meets expected format, type, and constraints before processing
*[Output Encoding]: Converting data to safe format before rendering to prevent XSS (e.g., HTML entity encoding)
*[Enumeration]: Systematic probing to discover valid usernames, session IDs, or other identifiers
*[Path Traversal]: Attack using ../ sequences to access files outside intended directory (e.g., ../../../../etc/passwd)
*[Allowlist]: Explicit list of permitted values, safer than blocklist which tries to list all dangerous values
*[Blocklist]: List of forbidden values; less secure than allowlist as attackers may find unlisted bypasses
*[Information Disclosure]: Unintended exposure of sensitive data through error messages, headers, or responses
*[Stack Trace]: Detailed error output showing code execution path; useful for debugging but can leak implementation details
*[Hardcoded]: Credentials or secrets embedded directly in source code rather than configuration or environment variables
*[Privilege Escalation]: Attack gaining higher access rights than intended (e.g., user becoming admin)
*[Defense in Depth]: Security strategy using multiple layers of controls so failure of one doesn't compromise the system
*[Least Privilege]: Principle of granting only minimum permissions necessary for a task
*[Same-Origin Policy]: Browser security preventing scripts from one origin accessing data from another origin
*[MIME]: Multipurpose Internet Mail Extensions - standard for file type identification (e.g., text/html, application/json)
*[MIME Type]: Media type identifier (e.g., text/html, application/json) that browsers use to determine how to handle content
*[TTL]: Time To Live - duration before a cache entry, token, or session expires
*[HS256]: HMAC with SHA-256 - symmetric algorithm for signing JWTs using a shared secret
*[Nonce]: Number used once; random value preventing replay attacks or adding uniqueness to CSP directives
*[Prototype Pollution]: JavaScript vulnerability where attacker modifies Object.prototype affecting all objects
*[Timing Attack]: Extracting secrets by measuring time differences in operations (e.g., string comparison timing)
*[Access Token]: Short-lived credential used to access protected resources, typically in OAuth/JWT flows
*[Bearer Token]: Type of access token that grants access to whoever possesses it (like a house key)
*[Refresh Token]: Long-lived credential used to obtain new access tokens without re-authentication
*[Audit Log]: Tamper-evident record of security-relevant events for investigation and compliance
*[Secret Management]: Secure storage, rotation, and access control for credentials, API keys, and encryption keys
*[Key Rotation]: Security practice of periodically changing cryptographic keys or credentials to limit exposure
*[SAMEORIGIN]: X-Frame-Options header value preventing page from being embedded except on same domain (clickjacking defense)
*[PoC]: Proof of Concept - minimal viable version for testing feasibility before full production release
*[V1]: Version 1 - first production release
*[V2]: Version 2 - second major release with additional features and hardening
*[False Positive]: Alert flagging benign behavior as a security issue when it isn't
*[True Positive]: Alert correctly identifying an actual security vulnerability
*[Penetration Test]: Authorized simulated attack to identify vulnerabilities before real attackers do
*[Threat Model]: Structured analysis of potential threats, attack vectors, and security controls
*[AWS]: Amazon Web Services - cloud computing platform providing infrastructure services
*[CI/CD]: Continuous Integration/Continuous Deployment - automated pipeline for building, testing, and deploying code
*[OpenAI]: AI research company providing GPT models and Realtime API for voice interaction
*[Anthropic]: AI safety company providing Claude language models
*[Claude]: Anthropic's family of large language models used for text generation and analysis
*[Google AI]: Google's artificial intelligence services including Imagen for image generation
