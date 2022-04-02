/*
  _____                 _     ____        _   
 |_   _|_ _ _   _ _ __ | |_  | __ )  ___ | |_ 
   | |/ _` | | | | '_ \| __| |  _ \ / _ \| __|
   | | (_| | |_| | | | | |_ _| |_) | (_) | |_ 
   |_|\__,_|\__,_|_| |_|\__(_)____/ \___/ \__|

*/
const Discord = require('discord.js');
const Voice = require('@discordjs/voice');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const DBL = require('topgg-autoposter').AutoPoster;
const log = require('loglevel');
const Config = require('./config');
const SlashCommands = require('./slashcommands');
const config = new Config('config/config.json');
const client = new Discord.Client({
    intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILD_VOICE_STATES]
});
const ZEROWIDTH_SPACE = String.fromCharCode(parseInt('200B', 16));
const mentionId = new RegExp(`<@!?([0-9]+)>`);
const otherPrefix = config.get('prefix');
let mentionPrefix;
let guildQueue = {};
let nowPlaying = {};
let stats = {
    server_count: 0,
    taunt_count: {
        today: {
            date: 0
        },
        year: {
            yearnum: 0
        }
    }
};

log.setLevel(config.get('loglevel', 'warn'));

function setGame() {
    let activity = config.get('activity');
    client.user.setActivity(activity.value, activity);
}

function updateServerCount() {
    if (stats.server_count != client.guilds.cache.size) {
        stats.server_count = client.guilds.cache.size;
        log.info(`Currently connected to ${stats.server_count} servers`);
        fs.writeFile(path.join(config.get('statsDirectory'), 'serverCount.txt'), `${stats.server_count}`, function (err) {
            if (err) { log.error(`Error saving server count: ${err}`); }
        });
    }
}

function incrementTauntCount(type) {
    setGame();
    let date = new Date();
    let year = date.getFullYear();
    let day = date.getDate();
    if (year !== stats.taunt_count.year.yearnum) {
        stats.taunt_count.year = {
            yearnum: year
        }
    }
    if (day !== stats.taunt_count.today.date) {
        stats.taunt_count.today = {
            date: day
        }
    }
    if (!(type in stats.taunt_count.year)) {
        stats.taunt_count.year[type] = 0;
    }
    if (!(type in stats.taunt_count.today)) {
        stats.taunt_count.today[type] = 0;
    }
    stats.taunt_count.year[type]++;
    stats.taunt_count.today[type]++;

    fs.writeFile(path.join(config.get('statsDirectory'), 'stats.json'), JSON.stringify(stats.taunt_count), function (err) {
        if (err) { log.error(`Error saving taunt count stats: ${err}`); }
    });
    fs.writeFile(path.join(config.get('statsDirectory'), `taunts_${year}.json`), JSON.stringify(stats.taunt_count.year), function (err) {
        if (err) { log.error(`Error saving taunt count for the year: ${err}`); }
    });
}

function getCommand(str) {
    let message = str.toLowerCase();
    if (message.match(mentionPrefix)) {
        return message.replace(mentionPrefix, '').trim();
    }
    if (otherPrefix && message.startsWith(otherPrefix)) {
        return message.substring(otherPrefix.length, str.length).trim();
    }
    return false;
}

function doesCommandMatch(str, commands) {
    for (const command of commands) {
        if (typeof command === 'string') {
            if (str.startsWith(command)) {
                let ret = str.substring(command.length, str.length).trim();
                return (ret) ? ret : true;
            }
        }
        else {
            if (str.match(command)) {
                let ret = str.replace(command, '').trim();
                return (ret) ? ret : true;
            }
        }
    }
    return false;
}

function tauntExists(file) {
    return new Promise(async (resolve) => {
        try {
            await fsp.access(file, fs.constants.R_OK);
            resolve(true);
        }
        catch {
            resolve(false);
        }
    });
}

function getIdFromMention(str) {
    let match = str.match(mentionId);
    return match ? match[1] : match;
}

function sendMessage(message, trigger) {
    if (typeof message === 'string') {
        message = ZEROWIDTH_SPACE + message;
    }
    trigger.channel.send(message)
        .catch(() => {
            trigger.author.send(message)
                .catch(e => {
                    log.error(`Couldn't reply to user ${trigger.author.id} - ${e}`);
                });
        });
}

function compareQueueItems(obj1, obj2) {
    return obj1 && obj2 && obj1.player === obj2.player && obj1.type === obj2.type;
}

function isAlreadyQd(options) {
    return compareQueueItems(options, nowPlaying[options.channel.guild.id])
        || guildQueue[options.channel.guild.id].some(q => compareQueueItems(options, q));
}

