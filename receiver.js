var can = require('socketcan');
var channel = can.createRawChannel("can0", true);
// Log any message
channel.addListener("onMessage", function(msg) {
   console.log(msg.data.toString());
} );

// Reply any message
channel.addListener("onMessage", channel.send, channel);

channel.start();
