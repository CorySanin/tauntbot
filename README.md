
# Taunt Bot 🏆🤖 Celebrate your Victories

[![David](https://img.shields.io/david/CorySanin/tauntbot)](https://david-dm.org/CorySanin/tauntbot) [![Connected Discord Servers](https://img.shields.io/badge/dynamic/json?color=brightgreen&label=Servers&query=%24.server_count&url=https%3A%2F%2Ftaunt.bot%2Fstats.json.php)](https://discordapp.com/oauth2/authorize?client_id=227435708183216128&scope=bot&permissions=3165184) [![Taunts played this year](https://img.shields.io/badge/dynamic/json?color=brightgreen&label=Taunts&query=%24.year_taunts&url=https%3A%2F%2Ftaunt.bot%2Fstats.json.php)](https://taunt.bot) [![Uptime Robot ratio (30 days)](https://img.shields.io/uptimerobot/ratio/m782912905-c4639c4b2726f26676ee25ef)](https://status.taunt.bot/) [![Support Discord](https://img.shields.io/discord/225989349949308928)](https://discord.gg/D3tTjQ4)

Taunt Bot is a Discord bot that plays user-uploaded audio tracks on command. For more info on what Taunt Bot does, visit [Taunt.Bot](https://taunt.bot).

## Running Taunt Bot

Clone this repo, do an `npm install`, and edit `config/config.json` to match your desired configuration. In your audio directory, taunt bot is expecting audio files with names following this format: 
`{ID of associated user}_{type (victory|mvp|lose|intro)}.ogg`

Once Taunt Bot has been set up, start the bot with `node index.js`.

## Docker

Use the Dockerfile, or grab the latest image from [Docker Hub](https://hub.docker.com/r/corysanin/tauntbot).

At the minimum, the container expects a configuration json file and a directory to retreive audio files from.

Docker Compose Example:

```
version: '2'

services:
    tauntbot:
        container_name: tauntbot
        image: corysanin/tauntbot
        restart: "always"
        volumes :
            - ./config:/usr/src/app/config
            - ./audio:/usr/src/app/audio
            - ./stats:/usr/src/app/stats
```