async function queueAudio(options) {
    if ('file' in options && 'player' in options && 'type' in options && 'channel' in options) {
        let guildid = options.channel.guild.id;
        if (guildQueue[guildid]) {
            if (!isAlreadyQd(options)) {
                if (options.type === 'intro') {
                    guildQueue[guildid].unshift(options);
                }
                else {
                    guildQueue[guildid].push(options);
                }
            }
            else {
                return false;
            }
        }
        else {
            guildQueue[guildid] = [options];
            play(guildid);
        }
        return true;
    }
}

function play(guildid) {
    try {
        let playerOptions = guildQueue[guildid].shift();
        let connection, player;
        let finish = () => {
            if (guildQueue[guildid] && guildQueue[guildid].length) {
                play(guildid);
            }
            else {
                delete guildQueue[guildid];
                delete nowPlaying[guildid];
                if (connection && player) {
                    connection.destroy();
                    player.stop();
                }
            }
        }
        let playaudio = () => {
            log.info(`playing ${playerOptions.file} on ${playerOptions.channel.guild.name}`);
            incrementTauntCount(playerOptions.type)
            player.play(Voice.createAudioResource(fs.createReadStream(playerOptions.file), { inputType: Voice.StreamType.OggOpus }));
        };
        player = playerOptions.playerobj = (guildid in nowPlaying && nowPlaying[guildid].playerobj) || createAudioPlayer(finish);
        connection = playerOptions.connection = Voice.joinVoiceChannel({
            channelId: playerOptions.channel.id,
            guildId: playerOptions.channel.guild.id,
            adapterCreator: playerOptions.channel.guild.voiceAdapterCreator
        });
        connection.on('error', (err) => {
            console.error('VoiceConnection Error:');
            console.error(err);
            finish();
        })
        nowPlaying[guildid] = playerOptions;
        connection.subscribe(player);
        if (connection.state.status === Voice.VoiceConnectionStatus.Ready) {
            playaudio();
        }
        else {
            connection.on(Voice.VoiceConnectionStatus.Ready, playaudio);
        }
    }
    catch (ex) {
        console.error('General exception in play():');
        console.error(ex);
    }
}

function createAudioPlayer(callback) {
    let player = Voice.createAudioPlayer();
    player.on(Voice.AudioPlayerStatus.Idle, callback);
    player.on(Voice.AudioPlayerStatus.Paused, callback);
    player.on('error', callback);
    return player;
}

client.on('ready', () => {
    mentionPrefix = new RegExp(`^(<@!?${client.user.id}>)`);
    fs.readFile(path.join(config.get('statsDirectory'), 'stats.json'), (err, data) => {
        if (err) {
            log.error(`Error reading taunt statistics: ${err}`);
        }
        else {
            try {
                stats.taunt_count = JSON.parse(data);
            }
            catch (e) {
                log.error(`Error parsing taunt statistics: ${e}`);
            }
        }
    });
    setGame();
    console.log('Taunt Bot by Cory Sanin');
    updateServerCount();
    SlashCommands(config);
    setInterval(() => SlashCommands(config), 3600000);
    if (config.get('discordBotsToken')) {
        DBL(config.get('discordBotsToken'), client);
    }
});

client.on('error', err => {
    log.error(`discord.js client error: ${err.name} - ${err.message}`);
});

client.on('guildCreate', guild => {
    updateServerCount();
});

