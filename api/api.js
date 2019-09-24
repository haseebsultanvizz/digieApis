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
			}).catch(err=>{
				console.log("database connection problem in route get_current_market_Value");
				res.send({"success": "false", "message": "database connection problem while fetching current market value"});
			})
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
			let bid_group_cursor = db.collection('chart3_group').find({'type': "bid"}).limit(50).sort({'price': -1}).toArray();
			let ask_group_cursor = db.collection('chart3_group').find({'type': "ask"}).limit(50).sort({'price': -1}).toArray();
			Promise.all([bid_group_cursor, ask_group_cursor]).then(bid_Ask_groups_resolved => {
				let bid_group = bid_Ask_groups_resolved[0];
				let ask_group = bid_Ask_groups_resolved[1];
				if(bid_group.length > 0 && ask_group.length > 0){
					res.send({"success": "true", "data": {"ask_group": ask_group, "bid_group": bid_group},"ask_data_length": ask_group.length, "bid_data_length": bid_group.length ,"message": "Chart3 data fetched successfully" })
				} else{		
					res.send({"success": "false", "message": "Data not found"})
				}
			})
		})
		
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
	where['status'] = '0';
	where['user_soft_delete'] = '0';

	conn.then((db)=>{
		let UserPromise = db.collection('users').find(where).toArray();
		UserPromise.then((userArr)=>{
			let respObj = {};
			if(userArr.length >0){
				userArr = userArr[0];	
				let api_key = (typeof userArr['api_key'] =='undefined')?'':userArr['api_key'];
				let api_secret = (typeof userArr['api_secret'] =='undefined')?'':userArr['api_secret'];
				if(api_key == '' || api_secret ==''  || api_key ==null || api_secret == null){
					var  check_api_settings = 'no';
				}else{
					var  check_api_settings = 'yes';
				}
				let application_mode = (typeof userArr['application_mode'] =='undefined')?'':userArr['application_mode'];

				if ( application_mode == "" || application_mode == null || application_mode == 'no') {
					var app_mode = 'test';
				} else {
					var app_mode = (application_mode =='both')?'live': application_mode;
				}

				respObj.id = userArr['_id'];
				respObj.username = userArr['username'];
				respObj.firstName = userArr['first_name'];
				respObj.lastName = userArr['last_name'];
				respObj.profile_image = userArr['profile_image'];
				respObj.role = 'admin';//userArr['user_role'];
				respObj.token = `fake-jwt-token.`;
				respObj.email_address=  userArr['email_address'];
				respObj.timezone = userArr['timezone'];
				respObj.check_api_settings = check_api_settings;
				respObj.application_mode = app_mode
				respObj.leftmenu = userArr['leftmenu'];
				respObj.user_role = userArr['user_role'];
				respObj.special_role = userArr['special_role'];
				respObj.google_auth = userArr['google_auth'];
				respObj.trigger_enable = userArr['trigger_enable'];
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
		let userCoin =  (typeof  req.body.userCoin =='undefined')?'':req.body.userCoin; 
		var coin = ( (userCoinsArr.length == 0) || userCoin =='')?'TRXBTC':(userCoin =='')?userCoinsArr[0]['symbol']:userCoin;

		let currentMarketPriceArr = await listCurrentMarketPrice(coin);
		var currentMarketPrice = (currentMarketPriceArr.length ==0)?0:currentMarketPriceArr[0]['price'];
			currentMarketPrice = parseFloat(currentMarketPrice);
		var askPricesPromise =  listAskPrices(coin,currentMarketPrice);
		var bidPricesPromise =  listBidPrices(coin,currentMarketPrice);
		var marketHistoryPromise = listMarketHistory(coin);
		
		var currncy = coin.replace("BTC",'');
		var promisesResult = await Promise.all([askPricesPromise,bidPricesPromise,marketHistoryPromise]);
		var responseReslt = {};
			responseReslt['askPricesArr'] = promisesResult[0];
			responseReslt['bidPricesArr'] = promisesResult[1];
			responseReslt['marketHistoryArr'] = promisesResult[2];
			responseReslt['currncy'] = currncy;
			responseReslt['currentMarketPrice'] = currentMarketPrice;
		resp.status(200).send({
			message: responseReslt
		 });
	
})//End of listDashboardData

router.post('/listManualOrderComponent',async (req,resp)=>{
	var listUserCoinsArr = await listUserCoins(req.body._id);

	resp.status(200).send({
		message: listUserCoinsArr
	 });
})//End of listManualOrderComponent	


router.post('/listUserCoinsApi',async (req,resp)=>{
	var urserCoinsArr = await listUserCoins(req.body._id)
	resp.status(200).send({
		message: urserCoinsArr
	 });
})//End of listUserCoinsApi

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


router.post('/listCurrentmarketPrice',async (req,resp)=>{
	let exchange = req.body.exchange;
	var urserCoinsArr = await listCurrentMarketPrice(req.body.coin,exchange)
	resp.status(200).send({
		message: urserCoinsArr
	 });
})//End of listCurrentmarketPrice

function listCurrentMarketPrice(coin,exchange){
	return new Promise((resolve)=>{
		let where = {};		
		where.coin = coin;
		conn.then((db)=>{
			let collectionName = (exchange == 'binance')?'market_prices':'market_prices_'+exchange;
			db.collection(collectionName).find(where).sort({"created_date": -1}).limit(1).toArray((err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result)
				}
			})
		})
	})	
}//End of listCurrentMarketPrice

function listAskPrices(coin,currentMarketPrice){
	return new Promise((resolve)=>{
		var pipeline = [
			{
				$project: { price: 1, quantity : 1 , type : 1 ,coin:1,created_date:1}	
			},
			{ 
				$match: { 
					coin : coin,
					type : 'ask',
					price : {'$gte':currentMarketPrice}
				}
			},

			{
				$sort:{'created_date':-1}
			},
		
			{
				$group : {
					_id :{price: '$price'},
					quantity :{'$first': '$quantity'},
					type :{'$first': '$type'},
					coin :{'$first': '$coin'},
					created_date :{'$first': '$created_date'},
					price :{'$first': '$price'},
				}
			},
			{
				$sort:{'price':1}
			},
			{'$limit':20}
		
		];
		conn.then((db)=>{
			db.collection('market_depth').aggregate(pipeline).toArray((err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result)
				}
			})
		})
	})	
}//End of listAskPrices

function listBidPrices(coin,currentMarketPrice){
	return new Promise((resolve)=>{
		var pipeline = [
			{
				$project: { price: 1, quantity : 1 , type : 1 ,coin:1,created_date:1}	
			},
			{ 
				$match: { 
					coin : coin,
					type : 'bid',
					price : {'$lte':currentMarketPrice}
				}
			},

			{
				$sort:{'created_date':-1}
			},
		
			{
				$group : {
					_id :{price: '$price'},
					quantity :{'$first': '$quantity'},
					type :{'$first': '$type'},
					coin :{'$first': '$coin'},
					created_date :{'$first': '$created_date'},
					price :{'$first': '$price'},
				}
			},
			{
				$sort:{'price':-1}
			},
			{'$limit':20}
		
		];
		conn.then((db)=>{
			db.collection('market_depth').aggregate(pipeline).toArray((err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result)
				}
			})
		})
	})	
}//End of listBidPrices

function listMarketHistory(coin){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			var where = {};
				where['coin'] = coin;
				db.collection('market_trades').find(where).limit(20).sort({_id:-1}).toArray((err,result)=>{
					if(err){
						resolve(err)
					}else{
						resolve(result);
					}
				})
		})
	})
}//End of listMarketHistory


router.post('/listManualOrderDetail',async (req,resp)=>{
	let exchange  = req.body.exchange;
	var urserCoinsPromise = listUserCoins(req.body._id)
	var currentMarketPricePromise =  listCurrentMarketPrice(req.body.coin,exchange);
	let globalCoin = (exchange == 'binance')?'BTCUSDT':'BTCUSD';
	var BTCUSDTPRICEPromise = listCurrentMarketPrice(globalCoin,exchange);
	var marketMinNotationPromise = marketMinNotation(req.body.coin);
	var promisesResult = await Promise.all([urserCoinsPromise,currentMarketPricePromise,marketMinNotationPromise,BTCUSDTPRICEPromise]);

	var responseReslt = {};
		responseReslt['userCoinsArr'] = promisesResult[0];
		responseReslt['CurrentMarkerPriceArr'] = promisesResult[1];
		responseReslt['marketMinNotation'] = promisesResult[2];
		responseReslt['BTCUSDTPRICE'] = promisesResult[3];
	resp.status(200).send({
		message: responseReslt
	 });

})//End of listManualOrderDetail

router.post('/listAutoOrderDetail',async (req,resp)=>{
	var urserCoinsPromise = listUserCoins(req.body._id)
	let exchange = req.body.exchange;
	let globalCoin = (exchange == 'binance')?'BTCUSDT':'BTCUSD';
	var BTCUSDTPRICEPromise = listCurrentMarketPrice(globalCoin);
	var promisesResult = await Promise.all([urserCoinsPromise,BTCUSDTPRICEPromise]);
	var marketMinNotationResp = await marketMinNotation(promisesResult[0][0].symbol);
	var currentMarketPriceArr = await listCurrentMarketPrice(promisesResult[0][0].symbol);
	var responseReslt = {};
		responseReslt['userCoinsArr'] = promisesResult[0];
		responseReslt['BTCUSDTPRICE'] = promisesResult[1];
		responseReslt['CurrentMarkerPriceArr'] = currentMarketPriceArr
		responseReslt['marketMinNotation'] = marketMinNotationResp
		responseReslt['selectedCoin'] = promisesResult[0][0].symbol;
	resp.status(200).send({
		message: responseReslt
	 });
})//End of listAutoOrderDetail


router.post('/listmarketPriceMinNotation',async (req,resp)=>{
	var marketMinNotationPromise =  marketMinNotation(req.body.coin);
	let exchange = req.body.exchange;
	let coin = req.body.coin;
	var currentMarketPricePromise =  listCurrentMarketPrice(coin,exchange);
	var promisesResult = await Promise.all([marketMinNotationPromise,currentMarketPricePromise]);
	var responseReslt = {};
	responseReslt['marketMinNotation'] = promisesResult[0];
	responseReslt['currentmarketPrice'] = promisesResult[1];
	resp.status(200).send({
			message: responseReslt
		});
})//End of listmarketPriceMinNotation

router.post('/createManualOrder',(req,resp)=>{
	conn.then((db)=>{
		let orders = req.body.orderArr;
		let orderId = req.body.orderId;
		let exchnage = orders['exchnage'];
		orders['created_date'] = new Date();
		orders['modified_date'] = new Date();
		var collectionName =  (exchnage == 'binance')?'buy_orders':'buy_orders_'+exchnage;
		var where = {};
			where['_id'] = (orderId == '')?'':new ObjectID(orderId);

		var set = {};	
			set['$set'] = orders;
		var upsert = { upsert: true }

		db.collection(collectionName).updateOne(where,set,upsert,(err,result)=>{
			if(err){
				resp.status(403).send({
					message:'some thing went wrong'
				 });
			}else{
				if(req.body.orderArr.auto_sell == 'yes'){
					let buyOrderId = (result.upsertedId ==null)?orderId:result.upsertedId._id;
				let tempOrder = req.body.tempOrderArr;
					tempOrder['created_date'] = new Date();
					tempOrder['buy_order_id'] = buyOrderId;
				var tempCollection =  (exchnage == 'binance')?'temp_sell_orders':'temp_sell_orders_'+exchnage;

					var where = {};
					where['buy_order_id'] =  {'$in':[buyOrderId,new ObjectID(buyOrderId)]}; 

					var set = {};	
					set['$set'] = tempOrder;
					var upsert = { upsert: true }

					db.collection(tempCollection).updateOne(where,set,upsert,(err,result)=>{
					if(err){
						resp.status(403).send({
							message:'some thing went wrong while Creating order'
						 });
					}else{
						resp.status(200).send({
							message: 'Order successfully created'
						 });
					}
				})
				}else{
					resp.status(200).send({
						message: 'Order successfully created'
					 });
				}	
			}	
		})	
	})
})//End of createManualOrder





