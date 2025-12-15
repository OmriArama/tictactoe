// Room/subscription helpers for WebSocket game sessions.

export const broadcastToGame = (gameSockets, send, gameId, payload) => {
    const sockets = gameSockets.get(gameId);
    if (!sockets) return;
    for (const socket of sockets) {
        send(socket, payload);
    }
};

export const ensureSubscribed = async (
    sub,
    subscribedGames,
    gameUpdatesChannel,
    gameSockets,
    send,
    gameId,
) => {
    if (subscribedGames.has(gameId)) return;
    await sub.subscribe(gameUpdatesChannel(gameId), (raw) => {
        try {
            const game = JSON.parse(raw);
            broadcastToGame(gameSockets, send, gameId, { type: "update", game });
        } catch {
            // ignore bad payloads
        }
    });
    subscribedGames.add(gameId);
};

export const cleanupGameSubscription = async (
    sub,
    subscribedGames,
    gameSockets,
    gameUpdatesChannel,
    gameId,
) => {
    const sockets = gameSockets.get(gameId);
    if (sockets && sockets.size > 0) return;
    if (!subscribedGames.has(gameId)) return;
    await sub.unsubscribe(gameUpdatesChannel(gameId));
    subscribedGames.delete(gameId);
};

export const addToGameRoom = async (
    sub,
    subscribedGames,
    gameUpdatesChannel,
    gameSockets,
    send,
    ws,
    gameId,
) => {
    let sockets = gameSockets.get(gameId);
    if (!sockets) {
        sockets = new Set();
        gameSockets.set(gameId, sockets);
    }
    sockets.add(ws);
    await ensureSubscribed(sub, subscribedGames, gameUpdatesChannel, gameSockets, send, gameId);
};
