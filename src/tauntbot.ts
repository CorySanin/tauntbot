/*
  _____                 _     ____        _   
 |_   _|_ _ _   _ _ __ | |_  | __ )  ___ | |_ 
   | |/ _` | | | | '_ \| __| |  _ \ / _ \| __|
   | | (_| | |_| | | | | |_ _| |_) | (_) | |_ 
   |_|\__,_|\__,_|_| |_|\__(_)____/ \___/ \__|

*/
import { REST, Client, GatewayIntentBits, Events, Routes, GuildMember, userMention, hyperlink, PermissionFlagsBits, type ActivityOptions, type VoiceBasedChannel, type ChatInputCommandInteraction, type APIEmbedField, MessageFlags } from 'discord.js';
import * as Voice from '@discordjs/voice';
import path from 'path';
import fsp from 'fs/promises';
import fs from 'fs';
import { SlashCommands, Commands } from './commands.js';
import type { Config, TauntType, TauntEvent, GuildCountEvent } from './types.js';

interface QueueItem {
    file: string;
    invoker: string;
    target: string;
    type: TauntType;
    channel: VoiceBasedChannel;
    interaction?: ChatInputCommandInteraction;
    playing: boolean;
    queued: boolean;
}

interface QueueManager {
    [guildId: string]: QueueItem[];
}

interface PlayerDetails {
    playerobj: Voice.AudioPlayer;
    connection: Voice.VoiceConnection;
    callback: FinishCallback;
}

interface PlayerManager {
    [guildId: string]: PlayerDetails;
}

type FinishCallback = (oldState?: Voice.AudioPlayerState | Voice.AudioPlayerError, newState?: Voice.AudioPlayerIdleState) => void;

const ZWSPACE = String.fromCharCode(parseInt('200B', 16));

export class TauntBot {
    public start: () => Promise<void>;
    private client: Client;
    private activity: ActivityOptions;
    private queues: QueueManager = {};
    private players: PlayerManager = {};
    private audioDir: string;

