---
id: contributing
title: Contributing
sidebar_position: 5
---

# Contributing to Primer

Thank you for your interest in contributing! This guide will help you get started.

## About Primer

Primer is an experimental platform developed as part of research at Wharton Generative AI Labs. It's open source under the Mozilla Public License 2.0.

## Ways to Contribute

### Report Issues

Found a bug? Have a feature request?

1. Check if it's already reported
2. Open a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, browser)
   - Error messages or logs

### Contribute Code

1. **Fork and Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Follow Code Standards**
   - TypeScript with strict typing
   - ESLint rules enforced
   - Clear, self-documenting code
   - Comments for complex logic

3. **Test Your Changes**
   ```bash
   npm run lint        # Check code style
   npm test            # Run tests
   npm run dev         # Test manually
   ```

4. **Commit Clearly**
   - Descriptive commit messages
   - Reference related issues
   - One logical change per commit

5. **Submit Pull Request**
   - Clear description of changes
   - Explain why changes are needed
   - Reference related issues
   - Ensure all checks pass

### Improve Documentation

Documentation contributions are valuable:

- Fix typos or unclear explanations
- Add examples
- Create tutorials
- Translate content

## Development Setup

See the [Setup Guide](/developer/setup) for detailed instructions.

Quick start:

```bash
git clone https://github.com/your-org/primer.git
cd primer
npm install
# Create .env with OPENAI_API_KEY
npm run dev
```

## Code Style

### TypeScript

- Use strict type checking
- Define interfaces for complex objects
- Avoid `any` type
- Use meaningful names

### React Components

- Functional components with hooks
- Props interfaces defined
- Use TypeScript for props
- Keep components focused

### File Organization

- Group related code
- Use index.ts for exports
- Keep files under 500 lines
- Extract reusable logic

## Pull Request Process

1. **Before Submitting**
   - Run linter and fix issues
   - Update documentation if needed
   - Add tests for new features
   - Ensure all tests pass

2. **PR Description**
   - What changed and why
   - How to test
   - Screenshots if UI changes
   - Breaking changes noted

3. **Review Process**
   - Maintainers will review
   - Address feedback
   - Keep discussions constructive
   - Be patient

4. **After Approval**
   - Maintainers will merge
   - Delete your branch
   - Celebrate! 🎉

## Commit Message Guidelines

Good commit messages help understand changes:

```
feat: Add web search tool for agents

- Implement research tool with web search
- Add configuration for search API
- Update documentation

Closes #123
```

Format: `type: description`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

## Testing

### Manual Testing

1. Start dev server: `npm run dev`
2. Load an experience
3. Test your changes
4. Check browser console
5. Verify no regressions

### Automated Tests

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
```

## Documentation

When adding features:

1. Update relevant docs in `docs/`
2. Add JSDoc comments to public APIs
3. Include examples
4. Update changelog

## Research Context

Primer is a research project exploring:
- Human-AI collaboration
- Multi-modal AI interactions
- Agent orchestration
- Voice-based interfaces

Contributions aligned with these goals are especially welcome.

## Questions?

- Open an issue with the `question` label
- Check existing documentation
- Review closed issues and PRs

## License

By contributing, you agree your contributions will be licensed under the Mozilla Public License 2.0.

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to learn and build together.

## Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes
- Project documentation

Thank you for contributing to Primer! 🚀
