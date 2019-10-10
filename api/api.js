var express = require('express');
var router = express.Router();
var request = require('request');
const conn = require('../connection/database');
ObjectID = require('mongodb').ObjectID;
var md5 = require('md5');
var app = express();



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
		let  exchange = req.body.exchange;
		let userCoin =  (typeof  req.body.userCoin =='undefined')?'':req.body.userCoin; 
		var coin = ( (userCoinsArr.length == 0) || userCoin =='')?'TRXBTC':(userCoin =='')?userCoinsArr[0]['symbol']:userCoin;

		let currentMarketPriceArr = await listCurrentMarketPrice(coin,exchange);
		var currentMarketPrice = (currentMarketPriceArr.length ==0)?0:currentMarketPriceArr[0]['price'];
			currentMarketPrice = parseFloat(currentMarketPrice);


		var askPricesPromise =  listAskPrices(coin,currentMarketPrice);
		var bidPricesPromise =  listBidPrices(coin,currentMarketPrice);
		var marketHistoryPromise = listMarketHistory(coin);
		
		var currncy = coin.replace("BTC",'');
		var promisesResult = await Promise.all([askPricesPromise,bidPricesPromise,marketHistoryPromise]);

		var askPriceResp = promisesResult[0];
		var bidPriceResp = promisesResult[1];
		var historyResp = promisesResult[2];
		

		var marketHistoryArr = [];
		for(let row in historyResp){
			let new_row = historyResp[row];
				new_row['price'] = parseFloat(historyResp[row].price).toFixed(8);
				new_row['quantity'] = parseFloat(historyResp[row].quantity).toFixed(2);
				new_row['volume'] = parseFloat(historyResp[row].price*historyResp[row].quantity).toFixed(8);
				marketHistoryArr.push(new_row);	
		}


		var askPriceArr = [];
		for(let row in askPriceResp){
			let new_row = {};
				new_row['price'] = parseFloat(askPriceResp[row].price).toFixed(8);
				new_row['quantity'] = parseFloat(askPriceResp[row].quantity).toFixed(2);
				new_row['volume'] = parseFloat(askPriceResp[row].price*askPriceResp[row].quantity).toFixed(8);
				askPriceArr.push(new_row);	
		}

		var bidPriceArr = [];
		for(let row in bidPriceResp){
			let new_row = {};
				new_row['price'] = parseFloat(bidPriceResp[row].price).toFixed(8);
				new_row['quantity'] = parseFloat(bidPriceResp[row].quantity).toFixed(2);
				new_row['volume'] = parseFloat(bidPriceResp[row].price*bidPriceResp[row].quantity).toFixed(8);
				bidPriceArr.push(new_row);	
		}



		var responseReslt = {};
			responseReslt['askPricesArr'] = askPriceArr;
			responseReslt['bidPricesArr'] = bidPriceArr;
			responseReslt['marketHistoryArr'] = marketHistoryArr;
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
		var price = orders['price'];
		let exchnage = orders['exchnage'];
		orders['created_date'] = new Date();
		orders['modified_date'] = new Date();
		var collectionName =  (exchnage == 'binance')?'buy_orders':'buy_orders_'+exchnage;

		db.collection(collectionName).insertOne(orders,(err,result)=>{
			if(err){
				resp.status(403).send({
					message: err
				 });
			}else{
				//:::::::::::::::::::::::::::::::::
				var buyOrderId  = result.insertedId
				var log_msg = "Buy Order was Created at Price "+parseFloat(price).toFixed(8);
				let profit_percent  = req.body.tempOrderArr.profit_percent;

				if (req.body.orderArr.auto_sell == 'yes' && profit_percent != '') {
					log_msg += ' with auto sell ' +profit_percent +'%';
				}
				let show_hide_log = 'yes';
				let type = 'Order_created';
				var promiseLog = recordOrderLog(buyOrderId,log_msg,type,show_hide_log,exchnage)
					promiseLog.then((callback)=>{})

					if(req.body.orderArr.auto_sell == 'yes'){
					
						let tempOrder = req.body.tempOrderArr;
							tempOrder['created_date'] = new Date();
							tempOrder['buy_order_id'] = buyOrderId;
							var tempCollection =  (exchnage == 'binance')?'temp_sell_orders':'temp_sell_orders_'+exchnage;
		
							db.collection(tempCollection).insertOne(tempOrder,(err,result)=>{
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
				//:::::::::::::::::::::::::::::::::
			}
		})	
	})
})//End of createManualOrder