    constructor(conf: Config) {
        const client = this.client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
            allowedMentions: { parse: [] },
        });

        client.on(Events.Error, err => {
            console.error(`discord.js client error: ${err.name} - ${err.message}`);
        });

        client.on(Events.GuildCreate, guild => {
            console.info(`Joined ${guild.name}`);
            this.updateServerCount();
        });

        client.on(Events.GuildDelete, guild => {
            console.info(`Left ${guild.name}`);
            this.updateServerCount();
        });

        client.on('voiceStateUpdate', async (oldMember, newMember) => {
            if (oldMember.channel === null
                && newMember.channel) {
                const type = 'intro';
                const options: QueueItem = {
                    channel: newMember.channel,
                    invoker: newMember.id,
                    target: newMember.id,
                    type,
                    file: `${newMember.id}_${type}.ogg`,
                    playing: false,
                    interaction: null,
                    queued: false
                };
                if (await this.tauntExists(options)) {
                    this.queueAudio(options);
                }
            }
        });

        client.on(Events.ShardReady, this.setGame);

        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand() ||
                !interaction.inGuild() ||
                !(interaction.member instanceof GuildMember)
            ) {
                return;
            }

            console.info(`got ${interaction.commandName} command`);

            switch (interaction.commandName) {
                case Commands.MVP:
                case Commands.WIN:
                case Commands.LOSE:
                    const target = getTarget(interaction);
                    const type = resolveTauntType(interaction.commandName);
                    const item = {
                        channel: interaction.member.voice?.channel,
                        invoker: interaction.member.id,
                        target: target.id,
                        type,
                        file: `${target.id}_${type}.ogg`,
                        playing: false,
                        interaction,
                        queued: false
                    };
                    const result = await this.queueAudio(item);
                    if (typeof result === 'number') {
                        console.info(`replying in channel ${interaction.channel.name}`);
                        try {
                            await interaction.reply({
                                content: generateReply(result > 1, item)
                            });
                        }
                        catch (ex) {
                            console.error('failed to reply to command:');
                            console.error(ex);
                        }
                    }
                    else {
                        await interaction.reply({
                            content: result,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    break;
                case Commands.STOP:
                    await interaction.reply({
                        content: this.stop(interaction)
                    });
                    break;
                case Commands.INVITE:
                    const fields: APIEmbedField[] = [
                        {
                            name: 'Invite',
                            value: `${hyperlink(`Invite ${client.user.username}`, `https://discordapp.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=3165184`)} to your server`
                        }
                    ];
                    if (conf.website) {
                        fields.push({
                            name: 'Website',
                            value: `Visit ${conf.website} to upload taunts`
                        });
                    }
                    if (conf.guild) {
                        fields.push({
                            name: 'Discord',
                            value: `Discuss ${hyperlink(`${client.user.username} on Discord`, conf.guild)}`
                        });
                    }
                    await interaction.reply(
                        {
                            flags: MessageFlags.Ephemeral,
                            embeds: [
                                {
                                    author: {
                                        name: client.user.username,
                                        url: conf.website
                                    },
                                    thumbnail: {
                                        url: client.user.avatarURL()
                                    },
                                    color: conf.color,
                                    fields
                                }
                            ]
                        }
                    );
                    break;
                case Commands.HELP:
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [
                            {
                                author: {
                                    name: client.user.username,
                                    url: conf.website,
                                    icon_url: client.user.avatarURL()
                                },
                                description: (`Every time you win, listen to your anthem by joining a voice channel and entering \`/win\`` +
                                    ` in the chat. For smaller achievements, use \`/mvp\` to hear a shorter audio track of your choosing. ` +
                                    `To get started, log in with your Discord account at ${conf.website}${ZWSPACE}. ` +
                                    "Upload your taunts and you'll be ready to go! " +
                                    "\n*You must be connected to a voice channel for it to work.* " +
                                    "\nCreated by Cory Sanin (AKA WORM)"),
                                color: conf.color,
                                fields: [
                                    {
                                        name: `/win`,
                                        value: `Plays your victory track. Optionally, you can pass a Discord user to play their win track.`
                                    },
                                    {
                                        name: `/mvp`,
                                        value: `Plays your mvp track. Optionally, you can pass a Discord user to play their win track.`
                                    },
                                    {
                                        name: `/lose`,
                                        value: `Plays your lose track. Optionally, you can pass a Discord user to play their win track.`
                                    },
                                    {
                                        name: `/stop`,
                                        value: 'Cancels the current track if you started it (or if you\'re an admin)'
                                    },
                                    {
                                        name: `/invite`,
                                        value: `Generates a link to invite ${client.user.username} to a server near you!`
                                    },
                                    {
                                        name: `/help`,
                                        value: 'Displays this help message'
                                    }
                                ]
                            }
                        ]
                    });
                    break;
                default:
                    console.error(`command not recognized: ${interaction.commandName}`);
                    break;
            }
        });

        this.activity = conf.activity;
        this.audioDir = conf.audioDirectory;

        this.start = () => {
            return new Promise(async (resolve, reject) => {
                const timeout = setTimeout(reject, 8000, "failed to log in.");
                await client.login(conf.token);
                clearTimeout(timeout);
                console.log(`Logged in as "${client.user.username}"`);
                await this.registerCommands(conf.token);
                resolve();
            });
        }
    }

    stop(interaction: ChatInputCommandInteraction): string {
        const key = getQueueKey(interaction);
        if (!key) {
            return 'You need to be in a voice channel to stop a taunt.';
        }
        const item = this.queues[key]?.[0];
        const player = this.players[key];
        if (!item || !item.playing) {
            return 'Nothing to stop.';
        }
        const invoker = interaction.member as GuildMember;
        if (invoker?.id !== item.invoker && !invoker.permissions.any([
            PermissionFlagsBits.Administrator,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.KickMembers,
            PermissionFlagsBits.MoveMembers]
        )) {
            return `You can't stop a taunt started by ${userMention(item.invoker)}.`
        }
        player.playerobj.pause();
        return `Stopping ${userMention(item.invoker)}'s ${item.type} taunt...`;
    }

    isQueueable(item: QueueItem): boolean {
        const key = getQueueKey(item);
        const inQueue: boolean | null = key && this.queues?.[key]?.some(q => compareQueueItems(item, q));
        return typeof inQueue === 'boolean' ? !inQueue : true;
    }

    resolveTaunt(item: string | QueueItem) {
        const filename = typeof item === 'string' ? item : item.file;
        return path.resolve(path.join(this.audioDir, filename));
    }

    async tauntExists(item: QueueItem): Promise<boolean> {
        try {
            await fsp.access(this.resolveTaunt(item), fs.constants.R_OK);
        }
        catch {
            return false;
        }
        return true;
    }

    async queueAudio(item: QueueItem): Promise<number | string> {
        if (getQueueKey(item) === null) {
            return aOrAn`You need to be in a voice channel to play ${item.type} taunt.`;
        }
        if (!this.isQueueable(item)) {
            return aOrAn`You've already queued up ${item.type} taunt.`;
        }
        if (! await this.tauntExists(item)) {
            if (item.target === item.invoker) {
                return aOrAn`You don't have ${item.type} taunt. Upload one at https://taunt.bot/`;
            }
            else {
                return aOrAn`That user doesn't have ${item.type} taunt.`;
            }
        }
        const queues = this.queues;
        const key = getQueueKey(item);
        if (item.queued = !!queues[key]) {
            queues[key].push(item);
        }
        else {
            queues[key] = [item];
        }
        this.handleQueue(key);
        return queues[key].length;
    }

    async handleQueue(key: string, cont: boolean = false) {
        const queues = this.queues;
        const queue = queues?.[key];
        if (!queue || queue.length <= 0) {
            return;
        }
        if (!cont && this.players[key]) {
            return;
        }
        const item = queue[0];
        if (item.playing) {
            return;
        }
        item.playing = true;

        if (item.queued && item.interaction) {
            item.interaction.editReply({
                content: generateReply(false, item)
            });
        }

        const details: PlayerDetails = this.players[key] || this.createPlayerDetails(key);
        details.connection = Voice.joinVoiceChannel({
            channelId: item.channel.id,
            guildId: item.channel.guild.id,
            adapterCreator: item.channel.guild.voiceAdapterCreator
        });
        this.players[key] = details;

        details.connection.on('error', (err) => {
            console.error('VoiceConnection Error:');
            console.error(err);
            details.callback();
        });
        details.connection.subscribe(details.playerobj);
        if (details.connection.state.status === Voice.VoiceConnectionStatus.Ready) {
            this.playAudio(key);
        }
        else {
            details.connection.once(Voice.VoiceConnectionStatus.Ready, () => this.playAudio(key));
        }
    }

    createPlayerDetails(key: string): PlayerDetails {
        const finish = this.createFinishCallback(key);
        return {
            playerobj: createAudioPlayer(finish),
            callback: finish,
            connection: null
        }
    }

    createFinishCallback(key: string): FinishCallback {
        const queues = this.queues;
        const players = this.players;
        return (_old: Voice.AudioPlayerState = null, _new: Voice.AudioPlayerIdleState = null) => {
            if (queues && this.shiftQueue(key)?.length) {
                this.handleQueue(key, true);
                return;
            }
            const details = players[key];
            details?.playerobj?.stop?.();
            details?.connection?.destroy?.();

            delete queues[key];
            delete players[key];
        };
    }

    playAudio(key: string) {
        const item = this.queues[key][0];
        const playerDetails = this.players[key];
        console.info(`playing ${item.file} on ${item.channel.guild.name}`);
        this.incrementTauntCount(item.type);
        const audio = Voice.createAudioResource(this.resolveTaunt(item));
        playerDetails.playerobj.play(audio);
    }

    incrementTauntCount(type: TauntType) {
        const message: TauntEvent = {
            type: 'taunt',
            value: type
        }
        return this.client.shard.send(message);
    }

    shiftQueue(key: string) {
        this.queues[key].shift();
        return this.queues[key];
    }

    close() {
        console.log('terminating bot...');
        this.client.destroy();
    }

    async updateServerCount() {
        const counts = await this.client.shard.fetchClientValues('guilds.cache.size') as number[];
        const count = counts.reduce((acc, guildCount) => acc + guildCount, 0);
        const message: GuildCountEvent = {
            type: 'guildCount',
            value: {
                serverCount: count,
                shardCount: counts.length
            }
        };
        await this.client.shard.send(message);
        return count;
    }

    registerCommands(token: string) {
        const rest = new REST().setToken(token);
        return rest.put(Routes.applicationCommands(this.client.user.id), { body: SlashCommands.map(c => c.toJSON()) });
    }

    setGame = () => {
        if (!this.activity?.name) {
            console.error(`activity missing from config, can't set activity.`);
            return null;
        }
        return this.client.user.setActivity(this.activity.name, this.activity);
    }
}

