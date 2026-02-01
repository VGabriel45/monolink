import { spawn } from "node:child_process";
import path from "node:path";
import chalk from "chalk";
import { getPackagesInBuildOrder } from "./deps.js";
import { readPackageJson, resolveWorkspacePaths } from "./workspace.js";

/**
 * Run a command in a directory
 */
function runCommand(
	command: string,
	args: string[],
	cwd: string,
): Promise<{ success: boolean; output: string }> {
	return new Promise((resolve) => {
		const proc = spawn(command, args, {
			cwd,
			stdio: "pipe",
		});

		let output = "";

		proc.stdout?.on("data", (data) => {
			output += data.toString();
		});

		proc.stderr?.on("data", (data) => {
			output += data.toString();
		});

		proc.on("close", (code) => {
			resolve({ success: code === 0, output });
		});

		proc.on("error", (err) => {
			resolve({ success: false, output: err.message });
		});
	});
}

/**
 * Build a single package
 */
export async function buildPackage(
	packagePath: string,
	packageName: string,
): Promise<boolean> {
	const pkgJson = readPackageJson(packagePath);

	if (!pkgJson?.scripts?.build) {
		console.log(
			chalk.yellow(`  ⚠ ${packageName}: No build script found, skipping`),
		);
		return true;
	}

	console.log(chalk.blue(`  ◐ Building ${packageName}...`));

	const result = await runCommand("pnpm", ["run", "build"], packagePath);

	if (result.success) {
		console.log(chalk.green(`  ✓ ${packageName} built successfully`));
		return true;
	} else {
		console.log(chalk.red(`  ✗ ${packageName} build failed:`));
		console.log(chalk.gray(result.output));
		return false;
	}
}

/**
 * Build all packages in dependency order
 */
export async function buildPackagesInOrder(
	monorepoRoot: string,
	targetPackage: string,
): Promise<boolean> {
	console.log(chalk.cyan("\n📦 Analyzing dependencies...\n"));

	const buildOrder = await getPackagesInBuildOrder(monorepoRoot, targetPackage);
	const workspacePaths = await resolveWorkspacePaths(monorepoRoot);

	console.log(chalk.cyan("Build order:"));
	buildOrder.forEach((pkg, i) => {
		console.log(chalk.gray(`  ${i + 1}. ${pkg}`));
	});
	console.log();

	console.log(chalk.cyan("🔨 Building packages...\n"));

	for (const pkgName of buildOrder) {
		const pkgPath = workspacePaths.get(pkgName);

		if (!pkgPath) {
			console.log(chalk.red(`  ✗ Could not find path for ${pkgName}`));
			return false;
		}

		const success = await buildPackage(pkgPath, pkgName);

		if (!success) {
			return false;
		}
	}

	return true;
}

/**
 * Install dependencies in a directory
 */
export async function installDependencies(cwd: string): Promise<boolean> {
	console.log(chalk.blue("  ◐ Installing dependencies..."));

	const result = await runCommand("pnpm", ["install"], cwd);

	if (result.success) {
		console.log(chalk.green("  ✓ Dependencies installed"));
		return true;
	} else {
		console.log(chalk.red("  ✗ Failed to install dependencies:"));
		console.log(chalk.gray(result.output));
		return false;
	}
}

/**
 * Watch a package directory for changes
 */
type ChokidarWatcher = {
	on(event: string, callback: () => void): ChokidarWatcher;
	close(): Promise<void>;
};

export function createWatcher(
	packagePath: string,
	onChange: () => void,
): { close: () => void } {
	// Dynamic import for chokidar to avoid issues
	let watcher: ChokidarWatcher | null = null;

	import("chokidar").then(({ default: chokidar }) => {
		watcher = chokidar.watch(path.join(packagePath, "src"), {
			ignored: /(^|[/\\])\../,
			persistent: true,
			ignoreInitial: true,
		}) as ChokidarWatcher;

		watcher.on("change", onChange);
		watcher.on("add", onChange);
		watcher.on("unlink", onChange);
	});

	return {
		close: () => {
			if (watcher) {
				watcher.close();
			}
		},
	};
}
