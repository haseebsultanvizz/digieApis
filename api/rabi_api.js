var express = require('express');
var router = express.Router();
var request = require('request');
const conn = require('../connection/database');
ObjectID = require('mongodb').ObjectID;
var md5 = require('md5');
var app = express();

/* GET home page. */
router.get('/usd_btc_ticker', function(req, res, next) {
	let btc_price = get_btc_price();
	console.log(btc_price, "===> btc_price");
	btc_price.then(btc_price_resolved => {
		console.log(btc_price_resolved, "===> btc_price_resolved")
		let btc_price_resolved_casted = parseFloat(btc_price_resolved);
		res.send({"success":"true","btc_usd": btc_price_resolved_casted});
	})
});

global.promiseArray = []; // Holds array of promised to be resolved later

router.get('/get_coins', function(req, res, next){ //APi to get all coins in binance database and coins collections
	conn.then(db=>{
		db.collection('coins').find({}).toArray(function(err, data){
			if (err) throw err;
			if(data.length > 1){
				let final_data_arr = [];
				data.forEach(async data_element=>{
					if(data_element["user_id"] == "global"){
						if(['XRPBTC', "XLMBTC", "LTCBTC", "ETCBTC", "EOSBTC", "ETHBTC"].includes(data_element['symbol'])){
							final_data_arr.push(data_element);
						}
					}
				})
				if(final_data_arr.length > 0){
					res.status(200).send({
						"success": true,
						"data": final_data_arr,
						"data_length": final_data_arr.length,
						"message": "Coins data successfully fetched..."
					})
				} else{
					res.status(404).send({"success": "false", "message": "Required data not found..."})
				}
			} else{
				res.status(400).send({
					"success": false,
					"message": "No data found. Request was unsuccessful"
				})
			}
		})
	}).catch(err=>{
		console.log(err);
		res.status(500).send({
			success: "false",
			message: "Could not connect to the database"
		})
	})
}) 


	
router.post('/min_notation', function(req, res, next) {
	let coin_symbol = req.body.coin;
	if(coin_symbol === undefined){
		res.send({"success":"false", "reason": "Please pass coin symbol in the request body"});
	}
	console.log(coin_symbol, "===> coin_symbol")
	conn.then(db=> {
		let min_notation_query = db.collection('market_min_notation').find({"symbol": coin_symbol}).toArray();
		min_notation_query.then(min_notation_resolved => {
			if(min_notation_resolved.length > 0){
				console.log(min_notation_resolved, "min_notation_resolved")
				let min_notation_1 = parseFloat(min_notation_resolved[0].min_notation);
				let min_notation = min_notation_1.toFixed(8);
				console.log(min_notation, "===> min_notation")
				res.send({"success":"true","min_notation": parseFloat(min_notation)});
			} else{
				res.send({"success": "false", "reason": "coin symbol does not exist in the database"})
			}
		})
	}).catch(err => {
		res.send({"Success": "false", "reason": "database connection error"})
	})
})


router.post('/add_buy_order', function(req, res, next) {
	var created_date = new Date().addHours(4);
	let buy_order_client_json = req.body;

	console.log(buy_order_client_json, "===> buy_order_client_json")
	//res.send(buy_order_client_json)
	// Data ready to insert
	var data_to_insert = {};
	data_to_insert['price'] = buy_order_client_json.price;
	data_to_insert['quantity'] = buy_order_client_json.quantity;
	data_to_insert['symbol'] = buy_order_client_json.coin;
	data_to_insert['order_type'] = buy_order_client_json.order_type;
	data_to_insert['admin_id'] = buy_order_client_json.admin_id;
	data_to_insert['trigger_type'] = buy_order_client_json.trigger_type;
	data_to_insert['application_mode'] = buy_order_client_json.application_mode;
	data_to_insert['created_date'] = created_date;
	data_to_insert['modified_date'] = created_date;
	data_to_insert['status'] = "new";

	console.log(data_to_insert, " data_to_insert ===> data_to_insert in the very start")

	//Data to analyze
	let is_submitted = "no";
	let trail_check = buy_order_client_json.trail_check;
	if(trail_check != undefined){
		if(trail_check == "yes"){
				data_to_insert['trail_check'] = 'yes';
				data_to_insert['trail_interval'] = buy_order_client_json.trail_interval;
				data_to_insert['buy_trail_price'] = buy_order_client_json.buy_trail_price; //trail_interval percent of current market price
				data_to_insert['status'] = 'new';
		} else if(trail_check == "no"){
			data_to_insert['trail_check'] = 'no';
			data_to_insert['trail_interval'] = 0;
			data_to_insert['buy_trail_price'] = 0;
			data_to_insert['status'] = 'new';
		}
	}

	let auto_sell = buy_order_client_json.auto_sell;
	if(auto_sell == 'yes'){
		data_to_insert['auto_sell'] = 'yes';
	} else{
		data_to_insert['auto_sell'] = 'no';
	}

	var buy_order_id;
	console.log(data_to_insert, "===> data_to_insert");
	conn.then(db => {
		db.collection('buy_orders').insertOne(data_to_insert, function(err, doc){
			console.log(doc.insertedId, "===> doc");
			buy_order_id = doc.insertedId;
			console.log(buy_order_id, "===> buy_order_id inside code block");
			let temp_data_to_insert = {};
			if(auto_sell == "yes"){
				let profit_type = buy_order_client_json.profit_type;
				let autoLTH = buy_order_client_json.autoLTH;
				let sell_trail_check = buy_order_client_json.sell_trail_check;
				let stop_loss = buy_order_client_json.stop_loss;

				temp_data_to_insert['buy_order_id'] = buy_order_id;//ID of the previous inserted buy order
				temp_data_to_insert['profit_type'] = buy_order_client_json.profit_type;
				
				temp_data_to_insert['order_type'] = buy_order_client_json.sell_order_type;
				temp_data_to_insert['trail_check'] = buy_order_client_json.sell_trail_check;
				temp_data_to_insert['stop_loss'] = buy_order_client_json.stop_loss;
				
				temp_data_to_insert['admin_id'] = buy_order_client_json.admin_id;
				temp_data_to_insert['application_mode'] = buy_order_client_json.application_mode;
				temp_data_to_insert['created_date'] = created_date;

				if(autoLTH == "yes"){
					temp_data_to_insert['autoLTH'] = buy_order_client_json.autoLTH;
				}

				if(profit_type == "percentage"){
					temp_data_to_insert['profit_percent'] = buy_order_client_json.sell_profit_percent;
				} else if(profit_type == "fixed_price"){
					temp_data_to_insert['profit_price'] = buy_order_client_json.sell_profit_price;
				}

				if(sell_trail_check == "yes"){
					temp_data_to_insert['trail_interval'] = buy_order_client_json.sell_trail_interval;
				}

				if(stop_loss == "yes"){
					temp_data_to_insert['loss_percentage'] = buy_order_client_json.loss_percentage;
				}

				console.log(buy_order_client_json, "===> buy_order_client_json")
				console.log(temp_data_to_insert, "===> temp_data_to_insert")


				//Insert data in Mongo Collection
				db.collection('temp_sell_orders').insertOne(temp_data_to_insert, function(err1, doc1){
					if (err1) 
						console.log(err1);
					else{
						console.log(doc1.insertedId, "==> document inserted in test_temp_sell_orders");
						//Order History Log
						let log_msg = "Buy order was created at price " + String(buy_order_client_json.price);
						if(auto_sell == 'yes' && buy_order_client_json.sell_profit_percent != ''){
							log_msg += ' with auto sell ' + buy_order_client_json.sell_profit_percent + ' %';
						}
						log_msg += " From new front end";
						console.log(buy_order_id, "===> buy_order_id");
						console.log(log_msg, "===> log_msg");
						console.log(created_date, "===> created_date")
						console.log(buy_order_client_json.admin_id, "===> buy_order_client_json.admin_id")
						db.collection('order_history_log').insertOne({"buy_order_id": buy_order_id, "log_msd": log_msg, "created_date": created_date, "admin_id": buy_order_client_json.admin_id}, function(err2, doc2){
							if (err2)
								console.log(err2, " error in inserting test_order_history_log");
							else{
								console.log(doc2.insertedId, " order history log inserted in test_order_history_log collection");
								res.send({"success": "true", "buy_orders_id":buy_order_id, "temp_sell_orders_data_id": doc1.insertedId, "order_log_history_id": doc2.insertedId});
							}
						});
					}
						
				});// End of Insertion in test_temp_sell_orders
			}// if auto_sell yes
			else if(auto_sell == "no"){
				res.send({"success": "true", "buy_orders_data":buy_order_id, "message": "data inserted_successfully"});
			}
			
		});
	}).catch(err => {
		res.send({"success": "false", "reason": "database connection error"});
	})
})


