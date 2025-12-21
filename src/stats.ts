import path from 'path';
import fsp from 'fs/promises';
import { Api } from '@top-gg/sdk';
import prom from 'prom-client';
import { Web } from './web.js';
import type { Config, TauntType, BotEvent, TauntEvent, GuildCountEvent } from './types.js';
import type { Shard } from 'discord.js';

export type TauntStats = {
    period: number;
} & {
    [T in TauntType]?: number;
};

const SERVERCOUNT = 'serverCount.txt';
const STATSFILE = 'stats.json';
const INITIALSTAT: TauntStats = {
    period: 0
};

function yearFile(year: string | number) {
    return `taunts_${year}.json`;
}

function initializeStat(period: number): TauntStats {
    return {
        period
    };
}

export class Stats {
    private today: TauntStats;
    private year: TauntStats;
    private serverCount: number = 0;
    private statDir: string;
    private ready = false;
    private topgg: Api = null;
    private web: Web = null;

    constructor(conf: Config) {
        this.statDir = conf.statsDirectory;
        if (conf.topggtoken) {
            this.topgg = new Api(conf.topggtoken)
        }
        this.readStats();
        if (!conf.webport) {
            return;
        }
        this.web = new Web(conf, prom.register);
        let that = this;
        new prom.Gauge({
            name: `${conf.metricprefix}yearly_taunts`,
            help: `Number of taunts played this year.`,
            labelNames: ['type'],
            collect() {
                ['victory', 'mvp', 'lose', 'intro'].forEach(t => {
                    this.set({
                        type: t,
                    }, that.year[t] || 0)
                });
            }
        });

        new prom.Gauge({
            name: `${conf.metricprefix}daily_taunts`,
            help: `Number of taunts played today.`,
            labelNames: ['type'],
            collect() {
                ['victory', 'mvp', 'lose', 'intro'].forEach(t => {
                    this.set({
                        type: t,
                    }, that.today[t] || 0)
                });
            }
        });

        new prom.Gauge({
            name: `${conf.metricprefix}connected_guilds`,
            help: `Number of guilds the bot is in.`,
            collect() {
                this.set({}, that.serverCount);
            }
        });
    }

    async readStats() {
        try {
            const s = await fsp.readFile(this.getPath(STATSFILE), { encoding: 'utf-8' });
            const stats = JSON.parse(s);
            this.today = stats.today || INITIALSTAT;
            this.year = stats.year || INITIALSTAT;
        }
        catch (ex) {
            console.error('failed to load stats file');
            console.error(ex);
            this.today = this.year = INITIALSTAT;
        }
        this.ready = true;
    }

    register(shard: Shard) {
        shard.on('message', this.handleMessage);
    }

    handleMessage = (m: BotEvent) => {
        if (!this.ready || !('type' in m)) {
            return;
        }
        switch (m.type) {
            case 'taunt':
                this.incrementTauntCount(m as TauntEvent);
                break;
            case 'guildCount':
                const stats = (m as GuildCountEvent).value;
                if (this.topgg) {
                    this.topgg.postStats({
                        serverCount: stats.serverCount,
                        shardCount: stats.shardCount
                    }).catch(ex => console.error(ex));
                }
                this.writeServers(this.serverCount = stats.serverCount)
                break;
            default:
                break;
        }
    }

    incrementTauntCount(event: TauntEvent) {
        const type = event.value;
        const date = new Date();
        const year = date.getFullYear();
        const day = date.getDate();
        if (this.today.period !== day) {
            this.today = initializeStat(day);
        }
        if (this.year.period !== year) {
            this.year = initializeStat(year);
        }
        this.today[type] = (this.today[type] || 0) + 1;
        this.year[type] = (this.year[type] || 0) + 1;
        this.writeStats();
    }

    async writeStats() {
        await Promise.all([
            fsp.writeFile(this.getPath(STATSFILE), JSON.stringify({
                today: this.today,
                year: this.year
            })),
            fsp.writeFile(this.getPath(yearFile(this.year.period)), JSON.stringify(this.year))
        ]);
    }

    writeServers(count: number) {
        return fsp.writeFile(this.getPath(SERVERCOUNT), `${count}\n`);
    }

    getPath(file: string) {
        return path.join(this.statDir, file);
    }

    close() {
        this.web?.close();
    }
}