import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { LinkManifest, RegisteredPackage } from "../types.js";
import { isValidPackageName, logError } from "./security.js";

const MANIFEST_DIR = path.join(os.homedir(), ".monolink");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "manifest.json");

export function ensureManifestDir(): void {
	if (!fs.existsSync(MANIFEST_DIR)) {
		fs.mkdirSync(MANIFEST_DIR, { recursive: true });
	}
}

export function readManifest(): LinkManifest {
	ensureManifestDir();

	if (!fs.existsSync(MANIFEST_PATH)) {
		return { packages: {} };
	}

	try {
		const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
		return JSON.parse(content) as LinkManifest;
	} catch (err) {
		logError("manifest-parse", err);
		return { packages: {} };
	}
}

export function writeManifest(manifest: LinkManifest): void {
	ensureManifestDir();
	fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export function registerPackage(pkg: RegisteredPackage): void {
	// Validate package name
	if (!isValidPackageName(pkg.name)) {
		throw new Error(`Invalid package name: ${pkg.name}`);
	}

	const manifest = readManifest();
	manifest.packages[pkg.name] = pkg;
	writeManifest(manifest);
}

export function unregisterPackage(name: string): boolean {
	const manifest = readManifest();
	if (manifest.packages[name]) {
		delete manifest.packages[name];
		writeManifest(manifest);
		return true;
	}
	return false;
}

export function getRegisteredPackage(
	name: string,
): RegisteredPackage | undefined {
	// Validate package name
	if (!isValidPackageName(name)) {
		return undefined;
	}

	const manifest = readManifest();
	return manifest.packages[name];
}

export function listRegisteredPackages(): RegisteredPackage[] {
	const manifest = readManifest();
	return Object.values(manifest.packages);
}

export function getManifestPath(): string {
	return MANIFEST_PATH;
}
