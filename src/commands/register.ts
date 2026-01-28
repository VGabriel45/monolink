import path from 'node:path';
import chalk from 'chalk';
import {
  findMonorepoRoot,
  getWorkspacePackage,
  registerPackage,
  getUniqueWorkspaceDeps,
  buildPackagesInOrder,
} from '../lib/index.js';

interface RegisterOptions {
  noBuild?: boolean;
}

export async function registerCommand(
  packageName: string,
  options: RegisterOptions
): Promise<void> {
  const cwd = process.cwd();
  
  console.log(chalk.cyan(`\n🔗 monolink register: ${packageName}\n`));
  
  // Find monorepo root
  const monorepoRoot = findMonorepoRoot(cwd);
  
  if (!monorepoRoot) {
    console.log(chalk.red('✗ Could not find pnpm-workspace.yaml'));
    console.log(chalk.gray('  Make sure you are in a pnpm monorepo'));
    process.exit(1);
  }
  
  console.log(chalk.gray(`Monorepo root: ${monorepoRoot}`));
  
  // Find the package
  const pkg = await getWorkspacePackage(monorepoRoot, packageName);
  
  if (!pkg) {
    console.log(chalk.red(`✗ Package "${packageName}" not found in workspace`));
    process.exit(1);
  }
  
  console.log(chalk.gray(`Package path: ${pkg.path}`));
  
  // Get all workspace dependencies
  const workspaceDeps = await getUniqueWorkspaceDeps(monorepoRoot, packageName);
  
  if (workspaceDeps.length > 0) {
    console.log(chalk.cyan('\nWorkspace dependencies:'));
    workspaceDeps.forEach(dep => {
      console.log(chalk.gray(`  • ${dep.name}`));
    });
  }
  
  // Build packages if not skipped
  if (!options.noBuild) {
    const buildSuccess = await buildPackagesInOrder(monorepoRoot, packageName);
    
    if (!buildSuccess) {
      console.log(chalk.red('\n✗ Build failed'));
      process.exit(1);
    }
  } else {
    console.log(chalk.yellow('\n⚠ Skipping build (--no-build flag)'));
  }
  
  // Register the package
  registerPackage({
    name: packageName,
    monorepoRoot,
    packagePath: pkg.path,
    workspaceDeps,
    registeredAt: new Date().toISOString(),
    builtAt: options.noBuild ? undefined : new Date().toISOString(),
  });
  
  console.log(chalk.green(`\n✓ Successfully registered ${packageName}`));
  console.log(chalk.gray(`\nTo link this package in another project, run:`));
  console.log(chalk.cyan(`  npx monolink use ${packageName}`));
}
