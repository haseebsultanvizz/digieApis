var conn = require('../connection/database');
const express = require('express')
var app = express()
var cron = require('node-cron');
ObjectID = require('mongodb').ObjectID;
var app = express();



console.log("klsfhdlksjdflkj")
var start;
console.log(conn);


//cron.schedule('* * * * * *', ()=> {
    conn.then(db => {
        console.log(db, "====")
        start = new Date()
        console.log("satrted")
        calculate_coin_meta("XRPBTC", db);
        // let coins_arr = await get_all_coins(db);
        // coins_arr.forEach(async symbol => {
        // 	calculate_coin_meta(symbol, db);
        // }); 
    })
//})


console.log("lkdflkdjf")

//%%%%%%%%%%%%%%%%%%%%%%%%%%%% - Start of Function : Chart3 - %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
async function calculate_coin_meta(coin_symbol, db) { //start of : function chart3
	//%%%%%%%%%%%%%%%%%% Start of Promise object -> To be used to return Promises within Promises in a Function definition %%%%%%%%%%%%%%%%%%
	return new Promise(function (resolve, reject) {
		var coin_info = db.collection('coins').findOne({
			"symbol": coin_symbol,"user_id": "global"
		});
		var coin_current_market_json = db.collection('market_prices').find({
			"coin": coin_symbol
		}).sort({
			'created_date': -1
		}).limit(1).toArray();

		var market_chart_json = db.collection('market_chart').find({ "coin": coin_symbol , 'global_swing_parent_status': {$in : ['LL', 'HH', 'LH', 'HL']}}).sort({ 'timestampDate': -1 }).limit(1).toArray();
		//%%%%%%%%%%%%%%%%%%%%%%%%%%%% - Start of Promise 1 of 3 in Function : Chart3 - %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
		Promise.all([
			coin_current_market_json,
			coin_info,
			market_chart_json
		]).then(async val => {
			//%%%% Some Variable Initializations
			let current_market_json = val[0][0];
			let coin_info_json = val[1];
			let market_chart = val[2][0];
			let last_hour_start = market_chart['timestampDate'];
			let offset_value = parseInt(coin_info_json['offset_value']);
			let unit_value = coin_info_json['unit_value'];

			let black_wall_amount = coin_info_json['depth_wall_amount'];
			let black_wall_percentage = coin_info_json['depth_wall_percentage'];

			let yellow_wall_amount = coin_info_json['yellow_wall_amount'];
			let yellow_wall_percentage = coin_info_json['yellow_wall_percentage'];

			let limit = 50 * offset_value;

			let current_market_value = current_market_json['price'];
			console.log(coin_symbol, " ",offset_value, "=====> json coin info "," ",limit, "=========> limit")
			//%%%%%%%%%%%%%%%%%%%%%%%%%%%% - Aggregation Queries to avoid duplications from market_depth - %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
			let pipeline_bid = [{
					'$project': {
						"price": 1,
						"quantity": 1,
						"type": 1,
						"coin": 1,
						'created_date': 1,
					},
				},
				{
					'$match': {
						'coin': String(coin_symbol),
						'type': 'bid',
						'price': {
							'$lte': parseFloat(current_market_value)
						},
					},
				},
				{
					'$sort': {
						'created_date': -1
					}
				},
				{
					'$group': {
						_id: {
							price: '$price'
						},
						quantity: {
							$first: '$quantity'
						},
						type: {
							$first: '$type'
						},
						coin: {
							$first: '$coin'
						},
						created_date: {
							$first: '$created_date'
						},
						price: {
							$first: '$price'
						}
					},
				},
				{
					'$sort': {
						'price': -1
					}
				},
				{
					'$limit': limit
				},
			];
			let pipeline_ask = [{
					'$project': {
						"price": 1,
						"quantity": 1,
						"type": 1,
						"coin": 1,
						'created_date': 1,
					},
				},
				{
					'$match': {
						'coin': String(coin_symbol),
						'type': 'ask',
						'price': {
							$gte: parseFloat(current_market_value)
						},
					},
				},
				{
					'$sort': {
						'created_date': -1
					}
				},
				{
					'$group': {
						_id: {
							price: '$price'
						},
						quantity: {
							$first: '$quantity'
						},
						type: {
							$first: '$type'
						},
						coin: {
							$first: '$coin'
						},
						created_date: {
							$first: '$created_date'
						},
						price: {
							$first: '$price'
						}
					},
				},
				{
					'$sort': {
						'price': 1
					}
				},
				{
					'$limit': limit
				},
			];
			//%%%%%%%%%%%%%%%%%%%%%%%%%%% Market Depth Bid/Ask Queries %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
			let order_book_bid_query = db.collection('market_depth').aggregate(pipeline_bid).toArray();
			let order_book_ask_query = db.collection('market_depth').aggregate(pipeline_ask).toArray();
			//%%%%%%%%%%%%%%%%%%%%%%%%%%%% - market_trades bid/ask Queries - %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
			let trade_history_bid_query = db.collection('market_trades').find({
				'coin': coin_symbol,
				'type': 'bid',
				'created_date': {
					$gte: last_hour_start
				}
			}).toArray();
			let trade_history_ask_query = db.collection('market_trades').find({
				'coin': coin_symbol,
				'type': 'ask',
				'created_date': {
					$gte: last_hour_start
				}
			}).toArray();
			//%%%%%%%%%%%%%%%%%%%%%%%%%%%% - Start of Promise 2 of 3 in Function : Chart3 - %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
			Promise.all([
				order_book_ask_query,
				order_book_bid_query,
				trade_history_bid_query,
				trade_history_ask_query
			]).then(async queries_promise_resp => {
				//%%%%%%%%%%%%%%%%%%%%%%%%%- Get values from promise response array - %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
				order_book_ask_values = queries_promise_resp[0];
				order_book_bid_values = queries_promise_resp[1];
				trade_history_bid_values = queries_promise_resp[2];
				trade_history_ask_values = queries_promise_resp[3];

				//%%%%%%%%%%%%%%%%%%%%%%%%%- Price_list_bid and Price_list_ask - %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
				var price_list_bid = []; //Temporary bid price list containing all 150 prices
				var price_list_ask = []; //Temporary ask price list containing all 150 prices

				////console.log(order_book_ask_values);
				let best_bid = order_book_bid_values[0]['price']
				let best_ask = order_book_ask_values[order_book_ask_values.length -1]['price']

				//	console.log(best_bid, "======> best bid", best_ask, "======> best ask");

				price_list_bid.push(best_bid);
				price_list_ask.push(best_ask);

				//taking the value of last index of price_list_bid array (i.e. best_bid already added) to add unit_value to it and push them to price_list_bid
				for (let i = 0; i < limit - 1; i++) { //%%%%%%%%%%%  Start of for %%%%%%%%%%% ->limit - 1, because 1 value is already added

					let price_list_bid_last_index = price_list_bid.length - 1;
					let price_list_ask_last_index = price_list_ask.length - 1;

					let price_list_bid_last_index_value = price_list_bid[price_list_bid_last_index];
					let price_list_ask_last_index_value = price_list_ask[price_list_ask_last_index];

					let price_to_add_bid = parseFloat(price_list_bid_last_index_value) - parseFloat(unit_value);
					let price_to_add_ask = parseFloat(price_list_ask_last_index_value) + parseFloat(unit_value);

					price_list_bid.push(parseFloat(price_to_add_bid.toFixed(8))); //toFixed() is used to round float numbers in javascript
					price_list_ask.push(parseFloat(price_to_add_ask.toFixed(8)));
				} //%%%%%%% End of for %%%%%%%%%%

				//%%%%%%%%%%%%- Main bid and ask unchunked array -%%%%%%%%%%%%
				var main_bid_json_arr = [];
				var main_ask_json_arr = [];
				var count = 0; //For Testing : Count the FOR LOOP
				//%%%%%%%%%%% Start of for : for OrderBook Bid Quantities %%%%%%%%%%%%
				for (let i = 0; i < price_list_bid.length; i++) {
					var flag = false;
					var bid_json = {};
					for (let j = 0; j < order_book_bid_values.length; j++) {
						if (parseFloat(price_list_bid[i]) == parseFloat(order_book_bid_values[j].price)) {
							bid_json['price'] = order_book_bid_values[j]['price'];
							bid_json['order_book_bid_quantity'] = order_book_bid_values[j]['quantity'];
							main_bid_json_arr.push([bid_json]);
							flag = true;
							count++;
						}
					}
					if (flag == false) {
						bid_json = {};
						bid_json['price'] = price_list_bid[i];
						bid_json['order_book_bid_quantity'] = 0.0;
						main_bid_json_arr.push([bid_json]);
					}
				} //%%%%%%%%%%% End of for %%%%%%%%%%%% : for OrderBook Bid Quantities

				//%%%%%%%%%%% Start of for loop %%%%%%%%%%%%% : for orderbook ask / ask quantities
				for (let i = 0; i < price_list_ask.length; i++) {
					var flag = false;
					var ask_json = {};
					for (let j = 0; j < order_book_ask_values.length; j++) {
						if (parseFloat(price_list_ask[i]) == parseFloat(order_book_ask_values[j].price)) {
							ask_json['price'] = order_book_ask_values[j]['price'];
							ask_json['order_book_ask_quantity'] = order_book_ask_values[j]['quantity'];
							main_ask_json_arr.push([ask_json]);
							flag = true;
							count++;
						}
					}
					if (flag == false) {
						ask_json = {};
						ask_json['price'] = price_list_ask[i];
						ask_json['order_book_ask_quantity'] = 0.0;
						main_ask_json_arr.push([ask_json]);
					}
				} //%%%%%%%%%%% End of for loop %%%%%%%%%%%% : for OrderBook Ask / Ask Quantities

				//%%%%%%%%%%%%%% Start of for loop %%%%%%%%%%%%% : For Trade History Bid / Bid Quantities
				for (let i = 0; i < price_list_bid.length; i++) {
					var flag = false;
					for (let j = 0; j < trade_history_bid_values.length; j++) {
						if (parseFloat( [i]) == parseFloat(trade_history_bid_values[j].price)) {
							if (isNaN(main_bid_json_arr[i][0]['trade_bid_quantity'])) {
								main_bid_json_arr[i][0]['trade_bid_quantity'] = parseFloat(trade_history_bid_values[j].quantity);
								flag = true;
								count++;
							} else {
								main_bid_json_arr[i][0]['trade_bid_quantity'] = parseFloat(trade_history_bid_values[j].quantity) + parseFloat(main_bid_json_arr[i][0]['trade_bid_quantity']);
								flag = true;
								count++;
							}
						}
					}
					if (flag == false) {
						main_bid_json_arr[i][0]['trade_bid_quantity'] = 0.0;
					}
				} //%%%%%%%%%%%%%% End of for loop %%%%%%%%%%%%%%%% : For Trade History Bid / Bid Quantities

				//%%%%%%%%%%%%%% Start of for loop %%%%%%%%%%%%%%%% : for trade history bid / ask quantities
				for (let i = 0; i < price_list_bid.length; i++) {
					var flag = false;
					for (let j = 0; j < trade_history_ask_values.length; j++) {
						if (parseFloat(price_list_bid[i]) == parseFloat(trade_history_ask_values[j].price)) {
							if (isNaN(main_bid_json_arr[i][0]['trade_ask_quantity'])) {
								main_bid_json_arr[i][0]['trade_ask_quantity'] = parseFloat(trade_history_ask_values[j].quantity);
								flag = true;
								count++;
							} else {
								main_bid_json_arr[i][0]['trade_ask_quantity'] = parseFloat(trade_history_ask_values[j].quantity) + parseFloat(main_bid_json_arr[i][0]['trade_ask_quantity']);
								flag = true;
								count++;
							}
						}
					}
					if (flag == false) {
						main_bid_json_arr[i][0]['trade_ask_quantity'] = 0.0;
					}
				} //%%%%%%%%%%%%%% End of for loop %%%%%%%%%%%%%%%% : for trade history bid / ask quantities

				//%%%%%%%%%%%%%% Start of for loop %%%%%%%%%%%%%%%% : for trade history ask / bid quantities
				for (let i = 0; i < price_list_ask.length; i++) {
					var flag = false;
					for (let j = 0; j < trade_history_bid_values.length; j++) {
						if (parseFloat(price_list_ask[i]) == parseFloat(trade_history_bid_values[j].price)) {
							if (isNaN(main_ask_json_arr[i][0]['trade_bid_quantity'])) {
								main_ask_json_arr[i][0]['trade_bid_quantity'] = parseFloat(trade_history_bid_values[j].quantity);
								flag = true;
								count++;
							} else {
								main_ask_json_arr[i][0]['trade_bid_quantity'] = parseFloat(trade_history_bid_values[j].quantity) + parseFloat(main_ask_json_arr[i][0]['trade_bid_quantity']);
								flag = true;
								count++;
							}
						}
					}
					if (flag == false) {
						main_ask_json_arr[i][0]['trade_bid_quantity'] = 0.0;
					}
				} //%%%%%%%%%%%%%% End of for loop %%%%%%%%%%%%%%%% : for trade history ask / bid quantities
				//%%%%%%%%%%%%%% Start of for loop %%%%%%%%%%%%%%%% for trade history ask / ask quantities
				for (let i = 0; i < price_list_ask.length; i++) {
					var flag = false;
					for (let j = 0; j < trade_history_ask_values.length; j++) {
						if (parseFloat(price_list_ask[i]) == parseFloat(trade_history_ask_values[j].price)) {
							if (isNaN(main_ask_json_arr[i][0]['trade_ask_quantity'])) {
								main_ask_json_arr[i][0]['trade_ask_quantity'] = parseFloat(trade_history_ask_values[j].quantity);
								flag = true;
								count++;
							} else {
								main_ask_json_arr[i][0]['trade_ask_quantity'] = parseFloat(trade_history_ask_values[j].quantity) + parseFloat(main_ask_json_arr[i][0]['trade_ask_quantity']);
								flag = true;
								count++;
							}
						}
					}
					if (flag == false) {
						main_ask_json_arr[i][0]['trade_ask_quantity'] = 0.0;
					}
				} //%%%%%%%%%%%%%% End of for loop %%%%%%%%%%%%%%%% : for trade history ask / ask quantities

				//%%%%%%%%%%%% Final Chunked Array %%%%%%%%%%%%%
				var final_chart3_json_arr_bid = [];
				var final_chart3_json_arr_ask = [];
				//%%%%%%%%%%%% Start of FOR LOOP : Chunking of main_bid_json_arr Array  %%%%%%%%%%%%% 
				for (let i = 0; i < main_bid_json_arr.length; i = i + offset_value) {
					let data = {}

					var ob_bid_quantity_arr = [];
					var trd_ask_quantity_arr = [];
					var trd_bid_quantity_arr = [];

					for (let t = 0; t < parseInt(offset_value); t++) {
						if (typeof main_bid_json_arr[t + i][0].order_book_bid_quantity == 'number') {
							let v = main_bid_json_arr[t + i][0].order_book_bid_quantity;
							ob_bid_quantity_arr.push(v);
						}
					}

					for (let t = 0; t < parseInt(offset_value); t++) {
						if (typeof main_bid_json_arr[t + i][0].trade_ask_quantity == 'number') {
							let v = main_bid_json_arr[t + i][0].trade_ask_quantity;
							trd_ask_quantity_arr.push(v)
						}
					}

					for (let t = 0; t < parseInt(offset_value); t++) {
						if (typeof main_bid_json_arr[t + i][0].trade_bid_quantity == 'number') {
							let v = main_bid_json_arr[t + i][0].trade_bid_quantity;
							trd_bid_quantity_arr.push(v)
						}
					}

					data['price'] = parseFloat(main_bid_json_arr[i][0].price);

					data['depth_sell_quantity'] = ob_bid_quantity_arr.reduce(function (a, b) {
						return a + b;
					}, 0);
					data['depth_buy_quantity'] = 0.0;

					data['type'] = 'bid';

					var created_date = new Date();
					created_date.setHours(created_date.getHours() + 5);
					data['created_date'] = created_date;

					data['buy_quantity'] = trd_ask_quantity_arr.reduce(function (a, b) {
						return a + b;
					}, 0);
					data['sell_quantity'] = trd_bid_quantity_arr.reduce(function (a, b) {
						return a + b;
					}, 0);

					//%%%%% - DATA TO INSERT IN COLLECTION CHART3_GROUP - %%%%%
					let data_to_insert = {};
					data_to_insert = data;
                    data_to_insert['coin'] = coin_symbol;
                    console.log(data_to_insert, "===> chart3 group bid")
					// db.collection('chart3_group_test').insertOne(data_to_insert);


					final_chart3_json_arr_bid.push(data);
				} //%%%%%%%%%%%% END of FOR LOOP : Chunking of main_bid_json_arr Array  %%%%%%%%%%%%%

				//%%%%%%%%%%%% Start of FOR LOOP : Chunking of main_ask_json_arr Array  %%%%%%%%%%%%% 
				for (let i = 0; i < main_ask_json_arr.length; i = i + offset_value) {
					let data = {}

					var ob_ask_quantity_arr = [];
					var trd_ask_quantity_arr = [];
					var trd_bid_quantity_arr = [];

					for (let t = 0; t < offset_value; t++) {
						if (typeof main_ask_json_arr[t + i][0].order_book_ask_quantity == 'number') {
							let v = main_ask_json_arr[t + i][0].order_book_ask_quantity;
							ob_ask_quantity_arr.push(v)
						}
					}

					for (let t = 0; t < offset_value; t++) {
						if (typeof main_ask_json_arr[t + i][0].trade_ask_quantity == 'number') {
							let v = main_ask_json_arr[t + i][0].trade_ask_quantity;
							trd_ask_quantity_arr.push(v)
						}
					}

					for (let t = 0; t < offset_value; t++) {
						if (typeof main_ask_json_arr[t + i][0].trade_bid_quantity == 'number') {
							let v = main_ask_json_arr[t + i][0].trade_bid_quantity;
							trd_bid_quantity_arr.push(v)
						}
					}

					data['price'] = main_ask_json_arr[i][0].price;

					data['depth_sell_quantity'] = 0.0;
					data['depth_buy_quantity'] = ob_ask_quantity_arr.reduce(function (a, b) {
						return a + b;
					}, 0);

					data['type'] = 'ask';

					var created_date = new Date();
					created_date.setHours(created_date.getHours() + 5);
					data['created_date'] = created_date;

					data['buy_quantity'] = trd_ask_quantity_arr.reduce(function (a, b) {
						return a + b;
					}, 0);
					data['sell_quantity'] = trd_bid_quantity_arr.reduce(function (a, b) {
						return a + b;
					}, 0); //this method used to add all the indexes of a numeric array and return a numeric double or integer

					//%%%%% - DATA TO INSERT IN COLLECTION CHART3_GROUP - %%%%%
					let data_to_insert = {};
					data_to_insert = data;
                    data_to_insert['coin'] = coin_symbol;
                    console.log(data_to_insert, "===> chart3 group ask")
					// db.collection('chart3_group_test').insertOne(data_to_insert);

					//console.log(data_to_insert, "===> data_to_insert")
					final_chart3_json_arr_ask.push(data);

				} //%%%%%%%%%%%% END of FOR LOOP : Chunking of main_ask_json_arr Array  %%%%%%%%%%%%%

				// console.log(final_chart3_json_arr_bid, "final_chart3_json_arr_bid")
				// console.log(final_chart3_json_arr_ask, "final_chart3_json_arr_ask")


				                //...............................................................................................................................
                //.FFFFFFFFFF.UUUU...UUUU..NNNN...NNNN....CCCCCCC......................CCCCCCC.......AAAAA.....LLLL.......LLLL........SSSSSSS....
                //.FFFFFFFFFF.UUUU...UUUU..NNNNN..NNNN...CCCCCCCCC....................CCCCCCCCC......AAAAA.....LLLL.......LLLL.......SSSSSSSSS...
                //.FFFFFFFFFF.UUUU...UUUU..NNNNN..NNNN..CCCCCCCCCCC..................CCCCCCCCCCC....AAAAAA.....LLLL.......LLLL.......SSSSSSSSSS..
                //.FFFF.......UUUU...UUUU..NNNNNN.NNNN..CCCC...CCCCC.................CCCC...CCCCC...AAAAAAA....LLLL.......LLLL......LSSSS..SSSS..
                //.FFFF.......UUUU...UUUU..NNNNNN.NNNN.NCCC.....CCC................. CCC.....CCC...AAAAAAAA....LLLL.......LLLL......LSSSS........
                //.FFFFFFFFF..UUUU...UUUU..NNNNNNNNNNN.NCCC......................... CCC...........AAAAAAAA....LLLL.......LLLL.......SSSSSSS.....
                //.FFFFFFFFF..UUUU...UUUU..NNNNNNNNNNN.NCCC......................... CCC...........AAAA.AAAA...LLLL.......LLLL........SSSSSSSSS..
                //.FFFFFFFFF..UUUU...UUUU..NNNNNNNNNNN.NCCC.............. ------.... CCC..........AAAAAAAAAA...LLLL.......LLLL..........SSSSSSS..
                //.FFFF.......UUUU...UUUU..NNNNNNNNNNN.NCCC.....CCC...... ------.... CCC.....CCC..AAAAAAAAAAA..LLLL.......LLLL.............SSSS..
                //.FFFF.......UUUU...UUUU..NNNN.NNNNNN..CCCC...CCCCC..... ------.....CCCC...CCCCC.AAAAAAAAAAA..LLLL.......LLLL......LSSS....SSS..
                //.FFFF.......UUUUUUUUUUU..NNNN..NNNNN..CCCCCCCCCCC..................CCCCCCCCCCC.CAAA....AAAA..LLLLLLLLLL.LLLLLLLLLLLSSSSSSSSSS..
                //.FFFF........UUUUUUUUU...NNNN..NNNNN...CCCCCCCCCC...................CCCCCCCCCC.CAAA.....AAAA.LLLLLLLLLL.LLLLLLLLLL.SSSSSSSSSS..
                //.FFFF.........UUUUUUU....NNNN...NNNN....CCCCCCC......................CCCCCCC..CCAAA.....AAAA.LLLLLLLLLL.LLLLLLLLLL..SSSSSSSS...
                //...............................................................................................................................

                //%%%%%%%%%%%% Start of Function Calls  %%%%%%%%%%%%% 

				var black_wall_response = calculate_blackwall_amount_for_chart3(final_chart3_json_arr_ask, final_chart3_json_arr_bid, black_wall_amount);
                //console.log(black_wall_response, "=> black_wall_response");
                
                var yellow_wall_response = calculate_yellowwall_amount_for_chart3(final_chart3_json_arr_ask, final_chart3_json_arr_bid, yellow_wall_amount);
                //console.log(yellow_wall_response, "=> yellow_wall_response");

                var five_level_pressure_resp = calculate_five_level_pressure(final_chart3_json_arr_ask, final_chart3_json_arr_bid);
                //console.log(five_level_pressure_resp, "=> five_level_pressure_resp");

                var seven_level_pressure_resp = calculate_seven_level_pressure(final_chart3_json_arr_ask, final_chart3_json_arr_bid);
                //console.log(seven_level_pressure_resp, "=> seven_level_pressure_resp");

                var dc_wall_response_json = calculate_dc_wall(final_chart3_json_arr_ask, final_chart3_json_arr_bid);
                //console.log(dc_wall_response_json, '=> dc_wall_resp_json')

                //////////////////////////////// var calculate_big_wall_response_json = calculate_big_wall()

				var get_contract_info_response_json = get_contract_info(coin_symbol, db); //this method returns a promise //MCP

				var get_bid_contract_info_response_json = get_bid_contract_info(coin_symbol, db); //this method returns a promise //SPL

                var get_ask_contract_info_response_json = get_ask_contract_info(coin_symbol, db); //this method returns a promise //BPL
 
                var get_contract_one_response_json = get_contracts_one(coin_symbol, db); //T1LTC //this method returns a promise 

                var get_contracts_two_response_json = get_contracts_two(coin_symbol, db); //T2LTC //this method returns a promise

                var get_contracts_three_response_json = get_contracts_three(coin_symbol, db); //T3LTC //this method returns a promise

                var get_contracts_four_response_json = get_contracts_four(coin_symbol, db); //T4LTC //this method returns a promise
                
                let get_rolling_fifteen_mins_trade_vol_response_json = get_rolling_fifteen_mins_trade_vol(coin_symbol, db); //T4COT //this method returns a promise

                let get_rolling_five_mins_trade_vol_response_json = get_rolling_five_mins_trade_volume(coin_symbol, db); //T1COt //this method returns a promise

                let get_rolling_hour_trade_volume_response_json = get_rolling_hour_trade_volume(coin_symbol, db); //T2COT //this method returns a promise

                let market_depth_bid_ask_volumes = calculate_market_depth_bid_ask_volumes(final_chart3_json_arr_bid, final_chart3_json_arr_ask);

				let get_trades_minus1_minute_response_json = get_trades_minus1_minute(coin_symbol, db); //returns bid ask buy and sell //this method returns a promise
				
				
				//%%%%%%%%%%%% END of Function Calls  %%%%%%%%%%%%% 
                //%%%%%%%%%%%% Start of Promise 3 of 3 - Resolve promises returned by Function Calls Above  %%%%%%%%%%%%% 
                Promise.all([ 
                    get_contract_info_response_json,//0
                    get_bid_contract_info_response_json,//1
                    get_ask_contract_info_response_json,//2
                    get_contract_one_response_json,//3
                    get_contracts_two_response_json,//4
                    get_contracts_three_response_json,//5
                    get_contracts_four_response_json,//6
                    get_rolling_fifteen_mins_trade_vol_response_json,//7
                    get_rolling_five_mins_trade_vol_response_json,//8
                    get_rolling_hour_trade_volume_response_json,//9
                    get_trades_minus1_minute_response_json//10
                ]).then(resolved_promised_arr => {
                    let get_contract_info_response_json_resolved = resolved_promised_arr[0];

                    let get_bid_contract_info_response_json_resolved = resolved_promised_arr[1];
                    //console.log(get_bid_contract_info_response_json_resolved, "=> get_bid_contract_info_response_json_resolved");

                    let get_ask_contract_info_response_json_resolved = resolved_promised_arr[2];
                    //console.log(get_ask_contract_info_response_json_resolved, "=> get_ask_contract_info_response_json_resolved")

                    let get_contract_one_response_json_resolved = resolved_promised_arr[3];
                    let get_contracts_two_response_json_resolved = resolved_promised_arr[4];
                    let get_contracts_three_response_json_resolved = resolved_promised_arr[5];
                    let get_contracts_four_response_json_resolved = resolved_promised_arr[6];
                    let get_rolling_fifteen_mins_trade_vol_response_json_resolved = resolved_promised_arr[7];

                    // FOR getTopPercent FUNCTION
                    // Will add fields in topPerArr Object to pass in getTopPercent function
                    let topPerArr = new Object();
                    //
                    let get_rolling_five_mins_trade_vol_response_json_resolved = resolved_promised_arr[8];
                    //console.log(get_rolling_five_mins_trade_vol_response_json_resolved, "=> get_rolling_five_mins_trade_vol_response_json_resolved");

                    let get_rolling_hour_trade_volume_response_json_resolved = resolved_promised_arr[9];

                    let get_trades_minus1_minute_response_json_resolved = resolved_promised_arr[10];

                    let five_level_pressure_difference = parseInt(five_level_pressure_resp['five_level_pressure_difference']);
                    let five_level_pressure_type = String(five_level_pressure_resp['five_level_pressure_type']);
                    
                    let black_wall_difference = parseInt(black_wall_response['blackwall_difference']);
                    topPerArr['black_wall'] = black_wall_difference;
                    let black_wall_side = String(black_wall_response['blackwall_side']);
                    
                    let yellow_wall_difference = parseInt(yellow_wall_response['yellowwall_difference']);
                    let yellow_wall_side = String(yellow_wall_response['yellowwall_side']);
                    
                    let seven_level_pressure = parseFloat(seven_level_pressure_resp['sevel_level_val']);
                    topPerArr['seven_level'] = seven_level_pressure;
                    let seven_level_pressure_side = String(seven_level_pressure_resp['p_val']);

                    let dc_wall_side = String(dc_wall_response_json['side']);

                    let rolling_five_mins_trade_vol_bid_per = parseInt(get_rolling_five_mins_trade_vol_response_json_resolved['bid_per']);//sellers
                    let rolling_five_mins_trade_vol_ask_per = parseInt(get_rolling_five_mins_trade_vol_response_json_resolved['ask_per']);//buyers
                    
                    let bid_contract_info_percantage = parseInt(get_bid_contract_info_response_json_resolved['per']);//big_buyers
                    let ask_contract_info_percentage = parseInt(get_ask_contract_info_response_json_resolved['per']);//big_sellers

                    let t2ltc_bids_per = parseInt(get_contracts_two_response_json_resolved['bids_per']); //t_h_b
                    let t2ltc_asks_per = parseInt(get_contracts_two_response_json_resolved['asks_per']); //t_h_a

                    let json_for_score = new Object();
                    json_for_score['depth_pressure'] = five_level_pressure_difference;
                    json_for_score['depth_pressure_side'] = five_level_pressure_type;
                    json_for_score['black_pressure'] = black_wall_difference;
                    json_for_score['black_color_side'] = black_wall_side;
                    json_for_score['yellow_pressure'] = yellow_wall_difference;
                    json_for_score['yellow_color_side'] = yellow_wall_side;
                    json_for_score['seven_level'] = seven_level_pressure;
                    json_for_score['seven_level_side'] = seven_level_pressure_side;
                    json_for_score['big_pressure'] = dc_wall_side;
                    json_for_score['buyers'] = rolling_five_mins_trade_vol_ask_per;
                    json_for_score['sellers'] = rolling_five_mins_trade_vol_bid_per;
                    json_for_score['big_sellers'] = ask_contract_info_percentage;
                    json_for_score['big_buyers'] = bid_contract_info_percantage;
                    json_for_score['t_h_b'] = t2ltc_bids_per;
                    json_for_score['t_h_a'] = t2ltc_asks_per;

                    let score =  calculate_score(json_for_score);

                    var chart3_response = new Object();
                    chart3_response['coin'] = String(coin_symbol);
                    chart3_response['current_market_value'] = current_market_value;
                    chart3_response['ask_black_wall'] = black_wall_response['blackwall_ask_price'];
                    chart3_response['ask_yellow_wall'] = yellow_wall_response['yellowwall_ask_price']
                    chart3_response['bid_black_wall'] = black_wall_response['blackwall_bid_price'];
                    chart3_response['bid_yellow_wall'] = yellow_wall_response['yellowwall_bid_price'];
                    chart3_response['black_wall_type'] = black_wall_response['blackwall_side'];
                    chart3_response['black_wall_pressure'] = parseInt(black_wall_response['blackwall_difference']);
                    chart3_response['yellow_wall_type'] = String(yellow_wall_response['yellowwall_side']);
                    chart3_response['yellow_wall_pressure'] = parseInt(yellow_wall_response['yellowwall_difference']);
                    chart3_response['up_pressure'] = String(five_level_pressure_resp['ask_index_count']);
                    chart3_response['down_pressure'] = String(five_level_pressure_resp['bid_index_count']);
                    chart3_response['pressure_type'] = String(five_level_pressure_resp['five_level_pressure_type']);
                    chart3_response['pressure_diff'] = parseInt(five_level_pressure_resp['five_level_pressure_difference']);
                    chart3_response['bid_contracts'] = parseInt(get_bid_contract_info_response_json_resolved['avg']);
                    chart3_response['bid_percentage'] = parseFloat(get_bid_contract_info_response_json_resolved['per']);
                    chart3_response['ask_contract'] = parseInt(get_ask_contract_info_response_json_resolved['avg']);
                    chart3_response['ask_percentage'] = parseFloat(get_ask_contract_info_response_json_resolved['per']);
                    chart3_response['buyers'] = parseFloat(get_rolling_five_mins_trade_vol_response_json_resolved['ask_vol']);
                    chart3_response['sellers'] = parseFloat(get_rolling_five_mins_trade_vol_response_json_resolved['bid_vol']);
                    chart3_response['buyers_percentage'] = parseFloat(get_rolling_five_mins_trade_vol_response_json_resolved['ask_per']);
                    chart3_response['sellers_percentage'] = parseFloat(get_rolling_five_mins_trade_vol_response_json_resolved['bid_per']);
                    chart3_response['up_big_price'] = dc_wall_response_json['ask_price_max'];
                    chart3_response['up_big_wall'] = dc_wall_response_json['ask_qty_max'];
                    chart3_response['down_big_price'] = dc_wall_response_json['bid_price_max'];
                    chart3_response['down_big_wall'] = dc_wall_response_json['bid_qty_max'];
                    chart3_response['great_wall_price'] = dc_wall_response_json['great_wall_price'];
                    chart3_response['great_wall_quantity'] = dc_wall_response_json['great_wall_qty'];
                    chart3_response['great_wall'] = dc_wall_response_json['side'];
                    chart3_response['great_wall_color'] = dc_wall_response_json['great_wall_color'];
                    //30
                    chart3_response['seven_level_depth'] = seven_level_pressure_resp['seven_level_val'];
                    chart3_response['seven_level_type'] = seven_level_pressure_resp['p_val'];
                    chart3_response['modified_date'] = new Date();
                    chart3_response['market_depth_quantity'] = parseFloat(market_depth_bid_ask_volumes[0]);
                    chart3_response['market_depth_ask'] = parseFloat(market_depth_bid_ask_volumes[1]);
                    chart3_response['sellers_buyers_per'] = parseFloat(get_rolling_five_mins_trade_vol_response_json_resolved['sellers_buyers_per']);
                    chart3_response['trade_type'] = String(get_rolling_five_mins_trade_vol_response_json_resolved['trade_type']);
                    chart3_response['score'] = parseInt(score);
                    chart3_response['last_qty_buy_vs_sell'] = get_contract_one_response_json_resolved['last_qty_buy_vs_sell'];
                    chart3_response['last_qty_time_ago'] = get_contract_one_response_json_resolved['time_string'];
                    chart3_response['last_200_buy_vs_sell'] = get_contracts_two_response_json_resolved['last_200_buy_vs_sell'];
                    chart3_response['last_200_time_ago'] = get_contracts_two_response_json_resolved['time_string'];
                    chart3_response['last_qty_buy_vs_sell_15'] = get_contracts_three_response_json_resolved['last_qty_buy_vs_sell_15'];
                    chart3_response['last_qty_time_ago_15'] = get_contracts_three_response_json_resolved['time_string'];
                    chart3_response['last_200_buy_vs_sell_15'] = get_contracts_four_response_json_resolved['last_200_buy_vs_sell_15'];
                    chart3_response['last_200_time_ago_15'] = get_contracts_four_response_json_resolved['time_string'];
                    chart3_response['buyers_fifteen'] = get_rolling_fifteen_mins_trade_vol_response_json_resolved['ask_vol'];
                    chart3_response['buyers_percentage_fifteen'] = get_rolling_fifteen_mins_trade_vol_response_json_resolved['ask_per'];
                    chart3_response['sellers_fifteen'] = get_rolling_fifteen_mins_trade_vol_response_json_resolved['bid_vol'];
                    chart3_response['sellers_percentage_fifteen'] = get_rolling_fifteen_mins_trade_vol_response_json_resolved['bid_per'];
                    chart3_response['sellers_buyers_per_fifteen'] = get_rolling_fifteen_mins_trade_vol_response_json_resolved['sellers_buyers_per_fifteen'];
                    chart3_response['trade_type_fifteen'] = get_rolling_fifteen_mins_trade_vol_response_json_resolved['trade_type_fifteen'];
                    chart3_response['buyers_percentage_t4cot'] = get_rolling_hour_trade_volume_response_json_resolved['ask_per']; //T2COT ACTUALLY AND NOT T4COT
                    chart3_response['sellers_percentage_t4cot'] = get_rolling_hour_trade_volume_response_json_resolved['bid_per']; //T2COT ACTUALLY AND NOT T4COT
                    chart3_response['buyers_t4cot'] = get_rolling_hour_trade_volume_response_json_resolved['ask_vol']; //T2COT ACTUALLY AND NOT T4COT
                    chart3_response['sellers_t4cot'] = get_rolling_hour_trade_volume_response_json_resolved['bid_vol']; //T2COT ACTUALLY AND NOT T4COT
                    chart3_response['sellers_buyers_per_t4cot'] = get_rolling_hour_trade_volume_response_json_resolved['sellers_buyers_per_t4cot']; //T2COT ACTUALLY AND NOT T4COT
                    chart3_response['trade_type_t4cot'] = get_rolling_hour_trade_volume_response_json_resolved['trade_type_t4cot']; //T2COT ACTUALLY AND NOT T4COT
                    chart3_response['bid'] = get_trades_minus1_minute_response_json_resolved['bid'];
                    chart3_response['ask'] = get_trades_minus1_minute_response_json_resolved['ask'];
                    chart3_response['buy'] = get_trades_minus1_minute_response_json_resolved['buy'];
                    chart3_response['sell'] = get_trades_minus1_minute_response_json_resolved['sell'];

                    console.log("here")

                    let final_chart3_arr_for_group = {};
                    final_chart3_arr_for_group['chart'] = {"ask": final_chart3_json_arr_ask, "bid": final_chart3_json_arr_bid};

                    final_chart3_arr_for_group['current_market_value'] = current_market_value;
                    
                    final_chart3_arr_for_group['coin_meta'] = chart3_response;
                    //%%%%% - INSERT COIN META INTO ITS RELAVANT SEPARATE COLLECTION FOR FURTHER CALCULATION WE MIGHT DO IN THE FUTURE - %%%%%%
                    var end = new Date() - start
                    console.info('Execution time: %dms', end)
                    console.log(chart3_response, "chart3_response")
                    // db.collection("coin_meta_test").insertOne(chart3_response, function(err, res){
                    //     console.log(err);
                    //     var end = new Date() - start
                    //     console.info('Execution time: %dms', end)
                    // 	console.log(res, "res")
                    // });
                    
                    //console.log(final_chart3_arr_for_group, "===> final_chart3_arr_for_group")
                    //console.log(final_chart3_arr_for_group, "====> final_chart3_arr_for_group")


                    //console.log(get_rolling_five_mins_trade_vol_response_json_resolved, "fivemin");
                    //%%%%% - CONSOLE RESPONSE FOR TESTING - %%%%%
                    console.log(chart3_response, '=> chart3_response');
                    //%%%%% - RESOLVE AND RETURN CHART3_RESPONSE - %%%%%
                    resolve(final_chart3_arr_for_group);

				});
			});
		});
	}); //%%%%%%%%%%%% End of 'return new promsie' Object: In the very start of chart3() Function  %%%%%%%%%%%%%  
} //%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% End of Function - Chart3  %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
//Get All Coins
async function get_all_coins(db) {
	return new Promise(async function (resolve, reject) {
		db.collection("coins").find({
			"user_id": "global"
		}).toArray(function (err, result) {
			if (err) throw err;
			if (result) {
				let coins_arr = [];
				result.forEach(res_elem => {
					coins_arr.push(res_elem.symbol);
				});
				resolve(coins_arr);
			} else {
				resolve([]);
			}
		});
	})
}

