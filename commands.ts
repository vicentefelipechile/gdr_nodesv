import { ApplicationCommandData, AttachmentBuilder, ChatInputCommandInteraction, Collection, EmbedBuilder } from "discord.js";
import { GDRClient, PlayerStatusInfo, ServerStatus } from ".";

interface CommandRunOptions {client: GDRClient, interaction: ChatInputCommandInteraction}
type CommandExecuteFunction = (options: CommandRunOptions) => Promise<any>;
export type GDRCommand = {
    ID: string,
    Data: ApplicationCommandData,
    Execute: CommandExecuteFunction,
}

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
            let hostname: string = ServerStatus.hostname;
            let hostaddress: string = ServerStatus.hostaddress;
            let gamemode: string = ServerStatus.gamemode;
            let map: string = ServerStatus.map;
            let players: PlayerStatusInfo[] = ServerStatus.players;
            let maxplayers: number = ServerStatus.maxplayers;
            let meta: any[] = ServerStatus.meta;

            let description: string[] = [
                `### ${hostname}`,
                `**${gamemode} - ${map}**`,
                ``,
                `${players.length}/${maxplayers} players`,
                `\`\`\``
            ];

            players.sort((a, b) => a.score - b.score);
            for (let index = 0; index < players.length; index++) {
                const player: PlayerStatusInfo = players[index];
                let seconds = player.time % 60;
                let minutes = (player.time / 60) % 60;
                let hours = (player.time / 60) / 60;
                let time = `${hours.toFixed(0)}h ${minutes.toFixed(0)}m ${seconds.toFixed(0)}s`;

                let prefix = player.bot ? `[BOT] ` : ``;
                let status = `${prefix}<${player.usergroup}> ${player.name} - ${player.score} Score - ${time}`;
                description.push(status);
            }

            if (players.length <= 0) {
                description.push(`No one is currently playing`);
            }

            description.push(`\`\`\``);
            description.push(`***${hostaddress}***`);

            let mapAttachment: AttachmentBuilder = new AttachmentBuilder(`https://fastdl.mapping-latam.cl/assets/img/maps/${map}.png`, {name: `${map}.png`});
            interaction.reply({content: `${description.join(`\n`)}`, files: [mapAttachment]});
        }
    }
];

for (let Index = 0; Index < CommandsDefinition.length; Index++) {
    const Command = CommandsDefinition[Index];
    Commands.set(Command.ID, Command);
}