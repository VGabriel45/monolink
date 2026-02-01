#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { Command } from "commander";
import {
	listCommand,
	registerCommand,
	unuseCommand,
	useCommand,
	watchCommand,
} from "./commands/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(
	readFileSync(join(__dirname, "../package.json"), "utf-8"),
);
const version = packageJson.version || "1.0.0";

const program = new Command();

program
	.name("monolink")
	.description("CLI tool to simplify local pnpm package linking in monorepos")
	.version(version);

// Register command
program
	.command("register [package]")
	.description(
		"Register a package for local linking (interactive if package not provided)",
	)
	.option("--no-build", "Skip building packages")
	.action(async (packageName: string | undefined, options) => {
		try {
			await registerCommand(packageName, options);
		} catch (err) {
			console.error(chalk.red(`\n✗ Error: ${(err as Error).message}`));
			process.exit(1);
		}
	});

// Use command
program
	.command("use [package]")
	.description(
		"Link a registered package to the current project (interactive if package not provided)",
	)
	.option("--no-install", "Skip running pnpm install")
	.action(async (packageName: string | undefined, options) => {
		try {
			await useCommand(packageName, options);
		} catch (err) {
			console.error(chalk.red(`\n✗ Error: ${(err as Error).message}`));
			process.exit(1);
		}
	});

// Unuse command
program
	.command("unuse [package]")
	.description(
		"Remove a linked package from the current project (interactive if package not provided)",
	)
	.option("--no-install", "Skip running pnpm install")
	.action(async (packageName: string | undefined, options) => {
		try {
			await unuseCommand(packageName, options);
		} catch (err) {
			console.error(chalk.red(`\n✗ Error: ${(err as Error).message}`));
			process.exit(1);
		}
	});

// List command
program
	.command("list")
	.alias("ls")
	.description("List registered packages")
	.option("-l, --local", "List packages linked in current project")
	.action(async (options) => {
		try {
			await listCommand(options);
		} catch (err) {
			console.error(chalk.red(`\n✗ Error: ${(err as Error).message}`));
			process.exit(1);
		}
	});

// Watch command
program
	.command("watch [package]")
	.description(
		"Watch and rebuild a registered package on changes (interactive if package not provided)",
	)
	.option("-d, --debounce <ms>", "Debounce delay in milliseconds", "300")
	.action(async (packageName: string | undefined, options) => {
		try {
			await watchCommand(packageName, {
				debounce: parseInt(options.debounce, 10),
			});
		} catch (err) {
			console.error(chalk.red(`\n✗ Error: ${(err as Error).message}`));
			process.exit(1);
		}
	});

// Parse and execute
program.parse();
