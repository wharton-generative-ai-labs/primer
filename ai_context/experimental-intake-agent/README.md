# Experimental Intake Agent

A second meta-experience for creating interactive, component-heavy educational experiences. While the original `intake-agent` creates conversation-only experiences (Roleplay, Teachback templates), the `experimental-intake-agent` creates experiences where AI agents actively use interactive React components to tutor students.

## Key Differences from Original Intake Agent

| Aspect | intake-agent | experimental-intake-agent |
|--------|-------------|--------------------------|
| Templates | Roleplay, Teachback | Tutor, Lab |
| Components | None | Interactive React components |
| Agent count in pipeline | 5 (Intake, Design, Casting Director, Image Gen, Experience Builder) | 6 (adds Interface Designer) |
| Student interaction | Conversation only | Conversation + interactive components |
| Target subjects | Interpersonal skills, knowledge demonstration | Science, math, data analysis, any hands-on subject |

## Architecture

See [architecture.md](architecture.md) for the full pipeline diagram and component communication protocol.

## Storage Layout

```
storage/
├── experimental-intake-agent/   # The meta-experience
├── tutor-template/              # Single-agent interactive template
└── lab-template/                # Multi-agent interactive template (5E model)
```

## Related Documentation

- [Template Discovery Implementation](../template-discovery-implementation/README.md) - How templates are discovered dynamically
- [Custom Components Roadmap](../roadmap/custom-components/session-data-workflow.md) - Component workflow through meta and target experiences
