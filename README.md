# monolink

A CLI tool to simplify local pnpm package linking in monorepos.

## The Problem

When linking a monorepo package locally:
- Need to build the package first
- Need to resolve `workspace:*` dependencies
- Need to link all transitive workspace deps
- Error-prone manual process

## The Solution

**monolink** automates the entire process with simple commands.

## Installation

```bash
# Install globally
npm install -g monolink

# Or use with npx
npx monolink <command>
```

## Quick Start

### 1. Register a Package (in your monorepo)

```bash
cd ~/projects/my-monorepo
npx monolink register my-package
```

This will:
- ✅ Find all workspace dependencies
- ✅ Build packages in dependency order
- ✅ Register the package globally

### 2. Link the Package (in your target project)

```bash
cd ~/projects/my-app
npx monolink use my-package
```

This will:
- ✅ Add `pnpm.overrides` for all workspace deps
- ✅ Run `pnpm install`

### 3. Unlink When Done

```bash
npx monolink unuse my-package
```

## Commands

### `monolink register <package>`

Register a package from a pnpm monorepo for local linking.

```bash
monolink register 0xtrails

# Skip building
monolink register 0xtrails --no-build
```

**What it does:**
1. Finds the monorepo root (via `pnpm-workspace.yaml`)
2. Scans for all `workspace:*` dependencies (recursively)
3. Builds all packages in topological order
4. Saves package info to `~/.monolink/manifest.json`

### `monolink use <package>`

Link a registered package to your current project.

```bash
monolink use 0xtrails

# Skip pnpm install
monolink use 0xtrails --no-install
```

**What it does:**
1. Reads the package manifest
2. Adds `pnpm.overrides` to your `package.json`
3. Runs `pnpm install`

### `monolink unuse <package>`

Remove a linked package from your project.

```bash
monolink unuse 0xtrails

# Skip pnpm install
monolink unuse 0xtrails --no-install
```

**What it does:**
1. Removes `pnpm.overrides` for the package
2. Cleans up `.monolink-local.json`
3. Runs `pnpm install`

### `monolink list`

List all registered packages.

```bash
# List all registered packages
monolink list

# List packages linked in current project
monolink list --local
```

### `monolink watch <package>`

Watch and rebuild a registered package on source changes.

```bash
monolink watch 0xtrails

# Custom debounce delay
monolink watch 0xtrails --debounce 500
```

**What it does:**
1. Watches `src/` directories of the package and all its workspace deps
2. Rebuilds on file changes (debounced)
3. Gracefully stops with Ctrl+C

## How It Works

### Registration Flow

```
┌─────────────────────────────────────────────────────────────┐
│ npx monolink register my-package                            │
├─────────────────────────────────────────────────────────────┤
│ 1. Find pnpm-workspace.yaml                                 │
│ 2. Parse workspace patterns                                 │
│ 3. Scan package.json for workspace:* deps                   │
│ 4. Recursively collect all transitive deps                  │
│ 5. Topological sort for build order                         │
│ 6. Build each package in order                              │
│ 7. Save to ~/.monolink/manifest.json                        │
└─────────────────────────────────────────────────────────────┘
```

### Linking Flow

```
┌─────────────────────────────────────────────────────────────┐
│ npx monolink use my-package                                 │
├─────────────────────────────────────────────────────────────┤
│ 1. Read ~/.monolink/manifest.json                           │
│ 2. Generate pnpm.overrides config                           │
│ 3. Update target package.json                               │
│ 4. Create .monolink-local.json (tracks linked packages)     │
│ 5. Run pnpm install                                         │
└─────────────────────────────────────────────────────────────┘
```

## Example

### Monorepo Structure

```
my-monorepo/
├── pnpm-workspace.yaml
├── packages/
│   ├── core/
│   │   └── package.json  (name: "@myorg/core")
│   ├── utils/
│   │   └── package.json  (name: "@myorg/utils", deps: @myorg/core)
│   └── sdk/
│       └── package.json  (name: "@myorg/sdk", deps: @myorg/utils)
```

### Commands

```bash
# In the monorepo
cd my-monorepo
monolink register @myorg/sdk

# Output:
# 🔗 monolink register: @myorg/sdk
# 
# Workspace dependencies:
#   • @myorg/utils
#   • @myorg/core
# 
# Build order:
#   1. @myorg/core
#   2. @myorg/utils
#   3. @myorg/sdk
# 
# 🔨 Building packages...
#   ✓ @myorg/core built successfully
#   ✓ @myorg/utils built successfully
#   ✓ @myorg/sdk built successfully
# 
# ✓ Successfully registered @myorg/sdk

# In your app
cd ~/my-app
monolink use @myorg/sdk

# Your package.json now has:
# {
#   "pnpm": {
#     "overrides": {
#       "@myorg/sdk": "file:/path/to/monorepo/packages/sdk",
#       "@myorg/utils": "file:/path/to/monorepo/packages/utils",
#       "@myorg/core": "file:/path/to/monorepo/packages/core"
#     }
#   }
# }
```

## Files

- `~/.monolink/manifest.json` - Global registry of packages
- `.monolink-local.json` - Per-project tracking (add to `.gitignore`)

## Tips

1. **Add `.monolink-local.json` to your `.gitignore`** - It's project-specific state
2. **Re-register after major changes** - Run `monolink register` again to rebuild
3. **Use watch mode during development** - `monolink watch` rebuilds automatically
4. **Multiple packages** - You can link multiple packages in the same project

## Requirements

- Node.js >= 18
- pnpm

## License

MIT