router.post('/buy_order_trigger', function(req, res, next){
	var post_data = req.body;
	console.log(post_data, "===> post_data");
	// if(typeof(req.body) == )
	// let keys_array = Object.keys(req.body);
	// if(req.body == {}){
	//}
	var un_limit_child_orders;
	if(typeof(post_data['un_limit_child_orders']) === undefined){
		un_limit_child_orders = "no";
	}
	var created_date = new Date().addHours(4);
	console.log(created_date, "===> created_date");
	var admin_id = post_data['admin_id'];
	let order_mode_first_index = "";
	if(post_data.order_mode != ""){
		order_mode_first_index = String(post_data.order_mode);
		order_mode_first_index = order_mode_first_index.split('_')[0];
		console.log(order_mode_first_index, "===> order_mode_first_index");
	}
	var application_mode = "";
	application_mode = order_mode_first_index;

	var inactive_time_new;
	if(post_data['inactive_time'] != "" && post_data['inactive_time'] != undefined){
		inactive_time_new = new Date(post_data['inactive_time']);
		inactive_time_new.setMinutes(00);
		inactive_time_new.setSeconds(00);
		inactive_time_new.setMilliseconds(000);
	}
	

	let buy_one_tip_above = post_data.buy_one_tip_above;
	if(post_data['buy_one_tip_above'] == undefined){
		buy_one_tip_above = "not";
	}
	let sell_one_tip_below = post_data.sell_one_tip_below;
	if(post_data['sell_one_tip_below'] ==  undefined){
		sell_one_tip_below = 'not';
	}
	conn.then(db=>{
		let current_market_price_query = db.collection('market_prices').find({'coin': String(post_data['coin'])}).sort({"created_date": -1}).limit(1).toArray();
		current_market_price_query.then(current_market_price_query_resolved => {
			console.log(post_data['coin'], "===> coin");
			console.log(current_market_price_query_resolved, "===> current_market_price_query_resolved")
			let data_to_insert = {};
			data_to_insert['price'] = "";
			data_to_insert['quantity'] = post_data.quantity;
			data_to_insert['symbol'] = post_data.coin;
			data_to_insert['order_type'] = post_data.order_type;
			data_to_insert['admin_id'] = post_data.admin_id;
			data_to_insert['created_date'] = created_date;
			data_to_insert['trail_check'] = "";
			data_to_insert['trail_check'] = "";
			data_to_insert['trail_interval'] = "";
			data_to_insert['buy_trail_price'] = "";
			data_to_insert['status'] = "";
			data_to_insert['auto_sell'] = "";
			data_to_insert['makret_value'] = "";
			data_to_insert['binance_order_id'] = "";
			data_to_insert['is_sell_order'] = "";
			data_to_insert['sell_order_id'] = "";
			data_to_insert['trigger_type'] = post_data.trigger_type;
			data_to_insert['application_mode'] = application_mode;
			data_to_insert['order_mode'] = post_data.order_mode;
			data_to_insert['modified_date'] = created_date;
			data_to_insert['pause_status'] = 'play';
			data_to_insert['parent_status'] = 'parent';
			data_to_insert['defined_sell_percentage'] = post_data.defined_sell_percentage;
			data_to_insert['buy_one_tip_above'] = buy_one_tip_above;
			data_to_insert['sell_one_tip_below'] = sell_one_tip_below;
			data_to_insert['order_level'] = post_data.order_level;
			data_to_insert['current_market_price'] = current_market_price_query_resolved[0]['price'];
			data_to_insert['custom_stop_loss_percentage'] = post_data.custom_stop_loss_percentage;
			data_to_insert['stop_loss_rule'] = post_data.stop_loss_rule;
			data_to_insert['activate_stop_loss_profit_percentage'] = post_data.activate_stop_loss_profit_percentage;
			data_to_insert['lth_functionality'] = post_data.lth_functionality;
			data_to_insert['lth_profit'] = post_data.lth_profit;
			data_to_insert['un_limit_child_orders'] = post_data.un_limit_child_orders;
			if(inactive_time_new != undefined){
				data_to_insert['inactive_time'] = inactive_time_new;
			}
			db.collection('buy_orders').insertOne(data_to_insert, function(err, data){
				if (err) throw err;
				console.log("Digie Auto order inserted in Database");
				res.send({"success": "true", "message": "Digie Auto Order inserted in database", "data": data_to_insert});
			}).catch(err=>{
				console.log(err, " error in buy_orders_trigger");
				res.send({"success": "false", "message": "There is a problem in inserting Digie auto order values into database"});
			})
		})
	})
})


