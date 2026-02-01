import path from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  findMonorepoRoot,
  getWorkspacePackage,
  registerPackage,
  getUniqueWorkspaceDeps,
  buildPackagesInOrder,
  resolveWorkspacePaths,
} from '../lib/index.js';

interface RegisterOptions {
  noBuild?: boolean;
}

async function selectPackage(monorepoRoot: string): Promise<string> {
  const allPackages = await resolveWorkspacePaths(monorepoRoot);
  const packageNames = Array.from(allPackages.keys()).sort();
  
  if (packageNames.length === 0) {
    console.log(chalk.red('✗ No packages found in workspace'));
    process.exit(1);
  }
  
  const { selectedPackage } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedPackage',
      message: 'Select a package to register:',
      choices: packageNames.map(name => ({
        name: name,
        value: name,
      })),
    },
  ]);
  
  return selectedPackage;
}

export async function registerCommand(
  packageName: string | undefined,
  options: RegisterOptions
): Promise<void> {
  const cwd = process.cwd();
  
  // Find monorepo root
  const monorepoRoot = findMonorepoRoot(cwd);
  
  if (!monorepoRoot) {
    console.log(chalk.red('✗ Could not find pnpm-workspace.yaml'));
    console.log(chalk.gray('  Make sure you are in a pnpm monorepo'));
    process.exit(1);
  }
  
  // If no package name provided, show interactive list
  if (!packageName) {
    packageName = await selectPackage(monorepoRoot);
  }
  
  console.log(chalk.cyan(`\n🔗 monolink register: ${packageName}\n`));
  console.log(chalk.gray(`Monorepo root: ${monorepoRoot}`));
  
  // Find the package
  const pkg = await getWorkspacePackage(monorepoRoot, packageName);
  
  if (!pkg) {
    console.log(chalk.red(`✗ Package "${packageName}" not found in workspace`));
    
    // Show available packages for debugging
    const allPackages = await resolveWorkspacePaths(monorepoRoot);
    if (allPackages.size > 0) {
      console.log(chalk.yellow('\nAvailable packages in workspace:'));
      Array.from(allPackages.keys()).sort().forEach(name => {
        console.log(chalk.gray(`  • ${name}`));
      });
    } else {
      console.log(chalk.yellow('\n⚠ No packages found in workspace. Check your pnpm-workspace.yaml patterns.'));
    }
    
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
