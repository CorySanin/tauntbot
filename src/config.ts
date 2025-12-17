import path from 'path';
import fsp from 'fs/promises';
import json5 from 'json5';
import type { Config } from './types.js';

export async function getConfig() {
    return json5.parse<Config>(await fsp.readFile(process.env['CONFIG'] || path.join('config', 'config.jsonc'), { encoding: 'utf-8' }));
}