router.post('/update_buy_order_trigger', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let auto_order_id = new ObjectID(String(post_data._id));
		let data_to_update = post_data;
		delete data_to_update._id;
		conn.then(async db=>{
			let where_json = {"_id": auto_order_id};
			let update_json = {$set: data_to_update};
			db.collection('buy_orders').updateOne(where_json, update_json, function(err, obj){
				if (err) throw err;
				if(obj.result.nModified > 0){
					console.log("Auto order with auto order id " + auto_order_id + " has been updated");
					res.send({"success": "true", "message": "Auto order with auto order id " + auto_order_id + " has been updated successfully"});
				}else{
					if(obj.result.n == 0){
						console.log("Order ID " + auto_order_id + " is wrong and doesn't exist");
						res.send({"success": "false", "message": "Order ID " + auto_order_id + " is wrong and doesn't exist"});
					}
					if(obj.result.n > 0){
						console.log(obj, "==> matched but couldn't update");
						res.send({"success": "false", "message": "auto order id " + auto_order_id + " was matched but errored while updating! Make sure you're updating existing fields"});
					}
					
				}
			})
		})

	} 
})

router.post('/dashboard_api', function(req, res, next){

})


router.post('/get_orders_post', function(req, res, next){
	conn.then(db=>{

	
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{

		let old_status = post_data['status'];
		let admin_id = post_data['admin_id'];
		let application_mode = post_data['application_mode'];
		let page = post_data['page'];
		let filter_array = post_data['filter'];
		let status;
		let count_of_orders_promise;
		let perPage_limit = 20;
		let search_array = {};
		let coin_array = filter_array['filter_coin'];
		let order_type;
		let order_level;
		let filter_trigger;
		let start_date;
		let end_date;
		let cursor;
		let cursor2;
		let total_orders_count_promise;
		

		console.log(coin_array, " ===> coin_array")

		if(page == ""){
			 page = 1;
		}

		if(old_status != ""){
			status = old_status;
			count_of_orders_promise = count_orders(status, application_mode, admin_id, filter_array);
		}

		count_of_orders_promise.then(async count_of_orders_promise_resolved => {
			//var total_pages = count_of_orders_promise_resolved;


			if(status == "open" || status == "sold"){
				if(status == "open"){
					search_array['status'] = "FILLED";
					search_array['is_sell_order'] = "yes";
				} else if(status == "sold"){
					search_array['status'] = "FILLED";
					search_array['is_sell_order'] = 'sold';
				}
			} 
			else if(status == "parent"){
				search_array['parent_status'] = 'parent';
				search_array['status'] = 'new';
				console.log(search_array, "===> search_array")
			} else if(status == "lth"){
				search_array['status'] = 'lth';
			} else if(status == 'new'){
				search_array['status'] = 'new';
				search_array['parent_status'] = {$ne: 'parent'};
			} else if(status == 'all'){
				search_array['status'] = {$in: ['error', 'canceled', 'submitted']};
				search_array['price'] = {$ne: ''};
			} else{
				search_array['status'] = status;
			}

			search_array["application_mode"] = application_mode;
			search_array['admin_id'] = admin_id;
			if(Object.keys(filter_array).length > 0){
				if(filter_array['filter_coin'] != ""){
					symbol = filter_array['filter_coin'];
					search_array['symbol'] = {$in: coin_array};
					console.log(search_array, "===> search_array");
				}
				if(filter_array['filter_type'] != ""){
					order_type = filter_array['filter_type'];
					search_array['order_type'] = order_type;
				}
				if(filter_array['filter_level'] != ""){
					order_level = filter_array['filter_level'];
					search_array['order_level'] = order_level;
				}
				if(filter_array['filter_trigger'] != ""){
					filter_trigger = filter_array['filter_trigger'];
					search_array['trigger_type'] = filter_trigger;
				}
				if(filter_array['start_date'] != "" && filter_array['end_date'] != ""){
					start_date = new Date(filter_array['start_date']);
					end_date = new Date(filter_array['end_date']);
					order_type = filter_array['filter_type'];
					search_array['created_date'] = {$gte: start_date, $lte: end_date};
				}
			}
			console.log(search_array, "===> search_array of api")
			
			let final_orders_query_resolved = await db.collection('buy_orders').find(search_array).limit(perPage_limit).skip((perPage_limit * page) - perPage_limit).toArray();

			let order_count = await db.collection('buy_orders').count(search_array);
			let total_pages = Math.round(order_count / perPage_limit);

				//console.log(final_orders_query_resolved, "===> final_orders_query_resolved")
				
				if(final_orders_query_resolved.length > 0){

					// function calculate_amount_and_resolve_promises(final_orders_query_resolved){
					// 	return new Promise(function (resolve, reject){

					// 		})
					// }//

					let array_response = [];
					let btc_price = await get_btc_price();
					final_orders_query_resolved.forEach(async final_orders_element => {


						let pulled_quantity = final_orders_element['quantity'];

						let pulled_coin_symbol = final_orders_element['symbol'];
						let market_price_array = await db.collection('market_prices').find({"coin": pulled_coin_symbol}).sort({"created_date": -1}).limit(1).toArray();

						let market_price = market_price_array[0]['price'];

						console.log(market_price, "===> market_price and btc_price ===> ", btc_price);
						let amount_in_usd = pulled_quantity * market_price * btc_price;

						console.log(amount_in_usd, "===> amount_in_usd")
						final_orders_element['amount_in_usd'] = amount_in_usd;

						console.log(final_orders_element, "===> final_orders_element")

						array_response.push(final_orders_element);
						//console.log(array_response, "===> array_response inside scope")
					})

				console.log(await array_response, "==> array_response outside scope")
				
				res.send({"success": "true", "data": final_orders_query_resolved, "data_length": final_orders_query_resolved.length, "total_pages": total_pages  ,"message": "Orders fetched successfully"});
				} else{
					res.send({"success": "false", "message":"No data found"});
				}
			
			
		})// async function
	}

	})
})

router.get('/test', function(req, res, next) {
  conn.then(async db=>{
        let result= await db.collection('buy_orders').find({}).limit(1).toArray()
        res.json({"result": result})
  }) 
});





