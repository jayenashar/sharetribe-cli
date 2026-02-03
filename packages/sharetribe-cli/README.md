# Sharetribe CLI

> **DISCLAIMER**: This is an UNOFFICIAL community-maintained CLI reimplementation.
> For the official Sharetribe CLI, install [flex-cli](https://www.npmjs.com/package/flex-cli).

A command-line interface for [Sharetribe](https://www.sharetribe.com/) that enables you to manage the transaction processes, transactional email templates, assets, and other resources of your marketplaces.

This CLI is a reimplementation built on [`sharetribe-flex-build-sdk`](https://www.npmjs.com/package/sharetribe-flex-build-sdk) and is designed to be 100% compatible with the official `flex-cli`, using the same command structure and configuration files.

To use Sharetribe CLI, you will need a marketplace and an admin user API key. You can create a Sharetribe marketplace from
[www.sharetribe.com/](https://www.sharetribe.com/) and get credentials to Console where you can generate new API keys in [your account's "Manage API keys"](https://console.sharetribe.com/api-keys).

## Installation

Install with npm:

```bash
npm install -g sharetribe-cli
```

or with yarn:

```bash
yarn global add sharetribe-cli
```

To verify the installation and to see available commands, run:

```bash
sharetribe-cli
```

## Usage

First, authenticate with your marketplace:

```bash
sharetribe-cli login
```

The CLI will prompt you for your API key and marketplace ID. These credentials are stored in `~/.config/sharetribe-cli/auth.edn`.

### Available commands

The CLI supports all commands available in the official flex-cli:

- `process` - Manage transaction processes (list, create, push, pull, deploy, aliases)
- `assets` - Manage marketplace assets
- `events` - Query and tail marketplace events
- `notifications` - Manage and preview email notifications
- `listing-approval` - Manage listing approval settings
- `search` - Manage search schemas
- `stripe` - Manage Stripe integration
- `version` - Display version information
- `help` - Display help for any command

Use `--help` to see all available commands and their options:

```bash
sharetribe-cli --help
sharetribe-cli process --help
```

## Compatibility

This CLI is designed to be a drop-in replacement for the official `flex-cli`. It uses the same configuration files (`~/.config/sharetribe-cli/` or `~/.config/flex-cli/`) and command structure.

## SDK

This CLI is built using the [`sharetribe-flex-build-sdk`](https://www.npmjs.com/package/sharetribe-flex-build-sdk), which is also available for programmatic use in your own applications.

## Issues

If you encounter any issues, please report them at [github.com/jayenashar/sharetribe-cli/issues](https://github.com/jayenashar/sharetribe-cli/issues).

## License

Apache-2.0
