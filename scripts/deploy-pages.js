import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const remote = git(['remote', 'get-url', 'origin']);
const tempRoot = realpathSync(tmpdir());
const staging = mkdtempSync(join(tempRoot, 'slimey-web-pages-'));

try {
  cpSync(join(root, 'dist'), staging, { recursive: true });
  writeFileSync(join(staging, '.nojekyll'), '');
  git(['init', '--quiet', '-b', 'gh-pages'], staging);
  git(['remote', 'add', 'origin', remote], staging);
  for (const key of ['user.name', 'user.email'])
    git(['config', key, git(['config', '--get', key])], staging);

  const existing = spawnSync('git', ['ls-remote', '--exit-code', '--heads', remote, 'gh-pages'], {
    cwd: root,
  });
  if (existing.status === 0) {
    git(['fetch', '--quiet', 'origin', 'gh-pages'], staging);
    git(['reset', '--mixed', '--quiet', 'FETCH_HEAD'], staging);
  } else if (existing.status !== 2) {
    throw new Error('Could not check the remote gh-pages branch. Verify your Git authentication.');
  }

  git(['add', '--all'], staging);
  const changes = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: staging });
  if (changes.status === 1)
    git(['commit', '--quiet', '-m', 'Deploy Slimey Web Component demo'], staging);
  else if (changes.status !== 0) throw new Error('Could not inspect the staged site.');
  execFileSync('git', ['push', 'origin', 'HEAD:gh-pages'], { cwd: staging, stdio: 'inherit' });
} finally {
  // Remove only the temporary directory created by this invocation.
  const target = realpathSync(staging);
  if (dirname(target) === tempRoot && basename(target).startsWith('slimey-web-pages-')) {
    rmSync(target, { recursive: true, force: true });
  }
}
