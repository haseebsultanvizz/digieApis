var express = require('express');
var router = express.Router();
var request = require('request');
const conn = require('../connection');
ObjectID = require('mongodb').ObjectID;
var app = express();

router.post('/chart3', async function(req, res, next){
	var post_data = req.body;
	if(Object.keys(post_data).length > 0){
		if('coin' in post_data){
			conn.then(async db =>{
				let symbol = post_data['coin'];
				////console.log(symbol, "===> symbol");
				var coin_info = await db.collection('coins').findOne({ "symbol": symbol }); // Get coin info
				let coin_base_order = coin_info['base_order'];
				let coin_base_history = coin_info['base_history'];
				let market_value = await get_market_value(symbol);
				let bid_ask_arrays_object = get_remainder_group(symbol,market_value);
				let last_candle = await get_last_demand_candle(symbol);
				let up_barrier = await get_last_barrier(symbol, market_value, 'up');
				let down_barrier = await get_last_barrier(symbol, market_value, 'down');
				bid_ask_arrays_object.then(async bid_ask_arrays_object_resolved =>{
					if(Object.keys(bid_ask_arrays_object_resolved).length > 0){
						let bid_arr = bid_ask_arrays_object_resolved['bid_arr'];
						let ask_arr = bid_ask_arrays_object_resolved['ask_arr'];
						//console.log(ask_arr, "===> ask array www")
						var current_market_value = bid_ask_arrays_object_resolved['current_market_value'];
						//**************************************************
						let new_bid_arr = [];
						let new_ask_arr = [];
						let new_curr_arr = [];
						//ForEach for bid_arr
						var bid_index = 0;
						bid_arr.forEach(bid_element =>{
							let black_wall_object = calculate_blackwall_amount_for_chart3(ask_arr, bid_arr, coin_base_order);
							let yellow_wall_object = calculate_yellowwall_amount_for_chart3(ask_arr, bid_arr, coin_base_order);
							let black_wall_bid_price = black_wall_object['blackwall_bid_price'];
							let yellow_wall_bid_price = yellow_wall_object['yellowwall_bid_price'];
							//
							let next_bid_price = bid_arr[bid_index]['price'];
							let bid_price = bid_element['price'];
							let buy_quantity = bid_element['buy_quantity'];
							let depth_buy_quantity = bid_element['depth_buy_quantity'];
							let depth_sell_quantity = bid_element['depth_sell_quantity'];
							let sell_quantity = bid_element['sell_quantity'];
							//
							//calculate percentages
							//Indexes uper neechay because of kamran bhai
							let depth_buy_percentage = Math.round((depth_sell_quantity / coin_base_order) * 100);
							let depth_sell_percentage = Math.round((depth_buy_quantity / coin_base_order) * 100);
							let buy_percentage = Math.round((buy_quantity / coin_base_history) * 100);
							let sell_percentage = Math.round((sell_quantity / coin_base_history) * 100);
							if(depth_sell_percentage > 100){
								depth_sell_percentage = 100;
							}
							if(depth_buy_percentage > 100){
								depth_buy_percentage = 100;
							}
							if(buy_percentage > 100){
								buy_percentage = 100;
							}
							if(sell_percentage > 100){
								sell_percentage = 100;
							}
							//
							let temp_bid_arr = {
							    'price':parseFloat(bid_price).toFixed(8),
							    'is_current_price':'no',
							    'is_ask_price':'no',
							    'is_ask_price_max':'no',
							    'is_bid_price':'yes',
							    'is_bid_price_max':'no',
							    'buy_price':Convert_to_million(depth_sell_quantity),
							    'buy_price_percent':depth_sell_percentage,
							    'sell_price':Convert_to_million(depth_buy_quantity),
							    'sell_price_percent':depth_buy_percentage,
							    'price_buy_volum':Convert_to_million(buy_quantity),
							    'price_buy_volum_percent':buy_percentage,
							    'price_sell_volum':Convert_to_million(sell_quantity),
							    'price_sell_volum_percent':sell_percentage,
							  	'up_black_wall':'no',
							    'up_yellow_wall':'no',
							    'down_black_wall':'no',
							    'down_yellow_wall':'no',
							    'specific_price_wall':'no',
							};
							//
							if(bid_price == black_wall_bid_price || bid_price == yellow_wall_bid_price){
								if(bid_price == black_wall_bid_price){
									temp_bid_arr['down_black_wall'] = "yes";
									temp_bid_arr['is_bid_price'] = "no";
								}
								if(bid_price == yellow_wall_bid_price){
									temp_bid_arr['down_yellow_wall'] = "yes";
									temp_bid_arr['is_bid_price'] = "no";
								}

							}

							if(bid_price >= last_candle['low'] && bid_price <= last_candle['high']){
								temp_bid_arr['specific_price_wall'] = 'yes';
							}
							if(bid_price >= down_barrier && next_bid_price < down_barrier){
								temp_bid_arr['is_bid_price_max'] = 'yes';
							}
							new_bid_arr.push(temp_bid_arr);
						})
						// ForEach for ask_arr
						var ask_index = 0;
						ask_arr.forEach(ask_element =>{
							let black_wall_object = calculate_blackwall_amount_for_chart3(ask_arr, bid_arr, coin_base_order);
							let yellow_wall_object = calculate_yellowwall_amount_for_chart3(ask_arr, bid_arr, coin_base_order);
							let black_wall_ask_price = black_wall_object['blackwall_ask_price'];
							let yellow_wall_ask_price = yellow_wall_object['yellowwall_ask_price'];
							//
							let next_ask_price = ask_arr[ask_index]['price'];
							let ask_price = ask_element['price'];
							let buy_quantity = ask_element['buy_quantity'];
							let depth_buy_quantity = ask_element['depth_buy_quantity'];
							let depth_sell_quantity = ask_element['depth_sell_quantity'];
							let sell_quantity = ask_element['sell_quantity'];
							//
							//calculate percentages
							//Indexes uper neechay because of kamran bhai
							let depth_buy_percentage = Math.round((depth_sell_quantity / coin_base_order) * 100);
							let depth_sell_percentage = Math.round((depth_buy_quantity / coin_base_order) * 100);
							let buy_percentage = Math.round((buy_quantity / coin_base_history) * 100);
							let sell_percentage = Math.round((sell_quantity / coin_base_history) * 100);
							if(depth_sell_percentage > 100){
								depth_sell_percentage = 100;
							}
							if(depth_buy_percentage > 100){
								depth_buy_percentage = 100;
							}
							if(buy_percentage > 100){
								buy_percentage = 100;
							}
							if(sell_percentage > 100){
								sell_percentage = 100;
							}
							//
							let temp_ask_arr = {
							    'price':parseFloat(ask_price).toFixed(8),
							    'is_current_price':'no',
							    'is_ask_price':'yes',
							    'is_ask_price_max':'no',
							    'is_bid_price':'no',
							    'is_bid_price_max':'no',
							    'buy_price':Convert_to_million(depth_sell_quantity),
							    'buy_price_percent':depth_sell_percentage,
							    'sell_price':Convert_to_million(depth_buy_quantity),
							    'sell_price_percent':depth_buy_percentage,
							    'price_buy_volum':Convert_to_million(buy_quantity),
							    'price_buy_volum_percent':buy_percentage,
							    'price_sell_volum':Convert_to_million(sell_quantity),
							    'price_sell_volum_percent':sell_percentage,
							  	'up_black_wall':'no',
							    'up_yellow_wall':'no',
							    'down_black_wall':'no',
							    'down_yellow_wall':'no',
							    'specific_price_wall':'no',
							};
							//
							if(ask_price == black_wall_ask_price || ask_price == yellow_wall_ask_price){
								if(ask_price == black_wall_ask_price){
									temp_ask_arr['up_black_wall'] = "yes";
									temp_ask_arr['is_ask_price'] = "no";
								}
								if(ask_price == yellow_wall_ask_price){
									temp_ask_arr['up_yellow_wall'] = "yes";
									temp_ask_arr['is_ask_price'] = "no";
								}

							}
							if(ask_price >= last_candle['low'] && ask_price <= last_candle['high']){
								temp_ask_arr['specific_price_wall'] = 'yes';
							}

							if(ask_price >= up_barrier && next_ask_price < up_barrier){
								temp_bid_arr['is_ask_price_max'] = 'yes';
							}
							new_ask_arr.push(temp_ask_arr);
						}); //  End of foreach

						// TEMP CURRENT ARRAY FOR CURRENT MARKET VALUE
						let temp_curr_arr = {
						    'price': parseFloat(current_market_value).toFixed(8),
						    'is_current_price':'yes',
						    'is_ask_price':'no',
						    'is_ask_price_max':'no',
						    'is_bid_price':'no',
						    'is_bid_price_max':'no',
						    'buy_price': "",
						    'buy_price_percent':"",
						    'sell_price':"",
						    'sell_price_percent':"",
						    'price_buy_volum':"",
						    'price_buy_volum_percent':"",
						    'price_sell_volum':"",
						    'price_sell_volum_percent':"",
						  	'up_black_wall':'yes',
						    'up_yellow_wall':'no',
						    'down_black_wall':'no',
						    'down_yellow_wall':'no',
						    'specific_price_wall':'no',
						};
						new_curr_arr.push(temp_curr_arr);

						//Indicators
						let indicators_object = await indicators(symbol, ask_arr, bid_arr, coin_info, db);
						//CREATE RESPONSE OBJECT
						let resp_object = new Object();
						resp_object['bid_arr'] = new_bid_arr;
						resp_object['ask_arr'] = new_ask_arr;
						resp_object['curr_arr'] = new_curr_arr;
						resp_object['data_indicators'] = indicators_object;

						res.status(200).send({
							"success": "true",
							"status": 200,
							"data": resp_object,
							"message": "200 Awesome Request! Clapping :D - Data fetched successfully . . ."
						});

						//
					} else{
						res.status(404).send({
							"success": "false", 
							"status": 404, 
							"message": "404 NOT FOUND! Bid/Ask data is not available in collection 'chart3_group' at the moment. . ."
						});
					}
				})
			})
		} else{
			res.status(400).send({
				"success": "false", 
				"status": 400, "message": 
				"Bad request! The JSON key you've posted is wrong"
			});
		}
	} else{
		res.status(400).send({
			"success": "false", 
			"status": 400, 
			"message": "Bad request! You need to post something in order to proceed . . ."
		});
	}
});



