import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import crypto from "crypto";
import { redisConnect } from "./redis/client.js";
import * as gameBL from "./game/logic.js";
import { parseMessage } from "./ws/messages.js";
import { addToGameRoom, broadcastToGame, cleanupGameSubscription, ensureSubscribed } from "./ws/rooms.js";

const portArg = Number(process.argv[2]);
const PORT = (Number.isFinite(portArg) && portArg > 0 ? portArg : null) || process.env.PORT || 3000;

const redis = await redisConnect();
const sub = redis.duplicate();
await sub.connect();

const server = http.createServer();
const wss = new WebSocketServer({ server });

const gameSockets = new Map();
const subscribedGames = new Set();
const gameUpdatesChannel = (gameId) => `ttt:game:${gameId}:updates`;

const send = (ws, payload) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
};

wss.on("connection", (ws) => {
    ws.connId = crypto.randomUUID();
    ws.gameId = null;
    ws.symbol = null;

    send(ws, { type: "hello", connId: ws.connId, serverPort: PORT });

    ws.on("message", async (buffer) => {
        let message;
        try {
            message = JSON.parse(buffer.toString());
        } catch {
            return send(ws, { type: "error", message: "Invalid JSON" });
        }

        const parsed = parseMessage(ws, message);
        if (parsed.error) {
            return send(ws, { type: "error", message: parsed.error });
        }

        if (parsed.action === "join") {
            const { gameId } = parsed.payload;
            const result = await gameBL.joinGame(redis, gameId, ws.connId);
            if (result.error) {
                return send(ws, { type: "error", message: result.error });
            }
            ws.gameId = gameId;
            ws.symbol = result.symbol;
            await addToGameRoom(sub, subscribedGames, gameUpdatesChannel, gameSockets, send, ws, gameId);
            send(ws, { type: "joined", symbol: result.symbol, game: result.game });
            broadcastToGame(gameSockets, send, gameId, { type: "update", game: result.game });
            return;
        }

        if (parsed.action === "move") {
            const { gameId, index } = parsed.payload;
            const result = await gameBL.applyMove(redis, gameId, ws.connId, index);
            if (result.error) {
                return send(ws, { type: "error", message: result.error });
            }
            broadcastToGame(gameSockets, send, gameId, { type: "update", game: result.game });
            return;
        }
    });

    ws.on("close", async () => {
        const gameId = ws.gameId;
        gameBL.removeFromGameRoom(ws, gameSockets);
        await cleanupGameSubscription(sub, subscribedGames, gameSockets, gameUpdatesChannel, gameId);

        if (gameId) {
            const result = await gameBL.leaveGameAtomic(redis, gameId, ws.connId);
            if (result.error) {
                return send(ws, { type: "error", message: result.error });
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`TicTacToe server listening on ${PORT}`);
});
