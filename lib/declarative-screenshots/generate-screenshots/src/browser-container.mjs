// runs the playwright browser server in a pinned linux container so text renders the same on every host

import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const IMAGE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'browser');
const READY_TIMEOUT = 120000;

/**
 * Start a browser server container and return its websocket endpoint.
 *
 * @param {true | { image?: string }} options - `true` builds and runs the bundled image
 * @returns {Promise<{ wsEndpoint: string, stop: () => void }>}
 */
export async function startBrowserContainer(options) {
  const version = playwrightVersion();
  const custom = typeof options === 'object' ? options.image : undefined;
  const image = custom ?? ensureBundledImage(version);
  const port = await freePort();
  const name = `astro-better-screenshots-browser-${process.pid}-${port}`;

  // custom images may not have playwright installed globally, so fetch the matching version
  const command = custom
    ? ['/bin/sh', '-c', `npx -y playwright@${version} run-server --port 3000 --host 0.0.0.0`]
    : [];

  console.log(`[browser] starting ${image} (playwright ${version})`);
  docker(['run', '-d', '--rm', '--init', '--ipc=host', '--name', name, '-p', `127.0.0.1:${port}:3000`, image, ...command]);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { docker(['rm', '-f', name]); } catch {}
  };
  // process.exit() elsewhere would otherwise leave the container running
  process.once('exit', stop);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stop(); process.exit(130); });

  try {
    await waitForServer(name);
  } catch (e) {
    stop();
    throw e;
  }
  return { wsEndpoint: `ws://127.0.0.1:${port}/`, stop };
}

function ensureBundledImage(version) {
  // tag changes whenever the playwright version or the bundled image files change
  const hash = createHash('sha256')
    .update(readFileSync(path.join(IMAGE_DIR, 'Dockerfile')))
    .update(readFileSync(path.join(IMAGE_DIR, 'fonts.conf')))
    .digest('hex')
    .slice(0, 12);
  const tag = `astro-better-screenshots-browser:${version}-${hash}`;
  try {
    docker(['image', 'inspect', tag]);
  } catch {
    console.log(`[browser] building ${tag} (first run only)`);
    execFileSync('docker', ['build', '--build-arg', `PLAYWRIGHT_VERSION=${version}`, '-t', tag, IMAGE_DIR], { stdio: 'inherit' });
  }
  return tag;
}

async function waitForServer(name) {
  const deadline = Date.now() + READY_TIMEOUT;
  while (Date.now() < deadline) {
    let logs = '';
    try {
      logs = execFileSync('docker', ['logs', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      throw new Error(`[browser] container exited before it was ready: ${e.stderr || e.message}`);
    }
    if (logs.includes('Listening on')) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`[browser] browser server did not start within ${READY_TIMEOUT / 1000}s`);
}

function playwrightVersion() {
  // client and server must run the exact same playwright version
  const pkg = path.join(path.dirname(require.resolve('playwright')), 'package.json');
  return JSON.parse(readFileSync(pkg, 'utf8')).version;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