router.post('/createManualOrderByChart',(req,resp)=>{
	conn.then((db)=>{
		let orders = req.body.orderArr;
		let exchange = orders['exchange'];
		let price = orders['price'];

		let profit_percent = req.body.tempOrderArr.profit_percent;
		orders['created_date'] = new Date();
		orders['modified_date'] = new Date();
		var collectionName =  (exchange == 'binance')?'buy_orders':'buy_orders_'+exchange;

		db.collection(collectionName).insertOne(orders,(err,result)=>{
			if(err){
				resp.status(403).send({
					message:'some thing went wrong'
				 });
			}else{

				var buyOrderId = result.insertedId 

				console.log(':::::::::::::::::::::::')
				console.log('buyOrderId',buyOrderId);
				console.log(':::::::::::::::::::::::')


				var log_msg = "Buy Order was Created at Price "+parseFloat(price).toFixed(8);
				if (req.body.orderArr.auto_sell == 'yes' && profit_percent != '') {
					log_msg += ' with auto sell ' +profit_percent +'%';
				}

				log_msg += '  From Chart';
				let show_hide_log = 'yes';
				let type = 'Order_created';
				var promiseLog = recordOrderLog(buyOrderId,log_msg,type,show_hide_log,exchange)
					promiseLog.then((callback)=>{
						
					})


				if(req.body.orderArr.auto_sell == 'yes'){
					
				let tempOrder = req.body.tempOrderArr;
					tempOrder['created_date'] = new Date();
					tempOrder['buy_order_id'] = buyOrderId;
				var tempCollection =  (exchange == 'binance')?'temp_sell_orders':'temp_sell_orders_'+exchange;

					var where = {};
					where['buy_order_id'] = {'$in':[buyOrderId,new ObjectID(buyOrderId)]}; 

					var set = {};	
					set['$set'] = tempOrder;
					var upsert = { upsert: true }

					db.collection(tempCollection).updateOne(where,set,upsert,(err,result)=>{
					if(err){
						resp.status(403).send({
							message:'some thing went wrong while Creating order'
						 });
					}else{
						resp.status(200).send({
							message: 'Order successfully created'
						 });
					}
				})
				}else{
					resp.status(200).send({
						message: 'Order successfully created'
					 });
				}	
			}	
		})	
	})
})//End of createManualOrderByChart




router.post('/makeManualOrderSetForSell',(req,resp)=>{
	conn.then((db)=>{
		let orders = req.body.orderArr;
		let orderId = req.body.orderId;
		let exchange = orders['exchange'];
		orders['created_date'] = new Date();
		orders['modified_date'] = new Date();

		var collectionName =  (exchange == 'binance' || exchange =='')?'orders':'orders_'+exchange;
		var where = {};
			where['_id'] = (orderId == '')?'':new ObjectID(orderId);

		var set = {};	
			set['$set'] = orders;
		var upsert = { upsert: true }

		db.collection(collectionName).updateOne(where,set,upsert,(err,result)=>{
			if(err){
				resp.status(403).send({
					message:'some thing went wrong'
				 });
			}else{
				let sellOrderId = (result.upsertedId ==null)?orderId:result.upsertedId._id;
				let updArr = {}
					updArr['modified_date'] = new Date();
					updArr['sell_order_id'] = new ObjectID(sellOrderId) ;
					updArr['is_sell_order'] = 'yes';
					updArr['auto_sell'] = 'yes';

				var collection =  (exchange == 'binance')?'buy_orders':'buy_orders_'+exchange;
				var where = {};
					where['_id'] = new ObjectID(orderId); 
				var updPrmise = updateOne(where,updArr,collection);
					updPrmise.then((callback)=>{})
				var log_msg = "Sell Order was Created";
				let show_hide_log = 'yes';
				let type = 'Order Ready For Buy';
				var promiseLog = recordOrderLog(orderId,log_msg,type,show_hide_log,exchange)
					promiseLog.then((callback)=>{
						
					})
				resp.status(200).send({
					message: 'Order successfully Ready for buy'
				 });
			
			}//End of success result	
		})	
	})
})//End of makeManualOrderSetForSell


router.post('/createAutoOrder',async (req,resp)=>{
	let order  = req.body.orderArr;
	order['created_date'] = new Date()
	order['modified_date'] = new Date()
	let orderResp =  await createAutoOrder(order);
	resp.status(200).send({
		message: orderResp
	});
})//End of createAutoOrder

function createAutoOrder(OrderArr){
	return new Promise((resolve)=>{
		conn.then((db)=>[
			db.collection('buy_orders').insertOne(OrderArr,(err,result)=>{
				if(err){
					resolve(err);
				}else{
					resolve(result)
				}
			})
		])
	})
}//End of createAutoOrder


function marketMinNotation(symbol){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			let where = {};
				where.symbol = symbol;
			db.collection('market_min_notation').find(where).toArray((err,result)=>{
				if(err){
					resolve(err);
				}else{
					var min_notation = 0;
						if(result.length >0){
							min_notation = result[0].min_notation
						}
					resolve(min_notation)
				}
			})
		})
	})
}//End of marketMinNotation

