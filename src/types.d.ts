import type { ActivityOptions } from 'discord.js';

export interface Config {
    token: string;
    color?: number;
    audioDirectory: string;
    statsDirectory: string;
    activity?: ActivityOptions;
    guild?: string;
    website?: string;
    topggtoken?: string;
    webport?: number
    metricprefix: string
}

export type TauntType = 'victory' | 'mvp' | 'lose' | 'intro';

export interface BotEvent {
    type: string;
    value: any;
}

export interface TauntEvent extends BotEvent {
    type: 'taunt',
    value: TauntType
}

export interface GuildCountEvent extends BotEvent {
    type: 'guildCount',
    value: {
        serverCount: number;
        shardCount: number;
    }
}
