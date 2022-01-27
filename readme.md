# GMod / Discord relay
Allow Discord users to talk with in-game users on Garry's mod.

## Requirements
- [NodeJS](https://nodejs.org/en/download/).
- A Discord server and a Garry's Mod server.
- A [Steam API key](https://steamcommunity.com/dev/apikey).
- A Discord channel's ID. (Which you can get following [this guide]((https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-))
- A Discord bot, which has been invited to your server and has the following permissions:  Manage Webhooks, Send Messages and View Channel.

## How to install
1 - Clone both the [addon](https://github.com/44lr/gdr_addon) and the [node server](https://github.com/44lr/gdr_nodesv).\
2 - Copy the addon into your server's addons folder.\
3 - On gdr_addon/lua/gdr/sv_config.lua, set your settings accordingly\
4 - On gdr_nodesv/config_template.json, also set your settings accordingly, *and rename it to config.json*.\
5 - On a terminal / cmd instance, cd into the folder where you downloaded gdr_nodesv and run **npm install**
6 - If hosting the Node server on the same network as the gmod server, remember to launch srcds with this parameter: ``-allowlocalhttp``

## How to run
1 - On a terminal / cmd instance, cd into where you downloaded gdr_nodesv, and run **node index.js**\
2 - Run your Garry's Mod server.