router.post('/listOrderListing',async (req,resp)=>{

	var admin_id = req.body.postData.admin_id;
	var application_mode = req.body.postData.application_mode;
	var postDAta = req.body.postData;
	var search = {};
	if(postDAta.coins !=''){
		search['symbol'] = {'$in':postDAta.coins} 
	}

	if(postDAta.order_type !=''){
		search['order_type'] = postDAta.order_type
	}

	if(postDAta.trigger_type !=''){
		search['trigger_type'] = postDAta.trigger_type
	}

	if(postDAta.order_level !=''){
		search['order_level'] = postDAta.order_level
	}


	var count = 0;
	var i;
	for (i in search) {
		if (search.hasOwnProperty(i)) {
			count++;
		}
	}

	var exchange = postDAta.exchange;
	var collectionName = (exchange =='binance')?'buy_orders':'buy_orders_'+exchange;
	var filter_1 = {};
		filter_1['parent_status'] = 'parent';
		filter_1['admin_id'] = admin_id;
		filter_1['application_mode'] = application_mode;
		filter_1['status'] = 'new'

		if(postDAta.start_date !='' && postDAta.end_date !=''){
			let start_date = new Date(postDAta.start_date);
			let end_date = new Date(postDAta.end_date);
			filter_1['created_date'] = {'$gte':start_date, '$lte':end_date}
		}

		if(count>0){
			for (let [key, value] of Object.entries(search)) {
				filter_1[key] = value;
			}
		}
	
	var parentCountPromise = countCollection(collectionName,filter_1);
	
	


	var filter_2 = {};
		filter_2['status'] = 'new';
		filter_2['price'] = {'$nin':['',null]};
		filter_2['admin_id'] = admin_id;
		filter_2['application_mode'] = application_mode;

		if(postDAta.start_date !='' && postDAta.end_date !=''){
			let start_date = new Date(postDAta.start_date);
			let end_date = new Date(postDAta.end_date);
			filter_2['created_date'] = {'$gte':start_date, '$lte':end_date}
		}

		if(count >0){
			for (let [key, value] of Object.entries(search)) {
				filter_2[key] = value;
			}
		}

	var newCountPromise = countCollection(collectionName,filter_2);


	var filter_3 = {};
		filter_3['status'] = {'$in':['submitted', 'FILLED']}
		filter_3['is_sell_order'] = 'yes';
		filter_3['admin_id'] = admin_id;
		filter_3['application_mode'] = application_mode;
		if(postDAta.start_date !='' && postDAta.end_date !=''){
			let start_date = new Date(postDAta.start_date);
			let end_date = new Date(postDAta.end_date);
			filter_3['created_date'] = {'$gte':start_date, '$lte':end_date}
		}
		if(count >0){
			for (let [key, value] of Object.entries(search)) {
				filter_3[key] = value;
			}
		}
	var openCountPromise = countCollection(collectionName,filter_3);



	var filter_33 = {};
		filter_33['status'] = {'$in':['submitted', 'FILLED']}
		filter_33['admin_id'] = admin_id;
		filter_33['application_mode'] = application_mode;
		if(postDAta.start_date !='' && postDAta.end_date !=''){
			let start_date = new Date(postDAta.start_date);
			let end_date = new Date(postDAta.end_date);
			filter_33['created_date'] ={'$gte':start_date, '$lte':end_date}
		}
		if(count >0){
			for (let [key, value] of Object.entries(search)) {
				filter_33[key] = value;
			}
		}
	var filledCountPromise = countCollection(collectionName,filter_33);


	


	var filter_4 = {};
		filter_4['status'] = 'canceled';
		filter_4['admin_id'] = admin_id;
		filter_4['application_mode'] = application_mode;
		if(postDAta.start_date !='' && postDAta.end_date !=''){
			let start_date = new Date(postDAta.start_date);
			let end_date = new Date(postDAta.end_date);
			filter_4['created_date'] ={'$gte':start_date, '$lte':end_date}
		}
		if(count >0){
			for (let [key, value] of Object.entries(search)) {
				filter_4[key] = value;
			}
		}
	var cancelCountPromise = countCollection(collectionName,filter_4);



	var filter_5 = {};
		filter_5['status'] = 'error';
		filter_5['admin_id'] = admin_id;
		filter_5['application_mode'] = application_mode;
		if(postDAta.start_date !='' && postDAta.end_date !=''){
			let start_date = new Date(postDAta.start_date);
			let end_date = new Date(postDAta.end_date);
			filter_5['created_date'] = {'$gte':start_date, '$lte':end_date}
		}
		if(count >0){
			for (let [key, value] of Object.entries(search)) {
				filter_5[key] = value;
			}
		}
	var errorCountPromise = countCollection(collectionName,filter_5);


	var filter_6 = {};
		filter_6['status'] = 'LTH';
		filter_6['admin_id'] = admin_id;
		filter_6['application_mode'] = application_mode;
		filter_6['is_sell_order'] = 'yes';


		if(postDAta.start_date !='' && postDAta.end_date !=''){
			let start_date = new Date(postDAta.start_date);
			let end_date = new Date(postDAta.end_date);
			filter_6['created_date'] = {'$gte':start_date, '$lte':end_date}
		}
		if(count >0){
			for (let [key, value] of Object.entries(search)) {
				filter_6[key] = value;
			}
		}

	var lthCountPromise = countCollection(collectionName,filter_6);


	var filter_7 = {};
		filter_7['status'] = 'submitted';
		filter_7['admin_id'] = admin_id;
		filter_7['application_mode'] = application_mode;
		if(postDAta.start_date !='' && postDAta.end_date !=''){
			let start_date = new Date(postDAta.start_date);
			let end_date = new Date(postDAta.end_date);
			filter_7['created_date'] = {'$gte':start_date, '$lte':end_date}
		}

		if(count >0){
			for (let [key, value] of Object.entries(search)) {
				filter_7[key] = value;
			}
		}

	var submittedCountPromise = countCollection(collectionName,filter_7);


	var collectionName =  (exchange =='binance')?'sold_buy_orders':'sold_buy_orders_'+exchange;
	var filter_8 = {};
		filter_8['admin_id'] = admin_id;
		filter_8['application_mode'] = application_mode;

		if(postDAta.start_date !='' && postDAta.end_date !=''){
			let start_date = new Date(postDAta.start_date);
			let end_date = new Date(postDAta.end_date);
			filter_8['created_date'] = [{'$gte':start_date},{'$lte':end_date}]
		}

		if(count >0){
			for (let [key, value] of Object.entries(search)) {
				filter_8[key] = value;
			}
		}

	var soldCountPromise = countCollection(collectionName,filter_8);

	

	var PromiseResponse = await Promise.all([parentCountPromise,newCountPromise,openCountPromise,cancelCountPromise,errorCountPromise,lthCountPromise,submittedCountPromise,soldCountPromise,filledCountPromise]);

	var parentCount = PromiseResponse[0];
	var newCount = PromiseResponse[1];
	var openCount = PromiseResponse[2];
	var cancelCount = PromiseResponse[3];
	var errorCount = PromiseResponse[4];
	var lthCount = PromiseResponse[5];
	var submitCount = PromiseResponse[6];
	var soldCount = PromiseResponse[7];
	var filledCount = PromiseResponse[8];

	var totalCount = parseFloat(parentCount)+parseFloat(newCount)+parseFloat(openCount)+parseFloat(cancelCount)+parseFloat(errorCount)+parseFloat(lthCount)+parseFloat(submitCount)+parseFloat(soldCount);

	var countArr = {};
		countArr['totalCount'] = totalCount;
		countArr['parentCount'] = parentCount;
		countArr['newCount'] = newCount;
		countArr['openCount'] = openCount;
		countArr['canceledCount'] = cancelCount;
		countArr['errorCount'] = errorCount;
		countArr['lthCount'] = lthCount;
		countArr['submitCount'] = submitCount;
		countArr['soldCount'] = soldCount;
		countArr['filledCount'] = filledCount;
	
	var userBalanceArr = await listUserBalance(admin_id);
	var soldOrderArr = []; //await calculateAverageOrdersProfit(req.body.postData);
	var total_profit  = 0;
	var total_quantity = 0;
	for(let index in soldOrderArr){
		var market_sold_price = (typeof  soldOrderArr[index]['market_sold_price'] =='undefined')?0:soldOrderArr[index]['market_sold_price'];
			market_sold_price = parseFloat((isNaN(market_sold_price))?0:market_sold_price);
		
		var current_order_price =(typeof  soldOrderArr[index]['market_value'] =='undefined')?0:soldOrderArr[index]['market_value'];  
			current_order_price = parseFloat( (isNaN(current_order_price))?0:current_order_price);

		var quantity = (typeof  soldOrderArr[index]['quantity'] =='undefined')?0:soldOrderArr[index]['quantity']; 
			quantity = parseFloat( (isNaN(quantity))?0:quantity);

		var percentage = calculate_percentage(current_order_price, market_sold_price);
		var total_btc = quantity *current_order_price;
		 total_profit += total_btc * percentage;
		 total_quantity += total_btc;
	}

	var avg_profit = 0; //total_profit / total_quantity;

	var orderListing = await listOrderListing(req.body.postData);
	var customOrderListing = [];
	for(let index in orderListing){
		let currentMarketPricePromise =  listCurrentMarketPrice(orderListing[index].symbol,exchange);
		let globalCoin = (exchange == 'binance')?'BTCUSDT':'BTCUSD';
		var BTCUSDTPRICEPromise = listCurrentMarketPrice(globalCoin,exchange);
		var responsePromise = await  Promise.all([currentMarketPricePromise,BTCUSDTPRICEPromise]);
		
		var currentMarketPriceArr = (typeof responsePromise[0][0] =='undefined')?[]:responsePromise[0][0];
		

		let currentMarketPrice = (typeof (currentMarketPriceArr.price) =='undefined')?0:currentMarketPriceArr.price;


		var btcPriceArr = (typeof responsePromise[1][0] =='undefined')?[]:responsePromise[1][0];
		var BTCUSDTPRICE =(exchange == 'binance')?btcPriceArr.market_value:btcPriceArr.price;

		var convertToBtc = orderListing[index].quantity * currentMarketPrice;
		var coinPriceInBtc = BTCUSDTPRICE*convertToBtc
		var order = orderListing[index];
			order['customCurrentMarketPrice'] = parseFloat(currentMarketPrice).toFixed(8);
			
		let buy_trail_price = (typeof orderListing[index].buy_trail_price =='undefined')?0:orderListing[index].buy_trail_price;
			order['buy_trail_price_custom'] = (orderListing[index].trail_check =='yes')?(parseFloat(buy_trail_price).toFixed(8)):'---';

			let actualPurchasePrice = (orderListing[index].status !='new' && orderListing[index].status !='eror')?parseFloat(orderListing[index].market_value).toFixed(8):parseFloat(currentMarketPrice).toFixed(8);

			order['actualPurchasePrice'] = isNaN(actualPurchasePrice)?'---':actualPurchasePrice;
			order['coinPriceInBtc'] = parseFloat(coinPriceInBtc).toFixed(2);

			let market_sold_price = (typeof orderListing[index].market_sold_price =='undefined')?0:orderListing[index].market_sold_price;

			order['actualSoldPrice'] = parseFloat(isNaN(market_sold_price)?'---':market_sold_price).toFixed(8);

			
			

			var htmlStatus = '';

			var status = (typeof orderListing[index].status =='undefined')?'':orderListing[index].status
			var is_sell_order = (typeof orderListing[index].is_sell_order =='undefined')?'':orderListing[index].is_sell_order;
			var sellOrderId = (typeof orderListing[index].sell_order_id !='undefined')?orderListing[index].sell_order_id:'';
			var is_lth_order = (typeof orderListing[index].is_lth_order =='undefined')?'':orderListing[index].is_lth_order
			var fraction_sell_type = (typeof orderListing[index].fraction_sell_type =='undefined')?'':orderListing[index].fraction_sell_type;
			var fraction_buy_type = (typeof orderListing[index].fraction_buy_type =='undefined')?'':orderListing[index].fraction_buy_type;

			


			var sell_profit_percent = (typeof orderListing[index].sell_profit_percent =='undefined')?'':orderListing[index].sell_profit_percent;
			var lth_profit = (typeof orderListing[index].lth_profit =='undefined')?'':orderListing[index].lth_profit;
			var targetPrice = (status == 'LTH')?lth_profit:sell_profit_percent;
			order['targetPrice'] =  (targetPrice =='')?'---':targetPrice;
			
			var orderSellPrice = (typeof orderListing[index].market_sold_price =='undefined' || orderListing[index].market_sold_price == '')?'':orderListing[index].market_sold_price;
			var orderPurchasePrice = (typeof orderListing[index].market_value =='undefined' || orderListing[index].market_value =='')?0:orderListing[index].market_value;
			var profitLossPercentageHtml = '';
			if(orderSellPrice !=''){
				let profitLossPercentage = calculate_percentage(orderPurchasePrice,orderSellPrice);
				let profitLossCls = (orderSellPrice > orderPurchasePrice)?'success':'danger';
				profitLossPercentageHtml = '<span class="text-'+profitLossCls+'"><b>'+profitLossPercentage+ '%</b></span>';
			}else{
				if (status== 'FILLED' || status == 'LTH') {
					if (is_sell_order == 'yes' || status == 'LTH') {
							let percentage = calculate_percentage(orderPurchasePrice,currentMarketPrice);
							let PLCls = (currentMarketPrice >orderPurchasePrice)?'success':'danger'
							profitLossPercentageHtml = '<span class="text-' +PLCls+ '"><b>' +percentage+ '%</b></span>';
					} else {
						profitLossPercentageHtml = '<span class="text-default"><b>---</b></span>';
					}
				} else {
					profitLossPercentageHtml = '<span class="text-default"><b>-</b></span>';
				}
			}//End of profit loss Percentage
			

			order['profitLossPercentageHtml'] = profitLossPercentageHtml;

		

			if ((status == 'FILLED' && is_sell_order == 'yes') || status == "LTH") {
				var SellStatus = (sellOrderId =='')?'':await listSellOrderStatus(sellOrderId);
				if(SellStatus == 'error'){
					htmlStatus += '<span class="badge badge-danger">ERROR IN SELL</span>';
				}else if(SellStatus =='submitted'){
					htmlStatus += '<span class="badge badge-success">SUBMITTED FOR SELL</span>';
				}else{
					htmlStatus += '<span class="badge badge-info">WAITING FOR SELL</span>';
				}
			}else if (status == 'FILLED' && is_sell_order == 'sold') {
				if (is_lth_order== 'yes') {
					htmlStatus += '<span class="badge badge-warning">LTH</span><span class="badge badge-success">Sold</span>';
				} else {
					htmlStatus += '<span class="badge badge-success">Sold</span>';
				}
			}else{
				var  statusClass = (status =='error')?'danger':'success'
				htmlStatus += '<span class="badge badge-'+statusClass+'">'+status+  '</span>';
			}

			if (fraction_sell_type == 'parent' || fraction_sell_type == 'child') {
				htmlStatus += '<span class="badge badge-warning" style="margin-left:4px;">Sell Fraction</span>';
			} else if (fraction_buy_type == 'parent' || fraction_buy_type == 'child') {
				htmlStatus += '<span class="badge badge-warning" style="margin-left:4px;">Buy Fraction</span>';
			}


			order['htmlStatus'] = htmlStatus;
			customOrderListing.push(order)
	}//End of order Iteration

	var response = {};
		response['customOrderListing'] = customOrderListing;
		response['countArr'] = countArr;
		response['userBalanceArr'] = userBalanceArr;
		response['avg_profit'] = avg_profit;
	resp.status(200).send({
		message: response
	});
})//End of listOrderListing


function listUserBalance(admin_id){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			let where = {};
				where['user_id'] = admin_id;
			db.collection('user_wallet').find(where).toArray((err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result);
				}
			})
		})
	})
}//End of listUserBalance


function calculate_percentage(purchasedPrice,sellPrice) {
	let diff = sellPrice - purchasedPrice;
	if(purchasedPrice ==0){
		return 0;
	}else{
		let profitPercentage = (diff*100)/purchasedPrice;
		return profitPercentage = parseFloat(profitPercentage).toFixed(2)
	}

}

function listSellOrderStatus(sellOrderId){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			let where  = {};
			const checkForHexRegExp = new RegExp('^[0-9a-fA-F]{24}$');
				where['_id'] = (checkForHexRegExp.test(sellOrderId))?{'$in':[sellOrderId,new ObjectID(sellOrderId)]}:'';
			db.collection('orders').find(where).toArray((err,result)=>{
				if(err){
					resolve(err)
				}else{
					if(result.length > 0){
						let status = (typeof result[0]['status'] !='undefined')?result[0]['status']:''
						resolve(status);
					}else{
						resolve('')
					}
				}
			})
		})
	})
}//End of listSellOrderStatus



function countCollection(collectionName,filter){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			db.collection(collectionName).find(filter).count((err,result)=>{
				if(err){
					console.log(err)
				}else{
					resolve(result)
				}
			})
		})
	})
}//End of countCollection




