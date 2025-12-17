/*
  _____                 _     ____        _   
 |_   _|_ _ _   _ _ __ | |_  | __ )  ___ | |_ 
   | |/ _` | | | | '_ \| __| |  _ \ / _ \| __|
   | | (_| | |_| | | | | |_ _| |_) | (_) | |_ 
   |_|\__,_|\__,_|_| |_|\__(_)____/ \___/ \__|

*/
import { REST, Client, GatewayIntentBits, Events, Routes, GuildMember, type ActivityOptions, type VoiceBasedChannel, type ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import path from 'path';
import fsp from 'fs/promises';
import fs from 'fs';
import { Commands } from './commands.js';
import type { Config, TauntType } from './types.js';

interface QueueItem {
    file: string;
    invoker: string;
    target: string;
    type: TauntType;
    channel: VoiceBasedChannel;
    interaction?: ChatInputCommandInteraction;
}

interface QueueManager {
    [guildId: string]: QueueItem[];
}

const ZEROWIDTH_SPACE = String.fromCharCode(parseInt('200B', 16));

function getTarget(interaction: ChatInputCommandInteraction): GuildMember {
    const targetId = interaction.options.getMember('member') as GuildMember;
    return targetId || (interaction.member as GuildMember);
}

function compareQueueItems(obj1: QueueItem, obj2: QueueItem) {
    return obj1 && obj2 && obj1.invoker === obj2.invoker && obj1.type === obj2.type;
}

function aOrAn(strings: TemplateStringsArray, subject: string): string {
    const article = /^[aeiou]/.test(subject) ? 'an' : 'a';
    return `${strings[0]}${article} ${subject}${strings.length > 1 ? strings[1] : ''}`;
}

function getQueueKey(item: QueueItem) {
    return item.channel.guild.id;
}

export class TauntBot {
    public start: () => Promise<void>;
    private client: Client;
    private activity: ActivityOptions;
    private queues: QueueManager = {};
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

        client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand() ||
                !interaction.inGuild() ||
                !(interaction.member instanceof GuildMember)
            ) {
                return;
            }

            switch (interaction.commandName) {
                case 'mvp':
                case 'victory':
                case 'lose':
                    const target = getTarget(interaction);
                    const result = await this.queueAudio({
                        channel: interaction.member.voice.channel,
                        invoker: interaction.member.id,
                        target: target.id,
                        type: interaction.commandName,
                        file: `${target.id}_${interaction.commandName}.ogg`,
                        interaction
                    });
                    if (typeof result === 'number') {
                        interaction.reply({
                            content: `${result > 1 ? 'Queued' : 'Playing'} <@${target}>'s ${interaction.commandName} taunt.`
                        });
                    }
                    else {
                        interaction.reply({
                            content: result,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                    break;
                case 'invite':
                case 'help':
                    await interaction.reply({
                        content: 'TODO: implement'
                    });
                default:
                    console.error(`command not recognized: ${interaction.commandName}`);
                    break;
            }
        });

        this.activity = conf.activity;
        this.audioDir = conf.audioDirectory;

        this.start = async () => {
            await client.login(conf.token);
            await this.registerCommands(conf.token);
        }
    }

    isQueueable(item: QueueItem): boolean {
        const inQueue: boolean | null = this.queues?.[getQueueKey(item)]?.some(q => compareQueueItems(item, q));
        return typeof inQueue === 'boolean' ? !inQueue : true;
    }

    resolveTaunt(item: string | QueueItem) {
        const filename = typeof item === 'string' ? item : item.file;
        return path.join(this.audioDir, filename);
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
        if (queues[key]) {
            queues[key].push(item);
        }
        else {
            queues[key] = [item];
        }
        this.handleQueue(key);
        return queues[key].length;
    }

    async handleQueue(key: string) {
        
    }

    close() {
        this.client.destroy();
    }

    async updateServerCount() {
        const count = (await this.client.shard.fetchClientValues('guilds.cache.size') as number[]).reduce((acc, guildCount) => acc + guildCount, 0);
        // TODO: output, call API, etc
        return count;
    }

    registerCommands(token: string) {
        const rest = new REST().setToken(token);
        return rest.put(Routes.applicationCommands(this.client.user.id), { body: Commands.map(c => c.toJSON()) });
    }

    setGame() {
        if (!this.activity?.name) {
            console.error(`activity missing from config, can't set activity.`);
            return null;
        }
        return this.client.user.setActivity(this.activity.name, this.activity);
    }
}
