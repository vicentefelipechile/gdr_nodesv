/*==================================================
                Dotenv Configuration
==================================================*/

import dotenv from 'dotenv';
dotenv.config();

interface ENV_INTERFACE {
    PORT: number;
    STEAM_KEY: string;
    RESTART_URL: string;
    RESTART_PASSWORDKEY: string;
    DISCORD_KEY: string;
    DISCORD_CHANNEL: string;
    DISCORD_TOKEN: string;
    DISCORD_MAPS_LINK: string;
    DISCORD_GAMEMODES_LINK: string;
    DISCORD_EMBED_ICON: string;
    DISCORD_LINK: string;
    ADDON_COLLECTION_LINK: string;
}

export const ENV: ENV_INTERFACE = {
    PORT: Number(process.env.PORT) || 3000,
    STEAM_KEY: process.env.STEAM_KEY,
    RESTART_URL: process.env.RESTART_URL,
    RESTART_PASSWORDKEY: process.env.RESTART_PASSWORDKEY,
    DISCORD_KEY: process.env.DISCORD_KEY,
    DISCORD_CHANNEL: process.env.DISCORD_CHANNEL,
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    DISCORD_MAPS_LINK: process.env.DISCORD_MAPS_LINK,
    DISCORD_GAMEMODES_LINK: process.env.DISCORD_GAMEMODES_LINK,
    DISCORD_EMBED_ICON: process.env.DISCORD_EMBED_ICON,
    DISCORD_LINK: process.env.DISCORD_LINK,
    ADDON_COLLECTION_LINK: process.env.ADDON_COLLECTION_LINK
};