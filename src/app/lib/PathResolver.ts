export class PathResolver {
    private isAbsoluteUrl(url: string): boolean {
        return url.startsWith('http://') || url.startsWith('https://');
    }

    resolvePath(path: string): { path: string; isAbsolute: boolean } {
        if (this.isAbsoluteUrl(path)) {
            return { path, isAbsolute: true };
        }

        return {
            path: path,
            isAbsolute: false
        };
    }
}