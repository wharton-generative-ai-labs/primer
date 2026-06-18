# Contributing to Primer

Thank you for your interest in contributing to Primer! This document provides guidelines and instructions for contributing to this open-source research project.

## About Primer

Primer is an experimental platform for creating interactive AI experiences that combine voice, visuals, and autonomous decision-making. It's developed as part of research at Wharton Generative AI Labs.

## How to Contribute

### Reporting Security Vulnerabilities

If you discover a security vulnerability, please **do NOT** create a public GitHub issue.

**Instead, please report it privately to: genailab@wharton.upenn.edu**

Include in your report:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (optional)

We will acknowledge receipt within 48 hours and work with you to address the issue responsibly.

### Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub. When reporting bugs, please include:

- A clear description of the issue
- Steps to reproduce the problem
- Expected behavior
- Actual behavior
- Your environment (OS, Node.js version, etc.)
- Any relevant error messages or logs

### Contributing Code

1. **Fork the repository** and create a new branch for your changes
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards:
   - Follow the existing code style and conventions
   - Write clear, self-documenting code
   - Add comments for complex logic
   - Ensure TypeScript types are properly defined

3. **Test your changes**
   - Run the linter: `npm run lint`
   - Run tests: `npm test`
   - Test manually in development mode: `npm run dev`

4. **Commit your changes**
   - Write clear, descriptive commit messages
   - Reference any related issues in your commit message

5. **Submit a Pull Request**
   - Provide a clear description of your changes
   - Explain why the changes are needed
   - Reference any related issues
   - Ensure all checks pass

### Code Style

- We use TypeScript with strict type checking
- Follow the existing code formatting (we use ESLint)
- Use meaningful variable and function names
- Keep functions focused and single-purpose
- Add JSDoc comments for public APIs

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install` (this will use the committed `package-lock.json` for deterministic builds)
3. Set up environment variables (see README.md)
4. Run the development server: `npm run dev`

**Note:** The `package-lock.json` file is committed to the repository to ensure consistent dependency versions across all environments. When adding or updating dependencies, always commit the updated `package-lock.json` file.

### Pull Request Process

1. Ensure your code follows the project's style guidelines
2. Update documentation if you've changed functionality
3. Add tests if you've added new features
4. Ensure all tests pass
5. Get approval from maintainers before merging

### Research Context

Since this is a research project, contributions that align with the project's research goals are particularly welcome. If you're working on a significant feature or research-related contribution, consider reaching out to discuss it first.

## Contact

For questions, security issues, code of conduct concerns, or other inquiries, contact the Wharton Generative AI Labs team at **genailab@wharton.upenn.edu**.

## License

By contributing to Primer, you agree that your contributions will be licensed under the MIT License, the same license as the project.
