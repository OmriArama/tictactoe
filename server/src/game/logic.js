const gameKey = (gameId) => `ttt:game:${gameId}`;
const updatesChannel = (gameId) => `ttt:game:${gameId}:updates`;

const emptyGame = (gameId) => ({
    id: gameId,
    board: Array(9).fill(null),
    players: { X: null, O: null },
    turn: "X",
    winner: null,
});

export const checkWinner = (board) => {
    const winConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6],
    ];

    for (const [a, b, c] of winConditions) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    return board.every(Boolean) ? "draw" : null;
};

export const joinGame = async (redis, gameId, connId) => {
    while (true) {
        await redis.watch(gameKey(gameId));

        const raw = await redis.get(gameKey(gameId));
        let game = raw ? JSON.parse(raw) : emptyGame(gameId);

        if (game.winner) {
            game = emptyGame(gameId);
        }

        if (game.players.X === connId) {
            await redis.unwatch();
            return { game, symbol: "X" };
        }
        if (game.players.O === connId) {
            await redis.unwatch();
            return { game, symbol: "O" };
        }

        let symbol = null;
        if (!game.players.X) symbol = "X";
        else if (!game.players.O) symbol = "O";
        else {
            await redis.unwatch();
            return { error: "Game full" };
        }

        game.players[symbol] = connId;

        const tx = redis.multi();
        tx.set(gameKey(gameId), JSON.stringify(game));

        const res = await tx.exec();
        if (!res) continue;

        await redis.publish(updatesChannel(gameId), JSON.stringify(game));

        return { game, symbol };
    }
};

export const removeFromGameRoom = (ws, gameSockets) => {
    const gameId = ws.gameId;
    if (!gameId) return;

    const set = gameSockets.get(gameId);
    if (!set) return;

    set.delete(ws);

    if (set.size === 0) {
        gameSockets.delete(gameId);
    }

    ws.gameId = null;
};

export const leaveGameAtomic = async (redis, gameId, connId) => {
    if (!gameId) return { error: "Missing gameId" };

    while (true) {
        await redis.watch(gameKey(gameId));

        const raw = await redis.get(gameKey(gameId));
        if (!raw) {
            await redis.unwatch();
            return { error: "Game not found" };
        }

        let game = JSON.parse(raw);

        let leaving = null;
        if (game.players?.X === connId) {
            leaving = "X";
        }
        else if (game.players?.O === connId) {
            leaving = "O";
        }

        if (!leaving) {
            await redis.unwatch();
            return { game, removed: false };
        }

        const remaining = leaving === "X" ? "O" : "X";

        if (!game.winner) {
            const remainingExists = Boolean(game.players?.[remaining]);
            game.winner = remainingExists ? remaining : "abandoned";
        }

        game.players[leaving] = null;

        const noPlayers = !game.players?.X && !game.players?.O;
        if (noPlayers) {
            game = emptyGame(gameId);
        }

        const tx = redis.multi();
        tx.set(gameKey(gameId), JSON.stringify(game));
        const res = await tx.exec();
        if (!res) continue;

        await redis.publish(updatesChannel(gameId), JSON.stringify(game));

        return { game, removed: true, leaving };
    }
};

export const applyMove = async (redis, gameId, connId, index) => {
    if (!gameId) return { error: "Missing gameId" };
    if (!Number.isInteger(index) || index < 0 || index > 8) {
        return { error: "Index must be an integer 0..8" };
    }

    while (true) {
        await redis.watch(gameKey(gameId));

        const raw = await redis.get(gameKey(gameId));
        if (!raw) {
            await redis.unwatch();
            return { error: "Game not found" };
        }

        const game = JSON.parse(raw);

        if (game.winner) {
            await redis.unwatch();
            return { error: "Game already ended" };
        }

        const symbol =
            game.players?.X === connId ? "X" :
                game.players?.O === connId ? "O" : null;

        if (!symbol) {
            await redis.unwatch();
            return { error: "You are not a player in this game" };
        }

        if (game.turn !== symbol) {
            await redis.unwatch();
            return { error: "Not your turn" };
        }

        if (game.board[index] !== null) {
            await redis.unwatch();
            return { error: "Cell already occupied" };
        }

        game.board[index] = symbol;

        const outcome = checkWinner(game.board);
        if (outcome) {
            game.winner = outcome;
        } else {
            game.turn = symbol === "X" ? "O" : "X";
        }

        const tx = redis.multi();
        tx.set(gameKey(gameId), JSON.stringify(game));
        const res = await tx.exec();

        if (!res) continue;

        await redis.publish(updatesChannel(gameId), JSON.stringify(game));

        return { game };
    }
};

export const gameChannels = {
    key: gameKey,
    updates: updatesChannel,
};