function getTarget(interaction: ChatInputCommandInteraction): GuildMember {
    const targetId = interaction.options.getMember('member') as GuildMember;
    return targetId || (interaction.member as GuildMember);
}

function compareQueueItems(obj1: QueueItem, obj2: QueueItem) {
    return obj1 && obj2 && obj1.invoker === obj2.invoker && obj1.type === obj2.type;
}

function aOrAn(strings: TemplateStringsArray, subject: string): string {
    const article = subject.toLowerCase() === 'mvp' || /^[aeiou]/.test(subject) ? 'an' : 'a';
    return `${strings[0]}${article} ${subject}${strings.length > 1 ? strings[1] : ''}`;
}

function getQueueKey(item: QueueItem | ChatInputCommandInteraction): string | null {
    const channel = 'applicationId' in item ? (item.member as GuildMember)?.voice?.channel : item.channel;
    return channel?.guild?.id || null;
}

function generateReply(queued: boolean, queueItem: QueueItem) {
    return `${queued ? 'Queued' : 'Playing'} ${userMention(queueItem.target)}'s ${queueItem.interaction.commandName} taunt.`
}

function resolveTauntType(type: string): TauntType {
    if ([Commands.LOSE, Commands.MVP, 'intro'].includes(type)) {
        return type as TauntType;
    }
    return 'victory';
}

function createAudioPlayer(callback: FinishCallback) {
    const player = Voice.createAudioPlayer({
        behaviors: {
            noSubscriber: Voice.NoSubscriberBehavior.Stop
        }
    });
    player.on(Voice.AudioPlayerStatus.Idle, callback);
    player.on(Voice.AudioPlayerStatus.Paused, callback);
    player.on('error', callback);
    return player;
}
