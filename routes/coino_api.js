var express = require('express');
var router = express.Router();
var request = require('request');
const conn = require('../connection/database');
ObjectID = require('mongodb').ObjectID;
var app = express();


router.post('/coin_data', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let coin = post_data['coin'];
		let starttime = new Date(post_data['starttime']);
		let endtime = new Date(post_data['endtime']);
		let collection_name = "trade_data_"+ coin +"_jan_june_2019";
		conn.then(async db=>{
			let where_json = {"coin": coin, "created_date": {$gte: starttime, $lte: endtime}};
			db.collection(collection_name).find(where_json).toArray(function(err, result){
				if (err) throw err;
				if(result.length > 0){
					res.send({"success": "true", "data": result ,"message": "data fetched successfully"});
				} else{
					res.send({"success": "false", "message": "No data available. Try a different starttime and endtime"})
				}
			});

		})
	}

})

router.get('/last_inserted_time/:coin_pair/:limit/:sort_bool', function(req, res, next){
	let coin = req.params.coin_pair;
	let limit = parseInt(req.params.limit);
	let sort_bool = parseInt(req.params.sort_bool);
	if(limit == undefined){
		limit = 1;
	}
	if(sort_bool == undefined){
		sort_bool  = -1;
	}
	if(coin == undefined){
		coin = "TRXBTC";
	}
	let collection_name = "trade_data_"+ coin +"_jan_june_2019";
	console.log(coin, "===> coin");
	conn.then(async db=>{
		let sort_json = {"inserted_time": sort_bool};
		db.collection(collection_name).find({}).sort(sort_json).limit(limit).toArray(function(err, result){
			if (err) throw err;
			if(result.length > 0){
				res.send({"success": "true", "data": result, "message": "data_fetched"});
			} else{
				res.send({"success": "false", "message": "data not found or there is try with different parameter values"})
			}
		});
	})
})

Date.prototype.addHours= function(h){
    this.setHours(this.getHours()+h);
    return this;
}

module.exports = router;
