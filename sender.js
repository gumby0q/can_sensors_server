var can = require('socketcan');
var channel = can.createRawChannel("can1", true);

// Reply any message
var canId = 233688064;
var data = Buffer.from(new Date().toLocaleString().toString());

var index = 0;
setInterval(function(){
	var data = Buffer.from(index+"");
	channel.send({ id: canId, length: data.length, data: data, ext: true })
	console.log("send->",index);
	index++;
}, 1000);

channel.addListener("onMessage", function(msg) {
   console.log("receive->",msg);
});


channel.start();
