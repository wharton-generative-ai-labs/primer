# Security Policy

## Supported Versions

We actively support security updates for the latest stable version of Primer. Older versions may receive security updates on a best-effort basis.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability in Primer, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing:

**security@wharton.upenn.edu**

Please include:
- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact of the vulnerability
- Any suggested fixes or mitigations (if you have them)

### What to Expect

- We will acknowledge receipt of your report within 48 hours
- We will provide an initial assessment within 7 days
- We will keep you informed of our progress
- We will notify you when the vulnerability has been resolved

### Disclosure Policy

We follow a coordinated disclosure process:

1. **Initial Report**: You report the vulnerability privately
2. **Investigation**: We investigate and verify the vulnerability
3. **Fix Development**: We develop a fix
4. **Testing**: We test the fix thoroughly
5. **Release**: We release the fix in a security update
6. **Public Disclosure**: After the fix is released, we may publicly acknowledge the vulnerability and credit the reporter (with permission)

We ask that you:
- Allow us a reasonable amount of time to address the vulnerability before public disclosure
- Act in good faith to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Not access or modify data that does not belong to you

### Security Best Practices

When using Primer:

- **Keep dependencies updated**: Regularly update your dependencies to receive security patches
- **Secure API keys**: Never commit API keys or sensitive credentials to version control
- **Use environment variables**: Store sensitive configuration in environment variables
- **Review experience configurations**: When loading external experience configurations, review them for security concerns
- **Network security**: Use HTTPS in production environments
- **Access control**: Implement appropriate access controls for your deployment

### Known Security Considerations

- **API Key Management**: Primer requires API keys for various services. Ensure these are stored securely and never exposed in client-side code or logs.
- **File Uploads**: When using file upload features, validate file types and sizes appropriately for your use case.
- **WebSocket Connections**: Primer uses WebSocket connections for real-time features. Ensure your deployment uses secure WebSocket connections (WSS) in production.
- **External Content**: Primer can load external experience configurations and assets. Validate and sanitize external content appropriately.

### Security Updates

Security updates will be released as patch versions (e.g., 0.41.52) and will be documented in release notes. We recommend subscribing to repository notifications to be informed of security updates.

## Research Context

As a research project, Primer is provided "as-is" for research and educational purposes. While we take security seriously, users should be aware that this is experimental software and should take appropriate precautions when deploying it.

## Contact

For security-related questions or concerns, please contact: **security@wharton.upenn.edu**
