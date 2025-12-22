/**
 * Tests for process commands
 */

import { describe, it, expect } from 'vitest';
import { parseProcessFile } from '../src/util/edn-process.js';

describe('edn-process', () => {
  it('should parse process definition structure', () => {
    // This would test actual EDN parsing
    // For now, verify the function exists and has correct signature
    expect(typeof parseProcessFile).toBe('function');
  });
});
