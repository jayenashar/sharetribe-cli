/**
 * Custom command router to handle Commander.js limitations
 *
 * Commander.js cannot handle parent and child commands with the same option names.
 * This router intercepts argv and routes to the correct command handler.
 */

/**
 * Routes process subcommands to avoid Commander parent/child option conflicts
 *
 * This is necessary because Commander validates parent command options before
 * subcommand actions run, causing conflicts when both use --path.
 */
export function routeProcessCommand(argv: string[]): string[] {
  // Check if this is a process subcommand
  const processIndex = argv.findIndex(arg => arg === 'process');
  if (processIndex === -1) {
    return argv;
  }

  // Check for subcommands
  const nextArg = argv[processIndex + 1];
  const subcommands = ['list', 'create', 'push', 'pull', 'create-alias', 'update-alias', 'delete-alias', 'deploy'];

  if (nextArg && subcommands.includes(nextArg)) {
    // This is a subcommand - remove 'process' from argv and make the subcommand top-level
    // e.g. ['node', 'cli', 'process', 'pull', ...] => ['node', 'cli', 'process-pull', ...]
    const newArgv = [
      ...argv.slice(0, processIndex),
      `process-${nextArg}`,
      ...argv.slice(processIndex + 2)
    ];

    // Special handling: If this is an alias command with --version option,
    // we need to filter out the global --version flag from program
    // by ensuring the routed command is properly isolated
    return newArgv;
  }

  return argv;
}
