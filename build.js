#!/usr/bin/env node

/**
 * Build script for sharetribe-cli using esbuild
 *
 * Supports development and production builds with optional watch mode
 */

import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const isWatch = args.includes('--watch');

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.js',
  sourcemap: isDev ? 'inline' : true,
  minify: !isDev,
  banner: {
    js: '#!/usr/bin/env node\n',
  },
  external: [
    // Mark all dependencies as external to keep bundle smaller
    ...Object.keys(pkg.dependencies || {}),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
  },
  logLevel: 'info',
  packages: 'external', // Don't bundle node_modules
};

async function build() {
  try {
    if (isWatch) {
      const context = await esbuild.context(buildOptions);
      await context.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('Build complete!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
