import chalk from "chalk";
import inquirer from "inquirer";
import {
	applyLinkConfig,
	generateLinkConfig,
	getRegisteredPackage,
	installDependencies,
	isPackageLinked,
	listRegisteredPackages,
} from "../lib/index.js";

interface UseOptions {
	noInstall?: boolean;
}

async function selectRegisteredPackage(): Promise<string> {
	const packages = listRegisteredPackages();

	if (packages.length === 0) {
		console.log(chalk.red("✗ No packages are registered"));
		console.log(
			chalk.gray("\nTo register a package, run in the source monorepo:"),
		);
		console.log(chalk.cyan("  npx monolink register <package-name>"));
		process.exit(1);
	}

	const { selectedPackage } = await inquirer.prompt([
		{
			type: "list",
			name: "selectedPackage",
			message: "Select a package to link:",
			choices: packages.map((pkg) => ({
				name: `${pkg.name} (${pkg.packagePath})`,
				value: pkg.name,
			})),
		},
	]);

	return selectedPackage;
}

export async function useCommand(
	packageName: string | undefined,
	options: UseOptions,
): Promise<void> {
	const cwd = process.cwd();

	// If no package name provided, show interactive list
	if (!packageName) {
		packageName = await selectRegisteredPackage();
	}

	console.log(chalk.cyan(`\n🔗 monolink use: ${packageName}\n`));

	// Get registered package
	const pkg = getRegisteredPackage(packageName);

	if (!pkg) {
		console.log(chalk.red(`✗ Package "${packageName}" is not registered`));
		console.log(
			chalk.gray("\nTo register a package, run in the source monorepo:"),
		);
		console.log(chalk.cyan(`  npx monolink register ${packageName}`));
		process.exit(1);
	}

	// Check if already linked
	if (isPackageLinked(cwd, packageName)) {
		console.log(chalk.yellow(`⚠ Package "${packageName}" is already linked`));
		console.log(
			chalk.gray(`  To update, unlink first: monolink unuse ${packageName}`),
		);
		return;
	}

	console.log(chalk.gray(`Source: ${pkg.packagePath}`));

	// Generate link config
	const config = generateLinkConfig(pkg);

	console.log(chalk.cyan("\nApplying overrides:"));
	Object.entries(config.overrides).forEach(([name, path]) => {
		console.log(chalk.gray(`  ${name} → ${path}`));
	});

	// Apply config to project
	try {
		applyLinkConfig(cwd, packageName, config);
		console.log(chalk.green("\n✓ Updated package.json"));
	} catch (err) {
		console.log(
			chalk.red(`\n✗ Failed to update package.json: ${(err as Error).message}`),
		);
		process.exit(1);
	}

	// Install dependencies
	if (!options.noInstall) {
		console.log(chalk.cyan("\n📦 Installing dependencies...\n"));
		const installSuccess = await installDependencies(cwd);

		if (!installSuccess) {
			console.log(chalk.red("\n✗ Installation failed"));
			process.exit(1);
		}
	} else {
		console.log(chalk.yellow("\n⚠ Skipping install (--no-install flag)"));
		console.log(chalk.gray('  Run "pnpm install" to apply changes'));
	}

	console.log(chalk.green(`\n✓ Successfully linked ${packageName}`));
	console.log(chalk.gray("\nTo unlink, run:"));
	console.log(chalk.cyan(`  npx monolink unuse ${packageName}`));
}
