import fs from 'node:fs';
import path from 'node:path';
import type { LinkConfig, RegisteredPackage, PackageJson } from '../types.js';
import { readPackageJson, writePackageJson } from './workspace.js';

const LINKR_MARKER = '// monolink-managed';
const LINKR_CONFIG_FILE = '.monolink-local.json';

interface LocalLinkConfig {
  linkedPackages: string[];
  originalOverrides?: Record<string, string>;
  addedDependencies?: string[]; // Track which deps we added (to remove on unlink)
}

/**
 * Generate link config for a registered package
 */
export function generateLinkConfig(pkg: RegisteredPackage): LinkConfig {
  const dependencies: Record<string, string> = {
    [pkg.name]: `file:${pkg.packagePath}`,
  };
  
  const overrides: Record<string, string> = {
    [pkg.name]: `file:${pkg.packagePath}`,
  };
  
  // Add all workspace dependencies
  for (const dep of pkg.workspaceDeps) {
    dependencies[dep.name] = `file:${dep.path}`;
    overrides[dep.name] = `file:${dep.path}`;
  }
  
  return { dependencies, overrides };
}

/**
 * Read local linkr config
 */
function readLocalConfig(projectPath: string): LocalLinkConfig {
  const configPath = path.join(projectPath, LINKR_CONFIG_FILE);
  
  if (!fs.existsSync(configPath)) {
    return { linkedPackages: [] };
  }
  
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as LocalLinkConfig;
  } catch {
    return { linkedPackages: [] };
  }
}

/**
 * Write local linkr config
 */
function writeLocalConfig(projectPath: string, config: LocalLinkConfig): void {
  const configPath = path.join(projectPath, LINKR_CONFIG_FILE);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Apply link config to target project
 */
export function applyLinkConfig(
  projectPath: string,
  packageName: string,
  config: LinkConfig
): void {
  const pkgJson = readPackageJson(projectPath);
  
  if (!pkgJson) {
    throw new Error(`No package.json found in ${projectPath}`);
  }
  
  // Read local config to track linked packages
  const localConfig = readLocalConfig(projectPath);
  
  // Save original overrides if this is the first link
  if (localConfig.linkedPackages.length === 0) {
    localConfig.originalOverrides = (pkgJson as any).pnpm?.overrides || {};
  }
  
  // Initialize added dependencies tracking
  if (!localConfig.addedDependencies) {
    localConfig.addedDependencies = [];
  }
  
  // Add package to tracked list
  if (!localConfig.linkedPackages.includes(packageName)) {
    localConfig.linkedPackages.push(packageName);
  }
  
  // Add main package to dependencies if not already present
  if (!pkgJson.dependencies) {
    pkgJson.dependencies = {};
  }
  
  // Only add the main package to dependencies (not workspace deps - those are handled by overrides)
  if (!pkgJson.dependencies[packageName]) {
    pkgJson.dependencies[packageName] = config.dependencies[packageName];
    localConfig.addedDependencies.push(packageName);
  }
  
  // Apply overrides for main package and all workspace deps
  if (!(pkgJson as any).pnpm) {
    (pkgJson as any).pnpm = {};
  }
  
  (pkgJson as any).pnpm.overrides = {
    ...(pkgJson as any).pnpm.overrides,
    ...config.overrides,
  };
  
  // Write updated package.json
  writePackageJson(projectPath, pkgJson);
  
  // Write local config
  writeLocalConfig(projectPath, localConfig);
}

/**
 * Remove link config from target project
 */
export function removeLinkConfig(
  projectPath: string,
  packageName: string,
  pkg: RegisteredPackage
): void {
  const pkgJson = readPackageJson(projectPath);
  
  if (!pkgJson) {
    throw new Error(`No package.json found in ${projectPath}`);
  }
  
  const localConfig = readLocalConfig(projectPath);
  
  // Remove package from tracked list
  localConfig.linkedPackages = localConfig.linkedPackages.filter(p => p !== packageName);
  
  // Get all packages that need to be unlinked
  const packagesToRemove = [pkg.name, ...pkg.workspaceDeps.map(d => d.name)];
  
  // Remove the dependency we added (if we added it)
  if (localConfig.addedDependencies?.includes(packageName) && pkgJson.dependencies) {
    delete pkgJson.dependencies[packageName];
    localConfig.addedDependencies = localConfig.addedDependencies.filter(d => d !== packageName);
    
    // Clean up empty dependencies object
    if (Object.keys(pkgJson.dependencies).length === 0) {
      delete pkgJson.dependencies;
    }
  }
  
  // Remove overrides for this package and its deps
  if ((pkgJson as any).pnpm?.overrides) {
    for (const pkgName of packagesToRemove) {
      delete (pkgJson as any).pnpm.overrides[pkgName];
    }
    
    // If no more linked packages, restore original overrides
    if (localConfig.linkedPackages.length === 0) {
      (pkgJson as any).pnpm.overrides = localConfig.originalOverrides || {};
      
      // Clean up empty pnpm config
      if (Object.keys((pkgJson as any).pnpm.overrides).length === 0) {
        delete (pkgJson as any).pnpm.overrides;
      }
      if (Object.keys((pkgJson as any).pnpm).length === 0) {
        delete (pkgJson as any).pnpm;
      }
    }
  }
  
  // Write updated package.json
  writePackageJson(projectPath, pkgJson);
  
  // Write or remove local config
  if (localConfig.linkedPackages.length === 0) {
    const configPath = path.join(projectPath, LINKR_CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } else {
    writeLocalConfig(projectPath, localConfig);
  }
}

/**
 * Get currently linked packages in a project
 */
export function getLinkedPackages(projectPath: string): string[] {
  const localConfig = readLocalConfig(projectPath);
  return localConfig.linkedPackages;
}

/**
 * Check if a package is linked in the project
 */
export function isPackageLinked(projectPath: string, packageName: string): boolean {
  return getLinkedPackages(projectPath).includes(packageName);
}
