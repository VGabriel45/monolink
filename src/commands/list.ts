import chalk from 'chalk';
import {
  listRegisteredPackages,
  getLinkedPackages,
  getManifestPath,
} from '../lib/index.js';

interface ListOptions {
  local?: boolean;
}

export async function listCommand(options: ListOptions): Promise<void> {
  if (options.local) {
    // List packages linked in current project
    const linkedPackages = getLinkedPackages(process.cwd());
    
    console.log(chalk.cyan('\n🔗 Packages linked in this project:\n'));
    
    if (linkedPackages.length === 0) {
      console.log(chalk.gray('  No packages are currently linked'));
      console.log(chalk.gray('\n  To link a package, run:'));
      console.log(chalk.cyan('    npx linkr use <package-name>'));
      return;
    }
    
    linkedPackages.forEach(pkg => {
      console.log(chalk.white(`  • ${pkg}`));
    });
    
    console.log(chalk.gray('\n  To unlink a package, run:'));
    console.log(chalk.cyan('    npx linkr unuse <package-name>'));
    return;
  }
  
  // List all registered packages
  const packages = listRegisteredPackages();
  
  console.log(chalk.cyan('\n🔗 Registered packages:\n'));
  
  if (packages.length === 0) {
    console.log(chalk.gray('  No packages are registered'));
    console.log(chalk.gray('\n  To register a package, run in a monorepo:'));
    console.log(chalk.cyan('    npx linkr register <package-name>'));
    return;
  }
  
  packages.forEach(pkg => {
    console.log(chalk.white(`  ${pkg.name}`));
    console.log(chalk.gray(`    Path: ${pkg.packagePath}`));
    console.log(chalk.gray(`    Monorepo: ${pkg.monorepoRoot}`));
    
    if (pkg.workspaceDeps.length > 0) {
      console.log(chalk.gray(`    Deps: ${pkg.workspaceDeps.map(d => d.name).join(', ')}`));
    }
    
    const registeredDate = new Date(pkg.registeredAt).toLocaleString();
    console.log(chalk.gray(`    Registered: ${registeredDate}`));
    
    if (pkg.builtAt) {
      const builtDate = new Date(pkg.builtAt).toLocaleString();
      console.log(chalk.gray(`    Built: ${builtDate}`));
    }
    
    console.log();
  });
  
  console.log(chalk.gray(`Manifest: ${getManifestPath()}`));
}