router.post('/createManualOrderByChart',(req,resp)=>{
	conn.then((db)=>{
		let orders = req.body.orderArr;
		let orderId = req.body.orderId;
		var price = orders['price'];
		let exchnage = orders['exchange'];

		
		orders['created_date'] = new Date();
		orders['modified_date'] = new Date();
		var collectionName =  (exchnage == 'binance')?'buy_orders':'buy_orders_'+exchnage;

		db.collection(collectionName).insertOne(orders,(err,result)=>{
			if(err){
				resp.status(403).send({
					message: err
				 });
			}else{
				//:::::::::::::::::::::::::::::::::
				var buyOrderId  = result.insertedId
				var log_msg = "Buy Order was Created at Price "+parseFloat(price).toFixed(8);
				let profit_percent  = req.body.tempOrderArr.profit_percent;

				if (req.body.orderArr.auto_sell == 'yes' && profit_percent != '') {
					log_msg += ' with auto sell ' +profit_percent +'%';
				}

				log_msg += 'With Chart';

				let show_hide_log = 'yes';
				let type = 'Order_created';
				var promiseLog = recordOrderLog(buyOrderId,log_msg,type,show_hide_log,exchnage)
					promiseLog.then((callback)=>{})

					if(req.body.orderArr.auto_sell == 'yes'){
					
						let tempOrder = req.body.tempOrderArr;
							tempOrder['created_date'] = new Date();
							tempOrder['buy_order_id'] = buyOrderId;
							var tempCollection =  (exchnage == 'binance')?'temp_sell_orders':'temp_sell_orders_'+exchnage;
		
							db.collection(tempCollection).insertOne(tempOrder,(err,result)=>{
							if(err){
								resp.status(403).send({
									message:'some thing went wrong while Creating order'
								 });
							}else{
								resp.status(200).send({
									message: 'Order successfully created with auto sell'
								 });
							}
						})
						}else{
							resp.status(200).send({
								message: 'Order created with**'
							 });
						}
				//:::::::::::::::::::::::::::::::::
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


router.post('/editAutoOrder',async (req,resp)=>{
	let order  = req.body.orderArr;
	order['modified_date'] = new Date()
	let orderId = order['orderId'];
	var exchange = order['exchange'];
   	var collection =  (exchange == 'binance')?'buy_orders':'buy_orders_'+exchange;
	    delete order['orderId'];
	var where = {};
	where['_id'] = new ObjectID(orderId); 
   var updPrmise = updateOne(where,order,collection);
	   updPrmise.then((callback)=>{})

   var log_msg = "Order Was <b style='color:yellow'>Updated</b>";
   let show_hide_log = 'yes';
   let type = 'order_updated';
   var promiseLog = recordOrderLog(orderId,log_msg,type,show_hide_log,exchange)
	   promiseLog.then((callback)=>{
		   
	   })

	resp.status(200).send({
		message: 'updated'
	});
})//End of editAutoOrder


function createAutoOrder(OrderArr){
	return new Promise((resolve)=>{
		conn.then((db)=>{
			var exchange = OrderArr['exchange'];
			var collection =  (exchange == 'binance')?'buy_orders':'buy_orders_'+exchange;
			db.collection(collection).insertOne(OrderArr,(err,result)=>{
				if(err){
					resolve(err);
				}else{
					resolve(result)
				}
			})
		})
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
	
		var BTCUSDTPRICE = ( typeof btcPriceArr.market_value == 'undefined')?btcPriceArr.price:btcPriceArr.market_value 
		


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
			
			let date = new Date(ordeLog[row].created_date).toISOString().
			replace(/T/, ' ').      // replace T with a space
			replace(/\..+/, '') 

			html +='<tr>';
			html +='<th scope="row" class="text-danger">'+index+'</th>';
			html +='<td>'+ordeLog[row].log_msg+'</td>';
			html +='<td>'+date+'</td>'
			html +='</tr>';
			index ++;
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
		         var BTCUSDTPRICE =	( typeof btcPriceArr.market_value == 'undefined')?btcPriceArr.price:btcPriceArr.market_value 


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

		var ins_data = {};
			ins_data['symbol'] = symbol;
			ins_data['purchased_price'] = purchased_price;
			ins_data['quantity'] = quantity;
			ins_data['profit_type'] = profit_type;
			ins_data['order_type'] = order_type;
			ins_data['admin_id'] = admin_id;
			ins_data['buy_order_check'] = buy_order_check;
			ins_data['buy_order_id'] = buy_order_id;
			ins_data['buy_order_binance_id'] = binance_order_id;
			ins_data['stop_loss'] = stop_loss;
			ins_data['lth_functionality'] = lth_functionality;
			ins_data['loss_percentage'] = loss_percentage;
			ins_data['application_mode'] = application_mode
			ins_data['trigger_type'] = 'no';
			ins_data['modified_date'] = new Date();
			ins_data['created_date'] = new Date();
		
		
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
				where['buy_order_id'] = {$in:[buy_order_id,new ObjectID(buy_order_id)]};

				var collection =  (exchange == 'binance')?'temp_sell_orders':'temp_sell_orders_'+exchange;
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
				var coin = ordersArr[row].symbol;

				

				newRow['quantity'] = quantity;
				newRow['status'] = status;
				let sell_order_id = (typeof ordersArr[row].sell_order_id =='undefined')?'':ordersArr[row].sell_order_id;

				var buyOrderId = ordersArr[row]._id;

				newRow['_id'] = ordersArr[row]._id;

				let buy_price = (typeof  ordersArr[row].market_value == 'undefined')?price:ordersArr[row].market_value;

				if(status == 'new'){
					newRow['price'] = parseFloat(price).toFixed(8);
				}else{
					
					newRow['price'] = parseFloat(buy_price).toFixed(8);
				}


				let currentMarketPriceArr = await listCurrentMarketPrice(coin,exchange);
				var currentMarketPrice = (currentMarketPriceArr.length ==0)?0:currentMarketPriceArr[0]['price'];
				currentMarketPrice = parseFloat(currentMarketPrice);

				console.log('currentMarketPrice :',currentMarketPrice)

				console.log('buy_price :',buy_price)

				let profit_loss_percentage = (currentMarketPrice - buy_price/buy_price)*100;
				newRow['profit_loss_percentage'] = parseFloat(profit_loss_percentage).toFixed(2);
				
				

				
				newRow['trigger_type'] = ordersArr[row].trigger_type;  

				newArr['auto_sell'] = ordersArr[row].auto_sell;

				let auto_sell = (typeof ordersArr[row].auto_sell =='undefined')?'':ordersArr[row].auto_sell;
				
				let buy_trail_percentage = (typeof ordersArr[row].buy_trail_percentage == 'undefined')?null:ordersArr[row].buy_trail_percentage;

				if(trigger_type !='no'){
					let calculateSellPrice = price+((price/100)*profitPercentage);
					    calculateSellPrice = parseFloat(calculateSellPrice).toFixed(8);
					newRow['profit_price_'] = ( (typeof calculateSellPrice == 'undefined') || calculateSellPrice ==0)?null:calculateSellPrice;

					let lsPrice = ordersArr[row].iniatial_trail_stop;

					lsPrice = parseFloat(lsPrice).toFixed(8);
					
					newRow['loss_price_'] = ( (typeof lsPrice == 'undefined') || lsPrice ==0)?null:lsPrice;
				

				}else{

					if(auto_sell =='no'){
						newRow['profit_price_'] = null;
						newRow['loss_price_'] = null;
						newRow['buy_trail_percentage'] = null;
						newRow['lth_functionality'] = null
						newRow['sell_trail_percentage'] = null;
					}else{

						
						newRow['buy_trail_percentage'] = buy_trail_percentage;


						if(sell_order_id == 0){
							var sellOrder = [];
						}else{
							var sellOrder = await listSellOrderById(sell_order_id,exchange);
						}


						if(sellOrder.length >0){
							let sellOrderArr = sellOrder[0];
							let loss_percentage = (typeof sellOrderArr.loss_percentage =='undefined')?null:sellOrderArr.loss_percentage;
						
						

							let sell_price = (typeof sellOrderArr.sell_price =='undefined')?null:sellOrderArr.sell_price;	

							

							sell_price = parseFloat(sell_price).toFixed(8);
				

							let stop_loss = (typeof sellOrderArr.stop_loss =='undefined')?'no':sellOrderArr.stop_loss;

							if(stop_loss == 'yes'){
								let calculate_stop_loss = (parseFloat(price)* parseFloat(loss_percentage))/100;
								calculate_stop_loss = (price) - parseFloat(calculate_stop_loss);
								newRow['loss_price_'] = parseFloat(calculate_stop_loss).toFixed(8);
							}else{
								newRow['loss_price_'] = null;
							}

							
							newRow['profit_price_'] = ((typeof sell_price == 'undefined') || sell_price ==0)?null:sell_price;

						

							let lth_functionality = (typeof sellOrderArr.lth_functionality == 'undefined')?null:sellOrderArr.lth_functionality;
							 newRow['lth_functionality'] = lth_functionality;

							 let sell_trail_percentage = (typeof sellOrderArr.sell_trail_percentage == 'undefined')?null:sellOrderArr.sell_trail_percentage;
							 newRow['sell_trail_percentage'] = sell_trail_percentage;

						}else{

							let tempArrResp = await listselTempOrders(buyOrderId,exchange);
							if(tempArrResp.length >0){

								let tempArr = tempArrResp[0];
								let loss_percentage = (typeof tempArr.loss_percentage =='undefined')?0:tempArr.loss_percentage;
								
							

								let profit_price = (typeof tempArr.profit_price =='undefined')?null:tempArr.profit_price;
						
								profit_price = parseFloat(profit_price).toFixed(8);

								let stop_loss = (typeof tempArr.stop_loss =='undefined')?'no':tempArr.stop_loss;

								if(stop_loss == 'yes'){
									let calculate_stop_loss = (parseFloat(price)* parseFloat(loss_percentage))/100;
									calculate_stop_loss = (price) - parseFloat(calculate_stop_loss);
									newRow['loss_price_'] = parseFloat(calculate_stop_loss).toFixed(8); 
								}else{
									newRow['loss_price_'] = null;
								}


							

								newRow['profit_price_'] = ((typeof profit_price == 'undefined') || profit_price ==0)?null:profit_price;


								

								let lth_functionality = (typeof tempArr.lth_functionality == 'undefined')?null:tempArr.lth_functionality;
								newRow['lth_functionality'] = lth_functionality;


								let sell_trail_percentage = (typeof tempArr.sell_trail_percentage == 'undefined')?null:tempArr.sell_trail_percentage;
							    newRow['sell_trail_percentage'] = sell_trail_percentage;

							}else{
								newRow['loss_price_'] = null;
								newRow['profit_price_'] =  null;
								newRow['buy_trail_percentage'] =  null;
								newArr['lth_functionality'] = null;
								newRow['sell_trail_percentage'] = null;
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



  router.post('/updateBuyPriceFromDragging',async (req,resp)=>{
	var exchange =  req.body.exchange;
	var orderId =  req.body.orderId;
	var previous_buy_price =  req.body.previous_buy_price;
	var updated_buy_price =  req.body.updated_buy_price;
	
	var buyOrderResp = await  listOrderById(orderId,exchange);
	var buyOrderArr = (typeof buyOrderResp[0] == 'undefined')?[]:buyOrderResp[0];

	var sell_order_id = (typeof buyOrderArr['sell_order_id'] == 'undefined')?'':buyOrderArr['sell_order_id'];

	var status = (typeof buyOrderArr['status'] == 'undefined')?'':buyOrderArr['status'];

	var trigger_type = (typeof buyOrderArr['trigger_type'] == 'undefined')?'':buyOrderArr['trigger_type'];

	if(trigger_type == 'no'){

		if(sell_order_id !=''){
			var sellOrderResp = await listSellOrderById(sell_order_id,exchange);

			var sellOrderArr = (typeof sellOrderResp[0] =='undefined')?[]:sellOrderResp[0];
			var sell_price = (typeof sellOrderArr.sell_price == 'undefined')?0:sellOrderArr.sell_price;

			if(status == 'new'){
				var buy_price = buyOrderArr.price;
			}else{
				var buy_price = (typeof buyOrderArr.market_value == 'undefined')?buyOrderArr.price:buyOrderArr.market_value;
			}

			var current_data2222 = sell_price - buy_price;
			var sell_percentage = (current_data2222 * 100 / buy_price);
				sell_percentage = isNaN(sell_percentage)?0:sell_percentage;

			
			var new_sell_price = parseFloat(updated_buy_price) +parseFloat((updated_buy_price/100)*sell_percentage);

			var filter = {};
				filter['_id'] = new ObjectID(sell_order_id);
			var update_order = {};	
				update_order['sell_price'] = new_sell_price;
			var collection_order = (exchange == 'binance')?'orders':'orders_'+exchange;
			var updatePromise =  updateOne(filter,update_order,collection_order);
			updatePromise.then((resolve)=>{});

		}else {//End of sell order id not empty

			var tempOrderResp = await listselTempOrders(orderId,exchange);

			console.log('::::::::::::::::::::::::::::::');
			console.log('tempordre arr');
			console.log(tempOrderResp);
			console.log('::::::::::::::::::::::::::::::');

			if(tempOrderResp.length >0){
					var tempOrderArr = (typeof tempOrderResp[0] =='undefined')?[]:tempOrderResp[0];
					var profit_price = (typeof tempOrderArr.profit_price == 'undefined')?0:tempOrderArr.profit_price;

					
					var profit_percent = (typeof tempOrderArr.profit_percent == 'undefined')?0:tempOrderArr.profit_percent;

					
			

					var temp_order_id = tempOrderArr['_id'];

					if(status == 'new'){
						var buy_price = buyOrderArr.price;
					}else{
						var buy_price = (typeof buyOrderArr.market_value == 'undefined')?buyOrderArr.price:buyOrderArr.market_value;
					}


					console.log(':::::::::::::::::::::::::');
						console.log('buy_price ',buy_price);
					console.log(':::::::::::::::::::::::::');

					console.log(':::::::::::::::::::::::::');
						console.log('profit_price ',profit_price);
					console.log(':::::::::::::::::::::::::');


					

					if(profit_percent == 0 || profit_percent == ''){
						var current_data2222 = profit_price - buy_price;
						var sell_percentage = (current_data2222 * 100 / buy_price);
						sell_percentage = isNaN(sell_percentage)?0:sell_percentage;
					}else{
						sell_percentage = profit_percent;
					}	


					var new_sell_price = parseFloat(updated_buy_price) +parseFloat((updated_buy_price/100)*sell_percentage);

					console.log('updatd sell price')

					var filter = {};
						filter['_id'] = temp_order_id;
					var update = {};	
					update['profit_price'] = new_sell_price;
					var collection = (exchange == 'binance')?'temp_sell_orders':'temp_sell_orders_'+exchange;	
					var updatePromise =  updateOne(filter,update,collection);
						updatePromise.then((resolve)=>{});
			}//End of temp order Arr
		}

	}//End of trigger type no




	var log_msg = "Order buy price updated from("+parseFloat(previous_buy_price).toFixed(8)+") to "+parseFloat(updated_buy_price).toFixed(8)+"  From Chart";

	var logPromise = recordOrderLog(orderId,log_msg,'buy_price_updated','yes',exchange);
	logPromise.then((callback)=>{});

	var filter = {};
	filter['_id'] = new ObjectID(orderId);
	var update = {};	
	update['price'] = updated_buy_price;
	update['modified_date'] = new Date();
	var collectionName = (exchange == 'binance')?'buy_orders':'buy_orders_'+exchange;
	var updatePromise = await updateOne(filter,update,collectionName);
	
	resp.status(200).send({
		message:'Order Buy Price Updated Successfully'
	})
		
  })//End of updateBuyPriceFromDragging

  router.post('/updateOrderfromdraging',async (req,resp)=>{
	  var exchange =  req.body.exchange;
	  var orderId =  req.body.orderId;
	  var side =  req.body.side;
	  var updated_price =  req.body.updated_price;

	  var side =  req.body.side;
	  var nss = side.indexOf("profit_inBall");

	  if(nss !=-1){
		  side = "profit_inBall";
	  }

	  var message = '';
	  var orderArr = await  listOrderById(orderId,exchange);

		if(orderArr.length >0){
			for(let index in orderArr){
				var orderid = orderArr[index]['_id'];
				var trigger_type = orderArr[index]['trigger_type'];
				var buy_price = orderArr[index]['price'];
				var previous_sell_price = (typeof orderArr[index]['sell_price'] == 'undefined')?0:orderArr[index]['sell_price'];

				var admin_id =  (typeof orderArr[index]['admin_id'] == 'undefined')?0:orderArr[index]['admin_id'];

				var application_mode = (typeof orderArr[index]['application_mode'] == 'undefined')?0:orderArr[index]['application_mode'];

				var sell_order_id = (typeof orderArr[index]['sell_order_id'] == 'undefined')?'':orderArr[index]['sell_order_id'];


				var auto_sell = (typeof orderArr[index]['auto_sell'] == 'undefined')?'':orderArr[index]['auto_sell'];

				//:::::: Auto Trigger Part :::::::::: 
				if(trigger_type !='no'){
					let iniatial_trail_stop = (typeof orderArr[index]['iniatial_trail_stop'] == 'undefined')?0:orderArr[index]['iniatial_trail_stop'];

					let sell_profit_percent = (typeof orderArr[index]['sell_profit_percent'] == 'undefined')?0:orderArr[index]['sell_profit_percent'];

					var current_data2222 = updated_price - buy_price;
					var calculate_new_sell_percentage = (current_data2222 * 100 / buy_price);
					
		

				 
					//:::::::::::::::: triggers :::::::::::::::::::
					if(side == 'profit_inBall'){
						message = ' Auto Order Sell Price Changed';
						var filter = {};
						filter['_id'] = new ObjectID(orderId);
						var update = {};	
						update['sell_price'] = updated_price;
						update['modified_date'] = new Date();
						update['sell_profit_percent'] = parseFloat(calculate_new_sell_percentage).toFixed(2); 
						update['defined_sell_percentage'] = parseFloat(calculate_new_sell_percentage).toFixed(2);



						var collectionName = (exchange == 'binance')?'buy_orders':'buy_orders'+exchange;
						var updatePromise = updateOne(filter,update,collectionName);
						updatePromise.then((resolve)=>{});
		
						
				
						var log_msg_1 = "Order Profit percentage Change From("+sell_profit_percent+" % ) To ("+parseFloat(calculate_new_sell_percentage).toFixed(2)+" %)  From Chart";
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
				}
				else{//End of trigger type
					//:::::::::::::::::Manual Trading :::::::::::::::::

					if(sell_order_id !=''){

						;
						var sellOrderResp = await listSellOrderById(sell_order_id,exchange);
						var sellOrderArr = (typeof sellOrderResp[0] == 'undefined')?[]:sellOrderResp[0];


						console.log('::::::::":":":":":"');
						console.log(sellOrderResp)
						console.log('::::::::":":":":":"');


						var sell_profit_percent = (typeof sellOrderArr.sell_profit_percent =='undefined')?'':sellOrderArr.sell_profit_percent;
						var sell_price = (typeof sellOrderArr.sell_price =='undefined')?'':sellOrderArr.sell_price;
						var stop_loss = (typeof sellOrderArr.stop_loss =='undefined')?'':sellOrderArr.stop_loss;
						var loss_percentage = (typeof sellOrderArr.loss_percentage =='undefined')?'':sellOrderArr.loss_percentage;

						var purchased_price = (typeof sellOrderArr.purchased_price =='undefined')?'':sellOrderArr.purchased_price;

						var market_value = (typeof sellOrderArr.market_value =='undefined')?'':sellOrderArr.market_value;

						purchased_price = (purchased_price  == '')?market_value:purchased_price;
						
						var current_data2222 = updated_price - purchased_price;
						var calculate_new_sell_percentage = (current_data2222 * 100 / purchased_price);

					


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

						   console.log('::::::::::::::::::::::::');
						   console.log('purchased_price',purchased_price);



						   console.log('::::::::::::::::::::::::');
						   console.log('updated_price',updated_price)


						   console.log(':::::::::::::::::::::::::::::');
						   console.log('stop_loss_percentage',stop_loss_percentage);
						   console.log('::::::::::::::::::::::::--- :::'); 


							var filter = {};
							filter['_id'] = new ObjectID(sell_order_id);
							var update = {};	
							update['stop_loss'] =  'yes';
							update['loss_percentage'] = parseFloat(stop_loss_percentage).toFixed(2);
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
						let tempArrResp = await listselTempOrders(orderId,exchange);


						//:::::::::::::::::::
						if(tempArrResp.length == 0){
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
							
								temp_arr['stop_loss'] = 'yes',
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
						
						}
						else{//End of auto sell is no
							//:::::::::::::::: update temp order arr
							console.log('two');
							var current_data2222 = updated_price - buy_price;
							var sell_profit_percent = (current_data2222 * 100 / buy_price);
						  

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
							
								var upd_temp = {};
								upd_temp['stop_loss'] = 'yes';
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
  
  

  
  router.post('/lisEditManualOrderById',async (req,resp)=>{
		let orderId = req.body.orderId;
		let exchange = req.body.exchange;
		var buyOrderResp = await  listOrderById(orderId,exchange);
		var buyOrderArr = buyOrderResp[0];

		var auto_sell = (typeof buyOrderArr['auto_sell'] =='undefined')?'no':buyOrderArr['auto_sell'];

		var sell_order_id =  (typeof buyOrderArr['sell_order_id'] =='undefined')?'':buyOrderArr['sell_order_id'];


		var ordrLogPromise = await  listOrderLog(orderId,exchange); 
		let html = '';
		let ordeLog = ordrLogPromise;
		var index = 1;
			for(let row in ordeLog){		
				let date = new Date(ordeLog[row].created_date).toISOString().
				replace(/T/, ' ').      // replace T with a space
				replace(/\..+/, '');
				html +='<tr>';
				html +='<th scope="row" class="text-danger">'+index+'</th>';
				html +='<td>'+ordeLog[row].log_msg+'</td>';
				html +='<td>'+date+'</td>'
				html +='</tr>';
				index ++;
			}
	
		var sellArr = [];
		var tempSellArr = [];
		if(auto_sell == 'yes'){
				if(sell_order_id !=''){
					var sellOrderResp = await  listSellOrderById(sell_order_id,exchange);
					var sellArr = sellOrderResp[0];
				}else{
					var tempOrderResp = await  listTempSellOrder(orderId,exchange);
					var tempSellArr = tempOrderResp[0];
				}
		}

		var respArr = {};
			respArr['logHtml'] = html;
			respArr['buyOrderArr'] = buyOrderArr;
			respArr['sellArr'] = sellArr;
			respArr['tempSellArr'] = tempSellArr;

		resp.status(200).send({
			message: respArr
		 });
		
  })//End of lisEditManualOrderById
  
  
  

  router.post('/updateManualOrder',(req,resp)=>{
	let buyOrderId = req.body.buyOrderId;
	let exchange = req.body.exchange;
	let sellOrderId = req.body.sellOrderId;
	let tempSellOrderId = req.body.tempSellOrderId;


	let buyorderArr = req.body.buyorderArr;
	let sellOrderArr = req.body.sellOrderArr;
	let tempOrderArr = req.body.tempOrderArr;

	let show_hide_log = 'yes';	
	let type = 'order_update';	
	let log_msg = "Order has been updated";
	var logPromise = recordOrderLog(buyOrderId,log_msg,type,show_hide_log);
		logPromise.then((resolve)=>{})


	var orders_collection =  (exchange == 'binance')?'orders':'orders_'+exchange;
    var buy_order_collection =  (exchange == 'binance')?'buy_orders':'buy_orders_'+exchange;
	var temp_sell_order_collection =  (exchange == 'binance')?'temp_sell_orders':'temp_sell_orders_'+exchange;
	

		var where = {};
			where['_id'] = new ObjectID(buyOrderId)
		var upsert = {'upsert':true};	  
		var updPromise = updateSingle(buy_order_collection,where,buyorderArr,upsert);
		updPromise.then((callback)=>{});
	
	


	if(sellOrderId != ''){
		var where_1 = {};
			where_1['_id'] = new ObjectID(sellOrderId)
		var upsert = {'upsert':true};	  
		var updPromise_1 = updateSingle(orders_collection,where_1,sellOrderArr,upsert);
		updPromise_1.then((callback)=>{});
	}


	if(tempSellOrderId !=''){
		var where_2 = {};
		where_2['_id'] = new ObjectID(tempSellOrderId)
		var upsert = {'upsert':true};	  
		var updPromise_2 = updateSingle(temp_sell_order_collection,where_2,tempOrderArr,upsert);
		updPromise_2.then((callback)=>{})
	}
	


		resp.status(200).send({
			message: 'order updated'
		 });

  })//End of updateManualOrder
  
  
  
  

  //::::::::::::::::::::::::::::::::::; /


  
router.post('/manageCoins', async(req, resp) => {
	var urserCoinsPromise = listUserCoins(req.body.admin_id);
	var globalCoinsPromise = listGlobalCoins();
	var promisesResult = await Promise.all([urserCoinsPromise, globalCoinsPromise]);
	var responseReslt = {};
	responseReslt['userCoins'] = promisesResult[0];
	responseReslt['globalCoins'] = promisesResult[1];
	resp.status(200).send({
		message: responseReslt
	});
}) //End of listOrderListing

router.post('/get_orders_post', function(req, res, next) {
conn.then(db => {


	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if (post_data_key_array.length == 0) {
		res.send({ "success": "false", "message": "No data posted in a post request" })
	} else {

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

		if (page == "") {
			page = 1;
		}

		if (old_status != "") {
			status = old_status;
			count_of_orders_promise = count_orders(status, application_mode, admin_id, filter_array);
		}

		count_of_orders_promise.then(async count_of_orders_promise_resolved => {
				//var total_pages = count_of_orders_promise_resolved;


				if (status == "open" || status == "sold") {
					if (status == "open") {
						search_array['status'] = "FILLED";
						search_array['is_sell_order'] = "yes";
					} else if (status == "sold") {
						search_array['status'] = "FILLED";
						search_array['is_sell_order'] = 'sold';
					}
				} else if (status == "parent") {
					search_array['parent_status'] = 'parent';
					search_array['status'] = 'new';
					console.log(search_array, "===> search_array")
				} else if (status == "lth") {
					search_array['status'] = 'lth';
				} else if (status == 'new') {
					search_array['status'] = 'new';
					search_array['parent_status'] = { $ne: 'parent' };
				} else if (status == 'all') {
					search_array['status'] = { $in: ['error', 'canceled', 'submitted'] };
					search_array['price'] = { $ne: '' };
				} else {
					search_array['status'] = status;
				}

				search_array["application_mode"] = application_mode;
				search_array['admin_id'] = admin_id;
				if (Object.keys(filter_array).length > 0) {
					if (filter_array['filter_coin'] != "") {
						symbol = filter_array['filter_coin'];
						search_array['symbol'] = { $in: coin_array };
						console.log(search_array, "===> search_array");
					}
					if (filter_array['filter_type'] != "") {
						order_type = filter_array['filter_type'];
						search_array['order_type'] = order_type;
					}
					if (filter_array['filter_level'] != "") {
						order_level = filter_array['filter_level'];
						search_array['order_level'] = order_level;
					}
					if (filter_array['filter_trigger'] != "") {
						filter_trigger = filter_array['filter_trigger'];
						search_array['trigger_type'] = filter_trigger;
					}
					if (filter_array['start_date'] != "" && filter_array['end_date'] != "") {
						start_date = new Date(filter_array['start_date']);
						end_date = new Date(filter_array['end_date']);
						order_type = filter_array['filter_type'];
						search_array['created_date'] = { $gte: start_date, $lte: end_date };
					}
				}
				console.log(search_array, "===> search_array of api")

				let final_orders_query_resolved = await db.collection('buy_orders').find(search_array).limit(perPage_limit).skip((perPage_limit * page) - perPage_limit).toArray();

				let order_count = await db.collection('buy_orders').count(search_array);
				let total_pages = Math.round(order_count / perPage_limit);

				//console.log(final_orders_query_resolved, "===> final_orders_query_resolved")

				if (final_orders_query_resolved.length > 0) {

					// function calculate_amount_and_resolve_promises(final_orders_query_resolved){
					// 	return new Promise(function (resolve, reject){

					// 		})
					// }//

					let array_response = [];
					let btc_price = await get_btc_price();
					final_orders_query_resolved.forEach(async final_orders_element => {


						let pulled_quantity = final_orders_element['quantity'];

						let pulled_coin_symbol = final_orders_element['symbol'];
						let market_price_array = await db.collection('market_prices').find({ "coin": pulled_coin_symbol }).sort({ "created_date": -1 }).limit(1).toArray();

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

					res.send({ "success": "true", "data": final_orders_query_resolved, "data_length": final_orders_query_resolved.length, "total_pages": total_pages, "message": "Orders fetched successfully" });
				} else {
					res.send({ "success": "false", "message": "No data found" });
				}


			}) // async function
	}

})
})


router.post('/get_user_info', function(req, res, next) {
var post_data = req.body;
let post_data_key_array = Object.keys(post_data);
if (post_data_key_array.length == 0) {
	res.status(400).send({ "success": "false", "status": 400, "message": "Bad request. No data posted in a post request" })
} else {
	if ('user_id' in post_data) {
		let user_id = post_data['user_id'];
		console.log(user_id, "===> user_id")
		conn.then(db => {
			let search_arr = { "_id": ObjectID(user_id) };
			console.log(search_arr, "===>search_arr")
			db.collection("users").findOne(search_arr, function(err, data) {
				if (err) throw err;
				console.log(data, "===> data")
				if (data != undefined || data != null) {
					if (Object.keys(data).length > 0) {
						data['profile_image'] = "data:image/gif;base64,R0lGODlhPQBEAPeoAJosM//AwO/AwHVYZ/z595kzAP/s7P+goOXMv8+fhw/v739/f+8PD98fH/8mJl+fn/9ZWb8/PzWlwv///6wWGbImAPgTEMImIN9gUFCEm/gDALULDN8PAD6atYdCTX9gUNKlj8wZAKUsAOzZz+UMAOsJAP/Z2ccMDA8PD/95eX5NWvsJCOVNQPtfX/8zM8+QePLl38MGBr8JCP+zs9myn/8GBqwpAP/GxgwJCPny78lzYLgjAJ8vAP9fX/+MjMUcAN8zM/9wcM8ZGcATEL+QePdZWf/29uc/P9cmJu9MTDImIN+/r7+/vz8/P8VNQGNugV8AAF9fX8swMNgTAFlDOICAgPNSUnNWSMQ5MBAQEJE3QPIGAM9AQMqGcG9vb6MhJsEdGM8vLx8fH98AANIWAMuQeL8fABkTEPPQ0OM5OSYdGFl5jo+Pj/+pqcsTE78wMFNGQLYmID4dGPvd3UBAQJmTkP+8vH9QUK+vr8ZWSHpzcJMmILdwcLOGcHRQUHxwcK9PT9DQ0O/v70w5MLypoG8wKOuwsP/g4P/Q0IcwKEswKMl8aJ9fX2xjdOtGRs/Pz+Dg4GImIP8gIH0sKEAwKKmTiKZ8aB/f39Wsl+LFt8dgUE9PT5x5aHBwcP+AgP+WltdgYMyZfyywz78AAAAAAAD///8AAP9mZv///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAEAAKgALAAAAAA9AEQAAAj/AFEJHEiwoMGDCBMqXMiwocAbBww4nEhxoYkUpzJGrMixogkfGUNqlNixJEIDB0SqHGmyJSojM1bKZOmyop0gM3Oe2liTISKMOoPy7GnwY9CjIYcSRYm0aVKSLmE6nfq05QycVLPuhDrxBlCtYJUqNAq2bNWEBj6ZXRuyxZyDRtqwnXvkhACDV+euTeJm1Ki7A73qNWtFiF+/gA95Gly2CJLDhwEHMOUAAuOpLYDEgBxZ4GRTlC1fDnpkM+fOqD6DDj1aZpITp0dtGCDhr+fVuCu3zlg49ijaokTZTo27uG7Gjn2P+hI8+PDPERoUB318bWbfAJ5sUNFcuGRTYUqV/3ogfXp1rWlMc6awJjiAAd2fm4ogXjz56aypOoIde4OE5u/F9x199dlXnnGiHZWEYbGpsAEA3QXYnHwEFliKAgswgJ8LPeiUXGwedCAKABACCN+EA1pYIIYaFlcDhytd51sGAJbo3onOpajiihlO92KHGaUXGwWjUBChjSPiWJuOO/LYIm4v1tXfE6J4gCSJEZ7YgRYUNrkji9P55sF/ogxw5ZkSqIDaZBV6aSGYq/lGZplndkckZ98xoICbTcIJGQAZcNmdmUc210hs35nCyJ58fgmIKX5RQGOZowxaZwYA+JaoKQwswGijBV4C6SiTUmpphMspJx9unX4KaimjDv9aaXOEBteBqmuuxgEHoLX6Kqx+yXqqBANsgCtit4FWQAEkrNbpq7HSOmtwag5w57GrmlJBASEU18ADjUYb3ADTinIttsgSB1oJFfA63bduimuqKB1keqwUhoCSK374wbujvOSu4QG6UvxBRydcpKsav++Ca6G8A6Pr1x2kVMyHwsVxUALDq/krnrhPSOzXG1lUTIoffqGR7Goi2MAxbv6O2kEG56I7CSlRsEFKFVyovDJoIRTg7sugNRDGqCJzJgcKE0ywc0ELm6KBCCJo8DIPFeCWNGcyqNFE06ToAfV0HBRgxsvLThHn1oddQMrXj5DyAQgjEHSAJMWZwS3HPxT/QMbabI/iBCliMLEJKX2EEkomBAUCxRi42VDADxyTYDVogV+wSChqmKxEKCDAYFDFj4OmwbY7bDGdBhtrnTQYOigeChUmc1K3QTnAUfEgGFgAWt88hKA6aCRIXhxnQ1yg3BCayK44EWdkUQcBByEQChFXfCB776aQsG0BIlQgQgE8qO26X1h8cEUep8ngRBnOy74E9QgRgEAC8SvOfQkh7FDBDmS43PmGoIiKUUEGkMEC/PJHgxw0xH74yx/3XnaYRJgMB8obxQW6kL9QYEJ0FIFgByfIL7/IQAlvQwEpnAC7DtLNJCKUoO/w45c44GwCXiAFB/OXAATQryUxdN4LfFiwgjCNYg+kYMIEFkCKDs6PKAIJouyGWMS1FSKJOMRB/BoIxYJIUXFUxNwoIkEKPAgCBZSQHQ1A2EWDfDEUVLyADj5AChSIQW6gu10bE/JG2VnCZGfo4R4d0sdQoBAHhPjhIB94v/wRoRKQWGRHgrhGSQJxCS+0pCZbEhAAOw=="
						res.status(200).send({
							"success": "true",
							"status": 200,
							"data": data,
							"message": "User data against _id " + user_id + " has been fetched successfully"
						})
					} else {
						res.status(204).send({
							"success": "false",
							"status": 204,
							"message": "User data against _id " + user_id + " was not found in users collection"
						})
					}
				} else {
					res.status(404).send({ "success": "false", "status": 404, "message": "Try a different user_id" })
				}
			})
		})
	} else {
		res.status(400).send({ "success": "false", "status": 400, "message": "user_id was required to completed this request..." })
	}

}
})

router.post('/update_user_info', function(req, res, next) {
var post_data = req.body;
let post_data_key_array = Object.keys(post_data);
if (post_data_key_array.length == 0) {
	res.status(400).send({ "success": "false", "status": 400, "message": "Bad request. No data posted in a post request" })
} else {
	if ('user_id' in post_data) {
		let user_id = post_data['user_id'];
		console.log(user_id, "===> user_id")
		conn.then(db => {
			let search_arr = { "_id": ObjectID(user_id) };
			console.log(search_arr, "===>search_arr")
			db.collection("users").findOne(search_arr, function(err, data) {
				if (err) throw err;
				if (Object.keys(data).length > 0) {
					let update_arr = new Object(post_data);
					delete update_arr.user_id;
					db.collection("users").updateOne(search_arr, { $set: update_arr }, function(err1, obj) {
						if (err1) throw err1;
						if (obj.result.nModified > 0) {
							res.status(200).send({
								"success": "true",
								"status": 200,
								"message": "User info against user_id " + user_id + " has been successfully update"
							})
						} else {
							res.status(207).send({
								"success": "partial",
								"status": 207,
								"message": "User info against user_id " + user_id + " was already updated. Try different values."
							})
						}
					})
				} else {
					res.status(404).send({
						"success": "false",
						"status": 404,
						"message": "user_id " + user_id + " was not found in the database"
					})
				}
			})
		}).catch(err3 => {
			res.status(500).send({
				"success": "false",
				"status": 500,
				"message": "Database connection problem"
			})
		})
	} else {
		res.status(400).send({ "success": "false", "status": 400, "message": "user_id was required to completed this request..." })
	}
}
})



	router.post('/addUserCoins', function(req, res, next) {
		var post_data = req.body;
		let post_data_key_array = Object.keys(post_data);
		if (post_data_key_array.length == 0) {
		res.send({ "success": "false", "message": "No data posted in a post request" })
		} else {
		conn.then(db => {
		if("admin_id" in post_data && "coin_ids" in post_data){
			let admin_id = post_data['admin_id'];
			let coin_ids = post_data['coin_ids'];
			let promise_arr = [];
			coin_id.forEach(async coin_idd => {
					promise_arr.push(get_coins_by_ids(coin_idd))
			})

			Promise.all(promise_arr).then(promise_res => {
				promise_res.forEach(coin_arr => {
					console.log(coin_arr);
				})
			})

			res.send(coins_arr)


		}

		async function get_coins_by_ids(coin_id){
			return new Promise(async function(resolve, reject){
				db.collection("coins").find({"_id": ObjectID("coin_id")}).toArray((err, data)=>{
				if (err) throw err;
				resolve(data[0]['symbol']);
				})
			})
		}
		})
		}
	})//End of addUserCoins

  //:::::::::::::::::::::::::::::::::::::::::: /



  

router.post('/addUserCoin', async function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	if(post_data_key_array.length == 0){
	res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
	console.log(post_data, "===> post_data");
	if("coin_arr" in post_data && "user_id" in post_data){
	conn.then(db => {
	let coin_arr = post_data["coin_arr"];
	let user_id = post_data["user_id"];
	db.collection("coins").deleteMany({"user_id": user_id});
	coin_arr.forEach(coin_id => {
	db.collection("coins").find({"_id": new ObjectID(coin_id)}).toArray(async function(err, coin_data){
	if (err) throw err;
	if(coin_data.length > 0){
	let new_coin_symbol = coin_data[0]['symbol'];
	let new_coin_name = coin_data[0]['coin_name'];
	let new_coin_logo = coin_data[0]['coin_logo'];
	let new_exchange_type = coin_data[0]['exchange_type'];
	let insert_obj = {"user_id": user_id, "symbol": new_coin_symbol, "coin_name": new_coin_name, "coin_logo": new_coin_logo, "exchange_type": new_exchange_type};
	db.collection("coins").insertOne(insert_obj, function(err1, obj){
	if (err1) throw err1;
	if(obj.result.nInserted > 0){
	console.log(obj.result.nInserted, "====> coin inserted ")
	}
	})
	} else{
	console.log("error 2")
	res.status(500).send({"success": "false", "message": "Something gone wrong while finding the coin id you've posted!", "coin_id": coin_id})
	}
	})
	})
	})
	res.status(200).send({"success": "true", "message": "coins inserted"})
	}
	}
	})


  
  Date.prototype.addHours= function(h){
    this.setHours(this.getHours()+h);
    return this;
  }
  

module.exports = router;