function count_orders(status, application_mode, admin_id, filter_array){
	return new Promise(function(resolve, reject){
		 conn.then(db=>{
			let search_array = {};
			search_array['admin_id'] = admin_id;
			search_array['application_mode'] = application_mode;
			let coin_array = filter_array['filter_coin'];
			let order_type;
			let order_level;
			let filter_trigger;
			let start_date;
			let end_date;
			let cursor;
			let cursor2;
			let total_orders_count_promise;

			console.log(status," ------- " , application_mode," ------- " , admin_id, " ------- " ,filter_array)



			if(Object.keys(filter_array).length > 0){
				if(filter_array['filter_coin'] != ""){
					symbol = filter_array['filter_coin'];
					search_array['symbol'] = {$in: coin_array};
					console.log(search_array, "===> search_array");
				}
				if(filter_array['filter_type'] != ""){
					order_type = filter_array['filter_type'];
					search_array['order_type'] = order_type;
				}
				if(filter_array['filter_level'] != ""){
					order_level = filter_array['filter_level'];
					search_array['order_level'] = order_level;
				}
				if(filter_array['filter_trigger'] != ""){
					filter_trigger = filter_array['filter_trigger'];
					search_array['trigger_type'] = filter_trigger;
				}
				if(filter_array['start_date'] != "" && filter_array['end_date'] != ""){
					start_date = new Date(filter_array['start_date']);
					end_date = new Date(filter_array['end_date']);
					order_type = filter_array['filter_type'];
					search_array['created_date'] = {$gte: start_date, $lte: end_date};
				}
			}

			if(status == "open" || status == "sold"){
				if(status == "open"){
					search_array['status'] = "FILLED";
					search_array['is_sell_order'] = "yes";
					cursor = db.collection('buy_orders').count(search_array);
				} else if(status == "sold"){
					search_array['status'] = "FILLED";
					search_array['is_sell_order'] = 'sold';
					cursor = db.collection('sold_buy_orders').count(search_array);
				}
			} 

				else if(status == "parent"){
					search_array['parent_status'] = 'parent';
					search_array['status'] = 'new';
					console.log(search_array, "===> search_array")
					cursor = db.collection('buy_orders').count(search_array);
				} else if(status == "lth"){
					search_array['status'] = 'lth';
					cursor = db.collection('dol_buy_orders').count(search_array);
				} else if(status == 'new'){
					search_array['status'] = 'new';
					search_array['parent_status'] = {$ne: 'parent'};
					cursor = db.collection('buy_orders').count(search_array);
				} else if(status == 'all'){
					search_array['status'] = {$in: ['error', 'canceled', 'submitted']};
					search_array['price'] = {$ne: ''};
					cursor = db.collection('buy_orders').count(search_array);
					cursor2 = db.collection('sold_buy_orders').count(search_array);
					total_orders_count_promise = add_cursors(cursor, cursor2);
				} else{
					search_array['status'] = status;
					cursor = db.collection('buy_orders').count(search_array);
				}

				console.log(search_array, "search_array of count_orders")

				cursor.then(cursor_resolved=>{
					console.log(cursor_resolved, "===> cursor_resolved")
					resolve(cursor_resolved);
				})
				
			
		}).catch(err=>{
			console.log(err, "err in count_orders function database")
		});
	}).catch(err=>{
		console.log(err, "error in count_orders function promise")
	});
}// end of count order function

router.post('/order_listing_user_balance_info', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let admin_id = post_data['admin_id'];
		let coin_symbol = post_data['coin'];
		let application_mode = post_data['application_mode'];
		let filter_coins = post_data.filter_coins;
		let filter_type = post_data.filter_type;
		let filter_level = post_data.filter_level;
		let trigger_type = post_data.filter_trigger;
		let post_start_date = new Date(post_data.start_date);
		let post_end_date = new Date(post_data.end_date);

		console.log(post_start_date, " ===> post_start_date");
		console.log(post_end_date, " ===> post_end_date");


		let btc_balance = get_user_wallet(admin_id, 'BTC');
		let bnb_balance = get_user_wallet(admin_id, 'BNBBTC')
		let post_coin_balance = get_user_wallet(admin_id, coin_symbol);


		conn.then(db=>{
			var search_array = {};
			search_array['admin_id'] = admin_id;
			search_array['application_mode'] = application_mode;
			if(filter_coins.length != 0){
				search_array['symbol'] = {$in: filter_coins};
			}
			if(filter_type != ""){
				search_array['order_type'] = filter_type;
			}
			if(filter_level != ""){
				search_array['order_level'] = filter_level;
			}
			if(trigger_type != ""){
				search_array['trigger_type'] = trigger_type;
			}
			if(post_start_date != "" && post_end_date != ""){
				let start_date_search = new Date(post_start_date);
				let end_date_search = new Date(post_end_date);
				search_array['created_date'] = {$gte: start_date_search, $lte: end_date_search};
			}
			search_array['status'] = 'FILLED';
			search_array['is_sell_order'] = 'sold';
			console.log(search_array, " ===> search_array")
			let sold_buy_orders_query = db.collection('sold_buy_orders_bk_of_live_server').find(search_array).toArray(); //change db  ===> test
			sold_buy_orders_query.then(sold_buy_orders_query_resolved=>{
				console.log(sold_buy_orders_query_resolved, "==> sold_buy_orders_query_resolved")
				let total_sold_orders = 0;

		        //Variables used in foreach
		        let market_sold_price = 0.0;
		        let current_order_price = 0.0;
		        let quantity = 0.0;
		        let sold_price_difference = 0.0;
		        let profit_data = 0.0;
		        let total_sold_in_btc = 0.0;
		        let total_profit = 0.0;
		        let total_quantity = 0.0;

		        sold_buy_orders_query_resolved.forEach(sold_order_data=>{
		        	total_sold_orders = total_sold_orders + 1;
		        	market_sold_price = sold_order_data['market_sold_price'];
		        	current_order_price = sold_order_data['market_value'];
		        	quantity = sold_order_data['quantity'];
		     		sold_price_difference = market_sold_price - current_order_price;
		        	profit_data = ((sold_price_difference * 100) / market_sold_price);
		        	total_sold_in_btc = quantity * parseFloat(current_order_price);
		        	total_profit += (total_sold_in_btc * profit_data);
		        	total_quantity += total_sold_in_btc;
		        })
		        if(total_quantity == 0.00000000){
		        	total_quantity = 1.0;
		        }
		        let avg_profit = parseFloat(total_profit / total_quantity);
		        let return_data = {};
		        return_data['total_sold_orders'] = total_sold_orders;
		        return_data['avg_profit'] = avg_profit;
		        Promise.all([btc_balance, bnb_balance, post_coin_balance]).then(balances=>{
		        	console.log(balances, "===> balances")
		        	let btc_balance_resolved = balances[0];
		        	let bnd_balance_resolved = balances[1];
		        	let post_coin_balance_resolved = balances[2];
		        	console.log(btc_balance_resolved, " <== btc ", bnd_balance_resolved, "<== bnb ", post_coin_balance_resolved, "<== post_coin_balance_resolved")
		        	res.send({"success": "true", "data": {"balances": {"btc_balance": btc_balance_resolved, "bnb_balance": bnd_balance_resolved, "post_coin_balance": post_coin_balance_resolved}, "avg_profit": avg_profit, "total_Sold": total_sold_orders}});
		        })
			})
		})

	}

})