//........................................................................................................
//.FFFFFFFFFF.UUUU...UUUU..NNNN...NNNN....CCCCCCC.........DDDDDDDDD....EEEEEEEEEEE.FFFFFFFFFF..SSSSSSS....
//.FFFFFFFFFF.UUUU...UUUU..NNNNN..NNNN...CCCCCCCCC........DDDDDDDDDD...EEEEEEEEEEE.FFFFFFFFFF.SSSSSSSSS...
//.FFFFFFFFFF.UUUU...UUUU..NNNNN..NNNN..CCCCCCCCCCC.......DDDDDDDDDDD..EEEEEEEEEEE.FFFFFFFFFF.SSSSSSSSSS..
//.FFFF.......UUUU...UUUU..NNNNNN.NNNN..CCCC...CCCCC......DDDD...DDDD..EEEE........FFFF......FSSSS..SSSS..
//.FFFF.......UUUU...UUUU..NNNNNN.NNNN.NCCC.....CCC.......DDDD....DDDD.EEEE........FFFF......FSSSS........
//.FFFFFFFFF..UUUU...UUUU..NNNNNNNNNNN.NCCC...............DDDD....DDDD.EEEEEEEEEE..FFFFFFFFF..SSSSSSS.....
//.FFFFFFFFF..UUUU...UUUU..NNNNNNNNNNN.NCCC...............DDDD....DDDD.EEEEEEEEEE..FFFFFFFFF...SSSSSSSSS..
//.FFFFFFFFF..UUUU...UUUU..NNNNNNNNNNN.NCCC...............DDDD....DDDD.EEEEEEEEEE..FFFFFFFFF.....SSSSSSS..
//.FFFF.......UUUU...UUUU..NNNNNNNNNNN.NCCC.....CCC.......DDDD....DDDD.EEEE........FFFF.............SSSS..
//.FFFF.......UUUU...UUUU..NNNN.NNNNNN..CCCC...CCCCC......DDDD...DDDDD.EEEE........FFFF......FSSS....SSS..
//.FFFF.......UUUUUUUUUUU..NNNN..NNNNN..CCCCCCCCCCC.......DDDDDDDDDDD..EEEEEEEEEEE.FFFF......FSSSSSSSSSS..
//.FFFF........UUUUUUUUU...NNNN..NNNNN...CCCCCCCCCC.......DDDDDDDDDD...EEEEEEEEEEE.FFFF.......SSSSSSSSSS..
//.FFFF.........UUUUUUU....NNNN...NNNN....CCCCCCC.........DDDDDDDDD....EEEEEEEEEEE.FFFF........SSSSSSSS...
//........................................................................................................

//%%%%%%%%%%%% Start of Function Definition - Calculate Black Wall  %%%%%%%%%%%%%%