client.on('guildDelete', guild => {
    updateServerCount();
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand() && interaction.member && interaction.member.guild && !interaction.member.user.bot) {
        let command = interaction.commandName;
        let arg = interaction.options.getMember('member');
        let type, file;
        if (command === 'win') {
            type = 'victory';
        }
        else if (command === 'mvp' || command === 'lose') {
            type = command;
        }
        if (type) {
            if (interaction.member.voice.channel) {
                file = (arg || interaction.member).id;
                let filename = path.join(config.get('audioDirectory'), `${file}_${type}.ogg`);
                if (await tauntExists(filename)) {
                    if (await queueAudio({
                        file: filename,
                        player: interaction.member.id,
                        type,
                        channel: interaction.member.voice.channel
                    })) {
                        await interaction.reply(`Playing ${(arg || interaction.member).displayName}'s ${type} taunt in :loud_sound: ${interaction.member.voice.channel.name}`);
                    }
                    else {
                        await interaction.reply({ content: 'You\'ve already queued up that kind of taunt', ephemeral: true });
                    }
                }
                else if (arg) {
                    await interaction.reply({
                        content: `That user doesn't have a ${type} taunt uploaded.`,
                        ephemeral: true
                    });
                }
                else {
                    await interaction.reply({
                        content: `You need to upload a ${type} taunt. Go to <${config.get('website')}> to add one.`,
                        ephemeral: true
                    });
                }
            }
            else {
                await interaction.reply({
                    content: `You need to be in a voice channel to summon ${client.user.username}`,
                    ephemeral: true
                });
            }
        }
        else {
            if (command === 'help') {
                await interaction.reply({
                    ephemeral: true,
                    embeds: [
                        {
                            author: {
                                name: client.user.username,
                                url: 'https://taunt.bot',
                                iconURL: client.user.avatarURL()
                            },
                            description: (`Every time you win, listen to your anthem by joining a voice channel and entering \`${otherPrefix}win\`` +
                                ` in the chat. For smaller achievements, use \`${otherPrefix}mvp\` to hear a shorter audio track of your choosing. ` +
                                `To get started, log in with your Discord account at [${config.get('website')}](${config.get('website')}). ` +
                                "Lastly, upload your taunts and you'll be ready to go! " +
                                "\n*You must be connected to a voice channel for it to work.* " +
                                "\nCreated by Cory Sanin (AKA WORM)"),
                            color: config.get('color', 0),
                            fields: [
                                {
                                    name: `${otherPrefix}win`,
                                    value: `Plays your victory track. Optionally, you can play someone else's win anthem by mentioning them. Example: \`${otherPrefix}win @${client.user.username}\``
                                },
                                {
                                    name: `${otherPrefix}mvp`,
                                    value: `Plays your mvp track. Optionally, you can play someone else's mvp anthem by mentioning them. Example: \`${otherPrefix}mvp @${client.user.username}\``
                                },
                                {
                                    name: `${otherPrefix}lose`,
                                    value: `Plays your lose track. Optionally, you can play someone else's lose anthem by mentioning them. Example: \`${otherPrefix}lose @${client.user.username}\``
                                },
                                {
                                    name: `${otherPrefix}stop`,
                                    value: 'Cancels the current track, if you started it (or if you\'re an admin)'
                                },
                                {
                                    name: `${otherPrefix}invite`,
                                    value: 'Generates a link to invite Taunt Bot to a server near you!'
                                },
                                {
                                    name: `${otherPrefix}help`,
                                    value: 'Displays this help message'
                                }
                            ]
                        }
                    ]
                });
            }
            else if (command === 'invite') {
                await interaction.reply(
                    {
                        ephemeral: true,
                        embeds: [
                            {
                                author: {
                                    name: client.user.username,
                                    url: 'https://taunt.bot'
                                },
                                thumbnail: {
                                    url: client.user.avatarURL()
                                },
                                color: 38536,
                                fields: [
                                    {
                                        name: 'Invite',
                                        value: `[Invite ${client.user.username}](https://discordapp.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=3165184) to your server`
                                    },
                                    {
                                        name: 'Website',
                                        value: `Visit [${config.get('website')}](${config.get('website')}) to upload taunts`
                                    },
                                    {
                                        name: 'Discord',
                                        value: `Discuss [${client.user.username} on Discord](${config.get('guild', 'https://github.com/CorySanin/tauntbot')})`
                                    }
                                ]
                            }
                        ]
                    }
                );
            }
            else if (command === 'stop') {
                let playing = nowPlaying[interaction.guildId];
                if (playing) {
                    if (playing.player === interaction.member.user.id
                        || interaction.member.permissions.any([
                            Discord.Permissions.FLAGS.ADMINISTRATOR,
                            Discord.Permissions.FLAGS.MANAGE_CHANNELS,
                            Discord.Permissions.FLAGS.KICK_MEMBERS,
                            Discord.Permissions.FLAGS.MOVE_MEMBERS]
                        )) {
                        playing.playerobj.pause();
                        await interaction.reply(`${interaction.member.displayName} stopped the taunt`);
                    }
                    else {
                        await interaction.reply({ content: 'You did not queue up this taunt.', ephemeral: true });
                    }
                }
                else {
                    await interaction.reply({ content: 'Nothing to stop', ephemeral: true });
                }
            }
        }
    }
});