function calculateAverageOrdersProfit(postDAta){
	var filter = {};
	filter['application_mode'] = postDAta.application_mode
	filter['admin_id'] = postDAta.admin_id

	if(postDAta.coins !=''){
		filter['symbol'] = {'$in':postDAta.coins} 
	}

	if(postDAta.order_type !=''){
		filter['order_type'] = postDAta.order_type
	}

	if(postDAta.trigger_type !=''){
		filter['trigger_type'] = postDAta.trigger_type
	}

	if(postDAta.order_level !=''){
		filter['order_level'] = postDAta.order_level
	}


	if(postDAta.start_date !='' && postDAta.end_date !=''){
		let start_date = new Date(postDAta.start_date);
		let end_date = new Date(postDAta.end_date);
		filter['created_date'] = {'$gte':start_date},{'$lte':end_date}
	}

	var collectionName = 'sold_buy_orders';

	return new Promise((resolve)=>{
		conn.then((db)=>{
			db.collection(collectionName).find(filter).sort( { modified_date: -1 } ).toArray((err,result)=>{
				if(err){
					console.log(err)
				}else{
					resolve(result)
				}
			})
		})
	})
}//End of calculateAverageOrdersProfit


function listOrderListing(postDAta,dbConnection){

	var filter = {};	
	var pagination = {};
	var limit = postDAta.limit;
	var skip = postDAta.skip;
	var exchange = postDAta.exchange;
		filter['application_mode'] = postDAta.application_mode
		filter['admin_id'] = postDAta.admin_id
		var collectionName = (exchange =='binance')?'buy_orders':'buy_orders_'+exchange;
		if(postDAta.coins !=''){
			filter['symbol'] = {'$in':postDAta.coins} 
		}

		if(postDAta.order_type !=''){
			filter['order_type'] = postDAta.order_type
		}

		if(postDAta.trigger_type !=''){
			filter['trigger_type'] = postDAta.trigger_type
		}

		if(postDAta.order_level !=''){
			filter['order_level'] = postDAta.order_level
		}


		if(postDAta.start_date !='' && postDAta.end_date !=''){
			let start_date = new Date(postDAta.start_date);
			let end_date = new Date(postDAta.end_date);
			filter['created_date'] = {'$gte':start_date},{'$lte':end_date}
		}

		if(postDAta.status == 'open'){
			filter['status'] = {'$in':['submitted', 'FILLED']}
			filter['is_sell_order'] = 'yes';
		}


		if(postDAta.status == 'filled'){
			filter['status'] = {'$in':['submitted', 'FILLED']}
		}



		if(postDAta.status == 'sold'){
			filter['status'] = 'FILLED'
			filter['is_sell_order'] = 'sold';
			var collectionName = (exchange =='binance')?'sold_buy_orders':'sold_buy_orders_'+exchange;
		}


		if(postDAta.status == 'parent'){
			filter['parent_status'] = 'parent'
			filter['status'] = 'new';
		}


		if(postDAta.status == 'LTH'){
			filter['status'] = 'LTH';
			filter['is_sell_order'] = 'yes';
		}


		if(postDAta.status == 'new'){
			filter['status'] = 'new';
			filter['price'] = {'$ne':''};
		}

		if(postDAta.status == 'canceled'){
			filter['status'] = 'canceled';
		}

		if(postDAta.status == 'submitted'){
			filter['status'] = 'submitted';
		}
		

		

		return new Promise((resolve)=>{
			conn.then((db)=>{
				db.collection(collectionName).find(filter,pagination).limit(limit).skip(skip).sort( { modified_date: -1 } ).toArray((err,result)=>{
					if(err){
						console.log(err)
					}else{
						resolve(result)
					}
				})
			})
		})
}//End of listOrderListing




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


router.post('/playOrder',async (req,resp)=>{
	var playPromise = pausePlayParentOrder(req.body.orderId,req.body.status);
	let show_hide_log = 'yes';	
	let type = 'play pause';	
	let log_msg = "Parent Order was ACTIVE Manually";
	var LogPromise = recordOrderLog(req.body.orderId,log_msg,type,show_hide_log)
	var promiseResponse = await Promise.all([playPromise,LogPromise]);
	resp.status(200).send({
		message: promiseResponse
	});
})//End of playOrder


function pausePlayParentOrder(orderId,status){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			let filter = {};
			filter['_id'] = new ObjectID(orderId);
			let set = {};
				set['$set'] = {'pause_status':status}

			db.collection('buy_orders').updateOne(filter,set,(err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result);
				}
			})
		})
	})
}//End of listGlobalCoins


function recordOrderLog(order_id,log_msg,type,show_hide_log,exchange){
    return new Promise((resolve,reject)=>{
        conn.then((db)=>{
		  /** */
		  let collectionName = (exchange == 'binance')?'orders_history_log': 'orders_history_log_'+exchange; 
          let insertArr = {};
              insertArr['order_id'] = new ObjectID(order_id);
              insertArr['log_msg'] = log_msg;
              insertArr['type'] = type;
              insertArr['show_error_log'] = show_hide_log;
              insertArr['created_date'] = new Date();
              db.collection(collectionName).insertOne(insertArr,(err,success)=>{
                  if(err){
                    reject(err)
                  }else{
                    resolve(success.result)
                  }
              })
          /** */
        })
    })
}//End of function(recordOrderLogQuery)

router.post('/listOrderDetail',async (req,resp)=>{
	let orderId = req.body.orderId;
	let exchange = req.body.exchange;
	var ordeResp = await listOrderById(orderId,exchange); 
	var orderArr = {} 
	if(ordeResp.length >0){
		var orderArr = ordeResp[0];
		var sell_auto_manual = "";
		if(typeof orderArr['is_sell_order'] !== 'undefined' && orderArr['is_sell_order'] == 'sold'){
			if (typeof orderArr['is_manual_sold'] !== 'undefined' && orderArr['is_manual_sold'] == 'yes') {
                sell_auto_manual = "manual";
            } else {
                sell_auto_manual = "auto";
            }
		}

		orderArr['sell_auto_manual'] = sell_auto_manual;

		var coutnChilds = 0;
		if(typeof orderArr['parent_status'] !== 'undefined' && orderArr['parent_status'] == 'parent'){
			var collectionName = (exchange =='binance')?'buy_orders':'buy_orders_'+exchange;
			var filter = {};
				filter['buy_parent_id'] = new ObjectID(orderId);
			var coutnChilds = await countCollection(collectionName,filter);
		}
		orderArr['coutnChilds'] = coutnChilds;
	}//end of length greater then zero


	resp.status(200).send({
		message: orderArr
	})
})//End of listOrderDetail
//*********************************************************== */

function listOrderById(orderId,exchange){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			var where = {};
				where['_id'] = new  ObjectID(orderId);
			var collectionName = (exchange == 'binance')?'buy_orders':'buy_orders_'+exchange;	
			db.collection(collectionName).find(where).toArray((err,result)=>{
				if(err){
					resolve(err)
				}else{
					if(result.length >0){
						resolve(result)
					}else{
						var collectionName_2 = (exchange == 'binance')?'sold_buy_orders':'sold_buy_orders_'+exchange;
						db.collection(collectionName_2).find(where).toArray((err,result)=>{
							if(err){
								resolve(err)
							}else{
								resolve(result)
							}
						})
					}
				}//End of else of buy order empty
			})
		})
	})
}//End of listOrderById


router.post('/deleteOrder',async (req,resp)=>{
	var respPromise =  deleteOrder(req.body.orderId);
	let show_hide_log = 'yes';	
	let type = 'buy_canceled';	
	let log_msg = "Buy Order was Canceled";
	var LogPromise = recordOrderLog(req.body.orderId,log_msg,type,show_hide_log)
	var promiseResponse = await Promise.all([LogPromise,respPromise]);
	resp.status(200).send({
		message: promiseResponse
	});

})//End of deleteOrder

function deleteOrder(orderId){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			let filter = {};
				filter['_id'] = new ObjectID(orderId);
			let set = {};
				set['$set'] = {'status':'canceled','modified_date':new Date()}
			db.collection('buy_orders').updateOne(filter,set,(err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result);
				}
			})
		})
	})
}//End of deleteOrder

router.post('/orderMoveToLth',async (req,resp)=>{
	let exchange = req.body.exchange;
	let orderId = req.body.orderId;
	let lth_profit = req.body.lth_profit;
	var respPromise =  orderMoveToLth(orderId,lth_profit,exchange);
	let show_hide_log = 'yes';	
	let type = 'move_lth';	
	let log_msg = 'Buy Order was Moved to <strong> LONG TERM HOLD </strong>  <span style="color:yellow;    font-size: 14px;"><b>Manually</b></span> ';
	var LogPromise = recordOrderLog(req.body.orderId,log_msg,type,show_hide_log,exchange)
	var promiseResponse = await Promise.all([LogPromise,respPromise]);
	resp.status(200).send({
		message: promiseResponse
	});

})//End of orderMoveToLth


function orderMoveToLth(orderId,lth_profit,exchange){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			let filter = {};
				filter['_id'] = new ObjectID(orderId);
			let set = {};
				set['$set'] = {'status':'LTH','lth_profit':lth_profit,'lth_functionality':'yes','modified_date':new Date()}
				let collection = 'buy_orders_'+exchange;
			db.collection(collection).updateOne(filter,set,(err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result);
				}
			})
		})
	})
}//End of orderMoveToLth



router.post('/listOrderById',async (req,resp)=>{
	let orderId = req.body.orderId;
	let exchange = req.body.exchange;
	var ordeRespPromise =  listOrderById(orderId,exchange); 
	var ordrLogPromise =  listOrderLog(orderId,exchange); 

	var resolvepromise = await Promise.all([ordeRespPromise,ordrLogPromise]);
	var respArr = {};
		respArr['ordeArr'] = resolvepromise[0];
	let html = '';
	let ordeLog = resolvepromise[1];
	var index = 1;
		for(let row in ordeLog){
			index +=parseFloat(row);
			let date = new Date(ordeLog[row].created_date).toISOString().
			replace(/T/, ' ').      // replace T with a space
			replace(/\..+/, '') 

			html +='<tr>';
			html +='<th scope="row" class="text-danger">'+index+'</th>';
			html +='<td>'+ordeLog[row].log_msg+'</td>';
			html +='<td>'+date+'</td>'
			html +='</tr>';
		}

		respArr['logHtml'] = html;

	resp.status(200).send({
		message: respArr
	});
})//End of listOrderById


function listOrderLog(orderId,exchange){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			var where = {};
			    where['order_id'] = {'$in':[orderId,new ObjectID(orderId)]};
			var collection = (exchange == 'binance')?'orders_history_log':'orders_history_log_'+exchange;
			db.collection(collection).find(where).sort( { _id: -1 } ).toArray((err,result)=>{
				if(err){
					resolve(err);
				}else{
					resolve(result);
				}
			})
		})
	})
}//End of listOrderLog


