/*==================================================
            Gmod Relay Discord - Node.js
==================================================*/

import { Client, Events, GuildMember, GuildTextBasedChannel, Message, PermissionFlagsBits, PermissionsBitField, TextChannel, Webhook } from "discord.js"
import Express, { json } from "express"
import NodeCache from "node-cache"
import { RequestOptions, request } from 'http'
import { ChannelID, Token, SteamKey, IP, Port } from "./config.json"
import { URL } from "url"



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
        Main Functions
==========================*/

class GDRClient extends Client {
    constructor({ChannelID, Token, SteamKey, IP, Port}) {
        super({intents: ["Guilds", "GuildMessages", "GuildWebhooks"]});

        this.ChannelID = ChannelID;
        this.SteamKey = SteamKey;
        this.IP = IP;
        this.Port = Port;
    }

    public ChannelID: any;
    public SteamKey: any;
    public IP: any;
    public Port: any;
    public Webhook: Webhook;

    public GetTime(): string {
        return `${DateObj.getHours()}:${DateObj.getMinutes()}:${DateObj.getSeconds()}`
    }

    public WriteLog(type: LogType = LogType.Error, log: string): void {
        let CurrentTime = GDR.GetTime()
        console.log(CurrentTime + " -" + type + log)
    }

    public async CheckChannelPermissions(channel: GuildTextBasedChannel): Promise<void> {
        let myself: GuildMember = await channel.guild.members.fetchMe();
        let permissions: PermissionsBitField = channel.permissionsFor(myself);
        if (!permissions.has(PermissionFlagsBits.ViewChannel)) {
            throw new Error("Not allowed to view that channel");
        }

        if (!permissions.has(PermissionFlagsBits.ManageWebhooks)) {
            throw new Error("Not allowed to manage webhooks to that channel");
        }

        if (!permissions.has(PermissionFlagsBits.SendMessages)) {
            throw new Error("Not allowed to send messages to that channel");
        }
    }

    public CheckMessage(message: Message): boolean {
        if (message.author.bot) { return false; }
        if (message.channelId != this.ChannelID) { return false; }
        return true;
    }

    public SendMessage(imageURL: string, username: string, content: string): void {
        if (content.length <= 0) { return; }
        this.Webhook.send({username: username, content: content, avatarURL: imageURL});
    }

    public async GetSteamAvatar(id64) {
        let avatarURL = Cache.get(id64);
        if (avatarURL) { return avatarURL; }

        const RequestOptions = this.GenerateSteamUserRequest(id64);
        const RequestPromise = this.RequestPromise(RequestOptions);

        const Response = await RequestPromise as any;
        avatarURL = Response.response.players[0].avatarfull;
        Cache.set(id64, avatarURL)
        return avatarURL;
    }

    private GenerateSteamUserRequest(id64: any) {
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

let MessageList: string[][] = [];
const GDR = new GDRClient({ChannelID: ChannelID, IP: IP, Port: Port, SteamKey: SteamKey, Token: Token});

GDR.on(Events.ClientReady, async() => {
    GDR.WriteLog(LogType.Discord, "Client is ready, initializing the bot");

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
    GDR.WriteLog(LogType.Discord, `Reading and seending messages from channel: ${channel.name}`);
    GDR.CheckChannelPermissions(channel);

    const Webhooks = await channel.fetchWebhooks();
    GDR.WriteLog(LogType.Discord, `Getting Webhook`);

    let Webhook = Webhooks.find((hook) => { hook.name === "GDR"; });
    if (!Webhook) {
        GDR.WriteLog(LogType.Discord, `The Webhook doesn't exists, creating a new one`);
        Webhook = await channel.createWebhook({name: "GDR", reason: "GM Discord Relay Webhook"});
    }
    GDR.Webhook = Webhook;
    GDR.WriteLog(LogType.Discord, `The Bot is ready`)
});

GDR.on(Events.MessageCreate, async (message) => {
   if (!GDR.CheckMessage(message)) { return; }
   
   const Author = await message.member?.fetch(true);
    if (!Author) { return; }

   let fileURL = message.attachments.first()?.url ?? message.stickers.first()?.url;
   if (fileURL && (fileURL.endsWith(`.jpg`) || fileURL.endsWith(`.jpeg`) || fileURL.endsWith(`.png`) || fileURL.endsWith(`.gif`))) {
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

/*==========================
         Discord bot
==========================*/
GDR.login(Token);

REST.get("/getmessages", (Request: { ip: any }, Response: { status: (arg0: number) => { (): any; new(): any; send: { (arg0: string): void; new(): any } }; send: (arg0: string) => void }) => {
    if (Request.ip != IP) {
        Response.status(403).send("Forbidden");
        return;
    }

    Response.send(JSON.stringify(MessageList));
    MessageList = [];
})

REST.use(json())
REST.post("/sendmessage", async (Request: { ip: any; body: any }, Response: { status: (arg0: number) => { (): any; new(): any; send: { (arg0: string): void; new(): any } }; end: () => void }) => {
    if (Request.ip != IP) {
        Response.status(403).send("Forbidden");
        return;
    }

    var MsgInfo = Request.body;
    Response.end();

    var sAvatar = await GDR.GetSteamAvatar(MsgInfo[0]) as string;
    GDR.SendMessage(sAvatar, MsgInfo[1], MsgInfo[2]);
})

REST.post("/sendmessagehook", async (Request: { ip: any; body: any }, Response: { status: (arg0: number) => { (): any; new(): any; send: { (arg0: string): void; new(): any } }; end: () => void }) => {
    if (Request.ip != IP) {
        Response.status(403).send("Forbidden");
        return;
    }

    var MsgInfo = Request.body;
    Response.end();
    GDR.SendMessage(MsgInfo[0], MsgInfo[1], MsgInfo[2]);
})

const Server = REST.listen(Port, () => {
    GDR.WriteLog(LogType.Rest, `Server ready, listening on port ${Server.address().port}`);
})