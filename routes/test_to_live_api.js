var express = require('express');
var router = express.Router();
var request = require('request');
const conn = require('../connection/database');
ObjectID = require('mongodb').ObjectID;
var app = express();


router.post('/historical_candles', function(req, res, next){ //to get historical candles
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	console.log(post_data, "===> post_data")
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let coin = String(post_data['coin']);
		let timestampDate = new Date(post_data['hour']);
		//timestampDate.setHours(timestampDate.getHours() - 4);
		conn.then(async db=>{
			let where_json = {"coin": coin, "timestampDate": timestampDate};
			console.log(where_json, "===> where_json")
			let query = db.collection('market_chart').find(where_json).toArray(function(err, data){
				if (err) throw err;
				if(data.length > 0){
					res.send({"success": "true", "coin": coin , "message": "Candle for timestampDate " +timestampDate+ " has been fetched successfully", "data": data[0]})
				} else{
					res.send({"success": "false", "coin": coin , "data_length": data.length, "message": "Candle was not found for timestampDate " +timestampDate+" ..."});
				}
			})
		}).catch(err=>{
			res.send({"success": "false", "message": "Database connection error", "error": err});
		})
	}
})


router.post('/historical_coinmeta', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let coin = String(post_data['coin']);
		let start_hour = new Date(post_data['hour']);
		console.log(start_hour, "===> start_hour")
		
		let end_hour = new Date(start_hour);
		end_hour.setHours(23,59,59,999);
		end_hour.setHours(end_hour.getHours() - 5); //as it is GMT timezone so we need to subtract 5 hours from it
		console.log(end_hour, "===> end_hour");

		conn.then(async db=>{
			let query = db.collection("coin_meta_history").find({"coin": coin, "modified_date": {$gte: start_hour, $lte: end_hour}}).toArray(function(err, data){
				if (err) throw err;
				if(data.length > 0){
					console.log(data, "===> data");
					res.send({"success": "true", "data_length": data.length, "coin": coin , "message": "coin meta for hour " + start_hour + " has been fetched successfully", "data": data});
				} else{
					res.send({"success": "false", "coin": coin , "data_length": data.length, "message": "coin meta for hour " + start_hour + " cannot be found in coin_meta_history collection"})
				}
			})
		}).catch(err=>{
			res.send({"success": "false", "message": "there is a database connection issue", "err": err});
		})
	}
})


router.post('/get_market_trades', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let coin = String(post_data['coin']);
		let start_hour = new Date(post_data['hour']);
		console.log(start_hour, "===> start_hour")
		
		let end_hour = new Date(start_hour);
		end_hour.setHours(23,59,59,999);
		end_hour.setHours(end_hour.getHours() - 5); //as it is GMT timezone so we need to subtract 5 hours from it
		console.log(end_hour, "===> end_hour");

		conn.then(async db=>{
			let query = db.collection("market_trade_history").find({"coin": coin, "created_date": {$gte: start_hour, $lte: end_hour}}).toArray(function(err, data){
				if (err) throw err;
				if(data.length > 0){
					console.log(data, "===> data");
					res.send({"success": "true", "data_length": data.length, "coin": coin , "message": "market trade history for hour " + start_hour + " has been fetched successfully", "data": data});
				} else{
					res.send({"success": "false", "coin": coin , "data_length": data.length, "message": "market trade history for hour " + start_hour + " cannot be found in market_trade_history collection"})
				}
			})
		}).catch(err=>{
			res.send({"success": "false", "message": "there is a database connection issue", "err": err});
		})
	}
})

router.post('/get_market_prices', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let coin = String(post_data['coin']);
		let start_hour = new Date(post_data['hour']);
		console.log(start_hour, "===> start_hour")
		
		let end_hour = new Date(start_hour);
		end_hour.setHours(23,59,59,999);
		end_hour.setHours(end_hour.getHours() - 5); //as it is GMT timezone so we need to subtract 5 hours from it
		console.log(end_hour, "===> end_hour");

		conn.then(async db=>{
			let query = db.collection("market_price_history").find({"coin": coin, "time": {$gte: start_hour, $lte: end_hour}}).toArray(function(err, data){
				if (err) throw err;
				if(data.length > 0){
					console.log(data, "===> data");
					res.send({"success": "true", "data_length": data.length, "coin": coin , "message": "market price history for hour " + start_hour + " has been fetched successfully" , "data": data});
				} else{
					res.send({"success": "false", "coin": coin , "data_length": data.length, "message": "market price history for hour " + start_hour + " cannot be found in market_price_history collection"})
				}
			})
		}).catch(err=>{
			res.send({"success": "false", "message": "there is a database connection issue", "err": err});
		})
	}
})


router.post('/get_market_depth', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let coin = String(post_data['coin']);
		let start_hour = new Date(post_data['hour']);
		console.log(start_hour, "===> start_hour")
		
		let end_hour = new Date(start_hour);
		end_hour.setHours(23,59,59,999);
		end_hour.setHours(end_hour.getHours() - 5); //as it is GMT timezone so we need to subtract 5 hours from it
		console.log(end_hour, "===> end_hour");

		conn.then(async db=>{
			let query = db.collection("market_depth_history").find({"coin": coin, "created_date": {$gte: start_hour, $lte: end_hour}}).toArray(function(err, data){
				if (err) throw err;
				if(data.length > 0){
					console.log(data, "===> data");
					res.send({"success": "true", "data_length": data.length, "coin": coin , "message": "market depth history for hour " + start_hour + " has been fetched successfully" , "data": data});
				} else{
					res.send({"success": "false", "coin": coin , "data_length": data.length, "message": "market depth history for hour " + start_hour + " cannot be found in market_depth_history collection"})
				}
			})
		}).catch(err=>{
			res.send({"success": "false", "message": "there is a database connection issue", "err": err});
		})
	}
})


router.get('/get_current_candle_1hr/:c', function(req, res, next){
	let coin = String(req.params.c).toUpperCase();
	console.log(coin);
	let url_a = "https://api.binance.com/api/v1/klines?symbol="+String(coin)+"&interval=1h&limit=1"
	console.log(url_a, "===> url_a")
	request(url_a, (err, response, result) => {
	  if (err) { return console.log(err); res.send({"success": "false", "message": "there is some sort of error, try legit coin pair..."}) }
	  console.log(typeof(result));

	  result = JSON.parse(result);

	 
	  let return_json = {};
	  return_json["openTime"] = result[0][0];
	  return_json["open"] = result[0][1];
	  return_json["high"] = result[0][2];
	  return_json["low"] = result[0][3];
	  return_json["close"] = result[0][4];
	  return_json["volume"] = result[0][5];
	  return_json["closeTime"] = result[0][6];

	  console.log(return_json, "===> return_json");
	  res.send({"success": "true", "data": return_json, "message": "current candle has been fetched successfully"});
	});
})
module.exports = router;