router.post('/get_user_info', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.status(400).send({"success": "false", "status": 400, "message": "Bad request. No data posted in a post request"})
	} else{
		if('user_id' in post_data){
			let user_id = post_data['user_id'];
			console.log(user_id, "===> user_id")
			conn.then( db=>{
				let search_arr = {"_id": ObjectID(user_id)};
				console.log(search_arr, "===>search_arr")
				db.collection("users").findOne(search_arr, function(err, data){
					if (err) throw err;
					console.log(data, "===> data")
					if(data != undefined || data != null){
						if(Object.keys(data).length > 0){
							data['profile_image'] = "data:image/gif;base64,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"
							res.status(200).send({
								"success": "true",
								"status": 200,
								"data": data,
								"message": "User data against _id " + user_id + " has been fetched successfully"
							})
						} else{
							res.status(204).send({
								"success": "false",
								"status": 204,
								"message": "User data against _id " + user_id + " was not found in users collection"
							})
						}
					} else{
						res.status(404).send({"success": "false", "status": 404, "message": "Try a different user_id"})
					}
				})
			})
		}else{
			res.status(400).send({"success": "false", "status": 400, "message": "user_id was required to completed this request..."})
		}

	}
})

router.post('/get_user_login_history', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.status(400).send({"success": "false", "status": 400, "message": "Bad request. No data posted in a post request"})
	} else{
		if('user_id' in post_data){
			let user_id = post_data['user_id'];
			console.log(user_id, "===> user_id")
			conn.then( db=>{
				let search_arr = {"_id": ObjectID(user_id)};
				console.log(search_arr, "===>search_arr")
				db.collection("users").findOne(search_arr, function(err, data){
					if (err) throw err;
					console.log(data, "===> data")
					if(data != undefined || data != null){
						if(Object.keys(data).length > 0){
							search_arr = {"user_id": user_id};
							db.collection("user_login_log").find(search_arr).toArray(function(err1, data1){
								if (err1) throw err1;
								if(data1.length > 0){
									res.status(200).send({
										"success": "true",
										"status": 200,
										"data": data1,
										"message": "User login history against user_id " + user_id + " has been fetched successfully..."
									})
								} else{
									res.status(404).send({
										"success": "true",
										"status": 404,
										"message": "User login history against user_id " + user_id + " was not found in users login log..."
									})
								}
							})
							
						} else{
							res.status(204).send({
								"success": "false",
								"status": 204,
								"message": "User_id " + user_id + " was not found in users collection"
							})
						}
					} else{
						res.status(400).send({"success": "false", "status": 400, "message": "400 bad request... Try a valid user_id"});
					}
				})
			})
		}else{
			res.status(400).send({"success": "false", "status": 400, "message": "user_id was required to completed this request..."})
		}

	}
})

router.post('/update_user_info', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.status(400).send({"success": "false", "status": 400, "message": "Bad request. No data posted in a post request"})
	} else{
		if('user_id' in post_data){
			let user_id = post_data['user_id'];
			console.log(user_id, "===> user_id")
			conn.then( db=>{
				let search_arr = {"_id": ObjectID(user_id)};
				console.log(search_arr, "===>search_arr")
				db.collection("users").findOne(search_arr, function(err, data){
					if (err) throw err;
					if(Object.keys(data).length > 0){
						let update_arr = new Object(post_data);
						delete update_arr.user_id;
						db.collection("users").updateOne(search_arr, {$set :update_arr}, function(err1, obj){
							if (err1) throw err1;
							if(obj.result.nModified > 0){
								res.status(200).send({
									"success": "true",
									"status": 200,
									"message": "User info against user_id " + user_id + " has been successfully update"
								})
							} else{
								res.status(207).send({
									"success": "partial",
									"status": 207,
									"message": "User info against user_id " + user_id + " was already updated. Try different values."
								})
							}
						})
					} else{
						res.status(404).send({
							"success": "false",
							"status": 404,
							"message": "user_id " + user_id + " was not found in the database"
						})
					}
				})
			}).catch(err3=>{
				res.status(500).send({
					"success": "false",
					"status": 500,
					"message": "Database connection problem"
				})
			})
		}else{
			res.status(400).send({"success": "false", "status": 400, "message": "user_id was required to completed this request..."})
		}
	}
})





router.post('/order_listing_play_pause', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let admin_id = post_data['admin_id'];
		let order_id = post_data['order_id'];
		let play_pause_status = post_data['play_pause_status'];

		console.log(post_data, "===> post_data")

		conn.then(db=>{
			db.collection('buy_orders').updateOne({"_id": new ObjectID(order_id), "admin_id": String(admin_id)}, {$set: {"pause_status": play_pause_status}}, function(err, data){
				if (err) throw err;
				if(data.result.nModified > 0){
					console.log("nMatched ===> ", data.result.nMatched)
					res.send({"success": "true", "message": "Order play/pause status changed", "nModified": data.result.nModified, "nMatched": data.result.nMatched})
				} else{
					console.log("nMatched ===> ", data.result.nMatched)
					res.send({"success": "false", "message": "Payload didn't match the database", "nModified": data.result.nModified, "nMatched": data.result.nMatched})

				}
			});
		})	
	}
})


router.post('/get_current_market_Value', function(req, res, next){
	var post_data = req.body;``
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let coin_symbol = post_data['coin'];
		conn.then(db=>{
			db.collection('market_prices').find({"coin": coin_symbol}).sort({"created_date": -1}).limit(1).toArray(function(err, data){
				if (err) throw err;
				if(data.length > 0){
					console.log("success in fetching market value ==> ", data[0], " ==> for coin ==> ", coin_symbol);
					res.send({"success": "true", "data": data[0], "message": "current market value fetched successfully"});
				} else{
					console.log("current market value for coin ===>", coin_symbol, " does not exist in database");
					res.send({"success": "false", "message": "current market value does not exist in database"});
				}
			})
		}).catch(err=>{
			console.log(err);
			console.log("database connection problem in route get_current_market_Value");
			res.send({"success": "false", "message": "database connection problem while fetching current market value"});
		})
	}
})

