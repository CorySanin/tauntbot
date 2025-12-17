
export interface Config {
    clientId: string;
    token: string;
    guildId: null | string;
    audioDirectory: string;
    volume: number;
    activity: null; //TODO: define in terms of discord.js
    guild: string;
    website: string;
    discordBotsToken: string;
}
