#!/usr/bin/env node
import { ShardingManager } from 'discord.js';
import { getConfig } from './config.js';

const config = await getConfig();
const manager = new ShardingManager('./main.js', {
    token: config.token,
    respawn: true
});

manager.on('shardCreate', (shard) => console.log(`Launched shard ${shard.id}`));

await manager.spawn();
