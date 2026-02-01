import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";
import yaml from "yaml";
import type { PackageJson, PnpmWorkspace, WorkspacePackage } from "../types.js";
import {
	isValidGlobPattern,
	isValidPackageName,
	logError,
	validatePathWithinRoot,
} from "./security.js";

/**
 * Find the monorepo root by looking for pnpm-workspace.yaml
 */
export function findMonorepoRoot(startPath: string): string | null {
	let currentPath = path.resolve(startPath);

	while (currentPath !== path.dirname(currentPath)) {
		const workspaceFile = path.join(currentPath, "pnpm-workspace.yaml");
		if (fs.existsSync(workspaceFile)) {
			return currentPath;
		}
		currentPath = path.dirname(currentPath);
	}

	return null;
}

/**
 * Parse pnpm-workspace.yaml and get workspace patterns
 */
export function getWorkspacePatterns(monorepoRoot: string): string[] {
	const workspaceFile = path.join(monorepoRoot, "pnpm-workspace.yaml");

	if (!fs.existsSync(workspaceFile)) {
		throw new Error(`pnpm-workspace.yaml not found in ${monorepoRoot}`);
	}

	const content = fs.readFileSync(workspaceFile, "utf-8");
	let workspace: PnpmWorkspace;

	try {
		workspace = yaml.parse(content) as PnpmWorkspace;
	} catch (err) {
		logError("yaml-parse", err);
		throw new Error("Invalid YAML in pnpm-workspace.yaml");
	}

	// Validate workspace structure
	if (workspace && typeof workspace === "object" && "packages" in workspace) {
		if (Array.isArray(workspace.packages)) {
			// Validate all patterns
			const validPatterns = workspace.packages.filter((pattern: unknown) => {
				if (typeof pattern !== "string") {
					return false;
				}
				return isValidGlobPattern(pattern);
			});

			if (validPatterns.length === 0) {
				return ["packages/*"];
			}

			return validPatterns;
		}
	}

	// Fallback to default if packages is not a valid array
	return ["packages/*"];
}

/**
 * Resolve all workspace package paths from patterns
 */
export async function resolveWorkspacePaths(
	monorepoRoot: string,
): Promise<Map<string, string>> {
	const patterns = getWorkspacePatterns(monorepoRoot);
	const packageMap = new Map<string, string>();
	const resolvedRoot = path.resolve(monorepoRoot);

	for (const pattern of patterns) {
		// Normalize pattern to use forward slashes for glob (works cross-platform)
		const normalizedPattern = pattern.replace(/\\/g, "/");
		const globPattern = `${normalizedPattern}/package.json`;

		// Use posix-style paths for glob, then resolve to absolute paths
		const matches = await glob(globPattern, {
			cwd: monorepoRoot,
			ignore: ["**/node_modules/**"],
			absolute: true,
		});

		for (const pkgJsonPath of matches) {
			// Validate path is within monorepo root
			if (!validatePathWithinRoot(pkgJsonPath, resolvedRoot)) {
				logError(
					"path-validation",
					new Error(`Path outside monorepo: ${pkgJsonPath}`),
				);
				continue;
			}

			const pkgDir = path.dirname(pkgJsonPath);
			const pkgJson = readPackageJson(pkgDir);

			if (pkgJson?.name) {
				packageMap.set(pkgJson.name, pkgDir);
			}
		}
	}

	return packageMap;
}

/**
 * Read and parse package.json
 */
export function readPackageJson(pkgPath: string): PackageJson | null {
	const pkgJsonPath = path.join(pkgPath, "package.json");

	if (!fs.existsSync(pkgJsonPath)) {
		return null;
	}

	try {
		const content = fs.readFileSync(pkgJsonPath, "utf-8");
		return JSON.parse(content) as PackageJson;
	} catch (err) {
		logError("package-json-parse", err);
		return null;
	}
}

/**
 * Write package.json
 */
export function writePackageJson(pkgPath: string, pkgJson: PackageJson): void {
	const pkgJsonPath = path.join(pkgPath, "package.json");
	fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkgJson, null, 2)}\n`);
}

/**
 * Find a package in the workspace by name
 */
export async function findPackageInWorkspace(
	monorepoRoot: string,
	packageName: string,
): Promise<string | null> {
	const workspacePaths = await resolveWorkspacePaths(monorepoRoot);
	return workspacePaths.get(packageName) || null;
}

/**
 * Get full workspace package info
 */
export async function getWorkspacePackage(
	monorepoRoot: string,
	packageName: string,
): Promise<WorkspacePackage | null> {
	// Validate package name
	if (!isValidPackageName(packageName)) {
		throw new Error(`Invalid package name: ${packageName}`);
	}

	const packagePath = await findPackageInWorkspace(monorepoRoot, packageName);

	if (!packagePath) {
		return null;
	}

	// Validate path is within monorepo
	const resolvedRoot = path.resolve(monorepoRoot);
	if (!validatePathWithinRoot(packagePath, resolvedRoot)) {
		logError(
			"path-validation",
			new Error(`Package path outside monorepo: ${packagePath}`),
		);
		return null;
	}

	const packageJson = readPackageJson(packagePath);

	if (!packageJson) {
		return null;
	}

	const workspaceDeps = getWorkspaceDeps(packageJson);

	return {
		name: packageJson.name,
		path: packagePath,
		packageJson,
		workspaceDeps,
	};
}

/**
 * Extract workspace:* dependencies from package.json
 */
export function getWorkspaceDeps(pkgJson: PackageJson): string[] {
	const allDeps = {
		...pkgJson.dependencies,
		...pkgJson.devDependencies,
		...pkgJson.peerDependencies,
	};

	return Object.entries(allDeps)
		.filter(([, version]) => version.startsWith("workspace:"))
		.map(([name]) => name);
}
