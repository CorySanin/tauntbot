import type { ActivityOptions } from 'discord.js';

export interface Config {
    token: string;
    guildId: null | string;
    audioDirectory: string;
    volume: number;
    activity: ActivityOptions;
    guild: string;
    website: string;
    discordBotsToken: string;
}

export type TauntType = 'victory' | 'mvp' | 'lose' | 'intro';
