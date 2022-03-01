var MongoClient = require('mongodb').MongoClient;
f = require('util').format,
assert = require('assert')
function connectionDatabase() {
    return new Promise((resolve, reject) => {



        // var url = "mongodb://root:95bcqr1Vizz@digiebot-shard-00-00-bhelp.mongodb.net:27017,digiebot-shard-00-01-bhelp.mongodb.net:27017,digiebot-shard-00-02-bhelp.mongodb.net:27017/test?ssl=true&replicaSet=Digiebot-shard-0&authSource=admin&retryWrites=true&w=majority";
        var url = "mongodb://FrontendAPP:huAcTbOY5016VIoR@digiebot-shard-00-00-bhelp.mongodb.net:27017,digiebot-shard-00-01-bhelp.mongodb.net:27017,digiebot-shard-00-02-bhelp.mongodb.net:27017/test?ssl=true&replicaSet=Digiebot-shard-0&authSource=admin&retryWrites=true&w=majority";


            MongoClient.connect(url, { useNewUrlParser: true }, (err, client) => {
                assert.equal(null, err);
                if (err){
                    reject(err);
                }else{
                const db = client.db('binance');
                console.log("Database connected successfully...")
                console.log(`HTTPS is running on the port 3010`)
                resolve(db)
                }//End of  connection success
            });//End of Db Connection
    })//End of promise object
}//End of connectionDatabase

function localConnectionDatabase() {
    return new Promise((resolve, reject) => {
        // var url = "mongodb://localhost";

        // MongoClient.connect(url, { useNewUrlParser: true }, (err, client) => {
        //     assert.equal(null, err);
        //     if (err) {
        //         reject(err);
        //     } else {
        //         const db = client.db('localBinance');
        //         resolve(db)
        //     }//End of  connection success
        // });//End of Db Connection

        resolve(true)
    })//End of promise object
}//End of connectionDatabase


module.exports = {
    'connectionDatabase': connectionDatabase(),
    'localConnectionDatabase': localConnectionDatabase()
}