//////////////////////////////////////////////////////
async function get_market_value(coin){
	return new Promise(async function(resolve, reject){
		conn.then(async db => {
			db.collection("market_prices").find({"coin": coin}).sort({"created_date": -1}).limit(1).toArray(async function(err, data){
				if (err) throw err;
				////console.log(data, "===> makret_data");
				if(data.length > 0){
					resolve(data[0]['price']);
				} else{
					resolve(null);
				}
			})
		})
	})
}
async function get_remainder_group(symbol, market_value){
	return new Promise(async function(resolve, reject){
		if(market_value != null){
			let bid_arr = get_values_for_chart(symbol, market_value, "bid", 50);
			let ask_arr = get_values_for_chart(symbol, market_value, "ask", 50);

			Promise.all([
				bid_arr,
				ask_arr
			]).then(async resolved_values => {
				let resolved_bid_arr = resolved_values[0];
				let resolved_ask_arr = resolved_values[1];
				if(resolved_bid_arr.length > 0 && resolved_ask_arr.length > 0){
					let return_arr = new Object();
					return_arr['bid_arr'] = resolved_bid_arr;
					return_arr['ask_arr'] = resolved_ask_arr;
					return_arr['current_market_value'] = market_value;
					resolve(return_arr);
				} else{
					resolve({});
				}
			})
		} else{
			resolve({});
		}//if market_val is null
	})
}//

