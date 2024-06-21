import { ApplicationCommandData, ChatInputCommandInteraction, Collection } from "discord.js";
import { GDRClient } from ".";

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
    }
];

for (let Index = 0; Index < CommandsDefinition.length; Index++) {
    const Command = CommandsDefinition[Index];
    Commands.set(Command.ID, Command);
}