//..............................................................................................................................................
//.FFFFFFFFFF.................BBBBBBBBBB...LLLL..........AAAAA.......CCCCCCC....KKKK...KKKKKKWWW..WWWWW...WWWW..AAAAA.....ALLL.......LLLL.......
//.FFFFFFFFFF.................BBBBBBBBBBB..LLLL..........AAAAA......CCCCCCCCC...KKKK..KKKKK.KWWW..WWWWW..WWWW...AAAAA.....ALLL.......LLLL.......
//.FFFFFFFFFF.................BBBBBBBBBBB..LLLL.........AAAAAA.....CCCCCCCCCCC..KKKK.KKKKK..KWWW..WWWWWW.WWWW..AAAAAA.....ALLL.......LLLL.......
//.FFFF.......................BBBB...BBBB..LLLL.........AAAAAAA....CCCC...CCCCC.KKKKKKKKK...KWWW.WWWWWWW.WWWW..AAAAAAA....ALLL.......LLLL.......
//.FFFF.......................BBBB...BBBB..LLLL........AAAAAAAA...ACCC.....CCC..KKKKKKKK....KWWW.WWWWWWW.WWWW.AAAAAAAA....ALLL.......LLLL.......
//.FFFFFFFFF..................BBBBBBBBBBB..LLLL........AAAAAAAA...ACCC..........KKKKKKKK.....WWWWWWWWWWW.WWW..AAAAAAAA....ALLL.......LLLL.......
//.FFFFFFFFF..................BBBBBBBBBB...LLLL........AAAA.AAAA..ACCC..........KKKKKKKK.....WWWWWWW.WWWWWWW..AAAA.AAAA...ALLL.......LLLL.......
//.FFFFFFFFF...... ------.....BBBBBBBBBBB..LLLL.......AAAAAAAAAA..ACCC..........KKKKKKKKK....WWWWWWW.WWWWWWW.WAAAAAAAAA...ALLL.......LLLL.......
//.FFFF........... ------.....BBBB....BBBB.LLLL.......AAAAAAAAAAA.ACCC.....CCC..KKKK.KKKKK...WWWWWWW.WWWWWWW.WAAAAAAAAAA..ALLL.......LLLL.......
//.FFFF........... ------.....BBBB....BBBB.LLLL.......AAAAAAAAAAA..CCCC...CCCCC.KKKK..KKKK...WWWWWWW.WWWWWWW.WAAAAAAAAAA..ALLL.......LLLL.......
//.FFFF.......................BBBBBBBBBBBB.LLLLLLLLLLLAAA....AAAA..CCCCCCCCCCC..KKKK..KKKKK...WWWWW...WWWWW.WWAA....AAAA..ALLLLLLLLL.LLLLLLLLL..
//.FFFF.......................BBBBBBBBBBB..LLLLLLLLLLLAAA.....AAAA..CCCCCCCCCC..KKKK...KKKKK..WWWWW...WWWWW.WWAA.....AAAA.ALLLLLLLLL.LLLLLLLLL..
//.FFFF.......................BBBBBBBBBB...LLLLLLLLLLLAAA.....AAAA...CCCCCCC....KKKK...KKKKK..WWWWW...WWWWWWWWAA.....AAAA.ALLLLLLLLL.LLLLLLLLL..
//..............................................................................................................................................

function calculate_blackwall_amount_for_chart3(final_chart3_json_arr_ask, final_chart3_json_arr_bid, black_wall_amount){
    //%%%% Initializations %%%%
    let sum_depth_bid_qty = 0.0;
    let sum_depth_ask_qty = 0.0;
    let blackwall_bid_indexes = 0;
    let blackwall_ask_indexes = 0;
    let blackwall_bid_price = 0.0;
    let blackwall_ask_price = 0.0;
    let black_wall_side = '';
    //%%%% START OF FOR LOOP: FOR Bid Quantities %%%%
    for(let i=0; i<final_chart3_json_arr_bid.length; i++){
        if(sum_depth_bid_qty <= black_wall_amount){ 
            blackwall_bid_indexes = i + 1;
            blackwall_bid_price = parseFloat(final_chart3_json_arr_bid[i].price);
            //%%%%%%%%%% - Sell is Bid and Buy is Ask According to Waqar Bhai - Just for code Understanding - %%%%%%%%%%%
            sum_depth_bid_qty = sum_depth_bid_qty + parseFloat(final_chart3_json_arr_bid[i].depth_sell_quantity); 
        } else {
            break;
        }
    }//%%%% END OF FOR LOOP: FOR Bid Quantities %%%%
    //%%%% START OF FOR LOOP: FOR Ask Quantities %%%%
    for(let i=0; i<final_chart3_json_arr_ask.length; i++){
        //%%%% - START OF IF - %%%%%
        if(sum_depth_ask_qty <= black_wall_amount){
            blackwall_ask_indexes = i + 1;
            blackwall_ask_price = parseFloat(final_chart3_json_arr_ask[i].price);
            //%%%%%%%%%% - Sell is Bid and Buy is Ask According to Waqar Bhai - Just for code Understanding - %%%%%%%%%%%
            sum_depth_ask_qty = sum_depth_ask_qty + parseFloat(final_chart3_json_arr_ask[i].depth_buy_quantity);
        } else {
            break;
        }//%%%% - END OF IF - %%%%%
    }//%%%% END OF FOR LOOP: FOR Ask Quantities %%%%
    //console.log(blackwall_ask_indexes, "=> blackwall_ask_indexes");
    //console.log(blackwall_bid_indexes, "=> blackwall_bid_indexes");
    //console.log(blackwall_bid_price, "=> blackwall_bid_price");
    //console.log(blackwall_ask_price, '=> blackwall_ask_price');
    //%%%%% - Calculate Blackwall Difference - %%%%%
    let blackwall_difference = blackwall_ask_indexes - blackwall_bid_indexes;
    //%%%%% - START OF IF - Calculate Black Wall Side - %%%%%
    if(blackwall_difference >= 0){
        black_wall_side = 'positive';
    } else if (blackwall_difference < 0){
        black_wall_side = 'negative';
    }//%%%%% - END OF IF - Calculate Black Wall Side - %%%%%
    //%%%%% - Initialize JSON Response - %%%%%
    let black_wall_resp = new Object();
    black_wall_resp['blackwall_difference'] = parseInt(blackwall_difference);
    black_wall_resp['blackwall_ask_price'] = parseFloat(blackwall_ask_price);
    black_wall_resp['blackwall_bid_price'] = parseFloat(blackwall_bid_price);
    black_wall_resp['blackwall_side'] = String(black_wall_side);
    //%%%% Return Reponse %%%%
    return black_wall_resp;
}//%%%%%%%%%%%% END of Function Definition - Calculate Black Wall  %%%%%%%%%%%%%%
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//............................................................................................................................................................
//.FFFFFFFFFF................ YYY....YYYY.EEEEEEEEEEE.ELLL.......LLLL.........OOOOOOO...OOWWW..WWWWW...WWWWWWW..WWWWW...WWWW..AAAAA.....ALLL.......LLLL.......
//.FFFFFFFFFF................ YYYY..YYYYY.EEEEEEEEEEE.ELLL.......LLLL........OOOOOOOOOO..OWWW..WWWWW..WWWWWWWW..WWWWW..WWWW...AAAAA.....ALLL.......LLLL.......
//.FFFFFFFFFF.................YYYY..YYYY..EEEEEEEEEEE.ELLL.......LLLL.......OOOOOOOOOOOO.OWWW..WWWWWW.WWWWWWWW..WWWWWW.WWWW..AAAAAA.....ALLL.......LLLL.......
//.FFFF.......................YYYYYYYYY...EEEE........ELLL.......LLLL.......OOOOO..OOOOO.OWWW.WWWWWWW.WWWWWWWW.WWWWWWW.WWWW..AAAAAAA....ALLL.......LLLL.......
//.FFFF........................YYYYYYYY...EEEE........ELLL.......LLLL......LOOOO....OOOOOOWWW.WWWWWWW.WWWWWWWW.WWWWWWW.WWWW.AAAAAAAA....ALLL.......LLLL.......
//.FFFFFFFFF....................YYYYYY....EEEEEEEEEE..ELLL.......LLLL......LOOO......OOOO.WWWWWWWWWWW.WWW..WWWWWWWWWWW.WWW..AAAAAAAA....ALLL.......LLLL.......
//.FFFFFFFFF....................YYYYYY....EEEEEEEEEE..ELLL.......LLLL......LOOO......OOOO.WWWWWWW.WWWWWWW..WWWWWWW.WWWWWWW..AAAA.AAAA...ALLL.......LLLL.......
//.FFFFFFFFF...... ------........YYYY.....EEEEEEEEEE..ELLL.......LLLL......LOOO......OOOO.WWWWWWW.WWWWWWW..WWWWWWW.WWWWWWW.WAAAAAAAAA...ALLL.......LLLL.......
//.FFFF........... ------........YYYY.....EEEE........ELLL.......LLLL......LOOOO....OOOOO.WWWWWWW.WWWWWWW..WWWWWWW.WWWWWWW.WAAAAAAAAAA..ALLL.......LLLL.......
//.FFFF........... ------........YYYY.....EEEE........ELLL.......LLLL.......OOOOO..OOOOO..WWWWWWW.WWWWWWW..WWWWWWW.WWWWWWW.WAAAAAAAAAA..ALLL.......LLLL.......
//.FFFF..........................YYYY.....EEEEEEEEEEE.ELLLLLLLLL.LLLLLLLLLL.OOOOOOOOOOOO...WWWWW...WWWWW....WWWWW...WWWWW.WWAA....AAAA..ALLLLLLLLL.LLLLLLLLL..
//.FFFF..........................YYYY.....EEEEEEEEEEE.ELLLLLLLLL.LLLLLLLLLL..OOOOOOOOOO....WWWWW...WWWWW....WWWWW...WWWWW.WWAA.....AAAA.ALLLLLLLLL.LLLLLLLLL..
//.FFFF..........................YYYY.....EEEEEEEEEEE.ELLLLLLLLL.LLLLLLLLLL....OOOOOO......WWWWW...WWWWW....WWWWW...WWWWWWWWAA.....AAAA.ALLLLLLLLL.LLLLLLLLL..
//............................................................................................................................................................

//%%%%%%%%%%%% START of Function Definition - Calculate Yellow Wall  %%%%%%%%%%%%%%
function calculate_yellowwall_amount_for_chart3(final_chart3_json_arr_ask, final_chart3_json_arr_bid, yellow_wall_amount){
    //%%%% Initializations %%%%
    let sum_depth_bid_qty = 0.0;
    let sum_depth_ask_qty = 0.0;
    let yellowwall_bid_indexes = 0;
    let yellowwall_ask_indexes = 0;
    let yellowwall_bid_price = 0.0;
    let yellowwall_ask_price = 0.0;
    let yellow_wall_side = '';
    //%%%%%% Start of FOR %%%%%%
    for(let i=0; i<final_chart3_json_arr_bid.length; i++){
        if(sum_depth_bid_qty <= yellow_wall_amount){
            yellowwall_bid_indexes = i + 1;
            yellowwall_bid_price = parseFloat(final_chart3_json_arr_bid[i].price);
            //%%%%%%%%%% - Sell is Bid and Buy is Ask According to Waqar Bhai - Just for code Understanding - %%%%%%%%%%%
            sum_depth_bid_qty = sum_depth_bid_qty + final_chart3_json_arr_bid[i].depth_sell_quantity;
        } else {
            break;
        }
    } //%%%%%% END of FOR %%%%%%
    //%%%%%% Start of FOR %%%%%%
    for(let i=0; i<final_chart3_json_arr_ask.length; i++){
        if(sum_depth_ask_qty <= yellow_wall_amount){
            yellowwall_ask_indexes = i + 1;
            yellowwall_ask_price = parseFloat(final_chart3_json_arr_ask[i].price);
            //%%%%%%%%%% - Sell is Bid and Buy is Ask According to Waqar Bhai - Just for code Understanding - %%%%%%%%%%%
            sum_depth_ask_qty = sum_depth_ask_qty + final_chart3_json_arr_ask[i].depth_buy_quantity;
        } else {
            break;
        }
    } //%%%%%% END of FOR %%%%%%
    //%%%%% Calculate Yellow Wall Difference - %%%%%
    //%%%%% - Initialize JSON Reponse Object - %%%%%
    let yellowwall_difference =  yellowwall_ask_indexes - yellowwall_bid_indexes;
    //%%%%% - START of IF - Calculate Black Wall Side - %%%%% 
    if(yellowwall_difference >= 0){
        yellow_wall_side = 'positive';
    } else if(yellowwall_difference < 0){
        yellow_wall_side = 'negative';
    }//%%%%% - //END of IF - Calculate Black Wall Side - %%%%%
    let yellow_wall_resp = new Object();
    yellow_wall_resp['yellowwall_difference'] = parseInt(yellowwall_difference);
    yellow_wall_resp['yellowwall_bid_price'] = parseFloat(yellowwall_bid_price);
    yellow_wall_resp['yellowwall_ask_price'] = parseFloat(yellowwall_ask_price);
    yellow_wall_resp['yellowwall_side'] = String(yellow_wall_side);
    //%%%%% Return Response %%%%%
    return yellow_wall_resp;
} //%%%%%%%%%%%% END of Function Definition - Calculate Yellow Wall  %%%%%%%%%%%%%%
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//..............................................................................................................................................
//...55555555......LLLL.......EEEEEEEEEEEEVVV....VVVVVEEEEEEEEEEE.LLLL............PPPPPPPPP...RRRRRRRRRR...EEEEEEEEEEE..SSSSSSS.....SSSSSSS.....
//..555555555......LLLL.......EEEEEEEEEEEEVVV....VVVV.EEEEEEEEEEE.LLLL............PPPPPPPPPP..RRRRRRRRRRR..EEEEEEEEEEE.SSSSSSSSS...SSSSSSSSS....
//..5555...........LLLL.......EEEEEEEEEEEEVVV....VVVV.EEEEEEEEEEE.LLLL............PPPPPPPPPPP.RRRRRRRRRRR..EEEEEEEEEEE.SSSSSSSSSS..SSSSSSSSSS...
//..5555...........LLLL.......EEEE.......EVVVV..VVVV..EEEE........LLLL............PPPP...PPPP.RRRR...RRRRR.EEEE.......ESSSS..SSSS.SSSSS..SSSS...
//..5555555........LLLL.......EEEE........VVVV..VVVV..EEEE........LLLL............PPPP...PPPP.RRRR...RRRRR.EEEE.......ESSSS.......SSSSS.........
//..55555555.......LLLL.......EEEEEEEEEE..VVVV..VVVV..EEEEEEEEEE..LLLL............PPPPPPPPPPP.RRRRRRRRRRR..EEEEEEEEEE..SSSSSSS.....SSSSSSS......
//.5555.55555......LLLL.......EEEEEEEEEE..VVVVVVVVV...EEEEEEEEEE..LLLL............PPPPPPPPPP..RRRRRRRRRRR..EEEEEEEEEE...SSSSSSSSS...SSSSSSSSS...
//.......5555......LLLL.......EEEEEEEEEE...VVVVVVVV...EEEEEEEEEE..LLLL............PPPPPPPPP...RRRRRRRR.....EEEEEEEEEE.....SSSSSSS.....SSSSSSS...
//.......5555......LLLL.......EEEE.........VVVVVVVV...EEEE........LLLL............PPPP........RRRR.RRRR....EEEE..............SSSSS.......SSSSS..
//.......5555......LLLL.......EEEE.........VVVVVVV....EEEE........LLLL............PPPP........RRRR..RRRR...EEEE.......ESSS....SSSSSSSS....SSSS..
//.5555.55555......LLLLLLLLLL.EEEEEEEEEEE...VVVVVV....EEEEEEEEEEE.LLLLLLLLLL......PPPP........RRRR..RRRRR..EEEEEEEEEEEESSSSSSSSSSSSSSSSSSSSSSS..
//..55555555.......LLLLLLLLLL.EEEEEEEEEEE...VVVVVV....EEEEEEEEEEE.LLLLLLLLLL......PPPP........RRRR...RRRRR.EEEEEEEEEEE.SSSSSSSSSS..SSSSSSSSSS...
//...555555........LLLLLLLLLL.EEEEEEEEEEE...VVVVV.....EEEEEEEEEEE.LLLLLLLLLL......PPPP........RRRR....RRRR.EEEEEEEEEEE..SSSSSSSS....SSSSSSSS....
//..............................................................................................................................................


//%%%%%%%%%%%% START of Function Definition - Calculate Five Level Pressure  %%%%%%%%%%%%%%
function calculate_five_level_pressure(final_chart3_json_arr_ask, final_chart3_json_arr_bid, yellow_wall_amount){
    //%%%%% Initialization %%%%%
    let bid_count = 0;
    let ask_count = 0;
    let five_level_pressure_type = '';
    for(let i=0; i<5; i++){
        if(parseFloat(final_chart3_json_arr_ask[i].depth_buy_quantity) > parseFloat(final_chart3_json_arr_bid[i].depth_sell_quantity)){
            ask_count = ask_count + 1;
        } else if (parseFloat(final_chart3_json_arr_bid[i].depth_sell_quantity) > parseFloat(final_chart3_json_arr_ask[i].depth_buy_quantity)){
            bid_count = bid_count + 1;
        }
    }
    //%%%%% Calculate Five Level Pressure Difference %%%%%
    let five_level_pressure_difference = ask_count - bid_count;
    //%%%%% Calculate Five Level Pressure Type - %%%%%
    if(five_level_pressure_difference >= 0){
        five_level_pressure_type = "positive";
    } else if (five_level_pressure_difference < 0){
        five_level_pressure_type = "negative";
    }
    //console.log(ask_count, "=> ask_count");
    //console.log(bid_count, "=> bid_count");
    //%%%%% Declare JSON Resp Object %%%%%
    let five_level_pressure_resp = new Object();
    five_level_pressure_resp['five_level_pressure_difference'] = parseInt(five_level_pressure_difference);
    five_level_pressure_resp['five_level_pressure_type'] = String(five_level_pressure_type);
    five_level_pressure_resp['ask_index_count'] = parseInt(ask_count);
    five_level_pressure_resp['bid_index_count'] = parseInt(bid_count);
    //%%%%%%%%%%% Return JSON Object %%%%%%%%%%
    return five_level_pressure_resp;
}//%%%%%%%%%%%% END of Function Definition - Calculate Five Level Pressure  %%%%%%%%%%%%%%
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//..............................................................................................................................................
//.7777777777......LLLL.......EEEEEEEEEEEEVVV....VVVVVEEEEEEEEEEE.LLLL............PPPPPPPPP...RRRRRRRRRR...EEEEEEEEEEE..SSSSSSS.....SSSSSSS.....
//.7777777777......LLLL.......EEEEEEEEEEEEVVV....VVVV.EEEEEEEEEEE.LLLL............PPPPPPPPPP..RRRRRRRRRRR..EEEEEEEEEEE.SSSSSSSSS...SSSSSSSSS....
//......7777.......LLLL.......EEEEEEEEEEEEVVV....VVVV.EEEEEEEEEEE.LLLL............PPPPPPPPPPP.RRRRRRRRRRR..EEEEEEEEEEE.SSSSSSSSSS..SSSSSSSSSS...
//......7777.......LLLL.......EEEE.......EVVVV..VVVV..EEEE........LLLL............PPPP...PPPP.RRRR...RRRRR.EEEE.......ESSSS..SSSS.SSSSS..SSSS...
//.....7777........LLLL.......EEEE........VVVV..VVVV..EEEE........LLLL............PPPP...PPPP.RRRR...RRRRR.EEEE.......ESSSS.......SSSSS.........
//....77777........LLLL.......EEEEEEEEEE..VVVV..VVVV..EEEEEEEEEE..LLLL............PPPPPPPPPPP.RRRRRRRRRRR..EEEEEEEEEE..SSSSSSS.....SSSSSSS......
//....7777.........LLLL.......EEEEEEEEEE..VVVVVVVVV...EEEEEEEEEE..LLLL............PPPPPPPPPP..RRRRRRRRRRR..EEEEEEEEEE...SSSSSSSSS...SSSSSSSSS...
//....7777.........LLLL.......EEEEEEEEEE...VVVVVVVV...EEEEEEEEEE..LLLL............PPPPPPPPP...RRRRRRRR.....EEEEEEEEEE.....SSSSSSS.....SSSSSSS...
//...7777..........LLLL.......EEEE.........VVVVVVVV...EEEE........LLLL............PPPP........RRRR.RRRR....EEEE..............SSSSS.......SSSSS..
//...7777..........LLLL.......EEEE.........VVVVVVV....EEEE........LLLL............PPPP........RRRR..RRRR...EEEE.......ESSS....SSSSSSSS....SSSS..
//...7777..........LLLLLLLLLL.EEEEEEEEEEE...VVVVVV....EEEEEEEEEEE.LLLLLLLLLL......PPPP........RRRR..RRRRR..EEEEEEEEEEEESSSSSSSSSSSSSSSSSSSSSSS..
//...7777..........LLLLLLLLLL.EEEEEEEEEEE...VVVVVV....EEEEEEEEEEE.LLLLLLLLLL......PPPP........RRRR...RRRRR.EEEEEEEEEEE.SSSSSSSSSS..SSSSSSSSSS...
//...7777..........LLLLLLLLLL.EEEEEEEEEEE...VVVVV.....EEEEEEEEEEE.LLLLLLLLLL......PPPP........RRRR....RRRR.EEEEEEEEEEE..SSSSSSSS....SSSSSSSS....
//..............................................................................................................................................


