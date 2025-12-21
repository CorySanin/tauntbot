#!/usr/bin/env node
import { getConfig } from './config.js';
import { TauntBot } from './tauntbot.js';
import type { ShardMessage } from './types.js';

const bot = new TauntBot(await getConfig());
bot.start();

process.on('SIGTERM', bot.close);
process.on('message', m => {
    if (m === 'SIGTERM') {
        bot.close();
        return;
    }
    if (m === 'serverCount') {
        bot.updateServerCount();
    }
    if (typeof m === 'object' && 'type' in m && m.type === 'shardid') {
        bot.setShard((m as ShardMessage).value);
    }
});

