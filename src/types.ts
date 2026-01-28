export interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface WorkspacePackage {
  name: string;
  path: string;
  packageJson: PackageJson;
  workspaceDeps: string[];
}

export interface LinkManifest {
  packages: Record<string, RegisteredPackage>;
}

export interface RegisteredPackage {
  name: string;
  monorepoRoot: string;
  packagePath: string;
  workspaceDeps: WorkspaceDepInfo[];
  registeredAt: string;
  builtAt?: string;
}

export interface WorkspaceDepInfo {
  name: string;
  path: string;
}

export interface LinkConfig {
  dependencies: Record<string, string>;
  overrides: Record<string, string>;
}

export interface PnpmWorkspace {
  packages?: string[];
}
