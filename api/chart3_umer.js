var express = require('express');
var router = express.Router();
var request = require('request');
const conn = require('../connection/database');
ObjectID = require('mongodb').ObjectID;
var app = express();

//TEST
router.post('/test', (req, resp) => {
    resp.status(200).send({
        message: 'Api test working'
    })
})


//TODO: list orders API for chart that takes user_id, coin, exchange, application_mode and return orders
router.post('/orderListing', async (req, res)=>{
    const user_id = req.body.user_id
    const coin = req.body.coin
    const exchange = req.body.exchange
    const application_mode = req.body.application_mode

    //if (typeof query !== 'undefined' && query) { //do stuff if query is defined and not null
    if ((typeof user_id !== 'undefined' && user_id) && (typeof coin !== 'undefined' && coin) && (typeof exchange !== 'undefined' && exchange) && (typeof application_mode !== 'undefined' && application_mode)){
        let filter ={
            'user_id': user_id,
            'coin': coin,
            'exchange': exchange,
            'application_mode': application_mode,
        };

        let orders = await getOrdersListing(filter)

        var resOrdersArr = []
        if (orders.length > 0){

            // var resOrdersArr = orders.map(obj =>(obj))

            for(let row in orders ){

                obj = orders[row]

                let price = 0;
                if (obj.status == 'new'){
                    price = (typeof obj.price !== 'undefined' && obj.price ? parseFloat(obj.price).toFixed(8) : null);
                }else{
                    price = (typeof obj.purchased_price !== 'undefined' && obj.purchased_price ? parseFloat(obj.purchased_price).toFixed(8) : null);
                }

                let sell_order_id = (typeof obj.sell_order_id !== 'undefined' && obj.sell_order_id ? obj.sell_order_id : null)
                let sellOrder = (sell_order_id ? await listSellOrderById(sell_order_id, exchange) : [])

                let profit_price_ = null;
                let defined_sell_percentage = (typeof obj.defined_sell_percentage !== 'undefined' && obj.defined_sell_percentage ? obj.defined_sell_percentage : 0);
                let sell_profit_percent = (typeof obj.sell_profit_percent !== 'undefined' && obj.sell_profit_percent ? obj.sell_profit_percent : 0);
                let profitPercentage = (defined_sell_percentage == 0) ? sell_profit_percent : defined_sell_percentage;

                let calculateSellPrice = price + ((price / 100) * profitPercentage);
                calculateSellPrice = parseFloat(calculateSellPrice).toFixed(8);

                profit_price_ = ((typeof calculateSellPrice !== 'undefined') || calculateSellPrice != 0) ? calculateSellPrice : null;
                profit_price_ = (Number.isNaN(parseFloat(profit_price_))) ? null : profit_price_;
                

                let loss_price_ = null;
                let loss_percentage = '';
                if (obj.auto_sell !== 'undefined' && obj.auto_sell == 'yes') {
                    let stop_loss = '';
                    if (sellOrder && sellOrder.length) {
                        loss_percentage = (sellOrder.loss_percentage !== 'undefined') ? parseFloat(sellOrder.loss_percentage) : null;
                        stop_loss = (typeof sellOrder.stop_loss !== 'undefined' && sellOrder.stop_loss == 'yes' ? 'yes' : 'no')

                        if (stop_loss == 'yes') {
                            loss_price_ = (price - ((price * loss_percentage) / 100)).toFixed(8);
                            loss_price_ = (isNaN(loss_price_) ? null : loss_price_)
                        }
                    }
                }


                let temp_order =  {
                    _id: obj.id,
                    price: price,
                    index: null,

                    profit_price_: "0.00000390",
                    profit_percentage: 1.23,
                    profit_status: (obj.status == 'new' ? 'yes' : 'no'),
                    profit_price_indx: null,
                    profit_price_space: null,
                    greenLine: null,

                    loss_price_: loss_price_,
                    loss_percentage: loss_percentage,
                    loss_status: (obj.status == 'new' ? 'no' : 'yes'),
                    loss_price_indx: null,
                    loss_price_space: null,
                    redLine: null,

                    auto_sell: obj.auto_sell,
                    buy_trail_percentage: (typeof obj.buy_trail_percentage !== 'undefined' && obj.buy_trail_percentage ? obj.buy_trail_percentage : null),
                    lth_functionality: obj.lth_functionality,
                    quantity: obj.quantity,
                    sellOrderStatus: (sellOrder && sellOrder.length ? sellOrder.status : null),
                    sell_trail_percentage: (typeof obj.sell_trail_percentage !== 'undefined' && obj.sell_trail_percentage ? obj.sell_trail_percentage : null),
                    show_single_values: "no",
                    status: obj.status,
                    trigger_type: obj.trigger_type,
                    orderType: 'ask'
                }
                resOrdersArr.push(temp_order)
            
            }

            res.status(200).json({
                data: resOrdersArr
            })
        }else{
            res.status(404).json({
                data: [],
                message: 'Orders not found.'
            })
        }
    }else{
        res.status(400).json({
            message: 'user_id, coin, exchange, application_mode are required.'
        })
    }
})//End orderListing


