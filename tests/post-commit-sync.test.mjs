import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();

async function run(command, args, cwd) {
  return execFileAsync(command, args, {
    cwd,
    windowsHide: true
  });
}

test('powershell sync in diff mode only copies files changed by the commit', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'post-commit-sync-'));
  const sourceRepo = path.join(tempRoot, 'source');
  const targetRepo = path.join(tempRoot, 'target');
  await fs.mkdir(sourceRepo, { recursive: true });
  await fs.mkdir(targetRepo, { recursive: true });

  await run('git', ['init'], sourceRepo);
  await run('git', ['config', 'user.name', 'Sync Test'], sourceRepo);
  await run('git', ['config', 'user.email', 'sync-test@example.com'], sourceRepo);
  await run('git', ['config', 'commit.gpgsign', 'false'], sourceRepo);

  await fs.writeFile(
    path.join(sourceRepo, '.sync-map.json'),
    JSON.stringify(
      {
        targetRoot: '../target',
        syncMode: 'diff',
        ignore: ['.sync-map.json', '.githooks']
      },
      null,
      2
    ),
    'utf8'
  );

  await fs.writeFile(path.join(sourceRepo, 'same.txt'), 'stable-content\n', 'utf8');
  await fs.writeFile(path.join(sourceRepo, 'changed.txt'), 'v1\n', 'utf8');
  await run('git', ['add', '.'], sourceRepo);
  await run('git', ['commit', '-m', 'initial'], sourceRepo);

  await fs.writeFile(path.join(targetRepo, 'same.txt'), 'stable-content\n', 'utf8');
  const sentinelTime = new Date('2020-01-01T00:00:00.000Z');
  await fs.utimes(path.join(targetRepo, 'same.txt'), sentinelTime, sentinelTime);

  await fs.writeFile(path.join(sourceRepo, 'changed.txt'), 'v2\n', 'utf8');
  await run('git', ['add', 'changed.txt'], sourceRepo);
  await run('git', ['commit', '-m', 'second'], sourceRepo);

  const scriptPath = path.join(repoRoot, 'scripts', 'post-commit-sync.ps1');
  const { stdout } = await run(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-RepoRoot', sourceRepo, '-Commit', 'HEAD'],
    sourceRepo
  );

  const targetStats = await fs.stat(path.join(targetRepo, 'same.txt'));
  const targetContent = await fs.readFile(path.join(targetRepo, 'same.txt'), 'utf8');
  const changedContent = await fs.readFile(path.join(targetRepo, 'changed.txt'), 'utf8');

  assert.equal(targetContent, 'stable-content\n');
  assert.equal(changedContent, 'v2\n');
  assert.equal(targetStats.mtimeMs, sentinelTime.getTime());
  assert.doesNotMatch(stdout, /same\.txt/);
  assert.match(stdout, /\[sync\] copy changed\.txt -> changed\.txt/);
});

test('powershell sync deletes configured target-only files for ignored source paths', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'post-commit-sync-'));
  const sourceRepo = path.join(tempRoot, 'source');
  const targetRepo = path.join(tempRoot, 'target');
  await fs.mkdir(sourceRepo, { recursive: true });
  await fs.mkdir(targetRepo, { recursive: true });

  await run('git', ['init'], sourceRepo);
  await run('git', ['config', 'user.name', 'Sync Test'], sourceRepo);
  await run('git', ['config', 'user.email', 'sync-test@example.com'], sourceRepo);
  await run('git', ['config', 'commit.gpgsign', 'false'], sourceRepo);

  await fs.writeFile(
    path.join(sourceRepo, '.sync-map.json'),
    JSON.stringify(
      {
        targetRoot: '../target',
        syncMode: 'diff',
        ignore: ['.sync-map.json', '.githooks'],
        deleteFromTarget: ['.sync-map.json']
      },
      null,
      2
    ),
    'utf8'
  );

  await fs.writeFile(path.join(sourceRepo, 'keep.txt'), 'source\n', 'utf8');
  await run('git', ['add', '.'], sourceRepo);
  await run('git', ['commit', '-m', 'initial'], sourceRepo);

  await fs.writeFile(path.join(targetRepo, '.sync-map.json'), '{"tracked":true}\n', 'utf8');

  await fs.writeFile(
    path.join(sourceRepo, '.sync-map.json'),
    JSON.stringify(
      {
        targetRoot: '../target',
        syncMode: 'diff',
        ignore: ['.sync-map.json', '.githooks'],
        deleteFromTarget: ['.sync-map.json'],
        note: 'updated'
      },
      null,
      2
    ),
    'utf8'
  );
  await run('git', ['add', '.sync-map.json'], sourceRepo);
  await run('git', ['commit', '-m', 'update sync config'], sourceRepo);

  const scriptPath = path.join(repoRoot, 'scripts', 'post-commit-sync.ps1');
  const { stdout } = await run(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-RepoRoot', sourceRepo, '-Commit', 'HEAD'],
    sourceRepo
  );

  await assert.rejects(fs.stat(path.join(targetRepo, '.sync-map.json')));
  assert.match(stdout, /\[sync\] delete \.sync-map\.json/);
  assert.doesNotMatch(stdout, /\[sync\] copy \.sync-map\.json -> \.sync-map\.json/);
});