router.post('/order_listing_order_detail', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		var admin_id = post_data['admin_id'];
		var order_id = post_data['order_id'];
		conn.then(db=>{
			var data = db.collection('buy_orders').findOne({'_id': order_id, 'admin_id': admin_id}).toArray();
			data.then(data_resolved=>{
				var return_array = data_resolved;
				delete return_array.admin_id;
				res.send({'success': "true", "message": "Order detail fetched successfully", "data": return_array});
			})
		})
	}
})



router.post('/get_all_coins', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let admin_id = post_data['admin_id']; //global or local
		conn.then(db=> {
			let data = db.collection('coins').find({"user_id": admin_id, "symbol": {$exists: true}}).toArray();
			data.then(data_resolved=>{
				console.log(data, " ===> data");
				var symbol_array = [];
				data_resolved.forEach(data_element=>{
					symbol_array.push(data_element.symbol);
				})
				console.log(symbol_array, "===> symbol_array");
				if(symbol_array.length > 0){
					if(admin_id == "global"){
					res.send({"success": "true", "coins": symbol_array, "message": "Global coins fetched successfully"});
					} else{
						res.send({"success": "true", "coins": symbol_array, "message": "Coins for User ID "+ admin_id +" have been fetched successfully"});
					}
				} else{
					res.send({"success": "false", "message": "User ID "+ admin_id +" have no coins in database yet!"})
				}
				
			})
		})
	}
})


router.post('/get_single_order', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let order_id = post_data['order_id'];
		conn.then(db=>{
			db.collection('buy_orders').find({"_id": new ObjectID(order_id)}).toArray(function(err, buy_data){
				if (err) throw err;
				if(buy_data.length > 0){
					console.log("get_single_order api success and data is ", buy_data);
					if(buy_data[0].auto_sell == "yes"){
						db.collection('temp_sell_orders').find({"buy_order_id": new ObjectID(order_id)}).toArray(function(err, sell_result){
							if (err) throw err;
							if(sell_result.length > 0){
								let data_to_send = buy_data[0];
								data_to_send['sell_trail_check'] = sell_result[0].trail_check;
								data_to_send['sell_order_type'] = sell_result[0].order_type;
								data_to_send['sell_autoLTH'] = sell_result[0].autoLTH;
								data_to_send['sell_profit_type'] = sell_result[0].profit_type;
								data_to_send['sell_stop_loss_check'] = sell_result[0].stop_loss;
								if(sell_result[0].profit_type == "percentage"){
									data_to_send['sell_profit_percentage'] = sell_result[0].profit_percent;
								} else if(sell_result[0].profit_type == "fixed_price"){
									data_to_send['sell_profit_price'] = sell_result[0].sell_profit_price;
								}

								if(sell_result[0].trail_check == "yes"){
									data_to_send['sell_trail_interval'] = sell_result[0].trail_interval;
								}
								if(sell_result[0].stop_loss == "yes"){
									data_to_send['sell_stop_loss_percentage'] = sell_result[0].loss_percentage
								}
								

								res.send({"success": "true", "auto_sell": "yes", "data": data_to_send ,"message": "single order fetched successfully & this order has auto_sell checked"});
							} else{
								res.send({"success": "false", "auto_sell": "yes",  "buy_data": buy_data[0], "message": "buy order with _id " + order_id + " is not present in temp_sell_orders"})
							}
						});
					} else if(buy_data[0].auto_sell == "no"){
						res.send({"success": "true", "auto_sell": "no", "buy_data": buy_data[0], "message": "buy order successfully fetched and this order is not set for auto_sell"})
					} 	
				} else{
					res.send({"success": "false", "message": "single order does not exist in the database"});
				}
			});
		}).catch(err=>{
			console.log("error in get_single_order database connection and error is ===> ", err);
			res.send({"success": "false", "message": "Database conenction error while fetching the single order in get_single_order API", "error": err});
		});
	}
})





router.post('/order_listing_cancel_order', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		var id_of_order = post_data['order_id'];
		conn.then(db=>{
			let query = {"_id": new ObjectID(id_of_order)};
			let to_update = {$set: {"status": "cancel"}};
			db.collection('buy_orders').updateOne(query, to_update, function(err, obj){
				if (err) throw err;
				console.log(obj.result, "===> obj.result")
				console.log(obj.result.nModified, "object for update")
				if(obj.result.nModified > 0){
					res.send({"success": "true", "message": "Order canceled successfully"})
				}
				else if(obj.result.n == 1){
					res.send({"success": "false", "message": "Status for the given order_id is already 'cancel'"})
				}
			})
		}).catch(err=>{
			console.log("database connection issue", err);
			res.send({"success": "false", "message": "database conenction problem"})
		})
	}
})


router.post('/order_listing_edit_buy_order', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		let order_id = post_data['order_id'];
		let admin_id = post_data['admin_id'];
		let application_mode = post_data['application_mode'];
		let trigger_type = post_data['trigger_type']

		if(trigger_type != "no"){
			res.send({"success": "false", "message": "please try again with trigger type 'no' as this api is for manual orders only"});
		}
		let where_json = {"_id": new ObjectID(order_id), "admin_id": admin_id, "application_mode": application_mode, "trigger_type": trigger_type};
		let update_json = post_data;
		delete update_json.order_id;
		delete update_json.admin_id;
		delete update_json.application_mode;
		delete update_json.trigger_type;
		conn.then(db=>{
			console.log(where_json, "===> where_json");
			console.log(order_id, "===> order_id")
			db.collection('buy_orders').updateOne(where_json, {$set: update_json}, function(err, obj){
				if (err) throw err;
				if(obj.result.n > 0){
					console.log("order_id matched");
					if(obj.result.nModified > 0){
						let message = "buy order for order _id " + order_id + " has been updated successfully";
						res.send({"success": "true", "message": message, "query_result": obj.result});
					}else{
						let message = "buy order for order _id " + order_id + " was matched but nModified count was 0 (check json attrs, their values and data types)";
						res.send({"success": "false", "message": message, "query_result": obj.result});
					}
				}else{
					console.log("order_id did not match");
					let message = "buy order for order _id " + order_id + " did not match the database";
					res.send({"success": "false", "message": message, "query_result": obj.result});
				}
			})
		})
	}
})


