import { SlashCommandBuilder } from 'discord.js';

export const Commands = {
    WIN: 'win',
    MVP: 'mvp',
    LOSE: 'lose',
    STOP: 'stop',
    INVITE: 'invite',
    HELP: 'help'
}

export const SlashCommands = [
    new SlashCommandBuilder()
        .setName(Commands.WIN)
        .setDescription('Plays your victory track')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Whose track to play')
        ),
    new SlashCommandBuilder()
        .setName(Commands.MVP)
        .setDescription('Plays your mvp track')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Whose track to play')
        ),
    new SlashCommandBuilder()
        .setName(Commands.LOSE)
        .setDescription('Plays your lose track')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Whose track to play')
        ),
    new SlashCommandBuilder()
        .setName(Commands.STOP)
        .setDescription('Cancels the current track if you started it or if you\'re an admin'),
    new SlashCommandBuilder()
        .setName(Commands.INVITE)
        .setDescription('Generates a link to invite Taunt Bot to a new guild'),
    new SlashCommandBuilder()
        .setName(Commands.HELP)
        .setDescription('Displays a help message in chat')
];
