import type { ActivityOptions } from 'discord.js';

export interface Config {
    loglevel: string;
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

interface TauntTypeEnum {
    readonly VICTORY: TauntType;
    readonly MVP: TauntType;
    readonly LOSE: TauntType;
    readonly INTRO: TauntType;
}

export const TauntTypes: TauntTypeEnum = {
    VICTORY: 'victory',
    MVP: 'mvp',
    LOSE: 'lose',
    INTRO: 'intro'
};

interface TauntParams {
    /**
     * Length in seconds
     */
    readonly maxDuration: number;
    /**
     * What to show in error messages sent to users
     */
    readonly maxDurationHumanReadable: string;
}

export const TauntParameters: Record<TauntType, TauntParams> = {
    victory: {
        maxDuration: 20.85,
        maxDurationHumanReadable: '20 seconds'
    },
    mvp: {
        maxDuration: 16.85,
        maxDurationHumanReadable: '16 seconds'
    },
    lose: {
        maxDuration: 8.85,
        maxDurationHumanReadable: '8 seconds'
    },
    intro: {
        maxDuration: 2.85,
        maxDurationHumanReadable: '2 seconds'
    }
}

export interface BotEvent {
    type: string;
    value: any;
}

export interface TauntEvent extends BotEvent {
    type: 'taunt';
    value: TauntType;
}

export interface GuildCountEvent extends BotEvent {
    type: 'guildCount';
    value: {
        serverCount: number;
        shardCount: number;
    }
}

export interface ShardMessage extends BotEvent {
    type: 'shardid';
    value: number;
}

export const SupportedMimeTypes = [
    'audio/aac',
    'audio/mp4',
    'audio/mpeg',
    'audio/mpeg3',
    'audio/ogg',
    'audio/opus',
    'audio/vorbis',
    'audio/wav',
    'audio/webm',
    'audio/flac',
];