router.post('/sellOrderManually' , async (req,resp)=>{

	let orderId = req.body.orderId;
	let currentMarketPrice = req.body.currentMarketPriceByCoin;
	let exchange = req.body.exchange;
	let collectionName =  (exchange == 'binance')?'buy_orders':'buy_orders_'+exchange;
	
	var ordeResp = await listOrderById(orderId,exchange); 
	if(ordeResp.length >0){

		let buyOrderArr = ordeResp[0];
		let sell_order_id = (typeof buyOrderArr['sell_order_id'] == undefined)?'':buyOrderArr['sell_order_id'];
		if(sell_order_id !=''){	
			let application_mode = (typeof buyOrderArr['application_mode'] == undefined)?'':buyOrderArr['application_mode'];
			let buy_order_id = buyOrderArr['_id'];
			let quantity = (typeof buyOrderArr['quantity'] == undefined)?'':buyOrderArr['quantity'];
			let coin_symbol = (typeof buyOrderArr['symbol'] == undefined)?'':buyOrderArr['symbol'];
			let admin_id = (typeof buyOrderArr['admin_id'] == undefined)?'':buyOrderArr['admin_id'];
			var trading_ip = await listUsrIp(admin_id);

			var log_msg = ' Order Has been sent for  <span style="color:yellow;font-size: 14px;"><b>Sold Manually</b></span> by Sell Now';
			var logPromise = recordOrderLog(buy_order_id,log_msg,'sell_manually','yes',exchange);


			var log_msg ='Send Market Orde for sell by Ip: <b>'+trading_ip+'</b> ';
			var logPromise_2 = recordOrderLog(buy_order_id,log_msg,'order_ip','no',exchange);

			var update_1 = {};
			update_1['modified_date'] = new Date(); 
			update_1['is_manual_sold'] = 'yes';
			var filter_1 = {};
			filter_1['_id'] = {$in:[orderId,new ObjectID(orderId)]} 

			var collectionName_1 = (exchange == 'binance')?'orders':'orders_'+exchange;

			console.log('collectionName_1 ',collectionName_1)
			var updatePromise_1 = updateOne(filter_1,update_1,collectionName_1);

			var collectionName_2 = (exchange == 'binance')?'buy_orders':'buy_orders_'+exchange;;
			update_1['status'] = 'FILLED';
			var updatePromise_2 = updateOne(filter_1,update_1,collectionName_2);
			var resolvePromise = Promise.all([updatePromise_1,updatePromise_2,logPromise,logPromise_2]);

			if(application_mode == 'live'){
				var log_msg = "Market Order Send For Sell On:  "+ parseFloat(currentMarketPrice).toFixed(8);
				var logPromise_1 = recordOrderLog(buy_order_id,log_msg,'sell_manually','yes',exchange);
				logPromise_1.then((resp)=>{})

				var SellOrderResolve = readySellOrderbyIp(sell_order_id, quantity,currentMarketPrice, coin_symbol,admin_id, buy_order_id,trading_ip, 'barrier_percentile_trigger', 'sell_market_order',exchange);

				SellOrderResolve.then((resp)=>{})
			}else{
				//End of test
				var log_msg = "Market Order Send For Sell On **:  "+ parseFloat(currentMarketPrice).toFixed(8);
				var logPromise_1 = recordOrderLog(buy_order_id,log_msg,'sell_manually','yes',exchange);
				logPromise_1.then((resp)=>{})

				sellTestOrder(sell_order_id,currentMarketPrice, buy_order_id,exchange);
				
			}
		}//End of if sell order id not empty	
	}//Order Arr End 


	resp.status(200).send({
		message: ordeResp
	});

})//End of sellOrderManually



function updateOne(filter,update,collectionName){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			let set = {};
				set['$set'] = update;
			db.collection(collectionName).updateOne(filter,set,(err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result)
				}
			})
		})
	})	
}//End of updateCollection


function listUsrIp(admin_id){
    return new Promise((resolve,reject)=>{
        conn.then((db)=>{
          let searchCriteria = {};
			  searchCriteria['_id'] = new ObjectID(admin_id)
			  
              db.collection('users').find(searchCriteria).toArray((err,success)=>{
                if(err){
                    resolve(err)
                }else{
                    var trading_ip = '';

                    if(success.length >0){
                        trading_ip = success[0]['trading_ip'];
                    }
                    resolve(trading_ip);
                }
              })
        })
    })
}//End of listUsrIp


function readySellOrderbyIp(order_id,quantity,market_price,coin_symbol,admin_id, buy_orders_id,trading_ip,trigger_type,type,exchange){
    return new Promise((resolve)=>{
        conn.then((db)=>{
            var insert_arr  = {};
            insert_arr['order_id'] = order_id;
            insert_arr['quantity'] = quantity;
            insert_arr['market_price'] = market_price;
            insert_arr['coin_symbol'] = coin_symbol;
            insert_arr['admin_id'] = admin_id;
            insert_arr['buy_orders_id'] = buy_orders_id;
            insert_arr['trading_ip'] = trading_ip;
            insert_arr['trigger_type'] = trigger_type;
            insert_arr['order_type'] = type;
            insert_arr['order_status'] = 'ready';
            insert_arr['global'] = 'global';
			insert_arr['created_date'] = new Date(); 
			let collection = (exchange == 'binance')?'ready_orders_for_sell_ip_based':'ready_orders_for_sell_ip_based_'+exchange;
            db.collection(collection).insertOne(insert_arr,(err,result)=>{
                if(err){
                    resolve(err)
                }else{
                    resolve(result)
                }
            })
        })
    })
}//End of readySellOrderbyIp

function sellTestOrder(sell_order_id,currentMarketPrice,buy_order_id,exchange){
	 
		(async ()=>{
			var collectionName =  (exchange == 'binance')?'orders':'orders_'+exchange;
			var search = {};
				search['_id'] = new ObjectID(sell_order_id);
				//search['status'] = {'$in':['new','LTH']}

			var orderResp = await find(collectionName,search); 	
			if(orderResp.length >0){

				var orderArr = orderResp[0];

				var quantity = (typeof orderArr['quantity'] =='undefined')?0:orderArr['quantity'];
				var symbol = (typeof orderArr['symbol'] =='undefined')?'':orderArr['symbol'];

				var update = {};
					update['market_value'] = currentMarketPrice;
					update['status'] = 'submitted';
					update['modified_date'] = new Date();
					update['sell_date'] = new Date(); 
					update['binance_order_id'] = '111000';

				var filter = {};
					filter['_id'] = new ObjectID(sell_order_id)
		
				var collectionName = (exchange == 'binance')?'orders':'orders_'+exchange;
				var updatePromise_1 = updateOne(filter,update,collectionName);
					updatePromise_1.then((resp)=>{})
				var log_msg = "Sell Market Order was <b>SUBMITTED</b>";
				var logPromise_1 = recordOrderLog(buy_order_id,log_msg,'sell_order_submitted','yes',exchange);
					logPromise_1.then((resp)=>{})


				//%%%%%%%%%%% Market Filled Process %%%%%%%%%%%%%%%%%%
				var commission_value = parseFloat(quantity) * (0.001);
				var commission = commission_value*currentMarketPrice;
				var commissionAsset = 'BTC';

				let globalCoin = (exchange == 'binance')?'BTCUSDT':'BTCUSD';
	
				var USDCURRENTVALUE = await listCurrentMarketPrice(globalCoin,exchange);

				var btcPriceArr = (typeof USDCURRENTVALUE[0] =='undefined')?[]:USDCURRENTVALUE[0];
		         var BTCUSDTPRICE =(exchange == 'binance')?btcPriceArr.currentMarketPrice:btcPriceArr.price;


				let splitArr =   symbol.split('USDT');
				var sellUsdPrice = (quantity * currentMarketPrice)*BTCUSDTPRICE;
				var sellUsdPrice = (typeof splitArr[1] !='undefined' && splitArr[1] == '')?quantity:sellUsdPrice;            
	
				var upd_data = {};
					upd_data['is_sell_order'] = 'sold';
					upd_data['market_sold_price'] = parseFloat(currentMarketPrice);
					upd_data['status'] = 'FILLED';
					upd_data['trading_status'] = 'complete';
					upd_data['market_sold_price_usd'] = sellUsdPrice;
					upd_data['modified_date'] = new Date();
				
					
				var collectionName = 'buy_orders_'+exchange;
				var where = {};
					where['sell_order_id'] = {$in:[new ObjectID(sell_order_id),sell_order_id]};
				var  updtPromise_1 = updateOne(where,upd_data,collectionName);
					updtPromise_1.then((callback)=>{})
	
	
				var collectionName = 'orders_'+exchange;
				var where = {};
				var updOrder = {};
					updOrder['status'] = 'FILLED';
					updOrder['market_value'] = parseFloat(currentMarketPrice);
					where['_id'] = new ObjectID(sell_order_id)
				var  updtPromise_1 = updateOne(where,updOrder,collectionName);
						 updtPromise_1.then((callback)=>{})    
		 
		 
				var log_msg = "Sell Market Order is <b>FILLED</b> at price "+parseFloat(currentMarketPrice).toFixed(8);
				var logPromise_3 = recordOrderLog(buy_order_id,log_msg,'market_filled','yes',exchange);
						logPromise_3.then((callback)=>{})
		
				var log_msg = "Broker Fee <b>"+parseFloat(commission).toFixed(8)+" From " +commissionAsset +"</b> has token on this Trade";
				var logPromise_3 = recordOrderLog(buy_order_id,log_msg,'sell_filled','yes',exchange);
				logPromise_3.then((callback)=>{})

				copySoldOrders(buy_order_id,exchange);

			}	
		})()
}//End of sellTestOrder

function find(collectionName,search){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			db.collection(collectionName).find(search).toArray((err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result)
				}
			})
		})
	})
}//End of findOne


router.post('/buyOrderManually',async (req,resp)=>{
	var orderId = req.body.orderId;
	var coin = req.body.coin;
	var exchange = req.body.exchange;
	var ordeResp = await listOrderById(orderId,exchange); 
	
	if(ordeResp.length >0){
		var orderArr = ordeResp[0];
		let admin_id = (typeof orderArr['admin_id'] == undefined)?'':orderArr['admin_id'];
		let status = (typeof orderArr['status'] == undefined)?'':orderArr['status'];
		let application_mode = (typeof orderArr['application_mode'] == undefined)?'':orderArr['application_mode'];

		let buy_quantity = (typeof orderArr['quantity'] == undefined)?'':orderArr['quantity'];
		let symbol = (typeof orderArr['symbol'] == undefined)?'':orderArr['symbol'];

		let buy_trigger_type = (typeof orderArr['trigger_type'] == undefined)?'':orderArr['trigger_type'];

		var trading_ip = await listUsrIp(admin_id);

		if(status == 'new'){
			var update = {};
			update['modified_date'] = new Date(); 
			update['is_manual_buy'] = 'yes';
			var filter = {};
			filter['_id'] = new ObjectID(orderId); 
			let collectionName = (exchange == 'binance')?'buy_orders':'buy_orders_'+exchange;
			var updatePromise_1 = updateOne(filter,update,collectionName);
			var currentMarketPrice =  await listCurrentMarketPrice(symbol,exchange);
			if(application_mode == 'live'){
				let buy_trigger_type = '';
				var respPromise = orderReadyForBuy(orderId,buy_quantity,currentMarketPrice,symbol,admin_id,trading_ip,buy_trigger_type,'buy_market_order',exchange);
				respPromise.then((callback)=>{})
			}else{
				buyTestOrder(orderArr,currentMarketPrice,exchange);
			}
		}//End of if status is new


		resp.status(200).send({
			message: 'response comming'
		});

	}//End of Order length 
})//End of buyOrderManually