router.post('/chart', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		conn.then(db=>{
			if(post_data_key_array.length == 3){
				if(post_data_key_array.includes("coin") && post_data_key_array.includes("admin_id") && post_data_key_array.includes("application_mode")){
					let coin = post_data['coin'];
					let admin_id = post_data['admin_id'];
					let application_mode = post_data['application_mode'];
					let bid_group_cursor = db.collection('chart3_group').find({"coin": coin, 'type': "bid"}).limit(50).sort({'price': -1}).toArray();
					let ask_group_cursor = db.collection('chart3_group').find({"coin": coin,'type': "ask"}).limit(50).sort({'price': -1}).toArray();
					let coin_meta_query = db.collection("coin_meta").find({"coin": coin}).sort({"modified_date": -1}).limit(1).toArray();
					Promise.all([bid_group_cursor, ask_group_cursor, coin_meta_query]).then(bid_Ask_groups_resolved => {
						let bid_group = bid_Ask_groups_resolved[0];
						let ask_group = bid_Ask_groups_resolved[1];
						let coin_meta = bid_Ask_groups_resolved[2];
						if(bid_group.length > 0 && ask_group.length > 0){
							res.send({"success": "true", "chart3_data": {"ask_group": ask_group, "bid_group": bid_group}, "coin_meta_data": coin_meta ,"chart3_ask_group_length": ask_group.length, "chart3_bid_group_length": bid_group.length, "coin_meta_length": coin_meta.length ,"message": "Chart3 data fetched successfully" })
						} else{		
							res.send({"success": "false", "message": "Data not found"})
						}
					})
				}
			} else{
				res.send({"success": "false", "message": "The post data should contain only three attributes i.e. coin, admin_id and application_mode"})
			}
		})
	}
})

router.post('/deleteUserCoins', async function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		if("_id" in post_data){
			let dbID = ObjectID(post_data["_id"]);
			conn.then(async db => {
				db.collection("coins").deleteOne({"_id": dbID, "user_id": {$ne: "global"}}, async function(err, obj){
					if (err) throw err;
					if(obj.result.n > 0){
						res.status(200).send({
							"success": "true", 
							"status": 200,
							"message": "User coin successfully deleted"
						})
					} else{
						res.status(404).send({
							"success": "false", 
							"status": 404,
							"message": "_id you have just posted doesn't exist in coins collection"
						})
					}
				})
			})
		} else{
			res.status(400).send({
				"success": "false", 
				"status": 400,
				"message": "You need to post _id only. Kindly review the data you've posted in this post request"
			})
		}
	}
})

router.post('/buy_orders_find', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{

		if(Object.keys(post_data).length > 2){
			let find_json = post_data['find_json'];
			let sort_json = post_data['sort_json'];
			let limit = parseInt(post_data['limit']);
			if(Object.keys(sort_json).length > 0){
				conn.then(db=>{
					db.collection('buy_orders').find(find_json).sort(sort_json).limit(limit).toArray(function(err, obj){
						if (err) res.send({"success": "false", "error": err});
						if(obj.length > 0){
							res.send({"success": "true", "data": obj, "message": "data fetched successfully"});
						} else{
							res.send({"success": "false", "message": "no data found... try different values"});
						}
					})
				}).catch(err=>{
					res.send({"success": "false", "message": "database connection error"});
				})
			} else{
				conn.then(db=>{
					db.collection('buy_orders').find(find_json).limit(limit).toArray(function(err, obj){
						if (err) res.send({"success": "false", "error": err});
						if(obj.length > 0){
							res.send({"success": "true", "data": obj, "message": "data fetched successfully"});
						} else{
							res.send({"success": "false", "message": "no data found... try different values"});
						}
					})
				}).catch(err=>{
					res.send({"success": "false", "message": "database connection error"});
				})
			}
		} else{
			res.send({"success": "false", "message": "please pass at least 2 arguments i.e. find_json, and limit, these 2 are must and sort_json argument is optional... there is one or more arguments missing"});
		}
	}//
})

router.post('/login', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		conn.then(db=>{
			let post_email = post_data['email_address'];
			let post_password = post_data['password'];
			let where_json = {};
			where_json = {"email_address": String(post_email), "password": String(post_password)};
			db.collection("users").find(where_json).toArray(function(err, data){
				if (err) throw err;
				if(data.length > 0){
					res.send({"success": "true", "message": "user exists", "user_data": data[0]});
				} else{
					res.send({"success": "false", "message": "user does not exist"});
				}
			})
		})
	}
})


function add_cursors(cursor, cursor2){
	return new Promise(function(resolve, reject){
		Promise.all([cursor, cursor2]).then(cursor2=> {
			let total_orders_count_promise = cursors[0] + cursors[1];
			resolve(total_orders_count_promise);
		}).catch(err => {
			console.log(err, "error in add_cursors function")
		});
	})
}//end of add_cursors function


function get_user_wallet(user_id, coin_symbol){
	return new Promise(function(resolve, reject){
		conn.then(db=>{
			console.log(user_id, "===> user_id");
			console.log(coin_symbol, "===> coin_symbol");
			var data = db.collection('user_wallet').find({"user_id": user_id, "coin_symbol": coin_symbol}).toArray();
			data.then(data_resolved=>{
				console.log(data_resolved, " ===> user_wallet data")
				var balance = 0;
				if(data_resolved.length > 0){
					balance = data_resolved[0]['coin_balance'];
				}
				resolve(balance);
			})
		})
	})
}

function get_btc_price(){
	return new Promise(function (resolve, reject){
		request('https://api.cryptonator.com/api/ticker/btc-usd', { json: true }, (err, data, body) => {
		  if (err) { return console.log(err); }
			  console.log(body);
			  let body_json = (body);
			  console.log(body_json, "=> body_json")
			  var price = parseFloat(body_json.ticker.price);
			  console.log(price, "===> price")
			  resolve(price);
		})
	}).catch(err=> {
		res.send({"success": "false", "reason": "There is a problem with 'return new promise'"})
	})
}







Date.prototype.addHours= function(h){
    this.setHours(this.getHours()+h);
    return this;
}

//********************************************************* */

router.post('/authenticate',(req,resp)=>{
	let username = req.body.username;
	let pass = req.body.password;
	let md5Pass = md5(pass);
	let where = {};
	where.password = md5Pass;
	where['$or'] = [{username:username},{email_address:username}]
	conn.then((db)=>{
		let UserPromise = db.collection('users').find(where).toArray();
		UserPromise.then((userArr)=>{
			let respObj = {};
			if(userArr.length >0){
				userArr = userArr[0];
				respObj.id = userArr['_id'];
				respObj.username = userArr['username'];
				respObj.firstName = userArr['first_name'];
				respObj.lastName = userArr['last_name'];
				respObj.role = 'admin';
				respObj.token = `fake-jwt-token.`;
				respObj.email_address=  userArr['email_address'];
				respObj.timezone = userArr['timezone'];
				respObj.application_mode = userArr['application_mode'];
				resp.send(respObj);
			}else{
				resp.status(400).send({
					message: 'username or Password Incorrect'
				 });
			}
		})
	})
})//End of authenticate


