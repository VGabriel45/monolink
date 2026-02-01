import path from "node:path";

/**
 * Validate that a path is within a root directory (prevents path traversal)
 */
export function validatePathWithinRoot(
	filePath: string,
	rootPath: string,
): boolean {
	const resolvedPath = path.resolve(filePath);
	const resolvedRoot = path.resolve(rootPath);

	// Ensure the path is within the root
	return (
		resolvedPath.startsWith(resolvedRoot + path.sep) ||
		resolvedPath === resolvedRoot
	);
}

/**
 * Validate package name format (npm package name rules)
 */
export function isValidPackageName(name: string): boolean {
	if (!name || typeof name !== "string") {
		return false;
	}

	// Scoped package: @scope/package-name
	// Unscoped: package-name
	const scopedPattern = /^@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*$/;
	const unscopedPattern = /^[a-z0-9-~][a-z0-9-._~]*$/;

	return scopedPattern.test(name) || unscopedPattern.test(name);
}

/**
 * Validate glob pattern is safe (doesn't contain dangerous patterns)
 */
export function isValidGlobPattern(pattern: string): boolean {
	if (!pattern || typeof pattern !== "string") {
		return false;
	}

	// Reject patterns that try to escape the directory
	const dangerousPatterns = [
		/\.\./, // Path traversal
		/^\/+/, // Absolute paths
		/^~/, // Home directory
		/^\w+:/, // Windows drive letters
	];

	return !dangerousPatterns.some((regex) => regex.test(pattern));
}

/**
 * Normalize and validate a path, ensuring it's within root
 */
export function safeResolvePath(
	filePath: string,
	rootPath: string,
): string | null {
	try {
		const resolved = path.resolve(rootPath, filePath);

		if (!validatePathWithinRoot(resolved, rootPath)) {
			return null;
		}

		return resolved;
	} catch {
		return null;
	}
}

/**
 * Log error with context (for debugging without exposing to users)
 */
export function logError(context: string, error: unknown): void {
	const errorMessage = error instanceof Error ? error.message : String(error);
	// In production, you might want to use a proper logger
	// For now, we'll just ensure errors are captured
	if (process.env.DEBUG) {
		console.error(`[${context}]`, errorMessage);
	}
}