async function get_values_for_chart(symbol, market_value, type, limit){
	return new Promise(async function(resolve, reject){
		conn.then(async db => {
			if(limit == 0){
				limit = 50;
			}
			let search_arr = new Object();
			search_arr['coin'] = symbol;
			search_arr['type'] = type;
			if (type == 'bid') {
				search_arr['price'] = {$lte: market_value};
			}else if (type == 'ask') {
				search_arr['price'] = {$gte: market_value};
			}
			console.log(search_arr, "===> query...")
			db.collection("chart3_group").find(search_arr).sort({"price": -1}).limit(limit).toArray(async function(err, data){
				if (err) throw err;
				if(data.length > 0){
					console.log(data, "=========> chart data");
					let sorted_data_arr = sortByKey(data, "price");
					////console.log(sorted_data_arr);
					resolve(sorted_data_arr);
				}else {
					resolve([]);
				}
			})
		})
	})
} //


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
    //////console.log(blackwall_ask_indexes, "=> blackwall_ask_indexes");
    //////console.log(blackwall_bid_indexes, "=> blackwall_bid_indexes");
    //////console.log(blackwall_bid_price, "=> blackwall_bid_price");
    //////console.log(blackwall_ask_price, '=> blackwall_ask_price');
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
function get_rolling_hour_trade_volume_t2cot(coin, db){
    return new Promise(function (resolve, reject) { //thankyou ustad zulqarnain
	    let rolling_hour_start = new Date();
	    rolling_hour_start.setMinutes(00);
	    rolling_hour_start.setSeconds(00);
	    rolling_hour_start.setMilliseconds(000);
	    let time_now = new Date();
	    ////console.log({'coin': coin, 'created_date': {$gte: rolling_hour_start}}, "------query");
	    get_trades_query = db.collection('market_trades').find({'coin': coin, 'created_date': {$gte: rolling_hour_start}}).toArray();
	    get_trades_query.then(get_trades_query_response => {
	        let bid_vol = 0;
	        let ask_vol = 0;
	       get_trades_query_response.forEach(element => {
	            if(String(element['maker']) == 'true'){ // element['maker'] key returns a bool value
	                bid_vol += element['quantity'];
	            } else if(String(element['maker']) == 'false'){
	                ask_vol += element['quantity'];
	            }
	        });//end of foreach
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
	    //////console.log(time_minus_15_min, "=> time_minus_15_min");
	    get_trades_query = db.collection('market_trades').find({'coin': coin, 'created_date': {$gte: time_minus_15_min} }).toArray();
	    get_trades_query.then(get_trades_query_response => {
	        let bid_vol = 0;
	        let ask_vol = 0;
	        //////console.log(get_trades_query_response);
	       get_trades_query_response.forEach(element => {
	            if(element['maker'] == 'true'){ // element['maker'] key returns a bool value
	                bid_vol += element['quantity'];
	            } else if(element['maker'] == 'false'){
	                ask_vol += element['quantity'];
	            }
	        });//end of foreach
	        //////console.log(bid_vol, '=> bid_vol', ask_vol, '=> ask_vol');
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
	    //////console.log(time_minus_5_min, "=> time_minus_5_min");
	    get_trades_query = db.collection('market_trades').find({'coin': coin, 'created_date': {$gte: time_minus_5_min} }).toArray();
	    get_trades_query.then(get_trades_query_response => {
	        let bid_vol = 0;
	        let ask_vol = 0;
	        //////console.log(get_trades_query_response);
	        get_trades_query_response.forEach(element => {
	        if(element['maker'] == 'true'){ // element['maker'] key returns a bool value when field type in collection is bool or T/F
	            bid_vol += element['quantity'];
	        } else if(element['maker'] == 'false'){
	            ask_vol += element['quantity'];
	        }
	        });//end of foreach
	        //////console.log(bid_vol, '=> bid_vol', ask_vol, '=> ask_vol');
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
        let coin_info_query = db.collection('coins').findOne({"symbol": coin});
        coin_info_query.then(coin_info_query_resp => {
            //////console.log(coin_info_query_resp, "=> coin_info_query_resp");
            let contract_time = parseInt(coin_info_query_resp['contract_time']);
            let contract_percentage = parseInt(coin_info_query_resp['contract_percentage']);
            //%%%%%%%%%% - Minus the Contract Time from Current Time - %%%%%%%%%%
            let time_reversed = new Date(); 
            time_reversed.setMinutes(time_reversed.getMinutes() - contract_time);
            //////console.log(time_reversed, "=> time_reversed");
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
                //////console.log(get_trades_query_response, "=> get_trades_query_response");
                let get_trade_query_quantities_arr = [];
                get_trades_query_response.forEach(element => { 
                    get_trade_query_quantities_arr.push(parseFloat(element['quantity'])); 
                });
                get_trade_query_quantities_arr.sort(function(a,b) { return a - b;});
                get_trade_query_quantities_arr.reverse();

                //////console.log(get_trade_query_quantities_arr, "=> get_trade_query_quantities");
                //////console.log(get_trade_query_quantities_arr.length , "=> get_trade_query_quantities_arr.length");
                //////console.log(contract_percentage, "=>contract_percentage")

                let index = Math.round((parseInt(get_trade_query_quantities_arr.length) / 100) * parseInt(contract_percentage));
                //////console.log(Math.round(index), "=> index")
                //%%%%%%%%%%% - Quantity Sum Upto the defined INDEX varibale defined above - %%%%%%%%%%%
                let q_sum = 0.0; 
                for(let i =0; i < index; i++){
                    q_sum = q_sum + parseFloat(get_trade_query_quantities_arr[i]);
                }
                //%%%%%%%%%% - Quantity Sum of total sum in get_trade_query_quantities_arr ARRAY - %%%%%%%%%%
                let t_sum = 0.0; 
                for(let i = 0; i < get_trade_query_quantities_arr.length; i++){
                    t_sum = t_sum + parseFloat(get_trade_query_quantities_arr[i]);
                    //////console.log(t_sum, "=> t_sum", i, "=> i");
                }
                //////console.log(q_sum, '=> q_sum')
                //%%%%% - Avg Quantity - %%%%%
                let q_avg = q_sum / index;
                //%%%%% - Percentage with Total Quantity Sum - %%%%%
                let percentage_ = (q_sum / t_sum) * 100;
                //%%%%% - Initialization of Json Object for Creating Response - %%%%%
                let get_contract_info_resp_json = new Object();
                get_contract_info_resp_json['avg'] = Math.round(q_avg);
                get_contract_info_resp_json['per'] = Math.round(percentage_);
                //////console.log(get_contract_info_resp_json, "=> get_contract_info_resp_json");
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
// function get_bid_contract_info(coin, db){
//     //%%%% Start of Promise Object %%%%
//     return new Promise(function (resolve, reject) {
//         //%%%%% - Coins Info Query - %%%%%
//         let coin_info_query = db.collection('coins').find({"symbol": coin}).toArray();
//         //%%%%% - Coins Info Query Resolution - %%%%%
//         coin_info_query.then(coin_info_query_resp => {
//             //////console.log(coin_info_query_resp, "=> coin_info_query_resp");
//             let time_reversed = new Date();
//             let contract_time = parseInt(coin_info_query_resp[0]['contract_time']);
//             let contract_percentage = parseInt(coin_info_query_resp[0]['contract_percentage']);
//             time_reversed.setMinutes(time_reversed.getMinutes() - contract_time);
//             //////console.log(time_reversed, "=> time_reversed");
//             if(contract_time == 0){
//                 contract_time = 2
//             }
//             if(contract_percentage == 0){
//                 contract_percentage = 10;
//             }
//             //////console.log(coin, '=> coin');
//             //%%%%%%%%%%%%%% Query %%%%%%%%%%%%%%%
//             //////console.log({"coin": coin, "created_date": {$gte: time_reversed}}, "===> SPL Query Bid contract info")
//             let get_trades_query = db.collection('market_trades').find({"coin": coin, "created_date": {$gte: time_reversed}}).sort({'created_date': -1}).toArray();
//             //%%%%%%%%%%%%%% Resolve Promise Cursor %%%%%%%%%%%%%%%%
//             get_trades_query.then( get_trades_query_response => {
//                 //////console.log(get_trades_query_response.length, "=> get_trades_query_response");
//                 //%%%%%%%%% - Function to SORT a JSON ARRAY by KEY - %%%%%%%%%
//                 function sortByKey(array, key) {
//                     return array.sort(function(a, b) {
//                         var x = a[key]; var y = b[key];
//                         return ((x < y) ? -1 : ((x > y) ? 1 : 0));
//                     });
//                 }//%%%%%%%%% - //END Function sortByKey() - %%%%%%%%%
//                 get_trades_query_response = sortByKey(get_trades_query_response, "quantity");
//                 ////console.log(get_trades_query_response, "=> get_trades_query_responses");
//                 //////console.log(contract_percentage, "=> contract_percentage")
//                 //%%%%% - Define Index variable for Number of Trades to Crawl - %%%%% => Number of Trades returned by Mongo Query Above ----
//                 let index = Math.round((get_trades_query_response.length / 100) * (contract_percentage));
//                 //////console.log(get_trades_query_response.length, "=> get_trades_query_response.length")
//                 //////console.log(index, "=> index")
//                 //%%%%% - Quantity Sum upto Indexes Calculated Above in the Index Variable - %%%%%
//                 let q_sum = 0.0;
//                 //%%%%% - Start of FOR LOOP - Sum Quantities - %%%%%
//                 for(let i =0; i < index; i++){
//                     if (get_trades_query_response[i]['maker'] == 'true') {
//                         //////console.log('calculating quantities')
//                         q_sum = q_sum + parseFloat(get_trades_query_response[i]['quantity']);
//                     }
//                 }//%%%%% - //END of FOR LOOP - %%%%%
//                 //////console.log(q_sum, "=> q_sum");
//                 let q2 = 0.0; 
//                 let max_price = 0;
//                 //%%%%% - What Price Have the MAX Quantity in get_trades_query_response JSON ARRAY??? - %%%%%
//                 //%%% - FOR LOOP - %%%
//                 for (let i = 0; i < index; i++) {
//                     if (get_trades_query_response[i]['maker'] == 'true') {
//                         let q = parseFloat(get_trades_query_response[i]['quantity']);
//                         if (q2 < q) {
//                             q2 = q;
//                             max_price = get_trades_query_response[i]['price'];
//                         }
//                     }
//                 } //%%% - //END of FOR - %%%
//                 //////console.log(max_price, "=> max_price")
//                 let t_sum = 0.0;
//                 //%%% - FOR LOOP - Total Sum of all the Trades Returned by Query - %%%
//                 for (let i = 0; i < get_trades_query_response.length; i++) {
//                     t_sum += get_trades_query_response[i]['quantity'];
//                 }//%%% - //END FOR - %%%
//                 //////console.log(t_sum, "=> t_sum")
//                 let q_avg = q_sum / index;
//                 //%%%%%% - To Avoid NaN in q_avg Variable when Index = 0 - %%%%%%
//                 if( Number.isNaN(q_avg) ){
//                     q_avg = 0.0;
//                 }//%%% - END IF - %%%
//                 let percentage_ = Math.round((q_sum / t_sum) * 100);
//                 let get_bid_contract_info_return_json_response = new Object();
//                 get_bid_contract_info_return_json_response['avg'] = Math.round(q_avg);
//                 get_bid_contract_info_return_json_response['per'] = percentage_;
//                 get_bid_contract_info_return_json_response['max'] = parseFloat(max_price).toFixed(8);
//                 //////console.log(get_bid_contract_info_return_json_response, "=> get_bid_contract_info_return_json_response")
//                 //%%%%% - Resolve and Return - %%%%%
//                 resolve(get_bid_contract_info_return_json_response); //resolve and return promise
//             }) //%%%%% - //END OF Promise.then 2 of 2 - %%%%%
//         }) //%%%%% - //END OF Promise.then 1 of 2 - %%%%%
//     }) //%%%%% - END of 'return new Promise' - %%%%%
// }
function get_bid_contract_info(coin, db){
    //%%%% Start of Promise Object %%%%
    return new Promise(function (resolve, reject) {
        //%%%%% - Coins Info Query - %%%%%
        let coin_info_query = db.collection('coins').find({"symbol": coin}).toArray();
        //%%%%% - Coins Info Query Resolution - %%%%%
        coin_info_query.then(coin_info_query_resp => {
            //////console.log(coin_info_query_resp, "=> coin_info_query_resp");
            let time_reversed = new Date();
            let contract_time = parseInt(coin_info_query_resp[0]['contract_time']);
            let contract_percentage = parseInt(coin_info_query_resp[0]['contract_percentage']);
            time_reversed.setMinutes(time_reversed.getMinutes() - contract_time);
            //////console.log(time_reversed, "=> time_reversed");
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
                //////console.log(get_trades_query_response, "=> get_trades_query_response");
                //%%%%%%%%% - Function to SORT a JSON ARRAY by KEY - %%%%%%%%%
                function sortByKey(array, key) { //function to sort a json array by key value
                    return array.sort(function(a, b) {
                        var x = a[key]; var y = b[key];
                        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
                    });
                }//%%%%%%%%% - //END Function sortByKey() - %%%%%%%%%
                get_trades_query_response = sortByKey(get_trades_query_response, "quantity");
                get_trades_query_response.reverse();
                //////console.log(get_trades_query_response, "=> get_trades_query_responses");
                //%%%%% - Define Index variable for Number of Trades to Crawl - %%%%% => Number of Trades returned by Mongo Query Above ----
                let index = Math.round((get_trades_query_response.length / 100) * (contract_percentage));
                //////console.log(index, "=> index");
                //%%%%% - Quantity Sum upto Indexes Calculated Above in the Index Variable - %%%%%
                let q_sum = 0.0;
                //%%%%% - Start of FOR LOOP - Sum Quantities - %%%%%
                for(let i =0; i < index; i++){
                if (get_trades_query_response[i]['maker'] == 'true') {
                    q_sum = q_sum + parseFloat(get_trades_query_response[i]['quantity']);
                }
                }//%%%%% - //END of FOR LOOP - %%%%%
            let q2 = 0.0; 
            let max_price = 0;
            //%%%%% - What Price Have the MAX Quantity in get_trades_query_response JSON ARRAY??? - %%%%%
            //%%% - FOR LOOP - %%%
            for (let i = 0; i < index; i++) {
                if (get_trades_query_response[i]['maker'] == 'true') {
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
            //////console.log(q_sum, "=> q_sum");
            //////console.log(t_sum, "-> t_sum");
            let percentage_ = Math.round((q_sum / t_sum) * 100);
            let get_ask_contract_info_return_json_response = new Object();
            get_ask_contract_info_return_json_response['avg'] = Math.round(q_avg);
            get_ask_contract_info_return_json_response['per'] = Math.round(percentage_);
            get_ask_contract_info_return_json_response['max'] = parseFloat(max_price).toFixed(8);
            //////console.log(get_ask_contract_info_return_json_response, "=> get_ask_contract_info_return_json_response")
            //%%%%% - Resolve and Return - %%%%%
            resolve(get_ask_contract_info_return_json_response); //resolve and return promise
            }) //%%%%% - //END OF Promise.then 2 of 2 - %%%%%
        }) //%%%%% - //END OF Promise.then 1 of 2 - %%%%%
    }) //%%%%% - END of 'return new Promise' - %%%%%
}//%%%%%%%%%%%% - //END of Function Definition - Get ASK Contract Info -  %%%%%%%%%%%%%%
//%%%%%%%%%%%% - //END of Function Definition - Get Contract Info -  %%%%%%%%%%%%%%
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
            //////console.log(coin_info_query_resp, "=> coin_info_query_resp");
            let time_reversed = new Date();
            let contract_time = parseInt(coin_info_query_resp[0]['contract_time']);
            let contract_percentage = parseInt(coin_info_query_resp[0]['contract_percentage']);
            time_reversed.setMinutes(time_reversed.getMinutes() - contract_time);
            //////console.log(time_reversed, "=> time_reversed");
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
                //////console.log(get_trades_query_response, "=> get_trades_query_response");
                //%%%%%%%%% - Function to SORT a JSON ARRAY by KEY - %%%%%%%%%
                function sortByKey(array, key) { //function to sort a json array by key value
                    return array.sort(function(a, b) {
                        var x = a[key]; var y = b[key];
                        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
                    });
                }//%%%%%%%%% - //END Function sortByKey() - %%%%%%%%%
                get_trades_query_response = sortByKey(get_trades_query_response, "quantity");
                get_trades_query_response.reverse();
                //////console.log(get_trades_query_response, "=> get_trades_query_responses");
                //%%%%% - Define Index variable for Number of Trades to Crawl - %%%%% => Number of Trades returned by Mongo Query Above ----
                let index = Math.round((get_trades_query_response.length / 100) * (contract_percentage));
                //////console.log(index, "=> index");
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
            //////console.log(q_sum, "=> q_sum");
            //////console.log(t_sum, "-> t_sum");
            let percentage_ = Math.round((q_sum / t_sum) * 100);
            let get_ask_contract_info_return_json_response = new Object();
            get_ask_contract_info_return_json_response['avg'] = Math.round(q_avg);
            get_ask_contract_info_return_json_response['per'] = Math.round(percentage_);
            get_ask_contract_info_return_json_response['max'] = parseFloat(max_price).toFixed(8);
            //////console.log(get_ask_contract_info_return_json_response, "=> get_ask_contract_info_return_json_response")
            //%%%%% - Resolve and Return - %%%%%
            resolve(get_ask_contract_info_return_json_response); //resolve and return promise
            }) //%%%%% - //END OF Promise.then 2 of 2 - %%%%%
        }) //%%%%% - //END OF Promise.then 1 of 2 - %%%%%
    }) //%%%%% - END of 'return new Promise' - %%%%%
}//%%%%%%%%%%%% - //END of Function Definition - Get ASK Contract Info -  %%%%%%%%%%%%%%
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
// calculate_pressure function in php
function calculate_seven_level_pressure(final_chart3_json_arr_ask, final_chart3_json_arr_bid){
    let pressure_up = 0;
    let pressure_down = 0;
    let bid_max = 0;
    let ask_max = 0;
    let x = 0;
    let p = ""
    //%%%%%% START of FOR %%%%%%
    function sortByKey(array, key) { //function to sort a json array by key value
        return array.sort(function(a, b) {
            var x = a[key]; var y = b[key];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
    }//%%%%%%%%% - //END Function sortByKey() - %%%%%%%%%

    final_chart3_json_arr_ask = sortByKey(final_chart3_json_arr_ask, "price");
    //get_trades_query_response.reverse();

    final_chart3_json_arr_bid = sortByKey(final_chart3_json_arr_bid, "price");
    final_chart3_json_arr_bid.reverse();
    // //console.log(final_chart3_json_arr_ask, '=> ask_max');
    // //console.log(final_chart3_json_arr_bid, "=> bid_max");
    for (let i = 0; i < 7; i++) {

    	// //console.log(final_chart3_json_arr_ask[i]['depth_buy_quantity'], '=> ask_max');
    	// //console.log(final_chart3_json_arr_bid[i]['depth_sell_quantity'], "=> bid_max");
        bid_max += final_chart3_json_arr_bid[i]['depth_sell_quantity'];
        ask_max += final_chart3_json_arr_ask[i]['depth_buy_quantity'];
    }//%%%%%% END of FOR %%%%%%
    
    //%%%%%% START of IF %%%%%%
    if (bid_max > ask_max) {
        if (ask_max == 0) {
            ask_max = 1;
        }
        x = bid_max / ask_max;
        p = 'up';
    } else if (ask_max > bid_max) {
        if (bid_max == 0) {
            bid_max = 1;
        }
        x = ask_max / bid_max;
        x = x * -1;
        p = 'down';
    }//%%%%%% START of IF %%%%%%
    let new_x = x - 1;
    new_x = new_x.toFixed(2);
    let new_p = parseFloat((new_x/3) * 100);
    let seven_level_pressure_resp = new Object();
    seven_level_pressure_resp['seven_level_val'] = new_x;
    seven_level_pressure_resp['p_val'] = p;
    seven_level_pressure_resp['new_p'] = new_p;
    return seven_level_pressure_resp;
}//%%%%%%%%%%%% END of Function Definition - Calculate Seven Level Pressure  %%%%%%%%%%%%%%
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

function calculate_five_level_pressure(final_chart3_json_arr_ask, final_chart3_json_arr_bid){
    //%%%%% Initialization %%%%%
    let bid_count = 0;
    let ask_count = 0;
    let five_level_pressure_type = '';
    // ////console.log(final_chart3_json_arr_ask.length, "Ask Arr Length");
    // ////console.log(final_chart3_json_arr_bid.length, "Bid Arr Length");
    function sortByKey(array, key) { //function to sort a json array by key value
        return array.sort(function(a, b) {
            var x = a[key]; var y = b[key];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
    }//%%%%%%%%% - //END Function sortByKey() - %%%%%%%%%

    final_chart3_json_arr_ask = sortByKey(final_chart3_json_arr_ask, "price");
    //get_trades_query_response.reverse();

    final_chart3_json_arr_bid = sortByKey(final_chart3_json_arr_bid, "price");
    final_chart3_json_arr_bid.reverse();
	//console.log(final_chart3_json_arr_ask," Ask Arr");
    ////console.log(final_chart3_json_arr_bid[i],"Bid Arr");
    for(let i=0; i<5; i++){
    	//console.log(i)
    	// //console.log(final_chart3_json_arr_ask[i]," Ask Arr");
    	// //console.log(final_chart3_json_arr_bid[i],"Bid Arr");
        if(parseFloat(final_chart3_json_arr_ask[i].depth_buy_quantity) > parseFloat(final_chart3_json_arr_bid[i].depth_sell_quantity)){
            ask_count = ask_count + 1;
            ////console.log("Ask is Up", ask_count);
        } else if (parseFloat(final_chart3_json_arr_bid[i].depth_sell_quantity) > parseFloat(final_chart3_json_arr_ask[i].depth_buy_quantity)){
            bid_count = bid_count + 1;
            ////console.log("Bid is Up", bid_count);
        }
    }
    //%%%%% Calculate Five Level Pressure Difference %%%%%
    let five_level_pressure_difference = ask_count - bid_count;
    let new_p = 0.0;
    if(ask_count > bid_count){
    	five_level_pressure_difference = ask_count - bid_count;
    	new_p = (five_level_pressure_difference / 5) * 100;
    	five_level_pressure_type = "up";
    } else{
    	five_level_pressure_difference = bid_count - ask_count;
    	new_p = (five_level_pressure_difference / 5) * 100;
    	five_level_pressure_type = "down";
    }
    

    //////console.log(ask_count, "=> ask_count");
    //////console.log(bid_count, "=> bid_count");
    //%%%%% Declare JSON Resp Object %%%%%
    let five_level_pressure_resp = new Object();
    five_level_pressure_resp['five_level_pressure_difference'] = parseInt(five_level_pressure_difference);
    five_level_pressure_resp['five_level_pressure_type'] = String(five_level_pressure_type);
    five_level_pressure_resp['new_p'] = parseFloat(new_p);
    five_level_pressure_resp['ask_index_count'] = parseInt(ask_count);
    five_level_pressure_resp['bid_index_count'] = parseInt(bid_count);
    //%%%%%%%%%%% Return JSON Object %%%%%%%%%%
    return five_level_pressure_resp;
}//%%%%%%%%%%%% END of Function Definition - Calculate Five Level Pressure  %%%%%%%%%%%%%%
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
function calculate_dc_wall(final_chart3_json_arr_ask, final_chart3_json_arr_bid, base_order){
    //%%%% Function Description %%%%%
    //%%%% - Find the Price with Max Quantity in the top 5 Indexes of Bid and Ask Chunked Arrays - %%%%%
    //%%%% Initializations %%%%
    function sortByKey(array, key) { //function to sort a json array by key value
        return array.sort(function(a, b) {
            var x = a[key]; var y = b[key];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
    }//%%%%%%%%% - //END Function sortByKey() - %%%%%%%%%

    final_chart3_json_arr_ask = sortByKey(final_chart3_json_arr_ask, "price");
    //get_trades_query_response.reverse();

    final_chart3_json_arr_bid = sortByKey(final_chart3_json_arr_bid, "price");
    final_chart3_json_arr_bid.reverse();
    let ask_arr_sliced = final_chart3_json_arr_ask.slice(0, 5);//%%% Slice the final_chart3_json_arr_ask Array for First 5 Indexes
    let bid_arr_sliced = final_chart3_json_arr_bid.slice(0, 5);//%%% Slice the final_chart3_json_arr_bid Array for First 5 Indexes
    //////console.log(ask_arr_sliced, "=> ask_arr_sliced");
    //////console.log(bid_arr_sliced, "=> bid_arr_sliced");
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
        //////console.log("check 0")
        if(i == 0){
            bid_qty_max = bid_arr_sliced[i].depth_sell_quantity;
            ask_qty_max = ask_arr_sliced[i].depth_buy_quantity;
            bid_price_max = bid_arr_sliced[i].price;
            ask_price_max = ask_arr_sliced[i].price;
            //////console.log("check 1");
        } else if(i>0){
            if(parseFloat(bid_arr_sliced[i].depth_sell_quantity) > parseFloat(bid_qty_max)){
                bid_qty_max = bid_arr_sliced[i].depth_sell_quantity;
                bid_price_max = bid_arr_sliced[i].price;
                //////console.log("check 2");
            }
            if(parseFloat(ask_arr_sliced[i].depth_buy_quantity) > parseFloat(ask_qty_max)){
                ask_qty_max = ask_arr_sliced[i].depth_buy_quantity;
                ask_price_max = ask_arr_sliced[i].price;
                //////console.log("check 2");
            }
        }
    }//%%%%%% - END of FOR LOOP - %%%%%%%
    //%%%%%%% - START of IF ELSE - %%%%%%%
    //%%%%%%% - If Max Qauntity in Bid Array is Greater then Max Quantity in Ask Array Then Do or Else If Do - %%%%%%%
    let max_per = 0.0;
    if(parseFloat(bid_qty_max) > parseFloat(ask_qty_max)){
        great_wall_qty = parseFloat(bid_qty_max);//$max in PHP
        great_wall_price = parseFloat(bid_price_max);
        great_wall_color = "blue";
        side = "down";
        max_per = (bid_qty_max / base_order) * 100;
    } else if(parseFloat(ask_qty_max) > parseFloat(bid_qty_max)){
        great_wall_qty = parseFloat(ask_qty_max);
        great_wall_price = parseFloat(ask_price_max);
        great_wall_color = "red";
        side = "up";
        max_per = (ask_qty_max / base_order) * 100;
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
    dc_wall_resp_json['max_per'] = parseFloat(max_per);
    //%%%% Return JSON Reponse %%%%
    return dc_wall_resp_json;
} //%%%%%%%%%%%% END of Function Definition - get_last_barrierCalculate DC Wall  %%%%%%%%%%%%%%
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||| - G A P - ||||||||||||||||||||||||||||||||
//|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

async function get_last_barrier(symbol, market_value, type){
	
	return new Promise(async function(resolve, reject){
		conn.then(async db => {
			let where_json = {};
			if(type  == 'up'){
				where_json['barrier_value'] = {$gte : {market_value}};
			}else if(type == 'down'){
				where_json['barrier_value'] = {$lte : {market_value}};
			}
			where_json['coin'] = symbol;
			where_json['barrier_type'] = type;
			where_json['barrier_status'] = 'very_strong_barrier';

			db.collection('barrier_values_collection').find(where_json).sort({"created_date": -1}).limit(1).toArray(async function(err, data){
				if (err) throw err;
				////console.log(data, "===> makret_data");
				if(data.length > 0){
					resolve(data[0]);
				} else{
					resolve({});
				}
			})

		})
	})


}
async function get_last_demand_candle(symbol){
	//let candle_arr = await db.collection('market_chart').find({"coin": symbol, "candle_type": "demand"}).sort({"created_date": -1}).limit(1).toArray();

	return new Promise(async function(resolve, reject){
		conn.then(async db => {
			db.collection('market_chart').find({"coin": symbol, "candle_type": "demand"}).sort({"created_date": -1}).limit(1).toArray(async function(err, data){
				if (err) throw err;
				////console.log(data, "===> makret_data");
				if(data.length > 0){
					resolve(data[0]);
				} else{
					resolve({});
				}
			})
		})
	})

	//console.log(candle_arr[0], "Last Demand Candle");

	
	
}


async function indicators(symbol, market_buy_depth_arr, market_sell_depth_arr, coin_info, db){
	return new Promise(async function(resolve, reject){
		let coin_base_order = coin_info['base_order']; //order_book_base in php
		let coin_base_history = coin_info['base_history'];//trade_base_history in php
		//Synchronous Methods
		let black_wall_object = calculate_blackwall_amount_for_chart3(market_buy_depth_arr, market_sell_depth_arr, coin_base_order);
		let yellow_wall_object = calculate_yellowwall_amount_for_chart3(market_buy_depth_arr, market_sell_depth_arr, coin_base_order);
		let five_level_pressure_object = calculate_five_level_pressure(market_buy_depth_arr, market_sell_depth_arr);//calculate_pressure()
		let sevel_pressure_pressure_object = calculate_seven_level_pressure(market_buy_depth_arr, market_sell_depth_arr); //calculate_bid_ask_levels()
		let dc_big_wall_pressure_object = calculate_dc_wall(market_buy_depth_arr, market_sell_depth_arr, coin_base_order); //calculate_big_wall()
		//Promise Functions / Asynchronous Methods
		let current_candle_volume = get_rolling_hour_trade_volume_t2cot(symbol, db);
		let fifteen_minute_candle_volume = get_rolling_fifteen_mins_trade_vol(symbol, db);
		let five_minute_candle_volume = get_rolling_five_mins_trade_volume(symbol, db);
		let latest_candle_array = db.collection('market_chart').find({"coin": symbol, "global_swing_status": {$in: ['LL', 'HH', 'LH', 'HL']}}).sort({"_id": -1}).limit(1).toArray();
		//Promise Resolution of Promise Objects above

		var get_contract_one_response_json = get_contracts_one(symbol, db); //T1LTC //this method returns a promise 
		var get_contracts_two_response_json = get_contracts_two(symbol, db); //T2LTC //this method returns a promise
		var get_contracts_three_response_json = get_contracts_three(symbol, db); //T3LTC //this method returns a promise
		var get_contracts_four_response_json = get_contracts_four(symbol, db); //T4LTC //this method returns a promise
		
		Promise.all([
			current_candle_volume,
			fifteen_minute_candle_volume,
			five_minute_candle_volume,
			latest_candle_array,
			get_contract_one_response_json,
			get_contracts_two_response_json,
			get_contracts_three_response_json,
			get_contracts_four_response_json
		]).then(async resolved_items =>{
			//Resolved with resolved_items
			let current_candle_volume_resolved = resolved_items[0];
			let fifteen_minute_candle_volume_resolved = resolved_items[1];
			let five_minute_candle_volume_resolved = resolved_items[2];
			let latest_candle_array_resolved = resolved_items[3];
			let contracts_one_resolved = resolved_items[4];
			let contracts_two_resolved = resolved_items[5];
			let contracts_three_resolved = resolved_items[6];
			let contracts_four_resolved = resolved_items[7];

			////console.log(current_candle_volume_resolved, "=====> current_candle_volume_resolved")
			//Current candle 
			let bid_per_current_candle = current_candle_volume_resolved['bid_per'];
			let ask_per_current_candle = current_candle_volume_resolved['ask_per'];
			let bid_vol_current_candle = current_candle_volume_resolved['bid_vol'];
			let ask_vol_current_candle = current_candle_volume_resolved['ask_vol'];
			//Fifteen Minute Candle
			let bid_per_fifteen_minute_candle = fifteen_minute_candle_volume_resolved['bid_per'];
			let ask_per_fifteen_minute_candle = fifteen_minute_candle_volume_resolved['ask_per'];
			let bid_vol_fifteen_minute_candle = fifteen_minute_candle_volume_resolved['bid_vol'];
			let ask_vol_fifteen_minute_candle = fifteen_minute_candle_volume_resolved['ask_vol'];
			//Five minute candle
			let bid_per_five_minute_candle = five_minute_candle_volume_resolved['bid_per'];
			let ask_per_five_minute_candle = five_minute_candle_volume_resolved['ask_per'];
			let bid_vol_five_minute_candle = five_minute_candle_volume_resolved['bid_vol'];
			let ask_vol_five_minute_candle = five_minute_candle_volume_resolved['ask_vol'];
			//Like We Have In PHP / PHP Copy Starts
			let buyer_seller_15 = 0.0; // As In PHP
			let buyer_seller_5 = 0.0; // As In PHP
			// Buyer vs seller 15 Minuts Goes here
	        if (bid_vol_fifteen_minute_candle > ask_vol_fifteen_minute_candle) {
	            buyer_seller_15 = bid_vol_fifteen_minute_candle / ask_vol_fifteen_minute_candle;
	        } else {
	            buyer_seller_15 = bid_vol_fifteen_minute_candle / (ask_vol_fifteen_minute_candle * (-1));
	        }
	        // Buyer vs seller 5 Minuts Goes here
	        if (bid_vol_five_minute_candle > ask_vol_five_minute_candle) {
	            buyer_seller_5 = bid_vol_five_minute_candle / ask_vol_five_minute_candle;
	        } else {
	            buyer_seller_5 = bid_vol_five_minute_candle / (ask_vol_five_minute_candle * (-1));
	        }
	        //
	        // // ---- // PHP Copy Ends
	        //
			//Get Swing Point Value
			let swing_point = latest_candle_array_resolved[0]['global_swing_status'];
			//Promise Pending Below / Async Methods Called
			let contract_info = get_contract_info(symbol, db);
			let bid_contract_info = get_bid_contract_info(symbol, db);
			let ask_contract_info = get_ask_contract_info(symbol, db);
			let last_demand_candle = get_last_demand_candle(symbol,db);
			//Promise Resolution
			Promise.all([
				contract_info,
				bid_contract_info,
				ask_contract_info,
				last_demand_candle
			]).then(resolved_items_1 => {
				//Promise Resolved with resolved_items_1
				let contract_info_resolved = resolved_items_1[0];
				let bid_contract_info_resolved = resolved_items_1[1];
				let ask_contract_info_resolved = resolved_items_1[2];
				let last_demand_candle_resolved = resolved_items_1[3];
				////console.log(contract_info_resolved, "-----------MCP---------");
				////console.log(bid_contract_info_resolved, "-----------SPL---------");
				////console.log(ask_contract_info_resolved, "-----------BPL---------");

				let avg_bid_contract_info = bid_contract_info_resolved['avg'];
				let avg_ask_contract_info = ask_contract_info_resolved['avg'];

				//Condition as in PHP file
				let percentage_bid_ask_contract_info = 0.0;
				let v_press_bid_ask_contract_info = "";
				if(avg_bid_contract_info > avg_ask_contract_info){
					percentage_bid_ask_contract_info = bid_contract_info_resolved['per'];
					v_press_bid_ask_contract_info = "up";
				} else{
					percentage_bid_ask_contract_info = ask_contract_info_resolved['per'];
					v_press_bid_ask_contract_info = "down";
				}//
				//

				let data_to_return = new Object();

				//////console.log(black_wall_object);
				data_to_return['black_pressure'] = black_wall_object['blackwall_difference'];
				data_to_return['yellow_pressure'] = yellow_wall_object['yellowwall_difference'];
				data_to_return['swing_point'] = swing_point;
				//Contract Info
				data_to_return['mcp_avg'] = Convert_to_million(contract_info_resolved['avg']);
				data_to_return['mcp_per'] = contract_info_resolved['per'];
				//Bid Contract Info
				data_to_return['spl_avg'] = Convert_to_million(bid_contract_info_resolved['avg']);
				data_to_return['spl_per'] = bid_contract_info_resolved['per'];
				//Ask Contract Info
				data_to_return['bpl_avg'] = Convert_to_million(ask_contract_info_resolved['avg']);
				data_to_return['bpl_per'] = ask_contract_info_resolved['per'];
				//Current Candle/Trade Volume
				data_to_return['curr_bid_per'] = bid_per_current_candle;
				data_to_return['curr_ask_per'] = ask_per_current_candle;
				//5-Min / Rolling Candle/Trade Volume
				data_to_return['roll_bid_per'] = bid_per_five_minute_candle;
				data_to_return['roll_ask_per'] = ask_per_five_minute_candle;
				//15-Min / Rolling Candle/Trade Volume
				data_to_return['roll_fif_bid_per'] = bid_per_fifteen_minute_candle;
				data_to_return['roll_fif_ask_per'] = ask_per_fifteen_minute_candle;
				//Calculate Pressure Function PHP/ Five Level Pressure Node
				data_to_return['pressure_up'] = five_level_pressure_object['ask_index_count'];
				data_to_return['pressure_down'] = five_level_pressure_object['bid_index_count'];
				data_to_return['pressure_difference'] = five_level_pressure_object['five_level_pressure_difference'];
				//Big Wall Function PHP / DC Wall Node
				data_to_return['big_wall_value'] = Convert_to_million(dc_big_wall_pressure_object['great_wall_qty']);
				data_to_return['big_wall_per'] = dc_big_wall_pressure_object['max_per'];
				data_to_return['pressure_wall'] = dc_big_wall_pressure_object['side'];


				//LAst Demand Candle
				let last_candle_ask = last_demand_candle_resolved['ask_volume'];
				let last_candle_bid = last_demand_candle_resolved['bid_volume'];
				let last_candle_total = last_demand_candle_resolved['total_volume'];

				console.log(last_candle_ask,"last_candle_ask",last_candle_bid,"last_candle_bid",last_candle_total,"last_candle_total");

				let lc_bid_per = (last_candle_total/last_candle_bid)* 100;
				let lc_ask_per = (last_candle_total/last_candle_ask)* 100;
				
				data_to_return['lc_bid_per'] = lc_bid_per;
				data_to_return['lc_ask_per'] = lc_ask_per;


				data_to_return['t1ltc_bid_per'] = contracts_one_resolved['bids_per'];
				data_to_return['t1ltc_ask_per'] = contracts_one_resolved['asks_per'];
				data_to_return['t1ltc_time'] = contracts_one_resolved['time_string'];

				data_to_return['t2ltc_bid_per'] = contracts_two_resolved['bids_per'];
				data_to_return['t2ltc_ask_per'] = contracts_two_resolved['asks_per'];
				data_to_return['t2ltc_time'] = contracts_two_resolved['time_string'];

				data_to_return['t3ltc_bid_per'] = contracts_three_resolved['bids_per'];
				data_to_return['t3ltc_ask_per'] = contracts_three_resolved['asks_per'];
				data_to_return['t3ltc_time'] = contracts_three_resolved['time_string'];

				data_to_return['t4ltc_bid_per'] = contracts_four_resolved['bids_per'];
				data_to_return['t4ltc_ask_per'] = contracts_four_resolved['asks_per'];
				data_to_return['t4ltc_time'] = contracts_four_resolved['time_string'];
				//

				data_to_return['big_contract_pressure'] = v_press_bid_ask_contract_info;
				sevel_pressure_pressure_object

				data_to_return['seven_level_pressuure'] = sevel_pressure_pressure_object['new_p'];
        		data_to_return['seven_level_color'] = sevel_pressure_pressure_object['p_val'];
				
				let json_for_score = new Object();
				json_for_score['depth_pressure'] = five_level_pressure_object['five_level_pressure_difference'];
				json_for_score['depth_pressure_side'] = five_level_pressure_object['five_level_pressure_side'];
				json_for_score['black_pressure'] = black_wall_object['blackwall_difference'];
				json_for_score['black_color_side'] = black_wall_object['blackwall_side'];
				json_for_score['yellow_pressure'] = yellow_wall_object['yellowwall_difference'];
				json_for_score['yellow_color_side'] = yellow_wall_object['yellowwall_sode'];
				json_for_score['seven_level'] = sevel_pressure_pressure_object['new_p'];
				json_for_score['seven_level_side'] = sevel_pressure_pressure_object['p_val'];
				json_for_score['big_pressure'] = dc_big_wall_pressure_object['side'];
				json_for_score['buyers'] = bid_per_five_minute_candle;
				json_for_score['sellers'] = ask_per_five_minute_candle;
				json_for_score['big_sellers'] = bid_contract_info_resolved['per'];
				json_for_score['big_buyers'] = ask_contract_info_resolved['per'];
				json_for_score['t_h_b'] = contracts_two_resolved['bids_per'];
				json_for_score['t_h_a'] = contracts_two_resolved['asks_per'];

				let score =  calculate_score(json_for_score);
				data_to_return['score'] = parseInt(score);

				resolve(data_to_return);

			})


 		})
	})
}

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
    if (big_pressure == 'down') {
        score_big = 2;
    } else if (big_pressure == 'up') {
        score_big = -2;
    }
    total_score_array.push(score_big);
    //%%%%%%%%%% End Big Pressure %%%%%%%%%%%%%%%

    console.log(total_score_array, "=> total_score_array")

    let score_calculated = total_score_array.reduce(function(a, b) { return a + b; }, 0);
    score_calculated = score_calculated + 50;

    console.log(score_calculated, '=> score_calculated');

    return parseInt(score_calculated);

}//%%%%%%%%%%%%%%%%%% End of Function - Calculate_Score %%%%%%%%%%%%%%%%%%%%
////////////////
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
function Convert_to_million(labelValue) 
{   
    // Nine Zeroes for Billions
    var res = Math.abs(Number(labelValue)) >= 1.0e+9

    ? (Math.abs(Number(labelValue)) / 1.0e+9).toFixed(1) + "B"

    // Six Zeroes for Millions 

    : Math.abs(Number(labelValue)) >= 1.0e+6

    ? (Math.abs(Number(labelValue)) / 1.0e+6).toFixed(1) + "M"

    // Three Zeroes for Thousands

    : Math.abs(Number(labelValue)) >= 1.0e+3

    ? (Math.abs(Number(labelValue)) / 1.0e+3).toFixed(1)+ "K"

    : Math.abs(Number(labelValue)).toFixed(1);

    if(labelValue<0){

    res =  '-'+res;

    }

    return res;

}/** End of  Convert_to_million **/

//%%%%%%%%% - Function to SORT a JSON ARRAY by KEY - %%%%%%%%%
function sortByKey(array, key) {
    return array.sort(function(a, b) {
        var x = a[key]; var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}//%%%%%%%%% - //END Function sortByKey() - %%%%%%%%%

/////------//////
Date.prototype.addHours= function(h){
    this.setHours(this.getHours()+h);
    return this;
}
module.exports = router;