import { SlashCommandBuilder } from 'discord.js';
import { TauntTypes } from './types.js';

export const Commands = {
    WIN: 'win',
    MVP: 'mvp',
    LOSE: 'lose',
    STOP: 'stop',
    INVITE: 'invite',
    HELP: 'help',
    UPLOAD: 'upload',
    DELETE: 'delete',
};

export const OptionNames = {
    TYPE: 'type',
    AUDIO: 'audio',
    MEMBER: 'member'
}

function createLiteralChoice(choice: string) {
    return { name: choice, value: choice };
}

export const SlashCommands = [
    new SlashCommandBuilder()
        .setName(Commands.WIN)
        .setDescription('Plays your victory track')
        .addUserOption(option =>
            option.setName(OptionNames.MEMBER)
                .setDescription('Whose track to play')
        ),
    new SlashCommandBuilder()
        .setName(Commands.MVP)
        .setDescription('Plays your mvp track')
        .addUserOption(option =>
            option.setName(OptionNames.MEMBER)
                .setDescription('Whose track to play')
        ),
    new SlashCommandBuilder()
        .setName(Commands.LOSE)
        .setDescription('Plays your lose track')
        .addUserOption(option =>
            option.setName(OptionNames.MEMBER)
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
        .setDescription('Displays a help message in chat'),
    new SlashCommandBuilder()
        .setName(Commands.UPLOAD)
        .setDescription('Upload taunts for playback')
        .addStringOption(option =>
            option.setName(OptionNames.TYPE)
                .setDescription('Which taunt to upload/replace')
                .setRequired(true)
                .setChoices(
                    createLiteralChoice(Commands.WIN),
                    createLiteralChoice(TauntTypes.MVP),
                    createLiteralChoice(TauntTypes.INTRO),
                    createLiteralChoice(TauntTypes.LOSE)
                )
        )
        .addAttachmentOption(option => 
            option.setName(OptionNames.AUDIO)
            .setDescription('Taunt audio clip to upload')
            .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName(Commands.DELETE)
        .setDescription('Delete taunt')
        .addStringOption(option =>
            option.setName(OptionNames.TYPE)
                .setDescription('Which taunt to delete')
                .setRequired(true)
                .setChoices(
                    createLiteralChoice(Commands.WIN),
                    createLiteralChoice(TauntTypes.MVP),
                    createLiteralChoice(TauntTypes.INTRO),
                    createLiteralChoice(TauntTypes.LOSE)
                )
        )
];
