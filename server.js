var bufferpack = require('bufferpack');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3001;
var can = require('socketcan');
var channel = can.createRawChannel("can0", true);


const BOILER_MESSAGE_ID = 0x0d0;

const HUMIDITY_MESSAGE_ID = 0xf2;
const TEMPERATURE_MESSAGE_ID = 0xf1;
const PREASURE_MESSAGE_ID = 0xf0;

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
  	
	/*
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
	*/

	const tempBuffer = msg.split(':');
	console.log('tempBuffer', tempBuffer);

	const id = parseInt(tempBuffer[0], 16);
	console.log('id', id);
	const message = tempBuffer[1];
	console.log('message', message);

	if (message) {
		const messageArray = [];
	
		for (let i = 0; i < 8; i++) {
			const firstPart = message[i*2] || '0';
			const secondPart = message[i*2 +1] || '0';
			messageArray.push(parseInt(firstPart + secondPart, 16));
		}

		const messageBuffer = Buffer.from(messageArray);
		const packedMessage = bufferpack.pack('BBBB', messageBuffer);	

		console.log('packedMessage', packedMessage);	
		channel.send({ id, length: packedMessage.length, data: packedMessage, ext: false });	

		console.log("send->", msg);
  		io.emit('chat message',msg);
	}
  });
});


function postInflux(field,value){
  influx.writePoints(
    [
      {
          measurement: 'sensor',
          fields: {
             value: value
          },
          tags: { device: field}
      }
    ],
    {
        database: 'measurements_logs',
    })
    .then(() => {
        // return influx.query(`select * from sensor`)
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
   io.emit('chat message', `id:${msg.id.toString(16)} m:${msg.data.toString('hex')}`);
   console.log('id->', msg.id.toString(16), "receive->", msg.id, msg.data.toString('hex'));


  if (msg.id == HUMIDITY_MESSAGE_ID) {
    var unpackedHumidity = bufferpack.unpack('<I', msg.data, 0);
    io.emit('chat message',"humidity: "+(unpackedHumidity[0]/1024));
    postInflux('humidity',(unpackedHumidity/1024));
  } else if (msg.id == TEMPERATURE_MESSAGE_ID) {
    var unpackedTemperature = bufferpack.unpack('<l', msg.data, 0);
    io.emit('chat message', "temperature: "+(unpackedTemperature[0]/100));
    postInflux('temperature',(unpackedTemperature[0]/100))
  } else if (msg.id == PREASURE_MESSAGE_ID) {
    var unpackedPresure = bufferpack.unpack('<I', msg.data, 0);
    io.emit('chat message',"pressure: "+(unpackedPresure[0]/10000));
    postInflux('pressure',(unpackedPresure[0]/10000))

  } else if (msg.id == BOILER_MESSAGE_ID) {
    const unpackedBoilerTemperature = bufferpack.unpack('<f', msg.data, 0);
    io.emit('chat message',"boilerTemperature: " + (unpackedBoilerTemperature[0]));
    postInflux('boilerTemperature', unpackedBoilerTemperature[0])
  }
});

channel.start();

http.listen(port, function(){
  console.log('listening on *:' + port);
});
