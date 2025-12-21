import path from 'path';
import fsp from 'fs/promises';
import json5 from 'json5';
import type { Config } from './types.js';

export async function getConfig() {
    const fileConfig = await tryReadConfig();
    const config: Config = {
        token: process.env['TOKEN'] || fileConfig?.token || throwError('token is required'),
        color: fileConfig?.color,
        audioDirectory: process.env['AUDIODIRECTORY'] || fileConfig?.audioDirectory || 'audio',
        statsDirectory: process.env['STATSDIRECTORY'] || fileConfig?.statsDirectory || 'stats',
        activity: fileConfig?.activity,
        guild: process.env['GUILD'] || fileConfig?.guild,
        website: process.env['WEBSITE'] || fileConfig?.website,
        topggtoken: process.env['TOPGGTOKEN'] || fileConfig?.topggtoken,
        webport: parseInt(process.env['WEBPORT']) || fileConfig?.webport,
        metricprefix: process.env['METRICPREFIX'] || fileConfig?.metricprefix || 'tauntbot_'
    }
    return config;
}

async function tryReadConfig(): Promise<Config | null> {
    try {
        return json5.parse<Config>(await fsp.readFile(process.env['CONFIG'] || path.join('config', 'config.jsonc'), { encoding: 'utf-8' }));
    }
    catch {
        return null;
    }
}

function throwError<T>(message: string): T {
    throw new Error(message);
}
