
// Parse and validate inbound messages; no business logic here.
export const parseMessage = (ws, message) => {
    if (message.type === "join") {
        const gameId = String(message.gameId || "");
        if (!gameId) return { error: "Missing gameId" };
        return { action: "join", payload: { gameId } };
    }

    if (message.type === "move") {
        const gameId = String(message.gameId || ws.gameId || "");
        if (!gameId) return { error: "Missing gameId" };
        const index = message.index;
        return { action: "move", payload: { gameId, index } };
    }

    return { error: "Unknown message type" };
};
