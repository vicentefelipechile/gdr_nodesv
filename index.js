const Discord = require("discord.js");
const Express = require("express");
const REST = Express();
const http = require('http');
const NodeCache = require("node-cache")

const Cache = new NodeCache();
const Config = require("./config.json");
const Client = new Discord.Client( { intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_WEBHOOKS"] });
const DateObj = new Date();

var aMsgCache = [];

/*
    Logger
*/
const LogType = {
	Discord: "\x1b[31m [Discord] \x1b[39m",
	Chat: "\x1b[36m [Chat] \x1b[39m",
    Rest: "\x1b[95m [REST] \x1b[39m",
    Error: "\x1b[31m [Error] \x1b[39m"
};

function WriteLog( eLogType, sLogMessage ) {
	if (!eLogType in LogType)
		throw new error("invalid log type");

	var sHours = DateObj.getHours();
	var sMinutes = DateObj.getMinutes();
	var sSeconds = DateObj.getSeconds();
	console.log(sHours + ":" + sMinutes + ":" + sSeconds + " -" + eLogType + sLogMessage);
};

/*
    Webhook
*/
var Webhook = null;

const MentionRegex = new RegExp("@[^ ]+", "g");
async function SendMessage(sAvatarUrl, sName, sContent) {
    if (sContent.length < 1)
        return;

    Webhook.send({
        username: sName,
        content: sContent.replaceAll(MentionRegex, "<mention>"),
        avatarURL: sAvatarUrl
    });
}

/*
    Discord bot
*/
Client.on("ready", async () => {
    WriteLog(LogType.Discord, "client ready, initializing bot");

    var MsgChannel = Client.channels.cache.get(Config.ChannelId);
    
    if (!MsgChannel)
        throw new Error("invalid channel id");

    WriteLog(LogType.Discord, "reading and sending messages to channel: " + MsgChannel.name)

    var ChannelPerms = MsgChannel.guild.me.permissionsIn(MsgChannel);

    if (!ChannelPerms.has("VIEW_CHANNEL"))
        throw new error("not allowed to view channel");

    if (!ChannelPerms.has("MANAGE_WEBHOOKS"))
        throw new Error("not allowed to manage webhooks");

    if (!ChannelPerms.has("SEND_MESSAGES"))
        throw new Error("not allowed to send messages");

    var Webhooks = await MsgChannel.fetchWebhooks();

    WriteLog(LogType.Discord, "getting webhook");

    Webhook = Webhooks.find(TmpWebhook => TmpWebhook.name == "GDR");
    if (!Webhook) {
        WriteLog(LogType.Discord, "webhook does not exist, creating a new one");
        MsgChannel.createWebhook("GDR", {
            avatar: "",
            reason: "GM Discord Relay webhook"
        });
    };

    WriteLog(LogType.Discord, "bot ready");
});

Client.on("messageCreate", Message => {
    if (Message.author.bot) return;
    if (Message.channelId != Config.ChannelId) return;

    var sMsgUrl = Message.attachments.first()?.url;
    if (sMsgUrl && (sMsgUrl.endsWith(".jpg") || sMsgUrl.endsWith(".png"))) {
        WriteLog(LogType.Chat, Message.author.tag + ": " +  Message.content + "\n" + sMsgUrl);
        aMsgCache.push([
            Message.author.tag,
            Message.content + " " + sMsgUrl
        ]);
        return;
    }

    WriteLog(LogType.Chat, Message.author.tag + ": " + Message.content);
    aMsgCache.push([
        Message.author.tag,
        Message.content
    ]);
});

Client.on("error", (sError) => {
    WriteLog(LogType.Error, "client error:" + sError);
});

Client.login(Config.Token);

/*
    Steam avatar stuff
*/
async function GetAvatar(sSID64) {
    var sAvatarURL = Cache.get(sSID64);
    if (sAvatarURL)
        return sAvatarURL;

    var ReqOptions = {
        hostname: "api.steampowered.com",
        path: "/ISteamUser/GetPlayerSummaries/v0002/?key=" + Config.SteamKey + "&steamids=" + sSID64,
        method: "GET"
    };

    var ReqPromise = new Promise( (Resolve, Reject) => {
        var sResponse = "";
        http.request(ReqOptions, Response => {
            Response.on("data", Data => {
                sResponse += Data;
            });

            Response.on("end", () => {
                Resolve(JSON.parse(sResponse));
            });

            Response.on("error", sError => {
                WriteLog(LogType.Error, "steam api request failed:" + sError);
                Reject(sError);
            })
        }).end();
    });

    var Response = await ReqPromise;
    Cache.set(sSID64, Response.response.players[0].avatarfull);
    return Response.response.players[0].avatarfull;
};

/*
    Rest server
*/
REST.get("/getmessages", (Request, Response) => {
    if (Request.hostname != Config.SrcdsIp) {
        Response.end();
        return;
    };
    
    Response.send(JSON.stringify(aMsgCache));
    aMsgCache = [];
});

REST.use(Express.json())
REST.post("/sendmessage", async (Request, Response) => {
    if (Request.hostname != Config.SrcdsIp) {
        Response.end();
        return;
    };

    var MsgInfo = Request.body;
    Response.end();

    var sAvatar = await GetAvatar(MsgInfo[0]);
    SendMessage(sAvatar, MsgInfo[1], MsgInfo[2]);
});

var Server = REST.listen(Config.Port, () => {
    WriteLog(LogType.Rest, "server ready, listening on port " + Server.address().port);
});