//%%%%%%%%%%%% START of Function Definition - Calculate Seven Level Pressure  %%%%%%%%%%%%%%
function calculate_seven_level_pressure(final_chart3_json_arr_ask, final_chart3_json_arr_bid){
    let pressure_up = 0;
    let pressure_down = 0;
    let bid_max = 0;
    let ask_max = 0;
    let x = 0;
    let p = ""
    //%%%%%% START of FOR %%%%%%
    for (let i = 0; i < 7; i++) {
        bid_max += final_chart3_json_arr_bid[i]['depth_sell_quantity'];
        ask_max += final_chart3_json_arr_ask[i]['depth_buy_quantity'];
    }//%%%%%% END of FOR %%%%%%
    //console.log(ask_max, '=> ask_max');
    //console.log(bid_max, "=> bid_max");
    //%%%%%% START of IF %%%%%%
    if (bid_max > ask_max) {
        if (ask_max == 0) {
            ask_max = 1;
        }
        x = bid_max / ask_max;
        p = 'positive';
    } else if (ask_max > bid_max) {
        if (bid_max == 0) {
            bid_max = 1;
        }
        x = ask_max / bid_max;
        x = x * -1;
        p = 'negitive';
    }//%%%%%% START of IF %%%%%%
    let new_x = x - 1;
    new_x = new_x.toFixed(2);
    let new_p = (new_x/3) * 100;
    let seven_level_pressure_resp = new Object();
    seven_level_pressure_resp['seven_level_val'] = new_x;
    seven_level_pressure_resp['p_val'] = p;
    seven_level_pressure_resp['new_p'] = new_p;
    return seven_level_pressure_resp;
}//%%%%%%%%%%%% END of Function Definition - Calculate Seven Level Pressure  %%%%%%%%%%%%%%
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//..............................................................................................................
//.FFFFFFFFFF.................DDDDDDDDD......CCCCCCC....... WWW..WWWWW...WWWW..AAAAA.....ALLL.......LLLL.......
//.FFFFFFFFFF.................DDDDDDDDDD....CCCCCCCCC....... WWW..WWWWW..WWWW...AAAAA.....ALLL.......LLLL.......
//.FFFFFFFFFF.................DDDDDDDDDDD..CCCCCCCCCCC...... WWW..WWWWWW.WWWW..AAAAAA.....ALLL.......LLLL.......
//.FFFF.......................DDDD...DDDD..CCCC...CCCCC..... WWW.WWWWWWW.WWWW..AAAAAAA....ALLL.......LLLL.......
//.FFFF.......................DDDD....DDDDDCCC.....CCC...... WWW.WWWWWWW.WWWW.AAAAAAAA....ALLL.......LLLL.......
//.FFFFFFFFF..................DDDD....DDDDDCCC...............WWWWWWWWWWW.WWW..AAAAAAAA....ALLL.......LLLL.......
//.FFFFFFFFF..................DDDD....DDDDDCCC...............WWWWWWW.WWWWWWW..AAAA.AAAA...ALLL.......LLLL.......
//.FFFFFFFFF...... ------.....DDDD....DDDDDCCC...............WWWWWWW.WWWWWWW.WAAAAAAAAA...ALLL.......LLLL.......
//.FFFF........... ------.....DDDD....DDDDDCCC.....CCC.......WWWWWWW.WWWWWWW.WAAAAAAAAAA..ALLL.......LLLL.......
//.FFFF........... ------.....DDDD...DDDDD.CCCC...CCCCC......WWWWWWW.WWWWWWW.WAAAAAAAAAA..ALLL.......LLLL.......
//.FFFF.......................DDDDDDDDDDD..CCCCCCCCCCC........WWWWW...WWWWW.WWAA....AAAA..ALLLLLLLLL.LLLLLLLLL..
//.FFFF.......................DDDDDDDDDD....CCCCCCCCCC........WWWWW...WWWWW.WWAA.....AAAA.ALLLLLLLLL.LLLLLLLLL..
//.FFFF.......................DDDDDDDDD......CCCCCCC..........WWWWW...WWWWWWWWAA.....AAAA.ALLLLLLLLL.LLLLLLLLL..
//..............................................................................................................

//%%%%%%%%%%%% START of Function Definition - Calculate DC Wall  %%%%%%%%%%%%%%
//%%%%% - //DC WALL + OBW - %%%%%
function calculate_dc_wall(final_chart3_json_arr_ask, final_chart3_json_arr_bid){
    //%%%% Function Description %%%%%
    //%%%% - Find the Price with Max Quantity in the top 5 Indexes of Bid and Ask Chunked Arrays - %%%%%
    //%%%% Initializations %%%%
    let ask_arr_sliced = final_chart3_json_arr_ask.slice(0, 5);//%%% Slice the final_chart3_json_arr_ask Array for First 5 Indexes
    let bid_arr_sliced = final_chart3_json_arr_bid.slice(0, 5);//%%% Slice the final_chart3_json_arr_bid Array for First 5 Indexes
    //console.log(ask_arr_sliced, "=> ask_arr_sliced");
    //console.log(bid_arr_sliced, "=> bid_arr_sliced");
    let bid_qty_max = 0.0;
    let ask_qty_max = 0.0;
    let bid_price_max = 0.0;
    let ask_price_max = 0.0;
    let great_wall_price = 0.0;
    let great_wall_qty = 0.0;
    let great_wall_color = "";
    let side = "";
    //%%%%%% - START of FOR LOOP - Scan upto 5 indexes of Bid/Ask Sliced Chunked Arrays - %%%%%%%
    for(let i = 0; i < 5; i = i + 1){
        //console.log("check 0")
        if(i == 0){
            bid_qty_max = bid_arr_sliced[i].depth_sell_quantity;
            ask_qty_max = ask_arr_sliced[i].depth_buy_quantity;
            bid_price_max = bid_arr_sliced[i].price;
            ask_price_max = ask_arr_sliced[i].price;
            //console.log("check 1");
        } else if(i>0){
            if(parseFloat(bid_arr_sliced[i].depth_sell_quantity) > parseFloat(bid_qty_max)){
                bid_qty_max = bid_arr_sliced[i].depth_sell_quantity;
                bid_price_max = bid_arr_sliced[i].price;
                //console.log("check 2");
            }
            if(parseFloat(ask_arr_sliced[i].depth_buy_quantity) > parseFloat(ask_qty_max)){
                ask_qty_max = ask_arr_sliced[i].depth_buy_quantity;
                ask_price_max = ask_arr_sliced[i].price;
                //console.log("check 2");
            }
        }
    }//%%%%%% - END of FOR LOOP - %%%%%%%
    //%%%%%%% - START of IF ELSE - %%%%%%%
    //%%%%%%% - If Max Qauntity in Bid Array is Greater then Max Quantity in Ask Array Then Do or Else If Do - %%%%%%%
    if(parseFloat(bid_qty_max) > parseFloat(ask_qty_max)){
        great_wall_qty = parseFloat(bid_qty_max);
        great_wall_price = parseFloat(bid_price_max);
        great_wall_color = "blue";
        side = "downside";
        //console.log("check 3")
    } else if(parseFloat(ask_qty_max) > parseFloat(bid_qty_max)){
        great_wall_qty = parseFloat(ask_qty_max);
        great_wall_price = parseFloat(ask_price_max);
        great_wall_color = "red";
        side = "upside";
        //console.log("check 3");
    } //%%%% END of IF ELSE %%%%
    //%%%% Response Object %%%%
    let dc_wall_resp_json = new Object();
    dc_wall_resp_json['bid_qty_max'] = parseFloat(bid_qty_max);//%%% Max Quantity in 5 Indexes of Bid Array
    dc_wall_resp_json['ask_qty_max'] = parseFloat(ask_qty_max);//%%% Max Quantity in 5 Indexes of Ask Array
    dc_wall_resp_json['bid_price_max'] = parseFloat(bid_price_max);//%%% Price having the Max Quantity in 5 Indexes of Bid Array
    dc_wall_resp_json['ask_price_max'] = parseFloat(ask_price_max);//%%% Price Having the Max Qautity in 5 Indexes of Ask Array
    dc_wall_resp_json['great_wall_price'] = parseFloat(great_wall_price);//%%% Bid Vs Sell Price Having Max Quantity in 5 Indexes of their Corresponding Arrays
    dc_wall_resp_json['great_wall_qty'] = parseFloat(great_wall_qty);//%%% Bid Vs Sell Max Quantity in 5 Indexes of their Corresponding Arrays
    dc_wall_resp_json['great_wall_color'] = String(great_wall_color);//%%% If Bid Max Qty is > Ask then 'blue' or else if 'red'
    dc_wall_resp_json['side'] = String(side);//%%% If Bid Max Qty is > Ask then 'downside' or else if 'upside'
    //%%%% Return JSON Reponse %%%%
    return dc_wall_resp_json;
} //%%%%%%%%%%%% END of Function Definition - Calculate DC Wall  %%%%%%%%%%%%%%
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//.............................................................................................................................................................................
//.FFFFFFFFFF...................CCCCCCC......OOOOOOO.....NNNN...NNNN..TTTTTTTTTTTRRRRRRRRRR......AAAAA.......CCCCCCC....TTTTTTTTTTT.... IIII.NNNN...NNNN..FFFFFFFFFF..000000...
//.FFFFFFFFFF..................CCCCCCCCC....OOOOOOOOOO...NNNNN..NNNN..TTTTTTTTTTTRRRRRRRRRRR.....AAAAA......CCCCCCCCC...TTTTTTTTTTT.... IIII.NNNNN..NNNN..FFFFFFFFFF.00000000..
//.FFFFFFFFFF.................CCCCCCCCCCC..OOOOOOOOOOOO..NNNNN..NNNN..TTTTTTTTTTTRRRRRRRRRRR....AAAAAA.....CCCCCCCCCCC..TTTTTTTTTTT.... IIII.NNNNN..NNNN..FFFFFFFFFF.00000000..
//.FFFF.......................CCCC...CCCCC.OOOOO..OOOOO..NNNNNN.NNNN.....TTTT....RRRR...RRRRR...AAAAAAA....CCCC...CCCCC....TTTT........ IIII.NNNNNN.NNNN..FFFF......F000..000..
//.FFFF...................... CCC.....CCC.COOOO....OOOOO.NNNNNN.NNNN.....TTTT....RRRR...RRRRR..AAAAAAAA...ACCC.....CCC.....TTTT........ IIII.NNNNNN.NNNN..FFFF......F000..000..
//.FFFFFFFFF................. CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT....RRRRRRRRRRR...AAAAAAAA...ACCC.............TTTT........ IIII.NNNNNNNNNNN..FFFFFFFFF.F000..000..
//.FFFFFFFFF................. CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT....RRRRRRRRRRR...AAAA.AAAA..ACCC.............TTTT........ IIII.NNNNNNNNNNN..FFFFFFFFF.F000..000..
//.FFFFFFFFF...... ------.... CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT....RRRRRRRR.....AAAAAAAAAA..ACCC.............TTTT........ IIII.NNNNNNNNNNN..FFFFFFFFF.F000..000..
//.FFFF........... ------.... CCC.....CCC.COOOO....OOOOO.NNNNNNNNNNN.....TTTT....RRRR.RRRR....AAAAAAAAAAA.ACCC.....CCC.....TTTT........ IIII.NNNNNNNNNNN..FFFF......F000..000..
//.FFFF........... ------.....CCCC...CCCCC.OOOOO..OOOOO..NNNN.NNNNNN.....TTTT....RRRR..RRRR...AAAAAAAAAAA..CCCC...CCCCC....TTTT........ IIII.NNNN.NNNNNN..FFFF......F000..000..
//.FFFF.......................CCCCCCCCCCC..OOOOOOOOOOOO..NNNN..NNNNN.....TTTT....RRRR..RRRRR.RAAA....AAAA..CCCCCCCCCCC.....TTTT........ IIII.NNNN..NNNNN..FFFF.......00000000..
//.FFFF........................CCCCCCCCCC...OOOOOOOOOO...NNNN..NNNNN.....TTTT....RRRR...RRRRRRAAA.....AAAA..CCCCCCCCCC.....TTTT........ IIII.NNNN..NNNNN..FFFF.......00000000..
//.FFFF.........................CCCCCCC.......OOOOOO.....NNNN...NNNN.....TTTT....RRRR....RRRRRAAA.....AAAA...CCCCCCC.......TTTT........ IIII.NNNN...NNNN..FFFF........000000...
//...........................................................................................................................................................................

//%%%%%%%%%%%% START of Function Definition - Get Contract Info  %%%%%%%%%%%%%%
function get_contract_info(coin, db){
    //%%%% Start of Promise Object %%%%
    return new Promise(function (resolve, reject) {
        let coin_info_query = db.collection('coins').find({"symbol": coin}).toArray();
        coin_info_query.then(coin_info_query_resp => {
            //console.log(coin_info_query_resp, "=> coin_info_query_resp");
            let contract_time = parseInt(coin_info_query_resp[0]['contract_time']);
            let contract_percentage = parseInt(coin_info_query_resp[0]['contract_percentage']);
            //%%%%%%%%%% - Minus the Contract Time from Current Time - %%%%%%%%%%
            let time_reversed = new Date(); 
            time_reversed.setMinutes(time_reversed.getMinutes() - contract_time);
            //console.log(time_reversed, "=> time_reversed");
            if(contract_time == 0){
                contract_time = 2
            }
            if(contract_percentage == 0){
                contract_percentage = 10;
            }
            //%%%%%%%%%% - Query - %%%%%%%%%%
            let get_trades_query = db.collection('market_trades').find({"coin": coin, "created_date": {$gte: time_reversed}}).sort({'created_date': -1}).toArray();
            //%%%%%%%%%% - Query Promise Reolution - %%%%%%%%%%
            get_trades_query.then( get_trades_query_response => {
                //console.log(get_trades_query_response, "=> get_trades_query_response");
                let get_trade_query_quantities_arr = [];
                get_trades_query_response.forEach(element => { 
                    get_trade_query_quantities_arr.push(parseFloat(element['quantity'])); 
                });
                get_trade_query_quantities_arr.sort(function(a,b) { return a - b;});
                get_trade_query_quantities_arr.reverse();

                //console.log(get_trade_query_quantities_arr, "=> get_trade_query_quantities");
                //console.log(get_trade_query_quantities_arr.length , "=> get_trade_query_quantities_arr.length");
                //console.log(contract_percentage, "=>contract_percentage")

                let index = Math.round((parseInt(get_trade_query_quantities_arr.length) / 100) * parseInt(contract_percentage));
                //console.log(Math.round(index), "=> index")
                //%%%%%%%%%%% - Quantity Sum Upto the defined INDEX varibale defined above - %%%%%%%%%%%
                let q_sum = 0.0; 
                for(let i =0; i < index; i++){
                    q_sum = q_sum + parseFloat(get_trade_query_quantities_arr[i]);
                }console.log
                //%%%%%%%%%% - Quantity Sum of total sum in get_trade_console.logquery_quantities_arr ARRAY - %%%%%%%%%%
                let t_sum = 0.0; 
                for(let i = 0; i < get_trade_query_quantities_arr.length; i++){
                    t_sum = t_sum + parseFloat(get_trade_query_quantities_arr[i]);
                    //console.log(t_sum, "=> t_sum", i, "=> i");console.log
                }
                //console.log(q_sum, '=> q_sum')console.log
                //%%%%% - Avg Quantity - %%%%%console.log
                let q_avg = q_sum / index;
                //%%%%% - Percentage with Total Quantity Sum - %%%%%console.log
                let percentage_ = (q_sum / t_sum) * 100;
                //%%%%% - Initialization of Json Object for Creating Rconsole.logesponse - %%%%%
                let get_contract_info_resp_json = new Object();
                get_contract_info_resp_json['avg'] = Math.round(q_avg);
                get_contract_info_resp_json['per'] = Math.round(percentage_);
                //console.log(get_contract_info_resp_json, "=> get_contract_info_resp_json");
                //%%%%% - Resolve and Return Json Response - It'll be a promise wherever the Function will be called - %%%%%
                resolve(get_contract_info_resp_json);
            });
        })
    });
}//%%%%%%%%%%%% END of Function Definition - Get Contract Info  %%%%%%%%%%%%%%
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//...................................................................................................................................................................
//.FFFFFFFFFF.................BBBBBBBBBB..BIIII.DDDDDDDDD...........CCCCCCC......OOOOOOO.....NNNN...NNNN..TTTTTTTTTTT.... IIII.NNNN...NNNN..FFFFFFFFFF...OOOOOOO.....
//.FFFFFFFFFF.................BBBBBBBBBBB.BIIII.DDDDDDDDDD.........CCCCCCCCC....OOOOOOOOOO...NNNNN..NNNN..TTTTTTTTTTT.... IIII.NNNNN..NNNN..FFFFFFFFFF..OOOOOOOOOO...
//.FFFFFFFFFF.................BBBBBBBBBBB.BIIII.DDDDDDDDDDD.......CCCCCCCCCCC..OOOOOOOOOOOO..NNNNN..NNNN..TTTTTTTTTTT.... IIII.NNNNN..NNNN..FFFFFFFFFF.OOOOOOOOOOOO..
//.FFFF.......................BBBB...BBBB.BIIII.DDDD...DDDD.......CCCC...CCCCC.OOOOO..OOOOO..NNNNNN.NNNN.....TTTT........ IIII.NNNNNN.NNNN..FFFF.......OOOOO..OOOOO..
//.FFFF.......................BBBB...BBBB.BIIII.DDDD....DDDD..... CCC.....CCC.COOOO....OOOOO.NNNNNN.NNNN.....TTTT........ IIII.NNNNNN.NNNN..FFFF......FOOOO....OOOO..
//.FFFFFFFFF..................BBBBBBBBBBB.BIIII.DDDD....DDDD..... CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT........ IIII.NNNNNNNNNNN..FFFFFFFFF.FOOO......OOO..
//.FFFFFFFFF..................BBBBBBBBBB..BIIII.DDDD....DDDD..... CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT........ IIII.NNNNNNNNNNN..FFFFFFFFF.FOOO......OOO..
//.FFFFFFFFF...... ------.....BBBBBBBBBBB.BIIII.DDDD....DDDD..... CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT........ IIII.NNNNNNNNNNN..FFFFFFFFF.FOOO......OOO..
//.FFFF........... ------.....BBBB....BBBBBIIII.DDDD....DDDD..... CCC.....CCC.COOOO....OOOOO.NNNNNNNNNNN.....TTTT........ IIII.NNNNNNNNNNN..FFFF......FOOOO....OOOO..
//.FFFF........... ------.....BBBB....BBBBBIIII.DDDD...DDDDD......CCCC...CCCCC.OOOOO..OOOOO..NNNN.NNNNNN.....TTTT........ IIII.NNNN.NNNNNN..FFFF.......OOOOO..OOOOO..
//.FFFF.......................BBBBBBBBBBBBBIIII.DDDDDDDDDDD.......CCCCCCCCCCC..OOOOOOOOOOOO..NNNN..NNNNN.....TTTT........ IIII.NNNN..NNNNN..FFFF.......OOOOOOOOOOOO..
//.FFFF.......................BBBBBBBBBBB.BIIII.DDDDDDDDDD.........CCCCCCCCCC...OOOOOOOOOO...NNNN..NNNNN.....TTTT........ IIII.NNNN..NNNNN..FFFF........OOOOOOOOOO...
//.FFFF.......................BBBBBBBBBB..BIIII.DDDDDDDDD...........CCCCCCC.......OOOOOO.....NNNN...NNNN.....TTTT........ IIII.NNNN...NNNN..FFFF..........OOOOOO.....
//...................................................................................................................................................................


