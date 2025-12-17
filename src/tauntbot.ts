/*
  _____                 _     ____        _   
 |_   _|_ _ _   _ _ __ | |_  | __ )  ___ | |_ 
   | |/ _` | | | | '_ \| __| |  _ \ / _ \| __|
   | | (_| | |_| | | | | |_ _| |_) | (_) | |_ 
   |_|\__,_|\__,_|_| |_|\__(_)____/ \___/ \__|

*/
import { REST, Client, GatewayIntentBits, Events, Routes } from 'discord.js';
import { Commands } from './commands.js';
import type { Config } from './types.js';

export class TauntBot {
    public start: () => Promise<void>;
    private client: Client;

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
            if (!interaction.isChatInputCommand()) {
                return;
            }
            switch (interaction.commandName) {
                case "mvp":
                    break;
                default:
                    console.error(`command not recognized: ${interaction.commandName}`);
                    break;
            }
        });

        this.start = async () => {
            await client.login(conf.token);
            await this.registerCommands(conf.token);
        }
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
}