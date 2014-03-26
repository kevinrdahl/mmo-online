ABOUT:
======
MMO online is functionally an MMO RTS. It is the #1 man vs bear RTS off the market, and is climbing in marketshare every day. Literally multiples of users log on weekly to see what kind of changes Kevin has made. They are typically few.

The client is a simple HTML5 page housing a canvas and a chat. The game is pure Javascript, communicating with JSON messages via websocket.

The server runs on node.js, and thus is also Javascript.

It is intended that the server will store data using MongoDB, making this the most Javascripty game ever created. The sanity of such an endeavour is admittedly questionable.


SETUP:
======
1. Place server.js in the install folder of node.js, and run node on it.
2. Put the contents of the public folder in the root folder of an HTTP server.
3. Make sure all the URLs match up, and it's up. Easy.
