import path from 'node:path';
import chalk from 'chalk';
import chokidar from 'chokidar';
import {
  getRegisteredPackage,
  resolveWorkspacePaths,
  buildPackage,
} from '../lib/index.js';

interface WatchOptions {
  debounce?: number;
}

export async function watchCommand(
  packageName: string,
  options: WatchOptions
): Promise<void> {
  const debounceMs = options.debounce || 300;
  
  console.log(chalk.cyan(`\n👀 monolink watch: ${packageName}\n`));
  
  // Get registered package
  const pkg = getRegisteredPackage(packageName);
  
  if (!pkg) {
    console.log(chalk.red(`✗ Package "${packageName}" is not registered`));
    console.log(chalk.gray('\nTo register a package, run in the source monorepo:'));
    console.log(chalk.cyan(`  npx monolink register ${packageName}`));
    process.exit(1);
  }
  
  const workspacePaths = await resolveWorkspacePaths(pkg.monorepoRoot);
  
  // Collect all paths to watch
  const watchPaths: { name: string; path: string }[] = [
    { name: pkg.name, path: pkg.packagePath },
    ...pkg.workspaceDeps,
  ];
  
  console.log(chalk.gray('Watching packages:'));
  watchPaths.forEach(({ name, path: pkgPath }) => {
    console.log(chalk.gray(`  • ${name} (${pkgPath}/src)`));
  });
  console.log();
  
  // Debounce builds
  const buildQueue = new Map<string, NodeJS.Timeout>();
  
  const triggerBuild = (pkgName: string, pkgPath: string) => {
    // Clear existing timeout
    const existing = buildQueue.get(pkgName);
    if (existing) {
      clearTimeout(existing);
    }
    
    // Set new timeout
    buildQueue.set(
      pkgName,
      setTimeout(async () => {
        buildQueue.delete(pkgName);
        console.log(chalk.blue(`\n🔄 Change detected in ${pkgName}`));
        await buildPackage(pkgPath, pkgName);
        console.log(chalk.gray('\nWatching for changes... (Ctrl+C to stop)'));
      }, debounceMs)
    );
  };
  
  // Set up watchers for each package
  const watchers: chokidar.FSWatcher[] = [];
  
  for (const { name, path: pkgPath } of watchPaths) {
    const srcPath = path.join(pkgPath, 'src');
    
    const watcher = chokidar.watch(srcPath, {
      ignored: [
        /(^|[\/\\])\../,
        /node_modules/,
        /\.d\.ts$/,
      ],
      persistent: true,
      ignoreInitial: true,
    });
    
    watcher.on('change', (filePath) => {
      console.log(chalk.gray(`  Changed: ${path.relative(pkgPath, filePath)}`));
      triggerBuild(name, pkgPath);
    });
    
    watcher.on('add', (filePath) => {
      console.log(chalk.gray(`  Added: ${path.relative(pkgPath, filePath)}`));
      triggerBuild(name, pkgPath);
    });
    
    watcher.on('unlink', (filePath) => {
      console.log(chalk.gray(`  Deleted: ${path.relative(pkgPath, filePath)}`));
      triggerBuild(name, pkgPath);
    });
    
    watchers.push(watcher);
  }
  
  console.log(chalk.green('✓ Watch mode started'));
  console.log(chalk.gray('\nWatching for changes... (Ctrl+C to stop)'));
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n👋 Stopping watch mode...'));
    
    // Clear pending builds
    for (const timeout of buildQueue.values()) {
      clearTimeout(timeout);
    }
    
    // Close watchers
    Promise.all(watchers.map(w => w.close())).then(() => {
      console.log(chalk.green('✓ Watch mode stopped'));
      process.exit(0);
    });
  });
}
