var bufferpack = require('bufferpack');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3001;
var can = require('socketcan');
var channel = can.createRawChannel("can1", true);

const Influx = require('influx');
const influx = new Influx.InfluxDB({
    host: 'localhost',
    port: '8086',
    database: 'measurements_logs',
    schema: [
        {
            measurement: 'sensor',
            fields: {
                value: Influx.FieldType.FLOAT,
                tag: Influx.FieldType.STRING
            },
            tags: ['device']
        }
    ]
});

influx.getDatabaseNames()
.then(names => {
    // console.log(names);
    if (!names.includes('measurements_logs')) {
        return influx.createDatabase('measurements_logs');
    }
});






app.get('/', function(req, res){
  res.sendFile(__dirname + '/web/index.html');
});

io.on('connection', function(socket){
  console.log('socket connected');

  socket.on('chat message', function(msg){
	console.log(msg);
	var canId = 0xf0;
        var data = Buffer.from(msg);

	var tempValue = [20];
	var humidityValue = [10];
	var presureValue = [5];

	var packedTemperature = bufferpack.pack('<l', tempValue);
	var packedHumidity = bufferpack.pack('<I', humidityValue);
	var packedPreasure = bufferpack.pack('<I', presureValue);

	channel.send({ id: canId, length: packedPreasure.length, data: packedPreasure, ext: false })
	channel.send({ id: canId+1, length: packedTemperature.length, data: packedTemperature, ext: false })
	channel.send({ id: canId+2, length: packedHumidity.length, data: packedHumidity, ext: false })

        console.log("send->", msg);
	io.emit('chat message',msg);
  });
});


function postInflux(field,value){

influx.writePoints([
    {
        measurement: 'sensor',
        fields: {
           value: value
        },
        tags: { device: field}
    }
], {
    database: 'measurements_logs',
})
.then(() => {
    return influx.query(`
        select * from sensor
  `)
}).then(rows => {
   // console.log(rows);
    // rows.forEach(row => console.log(`A request to ${row.path} took ${row.duration}ms`))
})
.catch(error => {
    console.error(`Error saving data to InfluxDB! ${err.stack}`)
});

}

// Log any message
channel.addListener("onMessage", function(msg) {
//   io.emit('chat message', msg.data.toString('hex'));
   console.log("receive->", msg.id, msg.data.toString('hex'));

   if (msg.id == 0xf2) {
      var unpackedHumidity = bufferpack.unpack('<I', msg.data, 0);
      io.emit('chat message',"humidity: "+(unpackedHumidity[0]/1024));
      postInflux('humidity',(unpackedHumidity/1024));
   } else if (msg.id == 0xf1) {
     var unpackedTemperature = bufferpack.unpack('<l', msg.data, 0);
     io.emit('chat message', "temperature: "+(unpackedTemperature[0]/100));
     postInflux('temperature',(unpackedTemperature[0]/100))
   } else if (msg.id == 0xf0) {
     var unpackedPresure = bufferpack.unpack('<I', msg.data, 0);
     io.emit('chat message',"pressure: "+(unpackedPresure[0]/10000));
     postInflux('pressure',(unpackedPresure[0]/10000))
   }
});

channel.start();

http.listen(port, function(){
  console.log('listening on *:' + port);
});