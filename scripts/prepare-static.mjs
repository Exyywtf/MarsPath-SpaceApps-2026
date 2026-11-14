// Next's static segment prefetch URLs join segment names with dots. Keep flat
// aliases beside the emitted nested payloads so an ordinary file host can serve
// both, without a runtime rewrite or calculation endpoint.
import { copyFile, readdir } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';

async function flattenSegments(directory, prefix) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await flattenSegments(path, prefix);
    else if (entry.name.endsWith('.txt')) {
      const alias = basename(prefix) + '.' + relative(prefix, path).split(sep).join('.');
      await copyFile(path, join(prefix, '..', alias));
    }
  }
}
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(directory, entry.name);
    if (entry.name.startsWith('__next.')) await flattenSegments(path, path);
    else await visit(path);
  }
}
await visit('out');
