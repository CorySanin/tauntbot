const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');

const commands = [
    new SlashCommandBuilder()
        .setName('win')
        .setDescription('Plays your victory track')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Whose track to play. Mention them.')
        ),
    new SlashCommandBuilder()
        .setName('mvp')
        .setDescription('Plays your mvp track')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Whose track to play. Mention them.')
        ),
    new SlashCommandBuilder()
        .setName('lose')
        .setDescription('Plays your lose track')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Whose track to play. Mention them.')
        ),
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Cancels the current track if you started it or if you\'re an admin'),
    // new SlashCommandBuilder()
    //     .setName('invite')
    //     .setDescription('Generates a link to invite Taunt Bot to a new guild'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays a help message in chat')
]

module.exports = exports = async (config) => {
    const rest = new REST({ version: '9' }).setToken(config.get('token'));
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            (config.get('guildId')) ? Routes.applicationGuildCommands(config.get('clientId'), config.get('guildId')) : Routes.applicationGuildCommands(config.get('clientId')),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}