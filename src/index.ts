#!/usr/bin/env node
import path from 'path';
import { Stats } from './stats.js';
import { ShardingManager, type Shard } from 'discord.js';
import { getConfig } from './config.js';

const dir = import.meta.dirname;
const config = await getConfig();
const stats = new Stats(config);
const manager = new ShardingManager(path.join(dir, 'main.js'), {
    token: config.token,
    respawn: true
});

function setUpShard(shard: Shard) {
    console.log(`Launched shard ${shard.id}`);
    stats.register(shard);
}

manager.on('shardCreate', setUpShard);

const shards = await manager.spawn();

shards.first().send('serverCount');

process.on('SIGTERM', async () => {
    stats.close();
    await manager.broadcast('SIGTERM');
});
