// Run from the repository root: node scripts/proxy-download-regression.cjs
// Requires Node 24, OpenSSL, and `npm ci` in front-end (including optional deps).
// Real loopback downloads exercise the exact @electron/get dependency used by
// app-builder-lib. Proxy bootstrap is confined to disposable child processes.
const assert = require('node:assert/strict');
const { execFile, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const { createRequire } = require('node:module');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { pathToFileURL } = require('node:url');

const run = promisify(execFile);
const artifactName = 'proxy-regression.zip';
const payload = Buffer.from('Electron download proxy regression fixture\n');
const checksum = createHash('sha256').update(payload).digest('hex');

function resolveDownloadDependencies() {
  const frontendRequire = createRequire(path.join(__dirname, '../front-end/package.json'));
  const builderRequire = createRequire(frontendRequire.resolve('app-builder-lib/package.json'));
  // v5 is ESM-only and does not export its package.json subpath.
  const electronGetPath = builderRequire.resolve('@electron/get');
  const electronRequire = createRequire(electronGetPath);
  let manifest;
  let packageDirectory = path.dirname(electronGetPath);
  while (packageDirectory !== path.dirname(packageDirectory)) {
    const candidate = path.join(packageDirectory, 'package.json');
    if (fsSync.existsSync(candidate)) {
      const parsed = JSON.parse(fsSync.readFileSync(candidate, 'utf8'));
      if (parsed.name === '@electron/get') {
        manifest = parsed;
        break;
      }
    }
    packageDirectory = path.dirname(packageDirectory);
  }
  assert.ok(manifest, 'resolve @electron/get package manifest from its exports entrypoint');
  assert.equal(manifest.name, '@electron/get');
  assert.equal(manifest.version, '5.1.0', 'electron-builder must use the tested v5 Fetch downloader');
  assert.equal(manifest.type, 'module');
  return { electronRequire, electronGetPath };
}

async function child(config) {
  const { electronRequire, electronGetPath } = resolveDownloadDependencies();
  const undici = electronRequire('undici');
  const originalHttpRequest = http.request;
  const originalDispatcher = undici.getGlobalDispatcher();
  const electronGet = await import(pathToFileURL(electronGetPath).href);
  assert.equal(typeof electronGet.initializeProxy, 'function');
  assert.equal(typeof electronGet.downloadArtifact, 'function');

  // @electron/get 5 must use undici's standard proxy environment rather than
  // global-agent, which silently hooks Node's http.request.
  if (config.explicit) electronGet.initializeProxy();
  const installedDispatcher = undici.getGlobalDispatcher();
  if (config.proxyEnabled) {
    assert.notEqual(installedDispatcher, originalDispatcher,
      'v5 must install an EnvHttpProxyAgent for proxied downloads');
    assert.equal(installedDispatcher.constructor.name, 'EnvHttpProxyAgent');
  } else {
    assert.equal(installedDispatcher, originalDispatcher, 'direct downloads do not install a proxy');
  }
  assert.equal(global.GLOBAL_AGENT, undefined, 'legacy global-agent must not be bootstrapped');
  assert.equal(http.request, originalHttpRequest, 'the downloader does not monkeypatch Node HTTP');

  const options = {
    version: '42.0.0',
    artifactName,
    isGeneric: true,
    cacheRoot: path.join(config.directory, 'cache'),
    tempDirectory: config.directory,
    mirrorOptions: {
      resolveAssetURL: async details => `${config.origin}/${details.artifactName}`,
    },
    downloadOptions: { quiet: true },
  };

  if (config.untrusted || config.wrongHost) {
    await assert.rejects(electronGet.downloadArtifact(options), error => {
      const reason = error.cause?.code || error.code || String(error);
      if (config.wrongHost) assert.match(reason, /CERT.*ALTNAME|ERR_TLS_CERT_ALTNAME_INVALID/);
      else assert.match(reason, /CERT|SELF_SIGNED|UNABLE_TO_VERIFY/);
      return true;
    }, 'TLS must reject untrusted and wrong-host certificates');
    return;
  }

  const first = await electronGet.downloadArtifact(options);
  assert.deepEqual(await fs.readFile(first), payload);
  const cached = await electronGet.downloadArtifact(options);
  assert.equal(cached, first, 'a valid artifact is reused from the cache');
  assert.deepEqual(await fs.readFile(cached), payload);

  await fs.writeFile(cached, 'corrupted cache');
  const repaired = await electronGet.downloadArtifact(options);
  assert.deepEqual(await fs.readFile(repaired), payload,
    'checksum verification repairs a bad cached artifact');

  await assert.rejects(electronGet.downloadArtifact({
    ...options,
    cacheMode: electronGet.ElectronDownloadCacheMode.WriteOnly,
    checksums: { [artifactName]: '0'.repeat(64) },
  }), error => /checksum|hash|mismatch/i.test(String(error)),
  'a newly downloaded artifact with a bad checksum is rejected');
  assert.deepEqual(await fs.readFile(repaired), payload,
    'a rejected download does not poison the cache');
}

function childEnvironment(config, caPath) {
  const env = { ...process.env };
  // Host proxy, npm mirror, preload, and TLS settings must not influence these
  // hermetic local tests or weaken the negative certificate-verification test.
  for (const name of Object.keys(env)) {
    if (/^(GLOBAL_AGENT_|ELECTRON_|npm_config_electron_|npm_package_config_electron_)/i.test(name)
      || /^(https?_proxy|all_proxy|no_proxy|node_options|node_use_env_proxy|node_extra_ca_certs|node_tls_reject_unauthorized)$/i.test(name)) {
      delete env[name];
    }
  }
  env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
  env.ELECTRON_GET_NO_PROGRESS = '1';
  if (!config.untrusted) env.NODE_EXTRA_CA_CERTS = caPath;
  if (config.proxyEnabled) {
    env.HTTP_PROXY = config.proxy;
    env.HTTPS_PROXY = config.proxy;
    if (config.bypass) env.NO_PROXY = new URL(config.origin).hostname;
    if (!config.explicit) env.ELECTRON_GET_USE_PROXY = '1';
  }
  return env;
}

async function makeCertificates(directory) {
  const caKey = path.join(directory, 'ca-key.pem');
  const ca = path.join(directory, 'ca.pem');
  const openssl = args => execFileSync('openssl', args, { stdio: 'pipe', timeout: 15000 });
  openssl(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1',
    '-subj', '/CN=Proxy Regression Ephemeral CA', '-keyout', caKey, '-out', ca,
    '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
  const issue = async (name, subjectAltName, serial) => {
    const key = path.join(directory, `${name}-key.pem`);
    const csr = path.join(directory, `${name}.csr`);
    const cert = path.join(directory, `${name}.pem`);
    const extensions = path.join(directory, `${name}.ext`);
    await fs.writeFile(extensions, [
      'basicConstraints=critical,CA:FALSE',
      'keyUsage=critical,digitalSignature,keyEncipherment',
      'extendedKeyUsage=serverAuth',
      `subjectAltName=${subjectAltName}`,
    ].join('\n'));
    openssl(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-sha256',
      '-subj', '/CN=Proxy Regression Origin', '-keyout', key, '-out', csr]);
    openssl(['x509', '-req', '-in', csr, '-CA', ca, '-CAkey', caKey, '-set_serial', serial,
      '-out', cert, '-days', '1', '-sha256', '-extfile', extensions]);
    return { key: await fs.readFile(key), cert: await fs.readFile(cert) };
  };
  return { ca, dns: await issue('dns', 'DNS:localhost', '1'), ip: await issue('ip', 'IP:127.0.0.1', '2') };
}

async function main() {
  assert.match(process.version, /^v24\./, 'run this packaging regression on the project Node 24 runtime');
  resolveDownloadDependencies();
  const original = { http: http.request, https: https.request, agent: global.GLOBAL_AGENT };
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mathnote-proxy-test-'));
  const servers = [];
  const sockets = new Set();
  const failures = [];
  let counts;
  const trackSocket = socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  };
  const listen = async (server, host = '127.0.0.1') => {
    servers.push(server);
    server.on('connection', trackSocket);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, host, resolve);
    });
    return server.address().port;
  };
  const serveArtifact = (request, response) => {
    if (request.url === `/${artifactName}`) {
      counts.artifact++;
      response.writeHead(200, { 'Content-Length': payload.length });
      response.end(payload);
    } else if (request.url === '/SHASUMS256.txt') {
      counts.checksum++;
      response.end(`${checksum} *${artifactName}\n`);
    } else {
      failures.push(`Unexpected origin request: ${request.url}`);
      response.writeHead(404).end();
    }
  };

  try {
    const certificates = await makeCertificates(directory);
    const httpPort = await listen(http.createServer(serveArtifact));
    const httpsPort = await listen(https.createServer(certificates.dns, serveArtifact), 'localhost');
    const ipPort = await listen(https.createServer(certificates.ip, serveArtifact));
    const wrongHostPort = await listen(https.createServer(certificates.dns, serveArtifact));
    const httpOrigin = `http://127.0.0.1:${httpPort}`;
    const httpsOrigin = `https://localhost:${httpsPort}`;
    const ipOrigin = `https://127.0.0.1:${ipPort}`;
    const wrongHostOrigin = `https://127.0.0.1:${wrongHostPort}`;
    const tunnelTargets = new Map([
      // undici's EnvHttpProxyAgent tunnels HTTP origins using CONNECT too.
      [`127.0.0.1:${httpPort}`, { port: httpPort, host: '127.0.0.1' }],
      [`localhost:${httpsPort}`, { port: httpsPort, host: 'localhost' }],
      [`127.0.0.1:${ipPort}`, { port: ipPort, host: '127.0.0.1' }],
      [`127.0.0.1:${wrongHostPort}`, { port: wrongHostPort, host: '127.0.0.1' }],
    ]);
    const proxy = http.createServer((request, response) => {
      let target;
      try { target = new URL(request.url); } catch {
        failures.push(`Proxy received a non-absolute URL: ${request.url}`);
        response.writeHead(400).end();
        return;
      }
      // Never forward to the Internet, even if dependency behavior regresses.
      if (target.origin !== httpOrigin) {
        failures.push(`Proxy rejected an unexpected target: ${target.origin}`);
        response.writeHead(502).end();
        return;
      }
      counts.forward++;
      const upstream = http.request(target, { method: request.method, headers: request.headers }, incoming => {
        response.writeHead(incoming.statusCode, incoming.headers);
        incoming.pipe(response);
      });
      upstream.on('error', error => {
        failures.push(error.message);
        response.destroy(error);
      });
      request.pipe(upstream);
    });
    proxy.on('connect', (request, client, head) => {
      const target = tunnelTargets.get(request.url);
      if (!target) {
        failures.push(`CONNECT rejected an unexpected target: ${request.url}`);
        client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        return;
      }
      counts.connect++;
      const upstream = net.connect(target.port, target.host, () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      trackSocket(upstream);
      upstream.on('error', () => client.destroy());
      client.on('error', () => upstream.destroy());
      client.on('close', () => upstream.destroy());
      upstream.on('close', () => client.destroy());
    });
    const proxyPort = await listen(proxy);
    const cases = [
      { name: 'direct HTTP', origin: httpOrigin },
      { name: 'HTTP forward proxy / standard environment', origin: httpOrigin, proxyEnabled: true },
      { name: 'HTTPS CONNECT / standard environment', origin: httpsOrigin, proxyEnabled: true },
      { name: 'HTTPS IP-literal CONNECT / IP SAN verification', origin: ipOrigin, proxyEnabled: true },
      { name: 'HTTP NO_PROXY bypass', origin: httpOrigin, proxyEnabled: true, bypass: true },
      { name: 'HTTPS NO_PROXY bypass', origin: httpsOrigin, proxyEnabled: true, bypass: true },
      { name: 'HTTPS IP-literal NO_PROXY bypass', origin: ipOrigin, proxyEnabled: true, bypass: true },
      { name: 'explicit initializeProxy / undici dispatcher API', origin: httpOrigin, proxyEnabled: true, explicit: true },
      { name: 'HTTPS CONNECT rejects untrusted certificates', origin: httpsOrigin, proxyEnabled: true, untrusted: true },
      { name: 'HTTPS IP-literal CONNECT rejects wrong-host certificates', origin: wrongHostOrigin, proxyEnabled: true, wrongHost: true },
      { name: 'direct HTTPS rejects wrong-host certificates', origin: wrongHostOrigin, wrongHost: true },
    ];
    for (const [index, testCase] of cases.entries()) {
      counts = { artifact: 0, checksum: 0, forward: 0, connect: 0 };
      const config = { ...testCase, proxy: `http://127.0.0.1:${proxyPort}`, directory: path.join(directory, String(index)) };
      await fs.mkdir(config.directory);
      try {
        const result = await run(process.execPath, [__filename, '--child', JSON.stringify(config)], {
          env: childEnvironment(config, certificates.ca), timeout: 30000, maxBuffer: 1024 * 1024,
        });
        assert.equal(result.stderr, '', 'child did not write warnings or errors');
      } catch (error) {
        throw new Error(`${config.name} failed\n${error.stdout || ''}${error.stderr || error.message}`, { cause: error });
      }
      if (config.untrusted || config.wrongHost) {
        assert.equal(counts.artifact, 0, 'TLS rejection happens before an artifact is served');
        assert.equal(counts.checksum, 0);
      } else {
        assert.equal(counts.artifact, 3, 'cache hit avoids a download; corruption and force each download once');
        assert.equal(counts.checksum, 4, 'cached artifacts are revalidated with fresh checksums');
      }
      if (!config.proxyEnabled || config.bypass) {
        assert.equal(counts.forward, 0, 'bypassed and direct downloads never reach the proxy');
        assert.equal(counts.connect, 0);
      } else {
        // The Fetch/undici proxy agent uses CONNECT even for plain HTTP targets.
        assert.ok(counts.connect > 0 || counts.forward > 0,
          'the requested proxy must actually forward or tunnel the download');
      }
      assert.deepEqual(failures, []);
      console.log(`PASS ${config.name}`);
    }
    assert.equal(http.request, original.http);
    assert.equal(https.request, original.https);
    assert.equal(global.GLOBAL_AGENT, original.agent, 'parent process proxy behavior is untouched');
    console.log('Proxy regression passed: @electron/get 5.1.0 (undici EnvHttpProxyAgent), downloads, TLS identities, checksums, cache');
  } finally {
    for (const socket of sockets) socket.destroy();
    await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
    await fs.rm(directory, { recursive: true, force: true });
  }
}

(process.argv[2] === '--child' ? child(JSON.parse(process.argv[3])) : main()).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
