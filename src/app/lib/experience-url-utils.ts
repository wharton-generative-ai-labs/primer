export class ExperienceURLError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExperienceURLError';
    }
}

/* this is for the actual configuration, not the package */
export function validateAndProcessExperienceURL(url: string): string {
    // Trim whitespace
    url = url.trim();

    // Check if it's an absolute URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
            new URL(url);
        } catch {
            throw new ExperienceURLError('Invalid URL format');
        }
    }
    // Check if it's a relative URL
    else if (url.startsWith('/')) {
        // No additional validation needed for relative URLs
    }
    else {
        throw new ExperienceURLError('URL must be absolute (starting with http:// or https://) or relative (starting with /)');
    }

    // URL must end with .json
    if (!url.toLowerCase().endsWith('.json')) {
        throw new ExperienceURLError('Experience URL must end with .json');
    }

    return url;
}