//post call frol listing order on chart 
router.post('/listOrdersForChart', async (req, resp) => {
    var admin_id = req.body.admin_id;
    var exchange = req.body.exchange;
    var application_mode = req.body.application_mode;
    var coin = req.body.coin;

    var newArr = [];
    //function for list order for chart
    let ordersArr = await listOrdersForChart(admin_id, exchange, application_mode, coin);
    for (let row in ordersArr) {

        var sellOrderStatus = '';
        let newRow = {};
        let trigger_type = ordersArr[row].trigger_type;
        let defined_sell_percentage = (typeof ordersArr[row].defined_sell_percentage == 'undefined') ? 0 : ordersArr[row].defined_sell_percentage;
        let sell_profit_percent = (typeof ordersArr[row].sell_profit_percent == 'undefined') ? 0 : ordersArr[row].sell_profit_percent;
        let profitPercentage = (defined_sell_percentage == 0) ? sell_profit_percent : defined_sell_percentage;

        let price = (ordersArr[row].price);
        let status = ordersArr[row].status;
        let quantity = ordersArr[row].quantity;
        var coin = ordersArr[row].symbol;



        newRow['quantity'] = quantity;
        newRow['status'] = status;
        let sell_order_id = (typeof ordersArr[row].sell_order_id == 'undefined') ? '' : ordersArr[row].sell_order_id;

        var buyOrderId = ordersArr[row]._id;

        newRow['_id'] = ordersArr[row]._id;

        let buy_price = (typeof ordersArr[row].market_value == 'undefined') ? price : ordersArr[row].market_value;

        if (status == 'new') {
            newRow['price'] = parseFloat(price).toFixed(8);
        } else {

            newRow['price'] = parseFloat(buy_price).toFixed(8);
        }


        let currentMarketPriceArr = await listCurrentMarketPrice(coin, exchange);
        var currentMarketPrice = (currentMarketPriceArr.length == 0) ? 0 : currentMarketPriceArr[0]['price'];
        currentMarketPrice = parseFloat(currentMarketPrice);


        var current_data2222 = currentMarketPrice - buy_price;
        var profit_loss_percentage = (current_data2222 * 100 / buy_price);

        newRow['profit_loss_percentage'] = parseFloat(profit_loss_percentage).toFixed(2);




        newRow['trigger_type'] = ordersArr[row].trigger_type;

        newRow['auto_sell'] = ordersArr[row].auto_sell;

        let auto_sell = (typeof ordersArr[row].auto_sell == 'undefined') ? '' : ordersArr[row].auto_sell;

        let buy_trail_percentage = (typeof ordersArr[row].buy_trail_percentage == 'undefined') ? null : ordersArr[row].buy_trail_percentage;

        if (trigger_type != 'no') {
            let calculateSellPrice = price + ((price / 100) * profitPercentage);
            calculateSellPrice = parseFloat(calculateSellPrice).toFixed(8);

            var profit_price_ = ((typeof calculateSellPrice == 'undefined') || calculateSellPrice == 0) ? null : calculateSellPrice;
            newRow['profit_price_'] = (Number.isNaN(parseFloat(profit_price_))) ? null : profit_price_;



            let lsPrice = ordersArr[row].iniatial_trail_stop;

            lsPrice = parseFloat(lsPrice).toFixed(8);



            var loss_price_ = ((typeof lsPrice == 'undefined') || lsPrice == 0) ? null : lsPrice;
            newRow['loss_price_'] = (Number.isNaN(parseFloat(loss_price_))) ? null : loss_price_;


        } else {

            if (auto_sell == 'no') {
                newRow['profit_price_'] = null;
                newRow['loss_price_'] = null;
                newRow['buy_trail_percentage'] = null;
                newRow['lth_functionality'] = null
                newRow['sell_trail_percentage'] = null;
            } else {


                newRow['buy_trail_percentage'] = buy_trail_percentage;


                if (sell_order_id == 0) {
                    var sellOrder = [];
                } else {
                    var sellOrder = await listSellOrderById(sell_order_id, exchange);
                }


                if (sellOrder.length > 0) {
                    let sellOrderArr = sellOrder[0];
                    let loss_percentage = (typeof sellOrderArr.loss_percentage == 'undefined') ? null : sellOrderArr.loss_percentage;

                    var sellOrderStatus = (typeof sellOrderArr.status == 'undefined') ? '' : sellOrderArr.status;
                    newRow['sellOrderStatus'] = sellOrderStatus;

                    let sell_price = (typeof sellOrderArr.sell_price == 'undefined') ? null : sellOrderArr.sell_price;



                    sell_price = parseFloat(sell_price).toFixed(8);


                    let stop_loss = (typeof sellOrderArr.stop_loss == 'undefined') ? 'no' : sellOrderArr.stop_loss;

                    if (stop_loss == 'yes') {
                        let calculate_stop_loss = (parseFloat(price) * parseFloat(loss_percentage)) / 100;
                        calculate_stop_loss = (price) - parseFloat(calculate_stop_loss);

                        var loss_price_ = parseFloat(calculate_stop_loss).toFixed(8);

                        newRow['loss_price_'] = (Number.isNaN(parseFloat(loss_price_))) ? null : loss_price_;
                    } else {
                        newRow['loss_price_'] = null;
                    }




                    var profit_price_ = ((typeof sell_price == 'undefined') || sell_price == 0) ? null : sell_price;
                    newRow['profit_price_'] = (Number.isNaN(parseFloat(profit_price_))) ? null : profit_price_;


                    let lth_functionality = (typeof sellOrderArr.lth_functionality == 'undefined') ? null : sellOrderArr.lth_functionality;
                    newRow['lth_functionality'] = lth_functionality;

                    let sell_trail_percentage = (typeof sellOrderArr.sell_trail_percentage == 'undefined') ? null : sellOrderArr.sell_trail_percentage;
                    newRow['sell_trail_percentage'] = sell_trail_percentage;

                } else {
                    //when order is manul order and buy order is new then we can sell order detail from temp sell orders
                    let tempArrResp = await listselTempOrders(buyOrderId, exchange);

                    if (tempArrResp.length > 0) {

                        let tempArr = tempArrResp[0];
                        let loss_percentage = (typeof tempArr.loss_percentage == 'undefined') ? 0 : tempArr.loss_percentage;



                        let profit_price = (typeof tempArr.profit_price == 'undefined') ? null : tempArr.profit_price;

                        profit_price = parseFloat(profit_price).toFixed(8);

                        let stop_loss = (typeof tempArr.stop_loss == 'undefined') ? 'no' : tempArr.stop_loss;

                        if (stop_loss == 'yes') {
                            let calculate_stop_loss = (parseFloat(price) * parseFloat(loss_percentage)) / 100;
                            calculate_stop_loss = (price) - parseFloat(calculate_stop_loss);
                            var loss_price_ = parseFloat(calculate_stop_loss).toFixed(8);
                            newRow['loss_price_'] = (Number.isNaN(parseFloat(loss_price_))) ? null : loss_price_;
                        } else {
                            newRow['loss_price_'] = null;
                        }
                        var profit_price_ = ((typeof profit_price == 'undefined') || profit_price == 0) ? null : profit_price;
                        newRow['profit_price_'] = (Number.isNaN(parseFloat(profit_price_))) ? null : profit_price_;

                        let lth_functionality = (typeof tempArr.lth_functionality == 'undefined') ? null : tempArr.lth_functionality;
                        newRow['lth_functionality'] = lth_functionality;


                        let sell_trail_percentage = (typeof tempArr.sell_trail_percentage == 'undefined') ? null : tempArr.sell_trail_percentage;
                        newRow['sell_trail_percentage'] = sell_trail_percentage;

                    } else {
                        newRow['loss_price_'] = null;
                        newRow['profit_price_'] = null;
                        newRow['buy_trail_percentage'] = null;
                        newArr['lth_functionality'] = null;
                        newRow['sell_trail_percentage'] = null;
                    }


                }

            }

        }

        if (status == 'new') {
            newRow['profit_status'] = 'yes';
            newRow['loss_status'] = 'no';
        } else {
            newRow['profit_status'] = 'no';
            newRow['loss_status'] = 'yes';
        }

        newArr.push(newRow);





    }


    resp.status(200).send({
        message: newArr
    })

})