//%%%%%%%%%%%% Start of Function Definition - Get Contract Info  %%%%%%%%%%%%%%
function get_bid_contract_info(coin, db){
    //%%%% Start of Promise Object %%%%
    return new Promise(function (resolve, reject) {
        //%%%%% - Coins Info Query - %%%%%
        let coin_info_query = db.collection('coins').find({"symbol": coin}).toArray();
        //%%%%% - Coins Info Query Resolution - %%%%%
        coin_info_query.then(coin_info_query_resp => {
            //console.log(coin_info_query_resp, "=> coin_info_query_resp");
            let time_reversed = new Date();
            let contract_time = parseInt(coin_info_query_resp[0]['contract_time']);
            let contract_percentage = parseInt(coin_info_query_resp[0]['contract_percentage']);
            time_reversed.setMinutes(time_reversed.getMinutes() - contract_time);
            //console.log(time_reversed, "=> time_reversed");
            if(contract_time == 0){
                contract_time = 2
            }
            if(contract_percentage == 0){
                contract_percentage = 10;
            }
            //console.log(coin, '=> coin');
            //%%%%%%%%%%%%%% Query %%%%%%%%%%%%%%%
            let get_trades_query = db.collection('market_trades').find({"coin": coin, "created_date": {$gte: time_reversed}}).sort({'created_date': -1}).toArray();
            //%%%%%%%%%%%%%% Resolve Promise Cursor %%%%%%%%%%%%%%%%
            get_trades_query.then( get_trades_query_response => {
                //console.log(get_trades_query_response.length, "=> get_trades_query_response");
                //%%%%%%%%% - Function to SORT a JSON ARRAY by KEY - %%%%%%%%%
                function sortByKey(array, key) {
                    return array.sort(function(a, b) {
                        var x = a[key]; var y = b[key];
                        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
                    });
                }//%%%%%%%%% - //END Function sortByKey() - %%%%%%%%%
                get_trades_query_response = sortByKey(get_trades_query_response, "quantity");
                //console.log(get_trades_query_response, "=> get_trades_query_responses");
                //console.log(contract_percentage, "=> contract_percentage")
                //%%%%% - Define Index variable for Number of Trades to Crawl - %%%%% => Number of Trades returned by Mongo Query Above ----
                let index = Math.round((get_trades_query_response.length / 100) * (contract_percentage));
                //console.log(get_trades_query_response.length, "=> get_trades_query_response.length")
                //console.log(index, "=> index")
                //%%%%% - Quantity Sum upto Indexes Calculated Above in the Index Variable - %%%%%
                let q_sum = 0.0;
                //%%%%% - Start of FOR LOOP - Sum Quantities - %%%%%
                for(let i =0; i < index; i++){
                    if (get_trades_query_response[i]['maker'] == 'true') {
                        //console.log('calculating quantities')
                        q_sum = q_sum + parseFloat(get_trades_query_response[i]['quantity']);
                    }
                }//%%%%% - //END of FOR LOOP - %%%%%
                //console.log(q_sum, "=> q_sum");
                let q2 = 0.0; 
                let max_price = 0;
                //%%%%% - What Price Have the MAX Quantity in get_trades_query_response JSON ARRAY??? - %%%%%
                //%%% - FOR LOOP - %%%
                for (let i = 0; i < index; i++) {
                    if (get_trades_query_response[i]['maker'] == 'true') {
                        let q = parseFloat(get_trades_query_response[i]['quantity']);
                        if (q2 < q) {
                            q2 = q;
                            max_price = get_trades_query_response[i]['price'];
                        }
                    }
                } //%%% - //END of FOR - %%%
                //console.log(max_price, "=> max_price")
                let t_sum = 0.0;
                //%%% - FOR LOOP - Total Sum of all the Trades Returned by Query - %%%
                for (let i = 0; i < get_trades_query_response.length; i++) {
                    t_sum += get_trades_query_response[i]['quantity'];
                }//%%% - //END FOR - %%%
                //console.log(t_sum, "=> t_sum")
                let q_avg = q_sum / index;
                //%%%%%% - To Avoid NaN in q_avg Variable when Index = 0 - %%%%%%
                if( Number.isNaN(q_avg) ){
                    q_avg = 0.0;
                }//%%% - END IF - %%%
                let percentage_ = Math.round((q_sum / t_sum) * 100);
                let get_bid_contract_info_return_json_response = new Object();
                get_bid_contract_info_return_json_response['avg'] = Math.round(q_avg);
                get_bid_contract_info_return_json_response['per'] = percentage_;
                get_bid_contract_info_return_json_response['max'] = parseFloat(max_price).toFixed(8);
                //console.log(get_bid_contract_info_return_json_response, "=> get_bid_contract_info_return_json_response")
                //%%%%% - Resolve and Return - %%%%%
                resolve(get_bid_contract_info_return_json_response); //resolve and return promise
            }) //%%%%% - //END OF Promise.then 2 of 2 - %%%%%
        }) //%%%%% - //END OF Promise.then 1 of 2 - %%%%%
    }) //%%%%% - END of 'return new Promise' - %%%%%
}//%%%%%%%%%%%% - //END of Function Definition - Get Contract Info -  %%%%%%%%%%%%%%
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//..........................................................................................................................................................................
//.FFFFFFFFFF....................AAAAA......SSSSSSS....KKKK...KKKKK........CCCCCCC......OOOOOOO.....NNNN...NNNN..TTTTTTTTTTT.... IIII.NNNN...NNNN..FFFFFFFFFF...OOOOOOO.....
//.FFFFFFFFFF....................AAAAA.....SSSSSSSSS...KKKK..KKKKK........CCCCCCCCC....OOOOOOOOOO...NNNNN..NNNN..TTTTTTTTTTT.... IIII.NNNNN..NNNN..FFFFFFFFFF..OOOOOOOOOO...
//.FFFFFFFFFF...................AAAAAA.....SSSSSSSSSS..KKKK.KKKKK........CCCCCCCCCCC..OOOOOOOOOOOO..NNNNN..NNNN..TTTTTTTTTTT.... IIII.NNNNN..NNNN..FFFFFFFFFF.OOOOOOOOOOOO..
//.FFFF.........................AAAAAAA...ASSSS..SSSS..KKKKKKKKK.........CCCC...CCCCC.OOOOO..OOOOO..NNNNNN.NNNN.....TTTT........ IIII.NNNNNN.NNNN..FFFF.......OOOOO..OOOOO..
//.FFFF........................AAAAAAAA...ASSSS........KKKKKKKK......... CCC.....CCC.COOOO....OOOOO.NNNNNN.NNNN.....TTTT........ IIII.NNNNNN.NNNN..FFFF......FOOOO....OOOO..
//.FFFFFFFFF...................AAAAAAAA....SSSSSSS.....KKKKKKKK......... CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT........ IIII.NNNNNNNNNNN..FFFFFFFFF.FOOO......OOO..
//.FFFFFFFFF...................AAAA.AAAA....SSSSSSSSS..KKKKKKKK......... CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT........ IIII.NNNNNNNNNNN..FFFFFFFFF.FOOO......OOO..
//.FFFFFFFFF...... ------.....AAAAAAAAAA......SSSSSSS..KKKKKKKKK........ CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT........ IIII.NNNNNNNNNNN..FFFFFFFFF.FOOO......OOO..
//.FFFF........... ------.....AAAAAAAAAAA........SSSSS.KKKK.KKKKK....... CCC.....CCC.COOOO....OOOOO.NNNNNNNNNNN.....TTTT........ IIII.NNNNNNNNNNN..FFFF......FOOOO....OOOO..
//.FFFF........... ------.....AAAAAAAAAAA.ASSS....SSSS.KKKK..KKKK........CCCC...CCCCC.OOOOO..OOOOO..NNNN.NNNNNN.....TTTT........ IIII.NNNN.NNNNNN..FFFF.......OOOOO..OOOOO..
//.FFFF...................... AAA....AAAA.ASSSSSSSSSSS.KKKK..KKKKK.......CCCCCCCCCCC..OOOOOOOOOOOO..NNNN..NNNNN.....TTTT........ IIII.NNNN..NNNNN..FFFF.......OOOOOOOOOOOO..
//.FFFF...................... AAA.....AAAA.SSSSSSSSSS..KKKK...KKKKK.......CCCCCCCCCC...OOOOOOOOOO...NNNN..NNNNN.....TTTT........ IIII.NNNN..NNNNN..FFFF........OOOOOOOOOO...
//.FFFF..................... AAA.....AAAA..SSSSSSSS...KKKK...KKKKK........CCCCCCC.......OOOOOO.....NNNN...NNNN.....TTTT........ IIII.NNNN...NNNN..FFFF..........OOOOOO.....
//..........................................................................................................................................................................


//%%%%%%%%%%%% Start of Function Definition - Get Ask Contract Info  %%%%%%%%%%%%%%
function get_ask_contract_info(coin, db){
    //%%%% Start of Promise Object %%%%
    return new Promise(function (resolve, reject) {
        //%%%%% - Coins Info Query - %%%%%
        let coin_info_query = db.collection('coins').find({"symbol": coin}).toArray();
        //%%%%% - Coins Info Query Resolution - %%%%%
        coin_info_query.then(coin_info_query_resp => {
            //console.log(coin_info_query_resp, "=> coin_info_query_resp");
            let time_reversed = new Date();
            let contract_time = parseInt(coin_info_query_resp[0]['contract_time']);
            let contract_percentage = parseInt(coin_info_query_resp[0]['contract_percentage']);
            time_reversed.setMinutes(time_reversed.getMinutes() - contract_time);
            //console.log(time_reversed, "=> time_reversed");
            if(contract_time == 0){
                contract_time = 2
            }
            if(contract_percentage == 0){
                contract_percentage = 10;
            }
            //%%%%%%%%%%%%%% Query %%%%%%%%%%%%%%%
            let get_trades_query = db.collection('market_trades').find({"coin": coin, "created_date": {$gte: time_reversed}}).sort({'created_date': -1}).toArray();
            //%%%%%%%%%%%%%% Resolve Promise Cursor %%%%%%%%%%%%%%%%
            get_trades_query.then( get_trades_query_response => {
                //console.log(get_trades_query_response, "=> get_trades_query_response");
                //%%%%%%%%% - Function to SORT a JSON ARRAY by KEY - %%%%%%%%%
                function sortByKey(array, key) { //function to sort a json array by key value
                    return array.sort(function(a, b) {
                        var x = a[key]; var y = b[key];
                        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
                    });
                }//%%%%%%%%% - //END Function sortByKey() - %%%%%%%%%
                get_trades_query_response = sortByKey(get_trades_query_response, "quantity");
                get_trades_query_response.reverse();
                //console.log(get_trades_query_response, "=> get_trades_query_responses");
                //%%%%% - Define Index variable for Number of Trades to Crawl - %%%%% => Number of Trades returned by Mongo Query Above ----
                let index = Math.round((get_trades_query_response.length / 100) * (contract_percentage));
                //console.log(index, "=> index");
                //%%%%% - Quantity Sum upto Indexes Calculated Above in the Index Variable - %%%%%
                let q_sum = 0.0;
                //%%%%% - Start of FOR LOOP - Sum Quantities - %%%%%
                for(let i =0; i < index; i++){
                if (get_trades_query_response[i]['maker'] == 'false') {
                    q_sum = q_sum + parseFloat(get_trades_query_response[i]['quantity']);
                }
                }//%%%%% - //END of FOR LOOP - %%%%%
            let q2 = 0.0; 
            let max_price = 0;
            //%%%%% - What Price Have the MAX Quantity in get_trades_query_response JSON ARRAY??? - %%%%%
            //%%% - FOR LOOP - %%%
            for (let i = 0; i < index; i++) {
                if (get_trades_query_response[i]['maker'] == 'false') {
                    if (q2 < get_trades_query_response[i]['quantity']) {
                        q2 = get_trades_query_response[i]['quantity'];
                        max_price = get_trades_query_response[i]['price'];
                    }
                }
            }  //%%% - //END of FOR - %%%
            let t_sum = 0.0;
            //%%% - FOR LOOP - Total Sum of all the Trades Returned by Query - %%%
            for (let i = 0; i < get_trades_query_response.length; i++) {
                t_sum += get_trades_query_response[i]['quantity'];
            }//%%% - //END FOR - %%%
            let q_avg = q_sum / index;
            //%%%%%% - To Avoid NaN in q_avg Variable when Index = 0 - %%%%%%
            if(Number.isNaN(q_avg)){
                q_avg = 0.0;
            }//%%% - END IF - %%%
            //console.log(q_sum, "=> q_sum");
            //console.log(t_sum, "-> t_sum");
            let percentage_ = Math.round((q_sum / t_sum) * 100);
            let get_ask_contract_info_return_json_response = new Object();
            get_ask_contract_info_return_json_response['avg'] = Math.round(q_avg);
            get_ask_contract_info_return_json_response['per'] = Math.round(percentage_);
            get_ask_contract_info_return_json_response['max'] = parseFloat(max_price).toFixed(8);
            //console.log(get_ask_contract_info_return_json_response, "=> get_ask_contract_info_return_json_response")
            //%%%%% - Resolve and Return - %%%%%
            resolve(get_ask_contract_info_return_json_response); //resolve and return promise
            }) //%%%%% - //END OF Promise.then 2 of 2 - %%%%%
        }) //%%%%% - //END OF Promise.then 1 of 2 - %%%%%
    }) //%%%%% - END of 'return new Promise' - %%%%%
}//%%%%%%%%%%%% - //END of Function Definition - Get ASK Contract Info -  %%%%%%%%%%%%%%
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//...........................................................................................................................
//.FFFFFFFFFF...................CCCCCCC......OOOOOOO.....NNNN...NNNN..TTTTTTTTTTT.......OOOOOOO.....NNNN...NNNN..EEEEEEEEEE..
//.FFFFFFFFFF..................CCCCCCCCC....OOOOOOOOOO...NNNNN..NNNN..TTTTTTTTTTT......OOOOOOOOOO...NNNNN..NNNN..EEEEEEEEEE..
//.FFFFFFFFFF.................CCCCCCCCCCC..OOOOOOOOOOOO..NNNNN..NNNN..TTTTTTTTTTT.....OOOOOOOOOOOO..NNNNN..NNNN..EEEEEEEEEE..
//.FFFF.......................CCCC...CCCCC.OOOOO..OOOOO..NNNNNN.NNNN.....TTTT.........OOOOO..OOOOO..NNNNNN.NNNN..EEEE........
//.FFFF...................... CCC.....CCC.COOOO....OOOOO.NNNNNN.NNNN.....TTTT........ OOOO....OOOOO.NNNNNN.NNNN..EEEE........
//.FFFFFFFFF................. CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT........ OOO......OOOO.NNNNNNNNNNN..EEEEEEEEEE..
//.FFFFFFFFF................. CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT........ OOO......OOOO.NNNNNNNNNNN..EEEEEEEEEE..
//.FFFFFFFFF...... ------.... CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT........ OOO......OOOO.NNNNNNNNNNN..EEEEEEEEEE..
//.FFFF........... ------.... CCC.....CCC.COOOO....OOOOO.NNNNNNNNNNN.....TTTT........ OOOO....OOOOO.NNNNNNNNNNN..EEEE........
//.FFFF........... ------.....CCCC...CCCCC.OOOOO..OOOOO..NNNN.NNNNNN.....TTTT.........OOOOO..OOOOO..NNNN.NNNNNN..EEEE........
//.FFFF.......................CCCCCCCCCCC..OOOOOOOOOOOO..NNNN..NNNNN.....TTTT.........OOOOOOOOOOOO..NNNN..NNNNN..EEEEEEEEEE..
//.FFFF........................CCCCCCCCCC...OOOOOOOOOO...NNNN..NNNNN.....TTTT..........OOOOOOOOOO...NNNN..NNNNN..EEEEEEEEEE..
//.FFFF.........................CCCCCCC.......OOOOOO.....NNNN...NNNN.....TTTT............OOOOOO.....NNNN...NNNN..EEEEEEEEEE..
//...........................................................................................................................

//%%%%%%%%%%%% Start of Function Definition - Get Contracts One  %%%%%%%%%%%%%%
 function get_contracts_one(coin, db){
    //%%%% Start of Promise Object %%%%
    return new Promise(function (resolve, reject) {
    //console.log("get_contracts_one")
    //%%%%% - Coins Info Query - %%%%%
    let coin_info_query = db.collection('coins').find({"symbol": coin}).toArray();
    //%%%%% - Coin Info Query Promise Resolution - %%%%%
    coin_info_query.then(coin_info_query_resp => {
        let contract_size = coin_info_query_resp[0]['contract_size'];
        //console.log(contract_size, '=> contract_size ---------------------------------------------------------------------------------------------------------------')
        //%%%%% - What's the time now? Check the Clock... - %%%%%
        let nowtime = new Date();
        //%%%%% - Market Trades Query - %%%%%
        let get_trades_query = db.collection('market_trades').find({"coin": coin, "created_date": {$lte: nowtime}}).sort({'created_date': -1}).toArray();
        //%%%%% - Market Trades Query Promise Reslution - %%%%%
        get_trades_query.then(get_trades_query_response => {
            //%%%%% - Some Initializations - %%%%%
            let bids = 0;
            let asks = 0;
            let last_time = null;
            let bid_quantity = 0;
            let ask_quantity = 0;
            let total_quantity = 0;
            let last_contract_time;
            let time_elapsed_minutes;
            let last_qty_buy_vs_sell = 0.0;
            //console.log(get_trades_query_response, "=> get_trades_query_response===================================================");
            //%%%%% - FOR LOOP - %%%%%
            for(let i = 0; i < get_trades_query_response.length; i++){
                //%%%%% - IF MAKER IS TRUE THEN DO - ELSE IF MAKER FALSE THEN DO - %%%%%
                if (String(get_trades_query_response[i]['maker']) == 'true') {
                    bid_quantity += get_trades_query_response[i]['quantity'];
                    bids++;
                    //console.log(bid_quantity, "=> bid_quantity");
                } else if (String(get_trades_query_response[i]['maker']) == 'false') {
                    ask_quantity += get_trades_query_response[i]['quantity'];
                    //console.log(ask_quantity, "=> ask_quantity");
                    asks++;
                } //%%%%% - END ELSE IF - %%%%%
                //%%%%% - TOTAL QUANTITY BEING PLUSED - %%%%%
                total_quantity = bid_quantity + ask_quantity;
                //console.log(total_quantity, "=> total_quantity 1");
                //%%%%% - IF TOTAL QUANTITY GOES GREATER THAN CONTRACT SIZE, THEN BREAK - %%%%%
                if (total_quantity >= contract_size) {
                    //%%%%% - CREATED_DATE KEY OF LAST ITERATED JSON OBJECT IN A JSON ARRAY RETURNED BY MARKET TRADES QUERY - %%%%%
                    last_time = get_trades_query_response[i]['created_date'];
                    //console.log(last_time, "=> last_time");
                    break;
                }//%%%%% - END IF - %%%%%
            } //%%%%% - END FOR - %%%%%
            //%%%%% - IF STATEMENT - IN CASE QUERY RETURNS NOTHING THEN last_time WOULD BE NULL - %%%%%
            if(last_time != null){
                last_contract_time = new Date(last_time);
                //%%%%% - TIME ELAPSED IS CALCULATED BY SUBTRACING THE CURRENT TIME FROM TIME OF LAST ITERATED CONTRACT/TRADE RETURNED BY QUERY - %%%%%
                time_elapsed_minutes = time_elapsed_returns_minutes(last_contract_time);
            } else {
                //%%%%% - IF NOTHING IS BEING RETURNED BY QUERY THEN SIMPLY SAY 0 MINUTES - %%%%%
                time_elapsed_minutes = "0 minutes ago";
            }
            //%%%%% - CALCULATE BID AND ASK PERCENTAGES BY DEVIDING BID QUANTITY WITH TOTAL QUANTITY - %%%%%
            let bid_per = (bid_quantity / total_quantity) * 100;
            let ask_per = (ask_quantity / total_quantity) * 100;
            //%%%%% - MULTIPLE IF STATEMENTS - IF QUERY RETURNS NOTHING THEN SOME VARIABLES COULD GET SAVE NaN - %%%%%
            //%%%%% - TO AVOID NaN - %%%%%
            if(isNaN(bid_per)){
                bid_per = 0;
            }
            if(isNaN(ask_per)){
                ask_per = 0;
            }
            if(isNaN(bid_quantity)){
                bid_quantity = 0;
            }
            if(isNaN(ask_quantity)){
                ask_quantity = 0;
            }//%%%%% - END OF MULTIPLE IFS - %%%%%
            //%%%%% - IF ELSE STATEMENT - IF BID||ASK IS GREATER THEN BID||ASK THEN CALCULATE BUYvsSELL - %%%%%
            if (bid_quantity > ask_quantity) {
                if (ask_quantity == 0) {ask_quantity = 1;}
                last_qty_buy_vs_sell = bid_quantity / ask_quantity;
                //%%%%% - IN CASE BID QUANTITY IS GREATER THEN MULTIPLY IT WITH -1 TO MAKE IT POSITIVE - %%%%%
                last_qty_buy_vs_sell = last_qty_buy_vs_sell * -1;
            } else if (ask_quantity > bid_quantity) {
                if (bid_quantity == 0) {bid_quantity = 1;}
                last_qty_buy_vs_sell = ask_quantity / bid_quantity;
            }//%%%%% - END OF IF ELSE STATEMENT - %%%%%
            //%%%%% - INITIALIZE AND FILL JSON OBJECT TO BE RETURNED BY THIS FUNCTION - %%%%%
            let get_contracts_one_json_return = new Object();
            get_contracts_one_json_return['bid_quantity'] = bid_quantity;
            get_contracts_one_json_return['ask_quantity'] = ask_quantity;
            get_contracts_one_json_return['bids_per'] = Math.round(bid_per);
            get_contracts_one_json_return['asks_per'] = Math.round(ask_per);
            get_contracts_one_json_return['last_qty_buy_vs_sell'] = parseFloat(last_qty_buy_vs_sell);
            get_contracts_one_json_return['time_string'] = String(time_elapsed_minutes);
            //console.log(get_contracts_one_json_return, '=> get_contracts_one_json_return');
            //%%%%% - RESOLVE AND RETURN JSON OBJECT FILLED ABOVE - %%%%%
            resolve(get_contracts_one_json_return);
            });//%%%%% - END OF MARKET TRADES QUERY PROMISE RESOLUTION - %%%%%
        });//%%%%% - END OF COINS INFO QUERY PROMISE RESOLUTION - %%%%%
    });//%%%%% - END OF PROMISE OBEJCT --> 'return new promise' - %%%%%
}//%%%%% - END OF FUNCTION - GET CONTRACTS ONE - %%%%%
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//..............................................................................................................................
//.FFFFFFFFFF...................CCCCCCC......OOOOOOO.....NNNN...NNNN..TTTTTTTTTTT.....TTTTTTTTTTTWWW..WWWWW...WWWW..OOOOOOO.....
//.FFFFFFFFFF..................CCCCCCCCC....OOOOOOOOOO...NNNNN..NNNN..TTTTTTTTTTT.....TTTTTTTTTTTWWW..WWWWW..WWWW..OOOOOOOOOO...
//.FFFFFFFFFF.................CCCCCCCCCCC..OOOOOOOOOOOO..NNNNN..NNNN..TTTTTTTTTTT.....TTTTTTTTTTTWWW..WWWWWW.WWWW.OOOOOOOOOOOO..
//.FFFF.......................CCCC...CCCCC.OOOOO..OOOOO..NNNNNN.NNNN.....TTTT............TTTT...TWWW.WWWWWWW.WWWW.OOOOO..OOOOO..
//.FFFF...................... CCC.....CCC.COOOO....OOOOO.NNNNNN.NNNN.....TTTT............TTTT...TWWW.WWWWWWW.WWWWWOOOO....OOOO..
//.FFFFFFFFF................. CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT............TTTT....WWWWWWWWWWW.WWW.WOOO......OOO..
//.FFFFFFFFF................. CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT............TTTT....WWWWWWW.WWWWWWW.WOOO......OOO..
//.FFFFFFFFF...... ------.... CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT............TTTT....WWWWWWW.WWWWWWW.WOOO......OOO..
//.FFFF........... ------.... CCC.....CCC.COOOO....OOOOO.NNNNNNNNNNN.....TTTT............TTTT....WWWWWWW.WWWWWWW.WOOOO....OOOO..
//.FFFF........... ------.....CCCC...CCCCC.OOOOO..OOOOO..NNNN.NNNNNN.....TTTT............TTTT....WWWWWWW.WWWWWWW..OOOOO..OOOOO..
//.FFFF.......................CCCCCCCCCCC..OOOOOOOOOOOO..NNNN..NNNNN.....TTTT............TTTT.....WWWWW...WWWWW...OOOOOOOOOOOO..
//.FFFF........................CCCCCCCCCC...OOOOOOOOOO...NNNN..NNNNN.....TTTT............TTTT.....WWWWW...WWWWW....OOOOOOOOOO...
//.FFFF.........................CCCCCCC.......OOOOOO.....NNNN...NNNN.....TTTT............TTTT.....WWWWW...WWWWW......OOOOOO.....
//..............................................................................................................................


