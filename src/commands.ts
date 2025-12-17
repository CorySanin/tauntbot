import { SlashCommandBuilder } from 'discord.js';

export const Commands = [
    new SlashCommandBuilder()
        .setName('win')
        .setDescription('Plays your victory track')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Whose track to play')
        ),
    new SlashCommandBuilder()
        .setName('mvp')
        .setDescription('Plays your mvp track')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Whose track to play')
        ),
    new SlashCommandBuilder()
        .setName('lose')
        .setDescription('Plays your lose track')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('Whose track to play')
        ),
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Cancels the current track if you started it or if you\'re an admin'),
    new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Generates a link to invite Taunt Bot to a new guild'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays a help message in chat')
];
