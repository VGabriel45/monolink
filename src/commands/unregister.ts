import chalk from "chalk";
import inquirer from "inquirer";
import {
	listRegisteredPackages,
	unregisterPackage,
} from "../lib/index.js";

async function selectRegisteredPackage(): Promise<string> {
	const packages = listRegisteredPackages();

	if (packages.length === 0) {
		console.log(chalk.red("✗ No packages are registered"));
		process.exit(1);
	}

	const { selectedPackage } = await inquirer.prompt([
		{
			type: "list",
			name: "selectedPackage",
			message: "Select a package to unregister:",
			choices: packages.map((pkg) => ({
				name: `${pkg.name} (${pkg.packagePath})`,
				value: pkg.name,
			})),
		},
	]);

	return selectedPackage;
}

export async function unregisterCommand(
	packageName: string | undefined,
): Promise<void> {
	// If no package name provided, show interactive list
	if (!packageName) {
		packageName = await selectRegisteredPackage();
	}

	console.log(chalk.cyan(`\n🔗 monolink unregister: ${packageName}\n`));

	const success = unregisterPackage(packageName);

	if (success) {
		console.log(chalk.green(`✓ Successfully unregistered ${packageName}`));
	} else {
		console.log(chalk.yellow(`⚠ Package "${packageName}" is not registered`));
		process.exit(1);
	}
}
