import WebSocket from "ws";
import readline from "readline";

const serverUrl = process.argv[2] || process.env.TTT_SERVER || "ws://localhost:3000";
const gameId = process.argv[3] || process.env.TTT_GAME || "default";

let connId = null;
let symbol = null;
let game = null;
let prompting = false;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const renderBoard = (board = []) => {
    const cells = board.map((cell) => cell ?? " ");
    const rows = [
        `${cells[0]} | ${cells[1]} | ${cells[2]}`,
        `${cells[3]} | ${cells[4]} | ${cells[5]}`,
        `${cells[6]} | ${cells[7]} | ${cells[8]}`,
    ];
    return rows.join("\n---------\n");
};

const renderIndexBoard = () => {
    const rows = [
        `0 | 1 | 2`,
        `3 | 4 | 5`,
        `6 | 7 | 8`,
    ];
    return rows.join("\n---------\n");
};

const showStatus = (reason) => {
    if (!game) return;
    console.clear();
    console.log("TicTacToe CLI Client");
    console.log(`Server: ${serverUrl}`);
    console.log(`Game:   ${game.id}`);
    console.log(`You:    ${symbol ?? "?"}${connId ? ` (${connId})` : ""}`);
    console.log("\nIndex reference:\n");
    console.log(renderIndexBoard());
    if (reason) {
        console.log(`\n${reason}`);
    }
    console.log("\nBoard:\n");
    console.log(renderBoard(game.board));
    console.log("\nLegend: rows/cols are 0,1,2. Example input: \"1 2\" or \"5\".");

    if (game.winner) {
        if (game.winner === "draw") {
            console.log("\nResult: Draw.");
        } else {
            console.log(`\nResult: ${game.winner} wins.`);
        }
        console.log("Press Ctrl+C to exit.");
        return;
    }

    if (symbol && game.turn === symbol) {
        console.log(`\nYour turn (${symbol}).`);
    } else {
        console.log(`\nWaiting for opponent... (current turn: ${game.turn})`);
    }
};

const sendMove = (index) => {
    ws.send(JSON.stringify({ type: "move", gameId, index }));
};

const parseInputToIndex = (input) => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (/^\d$/.test(trimmed)) {
        return Number(trimmed);
    }
    const parts = trimmed.split(/\s+/).map(Number);
    if (parts.length === 2 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 2)) {
        const [row, col] = parts;
        return row * 3 + col;
    }
    return null;
};

const promptForMove = () => {
    if (!game || game.winner) return;
    if (!symbol || game.turn !== symbol) {
        prompting = false;
        return;
    }
    if (prompting) return;
    prompting = true;
    rl.question('\nEnter your move (row col) or index [0-8], or "q" to quit: ', (answer) => {
        prompting = false;
        const trimmed = answer.trim().toLowerCase();
        if (trimmed === "q" || trimmed === "quit" || trimmed === "exit") {
            console.log("Exiting...");
            ws.close();
            rl.close();
            return;
        }
        const idx = parseInputToIndex(answer);
        if (idx === null || idx < 0 || idx > 8) {
            console.log("Invalid input. Use \"row col\" (0-2) or a single index 0-8.");
            return promptForMove();
        }
        sendMove(idx);
    });
};

const handleGameUpdate = (nextGame, reason) => {
    game = nextGame;
    showStatus(reason);
    promptForMove();
};

const ws = new WebSocket(serverUrl);

ws.on("open", () => {
    console.log(`Connected to ${serverUrl}, joining game "${gameId}"...`);
    ws.send(JSON.stringify({ type: "join", gameId }));
});

ws.on("message", (data) => {
    let msg;
    try {
        msg = JSON.parse(data.toString());
    } catch {
        console.log("Received non-JSON message:", data.toString());
        return;
    }

    if (msg.type === "hello") {
        connId = msg.connId;
        return;
    }

    if (msg.type === "joined") {
        symbol = msg.symbol;
        handleGameUpdate(msg.game, "Joined game.");
        return;
    }

    if (msg.type === "update") {
        handleGameUpdate(msg.game, "Game updated.");
        return;
    }

    if (msg.type === "error") {
        console.log(`Error: ${msg.message}`);
        promptForMove();
        return;
    }

    console.log("Unknown message:", msg);
});

ws.on("close", () => {
    console.log("Disconnected from server.");
    rl.close();
});

ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
});

process.on("SIGINT", () => {
    console.log("\nClosing client...");
    ws.close();
    rl.close();
});