test('powershell sync supports Bazhuayu target remaps and bazhuayu replacements', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'post-commit-sync-'));
  const sourceRepo = path.join(tempRoot, 'source');
  const opTargetRepo = path.join(tempRoot, 'bazhuayuMCP');
  const bzyTargetRepo = path.join(tempRoot, 'Bazhuayu-MCP');
  await fs.mkdir(sourceRepo, { recursive: true });
  await fs.mkdir(opTargetRepo, { recursive: true });
  await fs.mkdir(bzyTargetRepo, { recursive: true });

  await run('git', ['init'], sourceRepo);
  await run('git', ['config', 'user.name', 'Sync Test'], sourceRepo);
  await run('git', ['config', 'user.email', 'sync-test@example.com'], sourceRepo);
  await run('git', ['config', 'commit.gpgsign', 'false'], sourceRepo);

  await fs.writeFile(
    path.join(sourceRepo, '.sync-map.json'),
    JSON.stringify(
      {
        syncMode: 'diff',
        manifestDir: '.sync-manifests',
        targets: [
          {
            name: 'bazhuayu',
            targetRoot: '../bazhuayuMCP',
            ignore: ['.sync-map.json', 'README.md', 'src/config/messages.bzy.ts'],
            remap: {
              'README.en.md': 'README.md',
              'src/config/messages.op.ts': 'src/config/messages.ts'
            }
          },
          {
            name: 'bazhuayu',
            targetRoot: '../Bazhuayu-MCP',
            ignore: ['.sync-map.json', 'README.en.md', 'src/config/messages.op.ts'],
            remap: {
              'src/config/messages.bzy.ts': 'src/config/messages.ts'
            },
            replacements: [
              {
                match: 'bazhuayu',
                replace: 'bazhuayu',
                ignoreCase: true
              }
            ]
          }
        ]
      },
      null,
      2
    ),
    'utf8'
  );

  await fs.mkdir(path.join(sourceRepo, 'src', 'config'), { recursive: true });
  await fs.mkdir(path.join(sourceRepo, 'docs'), { recursive: true });
  await fs.writeFile(path.join(sourceRepo, 'README.md'), '# bazhuayu 中文\nbazhuayu Client\n', 'utf8');
  await fs.writeFile(path.join(sourceRepo, 'README.en.md'), '# bazhuayu English\n', 'utf8');
  await fs.writeFile(path.join(sourceRepo, 'src', 'config', 'messages.op.ts'), 'export default "bazhuayu OP";\n', 'utf8');
  await fs.writeFile(path.join(sourceRepo, 'src', 'config', 'messages.bzy.ts'), 'export default "bazhuayu BZY";\n', 'utf8');
  await fs.writeFile(path.join(sourceRepo, 'docs', 'bazhuayuGuide.md'), 'Use bazhuayu here.\n', 'utf8');

  await run('git', ['add', '.'], sourceRepo);
  await run('git', ['commit', '-m', 'initial'], sourceRepo);

  const scriptPath = path.join(repoRoot, 'scripts', 'post-commit-sync.ps1');
  const { stdout } = await run(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-RepoRoot', sourceRepo, '-Commit', 'HEAD'],
    sourceRepo
  );

  assert.equal(
    await fs.readFile(path.join(opTargetRepo, 'src', 'config', 'messages.ts'), 'utf8'),
    'export default "bazhuayu OP";\n'
  );
  assert.equal(await fs.readFile(path.join(opTargetRepo, 'README.md'), 'utf8'), '# bazhuayu English\n');

  assert.equal(
    await fs.readFile(path.join(bzyTargetRepo, 'README.md'), 'utf8'),
    '# bazhuayu 中文\nbazhuayu Client\n'
  );
  assert.equal(
    await fs.readFile(path.join(bzyTargetRepo, 'src', 'config', 'messages.ts'), 'utf8'),
    'export default "bazhuayu BZY";\n'
  );
  assert.equal(
    await fs.readFile(path.join(bzyTargetRepo, 'docs', 'bazhuayuGuide.md'), 'utf8'),
    'Use bazhuayu here.\n'
  );
  await assert.rejects(fs.stat(path.join(bzyTargetRepo, 'README.en.md')));
  assert.match(stdout, /\[sync:bazhuayu\] copy src\/config\/messages\.op\.ts -> src\/config\/messages\.ts/);
  assert.match(stdout, /\[sync:bazhuayu\] copy src\/config\/messages\.bzy\.ts -> src\/config\/messages\.ts/);
});

test('repository sync config ignores .githooks and both sync scripts', async () => {
  const configPath = path.join(repoRoot, '.sync-map.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

  assert.equal(config.syncMode, 'full');

  const targets = Object.fromEntries(config.targets.map((target) => [target.name, target]));

  assert.ok(targets.bazhuayu.ignore.includes('.githooks'));
  assert.ok(targets.bazhuayu.deleteFromTarget.includes('.sync-map.json'));
  assert.ok(targets.bazhuayu.ignore.includes('README.md'));
  assert.ok(!targets.bazhuayu.ignore.includes('README.en.md'));
  assert.equal(targets.bazhuayu.remap['README.en.md'], 'README.md');
  assert.ok(targets.bazhuayu.ignore.includes('scripts/post-commit-sync.ps1'));
  assert.ok(targets.bazhuayu.ignore.includes('scripts/post-commit-sync.sh'));

  assert.ok(targets.bazhuayu.ignore.includes('README.en.md'));
  assert.ok(!targets.bazhuayu.ignore.includes('README.md'));
  assert.equal(targets.bazhuayu.remap['src/config/messages.bzy.ts'], 'src/config/messages.ts');
  assert.equal(
    targets.bazhuayu.remap['src/config/enum-map/enumMap.bzy.config.ts'],
    'src/config/enum-map/enumMap.config.ts'
  );
});
