var express = require('express');
var router = express.Router();z
const conn = require('../connection/database');
ObjectID = require('mongodb').ObjectID;

//********************************************************* */


//Hit this api to create history log
router.post('/create_orders_history_log', async(req, resp) => {
    var post_data = req.body;
    var order_id = (typeof post_data['order_id'] != 'undefined')?post_data['order_id']:'';
    var log_msg = (typeof post_data['log_msg'] != 'undefined')?post_data['log_msg']:'';
    var type = (typeof post_data['type'] != 'undefined')?post_data['type']:'';
    var show_hide_log = (typeof post_data['show_hide_log'] == 'undefined')?post_data['show_hide_log']:'';
    var exchange = (typeof post_data['exchange'] != 'undefined')?post_data['exchange']:'';
    var order_mode = (typeof post_data['order_mode'] != 'undefined')?post_data['order_mode']:'';
    var log_response = await create_orders_history_log(order_id, log_msg, type, show_hide_log, exchange,order_mode);

    resp.status(200).send({
        message: log_response
    })

})//End of create_orders_history_log


function create_orders_history_log(order_id, log_msg, type, show_hide_log, exchange,order_mode) {
    return new Promise((resolve, reject) => {
        conn.then((db) => {
            /** */
            var collectionName = (exchange == 'binance') ? 'orders_history_log' : 'orders_history_log_' + exchange;
            var d = new Date();
            //create collection name on the base of date and mode
            var date_mode_string = '_'+order_mode+'_'+d.getFullYear()+'_'+d.getMonth();
            //create full name of collection
            var full_collection_name = collectionName+date_mode_string;
        
            (async ()=>{
                //we check of collection is already created or not
                var collection_count  = await is_collection_already_exist(full_collection_name);
        
                let insertArr = {};
                insertArr['order_id'] = new ObjectID(order_id);
                insertArr['log_msg'] = log_msg;
                insertArr['type'] = type;
                insertArr['show_error_log'] = show_hide_log;
                insertArr['created_date'] = new Date();
                db.collection(full_collection_name).insertOne(insertArr, (err, success) => {
                        if (err) {
                            reject(err)
                        } else {
                            if(collection_count == 0){
                            var date_index = {'created_date':-1};
                            var dateIndexPromise =  create_index(full_collection_name, date_index);
                                dateIndexPromise.then((resolve)=>{});

                                var order_index = {'order_id':1};
                                var orderIndexPromise =  create_index(full_collection_name, order_index);
                                orderIndexPromise.then((resolve)=>{});
                                resolve(true);
                            }else{
                                resolve(success.result)
                            }
                        
                        }
                })
                /** */
            })();
        })
    })
} //End of function(create_orders_history_log)


//check of the collection already exist in data base
function  is_collection_already_exist(collName){
    return new Promise((resolve)=>{
        conn.then((db)=>{
            let where = {};
            db.collection(collName).countDocuments(where, (err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    resolve(result)
                }
            })
        })
    })
}//is_collection_already_exist

//function for creating index on the value of key
function create_index(collection, index_obj) {
    return new Promise((resole) => {
        conn.then((db) => {
            db.collection(collection).createIndex(index_obj, (err, result) => {
                if (err) {
                    resole(err);
                } else {
                    resole(result);
                }
            })
        })
    })
} //End of create_index

module.exports = router;