//post call from manage coins component
router.post('/manageCoins', async (req, resp) => {
    var urserCoinsPromise = listUserCoins(req.body.admin_id);
    var globalCoinsPromise = listGlobalCoins();
    var promisesResult = await Promise.all([urserCoinsPromise, globalCoinsPromise]);
    var responseReslt = {};
    responseReslt['userCoins'] = promisesResult[0];
    responseReslt['globalCoins'] = promisesResult[1];
    resp.status(200).send({
        message: responseReslt
    });
}) //End of manageCoins


//list global cons for an exchange
function listGlobalCoins() {
    return new Promise((resolve) => {
        conn.then((db) => {
            let filter = {};
            filter['user_id'] = 'global'
            filter['exchange_type'] = 'binance'
            db.collection('coins').find(filter).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of listGlobalCoins

//function for getting user coins
async function listUserCoins(userId) {
    return new Promise((resolve) => {
        let where = {};
        where.user_id = userId;
        where.symbol = { '$nin': ['', null, 'BTC', 'BNBBTC'] };
        conn.then(async (db) => {
            db.collection('coins').find(where).toArray(async (err, data) => {
                if (err) {
                    resolve(err)
                } else {

                    ///*************************************************

                    var return_arr = [];
                    var arrylen = data.length;
                    var temlen = 0;

                    (async () => {
                        for (let index in data) {
                            let data_element = {};
                            //Get last price of a coin
                            data_element['last_price'] = await getLastPrice(data[index]['symbol']);
                            //Get 24 hour price  Change  for a coin
                            let price_change_json = await get24HrPriceChange(data[index]['symbol']);

                            try {
                                if (price_change_json != null || Object.keys(price_change_json).length > 0) {
                                    data_element = Object.assign(data_element, price_change_json);

                                }
                            } catch {

                            }

                            data_element = Object.assign(data_element, data[index])
                            return_arr.push(data_element);
                        }

                        resolve(return_arr)

                    })()


                    ///***************************************************

                    // var return_arr =  mergeContentManageCoins(result);
                    // resolve(result)
                }
            })
        })
    })
} //End of listUserCoins

//getOrdersListing
function getOrdersListing(filter){
    return new Promise((resolve) => {
        let where = {};
        where['admin_id'] = filter.user_id;
        where['symbol'] = filter.coin;
        where['application_mode'] = filter.application_mode;
        where['price'] = { $nin: [null, ''] };
        where['status'] = { $in: ['submitted', 'FILLED', 'new', 'LTH'] }
        conn.then((db) => {
            let collection = (filter.exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + filter.exchange;
            db.collection(collection).find(where).limit(50).toArray((err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    resolve(result);
                }
            }) //End of collection
        }) //End of conn
    }) //End of Promise
}//End getOrdersListing

//function for getting order to show on chart 
function listOrdersForChart(admin_id, exchange, application_mode, coin) {
    return new Promise((resolve) => {
        let filter = {};
        filter['status'] = { '$in': ['submitted', 'FILLED', 'new', 'LTH'] }
        filter['price'] = { $nin: [null, ""] };
        filter['admin_id'] = admin_id;
        filter['application_mode'] = application_mode;
        filter['symbol'] = coin;
        conn.then((db) => {
            let collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            db.collection(collection).find(filter).toArray((err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    resolve(result);
                }
            }) //End of collection
        }) //End of conn
    }) //End of Promise
} //End of listOrdersForChart


//function for getting current market price 
function listCurrentMarketPrice(coin, exchange) {
    //get market price on the base of exchange 
    if (exchange == 'bam') {
        return new Promise(function (resolve, reject) {
            conn.then((db) => {
                let where = {};
                where['coin'] = coin;
                db.collection('market_prices_bam').find(where).toArray((err, result) => {
                    if (err) {
                        resolve(err);
                    } else {
                        if (result.length > 0) {
                            resolve(result);
                        } else {
                            resolve(000);
                        }
                    }
                })
            })
        })
    } else {
        //****************************8 */
        return new Promise((resolve) => {
            let where = {};
            where.coin = coin;
            conn.then((db) => {
                let collectionName = (exchange == 'binance') ? 'market_prices' : 'market_prices_' + exchange;
                db.collection(collectionName).find(where).sort({ "created_date": -1 }).limit(1).toArray((err, result) => {
                    if (err) {
                        resolve(err)
                    } else {
                        resolve(result)
                    }
                })
            })
        })
        //************************** */
    }

} //End of listCurrentMarketPrice


//get sell order detail by id 
function listSellOrderById(ID, exchange) {
    return new Promise((resolve, reject) => {
        let filter = {};
        filter['_id'] = new ObjectID(ID);
        conn.then((db) => {
            let collection = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
            db.collection(collection).find(filter).toArray((err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    resolve(result);
                }
            }) //End of collection
        }) //End of conn
    }) //End of Promise
} //End of listSellOrderById

module.exports = router;