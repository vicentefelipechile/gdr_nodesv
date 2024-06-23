import { ApplicationCommandData, GuildMember, ChatInputCommandInteraction, Collection, EmbedBuilder } from "discord.js";
import { GDRClient, PlayerStatusInfo, ServerStatus, GmodCommands } from ".";

interface CommandRunOptions {client: GDRClient, interaction: ChatInputCommandInteraction}
type CommandExecuteFunction = (options: CommandRunOptions) => Promise<any>;
export type GDRCommand = {
    ID: string,
    Data: ApplicationCommandData,
    Execute: CommandExecuteFunction,
}



/* CUSTOM FUNCTIONS - Sorry Lugent */

function FormatTime(PlayerTime: number): string {
    const cuttime = (PlayerTime / 60)

    let seconds = PlayerTime % 60;
    let minutes = (cuttime) % 60;
    let hours = (cuttime) / 60;

    return `${hours.toFixed(0)}h ${minutes.toFixed(0)}m ${seconds.toFixed(0)}s`;
}

/* CUSTOM FUNCTIONS - Sorry Lugent */



export const Commands: Collection<string, GDRCommand> = new Collection<string, GDRCommand>();
const CommandsDefinition: GDRCommand[] = [
    {
        ID: "ping",
        Data: {
            name: "ping",
            description: "Ping test!"
        },
        async Execute({client, interaction}) {
            await interaction.deferReply({ephemeral: true});
            interaction.editReply({content: `📡 ${client.ws.ping}ms`, options: {ephemeral: true}});
        }
    },
    {
        ID: "status",
        Data: {
            name: "status",
            description: "Gets the current state of the server (players, round information, etc)"
        },
        async Execute({client, interaction}) {
            // Embed
            const ServerInfoEmbed = new EmbedBuilder()
            .setColor("#00ADFF")

            let hostname: string = ServerStatus.hostname;
            let hostaddress: string = ServerStatus.hostaddress;
            let gamemode: string = ServerStatus.gamemode;
            let map: string = ServerStatus.map;
            let players: PlayerStatusInfo[] = ServerStatus.players;
            let maxplayers: number = ServerStatus.maxplayers;
            let meta: any[] = ServerStatus.meta;

            let ServerDescription: string = `\`\`\`
Mapa: ${map}
Jugadores: ${players.length}/${maxplayers} players
Modo de juego: ${gamemode}
\`\`\``

            let ServerPlayers: string = `\`\`\``

            if (players.length <= 0) {
                ServerPlayers = ServerPlayers.concat(`\nNo one is currently playing`);
            } else {
                players.sort((a, b) => a.score - b.score);
                for (let index = 0; index < players.length; index++) {
                    const player: PlayerStatusInfo = players[index];
                    let time = FormatTime(player.time)

                    let prefix = player.bot ? `[BOT] ` : ``;
                    let status = `\n${prefix}<${player.usergroup}> ${player.name} - ${player.score} Score - ${time}`;
                    ServerPlayers = ServerPlayers.concat(status);
                }
            }

            ServerPlayers = ServerPlayers.concat(`\n\`\`\``);

            
            ServerInfoEmbed.setThumbnail(`https://fastdl.mapping-latam.cl/assets/img/maps/${map}.png`)
            ServerInfoEmbed.setFooter({ "text": `${hostaddress}` })
            ServerInfoEmbed.addFields(
                { "name": "Servidor", "value": ServerDescription },
                { "name": "Jugadores", "value": ServerPlayers }
            )

            interaction.reply({content: `# ${hostname}`, embeds: [ServerInfoEmbed]});
        }
    },
    {
        ID: "command",
        Data: {
            name: "command",
            description: "Send a command to gmod server"
        },
        async Execute({client, interaction}) {
            // Verificar si el usuario tiene el rol requerido
            const requiredRoleID = "884222069032759302"; // Reemplaza esto con el ID de tu rol
            const member = interaction.member as GuildMember;
            
            if (!member.roles.cache.has(requiredRoleID)) {
                interaction.reply({content: "No tienes permiso para usar este comando.", ephemeral: true});
                return;
            }

            const command = interaction.options.getString("command") ?? "none"
            if ( command === "none" ) {
                interaction.reply({content: "No"})
                return;
            }

            GmodCommands.command = command
            interaction.reply({content: "Listo"})
        }
    }
];

for (let Index = 0; Index < CommandsDefinition.length; Index++) {
    const Command = CommandsDefinition[Index];
    Commands.set(Command.ID, Command);
}