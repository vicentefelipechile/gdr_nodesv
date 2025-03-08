import { ApplicationCommandData, GuildMember, ChatInputCommandInteraction, Collection, EmbedBuilder, ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { PlayerStatusInfo, SetGmodCommand, TerrorTownRoundStatus, TerrorTownStatus } from "./types";
import { ServerEmbed, ServerStatus } from ".";
import { GDRClient } from "./client";
import { ENV } from "./env";
import { getBorderCharacters, table, TableUserConfig } from "table";

interface CommandRunOptions {client: GDRClient, interaction: ChatInputCommandInteraction}
type CommandExecuteFunction = (options: CommandRunOptions) => Promise<any>;
export type GDRCommand = {ID: string, Data: ApplicationCommandData, Execute: CommandExecuteFunction}

function FormatTime(PlayerTime: number): string {
    const cuttime = (PlayerTime / 60)
    let seconds = PlayerTime % 60;
    let minutes = (cuttime) % 60;
    let hours = (cuttime) / 60;
    if (Number(hours.toFixed(0)) > 0) { return `${hours.toFixed(0)}s`; }
    else if (Number(minutes.toFixed(0)) > 0) { return `${minutes.toFixed(0)}m`; }
    return `${seconds.toFixed(0)}s`;
}

function PlayingTerrorTown(): boolean { return (ServerStatus && ServerStatus.gamemode_dir === "terrortown"); }

export const Commands: Collection<string, GDRCommand> = new Collection<string, GDRCommand>();
const CommandsDefinition: GDRCommand[] = [
    {
        ID: "ping",
        Data: {
            name: "ping",
            nameLocalizations: {
                ["es-ES"]: "latencia",
                ["es-419"]: "latencia"
            },
            description: "Ping test",
            descriptionLocalizations: {
                ["es-ES"]: "Prueba de latencia",
                ["es-419"]: "Prueba de latencia"
            }
        },
        async Execute({client, interaction}) {
            await interaction.deferReply({flags: MessageFlags.Ephemeral});
            interaction.editReply({content: `📡 ${client.ws.ping}ms`, options: {flags: MessageFlags.Ephemeral}});
        }
    },
    {
        ID: "status",
        Data: {
            name: "status",
            nameLocalizations: {
                ["es-ES"]: "estado",
                ["es-419"]: "estado"
            },
            description: "Gets the current state of the server (players, round information, etc)",
            descriptionLocalizations: {
                ["es-ES"]: "Obten el estado actual del servidor (jugadores, informacion de la ronda, entre otros)",
                ["es-419"]: "Obten el estado actual del servidor (jugadores, informacion de la ronda, entre otros)"
            }
        },
        async Execute({client, interaction}) {
            if (!ServerStatus) { // ServerEmbed
                interaction.reply({content: "Hubo un error inesperado, intentelo denuevo.", flags: MessageFlags.Ephemeral});
                return;
            }

            // Embed
            const ServerInfoEmbed = new EmbedBuilder().setColor("#00ADFF")
            let hostname: string = ServerStatus.hostname;
            let hostaddress: string = ServerStatus.hostaddress;
            let gamemode: string = ServerStatus.gamemode;
            let gamemode_dir: string = ServerStatus.gamemode_dir;
            let map: string = ServerStatus.map;
            let players: PlayerStatusInfo[] = ServerStatus.players;
            let maxplayers: number = ServerStatus.maxplayers;
            let meta: unknown = ServerStatus.meta;

            let ServerDescription: string[] = [
                `**__Mapa__**: ${map}`,
                `**__Jugadores__**: ${players.length}/${maxplayers} jugadores`,
                `**__Modo de juego__**: ${gamemode}`
            ];

            ServerInfoEmbed.setTitle(hostname);
            ServerInfoEmbed.setAuthor({name: hostaddress, iconURL: ENV.DISCORD_EMBED_ICON});
            ServerInfoEmbed.setDescription(ServerDescription.join(`\n`));

            let TableString: string;
            if (players.length <= 0) {
                let TableData = [["No hay nadie jugando aun"]];
                TableString = table(TableData, {columns: [{alignment: "center"}]});
            }
            else {
                let TableData = [["Rango", "Jugador", "Puntaje", "Tiempo Jugado"]];
                for (let index = 0; index < players.length; index++) {
                    const player: PlayerStatusInfo = players[index];
                    let time = FormatTime(player.time);
                    let name = player.bot ? `[BOT] ${player.name}` : player.name;
                    TableData.push([player.usergroup, name, player.score.toString(), time]);
                }

                let TableConfig: TableUserConfig = {
                    columns: [
                        {alignment: "left"}, {alignment: "left"}, {alignment: "right"}, {alignment: "right"}
                    ],
                    border: getBorderCharacters('void'),
                    columnDefault: {
                        paddingLeft: 0,
                        paddingRight: 1
                    },
                    drawHorizontalLine: () => false
                };
                TableString = table(TableData, TableConfig);
            }
            ServerInfoEmbed.addFields([{name: "Jugadores", value: `\`\`\`\n${TableString}\n\`\`\``}]);
            ServerInfoEmbed.setFooter({text: `${gamemode}`, iconURL: `${ENV.DISCORD_GAMEMODES_LINK}${gamemode_dir}.png`})
            ServerInfoEmbed.setThumbnail(`${ENV.DISCORD_MAPS_LINK}${map}.png`);
            if (PlayingTerrorTown()) {
                let TerrorTownStatus = meta as TerrorTownStatus;

                let TerrorTownRoundString = {
                    [TerrorTownRoundStatus.Waiting]: "En Espera",
                    [TerrorTownRoundStatus.Preparing]: "Preparando",
                    [TerrorTownRoundStatus.InProgress]: "En Progreso",
                    [TerrorTownRoundStatus.RoundOver]: "Ronda Terminada",
                }
                let TerrorTownDescription: string[] = [
                    `**${TerrorTownRoundString[TerrorTownStatus.state]}**`,
                ];
                
                if (TerrorTownStatus.state == TerrorTownRoundStatus.InProgress) {
                    if (TerrorTownStatus.terrorists > 0) { TerrorTownDescription.push(`**${TerrorTownStatus.terrorists}** Terroristas`); }
                    if (TerrorTownStatus.traitors > 0) { TerrorTownDescription.push(`**${TerrorTownStatus.traitors}** Traidores`); }
                    if ((TerrorTownStatus.detective_mode) && (TerrorTownStatus.detectives > 0)) { TerrorTownDescription.push(`**${TerrorTownStatus.detectives}** Detective`); }
                    if (TerrorTownStatus.spectators > 0) { TerrorTownDescription.push(`**${TerrorTownStatus.spectators}** Espectadores`); }
                    if (TerrorTownStatus.detective_mode) {
                        if (TerrorTownStatus.missings > 0) { TerrorTownDescription.push(`**${TerrorTownStatus.missings}** Desaparecidos`); }
                        if (TerrorTownStatus.founds > 0) { TerrorTownDescription.push(`**${TerrorTownStatus.founds}** Muertos Confirmados`); }
                    }
                }
                ServerInfoEmbed.addFields([{name: "Estado de la Partida", value: TerrorTownDescription.join(`\n`)}]);
            }
            interaction.reply({embeds: [ServerInfoEmbed]});
        }
    },
    {
        ID: "command",
        Data: {
            name: "command",
            nameLocalizations: {
                ["es-ES"]: "comando",
                ["es-419"]: "comando"
            },
            description: "Send a command to Garry's Mod server",
            descriptionLocalizations: {
                ["es-ES"]: "Envia un comando al servidor de Garry's Mod",
                ["es-419"]: "Envia un comando al servidor de Garry's Mod"
            },
            options: [
                {
                    name: "cmd",
                    nameLocalizations: {
                        ["es-ES"]: "cmd",
                        ["es-419"]: "cmd"
                    },
                    type: ApplicationCommandOptionType.String,
                    description: "The command to send to the Garry's Mod server",
                    descriptionLocalizations: {
                        ["es-ES"]: "El comando a enviar al servidor de Garry's Mod",
                        ["es-419"]: "El comando a enviar al servidor de Garry's Mod"
                    },
                    required: true
                }
            ]
        },
        async Execute({client, interaction}) { // Verificar si el usuario tiene el rol requerido
            const requiredRoleID = "884222069032759302"; // Reemplaza esto con el ID de tu rol
            const member = interaction.member as GuildMember;
            if (!member.roles.cache.some(role => role.id === requiredRoleID)) {
                interaction.reply({content: "No tienes permiso para usar este comando.", flags: MessageFlags.Ephemeral});
                return;
            }

            const command: string = await interaction.options.getString("cmd", true);
            SetGmodCommand(command);
            interaction.reply({content: "Listo", flags: MessageFlags.Ephemeral});
        }
    },
    {
        ID: "discord",
        Data: {
            name: "discord",
            description: "Sends a notification to any connected player about the Discord server",
            descriptionLocalizations: {
                ["es-ES"]: "Envia una notificacion a cualquier jugador conectado hacerca del servidor de Discord",
                ["es-419"]: "Envia una notificacion a cualquier jugador conectado hacerca del servidor de Discord"
            },
        },
        async Execute({client, interaction}) {
            const requiredRoleID = "884222069032759302"; // Reemplaza esto con el ID de tu rol
            const member = interaction.member as GuildMember;
            if (!member.roles.cache.some(role => role.id === requiredRoleID)) {
                interaction.reply({content: "No tienes permiso para usar este comando.", flags: MessageFlags.Ephemeral});
                return;
            }

            const command: string = `say "Servidor de Discord: ${ENV.DISCORD_LINK}"`;
            SetGmodCommand(command);
        }
    },
    {
        ID: "addons",
        Data: {
            name: "addons",
            description: "Gets a link to the server's addon collection",
            descriptionLocalizations: {
                ["es-ES"]: "Obten un enlace de la coleccion de addons del servidor",
                ["es-419"]: "Obten un enlace de la coleccion de addons del servidor"
            },
        },
        async Execute({client, interaction}) {
            interaction.reply({content: `Coleccion del servidor:\n${ENV.ADDON_COLLECTION_LINK}`});
        }
    },
    {
        ID: "player",
        Data: {
            name: "player",
            description: "Gets a player's info"
        },
        async Execute({client, interaction}) {
            
        }
    },
    {
        ID: "restart",
        Data: {
            name: "restart",
            description: "Performs a restart to the Garry's Mod server"
        },
        async Execute({client, interaction}) {
            const requiredRoleID = "884222069032759302"; // Reemplaza esto con el ID de tu rol
            const member = interaction.member as GuildMember;
            if (!member.roles.cache.some(role => role.id === requiredRoleID)) {
                interaction.reply({content: "No tienes permiso para usar este comando.", flags: MessageFlags.Ephemeral});
                return;
            }

            const url: string = ENV.RESTART_URL;
            const options = {method: "POST", headers: {"mp-key": ENV.RESTART_PASSWORDKEY}};

            const response: Response = await fetch(url, options);
            const data = await response.json();
            console.log(data);

            interaction.reply({content: "Ejecutado", flags: MessageFlags.Ephemeral});
        }
    }
];

for (let Index = 0; Index < CommandsDefinition.length; Index++) {
    const Command = CommandsDefinition[Index];
    Commands.set(Command.ID, Command);
}