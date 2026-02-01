import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  getRegisteredPackage,
  removeLinkConfig,
  isPackageLinked,
  installDependencies,
  getLinkedPackages,
} from '../lib/index.js';

interface UnuseOptions {
  noInstall?: boolean;
}

async function selectLinkedPackage(cwd: string): Promise<string> {
  const linkedPackages = getLinkedPackages(cwd);
  
  if (linkedPackages.length === 0) {
    console.log(chalk.yellow('⚠ No packages are linked in this project'));
    process.exit(0);
  }
  
  const { selectedPackage } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedPackage',
      message: 'Select a package to unlink:',
      choices: linkedPackages.map(name => ({
        name: name,
        value: name,
      })),
    },
  ]);
  
  return selectedPackage;
}

export async function unuseCommand(
  packageName: string | undefined,
  options: UnuseOptions
): Promise<void> {
  const cwd = process.cwd();
  
  // If no package name provided, show interactive list
  if (!packageName) {
    packageName = await selectLinkedPackage(cwd);
  }
  
  console.log(chalk.cyan(`\n🔗 monolink unuse: ${packageName}\n`));
  
  // Check if linked
  if (!isPackageLinked(cwd, packageName)) {
    console.log(chalk.yellow(`⚠ Package "${packageName}" is not linked in this project`));
    return;
  }
  
  // Get registered package info
  const pkg = getRegisteredPackage(packageName);
  
  if (!pkg) {
    console.log(chalk.red(`✗ Package "${packageName}" is not registered`));
    console.log(chalk.gray('  The manifest may have been removed. Check .linkr-local.json'));
    process.exit(1);
  }
  
  // Remove link config
  try {
    removeLinkConfig(cwd, packageName, pkg);
    console.log(chalk.green('✓ Removed link configuration from package.json'));
  } catch (err) {
    console.log(chalk.red(`✗ Failed to update package.json: ${(err as Error).message}`));
    process.exit(1);
  }
  
  // Reinstall dependencies
  if (!options.noInstall) {
    console.log(chalk.cyan('\n📦 Reinstalling dependencies...\n'));
    const installSuccess = await installDependencies(cwd);
    
    if (!installSuccess) {
      console.log(chalk.red('\n✗ Installation failed'));
      process.exit(1);
    }
  } else {
    console.log(chalk.yellow('\n⚠ Skipping install (--no-install flag)'));
    console.log(chalk.gray('  Run "pnpm install" to apply changes'));
  }
  
  console.log(chalk.green(`\n✓ Successfully unlinked ${packageName}`));
}
