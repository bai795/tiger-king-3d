import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');
const buildDir = path.join(root, 'build');
const outJs = path.join(buildDir, 'app.bundle.js');
fs.mkdirSync(buildDir, { recursive: true });

const esbuildArgs = [
  'src/main.js',
  '--bundle',
  '--format=iife',
  '--target=es2020',
  `--alias:three=${path.join(root, 'vendor', 'three.module.min.js')}`,
  `--outfile=${outJs}`,
  dev ? '--sourcemap=inline' : '--minify',
  dev ? '--minify=false' : '--log-level=info',
  '--legal-comments=eof',
];

let built = false;

// Preferred path for this repository: install the dev dependency with npm and
// use the local esbuild package programmatically. This is portable across
// Windows, macOS and Linux.
try {
  const esbuild = await import('esbuild');
  await esbuild.build({
    entryPoints: [path.join(root, 'src', 'main.js')],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    alias: { three: path.join(root, 'vendor', 'three.module.min.js') },
    outfile: outJs,
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    legalComments: 'eof',
    logLevel: 'info',
  });
  built = true;
} catch {
  // Local package unavailable: an explicit esbuild executable can still be used.
}

if (!built && process.env.ESBUILD_BIN) {
  const result = spawnSync(process.env.ESBUILD_BIN, esbuildArgs, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
  built = true;
}

if (!built) {
  console.error('esbuild not found. Run "npm install" in the project root, or set ESBUILD_BIN to a local esbuild executable.');
  process.exit(1);
}

const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
let js = fs.readFileSync(outJs, 'utf8');
js = js.replaceAll('</script', '<\\/script');
const template = fs.readFileSync(path.join(root, 'src', 'index.template.html'), 'utf8');
const html = template
  .replace('/*__CSS__*/', () => css)
  .replace('/*__BUNDLE__*/', () => js);
const output = path.join(root, 'index.html');
fs.writeFileSync(output, html, 'utf8');
const kb = (fs.statSync(output).size / 1024).toFixed(0);
console.log(`Built ${output} (${kb} KB)${dev ? ' [dev]' : ''}`);