//%%%%% - START OF FUNCTION - GET CONTRACTS TWO - %%%%%
function get_contracts_two(coin, db){
    //%%%% Start of Promise Object %%%%
    return new Promise(function (resolve, reject) {
    //console.log("get_contracts_two")
    //%%%%% - Coins Info Query - %%%%%
    let coin_info_query = db.collection('coins').find({"symbol": coin}).toArray();
    //%%%%% - Coin Info Query Promise Resolution - %%%%%
    coin_info_query.then(coin_info_query_resp => {
        let contract_period = parseInt(coin_info_query_resp[0]['contract_period']);
        //console.log(contract_period, '=> contract_period ---------------------------------------------------------------------------------------------------------------')
        //%%%%% - What's the time now? Check the Clock... - %%%%%
        let nowtime = new Date();
        //%%%%% - Market Trades Query - %%%%%
        let get_trades_query = db.collection('market_trades').find({"coin": coin, "created_date": {$lte: nowtime}}).sort({'created_date': -1}).limit(contract_period).toArray()
        //%%%%% - Market Trades Query Promise Reslution - %%%%%
        get_trades_query.then(get_trades_query_response => {
            //%%%%% - Some Initializations - %%%%%
            let bids = 0;
            let asks = 0;
            let last_time = null;
            let bid_quantity = 0;
            let ask_quantity = 0;
            let total_quantity = 0;
            let last_contract_time;
            let time_elapsed_minutes;
            let last_200_buy_vs_sell = 0.0;
            //console.log(get_trades_query_response, "=> get_trades_query_response===================================================");
            //%%%%% - FOR LOOP - %%%%%
            for(let i = 0; i < get_trades_query_response.length; i++){
                //%%%%% - IF MAKER IS TRUE THEN DO - ELSE IF MAKER FALSE THEN DO - %%%%%
                if (String(get_trades_query_response[i]['maker']) == 'true') {
                    bid_quantity += get_trades_query_response[i]['quantity'];
                    bids++;
                    //console.log(bid_quantity, "=> bid_quantity");
                } else if (String(get_trades_query_response[i]['maker']) == 'false') {
                    ask_quantity += get_trades_query_response[i]['quantity'];
                    //console.log(ask_quantity, "=> ask_quantity");
                    asks++;
                }
                //%%%%% - CREATED_DATE KEY OF LAST ITERATED JSON OBJECT IN A JSON ARRAY RETURNED BY MARKET TRADES QUERY - %%%%%
                last_time = get_trades_query_response[i]['created_date'];
                //console.log(last_time, "=> last_time");
            }
            //%%%%% - END ELSE IF - %%%%%
            //%%%%% - TOTAL QUANTITY BEING PLUSED - %%%%%
            total_quantity = bid_quantity + ask_quantity;
            //console.log(total_quantity, "=> total_quantity 1");
            if(last_time != null){
                last_contract_time = new Date(last_time);
                time_elapsed_minutes = time_elapsed_returns_minutes(last_contract_time);
            } else {
                time_elapsed_minutes = "0 minutes ago";
            }
            let bid_per = (bid_quantity / total_quantity) * 100;
            let ask_per = (ask_quantity / total_quantity) * 100;
            if(isNaN(bid_per)){
                bid_per = 0;
            }
            if(isNaN(ask_per)){
                ask_per = 0;
            }
            if(isNaN(bid_quantity)){
                bid_quantity = 0;
            }
            if(isNaN(ask_quantity)){
                ask_quantity = 0;
            }
            if (bid_quantity > ask_quantity) {
                if (ask_quantity == 0) {ask_quantity = 1;}
                last_200_buy_vs_sell = bid_quantity / ask_quantity;
                last_200_buy_vs_sell = last_200_buy_vs_sell * -1;
            } else if (ask_quantity > bid_quantity) {
                if (bid_quantity == 0) {bid_quantity = 1;}
                last_200_buy_vs_sell = ask_quantity / bid_quantity;
            }
            //%%%%% - JSON OBJECT TO BE RETURNED - %%%%%
            let get_contracts_two_json_return = new Object();
            get_contracts_two_json_return['bid_quantity'] = parseFloat(bid_quantity);
            get_contracts_two_json_return['ask_quantity'] = parseFloat(ask_quantity);
            get_contracts_two_json_return['bids_per'] = Math.round(bid_per);
            get_contracts_two_json_return['asks_per'] = Math.round(ask_per);
            get_contracts_two_json_return['last_200_buy_vs_sell'] = parseFloat(last_200_buy_vs_sell);
            get_contracts_two_json_return['time_string'] = String(time_elapsed_minutes);
            //console.log(get_contracts_two_json_return, '=> get_contracts_two_json_return');
            //%%%%% - RESOLVE AND RETURN - %%%%%
            resolve(get_contracts_two_json_return);
            });//%%%%% - END OF MARKET TRADES QUERY PROMISE RESOLUTION - %%%%%
        });//%%%%% - END OF COINS INFO QUERY PROMISE RESOLUTION - %%%%%
    }); //%%%%% - END OF PROMISE OBJECT 'return new promise' - %%%%%
}//%%%%% - //END OF FUNCTION - GET CONTRCTS TWO - %%%%%
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//.................................................................................................................................................
//.FFFFFFFFFF...................CCCCCCC......OOOOOOO.....NNNN...NNNN..TTTTTTTTTTT.....TTTTTTTTTTTHHHH...HHHH..RRRRRRRRRR...EEEEEEEEEEE.EEEEEEEEEE..
//.FFFFFFFFFF..................CCCCCCCCC....OOOOOOOOOO...NNNNN..NNNN..TTTTTTTTTTT.....TTTTTTTTTTTHHHH...HHHH..RRRRRRRRRRR..EEEEEEEEEEE.EEEEEEEEEE..
//.FFFFFFFFFF.................CCCCCCCCCCC..OOOOOOOOOOOO..NNNNN..NNNN..TTTTTTTTTTT.....TTTTTTTTTTTHHHH...HHHH..RRRRRRRRRRR..EEEEEEEEEEE.EEEEEEEEEE..
//.FFFF.......................CCCC...CCCCC.OOOOO..OOOOO..NNNNNN.NNNN.....TTTT............TTTT....HHHH...HHHH..RRRR...RRRRR.EEEE........EEEE........
//.FFFF...................... CCC.....CCC.COOOO....OOOOO.NNNNNN.NNNN.....TTTT............TTTT....HHHH...HHHH..RRRR...RRRRR.EEEE........EEEE........
//.FFFFFFFFF................. CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT............TTTT....HHHHHHHHHHH..RRRRRRRRRRR..EEEEEEEEEE..EEEEEEEEEE..
//.FFFFFFFFF................. CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT............TTTT....HHHHHHHHHHH..RRRRRRRRRRR..EEEEEEEEEE..EEEEEEEEEE..
//.FFFFFFFFF...... ------.... CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT............TTTT....HHHHHHHHHHH..RRRRRRRR.....EEEEEEEEEE..EEEEEEEEEE..
//.FFFF........... ------.... CCC.....CCC.COOOO....OOOOO.NNNNNNNNNNN.....TTTT............TTTT....HHHH...HHHH..RRRR.RRRR....EEEE........EEEE........
//.FFFF........... ------.....CCCC...CCCCC.OOOOO..OOOOO..NNNN.NNNNNN.....TTTT............TTTT....HHHH...HHHH..RRRR..RRRR...EEEE........EEEE........
//.FFFF.......................CCCCCCCCCCC..OOOOOOOOOOOO..NNNN..NNNNN.....TTTT............TTTT....HHHH...HHHH..RRRR..RRRRR..EEEEEEEEEEE.EEEEEEEEEE..
//.FFFF........................CCCCCCCCCC...OOOOOOOOOO...NNNN..NNNNN.....TTTT............TTTT....HHHH...HHHH..RRRR...RRRRR.EEEEEEEEEEE.EEEEEEEEEE..
//.FFFF.........................CCCCCCC.......OOOOOO.....NNNN...NNNN.....TTTT............TTTT....HHHH...HHHH..RRRR....RRRR.EEEEEEEEEEE.EEEEEEEEEE..
//.................................................................................................................................................


//%%%%% - START OF FUNCTION - GET CONTRACTS THREE - %%%%%
function get_contracts_three(coin, db){
    //%%%%% - START OF PROMISE OBJECT - %%%%%
    return new Promise(function (resolve, reject) {
    //console.log("get_contracts_three");
    //%%%%% - COIN INFO QUERY - %%%%%
    let coin_info_query = db.collection('coins').find({"symbol": coin}).toArray();
    //%%%%% - COIN INFO QUERY PROMISE RESOLUTION - %%%%%
    coin_info_query.then(coin_info_query_resp => {
        let contract_size = coin_info_query_resp[0]['contract_size'];
        //%%%%% - GET CONTRACT SIZE FROM COIN INFO QUERY RESPONSE - %%%%%
        contract_size = parseInt(contract_size * 3);
        //console.log(contract_size, '=> contract_size ---------------------------------------------------------------------------------------------------------------')
        let nowtime = new Date();
        //%%%%% - MARKET TRADES QUERY - %%%%%
        let get_trades_query = db.collection('market_trades').find({"coin": coin, "created_date": {$lte: nowtime}}).sort({'created_date': -1}).toArray()
        //%%%%% - MARKET TRADES QUERY PROMISE RESOLUTION - %%%%%
        get_trades_query.then(get_trades_query_response => {
        let bids = 0;
        let asks = 0;
        let last_time = null;
        let bid_quantity = 0;
        let ask_quantity = 0;
        let total_quantity = 0;
        let last_contract_time;
        let time_elapsed_minutes;
        let last_qty_buy_vs_sell_15 = 0.0;
        //console.log(get_trades_query_response, "=> get_trades_query_response===================================================");
        //%%%%% - FOR LOOP - ADD BID AND ASK QUANTITIES AND ALSO CALCULATE TOTAL QUANTITY BID+ASK - ITERATE UNTIL TOTAL QUANTITY IS GREATHER OR EQUAL TO CONTRACT SIZE - %%%%%
        for(let i = 0; i < get_trades_query_response.length; i++){
                if (String(get_trades_query_response[i]['maker']) == 'true') {
                    bid_quantity += get_trades_query_response[i]['quantity'];
                    bids++;
                    //console.log(bid_quantity, "=> bid_quantity");
                } else if (String(get_trades_query_response[i]['maker']) == 'false') {
                    ask_quantity += get_trades_query_response[i]['quantity'];
                    //console.log(ask_quantity, "=> ask_quantity");
                    asks++;
                }
                total_quantity = bid_quantity + ask_quantity;
                //console.log(total_quantity, "=> total_quantity 1");
                if (total_quantity >= contract_size) {
                    last_time = get_trades_query_response[i]['created_date'];
                    //console.log(last_time, "=> last_time");
                    break;
                }   
        } //%%%%% - END OF FOR LOOP - %%%%%
        //%%%%% - IF MARKET TRADES QUERY RESPONSE IS EMPTY THEN ELSE WILL RUN - %%%%%
        if(last_time != null){
            last_contract_time = new Date(last_time);
            //%%%%% - TIME ELAPSED IS THE CURRENT TIME MINUS CREATED_DATE OF LAST TRADE ITERATED - %%%%%
            time_elapsed_minutes = time_elapsed_returns_minutes(last_contract_time);
        } else {
            time_elapsed_minutes = "0 minutes ago";
        }
        //%%%%% - CALCULATE BID AND ASK PERCENTAGES - %%%%%
        let bid_per = (bid_quantity / total_quantity) * 100;
        let ask_per = (ask_quantity / total_quantity) * 100;
        //%%%%% - WHEN MARKET TRADE RETURNS NOTHING NaN COULD BE STORED - TO AVOID THAT - %%%%%
        if(isNaN(bid_per)){
            bid_per = 0;
        }
        if(isNaN(ask_per)){
            ask_per = 0;
        }
        if(isNaN(bid_quantity)){
            bid_quantity = 0;
        }
        if(isNaN(ask_quantity)){
            ask_quantity = 0;
        }
        //%%%%% -  - %%%%%
        if (bid_quantity > ask_quantity) {
            if (ask_quantity == 0) {ask_quantity = 1;}
            last_qty_buy_vs_sell_15 = bid_quantity / ask_quantity;
            last_qty_buy_vs_sell_15 = last_qty_buy_vs_sell_15 * -1;
        } else if (ask_quantity > bid_quantity) {
            if (bid_quantity == 0) {bid_quantity = 1;}
            last_qty_buy_vs_sell_15 = ask_quantity / bid_quantity;
        }
        let get_contracts_three_json_return = new Object();
        get_contracts_three_json_return['bid_quantity'] = parseFloat(bid_quantity);
        get_contracts_three_json_return['ask_quantity'] = parseFloat(ask_quantity);
        get_contracts_three_json_return['bids_per'] = Math.round(bid_per);
        get_contracts_three_json_return['asks_per'] = Math.round(ask_per);
        get_contracts_three_json_return['last_qty_buy_vs_sell_15'] = parseFloat(last_qty_buy_vs_sell_15);
        get_contracts_three_json_return['time_string'] = String(time_elapsed_minutes);
        //console.log(get_contracts_three_json_return, '=> get_contracts_three_json_return');
        //resolve and return
        resolve(get_contracts_three_json_return);
            });// end of promise : 2 of 2
        });//end of promise.then 1 of 2
    });
    }//end of function : //////////// get_contracts_three //////////////
    //|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
    //|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
    //|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//.......................................................................................................................................
//.FFFFFFFFFF...................CCCCCCC......OOOOOOO.....NNNN...NNNN..TTTTTTTTTTT.....FFFFFFFFFF...OOOOOOO.....UUUU...UUUU..RRRRRRRRRR...
//.FFFFFFFFFF..................CCCCCCCCC....OOOOOOOOOO...NNNNN..NNNN..TTTTTTTTTTT.....FFFFFFFFFF..OOOOOOOOOO...UUUU...UUUU..RRRRRRRRRRR..
//.FFFFFFFFFF.................CCCCCCCCCCC..OOOOOOOOOOOO..NNNNN..NNNN..TTTTTTTTTTT.....FFFFFFFFFF.OOOOOOOOOOOO..UUUU...UUUU..RRRRRRRRRRR..
//.FFFF.......................CCCC...CCCCC.OOOOO..OOOOO..NNNNNN.NNNN.....TTTT.........FFFF.......OOOOO..OOOOO..UUUU...UUUU..RRRR...RRRR..
//.FFFF...................... CCC.....CCC.COOOO....OOOOO.NNNNNN.NNNN.....TTTT.........FFFF......FOOOO....OOOOO.UUUU...UUUU..RRRR...RRRR..
//.FFFFFFFFF................. CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT.........FFFFFFFFF.FOOO......OOOO.UUUU...UUUU..RRRRRRRRRRR..
//.FFFFFFFFF................. CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT.........FFFFFFFFF.FOOO......OOOO.UUUU...UUUU..RRRRRRRRRRR..
//.FFFFFFFFF...... ------.... CCC.........COOO......OOOO.NNNNNNNNNNN.....TTTT.........FFFFFFFFF.FOOO......OOOO.UUUU...UUUU..RRRRRRRR.....
//.FFFF........... ------.... CCC.....CCC.COOOO....OOOOO.NNNNNNNNNNN.....TTTT.........FFFF......FOOOO....OOOOO.UUUU...UUUU..RRRR.RRRR....
//.FFFF........... ------.....CCCC...CCCCC.OOOOO..OOOOO..NNNN.NNNNNN.....TTTT.........FFFF.......OOOOO..OOOOO..UUUU...UUUU..RRRR..RRRR...
//.FFFF.......................CCCCCCCCCCC..OOOOOOOOOOOO..NNNN..NNNNN.....TTTT.........FFFF.......OOOOOOOOOOOO..UUUUUUUUUUU..RRRR..RRRRR..
//.FFFF........................CCCCCCCCCC...OOOOOOOOOO...NNNN..NNNNN.....TTTT.........FFFF........OOOOOOOOOO....UUUUUUUUU...RRRR...RRRR..
//.FFFF.........................CCCCCCC.......OOOOOO.....NNNN...NNNN.....TTTT.........FFFF..........OOOOOO.......UUUUUUU....RRRR....RRR..
//.......................................................................................................................................
    //start of function: ================ get_contracts_two =================
function get_contracts_four(coin, db){
    return new Promise(function (resolve, reject) {
    //console.log("get_contracts_four")
    let coin_info_query = db.collection('coins').find({"symbol": coin}).toArray();
    coin_info_query.then(coin_info_query_resp => {
        let contract_period = parseInt(coin_info_query_resp[0]['contract_period']);
        contract_period = parseInt(contract_period * 3);
        //console.log(contract_period, '=> contract_period ---------------------------------------------------------------------------------------------------------------')
        let nowtime = new Date();
        let get_trades_query = db.collection('market_trades').find({"coin": coin, "created_date": {$lte: nowtime}}).sort({'created_date': -1}).limit(contract_period).toArray()
        get_trades_query.then(get_trades_query_response => {
            let bids = 0;
            let asks = 0;
            let last_time = null;
            let bid_quantity = 0;
            let ask_quantity = 0;
            let total_quantity = 0;
            let last_contract_time;
            let time_elapsed_minutes;
            let last_200_buy_vs_sell_15 = 0.0;
            //console.log(get_trades_query_response, "=> get_trades_query_response===================================================")
            for(let i = 0; i < get_trades_query_response.length; i++){
                if (String(get_trades_query_response[i]['maker']) == 'true') {
                    bid_quantity += get_trades_query_response[i]['quantity'];
                    bids++;
                    //console.log(bid_quantity, "=> bid_quantity");
                } else if (String(get_trades_query_response[i]['maker']) == 'false') {
                    ask_quantity += get_trades_query_response[i]['quantity'];
                    //console.log(ask_quantity, "=> ask_quantity");
                    asks++;
                }
                last_time = get_trades_query_response[i]['created_date'];
                //console.log(last_time, "=> last_time");
            } //enf of : for
            total_quantity = bid_quantity + ask_quantity;
            //console.log(total_quantity, "=> total_quantity 1");
            if(last_time != null){
                last_contract_time = new Date(last_time);
                time_elapsed_minutes = time_elapsed_returns_minutes(last_contract_time);
            } else {
                time_elapsed_minutes = "0 minutes ago";
            }
            let bid_per = (bid_quantity / total_quantity) * 100;
            let ask_per = (ask_quantity / total_quantity) * 100;
            if(isNaN(bid_per)){
                bid_per = 0;
            }
            if(isNaN(ask_per)){
                ask_per = 0;
            }
            if(isNaN(bid_quantity)){
                bid_quantity = 0;
            }
            if(isNaN(ask_quantity)){
                ask_quantity = 0;
            }
            if (bid_quantity > ask_quantity) {
                if (ask_quantity == 0) {ask_quantity = 1;}
                last_200_buy_vs_sell_15 = bid_quantity / ask_quantity;
                last_200_buy_vs_sell_15 = last_200_buy_vs_sell_15 * -1;
            } else if (ask_quantity > bid_quantity) {
                if (bid_quantity == 0) {bid_quantity = 1;}
                last_200_buy_vs_sell_15 = ask_quantity / bid_quantity;
            }
            let get_contracts_four_json_return = new Object();
            get_contracts_four_json_return['bid_quantity'] = parseFloat(bid_quantity);
            get_contracts_four_json_return['ask_quantity'] = parseFloat(ask_quantity);
            get_contracts_four_json_return['bids_per'] = Math.round(bid_per);
            get_contracts_four_json_return['asks_per'] = Math.round(ask_per);
            get_contracts_four_json_return['last_200_buy_vs_sell_15'] = parseFloat(last_200_buy_vs_sell_15);
            get_contracts_four_json_return['time_string'] = String(time_elapsed_minutes);
            //console.log(get_contracts_four_json_return, '=> get_contracts_four_json_return');
            //resolve and return
            resolve(get_contracts_four_json_return);
            });// end of promise : 2 of 2
        });//end of promise.then 1 of 2
    });
}//end of function : //////////// get_contracts_four //////////////
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//......................................................................................
//.FFFFFFFFFF....................1111....55555555..... MMMM...MMMMMMMMIII.INNN...NNNN..
//.FFFFFFFFFF...................11111...155555555..... MMMM...MMMMMMMMIII.INNNN..NNNN..
//.FFFFFFFFFF..................111111...1555.......... MMMM...MMMMMMMMIII.INNNN..NNNN..
//.FFFF.......................1111111...1555.......... MMMMM.MMMMMMMMMIII.INNNNN.NNNN..
//.FFFF.......................1111111...1555555....... MMMMM.MMMMMMMMMIII.INNNNN.NNNN..
//.FFFFFFFFF..................11.1111...15555555...... MMMMM.MMMMMMMMMIII.INNNNNNNNNN..
//.FFFFFFFFF.....................1111..1155.55555..... MMMMMMMMMMMMMMMIII.INNNNNNNNNN..
//.FFFFFFFFF...... ------........1111........5555..... MMMMMMMMMMMMMMMIII.INNNNNNNNNN..
//.FFFF........... ------........1111........5555..... MMMMMMMMMMMMMMMIII.INNNNNNNNNN..
//.FFFF........... ------........1111........5555..... MM.MMMMM.MMMMMMIII.INNN.NNNNNN..
//.FFFF..........................1111..1155.55555..... MM.MMMMM.MMMMMMIII.INNN..NNNNN..
//.FFFF..........................1111...15555555...... MM.MMMMM.MMMMMMIII.INNN..NNNNN..
//.FFFF..........................1111....555555....... MM.MMMMM.MMMMMMIII.INNN...NNNN..
//......................................................................................


 //start of function : ================================== get_rolling_fifteen_mins_trade_vol ============================= //
 function get_rolling_fifteen_mins_trade_vol(coin, db){
    return new Promise(function (resolve, reject) { //thankyou ustad zulqarnain
        let sellers_buyers_per_fifteen = 0.0;
        let trade_type_fifteen = "";
    let time_minus_15_min = new Date();
    time_minus_15_min.setMinutes(time_minus_15_min.getMinutes() - 15);
    //console.log(time_minus_15_min, "=> time_minus_15_min");
    get_trades_query = db.collection('market_trades').find({'coin': coin, 'created_date': {$gte: time_minus_15_min} }).toArray();
    get_trades_query.then(get_trades_query_response => {
        let bid_vol = 0;
        let ask_vol = 0;
        //console.log(get_trades_query_response);
       get_trades_query_response.forEach(element => {
            if(element['maker'] == 'true'){ // element['maker'] key returns a bool value
                bid_vol += element['quantity'];
            } else if(element['maker'] == 'false'){
                ask_vol += element['quantity'];
            }
        });//end of foreach
        //console.log(bid_vol, '=> bid_vol', ask_vol, '=> ask_vol');
        let total_volume = bid_vol + ask_vol;

        let bid_per = (bid_vol * 100) / total_volume;
        let ask_per = (ask_vol * 100) / total_volume;
        if(isNaN(bid_per)){
            bid_per = 0;
        }
        if(isNaN(ask_per)){
            ask_per = 0;
        }
        if(isNaN(bid_vol)){
            bid_vol = 0;
        }
        if(isNaN(ask_vol)){
            ask_vol = 0;
        }
        if (bid_vol > ask_vol) {
            if (ask_vol == 0) {ask_vol = 1;}
            sellers_buyers_per_fifteen = bid_vol / ask_vol;
            sellers_buyers_per_fifteen = sellers_buyers_per_fifteen * -1;
            trade_type_fifteen = 'blue';
        } else if (ask_vol > bid_vol) {
            if (bid_vol == 0) {bid_vol = 1;}
            sellers_buyers_per_fifteen = ask_vol / bid_vol;
            trade_type_fifteen = 'red';
        }
        let get_rolling_fifteen_mins_trade_vol_return_json = new Object();

        get_rolling_fifteen_mins_trade_vol_return_json['bid_per'] = Math.round(bid_per);
        get_rolling_fifteen_mins_trade_vol_return_json['ask_per'] = Math.round(ask_per);
        get_rolling_fifteen_mins_trade_vol_return_json['bid_vol'] = parseFloat(bid_vol);
        get_rolling_fifteen_mins_trade_vol_return_json['ask_vol'] = parseFloat(ask_vol);
        get_rolling_fifteen_mins_trade_vol_return_json['sellers_buyers_per_fifteen'] = parseFloat(sellers_buyers_per_fifteen);
        get_rolling_fifteen_mins_trade_vol_return_json['trade_type_fifteen'] = String(trade_type_fifteen);


        resolve(get_rolling_fifteen_mins_trade_vol_return_json);

    })//end of promise.then: 1 of
});// end of new promise
}//end of function : /////////////////////// get_rolling_fifteen_mins_trade_vol ////////////////////////
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//............................................................................
//.FFFFFFFFFF..................55555555..... MMMM...MMMMMMMIIII.NNNN...NNNN..
//.FFFFFFFFFF.................555555555..... MMMM...MMMMMMMIIII.NNNNN..NNNN..
//.FFFFFFFFFF.................5555.......... MMMM...MMMMMMMIIII.NNNNN..NNNN..
//.FFFF.......................5555.......... MMMMM.MMMMMMMMIIII.NNNNNN.NNNN..
//.FFFF.......................5555555....... MMMMM.MMMMMMMMIIII.NNNNNN.NNNN..
//.FFFFFFFFF..................55555555...... MMMMM.MMMMMMMMIIII.NNNNNNNNNNN..
//.FFFFFFFFF................. 555.55555..... MMMMMMMMMMMMMMIIII.NNNNNNNNNNN..
//.FFFFFFFFF...... ------..........5555..... MMMMMMMMMMMMMMIIII.NNNNNNNNNNN..
//.FFFF........... ------..........5555..... MMMMMMMMMMMMMMIIII.NNNNNNNNNNN..
//.FFFF........... ------..........5555..... MM.MMMMM.MMMMMIIII.NNNN.NNNNNN..
//.FFFF...................... 555.55555..... MM.MMMMM.MMMMMIIII.NNNN..NNNNN..
//.FFFF.......................55555555...... MM.MMMMM.MMMMMIIII.NNNN..NNNNN..
//.FFFF........................555555....... MM.MMMMM.MMMMMIIII.NNNN...NNNN..
//............................................................................

