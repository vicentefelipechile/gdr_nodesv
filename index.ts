/*==================================================
            Gmod Relay Discord - Node.js
                 TypeScript Edition
==================================================*/

import { ApplicationCommandDataResolvable, Client, Collection, Events, Guild, GuildMember, GuildTextBasedChannel, Interaction, Message, PermissionFlagsBits, PermissionsBitField, TextChannel, Webhook } from "discord.js"
import Express, { json } from "express"
import NodeCache from "node-cache"
import { RequestOptions, request } from 'http'
import { ChannelID, Token, SteamKey, IP, Port } from "./config.json"
import { URL } from "url"
import { Commands, GDRCommand } from "./commands"


/*==========================
        Main Constants
==========================*/

const REST = Express();
const Cache = new NodeCache();
const DateObj = new Date();
enum LogType {
	Discord = "\x1b[31m [Discord] \x1b[39m",
	Chat = "\x1b[36m [Chat] \x1b[39m",
	Rest = "\x1b[95m [REST] \x1b[39m",
	Error = "\x1b[31m [Error] \x1b[39m"
}


/*==========================
        Main Class
==========================*/

export class GDRClient extends Client {
    public constructor({ChannelID, SteamKey}) {
        super({
            allowedMentions: {repliedUser: false, parse: []},
            intents: ["Guilds", "GuildMessages", "GuildWebhooks", "MessageContent"]},
        );
        this.ChannelID = ChannelID;
        this.SteamKey = SteamKey;
    }

    public Commands: Collection<string, GDRCommand> = Commands;
    public ChannelID: string;
    public SteamKey: string;
    public Webhook: Webhook;

    public GetTime(): string {
        return `${DateObj.getHours()}:${DateObj.getMinutes()}:${DateObj.getSeconds()}`
    }

    public WriteLog(type: LogType = LogType.Error, log: string): void {
        let CurrentTime = GDR.GetTime()
        console.log(CurrentTime + " -" + type + log)
    }

    /**
     * Check if on the specified channel have permissions to view, manage webhooks and send messages
     * @param channel 
     * @returns boolean
     */
    public async CheckChannelPermissions(channel: GuildTextBasedChannel): Promise<boolean> {
        let myself: GuildMember = await channel.guild.members.fetchMe();
        let permissions: PermissionsBitField = channel.permissionsFor(myself);
        if (!permissions.has(PermissionFlagsBits.ViewChannel)) {
            GDR.WriteLog(LogType.Error, "Not allowed to view that channel");
            return false;
        }

        if (!permissions.has(PermissionFlagsBits.ManageWebhooks)) {
            GDR.WriteLog(LogType.Error, "Not allowed to manage webhooks to that channel");
            return false;
        }

        if (!permissions.has(PermissionFlagsBits.SendMessages)) {
            GDR.WriteLog(LogType.Error, "Not allowed to send messages to that channel");
            return false;
        }
        return true;
    }

    public CheckMessage(message: Message): boolean {
        if (message.author.bot) { return false; }
        if (message.channelId != this.ChannelID) { return false; }
        return true;
    }

    public SendMessage(imageURL: string, username: string, content: string): void {
        if (!this.Webhook) { return; }
        if (content.length <= 0) { return; }
        this.Webhook.send({username: username, content: content, avatarURL: imageURL});
    }

    public async GetSteamAvatar(id64: string): Promise<string> {
        let avatarURL = Cache.get(id64) as string;
        if (avatarURL) { return avatarURL; }

        const RequestOptions = this.GenerateSteamUserRequest(id64);
        const RequestPromise = this.RequestPromise(RequestOptions);

        const Response = await RequestPromise as any;
        avatarURL = Response.response.players[0].avatarfull;
        Cache.set(id64, avatarURL)
        return avatarURL;
    }

    private GenerateSteamUserRequest(id64: string): RequestOptions {
        return {
            hostname: `api.steampowered.com`,
            path: `/ISteamUser/GetPlayerSummaries/v0002/?key=${this.SteamKey}&steamids=${id64}`,
            method: `GET`
        }
    }

    private RequestPromise(RequestOptions: string | RequestOptions | URL): Promise<unknown> {
        return new Promise((Resolve, Reject): void => {
            let Result: string = "";
            request(RequestOptions, (Response) => {
                Response.on("data", (Data) => { Result += Data; });
                Response.on("end", () => { Resolve(JSON.parse(Result)); });
                Response.on("error", (Error) => {
                    this.WriteLog(LogType.Error, `Steam API request failed: ${Error}`);
                    Reject(Error);
                })
            }).end();
        });
    }
}

export type PlayerStatusInfo = {
    name: string,
    usergroup: string,
    score: number,
    time: number,
    bot: boolean
}

export type ServerStatusInfo = {
    hostname: string,
    hostaddress: string,
    gamemode: string,
    map: string,
    players: PlayerStatusInfo[],
    maxplayers: number,
    meta: any[]
}

export let ServerStatus: ServerStatusInfo;
let MessageList: string[][] = [];
const GDR = new GDRClient({ChannelID: ChannelID, SteamKey: SteamKey});

process.on("unhandledRejection", (error) => {
    GDR.WriteLog(LogType.Error, `Unhandled Rejection`);
    GDR.WriteLog(LogType.Error, `${error}`);
});

