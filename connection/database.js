var MongoClient = require('mongodb').MongoClient;
f = require('util').format,
assert = require('assert')
function connectionDatabase() {
    return new Promise((resolve, reject) => {
        //var url  = 'mongodb://binance:binance2019readwrite@localhost:27017/?authMechanism=SCRAM-SHA-1&authSource=binance';
        var url = "mongodb://root:95bcqr1vizz@digiebot-shard-00-00-bhelp.mongodb.net:27017,digiebot-shard-00-01-bhelp.mongodb.net:27017,digiebot-shard-00-02-bhelp.mongodb.net:27017/test?ssl=true&replicaSet=Digiebot-shard-0&authSource=admin&retryWrites=true&w=majority";


            MongoClient.connect(url, { useNewUrlParser: true }, (err, client) => {
                assert.equal(null, err);
                if (err){
                    reject(err);
                }else{  
                const db = client.db('binance');
                resolve(db)
                }//End of  connection success
            });//End of Db Connection
    })//End of promise object
}//End of connectionDatabase

module.exports = connectionDatabase()


