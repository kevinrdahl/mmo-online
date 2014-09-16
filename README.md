MMO Online
======
MMO online is functionally an MMO RTS. It is the #1 man vs bear RTS off the market, and is climbing in marketshare every day. Literally multiples of users log on once in a while to see what kind of changes Kevin has made. They are typically few.

The client is a simple HTML5 page housing a canvas and a chat. The game is pure Javascript, communicating with the server via JSON messages over WebSocket.

The server runs on node.js, and thus is also Javascript.

It is intended that the server will store data using MongoDB, making this the most Javascripty game ever created. The sanity of such an endeavour is admittedly questionable.


## Setup:
1. Made sure node.js is installed, with the 'ws' package.
2. ``node server.js``
3. Either run ``node fileserver.js`` to access via port 9000, or place the contents of the 'public' folder in the root of an HTTP server.
4. Some URLs are still hard coded. Make sure those line up.
5. The file version tracker is still pretty lame right now. Add 'load=all' to the URL if things aren't working.
