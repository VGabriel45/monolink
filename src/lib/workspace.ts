import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import yaml from 'yaml';
import type { PackageJson, PnpmWorkspace, WorkspacePackage } from '../types.js';

/**
 * Find the monorepo root by looking for pnpm-workspace.yaml
 */
export function findMonorepoRoot(startPath: string): string | null {
  let currentPath = path.resolve(startPath);
  
  while (currentPath !== path.dirname(currentPath)) {
    const workspaceFile = path.join(currentPath, 'pnpm-workspace.yaml');
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
  const workspaceFile = path.join(monorepoRoot, 'pnpm-workspace.yaml');
  
  if (!fs.existsSync(workspaceFile)) {
    throw new Error(`pnpm-workspace.yaml not found in ${monorepoRoot}`);
  }
  
  const content = fs.readFileSync(workspaceFile, 'utf-8');
  const workspace = yaml.parse(content) as PnpmWorkspace;
  
  return workspace.packages || ['packages/*'];
}

/**
 * Resolve all workspace package paths from patterns
 */
export async function resolveWorkspacePaths(monorepoRoot: string): Promise<Map<string, string>> {
  const patterns = getWorkspacePatterns(monorepoRoot);
  const packageMap = new Map<string, string>();
  
  for (const pattern of patterns) {
    // Convert workspace pattern to glob pattern for package.json files
    const globPattern = path.join(monorepoRoot, pattern, 'package.json');
    const matches = await glob(globPattern, { ignore: ['**/node_modules/**'] });
    
    for (const pkgJsonPath of matches) {
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
  const pkgJsonPath = path.join(pkgPath, 'package.json');
  
  if (!fs.existsSync(pkgJsonPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(pkgJsonPath, 'utf-8');
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Write package.json
 */
export function writePackageJson(pkgPath: string, pkgJson: PackageJson): void {
  const pkgJsonPath = path.join(pkgPath, 'package.json');
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
}

/**
 * Find a package in the workspace by name
 */
export async function findPackageInWorkspace(
  monorepoRoot: string,
  packageName: string
): Promise<string | null> {
  const workspacePaths = await resolveWorkspacePaths(monorepoRoot);
  return workspacePaths.get(packageName) || null;
}

/**
 * Get full workspace package info
 */
export async function getWorkspacePackage(
  monorepoRoot: string,
  packageName: string
): Promise<WorkspacePackage | null> {
  const packagePath = await findPackageInWorkspace(monorepoRoot, packageName);
  
  if (!packagePath) {
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
    .filter(([, version]) => version.startsWith('workspace:'))
    .map(([name]) => name);
}