client.on('messageCreate', async message => {
    if (message.guild && !message.author.bot) {
        let command = getCommand(message.content);
        let arg, type, file;
        if (command !== false) {
            if (message.member.voice.channel) {
                if (arg = doesCommandMatch(command, [/^(win|victory)/])) {
                    type = 'victory';
                }
                else if (arg = doesCommandMatch(command, [/^(mvp|goal)/])) {
                    type = 'mvp';
                }
                else if (arg = doesCommandMatch(command, [/^(lose|loss|loser)/])) {
                    type = 'lose';
                }
                if (type) {
                    file = (typeof arg === 'string' && getIdFromMention(arg.split(' ')[0])) || message.author.id;
                    let filename = path.join(config.get('audioDirectory'), `${file}_${type}.ogg`);
                    if (await tauntExists(filename)) {
                        queueAudio({
                            file: filename,
                            player: message.author.id,
                            type,
                            channel: message.member.voice.channel
                        });
                    }
                    else if (typeof arg === 'string') {
                        sendMessage(`That user doesn't have a ${type} taunt uploaded.`, message);
                    }
                    else {
                        sendMessage(`You need to upload a ${type} taunt. Go to <${config.get('website')}> to add one.`, message);
                    }
                }
            }
            if (!type) {
                if (command === '' || (arg = doesCommandMatch(command, ['help']))) {
                    sendMessage({
                        embeds: [
                            {
                                author: {
                                    name: client.user.username,
                                    url: 'https://taunt.bot',
                                    iconURL: client.user.avatarURL()
                                },
                                description: (`Every time you win, listen to your anthem by joining a voice channel and entering \`${otherPrefix}win\`` +
                                    ` in the chat. For smaller achievements, use \`${otherPrefix}mvp\` to hear a shorter audio track of your choosing. ` +
                                    `To get started, log in with your Discord account at [${config.get('website')}](${config.get('website')}). ` +
                                    "Lastly, upload your taunts and you'll be ready to go! " +
                                    "\n*You must be connected to a voice channel for it to work.* " +
                                    "\nCreated by Cory Sanin (AKA WORM)"),
                                color: config.get('color', 0),
                                fields: [
                                    {
                                        name: `${otherPrefix}win`,
                                        value: `Plays your victory track. Optionally, you can play someone else's win anthem by mentioning them. Example: \`${otherPrefix}win @${client.user.username}\``
                                    },
                                    {
                                        name: `${otherPrefix}mvp`,
                                        value: `Plays your mvp track. Optionally, you can play someone else's mvp anthem by mentioning them. Example: \`${otherPrefix}mvp @${client.user.username}\``
                                    },
                                    {
                                        name: `${otherPrefix}lose`,
                                        value: `Plays your lose track. Optionally, you can play someone else's lose anthem by mentioning them. Example: \`${otherPrefix}lose @${client.user.username}\``
                                    },
                                    {
                                        name: `${otherPrefix}stop`,
                                        value: 'Cancels the current track, if you started it (or if you\'re an admin)'
                                    },
                                    {
                                        name: `${otherPrefix}invite`,
                                        value: 'Generates a link to invite Taunt Bot to a server near you!'
                                    },
                                    {
                                        name: `${otherPrefix}help`,
                                        value: 'Displays this help message'
                                    }
                                ]
                            }
                        ]
                    }, message);
                }
                else if (arg = doesCommandMatch(command, ['invite'])) {
                    sendMessage(
                        {
                            embeds: [
                                {
                                    author: {
                                        name: client.user.username,
                                        url: 'https://taunt.bot'
                                    },
                                    thumbnail: {
                                        url: client.user.avatarURL()
                                    },
                                    color: 38536,
                                    fields: [
                                        {
                                            name: 'Invite',
                                            value: `[Invite ${client.user.username}](https://discordapp.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=3165184) to your server`
                                        },
                                        {
                                            name: 'Website',
                                            value: `Visit [${config.get('website')}](${config.get('website')}) to upload taunts`
                                        },
                                        {
                                            name: 'Discord',
                                            value: `Discuss [${client.user.username} on Discord](${config.get('guild', 'https://github.com/CorySanin/tauntbot')})`
                                        }
                                    ]
                                }
                            ]
                        }, message
                    )
                }
                else if (arg = doesCommandMatch(command, ['stop', 'halt'])) {
                    let playing = nowPlaying[message.guild.id];
                    if (playing) {
                        if (playing.player === message.member.id || message.member.hasPermission('ADMINISTRATOR')
                            || message.member.hasPermission('MANAGE_CHANNELS')
                            || message.member.hasPermission('KICK_MEMBERS')
                            || message.member.hasPermission('MOVE_MEMBERS')) {
                            playing.playerobj.pause();
                        }
                    }
                }
                else if (arg = doesCommandMatch(command, ['debug']) && message.member.permissions.any([
                    Discord.Permissions.FLAGS.ADMINISTRATOR,
                    Discord.Permissions.FLAGS.MANAGE_CHANNELS,
                    Discord.Permissions.FLAGS.KICK_MEMBERS,
                    Discord.Permissions.FLAGS.MOVE_MEMBERS]
                )) {
                    console.log(guildQueue);
                    console.log(nowPlaying);
                }
            }
        }
    }
});

client.on('voiceStateUpdate', async (oldMember, newMember) => {
    if (oldMember.channel === null
        && newMember.channel) {
        const type = 'intro';
        let options = {
            file: path.join(config.get('audioDirectory'), `${newMember.id}_${type}.ogg`),
            player: newMember.id,
            type,
            channel: newMember.channel
        };
        if (await tauntExists(options.file)) {
            queueAudio(options);
        }
    }
})

client.login(config.get('token'));