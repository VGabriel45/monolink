import type { WorkspaceDepInfo } from '../types.js';
import {
  resolveWorkspacePaths,
  readPackageJson,
  getWorkspaceDeps,
} from './workspace.js';

/**
 * Recursively collect all workspace dependencies for a package
 */
export async function collectAllWorkspaceDeps(
  monorepoRoot: string,
  packageName: string,
  visited: Set<string> = new Set()
): Promise<WorkspaceDepInfo[]> {
  if (visited.has(packageName)) {
    return [];
  }
  visited.add(packageName);
  
  const workspacePaths = await resolveWorkspacePaths(monorepoRoot);
  const packagePath = workspacePaths.get(packageName);
  
  if (!packagePath) {
    return [];
  }
  
  const pkgJson = readPackageJson(packagePath);
  if (!pkgJson) {
    return [];
  }
  
  const directDeps = getWorkspaceDeps(pkgJson);
  const result: WorkspaceDepInfo[] = [];
  
  for (const depName of directDeps) {
    const depPath = workspacePaths.get(depName);
    if (depPath) {
      result.push({ name: depName, path: depPath });
      
      // Recursively collect transitive deps
      const transitiveDeps = await collectAllWorkspaceDeps(monorepoRoot, depName, visited);
      result.push(...transitiveDeps);
    }
  }
  
  return result;
}

/**
 * Get unique workspace deps (deduplicated)
 */
export async function getUniqueWorkspaceDeps(
  monorepoRoot: string,
  packageName: string
): Promise<WorkspaceDepInfo[]> {
  const allDeps = await collectAllWorkspaceDeps(monorepoRoot, packageName);
  const seen = new Set<string>();
  
  return allDeps.filter(dep => {
    if (seen.has(dep.name)) {
      return false;
    }
    seen.add(dep.name);
    return true;
  });
}

/**
 * Build dependency graph for topological sort
 */
export async function buildDependencyGraph(
  monorepoRoot: string,
  packages: string[]
): Promise<Map<string, string[]>> {
  const workspacePaths = await resolveWorkspacePaths(monorepoRoot);
  const graph = new Map<string, string[]>();
  
  for (const pkgName of packages) {
    const pkgPath = workspacePaths.get(pkgName);
    if (!pkgPath) continue;
    
    const pkgJson = readPackageJson(pkgPath);
    if (!pkgJson) continue;
    
    const deps = getWorkspaceDeps(pkgJson).filter(dep => packages.includes(dep));
    graph.set(pkgName, deps);
  }
  
  return graph;
}

/**
 * Topological sort using Kahn's algorithm
 * Returns packages in build order (dependencies first)
 */
export function topologicalSort(graph: Map<string, string[]>): string[] {
  const inDegree = new Map<string, number>();
  const result: string[] = [];
  
  // Initialize in-degree for all nodes
  for (const node of graph.keys()) {
    if (!inDegree.has(node)) {
      inDegree.set(node, 0);
    }
  }
  
  // Calculate in-degrees
  for (const deps of graph.values()) {
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
    }
  }
  
  // Find all nodes with no dependencies
  const queue: string[] = [];
  for (const [node, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(node);
    }
  }
  
  // Process queue
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    
    // For each node that depends on current node
    for (const [pkg, deps] of graph.entries()) {
      if (deps.includes(node)) {
        const newDegree = (inDegree.get(pkg) || 1) - 1;
        inDegree.set(pkg, newDegree);
        
        if (newDegree === 0) {
          queue.push(pkg);
        }
      }
    }
  }
  
  // Check for cycles
  if (result.length !== graph.size) {
    throw new Error('Circular dependency detected in workspace packages');
  }
  
  return result;
}

/**
 * Get packages in build order
 */
export async function getPackagesInBuildOrder(
  monorepoRoot: string,
  targetPackage: string
): Promise<string[]> {
  // Get all workspace deps including the target
  const deps = await getUniqueWorkspaceDeps(monorepoRoot, targetPackage);
  const allPackages = [targetPackage, ...deps.map(d => d.name)];
  
  // Build dependency graph
  const graph = await buildDependencyGraph(monorepoRoot, allPackages);
  
  // Sort topologically
  return topologicalSort(graph);
}
