#!/usr/bin/env node
import path from 'path';
import log4js from 'log4js';
import { Stats } from './stats.js';
import { ShardingManager, type Shard } from 'discord.js';
import { getConfig } from './config.js';
import type { ShardMessage } from './types.js';

const dir = import.meta.dirname;
const config = await getConfig();
const logger = log4js.getLogger(path.basename(import.meta.filename));
logger.level = config.loglevel;
const stats = new Stats(config);
const manager = new ShardingManager(path.join(dir, 'main.js'), {
    token: config.token,
    respawn: true
});

console.log('Taunt Bot by Cory Sanin\n');

function setUpShard(shard: Shard) {
    logger.info('Launched shard %d', shard.id);
    stats.register(shard);
    const message: ShardMessage = {
        type: 'shardid',
        value: shard.id
    };
    shard.once('spawn', () => shard.send(message));
}

manager.on('shardCreate', setUpShard);

const shards = await manager.spawn();

shards.first().send('serverCount');

process.on('SIGTERM', async () => {
    stats.close();
    await manager.broadcast('SIGTERM');
});
