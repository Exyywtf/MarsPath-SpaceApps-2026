import { copyFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const input = process.argv[2];
if (!input) throw new Error('Pass the directory containing the normal and quiet demo MP4s.');

const output = resolve('out', 'media');
await mkdir(output, { recursive: true });
for (const name of ['marspath-demo-f95bb412.mp4', 'marspath-demo-f95bb412-quiet.mp4']) {
  await copyFile(resolve(input, name), join(output, name));
}
