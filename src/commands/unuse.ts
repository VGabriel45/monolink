import chalk from 'chalk';
import {
  getRegisteredPackage,
  removeLinkConfig,
  isPackageLinked,
  installDependencies,
} from '../lib/index.js';

interface UnuseOptions {
  noInstall?: boolean;
}

export async function unuseCommand(
  packageName: string,
  options: UnuseOptions
): Promise<void> {
  const cwd = process.cwd();
  
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