/*==========================
         Discord bot
==========================*/

GDR.on(Events.ClientReady, async(): Promise<void> => {
    GDR.WriteLog(LogType.Discord, `Client is ready as ${GDR.user.displayName}, initializing the bot`);

    let channel: TextChannel = await GDR.channels.cache.get(GDR.ChannelID)?.fetch(true) as TextChannel;
    if (!channel) {
        throw new Error("Invalid specified Channel ID");
    }

    if (channel.isDMBased()) {
        throw new Error("Specified Channel ID is a Direct Message channel, not a Guild channel");
    }

    if (!channel.isTextBased()) {
        throw new Error("Specified Channel ID is not a Guild Text-based channel, impossible to read/send messages there");
    }
    GDR.WriteLog(LogType.Discord, `Reading and sending messages from channel: ${channel.name}`);
    if (!GDR.CheckChannelPermissions(channel)) { return; };

    const Webhooks = await channel.fetchWebhooks();
    GDR.WriteLog(LogType.Discord, `Getting Webhook`);
    
    let Webhook: Webhook|void = Webhooks.find((hook) => hook.name === "GDR");
    if (!Webhook) {
        GDR.WriteLog(LogType.Discord, `The Webhook doesn't exists, creating a new one`);
        Webhook = await channel.createWebhook({name: "GDR", reason: "GM Discord Relay Webhook"});
    }
    GDR.Webhook = Webhook;

    let commands: ApplicationCommandDataResolvable[] = [];
    GDR.WriteLog(LogType.Discord, `Getting Commands`);

    GDR.Commands.forEach((Command: GDRCommand) => {
        commands.push(Command.Data);
    });

    GDR.guilds.cache.forEach(async (guild: Guild) => {
        await guild.commands.set(commands);
    });

    GDR.WriteLog(LogType.Discord, `The Bot is ready`)
});

GDR.on(Events.InteractionCreate, async (interaction: Interaction): Promise<void> => {
    if (!interaction.inGuild()) { return; }
    if (!interaction.isChatInputCommand()) { return; }
    
    let Command: GDRCommand|void = GDR.Commands.get(interaction.commandName);
    if (!Command) { return; }

    Command.Execute({client: GDR, interaction: interaction}).catch((Error: Error) => {
        GDR.WriteLog(LogType.Error, `Failed during execution of /${interaction.commandName}`);
        GDR.WriteLog(LogType.Error, `${Error}`);
    });
})

GDR.on(Events.MessageCreate, async (message: Message): Promise<void> => {
    if (!GDR.CheckMessage(message)) { return; }
   
    const Author = await message.member?.fetch(true);
    if (!Author) { return; }

    let fileURL: string = message.attachments.first()?.url ?? message.stickers.first()?.url;
    if (fileURL) {
        GDR.WriteLog(LogType.Chat, `${Author.displayName}: ${message.cleanContent}\n${fileURL}`);
        MessageList.push([Author.displayName, `${message.cleanContent}\n${fileURL}`]);
        return;
    }
    GDR.WriteLog(LogType.Chat, `${Author.displayName}: ${message.cleanContent}`);
    MessageList.push([Author.displayName, `${message.cleanContent}`]);
});

GDR.on(Events.Error, (error) => {
    GDR.WriteLog(LogType.Error, `Client Error: ${error}`);
});

GDR.login(Token);



/*==========================
          SERVER
==========================*/

REST.get("/getmessages", async (Request, Response): Promise<void> => {
    const ipAddress = Request.ip.match(/(?:[0-9]{1,3}\.){3}[0-9]{1,3}/)[0];
    if (ipAddress != IP) {
        Response.status(403).send("Forbidden");
        return;
    }

    Response.send(JSON.stringify(MessageList));
    MessageList = [];
});

REST.use(json());
REST.post("/sendmessage", async (Request, Response): Promise<void> => {
    const ipAddress = Request.ip.match(/(?:[0-9]{1,3}\.){3}[0-9]{1,3}/)[0];
    if (ipAddress != IP) {
        Response.status(403).send("Forbidden");
        return;
    }

    let MsgInfo = Request.body;
    Response.end();

    let sAvatar = await GDR.GetSteamAvatar(MsgInfo[0]) as string;
    GDR.SendMessage(sAvatar, MsgInfo[1], MsgInfo[2]);
});

REST.post("/sendmessagehook", async (Request, Response): Promise<void> => {
    const ipAddress = Request.ip.match(/(?:[0-9]{1,3}\.){3}[0-9]{1,3}/)[0];
    if (ipAddress != IP) {
        Response.status(403).send("Forbidden");
        return;
    }

    let MsgInfo = Request.body;
    Response.end();
    GDR.SendMessage(MsgInfo[0], MsgInfo[1], MsgInfo[2]);
});

REST.post("/status", async(Request, Response): Promise<void> => {
    const ipAddress = Request.ip.match(/(?:[0-9]{1,3}\.){3}[0-9]{1,3}/)[0];
    if (ipAddress != IP) {
        Response.status(403).send("Forbidden");
        return;
    }

    let StatusInfo = Request.body;
    ServerStatus = StatusInfo as ServerStatusInfo;
    Response.end();
});

const Server = REST.listen(Port, () => {
    GDR.WriteLog(LogType.Rest, `Server ready, listening on port ${Port}`);
})