function buyTestOrder(orders,market_value,exchange){
	(async ()=>{
		if (orders['status'] == 'new') {
			var quantity = orders['quantity'];
			var sell_order_id = (typeof orders['sell_order_id'] =='undefined')?'':orders['sell_order_id'];
			var symbol = (typeof orders['symbol'] =='undefined')?'':orders['symbol'];
			var id = (typeof orders['_id'] =='undefined')?'':orders['_id'];
		
			

			var symbol = orders['symbol'];
			let upd = {};
				upd['market_value'] = market_value;
				upd['status'] = 'submitted';
				upd['modified_date'] = new Date();
				upd['buy_date'] = new Date()
			var collectionName = (exchange == 'binance')?'buy_orders':'buy_orders_'+exchange;
			var where = {};
				where['_id'] = new ObjectID(id)
			var  updPromise = updateOne(where,upd,collectionName);
				updPromise.then((callback)=>{})
			var log_msg = "Buy Market Order was <b>SUBMITTED</b>";
			var logPromise = recordOrderLog(id,log_msg,'submitted','yes',exchange);
				logPromise.then((callback)=>{
					console.log(callback)
				})

			//%%%%%%%%%%% Market Filled Process %%%%%%%%%%%%%%%%%%
			var commission = parseFloat(quantity) * (0.001);
			let splitUSDT =   symbol.split('USDT');
			let splitBTC =   symbol.split('BTC');
			var commissionAsset = (typeof splitUSDT[1] == 'undefined')?splitBTC[0]:splitUSDT[0];
			var sellQty = quantity-commission;

			var log_msg = "Broker Fee <b>" +commission.toFixed(3)+"</b> Has been deducted from sell quantity ";
			var logPromise_1 = recordOrderLog(id,log_msg,'fee_deduction','yes',exchange);
			logPromise_1.then((callback)=>{})


			var log_msg = "Order Quantity Updated from <b>("+quantity+")</b> To  <b>(" +sellQty+ ')</b> Due to Deduction Binance Fee from buying Coin';
			var logPromise_2 = recordOrderLog(id,log_msg,'fee_deduction','yes',exchange);
			logPromise_2.then((callback)=>{})


			var USDCURRENTVALUE =  await listCurrentMarketPrice('BTCUSD',exchange);
			let splitArr =   symbol.split('USDT');
			var purchaseUsdPrice = (quantity * market_value)*USDCURRENTVALUE;
			var purchaseUsdPrice = (typeof splitArr[1] !='undefined' && splitArr[1] == '')?quantity:purchaseUsdPrice;


			var upd_data = {};
				upd_data['status'] = 'FILLED';
				upd_data['market_value'] = parseFloat(market_value);
				upd_data['purchased_price'] = market_value;
				upd_data['market_value_usd'] = purchaseUsdPrice;
				upd_data['modified_date'] = new Date();
				upd_data['buy_date'] = new Date()

			var collectionName = (exchange == 'binance')?'buy_orders':'buy_orders_'+exchange;
			var where = {};
				where['_id'] = new ObjectID(id)
			var  updtPromise_1 = updateOne(where,upd_data,collectionName);
				updtPromise_1.then((callback)=>{})

		if(sell_order_id !=''){
			var updOrder = {};
				updOrder['purchased_price'] = parseFloat(market_value);
				updOrder['quantity'] = sellQty;

				var collectionName =  (exchange == 'binance')?'orders':'orders_'+exchange; 
	
				var where_1 = {};
					where_1['_id'] = new ObjectID(sell_order_id)
				var  updtPromise_1 = updateOne(where_1,updOrder,collectionName);
					updtPromise_1.then((callback)=>{})
		}


		var log_msg = "Buy Market Order is <b>FILLED</b> at price "+parseFloat(market_value).toFixed(8);
		var logPromise_3 = recordOrderLog(id,log_msg,'market_filled','yes',exchange);
				logPromise_3.then((callback)=>{})

		var log_msg = "Broker Fee <b>"+commission.toFixed(8)+" From " +commissionAsset +"</b> has token on this Trade";
		var logPromise_3 = recordOrderLog(id,log_msg,'market_filled','yes',exchange);
		logPromise_3.then((callback)=>{})



		//************ -- Make Order From Auto Sell -- *******


		var auto_sell = (typeof orders['auto_sell'] =='undefined')?'':orders['auto_sell'];
			if(auto_sell == 'yes'){
				createOrderFromAutoSell(orders,exchange);
			}//if auto sell is yes
		
		//End of Crate Auto Sell 



		} //End if Order is New
	
	})()
}//End of buyTestOrder


function createOrderFromAutoSell (orderArr,exchange){
	var buy_order_id = orderArr['_id'];
	var auto_sell = (typeof orderArr['auto_sell'] == 'undefined')?'':orderArr['auto_sell'];
	var admin_id = (typeof orderArr['admin_id'] == 'undefined')?'':orderArr['admin_id'];
	var symbol = (typeof orderArr['symbol'] == 'undefined')?'':orderArr['symbol'];
	var binance_order_id = (typeof orderArr['binance_order_id'] == 'undefined')?'':orderArr['binance_order_id'];
	var purchased_price = (typeof orderArr['market_value'] == 'undefined')?'':orderArr['market_value'];

	(async()=>{
	////////////////////////////////////////////////////////////////////////
		if (auto_sell == 'yes') {
		var buy_order_check = 'yes';
		//Get Sell Temp Data
		var respArr =  await listTempSellOrder(buy_order_id,exchange);
		var sell_data_arr = (typeof respArr[0] =='undefined')?[]:respArr[0];
		var profit_type = (typeof sell_data_arr['profit_type'] =='undefined')?'':sell_data_arr['profit_type'];
		var sell_profit_percent = (typeof sell_data_arr['profit_percent'] =='undefined')?'':sell_data_arr['profit_percent'];
		var sell_profit_price = (typeof  sell_data_arr['profit_price'] =='undefined')?'':sell_data_arr['profit_price'];
		var order_type = (typeof sell_data_arr['order_type'] =='undefined')?'':sell_data_arr['order_type'];
		var trail_check = (typeof  sell_data_arr['trail_check'] == 'undefined')?'':sell_data_arr['trail_check'];
		var trail_interval = (typeof sell_data_arr['trail_interval'] == 'undefined')?'':sell_data_arr['trail_interval'];
		var stop_loss =  (typeof  sell_data_arr['stop_loss'] =='undefined')?'': sell_data_arr['stop_loss'];
		var loss_percentage = (typeof sell_data_arr['loss_percentage'] =='undefined')?'':sell_data_arr['loss_percentage'];
		var application_mode = (typeof sell_data_arr['application_mode'] == 'undefined')?'':sell_data_arr['application_mode'];
		var lth_functionality = (typeof sell_data_arr['lth_functionality'] =='undefined')?'':sell_data_arr['lth_functionality'];

		var tempArr = {};
			tempArr['symbol'] = symbol;
			tempArr['purchased_price'] = purchased_price;
			tempArr['quantity'] = quantity;
			tempArr['profit_type'] = profit_type;
			tempArr['order_type'] = order_type;
			tempArr['admin_id'] = admin_id;
			tempArr['buy_order_check'] = buy_order_check;
			tempArr['buy_order_id'] = buy_order_id;
			tempArr['buy_order_binance_id'] = binance_order_id;
			tempArr['stop_loss'] = stop_loss;
			tempArr['lth_functionality'] = lth_functionality;
			tempArr['loss_percentage'] = loss_percentage;
			tempArr['application_mode'] = application_mode
			tempArr['trigger_type'] = 'no';
			tempArr['modified_date'] = new Date();
			tempArr['created_date'] = new Date();
		
		var ins_data = {};
		if (profit_type == 'percentage') {
			var sell_price = purchased_price * sell_profit_percent;
			var sell_price = sell_price / 100;
			var sell_price = sell_price + purchased_price;
			var sell_price =  parseFloat(sell_price).toFixed(8)
			ins_data['sell_profit_percent'] = sell_profit_percent;
			ins_data['sell_price'] = sell_price;
		} else {
			var sell_price = sell_profit_price;
				ins_data['sell_profit_price'] = sell_profit_price;
				ins_data['sell_price'] = sell_price;
		}
		if (trail_check != '') {
			ins_data['trail_check'] = 'yes';
			ins_data['trail_interval'] = trail_interval;
			ins_data['sell_trail_price'] = sell_price;
			ins_data['status'] = 'new';
		} else {
			ins_data['trail_check'] = 'no';
			ins_data['trail_interval'] = '0';
			ins_data['sell_trail_price'] = '0';
			ins_data['status'] = 'new';
		}
		
		var collectionName = 'orders_'+exchange;
		var  order_id =  await createOrder(collectionName,ins_data);
		if (buy_order_check == 'yes') {
			//Update Buy Order
			var upd_data = {};
				upd_data['is_sell_order'] = 'yes';
				upd_data['lth_functionality'] = lth_functionality;
				upd_data['sell_order_id'] = order_id;
			var collectionName = 'buy_orders_'+exchange;
			var where = {};
				where['_id'] = new ObjectID(buy_order_id)
				var upsert = {'upsert':true};	  
			var  updPromise = updateSingle(collectionName,where,upd,upsert);
				updPromise.then((callback)=>{})
		}

		var log_msg = "Sell Order was Created from Auto Sell";

		var logPromise = recordOrderLog(buy_order_id,log_msg,'create_sell_order','yes',exchange);
		logPromise.then((callback)=>{})
		} // if($auto_sell =='yes')	
	////////////////////////////////////////////////////////////////////////
	})
  
}//End of createOrderFromAutoSell


function createOrder(collectionName,ins_data){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			db.collection(collectionName).insertOne(ins_data,(err,result)=>{
				if(err){
				  resolve(err)
				}else{
				  resolve(result.insertedId)
				}
			})
		})
	})
}//End of createOrder




function listTempSellOrder(buy_order_id,exchange){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			let where = {};
				where['buy_order_id'] = {$in:[buy_order_id,new ObjectID(order_id)]}
			let collection = 'temp_sell_orders_'+exchange;
			db.collection(collection).find(where).toArray((err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result);
				}
			})
		})
	})
}//End of listTempSellOrder


function orderReadyForBuy (buy_order_id,buy_quantity,market_value,coin_symbol,admin_id,trading_ip,trigger_type,type,exchange){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			var insert_arr = {};
			insert_arr['buy_order_id'] = buy_order_id;
			insert_arr['buy_quantity'] = buy_quantity;
			insert_arr['market_value'] = market_value;
			insert_arr['coin_symbol'] = coin_symbol;
			insert_arr['admin_id'] =    admin_id;
			insert_arr['trading_ip'] =  trading_ip;
			insert_arr['trigger_type'] = trigger_type;
			insert_arr['order_type'] = type;
			insert_arr['order_status'] = 'ready';
			insert_arr['created_date'] = new Date();
			insert_arr['global'] = 'global';
			let collection = (exchange == 'binance')?'ready_orders_for_buy_ip_based':'ready_orders_for_buy_ip_based_'+exchange;
			db.collection(collection).insertOne(insert_arr,(err,result)=>{
				if(err){
					resolve(err)
				}else{
					resolve(result.insertedId);
				}
			})
		})
	})
}//End of orderReadyForBuy