//start of function : ================================== get_rolling_five_mins_trade_volume ============================= //
function get_rolling_five_mins_trade_volume(coin, db){
    return new Promise(function (resolve, reject) { //thankyou ustad zulqarnain
    let time_minus_5_min = new Date();
    time_minus_5_min.setMinutes(time_minus_5_min.getMinutes() - 5);
    //console.log(time_minus_5_min, "=> time_minus_5_min");
    get_trades_query = db.collection('market_trades').find({'coin': coin, 'created_date': {$gte: time_minus_5_min} }).toArray();
    get_trades_query.then(get_trades_query_response => {
        let bid_vol = 0;
        let ask_vol = 0;
        //console.log(get_trades_query_response);
        get_trades_query_response.forEach(element => {
        if(element['maker'] == 'true'){ // element['maker'] key returns a bool value when field type in collection is bool or T/F
            bid_vol += element['quantity'];
        } else if(element['maker'] == 'false'){
            ask_vol += element['quantity'];
        }
        });//end of foreach
        //console.log(bid_vol, '=> bid_vol', ask_vol, '=> ask_vol');
        let total_volume = bid_vol + ask_vol;

        let bid_per = (bid_vol * 100) / total_volume;
        let ask_per = (ask_vol * 100) / total_volume;
        if(isNaN(bid_per)){
            bid_per = 0;
        }
        if(isNaN(ask_per)){
            ask_per = 0;
        }
        if(isNaN(bid_vol)){
            bid_vol = 0;
        }
        if(isNaN(ask_vol)){
            ask_vol = 0;
        }
        let sellers_buyers_per = 0;
        let trade_type = "";
        if (bid_vol > ask_vol) {
            if (ask_vol == 0) {ask_vol = 1;}
            sellers_buyers_per = bid_vol / ask_vol;
            sellers_buyers_per = sellers_buyers_per * -1;
            trade_type = 'blue';

        } else if (ask_vol > bid_vol) {
            if (bid_vol == 0) {bid_vol = 1;}
            sellers_buyers_per = ask_vol / bid_vol;
            trade_type = 'red';
        }

        let get_rolling_five_mins_trade_volume_return_json = new Object();

        get_rolling_five_mins_trade_volume_return_json['bid_per'] = Math.round(bid_per);
        get_rolling_five_mins_trade_volume_return_json['ask_per'] = Math.round(ask_per);
        get_rolling_five_mins_trade_volume_return_json['bid_vol'] = parseFloat(bid_vol);
        get_rolling_five_mins_trade_volume_return_json['ask_vol'] = parseFloat(ask_vol);
        get_rolling_five_mins_trade_volume_return_json['sellers_buyers_per'] = parseInt(sellers_buyers_per);
        get_rolling_five_mins_trade_volume_return_json['trade_type'] = String(trade_type);
        //%%%%%% - Resolve and Return JSON Response - %%%%%%
        resolve(get_rolling_five_mins_trade_volume_return_json);

    })//end of promise.then: 1 of
});// end of new promise
}//end of function : /////////////////////// get_rolling_five_mins_trade_volume ////////////////////////
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//..........................................................................................................................................................................................................................................
//.FFFFFFFFFF.................RRRRRRRRRR.....OOOOOOO.....LLLL.......LLLL......LIIII.NNNN...NNNN.....GGGGGGG.........HHHH...HHHH....OOOOOOO.....UUUU...UUUU..RRRRRRRRRR........TTTTTTTTTTTRRRRRRRRRR......AAAAA.....DDDDDDDDD....EEEEEEEEEE..
//.FFFFFFFFFF.................RRRRRRRRRRR...OOOOOOOOOO...LLLL.......LLLL......LIIII.NNNNN..NNNN...GGGGGGGGGG........HHHH...HHHH...OOOOOOOOOO...UUUU...UUUU..RRRRRRRRRRR.......TTTTTTTTTTTRRRRRRRRRRR.....AAAAA.....DDDDDDDDDD...EEEEEEEEEE..
//.FFFFFFFFFF.................RRRRRRRRRRR..OOOOOOOOOOOO..LLLL.......LLLL......LIIII.NNNNN..NNNN..GGGGGGGGGGGG.......HHHH...HHHH..OOOOOOOOOOOO..UUUU...UUUU..RRRRRRRRRRR.......TTTTTTTTTTTRRRRRRRRRRR....AAAAAA.....DDDDDDDDDDD..EEEEEEEEEE..
//.FFFF.......................RRRR...RRRRR.OOOOO..OOOOO..LLLL.......LLLL......LIIII.NNNNNN.NNNN..GGGGG..GGGGG.......HHHH...HHHH..OOOOO..OOOOO..UUUU...UUUU..RRRR...RRRRR.........TTTT....RRRR...RRRRR...AAAAAAA....DDDD...DDDD..EEEE........
//.FFFF.......................RRRR...RRRRRROOOO....OOOOO.LLLL.......LLLL......LIIII.NNNNNN.NNNN.NGGGG....GGG........HHHH...HHHH.HOOOO....OOOOO.UUUU...UUUU..RRRR...RRRRR.........TTTT....RRRR...RRRRR..AAAAAAAA....DDDD....DDDD.EEEE........
//.FFFFFFFFF..................RRRRRRRRRRR.ROOO......OOOO.LLLL.......LLLL......LIIII.NNNNNNNNNNN.NGGG................HHHHHHHHHHH.HOOO......OOOO.UUUU...UUUU..RRRRRRRRRRR..........TTTT....RRRRRRRRRRR...AAAAAAAA....DDDD....DDDD.EEEEEEEEEE..
//.FFFFFFFFF..................RRRRRRRRRRR.ROOO......OOOO.LLLL.......LLLL......LIIII.NNNNNNNNNNN.NGGG..GGGGGGGG......HHHHHHHHHHH.HOOO......OOOO.UUUU...UUUU..RRRRRRRRRRR..........TTTT....RRRRRRRRRRR...AAAA.AAAA...DDDD....DDDD.EEEEEEEEEE..
//.FFFFFFFFF...... ------.....RRRRRRRR....ROOO......OOOO.LLLL.......LLLL......LIIII.NNNNNNNNNNN.NGGG..GGGGGGGG......HHHHHHHHHHH.HOOO......OOOO.UUUU...UUUU..RRRRRRRR.............TTTT....RRRRRRRR.....AAAAAAAAAA...DDDD....DDDD.EEEEEEEEEE..
//.FFFF........... ------.....RRRR.RRRR...ROOOO....OOOOO.LLLL.......LLLL......LIIII.NNNNNNNNNNN.NGGGG.GGGGGGGG......HHHH...HHHH.HOOOO....OOOOO.UUUU...UUUU..RRRR.RRRR............TTTT....RRRR.RRRR....AAAAAAAAAAA..DDDD....DDDD.EEEE........
//.FFFF........... ------.....RRRR..RRRR...OOOOO..OOOOO..LLLL.......LLLL......LIIII.NNNN.NNNNNN..GGGGG....GGGG......HHHH...HHHH..OOOOO..OOOOO..UUUU...UUUU..RRRR..RRRR...........TTTT....RRRR..RRRR...AAAAAAAAAAA..DDDD...DDDDD.EEEE........
//.FFFF.......................RRRR..RRRRR..OOOOOOOOOOOO..LLLLLLLLLL.LLLLLLLLLLLIIII.NNNN..NNNNN..GGGGGGGGGGGG.......HHHH...HHHH..OOOOOOOOOOOO..UUUUUUUUUUU..RRRR..RRRRR..........TTTT....RRRR..RRRRR.RAAA....AAAA..DDDDDDDDDDD..EEEEEEEEEE..
//.FFFF.......................RRRR...RRRRR..OOOOOOOOOO...LLLLLLLLLL.LLLLLLLLLLLIIII.NNNN..NNNNN...GGGGGGGGGG........HHHH...HHHH...OOOOOOOOOO....UUUUUUUUU...RRRR...RRRRR.........TTTT....RRRR...RRRRRRAAA.....AAAA.DDDDDDDDDD...EEEEEEEEEE..
//.FFFF.......................RRRR....RRRR....OOOOOO.....LLLLLLLLLL.LLLLLLLLLLLIIII.NNNN...NNNN.....GGGGGGG.........HHHH...HHHH.....OOOOOO.......UUUUUUU....RRRR....RRRR.........TTTT....RRRR....RRRRRAAA.....AAAA.DDDDDDDDD....EEEEEEEEEE..
//..........................................................................................................................................................................................................................................


//start of function : ================================== get_rolling_hour_trade_volume ============================= //
function get_rolling_hour_trade_volume(coin, db){
    return new Promise(function (resolve, reject) { //thankyou ustad zulqarnain
    let rolling_hour_start = new Date();
    rolling_hour_start.setMinutes(00);
    rolling_hour_start.setSeconds(00);
    rolling_hour_start.setMilliseconds(000);
    let time_now = new Date();
    
    get_trades_query = db.collection('market_trades').find({'coin': coin, 'created_date': {$gte: rolling_hour_start}}).toArray();
    get_trades_query.then(get_trades_query_response => {
        ////console.log(get_trades_query_response, "=> get_trades_query_response")
        let bid_vol = 0;
        let ask_vol = 0;
        ////console.log(get_trades_query_response);
       get_trades_query_response.forEach(element => {
            if(String(element['maker']) == 'true'){ // element['maker'] key returns a bool value
                bid_vol += element['quantity'];
            } else if(String(element['maker']) == 'false'){
                ask_vol += element['quantity'];
            }
        });//end of foreach
        ////console.log(bid_vol, '=> bid_vol', ask_vol, '=> ask_vol');
        let total_volume = bid_vol + ask_vol;

        let bid_per = (bid_vol * 100) / total_volume;
        let ask_per = (ask_vol * 100) / total_volume;
        if(isNaN(bid_per)){
            bid_per = 0;
        }
        if(isNaN(ask_per)){
            ask_per = 0;
        }
        if(isNaN(bid_vol)){
            bid_vol = 0;
        }
        if(isNaN(ask_vol)){
            ask_vol = 0;
        }
        let sellers_buyers_per = 0;
        let trade_type = "";
        if (bid_vol > ask_vol) {
            if (ask_vol == 0) {ask_vol = 1;}
            sellers_buyers_per = bid_vol / ask_vol;
            sellers_buyers_per = sellers_buyers_per * -1;
            trade_type = 'blue';

        } else if (ask_vol > bid_vol) {
            if (bid_vol == 0) {bid_vol = 1;}
            sellers_buyers_per = ask_vol / bid_vol;
            trade_type = 'red';
        }

        let get_rolling_hour_trade_volume_return_json = new Object();

        get_rolling_hour_trade_volume_return_json['bid_per'] = bid_per;
        get_rolling_hour_trade_volume_return_json['ask_per'] = Math.round(ask_per);
        get_rolling_hour_trade_volume_return_json['bid_vol'] = parseFloat(bid_vol);
        get_rolling_hour_trade_volume_return_json['ask_vol'] = parseFloat(ask_vol);
        get_rolling_hour_trade_volume_return_json['sellers_buyers_per_t4cot'] = parseFloat(sellers_buyers_per);
        get_rolling_hour_trade_volume_return_json['trade_type_t4cot'] = String(trade_type);
        //%%%%%% Resolve and Return JSON %%%%%%
        resolve(get_rolling_hour_trade_volume_return_json);

    })//end of promise.then: 1 of
});// end of new promise
}//end of function : /////////////////////// get_rolling_hour_trade_volume ////////////////////////
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

//.............................................................................................
//.FFFFFFFFFF..................SSSSSSS......CCCCCCC......OOOOOOO.....RRRRRRRRRR...EEEEEEEEEEE..
//.FFFFFFFFFF.................SSSSSSSSS....CCCCCCCCC....OOOOOOOOOO...RRRRRRRRRRR..EEEEEEEEEEE..
//.FFFFFFFFFF.................SSSSSSSSSS..CCCCCCCCCCC..OOOOOOOOOOOO..RRRRRRRRRRR..EEEEEEEEEEE..
//.FFFF...................... SSSS..SSSS..CCCC...CCCCC.OOOOO..OOOOO..RRRR...RRRRR.EEEE.........
//.FFFF...................... SSSS.......SCCC.....CCC.COOOO....OOOOO.RRRR...RRRRR.EEEE.........
//.FFFFFFFFF..................SSSSSSS....SCCC.........COOO......OOOO.RRRRRRRRRRR..EEEEEEEEEE...
//.FFFFFFFFF...................SSSSSSSSS.SCCC.........COOO......OOOO.RRRRRRRRRRR..EEEEEEEEEE...
//.FFFFFFFFF...... ------........SSSSSSS.SCCC.........COOO......OOOO.RRRRRRRR.....EEEEEEEEEE...
//.FFFF........... ------...........SSSSSSCCC.....CCC.COOOO....OOOOO.RRRR.RRRR....EEEE.........
//.FFFF........... ------.... SSS....SSSS.CCCC...CCCCC.OOOOO..OOOOO..RRRR..RRRR...EEEE.........
//.FFFF...................... SSSSSSSSSSS.CCCCCCCCCCC..OOOOOOOOOOOO..RRRR..RRRRR..EEEEEEEEEEE..
//.FFFF.......................SSSSSSSSSS...CCCCCCCCCC...OOOOOOOOOO...RRRR...RRRRR.EEEEEEEEEEE..
//.FFFF........................SSSSSSSS.....CCCCCCC.......OOOOOO.....RRRR....RRRR.EEEEEEEEEEE..
//.............................................................................................


//%%%%%%%%%%%%%%%%%% Start of Function - Calculate_Score %%%%%%%%%%%%%%%%%%%%
function calculate_score(score_array){
    //console.log(score_array, "-> score_array in function ")

    let depth_pressure = score_array['depth_pressure'];
    let depth_pressure_side = score_array['depth_pressure_side'];

    let black_pressure = score_array['black_pressure'];
    let black_color_side = score_array['black_color_side'];

    let yellow_pressure = score_array['yellow_pressure'];
    let yellow_color_side = score_array['yellow_color_side'];

    let seven_level = score_array['seven_level'];
    let seven_level_side = score_array['seven_level_side'];

    let big_pressure = score_array['big_pressure'];

    let buyers = score_array['buyers'];
    let sellers = score_array['sellers'];

    let big_buyers = score_array['big_buyers'];
    let big_sellers = score_array['big_sellers'];

    let t_h_b = score_array['t_h_b'];
    let t_h_a = score_array['t_h_a'];
 
    let total_score_array = [];

    //%%%%%%%%%% Depth Score %%%%%%%%%%%%%%%
    let score_depth = depth_pressure * 1;
    total_score_array.push(score_depth);
    //%%%%%%%%%% End Depth Score %%%%%%%%%%%

    //%%%%%%%%%% Black Score %%%%%%%%%%%%%%%
    let score_black = 0;
    if (black_pressure >= 5) {
        score_black = 5;
    } else {
        score_black = black_pressure;
    }
    total_score_array.push(score_black);
    //%%%%%%%%%% End Depth Score %%%%%%%%%%%%%%%

    //%%%%%%%%%% Yellow Score %%%%%%%%%%%%%%%
    let score_yellow = 0;
    if (yellow_pressure >= 4) {
        score_yellow = 4;
    } else {
        score_yellow = yellow_pressure;
    }
    score_yellow = score_yellow * 1;
    total_score_array.push(score_yellow);
    //%%%%%%%%%% End Yellow Score %%%%%%%%%%%%%%%

    //%%%%%%%%%% Seven Level Score %%%%%%%%%%%%%%%
    let score_seven;
    if (seven_level <= 0.5) {
        score_seven = 1;
    } else if (seven_level <= 1) {
        score_seven = 2;
    } else if (seven_level <= 2) {
        score_seven = 3;
    } else if (seven_level <= 3) {
        score_seven = 4;
    } else {
        score_seven = 5;
    }
    total_score_array.push(score_seven)
    //%%%%%%%%%% End of Seven Level Score %%%%%%%%%%%%%%%

    //%%%%%%%%%% Buyers Score %%%%%%%%%%%%%%%
    let score_buyers;
    if (buyers <= 25) {
        score_buyers = 1;
    } else if (buyers <= 40) {
        score_buyers = 2;
    } else if (buyers <= 60) {
        score_buyers = 3
    } else if (buyers <= 80) {
        score_buyers = 4;
    } else if (buyers <= 100) {
        score_buyers = 5;
    }
    total_score_array.push(score_buyers);
    //%%%%%%%%%% End Buyers Score %%%%%%%%%%%%%%%

    //%%%%%%%%%% Sellers Score %%%%%%%%%%%%%%%
    let score_sellers;
    if (sellers <= 25) {
        score_sellers = -1;
    } else if (sellers <= 40) {
        score_sellers = -2;
    } else if (sellers <= 60) {
        score_sellers = -3
    } else if (sellers <= 80) {
        score_sellers = -4;
    } else if (sellers <= 100) {
        score_sellers = -5;
    }
    total_score_array.push(score_sellers);
    //%%%%%%%%%% End Sellers Score %%%%%%%%%%%%%%%

    //%%%%%%%%%% t_h_a Score %%%%%%%%%%%%%%%
    let score_t_h_a;
    if (t_h_a >= 25 && t_h_a <= 50) {
        score_t_h_a = 1;
    } else if (t_h_a >= 50 && t_h_a <= 75) {
        score_t_h_a = 2;
    } else if (t_h_a >= 75) {
        score_t_h_a = 3;
    } else {
        score_t_h_a = 0;
    }
    total_score_array.push(score_t_h_a);
    //%%%%%%%%%% End t_h_a Score %%%%%%%%%%%%%%%

    //%%%%%%%%%% t_h_b Score %%%%%%%%%%%%%%%
    let score_t_h_b;
    if (t_h_b >= 25 && t_h_b <= 50) {
        score_t_h_b = -1;
    } else if (t_h_b >= 50 && t_h_b <= 75) {
        score_t_h_a = -2;
    } else if (t_h_b >= 75) {
        score_t_h_b = -3;
    } else {
        score_t_h_b = 0;
    }
    total_score_array.push(score_t_h_b);
    //%%%%%%%%%% End t_h_b Score %%%%%%%%%%%%%%%

    //%%%%%%%%%% Big Buyers Score %%%%%%%%%%%%%%%
    let score_big_buyers;
    if (big_buyers >= 10) {
        score_big_buyers = 1;
    } else if (big_buyers >= 20) {
        score_big_buyers = 2;
    } else if (big_buyers >= 40) {
        score_big_buyers = 3;
    } else if (big_buyers >= 60) {
        score_big_buyers = 4;
    } else if (big_buyers >= 80) {
        score_big_buyers = 5;
    } else if (big_buyers >= 90) {
        score_big_buyers = 6;
    } else {
        score_big_buyers = 0;
    }
    total_score_array.push(score_big_buyers);
    //%%%%%%%%%% End Big Buyers Score %%%%%%%%%%%%%%%

    //%%%%%%%%%% Big Sellers Score %%%%%%%%%%%%%%%
    let score_big_sellers;
    if (big_sellers >= 10) {
        score_big_sellers = -1;
    } else if (big_sellers >= 20) {
        score_big_sellers = -2;
    } else if (big_sellers >= 40) {
        score_big_sellers = -3;
    } else if (big_sellers >= 60) {
        score_big_sellers = -4;
    } else if (big_sellers >= 80) {
        score_big_sellers = -5;
    } else if (big_sellers >= 90) {
        score_big_sellers = -6;
    } else {
        score_big_sellers = 0;
    }
    total_score_array.push(score_big_sellers);
    //%%%%%%%%%% End Big Sellers Score %%%%%%%%%%%%%%%

    //%%%%%%%%%% Big Pressure %%%%%%%%%%%%%%%
    let score_big;
    if (big_pressure == 'downside') {
        score_big = 2;
    } else if (big_pressure == 'upside') {
        score_big = -2;
    }
    total_score_array.push(score_big);
    //%%%%%%%%%% End Big Pressure %%%%%%%%%%%%%%%

    //console.log(total_score_array, "=> total_score_array")

    let score_calculated = total_score_array.reduce(function(a, b) { return a + b; }, 0);
    score_calculated = score_calculated + 50;

    //console.log(score_calculated, '=> score_calculated');

    return parseInt(score_calculated);

}//%%%%%%%%%%%%%%%%%% End of Function - Calculate_Score %%%%%%%%%%%%%%%%%%%%

