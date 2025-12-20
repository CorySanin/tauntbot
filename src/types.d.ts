import type { ActivityOptions } from 'discord.js';

export interface Config {
    token: string;
    color: number;
    guildId: null | string;
    audioDirectory: string;
    statsDirectory: string;
    volume: number;
    activity: ActivityOptions;
    guild: string;
    website: string;
    discordBotsToken: string;
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
    value: number
}
