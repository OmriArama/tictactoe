import { createClient } from "redis";

const client = createClient({
    username: "default",
    password: "lPbJgbH6mDbhkB5qbJsHkid4il2OEvqf",
    socket: {
        host: "redis-15625.c309.us-east-2-1.ec2.cloud.redislabs.com",
        port: 15625,
    },
});

export const redisConnect = async () => {
    await client.connect();
    return client;
};

export const getClient = async () => {
    if (client.isReady) return client;
    return redisConnect();
};
