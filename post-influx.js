const Influx = require('influx');
const influx = new Influx.InfluxDB({
    host: 'localhost',
    port: '8086',
    database: 'measurements_logs',
    schema: [
        {
            measurement: 'sensor',
            fields: {
                temperature: Influx.FieldType.FLOAT,
                humidity: Influx.FieldType.FLOAT,
                pressure: Influx.FieldType.FLOAT
            },
            tags: ['device'],
        },
    ]
});

influx.getDatabaseNames()
.then(names => {
    // console.log(names);
    if (!names.includes('measurements_logs')) {
        return influx.createDatabase('measurements_logs');
    }
})
var data = {};
data.temp = 1.2;
data.humidity = 2.3;
data.pressure = 4.5;
influx.writePoints([
    {
        measurement: 'sensor',
        fields: {
            temperature: data.temp,
            humidity: data.humidity,
            pressure: data.pressure,
        },
        tags: { device: 1 },
    }
], {
    database: 'measurements_logs',
})
.then(() => {
    return influx.query(`
        select * from sensor
  `)
}).then(rows => {
    console.log(rows);
    // rows.forEach(row => console.log(`A request to ${row.path} took ${row.duration}ms`))
})
.catch(error => {
    console.error(`Error saving data to InfluxDB! ${err.stack}`)
});
