/*==================================================
            Gmod Relay Discord - Node.js
==================================================*/

import { Client as _Client } from "discord.js"
import Express, { json } from "express"
import NodeCache from "node-cache"
import { request } from 'http'
import { ChannelId, Token, SteamKey, IP, Port } from "./config.json"



/*==========================
        Main Constants
==========================*/

const REST = Express()
const Cache = new NodeCache()
const Client = new _Client( { intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_WEBHOOKS"] })
const DateObj = new Date()

const LogType = {
	Discord: "\x1b[31m [Discord] \x1b[39m",
	Chat: "\x1b[36m [Chat] \x1b[39m",
    Rest: "\x1b[95m [REST] \x1b[39m",
    Error: "\x1b[31m [Error] \x1b[39m"
}



/*==========================
        Main Functions
==========================*/

var MessageList = []
var GDR = {}

GDR.GetTime = () => { return DateObj.getHours() + ":" + DateObj.getMinutes() + ":" + DateObj.getSeconds() }

GDR.WriteLog = (eLogType, sLogMessage) => {
    if (!eLogType in LogType)
        eLogType = LogType.Error

    var CurrentTime = GDR.GetTime()
    console.log(CurrentTime + " -" + eLogType + sLogMessage)
}



/*==========================
         Discord bot
==========================*/

var Webhook = null

GDR.CheckChannelPerms = (Channel) => {
    var ChannelPerms = Channel.guild.members.me.permissionsIn(Channel)

    if (!ChannelPerms.has("VIEW_CHANNEL"))
        throw new Error("not allowed to view channel")

    if (!ChannelPerms.has("MANAGE_WEBHOOKS"))
        throw new Error("not allowed to manage webhooks")

    if (!ChannelPerms.has("SEND_MESSAGES"))
        throw new Error("not allowed to send messages")
}

GDR.CheckMessage = (Message) => {
    if (Message.author.bot) return false
    if (Message.channelId != ChannelId) return false

    return true
}

GDR.SendMessage = async (sAvatarUrl, sName, sContent) => {
    if (sContent.length < 1)
        return

    Webhook.send({
        username: sName,
        content: sContent,
        avatarURL: sAvatarUrl
    })
}

GDR.SendMessageHook = async (img, name, text) => {
    if (text.length < 1)
        return

    Webhook.send({
        username: name,
        content: text,
        avatarURL: img
    })
}

GDR.OnReady = async () => {
    GDR.WriteLog(LogType.Discord, "client ready, initializing bot")

    var MsgChannel = Client.channels.cache.get(ChannelId)
    if (!MsgChannel) { throw new Error("invalid channel id") }

    GDR.WriteLog(LogType.Discord, "reading and sending messages to channel: " + MsgChannel.name)
    GDR.CheckChannelPerms(MsgChannel)

    var Webhooks = await MsgChannel.fetchWebhooks()

    GDR.WriteLog(LogType.Discord, "getting webhook")

    Webhook = Webhooks.find(TmpWebhook => TmpWebhook.name == "GDR")
    if (!Webhook) {
        GDR.WriteLog(LogType.Discord, "webhook does not exist, creating a new one")
        MsgChannel.createWebhook("GDR", {
            avatar: "",
            reason: "GM Discord Relay webhook"
        })
    }

    GDR.WriteLog(LogType.Discord, "bot ready")
}

GDR.OnMessage = (Message) => {
    if (!GDR.CheckMessage(Message)) return

    var sMsgUrl = Message.attachments.first()?.url ?? Message.stickers.first()?.url
    if (sMsgUrl && (sMsgUrl.endsWith(".jpg") || sMsgUrl.endsWith(".png"))) {
        GDR.WriteLog(LogType.Chat, Message.member.displayName + ": " +  Message.cleanContent + "\n" + sMsgUrl)
        MessageList.push([
            Message.member.displayName,
            Message.cleanContent + " " + sMsgUrl
        ])
        return
    }

    GDR.WriteLog(LogType.Chat, Message.member.displayName + ": " + Message.cleanContent)
    MessageList.push([
        Message.member.displayName,
        Message.cleanContent
    ])
}

GDR.OnError = (sError) => {
    GDR.WriteLog(LogType.Error, "client error:" + sError)
}

/*
    Discord bot
*/
Client.on("ready", GDR.OnReady)
Client.on("messageCreate", GDR.OnMessage)
Client.on("error", GDR.OnError)
Client.login(Token)

/*
    Steam avatar stuff
*/

GDR.GenerateReqOptions = (sSID64) => {
    return {
        hostname: "api.steampowered.com",
        path: "/ISteamUser/GetPlayerSummaries/v0002/?key=" + SteamKey + "&steamids=" + sSID64,
        method: "GET"
    }
}

GDR.RequestPromise = (ReqOptions) => {
    return new Promise( (Resolve, Reject) => {
        var sResponse = ""
        request(ReqOptions, Response => {
            Response.on("data", Data => {
                sResponse += Data
            })

            Response.on("end", () => {
                Resolve(JSON.parse(sResponse))
            })

            Response.on("error", sError => {
                GDR.WriteLog(LogType.Error, "steam api request failed:" + sError)
                Reject(sError)
            })
        }).end()
    })
}


GDR.GetAvatar = async (sSID64) => {
    var sAvatarURL = Cache.get(sSID64)
    if (sAvatarURL)
        return sAvatarURL

    var ReqOptions = GDR.GenerateReqOptions(sSID64)
    var ReqPromise = GDR.RequestPromise(ReqOptions)

    var Response = await ReqPromise
    Cache.set(sSID64, Response.response.players[0].avatarfull)
    return Response.response.players[0].avatarfull
}

/*
    Rest server
*/

REST.get("/getmessages", (Request, Response) => {
    if (Request.ip != IP) {
        Response.status(403).send("Forbidden")
        return
    }

    Response.send(JSON.stringify(MessageList))
    MessageList = []
})

REST.use(json())
REST.post("/sendmessage", async (Request, Response) => {
    if (Request.ip != IP) {
        Response.status(403).send("Forbidden")
        return
    }

    var MsgInfo = Request.body
    Response.end()

    var sAvatar = await GetAvatar(MsgInfo[0])
    SendMessage(sAvatar, MsgInfo[1], MsgInfo[2])
})

REST.post("/sendmessagehook", async (Request, Response) => {
    if (Request.ip != IP) {
        Response.status(403).send("Forbidden")
        return
    }

    var MsgInfo = Request.body
    Response.end()
    SendMessageHook(MsgInfo[0], MsgInfo[1], MsgInfo[2])
})

var Server = REST.listen(Port, () => {
    WriteLog(LogType.Rest, "server ready, listening on port " + Server.address().port)
})