#!/usr/bin/env node
import { getConfig } from './config.js';
import { TauntBot } from './tauntbot.js';
import type { CommandsMessage, ShardMessage } from './types.js';

const bot = new TauntBot(await getConfig());
bot.start();

process.on('SIGTERM', bot.close);
process.on('message', async m => {
    if (m === 'SIGTERM') {
        bot.close();
        return;
    }
    if (m === 'serverCount') {
        bot.updateServerCount();
        return;
    }
    if (m === 'commands') {
        process.send({
            type: 'commands',
            value: await bot.getCommands()
        } satisfies CommandsMessage);
        return;
    }
    if (typeof m === 'object' && 'type' in m && m.type === 'shardid') {
        bot.setShard((m as ShardMessage).value);
        return;
    }
});

