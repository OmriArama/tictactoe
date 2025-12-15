HOW TO RUN THE PROGRAM:
============


1. install dependencies
2. open two clients/terminals
3. type cd /src
4. type `node server 3000` for the first server
5. type `node server 3001` for the second server

Redis DB details remain in code for purpose so you can check easily, the DB will be deleted later on.


Architecture:
============

This server uses both websocket, to notify the clients about changes instantly, but also uses Redis as a single source of truth.
When the user connects to a server (with an game id) he will assigned into the game (if there is a place for him) and will be subbed to it.
As mentioned the game current state is saved in redis, this helps us manage multiple server instances and let users that are connected to different servers play against each other, Everytime a user sends a move message we will save it to the state on Redis (after we verify that the message is from the correct play and is a legal move).


AI USAGE:
============

I used AI in various ways:
1. As an consultant on the various ways I can implement the solution, after talking I was convinced to use redis as my source of truth.
2. I used it to help me write the game functions, but I changed some of the implementation because I didn't like how it wrote it (I changed naming, and seperated some logic into different functions/files)




