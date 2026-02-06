# Sharetribe CLI & SDK

Monorepo containing the unofficial Sharetribe CLI and Build SDK.

## Packages

This repository contains two npm packages:

### [`sharetribe-community-cli`](./packages/sharetribe-cli)

Command-line interface for Sharetribe Flex - 100% compatible with the official flex-cli.

```bash
npm install -g sharetribe-community-cli
sharetribe-community-cli login
sharetribe-community-cli process list
```

### [`sharetribe-flex-build-sdk`](./packages/sharetribe-flex-build-sdk)

SDK for building and managing Sharetribe Flex transaction processes programmatically.

```bash
npm install sharetribe-flex-build-sdk
```

```typescript
import { apiGet, apiPost, parseProcessFile } from 'sharetribe-flex-build-sdk';

// Parse EDN process files
const process = parseProcessFile('./process.edn');

// Make API calls programmatically
const processes = await apiGet(apiKey, '/processes/query', { marketplace: 'my-marketplace' });
```

## Development

This is a npm workspaces monorepo. To work on both packages:

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Run tests for all packages
npm run test

# Lint all packages
npm run lint
```

### Working on individual packages

```bash
# Build SDK only
npm run build -w packages/sharetribe-flex-build-sdk

# Build CLI only
npm run build -w packages/sharetribe-cli

# Test SDK only
npm run test -w packages/sharetribe-flex-build-sdk
```

## Goals

- **100% Compatibility** with official flex-cli
- **Zero vulnerabilities** (npm audit clean)
- **TypeScript** throughout
- **Node.js standard library** for HTTP (no axios/node-fetch)
- **Comprehensive testing**

See [goals.md](./goals.md) for detailed project goals.

## Publishing

Both packages are published independently to npm:

- `sharetribe-community-cli` - Command-line tool
- `sharetribe-flex-build-sdk` - Programmatic SDK

## License

Apache-2.0
