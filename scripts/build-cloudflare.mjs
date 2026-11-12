import { cpSync, mkdirSync } from 'node:fs';

const output = new URL('../dist/cloudflare/', import.meta.url);
mkdirSync(output, { recursive: true });
cpSync(new URL('../apps/web/', import.meta.url), output, { recursive: true });
for (const kind of ['cards', 'icons']) {
  cpSync(new URL(`../assets/prototype/${kind}/`, import.meta.url), new URL(`assets/${kind}/`, output), { recursive: true });
}