function listSoldOrders(primaryID,exchange){
    return new Promise ((resolve)=>{
      conn.then((db)=>{
        let searchCriteria  = {};
        searchCriteria.status = 'FILLED';
        searchCriteria.is_sell_order = 'sold';
        searchCriteria.is_order_copyed = {'$ne':'yes'};
		if(primaryID !=''){searchCriteria._id = primaryID;}
		let collection = 'buy_orders_'+exchange;
        db.collection(collection).find(searchCriteria).limit(500).toArray((err,result)=>{
          if(err){
            resolve(err)
          }else{
              resolve(result);
          }
        })
      })
    })
  }//End of listSoldOrders

  function copySoldOrders(order_id,exchange){
    conn.then((db)=>{

		(async ()=>{
          let soldOrdersArr = await listSoldOrders(order_id,exchange);
          if(typeof soldOrdersArr !='undefined' && soldOrdersArr.length >0){
            let collection = 'sold_buy_orders_'+exchange;
            for(let index in soldOrdersArr){
              let _id = soldOrdersArr[index]['_id'];
              let searchQuery = {};
                  searchQuery._id = _id;
              let updateQuery = {};
                  updateQuery = soldOrdersArr[index];
              let upsert  = {};
                  upsert.upsert= true;
			  var deletePromise = deleteBuyOrders(order_id,exchange);
			  	  deletePromise.then((callback)=>{})
			  var updSingle = updateSingle(collection,searchQuery,updateQuery,upsert);
			 	  updSingle.then((callback)=>{})
            }
		  }
		})()  
        
    }).catch((err)=>{
      throw err
    })
  }//End of copySoldOrders


 function deleteBuyOrders (_id,exchange){
	return new Promise((resolve)=>{
		conn.then((db)=>{
		  let searchCriteria = {};
			  searchCriteria._id = _id;
			  let collection = 'buy_orders_'+exchange;
		  db.collection(collection).deleteOne(searchCriteria,(err,response)=>{
			if(err){
			  resolve(err)
			}else{
			  resolve(response)
			}
		  })
		}).catch((err)=>{
		  throw(err);
		})
	})
}//End of deleteBuyOrders


