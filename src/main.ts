import { getConfig } from './config.js';
import { TauntBot } from './tauntbot.js';

console.log('Taunt Bot by Cory Sanin\n');

const bot = new TauntBot(await getConfig());
bot.start();

process.on('SIGTERM', bot.close);