//................................................................................................................................................
//.FFFFFFFFFF.................DDDDDDDDD....EEEEEEEEEEE.PPPPPPPPP...PTTTTTTTTTTHHHH...HHHH..... VVV....VVVVV..OOOOOOO.....OLLL........SSSSSSS.....
//.FFFFFFFFFF.................DDDDDDDDDD...EEEEEEEEEEE.PPPPPPPPPP..PTTTTTTTTTTHHHH...HHHH...... VVV....VVVV..OOOOOOOOOO...OLLL.......SSSSSSSSS....
//.FFFFFFFFFF.................DDDDDDDDDDD..EEEEEEEEEEE.PPPPPPPPPPP.PTTTTTTTTTTHHHH...HHHH...... VVV....VVVV.VOOOOOOOOOOO..OLLL.......SSSSSSSSSS...
//.FFFF.......................DDDD...DDDD..EEEE........PPPP...PPPP....TTTT....HHHH...HHHH...... VVVV..VVVV..VOOOO..OOOOO..OLLL......LSSSS..SSSS...
//.FFFF.......................DDDD....DDDD.EEEE........PPPP...PPPP....TTTT....HHHH...HHHH.......VVVV..VVVV.VVOOO....OOOOO.OLLL......LSSSS.........
//.FFFFFFFFF..................DDDD....DDDD.EEEEEEEEEE..PPPPPPPPPPP....TTTT....HHHHHHHHHHH.......VVVV..VVVV.VVOO......OOOO.OLLL.......SSSSSSS......
//.FFFFFFFFF..................DDDD....DDDD.EEEEEEEEEE..PPPPPPPPPP.....TTTT....HHHHHHHHHHH.......VVVVVVVVV..VVOO......OOOO.OLLL........SSSSSSSSS...
//.FFFFFFFFF...... ------.....DDDD....DDDD.EEEEEEEEEE..PPPPPPPPP......TTTT....HHHHHHHHHHH........VVVVVVVV..VVOO......OOOO.OLLL..........SSSSSSS...
//.FFFF........... ------.....DDDD....DDDD.EEEE........PPPP...........TTTT....HHHH...HHHH........VVVVVVVV..VVOOO....OOOOO.OLLL.............SSSSS..
//.FFFF........... ------.....DDDD...DDDDD.EEEE........PPPP...........TTTT....HHHH...HHHH........VVVVVVV....VOOOO..OOOOO..OLLL......LSSS....SSSS..
//.FFFF.......................DDDDDDDDDDD..EEEEEEEEEEE.PPPP...........TTTT....HHHH...HHHH.........VVVVVV....VOOOOOOOOOOO..OLLLLLLLLLLSSSSSSSSSSS..
//.FFFF.......................DDDDDDDDDD...EEEEEEEEEEE.PPPP...........TTTT....HHHH...HHHH.........VVVVVV.....OOOOOOOOOO...OLLLLLLLLL.SSSSSSSSSS...
//.FFFF.......................DDDDDDDDD....EEEEEEEEEEE.PPPP...........TTTT....HHHH...HHHH.........VVVVV........OOOOOO.....OLLLLLLLLL..SSSSSSSS....
//................................................................................................................................................


//########################### - START OF FUNCTION - calculate_market_depth_bid_ask_volumes - ###################################
function calculate_market_depth_bid_ask_volumes(final_chart3_json_arr_bid, final_chart3_json_arr_ask){
    let market_depth_bid_volume = 0.0;
    let market_depth_ask_volume = 0.0;
    for(let i = 0; i < final_chart3_json_arr_ask.length; i++){
        market_depth_bid_volume += parseFloat(final_chart3_json_arr_bid[i].depth_sell_quantity);
    }
    for(let i = 0; i < final_chart3_json_arr_bid.length; i++){
        market_depth_ask_volume += parseFloat(final_chart3_json_arr_ask[i].depth_buy_quantity);
    }

    let market_depth_bid_ask_volumes_return_arr = [];
    market_depth_bid_ask_volumes_return_arr.push(market_depth_bid_volume);
    market_depth_bid_ask_volumes_return_arr.push(market_depth_ask_volume);

    //console.log(market_depth_bid_ask_volumes_return_arr, "market_depth_bid_ask_volumes_return_arr <==");
    return market_depth_bid_ask_volumes_return_arr;
}//%%%%%%%%%%%%%%%%% - ///// END OF FUNCTION - calculate_market_depth_bid_ask_volumes - %%%%%%%%%%%%%%%%%%%%%%%

//.............................................................................................................
//.BBBBBBBBBB...UUUU...UUUU.UYYY....YYYY.......SSSSSSS....SEEEEEEEEEE.ELLL.......LLLL..............&&&&&&......
//.BBBBBBBBBBB..UUUU...UUUU.UYYYY..YYYYY...... SSSSSSSS...SEEEEEEEEEE.ELLL.......LLLL.............&&&&&&&&.....
//.BBBBBBBBBBB..UUUU...UUUU..YYYY..YYYY....... SSSSSSSSS..SEEEEEEEEEE.ELLL.......LLLL............ &&&&&&&&.....
//.BBBB...BBBB..UUUU...UUUU..YYYYYYYYY....... SSS..SSSS..SEEE........ELLL.......LLLL.............&&&&&&&&.....
//.BBBB...BBBB..UUUU...UUUU...YYYYYYYY....... SSS........SEEE........ELLL.......LLLL.............&&&&&&&&.....
//.BBBBBBBBBBB..UUUU...UUUU....YYYYYY......... SSSSSS.....SEEEEEEEEE..ELLL.......LLLL..............&&&&&&......
//.BBBBBBBBBB...UUUU...UUUU....YYYYYY..........SSSSSSSSS..SEEEEEEEEE..ELLL.......LLLL.............&&&&&&.......
//.BBBBBBBBBBB..UUUU...UUUU.....YYYY.............SSSSSSS..SEEEEEEEEE..ELLL.......LLLL............ &&&&&&&&&&...
//.BBBB....BBBB.UUUU...UUUU.....YYYY................SSSSS.SEEE........ELLL.......LLLL........... &&.&&&&&&&...
//.BBBB....BBBB.UUUU...UUUU.....YYYY......... SS....SSSS.SEEE........ELLL.......LLLL........... &&..&&&&&&...
//.BBBBBBBBBBBB.UUUUUUUUUUU.....YYYY......... SSSSSSSSSS.SEEEEEEEEEE.ELLLLLLLLL.LLLLLLLLLL..... &&&.&&&&&&...
//.BBBBBBBBBBB...UUUUUUUUU......YYYY.......... SSSSSSSSS..SEEEEEEEEEE.ELLLLLLLLL.LLLLLLLLLL...... &&&&&&&&&&&..
//.BBBBBBBBBB.....UUUUUUU.......YYYY...........SSSSSSSS...SEEEEEEEEEE.ELLLLLLLLL.LLLLLLLLLL.......&&&&&&&&&&...
//.............................................................................................................

//............................................................................
//.BBBBBBBBBB..BIIII.DDDDDDDDD............AAAAA......SSSSSSS....SKKK...KKKKK..
//.BBBBBBBBBBB.BIIII.DDDDDDDDDD...........AAAAA.....SSSSSSSSS...SKKK..KKKKK...
//.BBBBBBBBBBB.BIIII.DDDDDDDDDDD.........AAAAAA.....SSSSSSSSSS..SKKK.KKKKK....
//.BBBB...BBBB.BIIII.DDDD...DDDD.........AAAAAAA...ASSSS..SSSS..SKKKKKKKK.....
//.BBBB...BBBB.BIIII.DDDD....DDDD.......AAAAAAAA...ASSSS........SKKKKKKK......
//.BBBBBBBBBBB.BIIII.DDDD....DDDD.......AAAAAAAA....SSSSSSS.....SKKKKKKK......
//.BBBBBBBBBB..BIIII.DDDD....DDDD.......AAAA.AAAA....SSSSSSSSS..SKKKKKKK......
//.BBBBBBBBBBB.BIIII.DDDD....DDDD......AAAAAAAAAA......SSSSSSS..SKKKKKKKK.....
//.BBBB....BBBBBIIII.DDDD....DDDD......AAAAAAAAAAA........SSSSS.SKKK.KKKKK....
//.BBBB....BBBBBIIII.DDDD...DDDDD......AAAAAAAAAAA.ASSS....SSSS.SKKK..KKKK....
//.BBBBBBBBBBBBBIIII.DDDDDDDDDDD...... AAA....AAAA.ASSSSSSSSSSS.SKKK..KKKKK...
//.BBBBBBBBBBB.BIIII.DDDDDDDDDD....... AAA.....AAAA.SSSSSSSSSS..SKKK...KKKKK..
//.BBBBBBBBBB..BIIII.DDDDDDDDD....... AAA.....AAAA..SSSSSSSS...SKKK...KKKKK..
//............................................................................

//########################### - START OF FUNCTION - get_trades_minus1_minute - ###################################
function get_trades_minus1_minute(coin, db){
   return new Promise(function (resolve, reject) {
        //%%%%% - MINUS 1 MINUTE TRADES - %%%-%%
        let time_minus_1_minute = new Date();
        time_minus_1_minute.setMinutes(time_minus_1_minute.getMinutes() - 1);
        //console.log(time_minus_1_minute)
        //%%%%% - MARKET TRADES QUERY - %%%%%
        let trades = db.collection('market_trades').find({"coin": coin, "created_date": {$gte: time_minus_1_minute}}).toArray();
        //console.log(trades, "trades");
        let bid = 0;
        let ask = 0;
        let buy = 0;
        let sell = 0;
        trades.then(trades_resolved => {
            //console.log(trades_resolved, "trades_resolved")
            trades_resolved.forEach(trade =>{
                if(trade['maker'] == 'true'){
                    bid += trade['quantity'];
                }
                if(trade['maker'] == 'false'){
                    ask += trade['quantity'];
                }
                if(trade['type'] == 'buy'){
                    buy += trade['quantity'];
                }
                if(trade['type'] == 'sell'){
                    sell += trade['quantity'];
                }
                var return_json = new Object();
                return_json['bid'] = bid;
                return_json['ask'] = ask;
                return_json['buy'] = buy;
                return_json['sell'] = sell;
                //%%%%% - RESOLVE AND RETURN - %%%%%
                resolve(return_json);
            })
        })
    });
}//%%%%%%%%%%%%%%%%% - ///// END OF FUNCTION - calculate_market_depth_bid_ask_volumes - %%%%%%%%%%%%%%%%%%%%%%%





//...............................................................................................
//.DDDDDDDDD....BBBBBBBBBB..........CCCCCCC....LLLL.........OOOOOOO......SSSSSSS....EEEEEEEEEEE..
//.DDDDDDDDDD...BBBBBBBBBBB........CCCCCCCCC...LLLL........OOOOOOOOOO...SSSSSSSSS...EEEEEEEEEEE..
//.DDDDDDDDDDD..BBBBBBBBBBB.......CCCCCCCCCCC..LLLL.......OOOOOOOOOOOO..SSSSSSSSSS..EEEEEEEEEEE..
//.DDDD...DDDD..BBBB...BBBB.......CCCC...CCCCC.LLLL.......OOOOO..OOOOO.OSSSS..SSSS..EEEE.........
//.DDDD....DDDD.BBBB...BBBB...... CCC.....CCC..LLLL......LOOOO....OOOOOOSSSS........EEEE.........
//.DDDD....DDDD.BBBBBBBBBBB...... CCC..........LLLL......LOOO......OOOO.SSSSSSS.....EEEEEEEEEE...
//.DDDD....DDDD.BBBBBBBBBB....... CCC..........LLLL......LOOO......OOOO..SSSSSSSSS..EEEEEEEEEE...
//.DDDD....DDDD.BBBBBBBBBBB...... CCC..........LLLL......LOOO......OOOO....SSSSSSS..EEEEEEEEEE...
//.DDDD....DDDD.BBBB....BBBB..... CCC.....CCC..LLLL......LOOOO....OOOOO.......SSSSS.EEEE.........
//.DDDD...DDDDD.BBBB....BBBB......CCCC...CCCCC.LLLL.......OOOOO..OOOOO.OSSS....SSSS.EEEE.........
//.DDDDDDDDDDD..BBBBBBBBBBBB......CCCCCCCCCCC..LLLLLLLLLL.OOOOOOOOOOOO.OSSSSSSSSSSS.EEEEEEEEEEE..
//.DDDDDDDDDD...BBBBBBBBBBB........CCCCCCCCCC..LLLLLLLLLL..OOOOOOOOOO...SSSSSSSSSS..EEEEEEEEEEE..
//.DDDDDDDDD....BBBBBBBBBB..........CCCCCCC....LLLLLLLLLL....OOOOOO......SSSSSSSS...EEEEEEEEEEE..
//...............................................................................................
//%%%%% - END OF DB INSTANCE - %%%%%
//%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
//%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% End of DB INSTANCE %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
//%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

//.................................................................................................................................................................
//....OOOOOOO.....TTTTTTTTTTHHHHH...HHHH..EEEEEEEEEEE.RRRRRRRRRR....... MMMMM...MMMMMM.EEEEEEEEEEE.TTTTTTTTTTHHHHH...HHHH....OOOOOOO.....DDDDDDDDD.....SSSSSSS.....
//...OOOOOOOOOO...TTTTTTTTTTHHHHH...HHHH..EEEEEEEEEEE.RRRRRRRRRRR...... MMMMM...MMMMMM.EEEEEEEEEEE.TTTTTTTTTTHHHHH...HHHH...OOOOOOOOOO...DDDDDDDDDD...SSSSSSSSS....
//..OOOOOOOOOOOO..TTTTTTTTTTHHHHH...HHHH..EEEEEEEEEEE.RRRRRRRRRRR...... MMMMM...MMMMMM.EEEEEEEEEEE.TTTTTTTTTTHHHHH...HHHH..OOOOOOOOOOOO..DDDDDDDDDDD..SSSSSSSSSS...
//..OOOOO..OOOOO.....TTTT....HHHH...HHHH..EEEE........RRRR...RRRRR..... MMMMMM.MMMMMMM.EEEE...........TTTT....HHHH...HHHH..OOOOO..OOOOO..DDDD...DDDD.SSSSS..SSSS...
//.OOOOO....OOOOO....TTTT....HHHH...HHHH..EEEE........RRRR...RRRRR..... MMMMMM.MMMMMMM.EEEE...........TTTT....HHHH...HHHH.OOOOO....OOOOO.DDDD....DDDDSSSSS.........
//.OOOO......OOOO....TTTT....HHHHHHHHHHH..EEEEEEEEEE..RRRRRRRRRRR...... MMMMMM.MMMMMMM.EEEEEEEEEE.....TTTT....HHHHHHHHHHH.OOOO......OOOO.DDDD....DDDD.SSSSSSS......
//.OOOO......OOOO....TTTT....HHHHHHHHHHH..EEEEEEEEEE..RRRRRRRRRRR...... MMMMMMMMMMMMMM.EEEEEEEEEE.....TTTT....HHHHHHHHHHH.OOOO......OOOO.DDDD....DDDD..SSSSSSSSS...
//.OOOO......OOOO....TTTT....HHHHHHHHHHH..EEEEEEEEEE..RRRRRRRR......... MMMMMMMMMMMMMM.EEEEEEEEEE.....TTTT....HHHHHHHHHHH.OOOO......OOOO.DDDD....DDDD....SSSSSSS...
//.OOOOO....OOOOO....TTTT....HHHH...HHHH..EEEE........RRRR.RRRR........ MMMMMMMMMMMMMM.EEEE...........TTTT....HHHH...HHHH.OOOOO....OOOOO.DDDD....DDDD.......SSSSS..
//..OOOOO..OOOOO.....TTTT....HHHH...HHHH..EEEE........RRRR..RRRR....... MMM.MMMMM.MMMM.EEEE...........TTTT....HHHH...HHHH..OOOOO..OOOOO..DDDD...DDDDDSSSS....SSSS..
//..OOOOOOOOOOOO.....TTTT....HHHH...HHHH..EEEEEEEEEEE.RRRR..RRRRR...... MMM.MMMMM.MMMM.EEEEEEEEEEE....TTTT....HHHH...HHHH..OOOOOOOOOOOO..DDDDDDDDDDD.SSSSSSSSSSSS..
//...OOOOOOOOOO......TTTT....HHHH...HHHH..EEEEEEEEEEE.RRRR...RRRRR..... MMM.MMMMM.MMMM.EEEEEEEEEEE....TTTT....HHHH...HHHH...OOOOOOOOOO...DDDDDDDDDD...SSSSSSSSSS...
//.....OOOOOO........TTTT....HHHH...HHHH..EEEEEEEEEEE.RRRR....RRRR..... MMM.MMMMM.MMMM.EEEEEEEEEEE....TTTT....HHHH...HHHH.....OOOOOO.....DDDDDDDDD.....SSSSSSSS....
//.................................................................................................................................................................
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - Other Methods - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
Date.prototype.addHours = function (h) {
    this.setHours(this.getHours() + h);
    return this;

} //End of date prototype addhours 
 //---------------------------------------------
function chunk(array, size) {
    const chunked_arr = [];
    let index = 0;
    while (index < array.length) {
        chunked_arr.push(array.slice(index, size + index));
        index += size;
    }
    return chunked_arr;
}//for chunking an array
 //---------------------------------------------
function convertExponentialToDecimal(exponentialNumber) {
    // sanity check - is it exponential number
    const str = exponentialNumber.toString();
    if (str.indexOf('e') !== -1) {
        const exponent = parseInt(str.split('-')[1], 10);
        // Unfortunately I can not return 1e-8 as 0.00000001, because even if I call parseFloat() on it,
        // it will still return the exponential representation
        // So I have to use .toFixed()
        const result = exponentialNumber.toFixed(exponent);
        return result;
    } else {
        return exponentialNumber;
    }   
}//convert exponential to decimal
 //---------------------------------------------
Math.fmod = function (a, b) { return Number((a - (Math.round(a / b) * b)).toPrecision(8)); }; //php fmod alternative
 //---------------------------------------------
//start of function : ============get_array_sum==============
function get_array_Sum(total, num) { //use this method inside reduce function to get sum of a numeric array
    return total + num;
  }//end of function : //////////get_array_sum///////////
 //---------------------------------------------
//start of function : ============= sort a numeric array ==============
function sort_num(arr){
    let sorted_arr = arr.sort(function(a,b) { return a - b;});
    return sorted_arr;
}//end of function : //////////////// sort a numeric array ////////////////
 //---------------------------------------------
// }) //end app.get
 //---------------------------------------------
 function time_elapsed_returns_minutes(time_){
     let time_now = new Date();
     var timeDiff = time_ - time_now; //in ms
     timeDiff = Math.round(timeDiff / 60000);
     timeDiff = timeDiff * (-1); 
    //  //console.log(time_, '=> time_', time_now, "=> time_now")
    //  //console.log(timeDiff, "=> timediff");
    timeDiff = timeDiff + " minutes ago";
    return timeDiff;
 }
 function sortByKey(array, key) { //function to sort a json array by key value
    return array.sort(function(a, b) {
        var x = a[key]; var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}//end of function : sortByKey()
Date.prototype.addHours= function(h){
    this.setHours(this.getHours()+h);
    return this;
}


// app.set('port', process.env.PORT || 5120);
// app.listen(app.get('port'), function () {
//     //console.log('Express server listening on port ' + app.get('port'));
// });