function updateSingle(collection,searchQuery,updateQuery,upsert){
    return new Promise((resolve)=>{
      conn.then((db)=>{
        let set = {};
            set['$set'] = updateQuery;
        db.collection(collection).updateOne(searchQuery,set,upsert,(err,success)=>{
          if(err){
            resolve(err);
          }else{
            resolve(success);
          }
        })
      })
    })
  }//End of update

  router.post('/listOrdersForChart',async (req,resp)=>{
		var admin_id = req.body.admin_id;
		var exchange = req.body.exchange;
		var application_mode = req.body.application_mode;
		var coin = req.body.coin;

		var newArr = [];
		let ordersArr = await listOrdersForChart(admin_id,exchange,application_mode,coin);
			for(let row in ordersArr){
				let newRow = {};
				let trigger_type = ordersArr[row].trigger_type;
				let defined_sell_percentage = (typeof ordersArr[row].defined_sell_percentage =='undefined')?0:ordersArr[row].defined_sell_percentage;
				let sell_profit_percent = (typeof ordersArr[row].sell_profit_percent =='undefined')?0:ordersArr[row].sell_profit_percent;
				let profitPercentage = (defined_sell_percentage == 0)?sell_profit_percent:defined_sell_percentage;

				let price = (ordersArr[row].price);
				let status =  ordersArr[row].status;
				let quantity = ordersArr[row].quantity;

				newRow['quantity'] = quantity;
			
				let sell_order_id = (typeof ordersArr[row].sell_order_id =='undefined')?'':ordersArr[row].sell_order_id;

				var buyOrderId = ordersArr[row]._id;

				newRow['_id'] = ordersArr[row]._id;
				newRow['price'] = (price).toFixed(8);
				newRow['trigger_type'] = ordersArr[row].trigger_type;  

				newArr['auto_sell'] = ordersArr[row].auto_sell;

				let auto_sell = (typeof ordersArr[row].auto_sell =='undefined')?'':ordersArr[row].auto_sell;
				
				if(trigger_type !='no'){
					let calculateSellPrice = price+((price/100)*profitPercentage);
					newRow['profit_price_'] = parseFloat(calculateSellPrice).toFixed(8);
					let lsPrice = isNaN(ordersArr[row].iniatial_trail_stop)?0:ordersArr[row].iniatial_trail_stop;
					lsPrice = parseFloat(lsPrice).toFixed(8);
					newRow['loss_price_'] =  lsPrice;
				}else{

					if(auto_sell =='no'){
						newRow['profit_price_'] = null;
						newRow['loss_price_'] = null;
					}else{


						if(sell_order_id == 0){
							var sellOrder = [];
						}else{
							var sellOrder = await listSellOrderById(sell_order_id,exchange);
						}


						if(sellOrder.length >0){
							let sellOrderArr = sellOrder[0];
							let stop_loss = (typeof sellOrderArr.stop_loss =='undefined')?null:sellOrderArr.stop_loss;

							stop_loss = isNaN(stop_loss)?0:stop_loss;

							let sell_price = (typeof sellOrderArr.sell_price =='undefined')?null:sellOrderArr.sell_price;
							sell_price = isNaN(sell_price)?0:sell_price;

							newRow['loss_price_'] = parseFloat(stop_loss).toFixed(8);
							newRow['profit_price_'] = parseInt(sell_price).toFixed(8);

						}else{

							console.log('::::::::::::::::::::::')
							console.log('buyOrderId',buyOrderId)
							console.log('::::::::::::::::::::::')
							let tempArrResp = await listselTempOrders(buyOrderId,exchange);
							if(tempArrResp.length >0){

								let tempArr = tempArrResp[0];
								let stop_loss = (typeof tempArr.stop_loss =='undefined')?0:tempArr.stop_loss;

								stop_loss = isNaN(stop_loss)?0:stop_loss;

								let profit_price = (typeof tempArr.profit_price =='undefined')?null:tempArr.profit_price;
								profit_price = isNaN(profit_price)?0:profit_price;

								newRow['loss_price_'] = parseFloat(stop_loss).toFixed(8);
								newRow['profit_price_'] = parseFloat(profit_price).toFixed(8);
							}else{
								newRow['loss_price_'] = null;
								newRow['profit_price_'] =  null;
							}

						
						}

					}

				}
				
				if(status == 'new'){
					newRow['profit_status'] = 'yes';
					newRow['loss_status'] = 'no';
				}else{
					newRow['profit_status'] = 'no';
					newRow['loss_status'] = 'yes';
				}
				newArr.push(newRow);
				
			}


		resp.status(200).send({
			message:newArr
		})
		
  })

  function listOrdersForChart(admin_id,exchange,application_mode,coin){
	return new Promise((resolve)=>{
		let filter = {}; 
			filter['status'] = {'$in':['submitted', 'FILLED','new']}
			filter['price'] = {$nin:[null,""]};
			filter['admin_id'] = admin_id;
			filter['application_mode'] = application_mode;
			filter['symbol'] = coin;
		conn.then((db)=>{
			let collection = (exchange =='binance')?'buy_orders':'buy_orders_'+exchange;
			db.collection(collection).find(filter).toArray((err,result)=>{
				if(err){
					resolve(err);
				}else{
					resolve(result);
				}
			})//End of collection
		})//End of conn
	})//End of Promise
  }//End of listOrdersForChart


  function listSellOrderById(ID,exchange){
	return new Promise((resolve)=>{
		let filter = {}; 
			filter['_id'] = new ObjectID(ID);
		conn.then((db)=>{
			let collection = (exchange =='binance')?'orders':'orders_'+exchange;
			db.collection(collection).find(filter).toArray((err,result)=>{
				if(err){
					resolve(err);
				}else{
					resolve(result);
				}
			})//End of collection
		})//End of conn
	})//End of Promise
  }//End of listSellOrderById


  function listselTempOrders(ID,exchange){
	return new Promise((resolve)=>{
		let filter = {}; 
			filter['buy_order_id'] = (ID == '' || ID == undefined || ID ==null)?ID:new ObjectID(ID);
		conn.then((db)=>{
			var collection = (exchange == 'binance')?'temp_sell_orders':'temp_sell_orders_'+exchange;
			db.collection(collection).find(filter).toArray((err,result)=>{
				if(err){
					resolve(err);
				}else{
					resolve(result);
				}
			})//End of collection
		})//End of conn
	})//End of Promise
  }//End of listselTempOrders


  router.post('/updateOrderfromdraging',async (req,resp)=>{
	  var exchange =  req.body.exchange;
	  var orderId =  req.body.orderId;
	  var side =  req.body.side;
	  var updated_price =  req.body.updated_price;

	  var message = '';

	  var orderArr = await  listOrderById(orderId,exchange);
		if(orderArr.length >0){
			for(let index in orderArr){
				var orderid = orderArr[index]['_id'];
				var trigger_type = orderArr[index]['trigger_type'];
				var buy_price = orderArr[index]['price'];
				var previous_sell_price = (typeof orderArr[index]['sell_price'] == 'undefined')?0:orderArr[index]['sell_price'];

				var admin_id =  (typeof orderArr[index]['admin_id'] == 'undefined')?0:orderArr[index]['admin_id'];

				var application_mode = (typeof orderArr[index]['admin_id'] == 'undefined')?0:orderArr[index]['admin_id'];

				var sell_order_id = (typeof orderArr[index]['sell_order_id'] == 'undefined')?'':orderArr[index]['sell_order_id'];


				var auto_sell = (typeof orderArr[index]['auto_sell'] == 'undefined')?'':orderArr[index]['auto_sell'];


				if(trigger_type !='no'){
					let iniatial_trail_stop = (typeof orderArr[index]['iniatial_trail_stop'] == 'undefined')?0:orderArr[index]['iniatial_trail_stop'];

					let sell_profit_percent = (typeof orderArr[index]['sell_profit_percent'] == 'undefined')?0:orderArr[index]['sell_profit_percent'];

					var current_data2222 = updated_price - buy_price;
					var calculate_new_sell_percentage = (current_data2222 * 100 / buy_price);
					
					calculate_new_sell_percentage = isNaN(calculate_new_sell_percentage)?0:calculate_new_sell_percentage;

				 
					//:::::::::::::::: triggers :::::::::::::::::::
					if(side == 'profit_inBall'){
						message = ' Auto Order Sell Price Changed';
						var filter = {};
						filter['_id'] = new ObjectID(orderId);
						var update = {};	
						update['sell_price'] = updated_price;
						update['modified_date'] = new Date();
						update['sell_profit_percent'] = calculate_new_sell_percentage
						update['defined_sell_percentage'] = calculate_new_sell_percentage;
						var collectionName = (exchange == 'binance')?'buy_orders':'buy_orders'+exchange;
						var updatePromise = updateOne(filter,update,collectionName);
						updatePromise.then((resolve)=>{});
		
						
						var log_msg = "Order Sell price updated from("+parseFloat(previous_sell_price).toFixed(8)+") to "+parseFloat(updated_price).toFixed(8)+"  From Chart";
						var logPromise = recordOrderLog(orderId,log_msg,'create_sell_order','yes',exchange);
						logPromise.then((callback)=>{})


						var log_msg_1 = "Order Profit percentage Change From("+sell_profit_percent+") To ("+calculate_new_sell_percentage+")  From Chart";
						var logPromise_1 = recordOrderLog(orderId,log_msg_1,'order_profit_percentage_change','yes',exchange);
						logPromise_1.then((callback)=>{})

					}else{//End of side
						
						message = "Auto Order stop Loss Changed";
						var filter = {};
						filter['_id'] = new ObjectID(orderId);
						var update = {};	
						update['iniatial_trail_stop'] =  parseFloat(updated_price);
						update['modified_date'] = new Date();
						var collectionName = (exchange == 'binance')?'buy_orders':'buy_orders'+exchange;
						var updatePromise = updateOne(filter,update,collectionName);
						updatePromise.then((resolve)=>{});
		
						
						var log_msg = "Order Stop Loss Updated From("+parseFloat(iniatial_trail_stop).toFixed(8)+") to "+parseFloat(updated_price).toFixed(8)+"  From Chart";
						var logPromise = recordOrderLog(orderId,log_msg,'order_stop_loss_change','yes',exchange);
						logPromise.then((callback)=>{})
					}
					//:::::::::::::::: triggers :::::::::::::::::::
				}else{//End of trigger type
					//:::::::::::::::::Manual Trading :::::::::::::::::

					if(sell_order_id !=''){

						;
						var sellOrderResp = listSellOrderById(sell_order_id,exchange);
						var sellOrderArr = (typeof sellOrderResp[0] == 'undefined')?[]:sellOrderResp[0];
						var sell_profit_percent = (typeof sellOrderArr.sell_profit_percent =='undefined')?'':sellOrderArr.sell_profit_percent;
						var sell_price = (typeof sellOrderArr.sell_price =='undefined')?'':sellOrderArr.sell_price;
						var stop_loss = (typeof sellOrderArr.stop_loss =='undefined')?'':sellOrderArr.stop_loss;
						var loss_percentage = (typeof sellOrderArr.loss_percentage =='undefined')?'':sellOrderArr.loss_percentage;
						var purchased_price = (typeof sellOrderArr.purchased_price =='undefined')?'':sellOrderArr.purchased_price;
						var current_data2222 = updated_price - purchased_price;
						var calculate_new_sell_percentage = (current_data2222 * 100 / purchased_price);

						calculate_new_sell_percentage = isNaN(calculate_new_sell_percentage)?0:calculate_new_sell_percentage


						if(side == 'profit_inBall'){
							message = "Manual Order  Profit price Changed"
							var filter = {};
							filter['_id'] = new ObjectID(sell_order_id);
							var update = {};	
							update['sell_price'] = updated_price;
							update['modified_date'] = new Date();
							update['sell_profit_percent'] = calculate_new_sell_percentage
							var collectionName = (exchange == 'binance')?'orders':'orders'+exchange;
							var updatePromise = updateOne(filter,update,collectionName);
							updatePromise.then((resolve)=>{});
			
							
							var log_msg = "Order sell price Updated from("+parseFloat(sell_price).toFixed(8)+") to "+parseFloat(updated_price).toFixed(8)+"  From Chart";
							var logPromise = recordOrderLog(orderId,log_msg,'create_sell_order','yes',exchange);
							logPromise.then((callback)=>{})
	
	
							var log_msg_1 = "Order Profit percentage Change From("+sell_profit_percent+") To ("+calculate_new_sell_percentage+")  From Chart";
							var logPromise_1 = recordOrderLog(orderId,log_msg_1,'order_profit_percentage_change','yes',exchange);
							logPromise_1.then((callback)=>{})
						}else{//End of profitable side
							message = "Manual Order  stop loss price Changed";
						   var current_data2222 = purchased_price - updated_price;
						   var stop_loss_percentage = (current_data2222 * 100 / updated_price);


							var filter = {};
							filter['_id'] = new ObjectID(sell_order_id);
							var update = {};	
							update['stop_loss'] =  parseFloat(updated_price);
							update['modified_date'] = new Date();
							var collectionName = (exchange == 'binance')?'orders':'orders'+exchange;
							var updatePromise = updateOne(filter,update,collectionName);
							updatePromise.then((resolve)=>{});
			
							
							var log_msg = "Order Stop Loss Updated From("+parseFloat(stop_loss).toFixed(8)+") to "+parseFloat(updated_price).toFixed(8)+"  From Chart";
							var logPromise = recordOrderLog(orderId,log_msg,'order_stop_loss_change','yes',exchange);
							logPromise.then((callback)=>{});


							var log_msg_1 = "Order stop Loss percentage Change From("+loss_percentage+") To ("+stop_loss_percentage+")  From Chart";
							var logPromise_1 = recordOrderLog(orderId,log_msg_1,'order_stop_loss_percentage_change','yes',exchange);
							logPromise_1.then((callback)=>{})

						}//End of Stop Loss part




 

					}else{//End of if sell order Exist 
						
						//:::::::::::::::::::
						if(auto_sell == 'no'){
							var filter = {};
							filter['_id'] = new ObjectID(orderId);
							var update = {};	
							update['auto_sell'] =  'yes';
							update['modified_date'] = new Date();
							var collectionName = (exchange == 'binance')?'buy_orders':'buy_orders'+exchange;
							var updatePromise = updateOne(filter,update,collectionName);
							updatePromise.then((resolve)=>{});

							var temp_arr = {};

							var current_data2222 = updated_price - buy_price;
							var sell_profit_percent = (current_data2222 * 100 / buy_price);
						   sell_profit_percent = isNaN(sell_profit_percent)?0:sell_profit_percent;


		
						   if(side == 'profit_inBall'){

							   message = "Manual Order profit price changed and order Set to Auto Sell"; 
								temp_arr['profit_percent'] = sell_profit_percent;
								temp_arr['profit_price'] = updated_price;
								

								var log_msg = "Order profit percentage set to ("+sell_profit_percent+") %";
								var logPromise = recordOrderLog(orderId,log_msg,'order_stop_loss_change','yes',exchange);
								logPromise.then((callback)=>{})


								var log_msg = "Order profit price set to ("+updated_price+") %";
								var logPromise = recordOrderLog(orderId,log_msg,'order_profit','yes',exchange);
								logPromise.then((callback)=>{})


						   }else{
							message = "Manual Order stoploss price changed and order Set to Auto Sell"
								var current_data2222 = buy_price - updated_price  ;
								var loss_percentage = (current_data2222 * 100 / updated_price);
								loss_percentage = isNaN(loss_percentage)?0:loss_percentage;
								temp_arr['stop_loss'] = updated_price,
								temp_arr['loss_percentage'] = loss_percentage;


								var log_msg = "Order stop loss percentage set to ("+loss_percentage+") % From Chart";
								var logPromise = recordOrderLog(orderId,log_msg,'order_stop_loss_change','yes',exchange);
								logPromise.then((callback)=>{})


								var log_msg = "Order stop loss  set to ("+updated_price+") % From Chart";
								var logPromise = recordOrderLog(orderId,log_msg,'order_profit','yes',exchange);
								logPromise.then((callback)=>{})
						   }
						  
							temp_arr['buy_order_id'] = new ObjectID(orderId);;
							temp_arr['profit_type'] = 'percentage';
							temp_arr['order_type'] = 'market_order';
							temp_arr['trail_check']= 'no';
							temp_arr['trail_interval'] = 0;
							temp_arr['sell_trail_percentage'] =0;
						
							temp_arr['admin_id'] = admin_id;
							temp_arr['lth_functionality'] = '';
							temp_arr['application_mode'] = application_mode;
							temp_arr['created_date'] = new Date();
							temp_arr['modified_date'] = new Date();

							var log_msg = "Order Change Fron Normal to Auto Sell From Chart";
							var logPromise = recordOrderLog(orderId,log_msg,'order_stop_loss_change','yes',exchange);
							logPromise.then((callback)=>{})



							var log_msg = "Order Change Fron Normal to Auto Sell From Chart";
							var logPromise = recordOrderLog(orderId,log_msg,'order_stop_loss_change','yes',exchange);
							logPromise.then((callback)=>{})

							
							var collection = (exchange == 'binance')?'temp_sell_orders':'temp_sell_orders_'+exchange;
							conn.then((db)=>{
								db.collection(collection).insertOne(temp_arr,(error,result)=>{
									if(error){
										console.log(error)
									}else{
		
									}
								})
							})
						
					    }else{//End of auto sell is no
							//:::::::::::::::: update temp order arr

							var current_data2222 = updated_price - buy_price;
							var sell_profit_percent = (current_data2222 * 100 / buy_price);
						   sell_profit_percent = isNaN(sell_profit_percent)?0:sell_profit_percent;

						   var update ={};
						   update['modified_date'] = new Date();
						   var collectionName = (exchange == 'binance')?'buy_orders':'buy_orders'+exchange;
						   var filter = {};
								filter['_id'] = new ObjectID(orderId);

						   var updatePromise = updateOne(filter,update,collectionName);
						   updatePromise.then((resolve)=>{});


							var upd_temp = {};
						   if(side == 'profit_inBall'){

								upd_temp['profit_percent'] = sell_profit_percent;
								upd_temp['profit_price'] = updated_price;

								var filter = {};
									filter['buy_order_id'] = new ObjectID(orderId);
								var collection = (exchange == 'binance')?'temp_sell_orders':'temp_sell_orders_'+exchange;
								var updatePromise = updateOne(filter,upd_temp,collection);
								updatePromise.then((resolve)=>{});
								

								var log_msg = "Order profit percentage set to ("+sell_profit_percent+") % From Chart";
								var logPromise = recordOrderLog(orderId,log_msg,'order_stop_loss_change','yes',exchange);
								logPromise.then((callback)=>{})


								var log_msg = "Order profit price set to ("+updated_price+") % From Chart";
								var logPromise = recordOrderLog(orderId,log_msg,'order_profit','yes',exchange);
								logPromise.then((callback)=>{})


								


						   }else{
							    message = "Manual Order stoploss price changed and order Set to Auto Sell"
								var current_data2222 = buy_price - updated_price  ;
								var loss_percentage = (current_data2222 * 100 / updated_price);
								loss_percentage = isNaN(loss_percentage)?0:loss_percentage;
								var upd_temp = {};
								upd_temp['stop_loss'] = updated_price;
								upd_temp['loss_percentage'] = loss_percentage;


								var filter = {};
									filter['buy_order_id'] = new ObjectID(orderId);
								var collection = (exchange == 'binance')?'temp_sell_orders':'temp_sell_orders_'+exchange;
								var updatePromise = updateOne(filter,upd_temp,collection);
								updatePromise.then((resolve)=>{});

								var log_msg = "Order stop loss percentage set to ("+loss_percentage+") % From Chart";
								var logPromise = recordOrderLog(orderId,log_msg,'order_stop_loss_change','yes',exchange);
								logPromise.then((callback)=>{})


								var log_msg = "Order stop loss  set to ("+updated_price+") % From Chart";
								var logPromise = recordOrderLog(orderId,log_msg,'order_profit','yes',exchange);
								logPromise.then((callback)=>{})
						   }

							//:::::::::::::::: End of temp Orser Arr
						}
						//::::::::::::::
					}//End of sell order not exist

					//:::::::::::::::::End Of Manual Trading :::::::::::::::::
				}
			}//End of foreach
		}//End of order array is not empty


	  resp.status(200).send({
		message:message
	})


  })//End of updateOrderfromdraging

  

  function listSellOrderByBuyOrderId(ID,exchange){
	return new Promise((resolve)=>{
		let filter = {}; 
			filter['_id'] = {'$in':[ID,new ObjectID(ID)]};
		conn.then((db)=>{
			let collection = (exchange =='binance')?'orders':'orders_'+exchange;
			db.collection(collection).find(filter).toArray((err,result)=>{
				if(err){
					resolve(err);
				}else{
					resolve(result);
				}
			})//End of collection
		})//End of conn
	})//End of Promise
  }//End of listSellOrderByBuyOrderId

module.exports = router;


