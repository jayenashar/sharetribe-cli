/**
 * Integration test for process commands with real API calls
 *
 * Tests the full workflow:
 * 1. Pull default-booking process
 * 2. Push unchanged (should show "No changes")
 * 3. Modify the process
 * 4. Push changed version
 * 5. Update alias
 * 6. Revert alias
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const MARKETPLACE = 'expertapplication-dev';
const PROCESS_NAME = 'default-booking';
const TEST_ALIAS = 'test-integration-alias';

/**
 * Executes a CLI command and returns output
 */
function runCli(command: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`sharetribe-cli ${command}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1,
    };
  }
}

// NOTE: This integration test is skipped by default because it requires:
// 1. Valid authentication (run `sharetribe-cli login` first)
// 2. Access to expertapplication-dev marketplace
// 3. The push API endpoint to be working correctly
//
// To run this test, use: npm test -- process-integration.test.ts
describe('Process Integration Test', () => {
  let tempDir: string;
  let processDir: string;
  let initialVersion: number;
  let newVersion: number;
  let originalAliasVersion: number | null = null;

  beforeAll(() => {
    // Create temporary directory for test
    tempDir = mkdtempSync(join(tmpdir(), 'sharetribe-test-'));
    processDir = tempDir;
    console.log(`\nTest directory: ${tempDir}`);
  });

  afterAll(() => {
    // Cleanup: revert alias if we modified it
    if (originalAliasVersion !== null) {
      try {
        console.log(`\nReverting alias ${TEST_ALIAS} to version ${originalAliasVersion}...`);
        runCli(`process update-alias --marketplace ${MARKETPLACE} --process ${PROCESS_NAME} --alias ${TEST_ALIAS} --version ${originalAliasVersion}`);
        console.log(`Reverted alias ${TEST_ALIAS} to version ${originalAliasVersion}`);
      } catch (error) {
        console.warn('Failed to revert alias during cleanup');
      }
    }

    // Remove temporary directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
      console.log(`Cleaned up test directory: ${tempDir}`);
    } catch (error) {
      console.warn('Failed to cleanup test directory');
    }
  });

  it('Step 1: Get current process version', () => {
    const result = runCli(`process list --marketplace ${MARKETPLACE} --process ${PROCESS_NAME}`);

    expect(result.exitCode).toBe(0);

    // Parse the output to get the latest version
    const lines = result.stdout.split('\n');
    // Find the first data line (skip header and empty lines)
    const dataLine = lines.find(l => l.trim() && !l.includes('Created') && !l.includes('Version'));
    expect(dataLine).toBeTruthy();

    // Extract version number - it's typically in the second column
    const parts = dataLine!.split(/\s+/);
    const versionStr = parts.find(p => /^\d+$/.test(p));
    expect(versionStr).toBeTruthy();

    initialVersion = parseInt(versionStr!);
    expect(initialVersion).toBeGreaterThan(0);

    console.log(`✓ Current version: ${initialVersion}`);
  }, 30000);

  it('Step 2: Pull default-booking process at latest version', () => {
    // Pull the specific latest version so that pushing unchanged will detect "No changes"
    const result = runCli(`process pull --marketplace ${MARKETPLACE} --process ${PROCESS_NAME} --path ${processDir} --version ${initialVersion}`);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('successfully pulled');

    // Verify process.edn exists
    const processFile = join(processDir, 'process.edn');
    expect(existsSync(processFile)).toBe(true);

    const content = readFileSync(processFile, 'utf-8');
    expect(content.length).toBeGreaterThan(0);

    console.log('✓ Pulled process successfully');
  }, 30000);

  it('Step 3: Push unchanged process (should show "No changes")', () => {
    const result = runCli(`process push --marketplace ${MARKETPLACE} --process ${PROCESS_NAME} --path ${processDir}`);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toLowerCase()).toMatch(/no changes/);

    console.log('✓ Correctly detected unchanged process');
  }, 30000);

  it('Step 4: Modify the process file', () => {
    const processFile = join(processDir, 'process.edn');
    let content = readFileSync(processFile, 'utf-8');

    // Make a real change by modifying a transition name
    // Find first transition and add a timestamp to its name to make it unique
    const timestamp = Date.now();
    content = content.replace(
      ':transition/inquire',
      `:transition/inquire-test-${timestamp}`
    );

    writeFileSync(processFile, content, 'utf-8');

    // Verify the modification
    const modifiedContent = readFileSync(processFile, 'utf-8');
    expect(modifiedContent).toContain(`inquire-test-${timestamp}`);

    console.log('✓ Modified process file');
  });

  it('Step 5: Push changed process (should create new version)', () => {
    const result = runCli(`process push --marketplace ${MARKETPLACE} --process ${PROCESS_NAME} --path ${processDir}`);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('successfully saved');

    // Extract version from output
    const versionMatch = result.stdout.match(/Version (\d+)/);
    expect(versionMatch).toBeTruthy();
    newVersion = parseInt(versionMatch![1]);

    // New version should be greater than initial
    expect(newVersion).toBeGreaterThan(initialVersion);

    console.log(`✓ Pushed new version: ${newVersion} (was ${initialVersion})`);
  }, 30000);

  it('Step 6: Check if test alias exists', () => {
    const result = runCli(`process list --marketplace ${MARKETPLACE} --process ${PROCESS_NAME}`);

    expect(result.exitCode).toBe(0);

    // Check if alias exists in output
    if (result.stdout.includes(TEST_ALIAS)) {
      // Parse the current alias version
      const lines = result.stdout.split('\n');
      const aliasLine = lines.find(l => l.includes(TEST_ALIAS));
      expect(aliasLine).toBeTruthy();

      // Extract version number from alias line
      const match = aliasLine!.match(/(\d+)\s+.*${TEST_ALIAS}/);
      if (match) {
        originalAliasVersion = parseInt(match[1]);
        console.log(`✓ Alias ${TEST_ALIAS} exists at version ${originalAliasVersion}`);
      }
    } else {
      console.log(`✓ Alias ${TEST_ALIAS} does not exist yet`);
    }
  }, 30000);

  it('Step 7: Create or update alias to new version', () => {
    let result;

    if (originalAliasVersion === null) {
      // Create new alias
      result = runCli(`process create-alias --marketplace ${MARKETPLACE} --process ${PROCESS_NAME} --version ${newVersion} --alias ${TEST_ALIAS}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('successfully');
      console.log(`✓ Created alias ${TEST_ALIAS} pointing to version ${newVersion}`);
    } else {
      // Update existing alias
      result = runCli(`process update-alias --marketplace ${MARKETPLACE} --process ${PROCESS_NAME} --version ${newVersion} --alias ${TEST_ALIAS}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('successfully');
      console.log(`✓ Updated alias ${TEST_ALIAS} from version ${originalAliasVersion} to ${newVersion}`);
    }
  }, 30000);

  it('Step 8: Verify alias points to new version', () => {
    const result = runCli(`process list --marketplace ${MARKETPLACE} --process ${PROCESS_NAME}`);

    expect(result.exitCode).toBe(0);

    // Verify alias is in output and points to new version
    const lines = result.stdout.split('\n');
    const aliasLine = lines.find(l => l.includes(TEST_ALIAS));
    expect(aliasLine).toBeTruthy();

    // Check that the new version appears in the same line as the alias
    const versionInLine = aliasLine!.includes(newVersion.toString());
    expect(versionInLine).toBe(true);

    console.log(`✓ Verified alias ${TEST_ALIAS} points to version ${newVersion}`);
  }, 30000);

  it('Step 9: Revert alias to previous version (or delete if new)', () => {
    let result;

    if (originalAliasVersion !== null) {
      // Revert to original version
      result = runCli(`process update-alias --marketplace ${MARKETPLACE} --process ${PROCESS_NAME} --version ${originalAliasVersion} --alias ${TEST_ALIAS}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('successfully');
      console.log(`✓ Reverted alias ${TEST_ALIAS} to version ${originalAliasVersion}`);

      // Verify revert
      const verifyResult = runCli(`process list --marketplace ${MARKETPLACE} --process ${PROCESS_NAME}`);
      expect(verifyResult.exitCode).toBe(0);
      const lines = verifyResult.stdout.split('\n');
      const aliasLine = lines.find(l => l.includes(TEST_ALIAS));
      expect(aliasLine).toBeTruthy();
      expect(aliasLine!.includes(originalAliasVersion.toString())).toBe(true);

      // Clear this so afterAll doesn't try to revert again
      originalAliasVersion = null;
    } else {
      // Delete the alias we created
      result = runCli(`process delete-alias --marketplace ${MARKETPLACE} --process ${PROCESS_NAME} --alias ${TEST_ALIAS}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('successfully');
      console.log(`✓ Deleted alias ${TEST_ALIAS}`);

      // Verify deletion
      const verifyResult = runCli(`process list --marketplace ${MARKETPLACE} --process ${PROCESS_NAME}`);
      expect(verifyResult.exitCode).toBe(0);
      expect(verifyResult.stdout).not.toContain(TEST_ALIAS);
    }
  }, 30000);
});