router.post('/listDashboardData',async (req,resp)=>{
		let userCoinsArr = await listUserCoins(req.body._id);
		var coin = 'NCASHBTC' //(userCoinsArr.length == 0)?'NCASHBTC':userCoinsArr[0]['symbol'];
		let currentMarketPriceArr = await listCurrentMarketPrice(coin);
		var currentMarketPrice = (currentMarketPriceArr.length ==0)?0:currentMarketPriceArr[0]['price'];
		var askPricesArr = await listAskPrices(coin,currentMarketPrice);
	
		resp.status(200).send({
			message: askPricesArr
		 });
	
})//End of listDashboardData





function listUserCoins(userId){
	return new Promise((resolve)=>{
		let where = {};
		where.user_id = userId;
		where.symbol = {'$nin':['',null,'BTC','BNBBTC']};
		conn.then((db)=>{
			db.collection('coins').find(where).toArray((err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result)
				}
			})
		})
	})	
}//End of listUserCoins




function listCurrentMarketPrice(coin){
	return new Promise((resolve)=>{
		let where = {};		
		where.coin = coin;
		conn.then((db)=>{
			db.collection('market_prices').find(where).limit(1).toArray((err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result)
				}
			})
		})
	})	
}//End of listCurrentMarketPrice


// function listAskPrices(coin,currentMarketPrice){
// 	return new Promise((resolve)=>{
// 		//******************* */
// 		let project = {};
// 			project['$project'] = { price: 1, quantity : 1 , type : 1 ,coin:1,created_date:1}
// 		let match = {};
// 		 match['$match'] = {coin:coin,type:'ask','price':{'$gte':currentMarketPrice}};
// 		let sort1 = {$sort:{'created_date':-1}};
// 		let group  = {};
// 			group['$group'] = {_id:['price','$price'],quantity: {'$first': "$quantity" },type: { '$first': "$type" },coin: { '$first': "$coin" },created_date: { '$first': "$created_date" },price: { '$first': "$price" }}
// 		let sort2 = {$sort:{'price':1}};
// 		let limit = {$limit:20};
// 		var pipeline = [project,group,limit];

		
// 		array(
// 			'$project' => array(
// 				"price" => 1,
// 				"quantity" => 1,
// 				"type" => 1,
// 				"coin" => 1,
// 				'created_date' => 1,
// 			),
// 		),



// 		var pip = [
// 			{
// 				$project: [{'price': 1},{'quantity': 1},{'type': 1},{'coin': 1},{'created_date': 1}]	
// 			},
// 			{ 
// 				$match: { 
// 					coin : coin,
// 					type : 'ask',
// 					price : {'$gte':currentMarketPrice}
// 				}
// 			},



// 			{
// 				$group : {
// 					_id : { year: { $year : "$ending_date" }, month: { $month : "$ending_date" }}, 
// 					count : { $sum : 1 }
// 				}
// 			}]


// 		conn.then((db)=>{
// 			db.collection('market_depth').aggregate(pipeline).toArray((err,result)=>{
// 				if(err){
// 					resolve(err)
// 				}else{
// 					console.log(result)
// 					resolve(result)
// 				}
// 			})
// 		})
// 	})	
// }//End of listAskPrices


router.post('/manageCoins',async (req,resp)=>{
	var urserCoinsPromise =  listUserCoins(req.body.admin_id);
	var globalCoinsPromise = listGlobalCoins();
	var promisesResult = await Promise.all([urserCoinsPromise,globalCoinsPromise]);
	var responseReslt = {};
	responseReslt['userCoins'] = promisesResult[0];
	responseReslt['globalCoins'] = promisesResult[1];
	resp.status(200).send({
			message: responseReslt
		});
})//End of listOrderListing

function listGlobalCoins(){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			let filter = {};
			filter['user_id'] = 'global'
			db.collection('coins').find(filter).toArray((err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result);
				}
			})
		})
	})
}//End of listGlobalCoins

async function listUserCoins(userId){
	return new Promise((resolve)=>{
		let where = {};
		where.user_id = userId;
		where.symbol = {'$nin':['',null,'BTC','BNBBTC']};
		conn.then((db)=>{
			db.collection('coins').find(where).toArray(async (err,result)=>{
				if(err){
					resolve(err)
				}else{
					var return_arr = await mergeContentManageCoins(result);
					console.log(return_arr, "===> return_arr");
					resolve(return_arr)
				}
			})
		})
	})	
}//End of listUserCoins

async function getLastPrice(coin){
	return new Promise(async function(resolve, reject){
		conn.then(async db=>{
			db.collection("market_prices").find({"coin": coin}).sort({"_id": -1}).limit(1).toArray(async function(err, data){
				if (err) throw err;
				if(data.length > 0){
					let last_value = parseFloat(data[0].price);
					console.log(last_value, "===<> last_value");
					resolve(last_value);
				} else{
					resolve(null);
				}
			})
		}).catch(err=>{
			console.log(err);
		})
	})
}// End of getLastPrice

async function get24HrPriceChange(coin){
	return new Promise(async function(resolve, reject){
		conn.then(async db=>{
			db.collection("coin_price_change").findOne({"symbol": coin}, async function(err, data){
				if (err) throw err;
				if(data != undefined || data != null){
					if(Object.keys(data).length > 0){
						let return_json = new Object();
						return_json['price_change'] = data['priceChange'];
						return_json['price_change_percentage'] = data['priceChangePercent'];
						resolve(return_json);
					} else{
						resolve({})
					}
				} else{
					resolve(null)
				}
			})
		})
	})
}

async function mergeContentManageCoins(data){
	return new Promise(async function(resolve, reject){
		var return_arr = [];
		var arrylen =  data.length;
		var temlen = 0;
		data.forEach(async data_element => {
			
			data_element['last_price'] = await getLastPrice(data_element['symbol']);
			let price_change_json = await get24HrPriceChange(data_element['symbol']);
			if(price_change_json != null || Object.keys(price_change_json).length > 0){
				data_element = Object.assign(data_element, price_change_json);
			}
			console.log(data_element, "===> data_element");

			return_arr.push(data_element);
			console.log(return_arr.length, "===> length of bc return_arr")
			temlen++;
		})
		console.log(temlen, " ==== ", arrylen)
		if(temlen == arrylen){
			console.log(return_arr, "===> return_arr bc")
			resolve(return_arr);
		}
		//Promise.all(return_arr).then(arr_element => )
	})
}
//*********************************************************== */




module.exports = router;


