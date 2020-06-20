/*
  _____                 _     ____        _   
 |_   _|_ _ _   _ _ __ | |_  | __ )  ___ | |_ 
   | |/ _` | | | | '_ \| __| |  _ \ / _ \| __|
   | | (_| | |_| | | | | |_ _| |_) | (_) | |_ 
   |_|\__,_|\__,_|_| |_|\__(_)____/ \___/ \__|

*/
const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const DBL = require('dblapi.js');
const { stringify } = require('querystring');
const phin = require('phin');
const log = require('loglevel');
const Config = require('./config');
const config = new Config('config/config.json');
const client = new Discord.Client();
const ZEROWIDTH_SPACE = String.fromCharCode(parseInt('200B', 16));
const mentionId = new RegExp(`<@!?([0-9]+)>`);
const otherPrefix = config.get('prefix');
let dbl;
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

if (config.get('discordBotsToken')) {
    dbl = new DBL(config.get('discordBotsToken'), client);

    dbl.on('error', e => {
        log.error(`Error posting server count to DBL: ${e}`);
    })
}

log.setLevel(config.get('loglevel', 'warn'));

function setGame() {
    let activity = config.get('activity');
    client.user.setActivity(activity.value, activity);
}

function updateServerCount() {
    if (stats.server_count != client.guilds.cache.size) {
        stats.server_count = client.guilds.cache.size;
        log.info(`Currently connected to ${stats.server_count} servers`);
        fs.writeFile(path.join(config.get('statsDirectory'), 'serverCount.txt'), stats.server_count, function (err) {
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
                return (ret) ? ret.split(' ') : [];
            }
        }
        else {
            if (str.match(command)) {
                let ret = str.replace(command, '').trim();
                return (ret) ? ret.split(' ') : [];
            }
        }
    }
    return false;
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
        .catch(reason => {
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
    let match = false;
    const promises = guildQueue[options.channel.guild.id].map(async (op) => {
        match = match || compareQueueItems(options, op);
    })

    return new Promise(async resolve => {
        await Promise.all(promises);
        resolve(match);
    })
}

async function queueAudio(options) {
    if ('file' in options && 'player' in options && 'type' in options && 'channel' in options) {
        let guildid = options.channel.guild.id;
        if (guildQueue[guildid]) {
            if (!await isAlreadyQd(options)) {
                if (options.type === 'intro') {
                    guildQueue[guildid].unshift(options);
                }
                else {
                    guildQueue[guildid].push(options);
                }
            }
        }
        else {
            guildQueue[guildid] = [options];
            play(guildid);
        }
    }
}

function play(guildid) {
    let playerOptions = guildQueue[guildid].shift();
    let connection;
    let finish = (err = null) => {
        if (err) {
            log.error(err);
        }
        if (guildQueue[guildid] && guildQueue[guildid].length) {
            play(guildid);
        }
        else {
            delete guildQueue[guildid];
            delete nowPlaying[guildid];
            if (connection && connection.status !== Discord.Constants.VoiceStatus.DISCONNECTED) {
                connection.disconnect();
            }
        }
    }
    playerOptions.channel.join()
        .then(c => { // connection is VoiceConnection
            connection = c;
            log.info(`playing ${playerOptions.file} on ${playerOptions.channel.guild.name}`);
            let dispatcher = connection.play(
                fs.createReadStream(playerOptions.file),
                {
                    volume: config.get('volume', 0.35),
                    bitrate: 'auto'
                });
            playerOptions.dispatcher = dispatcher;
            nowPlaying[guildid] = playerOptions;
            dispatcher.on('speaking', (speaking) => {
                if (!speaking) {
                    incrementTauntCount(playerOptions.type);
                    finish();
                }
            })
            dispatcher.on('end', finish);
            dispatcher.on('error', finish);
        }).catch(finish);
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
    console.log('Taunt Bot 2 by Cory Sanin');
    updateServerCount();
});

client.on('error', (err) => {
    log.error(`discord.js client error: ${err.name} - ${err.message}`);
});

client.on('guildCreate', guild => {
    updateServerCount();
});

client.on('guildDelete', guild => {
    updateServerCount();
});

client.on('message', message => {
    if (message.guild) {
        let command = getCommand(message.content);
        let arg, type, file;
        if (!message.author.bot && command !== false) {
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
                    file = ((arg.length) ? getIdFromMention(arg[0]) : message.author.id);
                    let filename = path.join(config.get('audioDirectory'), `${file}_${type}.ogg`);
                    fs.exists(filename, (exists) => {
                        if (exists) {
                            queueAudio({
                                file: filename,
                                player: message.author.id,
                                type,
                                channel: message.member.voice.channel
                            });
                        }
                        else {
                            sendMessage(`You need to upload a ${type} taunt. Go to ${config.get('website')} to add one.`, message);
                        }
                    })
                }
            }
            if (!type) {
                if (command === '' || (arg = doesCommandMatch(command, ['help']))) {
                    sendMessage({
                        embed: {
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
                    }, message);
                }
                else if (arg = doesCommandMatch(command, ['invite'])) {
                    sendMessage(
                        {
                            embed: {
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
                            playing.dispatcher.end();
                        }
                    }
                }
            }
        }
    }
});

client.on('voiceStateUpdate', (oldMember, newMember) => {
    if (oldMember.channel === null
        && newMember.channel) {
        const type = 'intro';
        let options = {
            file: path.join(config.get('audioDirectory'), `${newMember.id}_${type}.ogg`),
            player: newMember.id,
            type,
            channel: newMember.channel
        };
        let guild = newMember.channel.guild;
        fs.exists(options.file, (exists) => {
            if (exists) {
                queueAudio(options);
            }
        });
    }
})

client.login(config.get('token'));