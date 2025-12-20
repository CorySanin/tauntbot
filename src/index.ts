#!/usr/bin/env node
import path from 'path';
import { ShardingManager } from 'discord.js';
import { getConfig } from './config.js';

const dir = import.meta.dirname;
const config = await getConfig();
const manager = new ShardingManager(path.join(dir, 'main.js'), {
    token: config.token,
    respawn: true
});

manager.on('shardCreate', (shard) => console.log(`Launched shard ${shard.id}`));

await manager.spawn();
