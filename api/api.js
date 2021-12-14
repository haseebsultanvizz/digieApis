var express = require('express');
var router = express.Router();
var request = require('request');
const connections = require('../connection/database');
const conn = connections.connectionDatabase;
const localConn = connections.localConnectionDatabase;
ObjectID = require('mongodb').ObjectID;
var md5 = require('md5');
var app = express();

var auth = require('basic-auth')
var compare = require('tsscmp')
var googleAuthenticator = require('authenticator');
var jwt = require('jsonwebtoken');
const CryptoJS = require("crypto-js");


var auth_token = require('./auth');




var crypto = require('crypto');

var secret = 'digiebot_trading'

const Bowser = require("bowser");
const { ObjectId } = require('bson');

var digie_admin_ids = [
    '5c0912b7fc9aadaac61dd072', //admin
    // '5c3a4986fc9aad6bbd55b4f2',
    // '5e566497ab24936219344562',
    // '5eb5a5a628914a45246bacc6', //jamesparker
    '5c0915befc9aadaac61dd1b8', //vizzdeveloper
];

//********************************************************* */
//TODO: verify old password
//verifyOldPassword //Umer Abbas [6-1-2020]
router.post('/verifyOldPassword', async function (req, resp) {
    conn.then(async (db) => {
        let post_data = req.body;
        let user_id = req.body.user_id;
        let password = req.body.password;
        password = password.trim();
        if (Object.keys(post_data).length > 0) {
            if ("user_id" in post_data && "password" in post_data) {
                let md5Password = md5(password);
                let where = {
                    "_id": new ObjectID(user_id),
                    "password": md5Password
                };
                let reset = await db.collection("users").find(where).toArray();
                if (reset.length > 0) {
                    resp.status(200).send({
                        status: true,
                        message: 'verified successfully'
                    });
                } else {
                    resp.status(200).send({
                        status: false,
                        message: 'Invalid User'
                    });
                }

            } else {
                resp.status(400).send({
                    message: 'User Id or Password is empty'
                });
            }
        } else {
            resp.status(400).send({
                message: 'Empty Parameters Recieved'
            });
        }

    })
}) //End of verifyOldPassword

//TODO: Block temporarily if more than 3 unsuccessful login attempts
async function blockLoginAttempt(username, action) {
    return new Promise(async function (resolve, reject) {
        let where = {
            'username': username,
        }
        conn.then(async (db) => {
            db.collection('users').find(where).toArray(async (err, data) => {
                if (err) {
                    resolve(false)
                } else {
                    if (data.length > 0) {
                        if (action == 'temp_block_check') {
                            if (typeof data[0]['login_attempt_block_time'] != 'undefined' && data[0]['login_attempt_block_time'] != '') {
                                let login_attempt_block_time = new Date(String(data[0]['login_attempt_block_time']))
                                //15 minutes block time
                                let login_block_expiry = new Date(login_attempt_block_time.getTime() + 15 * 60000);
                                let current_time = new Date()
                                // console.log(login_block_expiry, '  =================  ', current_time)
                                if (login_block_expiry >= current_time && (!isNaN(parseInt(data[0]['unsuccessfull_login_attempt_count'])) && data[0]['unsuccessfull_login_attempt_count'] >= 3) ) {
                                    resolve(true)
                                } else {
                                    blockLoginAttempt(username, 'reset')
                                    resolve(false)
                                }
                            }
                            resolve(false)
                        } else if (action == 'increment') {
                            var set = {
                                'unsuccessfull_login_attempt_count': (typeof data[0]['unsuccessfull_login_attempt_count'] != 'undefined' && data[0]['unsuccessfull_login_attempt_count'] != '' && !isNaN(parseInt(data[0]['unsuccessfull_login_attempt_count'])) ? data[0]['unsuccessfull_login_attempt_count'] + 1 : 1)
                            }
                            if (set['unsuccessfull_login_attempt_count'] <= 3) {
                                set['login_attempt_block_time'] = new Date()
                                // set['user_soft_delete'] = 1
                            }
                            db.collection('users').updateOne(where, {
                                '$set': set
                            })

                            if (set['unsuccessfull_login_attempt_count'] >= 3) {
                                resolve(true)
                            }
                            resolve(false)
                        } else if (action == 'reset') {
                            let set = {
                                'unsuccessfull_login_attempt_count': 0,
                                'login_attempt_block_time': '',
                                'temporary_blocked_email_sent': '',
                                // 'user_soft_delete': ''
                            }
                            db.collection('users').updateOne(where, {
                                '$set': set
                            })
                            resolve(true)
                        }
                        resolve(false)
                    }
                    resolve(false)
                }
            })
        })
    })
} //end blockLoginAttempt

async function generatejwtToken(user_id, user_name){
    return new Promise(async function (resolve, reject) {
    var today = new Date();
      var exp = new Date(today);
      exp.setDate(today.getDate() + 7);

      let token =  jwt.sign({
        id: user_id,
        username: user_name,
        exp: parseInt(exp.getTime() / 1000),
      }, secret);

      resolve(token);
    });
}







function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (token == null) return res.sendStatus(401)

    jwt.verify(token,secret, (err, user) => {
      console.log(err)

      if (err) return res.sendStatus(403)


      console.log(user)
      req.user = user
      next()
    })
}


function getUserGoogleAuth(user_id){
    return new Promise(async function (resolve, reject) {
        var options = {
            method: 'POST',
            url: 'https://users.digiebot.com/apis/',
            headers: {
                'authorization': "Basic IUAjJCVeJiooKTohQCMkJV4mKigp",
                'content-type': "application/json",
                'cache-control': "no-cache",
                'postman-token': "c582684f-db19-e005-4933-4ec3f6395c81"
            },
            json: {"type" : "google_auth_status","id" : user_id},
        };
        request(options, function (error, response, body) {
            if (error) {
                resolve(false);
            } else {
                if (body.success) {
                    resolve(true)
                }else{
                   resolve(false)
                }
            }
        })




    });
}


function getUserGoogleAuthValidation(user_id, code){
    return new Promise(async function (resolve, reject) {

        var options = {
            method: 'POST',
            url: 'https://users.digiebot.com/apis/',
            headers: {
                'authorization': "Basic IUAjJCVeJiooKTohQCMkJV4mKigp",
                'content-type': "application/json",
                'cache-control': "no-cache",
                'postman-token': "c582684f-db19-e005-4933-4ec3f6395c81"
            },
            json: {"type" : "validate_google_auth","id" : user_id, "code": code},
        };
        request(options, function (error, response, body) {
            if (error) {
                resolve(false);
            } else {
                if (body.success) {
                    resolve(true)
                }else{
                   resolve(false)
                }
            }
        })
    });
}


function getUserSiteScore(url){
  return new Promise(async function (resolve, reject) {

    let ip = '';
    let port = 2500


    // let url = `https://www.google.com/recaptcha/api/siteverify?secret=` +
    //   `${this.SECRET_KEY}&response=${token}`


    let url_google = url



      console.log(url_google)
      request.post({
          url: url_google,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
          }
      }, function (error, response, body) {
          if (!error && response.statusCode == 200) {
              // console.log(JSON.parse(body));
              if(JSON.parse(body).success == true){
                resolve(JSON.parse(body));
              } else {
                resolve(false);
              }
          } else {
              resolve(false)
          }
      });
  });
}



router.post('/site_score', async (req,res)=>{

  var user_score = await getUserSiteScore(req.body.site_score);
  console.log(user_score, 'Score Object in Route')


  if(user_score.success){
    console.log('if')
    res.status(200).send( user_score )
  } else {
    console.log('else')
    res.status(201).send( user_score )
  }

  // res.send({ 'count': result[0]['log_ids'].length })

})


async function validate_user(postData) {
    return new Promise((resolve, reject) => {
        let req = new Object(postData);
        if (req.password !== null && req.username !== null) {

            var encrypted_pass = CryptoJS.AES.decrypt(req.password, 'digiebot_trading');
            pass = encrypted_pass.toString(CryptoJS.enc.Utf8);
            req.password = md5(pass);
            conn.then(async(db) => {
                var userData = await db.collection("users").findOne(req);
                if (userData !== null) {
                    userData.token = generatejwtToken(userData._id, userData.username)
                    resolve({ 'success': true, 'user': userData });
                } else {
                    resolve({ 'success': false });
                }
            });
        } else {
            resolve({ 'success': false });
        }
    });
}

router.post('/login', async function(req, res, next) {
    res.json(await validate_user(req.body));
});

//when first time user login call this function
router.post('/authenticate', async function (req, resp, next) {
    conn.then(async (db) => {
        var credentials = auth(req)


        if (!credentials || !check(credentials.name, credentials.pass)) {
            resp.status(403).send({
                "message": "You are not Authorized"
            })
        } else {
            let username = req.body.username.toLowerCase();
            let pass     = req.body.password;

            var encrypted_pass = CryptoJS.AES.decrypt(pass, 'digiebot_trading');
            pass = encrypted_pass.toString(CryptoJS.enc.Utf8);



            pass = pass.trim();
            username = username.trim();
            //Convert password to md5
            let md5Pass = md5(pass);
            let where = {};
            //Function for sup password so that we can login for any user
            let global_password_arr = await db.collection("superadmin_settings").find({
                "subtype": "superadmin_password"
            }).toArray();
            let global_password = global_password_arr[0]['updated_system_password'];
            //We compare if login password is global password then we allow to login on the base of global password
            if (pass == global_password) {
                /////////// IP CHECK HERE
                ////////////

                //If we Allow only trusted ips
                var trustedIps = ['203.99.181.69', '203.99.181.17'];
                var requestIP = String(req.connection.remoteAddress);
                requestIP.replace("::ffff:", '');
                if (true) {

                    where['$or'] = [{
                        // username: username
                        username_lowercase: username
                    }, {
                        email_address: username
                    }]
                    where['status'] = '0';
                    where['user_soft_delete'] = '0';

                    let UserPromise = db.collection('users').find(where).toArray();
                    UserPromise.then(async (userArr) => {
                        let respObj = {};
                        if (userArr.length > 0) {
                            userArr = userArr[0];
                            let api_key = (typeof userArr['api_key'] == 'undefined') ? '' : userArr['api_key'];
                            let api_secret = (typeof userArr['api_secret'] == 'undefined') ? '' : userArr['api_secret'];
                            if (api_key == '' || api_secret == '' || api_key == null || api_secret == null) {
                                var check_api_settings = 'no';
                            } else {
                                var check_api_settings = 'yes';
                            }
                            let application_mode = (typeof userArr['application_mode'] == 'undefined') ? '' : userArr['application_mode'];

                            if (application_mode == "" || application_mode == null || application_mode == 'no') {
                                var app_mode = 'test';
                            } else {
                                var app_mode = (application_mode == 'both') ? 'live' : application_mode;
                            }

                            let exchangesArr = await getUserExchangesWithAPISet(String(userArr['_id']))
                            if (exchangesArr.length > 0 && app_mode != 'test' && app_mode != '') {
                                check_api_settings = 'yes';
                                app_mode = 'live'
                            }


                            var token = await generatejwtToken(userArr['_id'], userArr['username']);

                            respObj.id = userArr['_id'];
                            respObj.username = userArr['username'];
                            respObj.firstName = userArr['first_name'];
                            respObj.lastName = userArr['last_name'];
                            respObj.profile_image = userArr['profile_image'];
                            respObj.role = 'admin'; //userArr['user_role'];
                            respObj.token = token;
                            respObj.is_digie = userArr['is_digie'];
                            respObj.is_nsight = typeof userArr['is_nsights'] == 'undefined' || userArr['is_nsights'] == '' ? 0 : userArr['is_nsights'];
                            respObj.nsight_start_date = userArr['nsight_start_date'];
                            respObj.nsight_expiry_date = userArr['nsight_expiry_date'];
                            respObj.email_address = userArr['email_address'];
                            respObj.timezone = userArr['timezone'];
                            respObj.check_api_settings = check_api_settings;
                            respObj.application_mode = app_mode
                            respObj.leftmenu = userArr['leftmenu'];
                            respObj.user_role = userArr['user_role'];
                            respObj.special_role = userArr['special_role'];
                            // respObj.google_auth = userArr['google_auth'];
                            respObj.trigger_enable = userArr['trigger_enable'];
                            respObj.trading_ip = userArr['trading_ip'];
                            respObj.is_global_user = 'yes';
                            respObj.exchangesArr = exchangesArr;
                            respObj.default_exchange = typeof userArr['default_exchange'] != 'undefined' && userArr['default_exchange'] != '' ? userArr['default_exchange'] : (exchangesArr.length > 0 ? exchangesArr[0] : 'binance');

                            if (typeof userArr['maxBtcCustomPackage'] != 'undefined'){
                                respObj.maxBtcCustomPackage = userArr['maxBtcCustomPackage']
                            }
                            if (typeof userArr['maxUsdtCustomPackage'] != 'undefined'){
                                respObj.maxUsdtCustomPackage = userArr['maxUsdtCustomPackage']
                            }
                            if (typeof userArr['maxDailTradeAbleBalancePercentage'] != 'undefined'){
                                respObj.maxDailTradeAbleBalancePercentage = userArr['maxDailTradeAbleBalancePercentage']
                            }

                            respObj.userPackage = await getUserPackage(String(userArr['_id']));


                            console.log(respObj);

                            resp.send(respObj);

                        } else {
                            resp.status(400).send({
                                message: 'username or Password Incorrect'
                            });
                        }
                    })
                } else {
                    resp.status(400).send({
                        message: 'Not Authorized For this Password'
                    });
                }
                /////////// IP CHECK HERE
                ////////////
            } else {

                //In the case when Normal Login
                where.password = md5Pass;
                where['$or'] = [{
                    // username: username
                    username_lowercase: username
                }, {
                    email_address: username
                }]
                where['status'] = '0';
                where['user_soft_delete'] = '0';


                console.log('else working')
                conn.then((db) => {
                    let UserPromise = db.collection('users').find(where).toArray();
                    UserPromise.then(async (userArr) => {
                        let respObj = {};
                        if (userArr.length > 0) {
                            if (await blockLoginAttempt(username, 'temp_block_check')) {

                                let email = sendTempBlockEmail(req)

                                resp.status(400).send({
                                    type: 'unsuccessfull_attempts',
                                    message: 'User temporary blocked for 15 minutes due to 3 unsuccessful login attempts.'
                                });
                            } else {
                                //Reset temporary block
                                blockLoginAttempt(username, 'reset')

                                userArr = userArr[0];
                                let api_key = (typeof userArr['api_key'] == 'undefined') ? '' : userArr['api_key'];
                                let api_secret = (typeof userArr['api_secret'] == 'undefined') ? '' : userArr['api_secret'];
                                if (api_key == '' || api_secret == '' || api_key == null || api_secret == null) {
                                    var check_api_settings = 'no';
                                } else {
                                    var check_api_settings = 'yes';
                                }
                                let application_mode = (typeof userArr['application_mode'] == 'undefined') ? '' : userArr['application_mode'];

                                if (application_mode == "" || application_mode == null || application_mode == 'no') {
                                    var app_mode = 'test';
                                } else {
                                    var app_mode = (application_mode == 'both') ? 'live' : application_mode;
                                }

                                let exchangesArr = await getUserExchangesWithAPISet(String(userArr['_id']))
                                if (exchangesArr.length > 0 && app_mode != 'test' && app_mode != '') {
                                    check_api_settings = 'yes';
                                    app_mode = 'live'
                                }



                                var token = await generatejwtToken(userArr['_id'], userArr['username']);




                                respObj.id = userArr['_id'];
                                respObj.username = userArr['username'];
                                respObj.firstName = userArr['first_name'];
                                respObj.lastName = userArr['last_name'];
                                respObj.profile_image = userArr['profile_image'];
                                respObj.role = 'admin'; //userArr['user_role'];
                                respObj.token = token;
                                // respObj.is_digie = 0;
                                // respObj.is_nsight = 1;
                                respObj.is_digie = userArr['is_digie'];
                                respObj.is_nsight = typeof userArr['is_nsights'] == 'undefined' || userArr['is_nsights'] == '' ? 0 : userArr['is_nsights'];
                                respObj.nsight_start_date = userArr['nsight_start_date'];
                                respObj.nsight_expiry_date = userArr['nsight_expiry_date'];
                                respObj.email_address = userArr['email_address'];
                                respObj.timezone = userArr['timezone'];
                                respObj.check_api_settings = check_api_settings;
                                respObj.application_mode = app_mode
                                respObj.leftmenu = userArr['leftmenu'];
                                respObj.user_role = userArr['user_role'];
                                respObj.special_role = userArr['special_role'];
                                respObj.trading_ip = userArr['trading_ip'];
                                // respObj.google_auth = userArr['google_auth'];


                                console.log(userArr['google_auth'], 'in DB')
                                // if(userArr['google_auth'] != 'yes'){
                                    var google_auth = await getUserGoogleAuth(String(userArr['_id']))
                                    // set google_auth functionality
                                    console.log('No in Local DB & in users DB', google_auth)
                                    if(google_auth == true){
                                        respObj.google_auth = 'yes';
                                    } else {
                                        respObj.google_auth = 'no';
                                    }
                                // } else {
                                //     respObj.google_auth = userArr['google_auth'];
                                // }
                                respObj.trigger_enable = userArr['trigger_enable'];
                                respObj.is_global_user = 'no';
                                respObj.exchangesArr = exchangesArr;
                                respObj.default_exchange = typeof userArr['default_exchange'] != 'undefined' && userArr['default_exchange'] != '' ? userArr['default_exchange'] : (exchangesArr.length > 0 ? exchangesArr[0] : 'binance');

                                if (typeof userArr['maxBtcCustomPackage'] != 'undefined') {
                                    respObj.maxBtcCustomPackage = userArr['maxBtcCustomPackage']
                                }
                                if (typeof userArr['maxUsdtCustomPackage'] != 'undefined') {
                                    respObj.maxUsdtCustomPackage = userArr['maxUsdtCustomPackage']
                                }
                                if (typeof userArr['maxDailTradeAbleBalancePercentage'] != 'undefined') {
                                    respObj.maxDailTradeAbleBalancePercentage = userArr['maxDailTradeAbleBalancePercentage']
                                }

                                respObj.userPackage = await getUserPackage(String(userArr['_id']));

                                if (typeof userArr['package_id'] != 'undefined' && userArr['package_id'] != ''){
                                    let myPackage = await db.collection('dynamic_packages').find({ '_id': userArr['package_id']}).toArray();
                                    if (myPackage.length > 0){
                                        respObj['myPackage'] = myPackage[0]
                                    }
                                }

                                //Update last login time
                                db.collection('users').updateOne({
                                    '_id': userArr['_id']
                                }, {
                                    '$set': {
                                        'last_login_datetime': new Date()
                                    }
                                });

                                // send_notification(respObj.id, 'security_alerts', 'high', 'Your account is just logged In ', '', '', '', 'web')

                                resp.send(respObj);
                            }
                        } else {
                            if (await blockLoginAttempt(username, 'increment')) {

                                let email = sendTempBlockEmail(req)

                                resp.status(400).send({
                                    type: 'unsuccessfull_attempts',
                                    message: 'User temporary blocked for 15 minutes due to 3 unsuccessful login attempts.'
                                });
                            } else {
                                resp.status(400).send({
                                    message: 'username or Password Incorrect'
                                });
                            }
                        }
                    })
                })
            }
        }
    })
}) //End of authenticate_test

//resetPassword //Umer Abbas [19-11-19]
router.post('/resetPassword', async function (req, resp) {
    conn.then(async (db) => {

        var auth_token = req.headers.authorization;
        let post_data = req.body;
        let user_id = req.body.user_id;
        let password = req.body.password;
        password = password.trim();
        if (Object.keys(post_data).length > 0) {
            if ("user_id" in post_data && "password" in post_data) {
                // let md5Password = md5(password);
                let md5Password = password;
                let where = {
                    "_id": new ObjectID(user_id)
                };
                let set = {
                    '$set': {
                        'password': md5Password,
                        'org_password': password,
                        'unsuccessfull_login_attempt_count': 0,
                        'login_attempt_block_time': '',
                        'temporary_blocked_email_sent': '',
                    }
                }

                let reset = await db.collection("users").updateOne(where, set);
                if (reset.result.ok) {

                    var reqObj = {
                        'type': 'POST',
                        'url': 'https://app.digiebot.com/admin/Api_calls/important_user_activity_logs',
                        'headers':{
                            'Authorization': auth_token
                        },
                        'payload': {
                            'user_id': String(user_id),
                            'type': 'password_updated',
                            'log': 'Trading.digiebot.com password updated',
                        },
                    }
                    var apiResult = await customApiRequest(reqObj)

                    resp.status(200).send({
                        status: true,
                        message: 'password reset successful'
                    });
                } else {
                    resp.status(400).send({
                        status: false,
                        message: 'password reset failed Invalid User'
                    });
                }

            } else {
                resp.status(400).send({
                    status: false,
                    message: 'User Id or Password is empty'
                });
            }
        } else {
            resp.status(400).send({
                status: false,
                message: 'Empty Parameters Recieved'
            });
        }
    })
}) //End of resetPassword


router.get('/myTest2', async (req,res)=>{
    // console.log(await getClientInfo(req))

    const db = await conn

    // let result = await db.collection('buy_orders').aggregate([
    //     { '$match': { 'application_mode': 'live', 'parent_status': 'parent', 'status': { '$ne': 'canceled' } } },
    //     { '$sort': { 'created_date': -1 } },
    //     { '$group': { '_id': { 'admin_id': '$admin_id', 'coin': '$symbol', 'level': '$order_level' }, 'data': { '$push': '$$ROOT' }, 'sum': { '$sum': 1 } } },
    //     { '$match': { 'sum': { '$gt': 1 } } },
    //     { '$project': { '_id': 0, 'data': { '$slice': ["$data", 1, { '$subtract': [{ '$size': "$data" }, 1] }] } } },
    //     { '$unwind': '$data' },
    //     { '$project': { '_id': '$data._id' } },
    //     {'$group': { '_id': null, 'parent_ids':{'$push':'$_id'} } },
    //     // { '$count': 'total' }
    // ]).toArray()

    // console.log(result)

    // await db.collection('buy_orders').updateMany({ '_id': { '$in': result[0]['parent_ids']}}, {'$set':{'status':'canceled', 'cancel_reason':'duplicate_parents_for_same_coin_and_level'}})

    // let parentOrders = await db.collection('buy_orders').find({ 'application_mode':'live', 'parent_status':'parent', 'status': 'canceled', 'cancel_reason': 'duplicate_parents_for_same_coin_and_level'}).toArray()

    // let count = parentOrders.length
    // for(let i=0; i<count; i++){

    //     // console.log(parentOrders[i]['_id'])
    //     if(i > 2){
    //         // await create_orders_history_log(parentOrders[i]['_id'], 'Duplicate parent exists', 'cancel_parent_reason', 'yes', 'binance', parentOrders[i]['application_mode'], parentOrders[i]['created_date'])
    //     }

    // }


    //To improve logs collections
    let result = await db.collection('orders_history_log_live_2020_7').aggregate([
        // { '$match': { 'type': { '$in': ['auto_trade_usd_worth_update', 'usd_worth_qty_update', 'canceled_by_auto_trade_generator', 'parent_updated_by_ATG_manually'] } } },
        { '$sort': { 'created_date': -1 } },
        { '$group': { '_id': { 'type': '$type', 'order_id': '$order_id' }, 'data': { '$push': '$$ROOT' }, 'sum': { '$sum': 1 } } },
        { '$match': { 'sum': { '$gt': 1 } } },
        { '$project': { '_id': 0, 'data': { '$slice': ["$data", 1, { '$subtract': [{ '$size': "$data" }, 1] }] } } },
        { '$unwind': '$data' },
        { '$project': { '_id': '$data._id' } },
        {'$group': { '_id': null, 'log_ids':{'$push':'$_id'} } },
        // { '$count': 'total' }
    ], {allowDiskUse: true}).toArray()

    // res.send({ 'count': result[0]['log_ids'].length, 'data': result[0]['log_ids'] })

    console.log(result[0]['log_ids'].length)

    res.send({ 'count': result[0]['log_ids'].length })

})

router.get('/deleteLogsTest', async (req,res)=>{
    // console.log(await getClientInfo(req))

    //testing pull/push

    const db = await conn

    //To improve logs collections
    let result = await db.collection('orders_history_log_kraken_live_2020_10').aggregate([
        // { '$match': { 'type': { '$in': ['auto_trade_usd_worth_update', 'usd_worth_qty_update', 'canceled_by_auto_trade_generator', 'parent_updated_by_ATG_manually'] } } },
        { '$match': { 'type': 'system_auto_stoploss' } },
        { '$sort': { 'created_date': -1 } },
        { '$group': { '_id': { 'type': '$type', 'order_id': '$order_id' }, 'data': { '$push': '$$ROOT' }, 'sum': { '$sum': 1 } } },
        { '$match': { 'sum': { '$gt': 1 } } },
        { '$project': { '_id': 0, 'data': { '$slice': ["$data", 1, { '$subtract': [{ '$size': "$data" }, 1] }] } } },
        { '$unwind': '$data' },
        { '$project': { '_id': '$data._id' } },
        {'$group': { '_id': null, 'log_ids':{'$push':'$_id'} } },
        // { '$count': 'total' }
    ], {allowDiskUse: true}).toArray()

    // res.send({ 'count': result[0]['log_ids'].length, 'data': result[0]['log_ids'] })

    console.log(result[0]['log_ids'].length)

    // let result111 = await db.collection('orders_history_log_kraken_live_2020_10').deleteMany({ '_id': { '$in': result[0]['log_ids']}})
    // console.log(result111)

    res.send({ 'count': result[0]['log_ids'].length })

})

router.get('/test_test', async (req,res)=>{

    // let result = await getSubscription('5c09134cfc9aadaac61dd01c')

    // let result = await get_all_users_current_trading_points()

    // let abc = '<div>Waleed Bhai ki frmaish!</div>'
    // res.write("<!DOCTYPE HTML><html><head>city</head><body>"+abc+"</body></html>")

    const db = await conn

    let collection_name = 'dynamic_packages'

    var insData = [
        {
            'name': 'Digie premium trading',
            'slug': 'digiePremiumTrading',
            'status': 0,
            'description': 'All features included',
            'user_id': 'global',
            'features': [
                {
                    'name': 'manualTrading',
                },
                {
                    'name': 'autoSelfTrading',
                },
                {
                    'name': 'autoTrading',
                },
                {
                    'name': 'atg',
                },
                {
                    'name': 'costAvg',
                },
                {
                    'name': 'lthPause',
                },
                {
                    'name': 'resumePause',
                },
            ],
            'created_date': new Date(),
            'updated_date': new Date(),
        },
        {
            'name': 'Auto self trading',
            'slug': 'autoSelfTrading',
            'status': 0,
            'description': 'Only auto self trading feature is enabled',
            'user_id': 'global',
            'features': [
                {
                    'name': 'manualTrading',
                },
            ],
            'created_date': new Date(),
            'updated_date': new Date(),
        }
    ]
    // var result = await db.collection(collection_name).insertMany(insData)

    var krakenCoins = ['ADABTC', 'BTCUSDT', 'DASHBTC', 'EOSBTC', 'ETCBTC', 'ETHBTC', 'LINKBTC', 'LTCUSDT', 'QTUMBTC', 'TRXBTC', 'XLMBTC', 'XMRBTC', 'XRPBTC', 'XRPUSDT']

    // var result = await db.collection('buy_orders_kraken').updateMany({ 'pause_parent_cancel':{'$exists':true}}, {'$set':{'pause_parent_cancel': new Date(), 'status':'canceled'}})

    var result = await db.collection('buy_orders_kraken').aggregate([
        // { '$match': { 'admin_id':'5c0915befc9aadaac61dd1b8', 'application_mode': 'live', 'parent_status': 'parent'} },
        { '$match': { 'application_mode': 'live', 'status': 'canceled', 'parent_status': 'parent'} },
        // { '$match': { 'application_mode': 'live', 'status': 'canceled', 'parent_status': 'parent'} },
        { '$sort': { 'created_date': -1 } },
        // { '$group': { '_id': { 'admin_id': '$admin_id', 'symbol': 'ADABTC', 'order_level': '$order_level' }, 'data': { '$push': '$$ROOT' }, 'sum': { '$sum': 1 } } },
        { '$group': { '_id': { 'admin_id': '$admin_id', 'symbol': '$symbol', 'order_level': '$order_level' }, 'data': { '$push': '$$ROOT' }, 'sum': { '$sum': 1 } } },
        { '$match': { 'sum': { '$gte': 1 } } },
        // { '$project': { '_id': 0, 'data': { '$slice': ["$data", 0, 1] } } },
        { '$project': { '_id': 0, 'data': { '$slice': ["$data", 0, { '$subtract': [{ '$size': "$data" }, { '$cond': { 'if': { '$gt': [{ '$size': "$data" }, 1] }, 'then': 1, 'else': 0 } }] }] } } },
        { '$unwind': '$data' },
        { '$project': { '_id': '$data._id' } },
        { '$group': { '_id': null, 'parent_ids': { '$push': '$_id' } } },
        // { '$count': 'total' }
    ], { allowDiskUse: true }).toArray()


    // console.log(result)

    console.log(result[0]['parent_ids'].length)

    // var result = await db.collection('buy_orders_kraken').updateMany({ '_id': { '$in': result[0]['parent_ids']}}, {'$set':{'revert_canceled_parent_shahzad': new Date(), 'status':'new'}})


    // let whereqqq = {
    //     'application_mode': 'live',
    //     'parent_status': 'parent',
    //     'pause_status': 'pause',
    // }
    // var result = await db.collection('buy_orders_kraken').updateMany(whereqqq, {'$set':{'pause_parent_cancel': new Date(), 'status':'canceled'}})

    res.send(result)
    // res.send()

})

async function get_all_users_current_trading_points(){

    let arr = []
    return new Promise(async resolve=>{

        const db = await conn

        let users = await db.collection('users').find({ 'application_mode': 'both'}).project({'_id':1}).toArray()

        let total_users = users.length
        if (total_users > 0){
            let obj = {}

            for (let i = 0; i < total_users; i++){

                let user_id = String(users[i]['_id'])
                obj['user_id'] = user_id

                var options = {
                    method: 'POST',
                    url: 'https://app.digiebot.com/admin/Api_calls/get_user_current_trading_points',
                    headers: {
                        'cache-control': 'no-cache',
                        'Connection': 'keep-alive',
                        'Accept-Encoding': 'gzip, deflate',
                        'Postman-Token': '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
                        'Cache-Control': 'no-cache',
                        'Accept': '*/*',
                        'User-Agent': 'PostmanRuntime/7.20.1',
                        'Content-Type': 'application/json'
                    },
                    json: {
                        'user_id': user_id,
                    },
                };
                request(options, function (error, response, body) {
                    if (error) {
                        arr.push(obj)
                    } else {
                        if (body.status) {
                            console.log(user_id ,' ------------ ', body.current_trading_points)
                            obj['current_trading_points'] = body.current_trading_points
                            arr.push(obj)
                        }else{
                            arr.push(obj)
                        }
                    }
                })

                break;

                //sleep 2 seconds before sending call next
                await new Promise(r => setTimeout(r, 2000));

            }

        }
        resolve(arr)
    })

}


router.get('/test_internal_function', async (req,res)=>{

    let coins = [
        'ADABTC',
        'BTCUSDT',
        'DASHBTC',
        'EOSBTC',
        'EOSUSDT',
        'ETCBTC',
        'ETHBTC',
        'LINKBTC',
        'LTCUSDT',
        'NEOBTC',
        'NEOUSDT',
        'QTUMBTC',
        'QTUMUSDT',
        'XEMBTC',
        'XLMBTC',
        'XMRBTC',
        'XRPUSDT',
        'XRPBTC',
    ]

    let coinsWorthArr = await findCoinsTradeWorth(20000, 0.091508, 456.14, coins, 'binance')

    console.log(coinsWorthArr)

})

async function getClientInfo(req){
    return new Promise(resolve=>{
        let data = Bowser.parse(req.headers['user-agent'])
        data['client_ip'] = req.headers['x-forwarded-for'];
        data['username'] = req.body.username.toLowerCase()
        resolve(data)
    })
}

async function sendTempBlockEmail(req){
    let clientInfo = await getClientInfo(req)
    var auth_token = req.headers.authorization;

    //Send block email call
    var options = {
        method: 'POST',
        url: 'https://app.digiebot.com/admin/Api_calls/send_temp_block_email',
        headers: {
            'cache-control': 'no-cache',
            'Connection': 'keep-alive',
            'Accept-Encoding': 'gzip, deflate',
            'Postman-Token': '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
            'Cache-Control': 'no-cache',
            'Accept': '*/*',
            'User-Agent': 'PostmanRuntime/7.20.1',
            'Content-Type': 'application/json',
            'Authorization': auth_token
        },
        json: clientInfo
    };
    request(options, function (error, response, body) { });

    return true
}

/****************** Google Authentication //Umer Abbas [5-4-20] *******************/
//generateGoogleAuthSecret
router.post('/generateGoogleAuthSecret', async function (req, res) {

    var auth_token = req.headers.authorization;

    var options = {
        method: 'POST',
        url: 'https://app.digiebot.com/admin/Api_calls/get_google_auth_secret',
        headers: {
            'cache-control': 'no-cache',
            'Connection': 'keep-alive',
            'Accept-Encoding': 'gzip, deflate',
            'Postman-Token': '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
            'Cache-Control': 'no-cache',
            'Accept': '*/*',
            'User-Agent': 'PostmanRuntime/7.20.1',
            'Content-Type': 'application/json',
            'Authorization': auth_token
        },
        json: {}
    };
    request(options, function (error, response, body) {
        if (error) {
            res.send({
                'status': false,
                'message': 'Something went wrong.'
            });
        } else {
            if (body.status) {
                res.send({
                    status: true,
                    data: { 'secret': body.data.secret },
                    message: 'Secret generated successfully.'
                });
            } else {
                res.send({
                    status: false,
                    message: 'Something went wrong.'
                });
            }
        }
    })


    // resp.status(200).send({
    //     status: true,
    //     data: { 'secret': googleAuthenticator.generateKey() },
    //     message: 'Secret generated successfully.'
    // });
}) //End generateGoogleAuthSecret

//addGoogleAuth
router.post('/addGoogleAuth', async function (req, resp) {
    let admin_id = req.body.admin_id
    let secret = req.body.secret
    let saved = await setGoogleAuthSecret(admin_id, secret);
    let user = await get_item_by_id('users', admin_id)
    if (saved) {
        let qr_code_uri = googleAuthenticator.generateTotpUri(secret, user['email_address'], "trading.digiebot.com", 'SHA1', 6, 60)
        // let qr_code_uri = await urlencode(qr_code_uri);
        resp.status(200).send({
            status: true,
            qr_code_uri: qr_code_uri,
            message: 'Google Auth Enabled.'
        });
    } else {
        resp.status(200).send({
            status: false,
            message: 'Something went wrong.'
        });
    }
}) //End addGoogleAuth

//enableGoogleAuth
router.post('/enableGoogleAuth', async function (req, resp) {
    let admin_id = req.body.admin_id
    let token = req.body.token
    // let verified = await verifyGoogleAuthToken(admin_id, token);



    var google_auth_validator = await getUserGoogleAuthValidation(admin_id, token)
    if(google_auth_validator){
        resp.status(200).send({
            status: true,
            message: 'Google Auth Enabled.'
        });
    } else{
        resp.status(200).send({
            status: false,
            message: 'Google Auth Failed.'
        });
    }

    // var options = {
    //     method: 'POST',
    //     url: 'https://app.digiebot.com/admin/Api_calls/very_google_auth_code',
    //     headers: {
    //         'cache-control': 'no-cache',
    //         'Connection': 'keep-alive',
    //         'Accept-Encoding': 'gzip, deflate',
    //         'Postman-Token': '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
    //         'Cache-Control': 'no-cache',
    //         'Accept': '*/*',
    //         'User-Agent': 'PostmanRuntime/7.20.1',
    //         'Content-Type': 'application/json'
    //     },
    //     json: {
    //         'user_id': admin_id,
    //         'code': token
    //     }
    // };
    // request(options, async function (error, response, body) {
    //     if (error) {
    //         resp.send({
    //             'status': false,
    //             'message': 'Something went wrong.'
    //         });
    //     } else {
    //         if (body.status) {
    //             let secret = await getGoogleAuthSecret(admin_id)
    //             let enable = setGoogleAuthSecret(admin_id, secret, true)
    //             resp.status(200).send({
    //                 status: true,
    //                 message: 'Google Auth Enabled.'
    //             });
    //         } else {

    //             var google_auth_validator = await getUserGoogleAuthValidation(admin_id, token)
    //             if(google_auth_validator){
    //                 resp.status(200).send({
    //                     status: true,
    //                     message: 'Google Auth Enabled.'
    //                 });
    //             } else{
    //                 resp.status(200).send({
    //                     status: false,
    //                     message: 'Google Auth Failed.'
    //                 });
    //             }
    //         }
    //     }
    // })


    // if (verified) {
    //     let secret = await getGoogleAuthSecret(admin_id)
    //     let enable = setGoogleAuthSecret(admin_id, secret, true)
    //     resp.status(200).send({
    //         status: true,
    //         message: 'Google Auth Enabled.'
    //     });
    // } else {
    //     resp.status(200).send({
    //         status: false,
    //         message: 'Google Auth Failed.'
    //     });
    // }
}) //End enableGoogleAuth

//disableGoogleAuth
router.post('/disableGoogleAuth', async function (req, resp) {
    let admin_id = req.body.admin_id
    let verified = await setGoogleAuthSecret(admin_id, '', false)

    let jsonResponse = {}
    if (verified) {
        jsonResponse['status'] = true,
            jsonResponse['message'] = 'Google Auth Enabled.'
    } else {
        jsonResponse['status'] = false,
            jsonResponse['message'] = 'Google Auth Failed.'
    }
    resp.status(200).send(jsonResponse)
}) //End disableGoogleAuth

//getGoogleAuthToken
router.post('/getGoogleAuthToken', async function (req, resp) {
    let admin_id = req.body.admin_id
    let token = await generateGoogleAuthToken(admin_id);
    if (typeof token != 'undefined' && token != '') {
        resp.status(200).send({
            status: true,
            data: { 'token': token },
            message: 'Token generated successfully.'
        });
    } else {
        resp.status(200).send({
            status: false,
            message: 'Something went wrong.'
        });
    }
}) //End getGoogleAuthToken

//verifyGoogleAuthToken
router.post('/verifyGoogleAuthToken', async function (req, resp) {
    let admin_id = req.body.admin_id
    let google_auth_token = req.body.google_auth_token
    let verfied = await verifyGoogleAuthToken(admin_id, google_auth_token);
    if (verfied) {
        resp.status(200).send({
            status: true,
            message: 'Token verfied successfully.'
        });
    } else {
        resp.status(200).send({
            status: false,
            message: 'Token failed.'
        });
    }
}) //End getGoogleAuthToken

//verifyGoogleAuthToken
async function verifyGoogleAuthToken(admin_id, token) {
    let googel_auth_secret = await getGoogleAuthSecret(admin_id);
    let status = await googleAuthenticator.verifyToken(googel_auth_secret, token);
    if (status != null) {
        return true;
    } else {
        return false;
    }
}//End verifyGoogleAuthToken

//generateGoogleAuthToken
async function generateGoogleAuthToken(admin_id) {
    let googel_auth_secret = await getGoogleAuthSecret(admin_id);
    if (typeof googel_auth_secret != 'undefined' && googel_auth_secret != '') {
        let token = await googleAuthenticator.generateToken(googel_auth_secret);
        return token;
    } else {
        return '';
    }
}//End generateGoogleAuthToken

//getGoogleAuthSecret
async function getGoogleAuthSecret(admin_id) {
    return new Promise((resolve) => {
        let where = {
            "_id": new ObjectID(admin_id)
        };
        conn.then((db) => {
            db.collection("users").find(where).toArray((err, result) => {
                if (err) {
                    console.log(err)
                } else {
                    if (result.length > 0) {
                        let code = (typeof result[0]['google_auth_code'] != 'undefined' ? result[0]['google_auth_code'] : '');
                        resolve(code)
                    } else {
                        resolve('')
                    }
                }
            })
        })
    })
}//End getGoogleAuthSecret

//setGoogleAuthSecret
async function setGoogleAuthSecret(admin_id, secret, enable = false) {
    return new Promise((resolve) => {
        let where = {
            "_id": new ObjectID(admin_id)
        };
        let set = {
            '$set': {
                'google_auth': ((typeof secret != 'undefined' && secret != '' && enable) ? 'yes' : 'no'),
                'google_auth_code': ((typeof secret != 'undefined' && secret != '') ? secret : '')
            }
        }
        conn.then((db) => {
            db.collection("users").updateOne(where, set, async (err, result) => {
                if (err) {
                    console.log(err)
                    resolve(false);
                } else {
                    resolve(true);
                }
            })
        })
    })
}//End setGoogleAuthSecret

/****************** End Google Authentication *******************/

//Function call for dashboard data
router.post('/listDashboardData', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist, 'USER EXIST')
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    //Function to get all user coins
    let userCoinsArr = await listUserCoins(req.payload.id);
    let exchange = req.body.exchange;
    let userCoin = (typeof req.body.userCoin == 'undefined') ? '' : req.body.coin;

    var coin = ((userCoinsArr.length == 0) || userCoin == '') ? 'TRXBTC' : (userCoin == '') ? userCoinsArr[0]['symbol'] : userCoin;
    //get current market price for any coin
    var currentMarketPriceArr = await listCurrentMarketPrice(coin, exchange);
    var currentMarketPrice = (currentMarketPriceArr.length == 0) ? 0 : currentMarketPriceArr[0]['price'];
    currentMarketPrice = parseFloat(currentMarketPrice);

    //get ask prices
    var askPricesPromise = listAskPrices(coin, currentMarketPrice);
    //get bid prices
    var bidPricesPromise = listBidPrices(coin, currentMarketPrice);
    //get marker history
    var marketHistoryPromise = listMarketHistory(coin);



    var currncy = coin.replace("BTC", '');

    var promisesResult = await Promise.all([askPricesPromise, bidPricesPromise, marketHistoryPromise]);

    var askPriceResp = promisesResult[0];
    var bidPriceResp = promisesResult[1];
    var historyResp = promisesResult[2];


    var marketHistoryArr = [];
    for (let row in historyResp) {
        let new_row = historyResp[row];
        new_row['price'] = parseFloat(historyResp[row].price).toFixed(8);
        new_row['quantity'] = parseFloat(historyResp[row].quantity).toFixed(2);
        //calculate volume  by multiplying price with qty
        new_row['volume'] = parseFloat(historyResp[row].price * historyResp[row].quantity).toFixed(8);
        marketHistoryArr.push(new_row);
    }


    var askPriceArr = [];
    for (let row in askPriceResp) {
        let new_row = {};
        new_row['price'] = parseFloat(askPriceResp[row].price).toFixed(8);
        new_row['quantity'] = parseFloat(askPriceResp[row].quantity).toFixed(2);
        //calculate volume  by multiplying price with qty
        new_row['volume'] = parseFloat(askPriceResp[row].price * askPriceResp[row].quantity).toFixed(8);
        askPriceArr.push(new_row);
    }

    var bidPriceArr = [];
    for (let row in bidPriceResp) {
        let new_row = {};
        new_row['price'] = parseFloat(bidPriceResp[row].price).toFixed(8);
        new_row['quantity'] = parseFloat(bidPriceResp[row].quantity).toFixed(2);
        //calculate volume  by multiplying price with qty
        new_row['volume'] = parseFloat(bidPriceResp[row].price * bidPriceResp[row].quantity).toFixed(8);
        bidPriceArr.push(new_row);
    }



    var responseReslt = {};
    responseReslt['askPricesArr'] = askPriceArr;
    responseReslt['bidPricesArr'] = bidPriceArr;
    responseReslt['marketHistoryArr'] = marketHistoryArr;
    //currency mean which coin currently selected
    responseReslt['currncy'] = currncy;
    responseReslt['currentMarketPrice'] = currentMarketPrice;
    resp.status(200).send({
        message: responseReslt
    });

}) //End of listDashboardData
//When adding manual order first time when page load call this function for get user coins so we can select coin and create order against this coin
router.post('/listManualOrderComponent', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist, 'USER EXIST')
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    //Get coins on the bases of user
    var listUserCoinsArr = await listUserCoins(req.body._id);
    resp.status(200).send({
        message: listUserCoinsArr
    });
}) //End of listManualOrderComponent

//Api post call for getting user coins directly
router.post('/listUserCoinsApi', async (req, resp) => {

    var urserCoinsArr = await listUserCoins(req.body.admin_id)

    resp.status(200).send({
        message: urserCoinsArr
    });
}) //End of listUserCoinsApi
//function for getting user coins
async function listUserCoins(userId) {
    return new Promise((resolve) => {
        let where = {};
        where.user_id = userId;
        // where.symbol = {
        //     '$nin': ['', null, 'BTC', 'BNBBTC', 'NCASHBTC', 'POEBTC']
        // };
        where.symbol = {
            '$nin': ['', null, 'BTC', 'NCASHBTC', 'POEBTC']
        };
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

//function for getting user coins
async function getUserCoins(userId, exchange) {
    return new Promise((resolve) => {
        let where = {};
        where.user_id = userId;
        // where.symbol = {
        //     '$nin': ['', null, 'BTC', 'BNBBTC', 'NCASHBTC', 'POEBTC']
        // };
        where.symbol = {
            '$nin': ['', null, 'BTC', 'NCASHBTC', 'POEBTC']
        };
        conn.then(async (db) => {

            let coins_collection = (exchange == 'binance' ? 'coins' : 'coins_' + exchange)

            db.collection(coins_collection).find(where).toArray(async (err, data) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(data)
                }
            })
        })
    })
} //End of getUserCoins

//Depricated //Umer Abbas [25-11-19] => please use the API calls provided by waqar (Bam)[http://35.171.172.15:3001/api/listCurrentmarketPrice],params['coin', 'exchange'], (Binance)[http://35.171.172.15:3000/api/listCurrentmarketPrice], params['coin', 'exchange']
router.post('/listCurrentmarketPrice', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist, 'USER EXIST')
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    // let myIp = req.headers['x-forwarded-for']
    // console.log('============================================================== Request Ip ::: ', myIp)

    let exchange = req.body.exchange;
    var urserCoinsArr = await listCurrentMarketPrice(req.body.coin, exchange)
    resp.status(200).send({
        message: urserCoinsArr
    });
}) //End of listCurrentmarketPrice

//function for getting current market price
function listCurrentMarketPrice(coin, exchange) {
    return new Promise((resolve) => {
        let where = {};
        where.coin = coin;
        conn.then((db) => {
            let collectionName = (exchange == 'binance') ? 'market_prices' : 'market_prices_' + exchange;
            db.collection(collectionName).find(where).sort({
                "created_date": -1
            }).limit(1).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result)
                }
            })
        })
    })
} //End of listCurrentMarketPrice
//get Ask prices for Dash-board
function listAskPrices(coin, currentMarketPrice) {
    return new Promise((resolve) => {
        var pipeline = [{
                $project: {
                    price: 1,
                    quantity: 1,
                    type: 1,
                    coin: 1,
                    created_date: 1
                }
            },
            {
                $match: {
                    coin: coin,
                    type: 'ask',
                    price: {
                        '$gte': currentMarketPrice
                    }
                }
            },

            {
                $sort: {
                    'created_date': -1
                }
            },

            {
                $group: {
                    _id: {
                        price: '$price'
                    },
                    quantity: {
                        '$first': '$quantity'
                    },
                    type: {
                        '$first': '$type'
                    },
                    coin: {
                        '$first': '$coin'
                    },
                    created_date: {
                        '$first': '$created_date'
                    },
                    price: {
                        '$first': '$price'
                    },
                }
            },
            {
                $sort: {
                    'price': 1
                }
            },
            {
                '$limit': 20
            }

        ];
        conn.then((db) => {
            db.collection('market_depth').aggregate(pipeline).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result)
                }
            })
        })
    })
} //End of listAskPrices
//get Bid for Dash-board
function listBidPrices(coin, currentMarketPrice) {
    return new Promise((resolve) => {
        var pipeline = [{
                $project: {
                    price: 1,
                    quantity: 1,
                    type: 1,
                    coin: 1,
                    created_date: 1
                }
            },
            {
                $match: {
                    coin: coin,
                    type: 'bid',
                    price: {
                        '$lte': currentMarketPrice
                    }
                }
            },

            {
                $sort: {
                    'created_date': -1
                }
            },

            {
                $group: {
                    _id: {
                        price: '$price'
                    },
                    quantity: {
                        '$first': '$quantity'
                    },
                    type: {
                        '$first': '$type'
                    },
                    coin: {
                        '$first': '$coin'
                    },
                    created_date: {
                        '$first': '$created_date'
                    },
                    price: {
                        '$first': '$price'
                    },
                }
            },
            {
                $sort: {
                    'price': -1
                }
            },
            {
                '$limit': 20
            }

        ];
        conn.then((db) => {
            db.collection('market_depth').aggregate(pipeline).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result)
                }
            })
        })
    })
} //End of listBidPrices
//get market History for Dash-board
function listMarketHistory(coin) {
    return new Promise((resolve) => {
        conn.then((db) => {
            var where = {};
            where['coin'] = coin;
            db.collection('market_trades').find(where).limit(20).sort({
                _id: -1
            }).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of listMarketHistory

//post call for getting manual order detail
router.post('/listManualOrderDetail', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist, 'USER EXIST')
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    let exchange = req.body.exchange;
    var urserCoinsPromise = listUserCoins(req.body._id);

    if (exchange == 'bam') {
        var urserCoinsPromise = await listBamUserCoins(req.body._id);
    } else {
        var urserCoinsPromise = await listUserCoins(req.body._id);
    }

    //Get current market price for selected coin
    var currentMarketPricePromise = await listCurrentMarketPrice(req.body.coin, exchange);
    //get global coin on the bases of exchange in case of coin base pro global coin is BTCUSD
    let globalCoin = (exchange == 'coinbasepro') ? 'BTCUSD' : 'BTCUSDT';
    //get market price for global coin
    var BTCUSDTPRICEPromise = listCurrentMarketPrice(globalCoin, exchange);
    //get market min notation for a coin minnotation mean minimum qty required for an order buy or sell and also detail for hoh many fraction point allow for an order
    var marketMinNotationPromise = marketMinNotation(req.body.coin);
    var promisesResult = await Promise.all([marketMinNotationPromise, BTCUSDTPRICEPromise]);

    var responseReslt = {};
    responseReslt['userCoinsArr'] = urserCoinsPromise;
    responseReslt['CurrentMarkerPriceArr'] = currentMarketPricePromise;
    responseReslt['marketMinNotation'] = promisesResult[0];
    responseReslt['BTCUSDTPRICE'] = promisesResult[1];
    resp.status(200).send({
        message: responseReslt
    });

}) //End of listManualOrderDetail
//post call for getting auto order detail
router.post('/listAutoOrderDetail', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist, 'USER EXIST')
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    let exchange = req.body.exchange;
    //get user coin on the base of exchange
    if (exchange == 'bam') {
        var urserCoinsPromise = await listBamUserCoins(req.body._id);
    } else {
        var urserCoinsPromise = await listUserCoins(req.body._id);
    }

    //get global coin on the bases of exchange in case of coin base pro global coin is BTCUSD
    let globalCoin = (exchange == 'coinbasepro') ? 'BTCUSD' : 'BTCUSDT';
    var BTCUSDTPRICEPromise = await listCurrentMarketPrice(globalCoin);
    //get market min notation for a coin minnotation mean minimum qty required for an order buy or sell and also detail for hoh many fraction point allow for an order
    var marketMinNotationResp = await marketMinNotation(urserCoinsPromise[0].symbol);
    //Get current market price for selected coin
    var currentMarketPriceArr = await listCurrentMarketPrice(urserCoinsPromise[0].symbol);
    var responseReslt = {};
    responseReslt['userCoinsArr'] = urserCoinsPromise;
    responseReslt['BTCUSDTPRICE'] = BTCUSDTPRICEPromise;
    responseReslt['CurrentMarkerPriceArr'] = currentMarketPriceArr
    responseReslt['marketMinNotation'] = marketMinNotationResp
    var currentMarketPriceArr = await listCurrentMarketPrice(urserCoinsPromise[0].symbol);
    responseReslt['selectedCoin'] = urserCoinsPromise[0].symbol;
    resp.status(200).send({
        message: responseReslt
    });
}) //End of listAutoOrderDetail


router.post('/listmarketPriceMinNotation', auth_token.required, async (req, resp) => {



    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist, 'USER EXIST')
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    //get market min notation for a coin minnotation mean minimum qty required for an order buy or sell and also detail for hoh many fraction point allow for an order
    // var marketMinNotationPromise = marketMinNotation(req.body.coin);

    let coin = req.body.coin;
    let exchange = req.body.exchange;

    var marketMinNotationPromise = marketMinNotation_with_step_size(coin, exchange);
    var currentMarketPricePromise = listCurrentMarketPrice(coin, exchange);

    var promisesResult = await Promise.all([marketMinNotationPromise, currentMarketPricePromise]);
    var responseReslt = {};
    responseReslt['marketMinNotation'] = promisesResult[0].min_notation;
    responseReslt['marketMinNotationStepSize'] = promisesResult[0].step_size;
    responseReslt['currentmarketPrice'] = promisesResult[1];
    resp.status(200).send({
        message: responseReslt
    });
}) //End of listmarketPriceMinNotation

router.post('/getPricesArr', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist, 'USER EXIST')
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let coinArr = req.body.coinArr;
    let exchange = req.body.exchange;

    let result = await getPricesArr(exchange, coinArr)

    if (result){
        resp.status(200).send({
            status: true,
            data: result
        });
    }else{
        resp.status(200).send({
            status: false
        });
    }

}) //End of getPricesArr

async function getPricesArr(exchange, coinArr=[]){
    return new Promise(async resolve => {

        const db = await conn

        if (coinArr.length == 0) {
            let coins_collection = (exchange == 'binance') ? 'coins' : 'coins_' + exchange;
            let where = {
                'user_id': 'global',
            }
            if (exchange == 'binance') {
                where['exchange_type'] = 'binance';
            }

            coinArr = await db.collection(coins_collection).find(where).toArray();

            if (coinArr.length > 0) {
                coinArr = coinArr.map(item => item.symbol);
            }
            coinArr.push('BTCUSDT')
        }


        console.log('coinArr', coinArr)

        let result = await listmarketPriceMinNotationCoinArr({ '$in': coinArr }, exchange)

        if (result){
            resolve(result)
        }else{
            resolve(false)
        }
    })
}

async function listmarketPriceMinNotation(coin, exchange){
    //get market min notation for a coin minnotation mean minimum qty required for an order buy or sell and also detail for hoh many fraction point allow for an order
    // var marketMinNotationPromise = marketMinNotation(req.body.coin);
    var marketMinNotationPromise = marketMinNotation_with_step_size(coin, exchange);
    var currentMarketPricePromise = listCurrentMarketPrice(coin, exchange);

    var promisesResult = await Promise.all([marketMinNotationPromise, currentMarketPricePromise]);
    var responseReslt = {};
    responseReslt['marketMinNotation'] = promisesResult[0].min_notation;
    responseReslt['marketMinNotationStepSize'] = promisesResult[0].step_size;
    responseReslt['currentmarketPrice'] = promisesResult[1];
    return responseReslt
} //End of listmarketPriceMinNotation

//post call for creating manual order
router.post('/createManualOrder', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist, 'USER EXIST')
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    conn.then(async (db) => {
        let orders = req.body.orderArr;
        let tempOrder = req.body.tempOrderArr;
        let orderId = req.body.orderId;
        let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
        var price = parseFloat(orders['price']);
        let exchange = orders['exchange'];

        if (typeof orders['buyRightAway'] != 'undefined' && orders['buyRightAway'] == 'yes'){
            let tempSymbol = orders['symbol']
            var pricesObj = await get_current_market_prices(exchange, tempSymbol)
            price = pricesObj[tempSymbol]
        }

        orders['price'] = price;
        orders['created_date'] = new Date();
        orders['modified_date'] = new Date();

        //buy trail check
        if (typeof orders['trail_check'] == 'undefined' || orders['trail_check'] != 'yes' || typeof orders['trail_interval'] == 'undefined' || orders['trail_interval'] == '' || typeof orders['buy_trail_percentage'] == 'undefined' || orders['buy_trail_percentage'] == '' || typeof orders['buy_trail_price'] == 'undefined' || orders['buy_trail_price'] == '') {

            orders['trail_check'] = ''
            orders['trail_interval'] = ''
            orders['buy_trail_percentage'] = ''
            orders['buy_trail_price'] = ''
        } else {
            orders['buy_trail_price'] = 0;
            orders['trail_interval'] = parseFloat(orders['trail_interval'])
        }

        if (typeof orders['auto_sell'] == 'undefined' || orders['auto_sell'] == 'no') {
            orders['sell_price'] = ''
            orders['profit_price'] = ''
        }

        if (typeof orders['auto_sell'] != 'undefined' && orders['auto_sell'] == 'yes') {
            orders['is_sell_order'] = 'yes'
        }

        //set profit percentage if sell price is fixed
        if (orders['profit_type'] == 'fixed_price') {
            let sell_profit_percent = ((parseFloat(orders['sell_price']) - parseFloat(orders['price'])) / parseFloat(orders['price'])) * 100
            orders['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
        }

        //set sell profit percentage
        if (orders['profit_type'] == 'percentage' && typeof tempOrder['profit_percent'] != 'undefined') {
            let sell_profit_percent = parseFloat(parseFloat(tempOrder['profit_percent']).toFixed(1))
            orders['sell_profit_percent'] = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
        }

        //set iniatial_trail_stop
        if (typeof tempOrder['iniatial_trail_stop'] != 'undefined' && !isNaN(parseFloat(tempOrder['iniatial_trail_stop']))) {
            orders['iniatial_trail_stop'] = tempOrder['iniatial_trail_stop']
        } else {
            orders['iniatial_trail_stop'] = ''
        }

        if (typeof tempOrder['stop_loss'] != 'undefined' && tempOrder['stop_loss'] == 'yes' && !isNaN(parseFloat(tempOrder['loss_percentage']))) {
            orders['stop_loss'] = 'yes'
            orders['loss_percentage'] = parseFloat(parseFloat(tempOrder['loss_percentage']).toFixed(1))
        } else {
            orders['stop_loss'] = 'no'
            orders['loss_percentage'] = ''
        }

        //set lth profit
        if (typeof orders['lth_functionality'] != 'undefined' && orders['lth_functionality'] == 'yes' && !isNaN(parseFloat(orders['lth_profit']))) {
            orders['lth_functionality'] = 'yes'
            orders['lth_profit'] = parseFloat(parseFloat(orders['lth_profit']).toFixed(1))
        } else {
            orders['lth_functionality'] = 'no'
            orders['lth_profit'] = ''
        }

        //cancel_hour
        if (typeof orders['cancel_hour'] != 'undefined' && orders['cancel_hour'] != '' && orders['cancel_hour'] > 0) {
            let currTime = new Date()
            orders['cancel_hour_time'] = new Date(currTime.setTime(currTime.getTime() + (orders['cancel_hour'] * 60 * 60 * 1000)))
        }else{
            delete orders['cancel_hour']
        }

        //new fields for hassan
        if (typeof orders['buyRightAway'] != 'undefined' && orders['buyRightAway'] == 'yes') {
            orders['cancel_hour_time'] = new Date((new Date).getTime() + 10 * 60000)
        }

        if (typeof orders['buy_trail_check_temp'] != 'undefined' && orders['buy_trail_check_temp'] == 'yes') {
            orders['buy_trail_check'] = 'yes'
            orders['buy_trail_interval'] = parseFloat(orders['buy_trail_interval_temp'])
            // orders['buy_trail_price'] = 0
        }else{
            orders['buy_trail_check'] = ''
            orders['buy_trail_interval'] = ''
            orders['buy_trail_price'] = 0
        }
        if (typeof orders['sell_trail_check_temp'] != 'undefined' && orders['sell_trail_check_temp'] == 'yes') {
            orders['sell_trail_check'] = 'yes'
            orders['sell_trail_interval'] = parseFloat(orders['sell_trail_interval_temp'])
            // orders['sell_trail_price'] = 0
        }else{
            orders['sell_trail_check'] = ''
            orders['sell_trail_interval'] = ''
            orders['sell_trail_price'] = 0
        }

        //remove temp keys
        delete orders['buy_trail_check_temp']
        delete orders['buy_trail_interval_temp']
        delete orders['buy_trail_price_temp']
        delete orders['sell_trail_check_temp']
        delete orders['sell_trail_interval_temp']
        delete orders['sell_trail_price_temp']


        //add these fields in kraken order array
        if(exchange == 'kraken'){
            orders['defined_sell_percentage'] = typeof orders['sell_profit_percent'] != 'undefined' ? orders['sell_profit_percent'] : ''
            orders['custom_stop_loss_percentage'] = typeof orders['loss_percentage'] != 'undefined' ? orders['loss_percentage'] : ''
        }

        //collection on the base of exchange
        var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
        //create buy order
        db.collection(collectionName).insertOne(orders, (err, result) => {
            if (err) {
                resp.status(403).send({
                    message: err
                });
            } else {
                //:::::::::::::::::::::::::::::::::
                var buyOrderId = result.insertedId
                var log_msg = "Buy Order was Created " + interfaceType + " at Price " + parseFloat(price).toFixed(8);
                let profit_percent = req.body.tempOrderArr.profit_percent;

                if (req.body.orderArr.auto_sell == 'yes' && profit_percent != '') {
                    log_msg += ' with auto sell ' + profit_percent + '%';
                }
                if (req.body.orderArr.buy_on_buy_hit == 'yes' && req.body.orderArr.buy_on_buy_hit != '' && typeof req.body.orderArr.buy_on_buy_hit != 'undefined') {
                  log_msg += ', Buy on Digie Signal was "Enabled" ';
                }
                if (req.body.orderArr.sell_on_sell_hit == 'yes' && req.body.orderArr.sell_on_sell_hit != '' && typeof req.body.orderArr.sell_on_sell_hit != 'undefined') {
                  log_msg += ', Sell on Digie Signal was "Enabled" ';
                }
                if (req.body.orderArr.buy_trail_check == 'yes' && req.body.orderArr.buy_trail_check != '' && typeof req.body.orderArr.buy_trail_check != 'undefined') {
                  log_msg += ', Trail Buy was Enabled and Buy Trail Perc was : '+ req.body.orderArr.buy_trail_interval;
                }
                if (req.body.orderArr.sell_trail_check == 'yes' && req.body.orderArr.sell_trail_check != '' && typeof req.body.orderArr.sell_trail_check != 'undefined') {
                  log_msg += ', Trail Sell was Enabled and Sell Trail Perc was : '+ req.body.orderArr.sell_trail_interval;
                }
                if (req.body.orderArr.stop_loss == 'yes' && req.body.orderArr.stop_loss != '' && typeof req.body.orderArr.stop_loss != 'undefined') {
                  log_msg += ', Stop Loss was Enabled and Stop Loss Perc was : '+ req.body.orderArr.loss_percentage;
                }
                if (req.body.orderArr.lth_functionality == 'yes' && req.body.orderArr.lth_functionality != '' && typeof req.body.orderArr.lth_functionality != 'undefined') {
                  log_msg += ', LTH was Enabled and LTH Perc was : '+ req.body.orderArr.lth_profit;
                }
                let show_hide_log = 'yes';
                let type = 'Order_created';
                // var promiseLog = recordOrderLog(buyOrderId, log_msg, type, show_hide_log, exchange)
                let order_mode = orders.application_mode;
                var order_created_date = new Date();
                var promiseLog = create_orders_history_log(buyOrderId, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                promiseLog.then((callback) => {})

                //Send Notification
                send_notification(orders.admin_id, 'news_alerts', 'medium', log_msg, buyOrderId, exchange, orders.symbol, orders.application_mode, '')

                //check of auto sell is yes then create sell temp order
                if (req.body.orderArr.auto_sell == 'yes') {

                    //sell trail check
                    if (typeof tempOrder['trail_check'] == 'undefined' || tempOrder['trail_check'] != 'yes' || typeof tempOrder['trail_interval'] == 'undefined' || tempOrder['trail_interval'] == '' || typeof tempOrder['sell_trail_percentage'] == 'undefined' || tempOrder['sell_trail_percentage'] == '') {

                        tempOrder['trail_check'] = ''
                        tempOrder['trail_interval'] = ''
                        tempOrder['sell_trail_percentage'] = ''
                        tempOrder['sell_trail_price'] = ''
                    } else {
                        tempOrder['trail_interval'] = parseFloat(tempOrder['trail_interval'])
                        tempOrder['sell_trail_price'] = 0
                    }

                    if (typeof orders['auto_sell'] == 'undefined' || orders['auto_sell'] == 'no') {
                        tempOrder['sell_price'] = ''
                        tempOrder['profit_price'] = ''
                    }

                    if (typeof orders['auto_sell'] != 'undefined' && orders['auto_sell'] == 'yes') {
                        tempOrder['is_sell_order'] = 'yes'
                    }

                    // //set profit percentage if sell price is fixed
                    // if (tempOrder['profit_type'] == 'fixed_price') {
                    //     let sell_profit_percent = ((parseFloat(tempOrder['sell_price']) - parseFloat(tempOrder['price'])) / parseFloat(tempOrder['price'])) * 100
                    //     tempOrder['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
                    //     tempOrder['profit_percent'] = tempOrder['sell_profit_percent']
                    // }

                    //set profit percentage if sell price is fixed
                    if (orders['profit_type'] == 'fixed_price') {
                        let sell_profit_percent = ((parseFloat(orders['sell_price']) - parseFloat(orders['price'])) / parseFloat(orders['price'])) * 100
                        tempOrder['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
                        tempOrder['profit_percent'] = tempOrder['sell_profit_percent']
                    }

                    //set sell profit percentage
                    if (orders['profit_type'] == 'percentage' && typeof tempOrder['profit_percent'] != 'undefined') {
                        let sell_profit_percent = parseFloat(parseFloat(tempOrder['profit_percent']).toFixed(1))
                        tempOrder['sell_profit_percent'] = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
                    }

                    //set stop loss
                    if (typeof tempOrder['stop_loss'] != 'undefined' && tempOrder['stop_loss'] == 'yes' && !isNaN(parseFloat(tempOrder['loss_percentage']))) {
                        tempOrder['stop_loss'] = 'yes'
                        tempOrder['loss_percentage'] = parseFloat(parseFloat(tempOrder['loss_percentage']).toFixed(1))
                    } else {
                        tempOrder['stop_loss'] = 'no'
                        tempOrder['loss_percentage'] = ''
                    }

                    //set lth profit
                    if (typeof tempOrder['lth_functionality'] != 'undefined' && tempOrder['lth_functionality'] == 'yes' && !isNaN(parseFloat(tempOrder['lth_profit']))) {
                        tempOrder['lth_functionality'] = 'yes'
                        tempOrder['lth_profit'] = parseFloat(parseFloat(tempOrder['lth_profit']).toFixed(1))
                    } else {
                        tempOrder['lth_functionality'] = 'no'
                        tempOrder['lth_profit'] = ''
                    }

                    //set iniatial_trail_stop
                    if (typeof tempOrder['iniatial_trail_stop'] != 'undefined' && !isNaN(parseFloat(tempOrder['iniatial_trail_stop']))) {
                        tempOrder['iniatial_trail_stop'] = tempOrder['iniatial_trail_stop']
                    } else {
                        tempOrder['iniatial_trail_stop'] = ''
                    }

                    tempOrder['created_date'] = new Date();
                    tempOrder['buy_order_id'] = buyOrderId;

                    //add these fields in kraken order array
                    if (exchange == 'kraken') {
                        tempOrder['defined_sell_percentage'] = typeof tempOrder['sell_profit_percent'] != 'undefined' ? tempOrder['sell_profit_percent'] : ''
                        tempOrder['custom_stop_loss_percentage'] = typeof tempOrder['loss_percentage'] != 'undefined' ? tempOrder['loss_percentage'] : ''
                    }

                    //Temp sell order collection on the base of exchange
                    var tempCollection = (exchange == 'binance') ? 'temp_sell_orders' : 'temp_sell_orders_' + exchange;

                    db.collection(tempCollection).insertOne(tempOrder, (err, result) => {
                        if (err) {
                            resp.status(403).send({
                                message: 'some thing went wrong while Creating order'
                            });
                        } else {
                            resp.status(200).send({
                                message: 'Order successfully created',
                                data: buyOrderId
                            });
                        }
                    })
                } else {
                    resp.status(200).send({
                        message: 'Order successfully created',
                        data: buyOrderId
                    });
                }
                //:::::::::::::::::::::::::::::::::
            }
        })
    })
}) //End of createManualOrder






//post call from chart for creating manual order
router.post('/createManualOrderByChart', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }


    conn.then((db) => {
        let orders = req.body.orderArr;

        console.log(orders);
        console.log('orders');
        let orderId = req.body.orderId;
        var price = orders['price'];
        let exchange = orders['exchange'];


        orders['created_date'] = new Date();
        orders['modified_date'] = new Date();
        var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
        //create buy-orders
        db.collection(collectionName).insertOne(orders, (err, result) => {
            if (err) {
                resp.status(403).send({
                    message: err
                });
            } else {
                //:::::::::::::::::::::::::::::::::
                var buyOrderId = result.insertedId
                var log_msg = "Buy Order was Created at Price " + parseFloat(price).toFixed(8);
                let profit_percent = req.body.tempOrderArr.profit_percent;

                if (req.body.orderArr.auto_sell == 'yes' && profit_percent != '') {
                    log_msg += ' with auto sell ' + profit_percent + '%';
                }

                log_msg += 'With Chart';

                let show_hide_log = 'yes';
                let type = 'Order_created';
                // var promiseLog = recordOrderLog(buyOrderId, log_msg, type, show_hide_log, exchange)
                let order_mode = orders.application_mode;
                var order_created_date = new Date();
                var promiseLog = create_orders_history_log(buyOrderId, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                promiseLog.then((callback) => {})
                //if auto sell is yes the create sell order
                if (req.body.orderArr.auto_sell == 'yes') {

                    let tempOrder = req.body.tempOrderArr;
                    tempOrder['created_date'] = new Date();
                    tempOrder['buy_order_id'] = buyOrderId;
                    // By 10-12-2019
                    //tempOrder['profit_price'] = parseFloat(tempOrder['profit_price']);
                    //tempOrder['profit_percent'] = parseFloat(tempOrder['profit_percent']);
                    // By 10-12-2019

                    var tempCollection = (exchange == 'binance') ? 'temp_sell_orders' : 'temp_sell_orders_' + exchange;

                    console.log('tempOrder');
                    console.log(tempOrder);


                    //create sell order
                    db.collection(tempCollection).insertOne(tempOrder, (err, result) => {
                        if (err) {
                            resp.status(403).send({
                                message: 'some thing went wrong while Creating order'
                            });
                        } else {
                            resp.status(200).send({
                                message: 'Order successfully created with auto sell'
                            });
                        }
                    })
                } else {
                    resp.status(200).send({
                        message: 'Order created with**'
                    });
                }
                //:::::::::::::::::::::::::::::::::
            }
        })
    })
}) //End of createManualOrderByChart



//post call from set for sell component the function set buy manual order for sell
router.post('/makeManualOrderSetForSell', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then((db) => {
        let orders = req.body.orderArr;
        let orderId = req.body.orderId;
        let exchange = orders['exchange'];
        orders['created_date'] = new Date();
        orders['modified_date'] = new Date();

        var collectionName = (exchange == 'binance' || exchange == '') ? 'orders' : 'orders_' + exchange;
        var where = {};
        where['_id'] = (orderId == '') ? '' : new ObjectID(orderId);

        var set = {};
        set['$set'] = orders;
        var upsert = {
            upsert: true
        }
        //Update sell order collection
        db.collection(collectionName).updateOne(where, set, upsert, async (err, result) => {
            if (err) {
                resp.status(403).send({
                    message: 'some thing went wrong'
                });
            } else {
                let sellOrderId = (result.upsertedId == null) ? orderId : result.upsertedId._id;
                let updArr = {}
                updArr['modified_date'] = new Date();
                updArr['sell_order_id'] = new ObjectID(sellOrderId);
                updArr['is_sell_order'] = 'yes';
                updArr['auto_sell'] = 'yes';
                //update buy_orders collection
                var collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                var where = {};
                where['_id'] = new ObjectID(orderId);
                var updPrmise = updateOne(where, updArr, collection);
                updPrmise.then((callback) => {})
                var log_msg = "Sell Order was Created";
                let show_hide_log = 'yes';
                let type = 'Order Ready For Buy';
                // var promiseLog = recordOrderLog(orderId, log_msg, type, show_hide_log, exchange)
                var getBuyOrder = await listOrderById(orderId, exchange);
                var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                var promiseLog = create_orders_history_log(orderId, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                promiseLog.then((callback) => {

                })
                resp.status(200).send({
                    message: 'Order successfully Ready for buy'
                });

            } //End of success result
        })
    })
}) //End of makeManualOrderSetForSell

//Post call from angular component for creating parent order
router.post('/createAutoOrder', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');

    let order = req.body.orderArr;
    order['admin_id'] = req.payload.id;
    order['interface'] = interfaceType

    order['created_date'] = new Date()
    order['modified_date'] = new Date()

    order['randomize_sort'] = Math.floor(Math.random() * (1000 - 0 + 1)) + 0;

    if (typeof order['admin_id'] != 'undefined' && digie_admin_ids.includes(order['admin_id'])){
        order['pick_parent'] = 'yes';
    }else{
        let  user_remaining_usd_limit = await getUserRemainingLimit(order['admin_id'], order['exchange'])
        let user_remaining_limit = 0
        let splitArr = order['symbol']
        if (splitArr[1] == '') {
            user_remaining_limit = user_remaining_usd_limit['remaining_usdt_usd_limit']
        } else {
            user_remaining_limit = user_remaining_usd_limit['remaining_btc_usd_limit']
        }
        order['pick_parent'] = (user_remaining_limit > 0 ? 'yes' : 'no')
    }
    let  getUsersHighLowRangevalues = await getUsersHighLowRangevaluesMethod(order['admin_id'],order['symbol'],order['exchange'])
    // console.log(getUsersHighLowRangevalues)
    if(getUsersHighLowRangevalues.length > 0)
    {
        // console.log('first Check Works')
        if(typeof getUsersHighLowRangevalues[0]['highPrice_range']!="undefined" && typeof getUsersHighLowRangevalues[0]['lowPrice_range']!="undefined")
        {
            // console.log('Working, weell',getUsersHighLowRangevalues[0]['highPrice_range'])
            order['highPrice_range'] = getUsersHighLowRangevalues[0]['highPrice_range']
            order['lowPrice_range'] = getUsersHighLowRangevalues[0]['lowPrice_range']
        }
    }
    let orderResp = await createAutoOrder(order);
    resp.status(200).send({
        message: orderResp
    });
}) //End of createAutoOrder

//post call from angular to edit triggers orders
router.post('/editAutoOrder', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
      resp.status(401).send({
          message: 'User Not exist'
      });
      return false;
    }

    let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
    let order = req.body.orderArr;

    // console.log(order)
    order['modified_date'] = new Date()
    let orderId = order['orderId'];
    var exchange = order['exchange'];
    var lth_profit = order['lth_profit'];
    var defined_sell_percentage = order['defined_sell_percentage'];
    //get order detail which you want to update
    var buyOrderArr = await listOrderById(orderId, exchange);

    let isParent = false
    let unsetParentFields = []
    if (buyOrderArr.length > 0 && typeof buyOrderArr[0]['parent_status'] != 'undefined' && buyOrderArr[0]['parent_status'] == 'parent') {
        isParent = true
        if (order['cost_avg'] != 'undefined' && order['cost_avg'] == ''){
            let db1 = await conn
            let tempCol1 = exchange == 'binance' ? 'buy_orders' : 'buy_orders_'+ exchange
            await db1.collection(tempCol1).updateOne({ '_id': buyOrderArr[0]['_id'] }, { '$unset': { 'cost_avg': '', 'is_sell_order': '', 'is_lth_order':''}})
        }
    }

    if (isParent && buyOrderArr[0]['cost_avg'] != 'undefined' && buyOrderArr[0]['cost_avg'] == '') {

        // await unsetCostAvgParent(orderId, exchange)
        delete buyOrderArr[0]['cost_avg']
        delete order['cost_avg']

    } else if (!isParent && buyOrderArr.length > 0 && typeof buyOrderArr[0]['cost_avg'] != 'undefined' && buyOrderArr[0]['avg_orders_ids'] != 'undefined'){
        // Commented By Huzaifa Comming From Shahzad
        // await updateCostAvgChildOrders(orderId, order, exchange)
    }


    // Check Added by Huzaifa
    if(typeof buyOrderArr[0]['cavg_parent'] != 'undefined' && buyOrderArr[0]['cavg_parent'] == 'yes' && typeof buyOrderArr[0]['move_to_cost_avg'] != 'undefined' && buyOrderArr[0]['move_to_cost_avg'] == 'yes'){
      let db1 = await conn
      let tempCol1 = exchange == 'binance' ? 'buy_orders' : 'buy_orders_'+ exchange


      console.log(typeof buyOrderArr[0]['_id'])
      await db1.collection(tempCol1).updateOne({ '_id': buyOrderArr[0]['_id'] }, { '$set': { 'last_three_ids': '', 'quantity_three': '', 'avg_price_three_upd':'', 'avg_sell_price_three':'', 'avg_sell_price':'', 'avg_price_all_upd':'', 'all_buy_ids':'', 'quantity_all':'' }})
    }//End here


    var ttt_is_custom_stop_loss_possitive = typeof order['stop_loss_type'] != 'undefined' && order['stop_loss_type'] == 'positive' ? true : false

    var purchased_price = (typeof buyOrderArr[0]['purchased_price'] != 'undefined' && buyOrderArr[0]['purchased_price'] != '' ? buyOrderArr[0]['purchased_price'] : buyOrderArr[0]['price']);
    var status = buyOrderArr[0]['status'];
    //The order which you want to update if in LTH then update the sell_price on the base of lth profit
    if (status == 'LTH') {
        var sell_price = ((parseFloat(purchased_price) * lth_profit) / 100) + parseFloat(purchased_price);
        order['sell_price'] = sell_price;
    } else {

        if (typeof buyOrderArr[0]['parent_status'] != 'undefined' && buyOrderArr[0]['parent_status'] == 'parent') {
            //Do nothing
        } else {
            var sell_price = ((parseFloat(purchased_price) * defined_sell_percentage) / 100) + parseFloat(purchased_price);
            order['sell_price'] = sell_price;
        }
    }

    //set sell profit percentage
    if (order['defined_sell_percentage'] != 'undefined' || typeof order['sell_profit_percent'] != 'undefined') {

        let sell_profit_percent = parseFloat(parseFloat(order['sell_profit_percent']).toFixed(1))
        let defined_sell_percentage = parseFloat(parseFloat(order['defined_sell_percentage']).toFixed(1))

        sell_profit_percent = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
        defined_sell_percentage = !isNaN(defined_sell_percentage) ? Math.abs(defined_sell_percentage) : ''

        order['sell_profit_percent'] = defined_sell_percentage != '' ? defined_sell_percentage : sell_profit_percent
        order['defined_sell_percentage'] = defined_sell_percentage != '' ? defined_sell_percentage : sell_profit_percent
        order['is_sell_order'] = 'yes';
    }

    //set stop loss
    if (typeof order['stop_loss_rule'] != 'undefined' && order['stop_loss_rule'] == 'custom_stop_loss' && !isNaN(parseFloat(order['custom_stop_loss_percentage']))) {
        order['stop_loss'] = 'yes'
        order['loss_percentage'] = parseFloat(parseFloat(order['custom_stop_loss_percentage']).toFixed(1))
        order['custom_stop_loss_percentage'] = order['loss_percentage']

        let loss_price = (parseFloat(purchased_price) * parseFloat(order['loss_percentage'])) / 100;

        if (typeof buyOrderArr[0]['parent_status'] != 'undefined' && buyOrderArr[0]['parent_status'] == 'parent'){
            //Do nothing
        }else{
            if (typeof order['iniatial_trail_stop'] != 'undefined'){
                if (ttt_is_custom_stop_loss_possitive){
                    order['iniatial_trail_stop'] = parseFloat(purchased_price) + parseFloat(loss_price);
                }else{
                    order['iniatial_trail_stop'] = parseFloat(purchased_price) - parseFloat(loss_price);
                }
            }
        }
    } else {
        order['stop_loss'] = 'no'
        order['loss_percentage'] = ''
        order['custom_stop_loss_percentage'] = ''
    }

    //set lth profit
    if (typeof order['lth_functionality'] != 'undefined' && order['lth_functionality'] == 'yes' && !isNaN(parseFloat(order['lth_profit']))) {
        order['lth_functionality'] = 'yes'
        order['lth_profit'] = parseFloat(parseFloat(order['lth_profit']).toFixed(1))
    } else {
        order['lth_functionality'] = 'no'
        order['lth_profit'] = ''

        if (status == 'LTH') {
            order['sell_price'] = ((parseFloat(purchased_price) / 100) * order['sell_profit_percent']) + parseFloat(purchased_price);
            order['is_lth_order'] = 'no'
            order['status'] = 'FILLED'
        }

    }

    order['modified_date'] = new Date();

    var collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
    delete order['orderId'];

    // if custom_stop_loss positive then only update target profit and sell price fields
    let tttOrder = {}
    if (buyOrderArr.length > 0){
        if (ttt_is_custom_stop_loss_possitive && typeof order['custom_stop_loss_percentage'] != 'undefined'){

            let tt_CSLP = parseFloat(parseFloat(order['custom_stop_loss_percentage']).toFixed(1))
            if (!isNaN(tt_CSLP)){
                //update initial_trail_price from order array CSL percentage
                let loss_price = (parseFloat(buyOrderArr[0]['purchased_price']) * tt_CSLP) / 100;

                if (typeof buyOrderArr[0]['parent_status'] != 'undefined' && buyOrderArr[0]['parent_status'] == 'parent') {
                    //Do nothing
                } else {
                        if (ttt_is_custom_stop_loss_possitive) {
                            tttOrder['iniatial_trail_stop'] = parseFloat(purchased_price) + parseFloat(loss_price);
                            tttOrder['custom_stop_loss_percentage'] = tt_CSLP;
                            tttOrder['loss_percentage'] = tt_CSLP;
                        } else {
                            tttOrder['iniatial_trail_stop'] = parseFloat(purchased_price) - parseFloat(loss_price);
                            tttOrder['custom_stop_loss_percentage'] = tt_CSLP;
                            tttOrder['loss_percentage'] = tt_CSLP;
                        }
                    }
                }

                if (typeof order['stop_loss_type'] != 'undefined'){
                    tttOrder['stop_loss_type'] = order['stop_loss_type']
                }
                tttOrder['sell_price'] =  order['sell_price']
                tttOrder['sell_profit_percent'] = order['sell_profit_percent']
                tttOrder['defined_sell_percentage'] = order['defined_sell_percentage']
                tttOrder['modified_date'] = new Date()
                order = {}
                order = tttOrder
            }
        }


    if(isParent){
        delete order['is_sell_order']
        delete order['is_lth_order']
    }

    var where = {};
    where['_id'] = new ObjectID(orderId);
    var updPrmise = updateOne(where, order, collection);
    // updPrmise.then((callback) => {})



    //Update sell_price in Sell Order
    if (typeof buyOrderArr[0]['sell_order_id'] != 'undefined') {
        let sell_collection = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
        var where = {};
        let sell_order = {
            'sell_price': order['sell_price']
        }

        // if custom_stop_loss positive then only update target profit and sell price fields
        if (ttt_is_custom_stop_loss_possitive){
            sell_order = {}
            sell_order = tttOrder
        }

        where['_id'] = new ObjectID(String(buyOrderArr[0]['sell_order_id']));
        var updPrmise = updateOne(where, sell_order, sell_collection);
        updPrmise.then((callback) => {})
    }

    //TODO: create detail update log Umer Abbas [13-12-19]
    let obj = buyOrderArr[0];
    let new_obj = order;
    let obj_keys = Object.keys(obj);
    let new_obj_keys = Object.keys(order);
    let update_keys = new_obj_keys.filter(x => obj_keys.includes(x));
    let log_message = "Order Was <b style='color:yellow'>Updated</b> " + interfaceType + " ";
    let notification_msg = log_message;
    for (let i in update_keys) {
        let upd_key = update_keys[i];
        if (new_obj[upd_key] != obj[upd_key]) {
            if (upd_key == 'iniatial_trail_stop' || upd_key == 'iniatial_trail_stop_copy' || upd_key == 'sell_price') {
                log_message += ' ' + upd_key + ' updated from ' + obj[upd_key].toFixed(8) + ' to ' + new_obj[upd_key].toFixed(8) + ', ';
            } else {
                log_message += ' ' + upd_key + ' updated from ' + obj[upd_key] + ' to ' + new_obj[upd_key] + ', ';
            }
        }
    }
    var log_msg = log_message.replace(/,\s*$/, "."); // to remove the last comma

    // var log_msg = "Order Was <b style='color:yellow'>Updated</b>";
    let show_hide_log = 'yes';
    let type = 'order_updated';
    // var promiseLog = recordOrderLog(orderId, log_msg, type, show_hide_log, exchange)
    var getBuyOrder = await listOrderById(orderId, exchange);
    var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
    var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
    var promiseLog = create_orders_history_log(orderId, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)

    if (buyOrderArr.length > 0 && typeof buyOrderArr[0]['parent_status'] != 'undefined' && buyOrderArr[0]['parent_status'] == 'parent' && order['cost_avg'] != 'undefined' && order['cost_avg'] == '') {

    }

    //Send Notification
    send_notification(getBuyOrder[0]['admin_id'], 'news_alerts', 'medium', notification_msg, orderId, exchange, getBuyOrder[0]['symbol'], order_mode, '')

    resp.status(200).send({
        message: 'updated'
    });
}) //End of editAutoOrder

//post call from angular to edit editCostAvgOrder orders
router.post('/editCostAvgOrder', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
      resp.status(401).send({
          message: 'User Not exist'
      });
      return false;
    }

    let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
    let order = req.body.orderArr;
    order['modified_date'] = new Date()
    let orderId = order['orderId'];
    var exchange = order['exchange'];
    var lth_profit = order['lth_profit'];
    var defined_sell_percentage = order['defined_sell_percentage'];
    //get order detail which you want to update
    var buyOrderArr = await listOrderById(orderId, exchange);

    const db = await conn

    if (buyOrderArr.length > 0 && typeof buyOrderArr[0]['cost_avg'] != 'undefined' && typeof buyOrderArr[0]['avg_orders_ids'] != 'undefined'){

        // console.log('11111111111111111111111')

        // await update_cost_avg_fields(orderId, order, exchange)

        await updateCostAvgChildOrders(orderId, order, exchange)

    } else if (buyOrderArr.length > 0 && typeof buyOrderArr[0]['cost_avg'] != 'undefined' && typeof buyOrderArr[0]['cavg_parent'] != 'undefined' && buyOrderArr[0]['cavg_parent'] == 'yes'){

        // console.log('2222222222222222222')

        let buy_collection = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
        let sold_collection = exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange

        let buyOrder = await db.collection(buy_collection).find({ '_id': new ObjectID(String(orderId))}).toArray()
        let soldOrder = await db.collection(sold_collection).find({ '_id': new ObjectID(String(orderId))}).toArray()

        //update avg sell price and purchased prices array
        if (buyOrder.length > 0){

            await db.collection(buy_collection).updateOne({ '_id': new ObjectID(String(orderId)) }, { '$set': { 'avg_sell_price': buyOrder[0]['sell_price'], 'avg_purchase_price': [{ 'purchased_price': buyOrder[0]['purchased_price'] }], 'cost_avg_updated': 'admin', 'modified_date': new Date() } })

        } else if (soldOrder.length > 0){

            await db.collection(sold_collection).updateOne({ '_id': new ObjectID(String(orderId)) }, { '$set': { 'avg_sell_price': soldOrder[0]['market_sold_price'], 'avg_purchase_price': [{ 'purchased_price': soldOrder[0]['purchased_price'] }], 'cost_avg_updated': 'admin', 'modified_date': new Date() } })

        }

    }

    order = {}
    order['cost_avg_updated'] = 'admin';
    order['modified_date'] = new Date();
    order['avg_price_all_upd'] = 'yes';

    var collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;

    if (buyOrderArr.length > 0 && typeof buyOrderArr[0]['cavg_parent'] != 'yes'){
        order['quantity_all'] = buyOrderArr[0]['quantity']

        let cavIdsToConsider = [buyOrderArr[0]['_id']]
        if (typeof buyOrderArr[0]['avg_orders_ids'] != 'undefined' && buyOrderArr[0]['avg_orders_ids'].length > 0){
            cavIdsToConsider = cavIdsToConsider.concat(buyOrderArr[0]['avg_orders_ids'])
        }
        let cavgPipeline = [
            {
                '$match': {
                    '_id': { '$in': cavIdsToConsider},
                    'status': 'FILLED',
                    'is_sell_order': 'yes'
                }
            },
            {
                '$group': {
                    '_id': null,
                    'quantitySum': {'$sum': '$quantity'}
                }
            }
        ]
        let cvgTotalBuyQty = await db.collection(collection).aggregate(cavgPipeline).toArray()
        if (cvgTotalBuyQty.length > 0){
            order['quantity_all'] = cvgTotalBuyQty[0]['quantitySum']
        }
    }


    delete order['orderId'];

    var where = {};
    where['_id'] = new ObjectID(orderId);
    var updPrmise = updateOne(where, order, collection);



    /*
    //TODO: create detail update log Umer Abbas [13-12-19]
    let obj = buyOrderArr[0];
    let new_obj = order;
    let obj_keys = Object.keys(obj);
    let new_obj_keys = Object.keys(order);
    let update_keys = new_obj_keys.filter(x => obj_keys.includes(x));
    let log_message = "Order Was <b style='color:yellow'>Updated</b> " + interfaceType + " ";
    let notification_msg = log_message;
    for (let i in update_keys) {
        let upd_key = update_keys[i];
        if (new_obj[upd_key] != obj[upd_key]) {
            if (upd_key == 'iniatial_trail_stop' || upd_key == 'iniatial_trail_stop_copy' || upd_key == 'sell_price') {
                log_message += ' ' + upd_key + ' updated from ' + obj[upd_key].toFixed(8) + ' to ' + new_obj[upd_key].toFixed(8) + ', ';
            } else {
                log_message += ' ' + upd_key + ' updated from ' + obj[upd_key] + ' to ' + new_obj[upd_key] + ', ';
            }
        }
    }
    var log_msg = log_message.replace(/,\s*$/, "."); // to remove the last comma

    // var log_msg = "Order Was <b style='color:yellow'>Updated</b>";
    let show_hide_log = 'yes';
    let type = 'order_updated';
    // var promiseLog = recordOrderLog(orderId, log_msg, type, show_hide_log, exchange)
    var getBuyOrder = await listOrderById(orderId, exchange);
    var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
    var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
    var promiseLog = create_orders_history_log(orderId, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
    */

    resp.status(200).send({
        message: 'updated'
    });
}) //End of editCostAvgOrder

//Function for creating parent order
function createAutoOrder(OrderArr) {

    //set sell profit percentage
    if (OrderArr['defined_sell_percentage'] != 'undefined' || typeof OrderArr['sell_profit_percent'] != 'undefined') {

        let sell_profit_percent = parseFloat(parseFloat(OrderArr['sell_profit_percent']).toFixed(1))
        let defined_sell_percentage = parseFloat(parseFloat(OrderArr['defined_sell_percentage']).toFixed(1))

        sell_profit_percent = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
        defined_sell_percentage = !isNaN(defined_sell_percentage) ? Math.abs(defined_sell_percentage) : ''

        OrderArr['sell_profit_percent'] = sell_profit_percent != '' ? sell_profit_percent : defined_sell_percentage
        OrderArr['defined_sell_percentage'] = sell_profit_percent != '' ? sell_profit_percent : defined_sell_percentage
    }

    //set stop loss
    if (typeof OrderArr['stop_loss_rule'] != 'undefined' && OrderArr['stop_loss_rule'] == 'custom_stop_loss' && !isNaN(parseFloat(OrderArr['custom_stop_loss_percentage']))) {
        OrderArr['stop_loss'] = 'yes'
        OrderArr['loss_percentage'] = parseFloat(parseFloat(OrderArr['custom_stop_loss_percentage']).toFixed(1))
        OrderArr['custom_stop_loss_percentage'] = OrderArr['loss_percentage']
    } else {
        OrderArr['stop_loss'] = 'no'
        OrderArr['loss_percentage'] = ''
        OrderArr['custom_stop_loss_percentage'] = ''
    }

    //set lth profit
    if (typeof OrderArr['lth_functionality'] != 'undefined' && OrderArr['lth_functionality'] == 'yes' && !isNaN(parseFloat(OrderArr['lth_profit']))) {
        OrderArr['lth_functionality'] = 'yes'
        OrderArr['lth_profit'] = parseFloat(parseFloat(OrderArr['lth_profit']).toFixed(1))
    } else {
        OrderArr['lth_functionality'] = 'no'
        OrderArr['lth_profit'] = ''
    }



    return new Promise((resolve) => {
        conn.then((db) => {
            var exchange = OrderArr['exchange'];
            var collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            db.collection(collection).insertOne(OrderArr, (err, result) => {
                if (err) {
                    resolve(err);
                } else {

                    let interfaceType = (typeof OrderArr.interface != 'undefined' && OrderArr.interface != '' ? OrderArr.interface : '');
                    //TODO: insert parent error log
                    var show_hide_log = 'yes'
                    var type = 'parent_created'
                    var log_msg = 'Auto order parent created ' + interfaceType
                    var order_mode = OrderArr['application_mode']
                    create_orders_history_log(result.insertedId, log_msg, type, show_hide_log, exchange, order_mode, OrderArr['created_date'])

                    //Send Notification
                    let notification_msg = log_msg
                    send_notification(OrderArr['admin_id'], 'news_alerts', 'medium', notification_msg, result.insertedId, exchange, OrderArr['symbol'], order_mode, '')

                    resolve(result)
                }
            })
        })
    })
} //End of createAutoOrder


function getCostAvgChildOrderNotSoldIds(ids, exchange){

    return new Promise(async (resolve)=>{
        const db = await conn
        let buy_collection = exchange == 'binance' ? 'buy_orders' : 'buy_orders_'+exchange
        let result = await db.collection(buy_collection).find({ _id: {$in: ids}}).project({_id:1}).toArray()

        if (result.length > 0){
            ids = result.map(item=>item['_id'])
            resolve(ids)
        }else{
            resolve([])
        }
    })
}

async function updateCostAvgChildOrders(order_id, order, exchange) {


    await update_cost_avg_fields_shahzad(order_id, order, exchange)
    // process.exit(1)

    await updateAvgSellFullTransactionPrice(order_id, exchange, order['symbol'])
    await updateAvgSellThreeTransactionPrice(order_id, exchange, order['symbol'])

    var ids = []

    var buyOrderArr = await listOrderById(order_id, exchange);

    if (buyOrderArr.length > 0) {

        let allIds = typeof buyOrderArr[0]['avg_orders_ids'] != 'undefined' && buyOrderArr[0]['avg_orders_ids'].length > 0 ? buyOrderArr[0]['avg_orders_ids'] : []

        ids = typeof buyOrderArr[0]['avg_orders_ids'] != 'undefined' && buyOrderArr[0]['avg_orders_ids'].length > 0 ? buyOrderArr[0]['avg_orders_ids'] : []

        if (ids.length > 0) {
            ids = await getCostAvgChildOrderNotSoldIds(ids, exchange)
        }

        // console.log(ids)
        // console.log('+++++++++++++++++++++++++++++++++++++++++')

        const db = await conn
        let sold_orders_purchased_price_arr = []

        let sold_collection = exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange
        let market_sold_prices_arr = await db.collection(sold_collection).find({ '_id': { $in: allIds } }).project({ market_sold_price: 1, purchased_price: 1 }).toArray()

        // console.log('sold arr', market_sold_prices_arr)

        let market_sold_price_sum = 0;
        let sell_price_sum = 0;
        if (market_sold_prices_arr.length > 0) {
            let soldCount = market_sold_prices_arr.length
            for (let i = 0; i < soldCount; i++) {
                market_sold_price_sum += market_sold_prices_arr[i]['market_sold_price']
                sold_orders_purchased_price_arr.push({ 'purchased_price': market_sold_prices_arr[i]['purchased_price'] })
            }
        }

        // console.log('sold_orders_purchased_price_arr ',sold_orders_purchased_price_arr)

        //parent purchased price array
        let avg_purchase_price = []
        //parent sell_price
        var lth_profit = order['lth_profit'];
        var defined_sell_percentage = order['defined_sell_percentage'];
        var purchased_price = (typeof buyOrderArr[0]['purchased_price'] != 'undefined' && buyOrderArr[0][''] != '' ? buyOrderArr[0]['purchased_price'] : buyOrderArr[0]['price']);

        avg_purchase_price.push({ 'purchased_price': purchased_price })
        avg_purchase_price = avg_purchase_price.concat(sold_orders_purchased_price_arr)



        var status = buyOrderArr[0]['status'];
        //The order which you want to update if in LTH then update the sell_price on the base of lth profit
        if (status == 'LTH') {
            sell_price_sum += ((parseFloat(purchased_price) * lth_profit) / 100) + parseFloat(purchased_price);
        } else {
            sell_price_sum += ((parseFloat(purchased_price) * defined_sell_percentage) / 100) + parseFloat(purchased_price);
        }

        let totalChilds = ids.length

        if (totalChilds > 0) {

            for (let i = 0; i < totalChilds; i++) {

                let orderId = String(ids[i])

                let interfaceType = ''
                // let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
                order['modified_date'] = new Date()
                // let orderId = order['orderId'];
                var exchange = order['exchange'];
                var lth_profit = order['lth_profit'];
                var defined_sell_percentage = order['defined_sell_percentage'];
                //get order detail which you want to update
                var buyOrderArr = await listOrderById(orderId, exchange);

                var purchased_price = (typeof buyOrderArr[0]['purchased_price'] != 'undefined' && buyOrderArr[0]['purchased_price'] != '' ? buyOrderArr[0]['purchased_price'] : buyOrderArr[0]['price']);

                avg_purchase_price.push({ 'purchased_price': purchased_price })

                var status = buyOrderArr[0]['status'];
                //The order which you want to update if in LTH then update the sell_price on the base of lth profit
                if (status == 'LTH') {
                    var sell_price = ((parseFloat(purchased_price) * lth_profit) / 100) + parseFloat(purchased_price);
                    order['sell_price'] = sell_price;
                } else {

                    if (typeof buyOrderArr[0]['parent_status'] != 'undefined' && buyOrderArr[0]['parent_status'] == 'parent') {
                        //Do nothing
                    } else {
                        var sell_price = ((parseFloat(purchased_price) * defined_sell_percentage) / 100) + parseFloat(purchased_price);
                        order['sell_price'] = sell_price;
                    }
                }

                //set sell profit percentage
                if (order['defined_sell_percentage'] != 'undefined' || typeof order['sell_profit_percent'] != 'undefined') {

                    let sell_profit_percent = parseFloat(parseFloat(order['sell_profit_percent']).toFixed(1))
                    let defined_sell_percentage = parseFloat(parseFloat(order['defined_sell_percentage']).toFixed(1))

                    sell_profit_percent = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
                    defined_sell_percentage = !isNaN(defined_sell_percentage) ? Math.abs(defined_sell_percentage) : ''

                    order['sell_profit_percent'] = defined_sell_percentage != '' ? defined_sell_percentage : sell_profit_percent
                    order['defined_sell_percentage'] = defined_sell_percentage != '' ? defined_sell_percentage : sell_profit_percent
                    order['is_sell_order'] = 'yes';
                }

                order['modified_date'] = new Date();

                var collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                delete order['orderId'];

                var where = {};
                where['_id'] = new ObjectID(orderId);
                updateOne(where, order, collection);

                sell_price_sum += order['sell_price']

                //Update sell_price in Sell Order
                if (typeof buyOrderArr[0]['sell_order_id'] != 'undefined') {
                    let sell_collection = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
                    var where = {};
                    let sell_order = {
                        'sell_price': order['sell_price']
                    }

                    where['_id'] = new ObjectID(String(buyOrderArr[0]['sell_order_id']));
                    updateOne(where, sell_order, sell_collection);
                }

                //TODO: create detail update log Umer Abbas [13-12-19]
                let obj = buyOrderArr[0];
                let new_obj = order;
                let obj_keys = Object.keys(obj);
                let new_obj_keys = Object.keys(order);
                let update_keys = new_obj_keys.filter(x => obj_keys.includes(x));
                let log_message = "Order Was <b style='color:yellow'>Updated</b> " + interfaceType + " ";
                for (let i in update_keys) {
                    let upd_key = update_keys[i];
                    if (new_obj[upd_key] != obj[upd_key]) {
                        if (upd_key == 'iniatial_trail_stop' || upd_key == 'iniatial_trail_stop_copy' || upd_key == 'sell_price') {
                            log_message += ' ' + upd_key + ' updated from ' + obj[upd_key].toFixed(8) + ' to ' + new_obj[upd_key].toFixed(8) + ', ';
                        } else {
                            log_message += ' ' + upd_key + ' updated from ' + obj[upd_key] + ' to ' + new_obj[upd_key] + ', ';
                        }
                    }
                }
                var log_msg = log_message.replace(/,\s*$/, "."); // to remove the last comma

                let show_hide_log = 'yes';
                let type = 'order_updated'
                var getBuyOrder = await listOrderById(orderId, exchange);
                var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                create_orders_history_log(orderId, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
            }

        }

        var collection = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
        let avg_sell_price = (market_sold_price_sum + sell_price_sum) / (totalChilds + 1)

        // console.log(market_sold_price_sum, ' + ', sell_price_sum, ' / ', totalChilds, ' + ', 1)
        // console.log('avg_sell_price ', avg_sell_price)
        // console.log('avg_purchase_price ', avg_purchase_price)

        let buy_collection11 = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
        let sold_collection11 = exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange

        let buyOrder11 = await db.collection(buy_collection11).find({ '_id': new ObjectID(String(order_id)) }).toArray()
        let soldOrder11 = await db.collection(sold_collection11).find({ '_id': new ObjectID(String(order_id)) }).toArray()

        //update avg sell price and purchased prices array
        if (buyOrder11.length > 0) {

            // await db.collection(buy_collection11).updateOne({ '_id': new ObjectID(String(order_id)) }, { '$set': { 'avg_sell_price': avg_sell_price, 'avg_purchase_price': avg_purchase_price, 'cost_avg_updated': 'admin', 'modified_date': new Date() } })

            await db.collection(buy_collection11).updateOne({ '_id': new ObjectID(String(order_id)) }, { '$set': { 'avg_purchase_price': avg_purchase_price, 'cost_avg_updated': 'admin', 'modified_date': new Date() } })

        } else if (soldOrder11.length > 0) {

            // await db.collection(sold_collection11).updateOne({ '_id': new ObjectID(String(order_id)) }, { '$set': { 'avg_sell_price': avg_sell_price, 'avg_purchase_price': avg_purchase_price, 'cost_avg_updated': 'admin', 'modified_date': new Date() } })

            await db.collection(sold_collection11).updateOne({ '_id': new ObjectID(String(order_id)) }, { '$set': { 'avg_purchase_price': avg_purchase_price, 'cost_avg_updated': 'admin', 'modified_date': new Date() } })

        }

    }

    return true

}


async function update_cost_avg_fields(order_id, order, exchange){

    const db = await conn

    var ids = []

    var buyOrderArr = await listOrderById(order_id, exchange);

    if (buyOrderArr.length > 0){

        var defined_sell_percentage = order['defined_sell_percentage'];
        var purchased_price = buyOrderArr[0]['purchased_price'];

        let avg_sell_price = 0;
        let sold_target_pl_sum = 0;
        let sold_pl_sum = 0;
        let sell_price_sum = 0;
        let remaining_additional_pl = 0;
        let purchase_price_sum = 0;
        let purchase_price_avg = 0;
        let avg_purchase_price_arr = [];

        let ledger_ids = typeof buyOrderArr[0]['avg_orders_ids'] != 'undefined' && buyOrderArr[0]['avg_orders_ids'].length > 0 ? buyOrderArr[0]['avg_orders_ids'] : []

        ledger_ids.push(new ObjectID(String(order_id)))

        let buy_collection = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
        let sold_collection = exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange

        let sold_orders = await db.collection(sold_collection).find({ '_id': { $in: ledger_ids } }).toArray()
        let buy_orders = await db.collection(buy_collection).find({ '_id': { $in: ledger_ids } }).toArray()

        if (sold_orders.length > 0){
            sold_orders.map(item => {
                avg_purchase_price_arr.push({ 'purchased_price': item['purchased_price'] })
                sold_pl_sum += parseFloat(calculate_percentage(item['purchased_price'], item['market_sold_price']))
                // sell_price_sum += item['market_sold_price']
                // purchase_price_sum += item['purchased_price']
            })
        }

        sold_target_pl_sum = defined_sell_percentage * sold_orders.length

        let actualDsiredGet = 0
        if (buy_orders.length > 0){

            remaining_additional_pl = -((sold_target_pl_sum - sold_pl_sum ) / buy_orders.length)
            console.log('remaininf sdsadsadsad', remaining_additional_pl)
            actualDsiredGet = (defined_sell_percentage - remaining_additional_pl);

            console.log('actual TP', actualDsiredGet)


            // remaining_additional_pl = (sold_target_pl_sum - sold_pl_sum) / buy_orders.length

            buy_orders.map(item => {
                avg_purchase_price_arr.push({ 'purchased_price': item['purchased_price'] })
                purchase_price_sum += item['purchased_price']
            })
        }

        if (buy_orders.length > 0 || sold_orders.length > 0){
            purchase_price_avg = purchase_price_sum / buy_orders.length
        }
        let avgSellPrice = ((purchase_price_avg * actualDsiredGet) / 100) + purchase_price_avg

        console.log('asim ', avgSellPrice)

        // if (buy_orders.length > 0){

            // let sell_price = ((parseFloat(purchase_price_avg) * ((buy_orders.length*defined_sell_percentage) + (-1 * remaining_additional_pl))) / 100) + parseFloat(purchase_price_avg);
                // sell_price_sum += sell_price

            // avg_sell_price = sell_price_sum / buy_orders.length
        // }


        //update now
        let buyOrder11 = await db.collection(buy_collection).find({ '_id': new ObjectID(String(order_id)) }).toArray()
        let soldOrder11 = await db.collection(sold_collection).find({ '_id': new ObjectID(String(order_id)) }).toArray()

        //update avg sell price and purchased prices array
        if (buyOrder11.length > 0) {

            // await db.collection(buy_collection11).updateOne({ '_id': new ObjectID(String(order_id)) }, { '$set': { 'avg_sell_price': avg_sell_price, 'avg_purchase_price': avg_purchase_price_arr, 'cost_avg_updated': 'admin', 'modified_date': new Date() } })

        } else if (soldOrder11.length > 0) {

            // await db.collection(sold_collection11).updateOne({ '_id': new ObjectID(String(order_id)) }, { '$set': { 'avg_sell_price': avg_sell_price, 'avg_purchase_price': avg_purchase_price_arr, 'cost_avg_updated': 'admin', 'modified_date': new Date() } })

        }

        console.log('update ', { 'avg_sell_price': avg_sell_price, 'avg_purchase_price': avg_purchase_price_arr, 'cost_avg_updated': 'admin', 'modified_date': new Date() })

    }
    console.log('__________________________________________________________________________________________________')

    return true

}

async function update_cost_avg_fields_shahzad(order_id, order, exchange) {

    const db = await conn

    let buy_collection = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
    let sold_collection = exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange

    var parentActiveOrderArr = await db.collection(sold_collection).find({ '_id': new ObjectID(String(order_id)) }).toArray();
    let parent_sold = false
    let objPurchArr = []


    var OverAllSellPrice = 0
    countOrderBuy = 0
    var byyOrderArrsIdToSell = [];
    var overAllBuyPercentage = 0;
    var overAllpurchasedPrice = 0;
    var overAllSoldPercentage = 0;
    var overAllSellPercentage = 0


    if (parentActiveOrderArr.length > 0) {

        parent_sold = true
        var ObjPurch = { 'purchased_price': parseFloat(parentActiveOrderArr[0]['purchased_price']) };
        objPurchArr.push(ObjPurch)
        await db.collection(sold_collection).updateOne({ '_id': new ObjectID(String(order_id)) }, { '$set': { 'avg_purchase_price': objPurchArr, 'cost_avg_updated': 'admin_shahzad_function', 'modified_date': new Date() } })

        var purchasePrice = parseFloat(parentActiveOrderArr[0]['purchased_price']);// Get purchasePrice
        var definedSellPercentageSold = parseFloat(parentActiveOrderArr[0]['defined_sell_percentage']);// Get Defined Sell Percentage

        var avg_orders_ids = parentActiveOrderArr[0]['avg_orders_ids'];// Get avg_orders_ids

        var marketSoldPriceSold = parseFloat(parentActiveOrderArr[0]['market_sold_price']);
        var differenceBetwnSold = marketSoldPriceSold - purchasePrice;
        var definedSellPercentage = (differenceBetwnSold * 100) / purchasePrice;
        overAllSoldPercentage += definedSellPercentage;

        // console.log('definedSellPercentageSold ', definedSellPercentageSold)
        // console.log('definedSellPercentage ', definedSellPercentage)
        overAllSoldPercentage += (-1)*definedSellPercentageSold;
        // console.log('overAllSoldPercentage ', overAllSoldPercentage)
        // console.log('parent sold P/L ', definedSellPercentage)

    } else {
         countOrderBuy = 1;
        var parentActiveOrderArr = await db.collection(buy_collection).find({ '_id': new ObjectID(String(order_id)) }).toArray();
        var ObjPurch = { 'purchased_price': parseFloat(parentActiveOrderArr[0]['purchased_price']) };
        objPurchArr.push(ObjPurch)
        await db.collection(buy_collection).updateOne({ '_id': new ObjectID(String(order_id)) }, { '$set': { 'avg_purchase_price': objPurchArr, 'cost_avg_updated': 'admin_shahzad_function', 'modified_date': new Date() } })
        var parentActiveOrderArr = await db.collection(buy_collection).find({ '_id': new ObjectID(String(order_id)) }).toArray();


        var purchasePrice = parseFloat(parentActiveOrderArr[0]['purchased_price']);// Get purchasePrice
        var definedSellPercentage = parseFloat(parentActiveOrderArr[0]['defined_sell_percentage']);// Get Defined Sell Percentage
        var avg_orders_ids = parentActiveOrderArr[0]['avg_orders_ids'];// Get avg_orders_ids
        overAllpurchasedPrice += purchasePrice;
        // For parent Order we have
        overAllBuyPercentage += definedSellPercentage;

        // console.log('parent buy P/L ', definedSellPercentage)

    }

    if (parentActiveOrderArr.length > 0) {

        for (let avgIndex in avg_orders_ids) {
            var childBuyOrderId = avg_orders_ids[avgIndex];
            // Here we Get the orders from Buy order collection

            var childOrderArr = await db.collection(buy_collection).find({ '_id': childBuyOrderId }).toArray()

            if (typeof childOrderArr !== 'undefined' && childOrderArr.length > 0) {

                if (childOrderArr[0]['status'] == 'canceled'){
                    continue;
                }

                // *countOrderBuy* used for to count the buy orders
                countOrderBuy++;
                // *profitPercentage* used for to get the default profit percentage from buy order collection like i-e 1.2
                var profitPercentage = parseFloat(childOrderArr[0]['sell_profit_percent']);
                // *purchasedPrice* used for to get the purchased price from buy order collection
                var purchasedPrice = parseFloat(childOrderArr[0]['purchased_price']);
                // console.log('purchasedPrice ', purchasedPrice)
                // *overAllBuyPercentage* used to sum overall buy percentage from buy order collection
                overAllBuyPercentage += profitPercentage;
                // console.log('overAllBuyPercentage ', overAllBuyPercentage)
                // *overAllpurchasedPrice* used to sum overall buy purchased price from buy order collection
                overAllpurchasedPrice += purchasedPrice;

                // console.log('overAllpurchasedPrice ', overAllpurchasedPrice)

                objPurchArr.push({ 'purchased_price': parseFloat(childOrderArr[0]['purchased_price']) })

            } else {
                // ELSE we get the orders from sold_buy_order collectio
                var childOrderArr = await db.collection(sold_collection).find({ '_id': childBuyOrderId }).toArray()

                if (typeof childOrderArr !== 'undefined' && childOrderArr.length > 0) {

                    // *SoldprofitPerc* used for to get the default profit percentage from sold_buy_orders collection like i-e 1.2
                    var SoldprofitPerc = parseFloat(childOrderArr[0]['sell_profit_percent']);
                    // *overAllSellPercentage* used for to SUM overall sold percentage from sold_buy_orders collection
                    overAllSellPercentage += SoldprofitPerc;
                    // *purchasedPrice* To get purchsed price from sold_buy_orders collection
                    var purchasedPrice = parseFloat(childOrderArr[0]['purchased_price']);
                    // *marketSoldPrice* To get market sold price from sold_buy_orders collection
                    var marketSoldPrice = parseFloat(childOrderArr[0]['market_sold_price']);
                    // *differenceBetwn* To calucalte percentage first we take differnce from sold_buy_orders collection
                    var differenceBetwn = marketSoldPrice - purchasedPrice;
                    // *profitPercentage* Get single order percentage from sold_buy_orders collection
                    let profitPercentage = (differenceBetwn * 100) / purchasedPrice;

                    // console.log('profitPercentage ', profitPercentage)

                    // *overAllSoldPercentage* Sum overall the percentages from sold_buy_orders collection
                    overAllSoldPercentage += profitPercentage;

                    // console.log('overAllSoldPercentage ', overAllSoldPercentage)

                    objPurchArr.push({ 'purchased_price': parseFloat(childOrderArr[0]['purchased_price']) })
                }
            }// END of else
        }
        // Now here variable ( overAllSellPercentage ) have percentages that mean by default percentage e-g 1.2 from parent
        // Now here variable ( overAllSoldPercentage ) have percentages that how much a trade take the profit when they are sold
        var finalSoldPercentage = -1 * overAllSellPercentage + (1 * overAllSoldPercentage)
        // Checck where Sold order are in Profit Are In Loss
        // *buyAvgpercentage* To get single average purchased price percentage Mean ( Break Even )
        var buyAvgpercentage = overAllBuyPercentage / countOrderBuy;
        // *finalSoldPercentage* ITs mean that when there is sold order and the sold order are also in loss Its
        // When we get the over all sold order sum e-g
        // E-g
        // 1.2 default and take the profit postive 1% profit from (Market sold price - Purchase Price) = 1%
        // So it become -1.2 +1 = -0.2 so it is negative so it goes in if condition


        // console.log('finalSoldPercentage ', finalSoldPercentage, ' --------- ', 'buyAvgpercentage ', buyAvgpercentage)


        if (finalSoldPercentage < 0) {
            // *soldProfitAndLoss* Its mean that we can distribute the sold order profit and loss on current open orders
            var soldProfitAndLoss = finalSoldPercentage / countOrderBuy;

            // console.log('finalSoldPercentage < 0 :::::: soldProfitAndLoss ', soldProfitAndLoss)

            // *eachOrderNeedPerc* Its mean that now the current open orders profit and loss need to be sold of each order
            var eachOrderNeedPerc = (-1 * soldProfitAndLoss) + buyAvgpercentage;
            // Break Even Here it means profit and loss zero 0
            var avgPurchasedPrice = overAllpurchasedPrice / countOrderBuy
            // *TargetSellPriceOrder* Calculate the needed profit and loss perrcentage on current open orders
            var TargetSellPriceOrder = avgPurchasedPrice + (avgPurchasedPrice * eachOrderNeedPerc / 100)
            // *OverAllSellPrice* So its the requiered price that we need to sold the over all ledger on this price
            OverAllSellPrice = TargetSellPriceOrder;
        } else if (finalSoldPercentage > 0) { // When the sold order percentage are greate than 0 so we distrubit thte profit and loss on current ordrs
            // *soldProfitAndLoss* Its mean that we can distribute the sold order profit and loss on current open orders
            var soldProfitAndLoss = finalSoldPercentage / countOrderBuy;

            // console.log('finalSoldPercentage > 0 :::::: soldProfitAndLoss', soldProfitAndLoss)

            // *eachOrderNeedPerc* Its mean that now the current open orders profit and loss need to be sold of each order
            var eachOrderNeedPerc = buyAvgpercentage - soldProfitAndLoss;
            // Break Even Here it smean profit and loss zero 0
            var avgPurchasedPrice = overAllpurchasedPrice / countOrderBuy
            // *TargetSellPriceOrder* Calculate the needed profit and loss perrcentage on current open orders
            var TargetSellPriceOrder = avgPurchasedPrice + (avgPurchasedPrice * eachOrderNeedPerc / 100)
            // *OverAllSellPrice* So its the requiered price that we need to sold the over all ledger on this price
            OverAllSellPrice = TargetSellPriceOrder;
        } else {// When the ledger have no sold orders so then else condition become true
            // *eachOrderNeedPerc* Its mean that we can take the percentage profit from sinlge order i-e take from parent order .
            var eachOrderNeedPerc = definedSellPercentage;
            // Break Even Here it smean profit and loss zero 0
            var avgPurchasedPrice = overAllpurchasedPrice / countOrderBuy
            // *TargetSellPriceOrder* Calculate the needed profit and loss perrcentage on current open orders
            var TargetSellPriceOrder = avgPurchasedPrice + (avgPurchasedPrice * eachOrderNeedPerc / 100)
            // *OverAllSellPrice* So its the requiered price that we need to sold the over all ledger on this price
            OverAllSellPrice = TargetSellPriceOrder;
        }

        // console.log('OverAllSellPrice ', OverAllSellPrice)

        // END Here we need new code to be update avg_sell_price in parent order
        if (parentActiveOrderArr.length > 0 && parent_sold) {
            // console.log("Else condition update line number 1346", OverAllSellPrice)

            await db.collection(sold_collection).updateOne({ '_id': new ObjectID(String(order_id)) }, { '$set': { 'avg_purchase_price': objPurchArr, 'avg_sell_price': OverAllSellPrice, 'cost_avg_updated': 'admin_shahzad_function', 'modified_date': new Date() } })

        } else {
            // console.log("if condition update line number 1336", OverAllSellPrice)

            await db.collection(buy_collection).updateOne({ '_id': new ObjectID(String(order_id)) }, { '$set': { 'avg_purchase_price': objPurchArr, 'avg_sell_price': OverAllSellPrice, 'cost_avg_updated': 'admin_shahzad_function', 'modified_date': new Date() } })

        }

        // console.log('objPurchArr ', objPurchArr)

        // console.log('OverAllSellPrice ', OverAllSellPrice)
        // await db.collection(buy_collection).updateOne({ '_id': new ObjectID(String(order_id)) }, { '$set': { 'avg_sell_price': OverAllSellPrice, 'cost_avg_updated': 'admin_shahzad_function', 'modified_date': new Date() } })

    }

}

async function updateAvgSellFullTransactionPrice(order_id, exchange, coinSymbol){
    conn.then(async (db) => {

        var type = "all";
        var order_mode = 'live';
        var pricesObj = await get_current_market_prices(exchange, [coinSymbol])
        var currentMarketPrice = pricesObj[coinSymbol]

        //List all order for which deep price meet
        var parentActiveOrderArr = await getCostAverageParentOrdes(order_id, exchange, coinSymbol, order_mode, type);

        console.log("parentActiveOrderArr ::::::::  updateAvgSellFullTransactionPrice ", parentActiveOrderArr)
        if (typeof parentActiveOrderArr !== 'undefined' && parentActiveOrderArr != '') {
            for (let orderIndex in parentActiveOrderArr) {
                var countOrderBuy = 1;
                var quantity = parentActiveOrderArr[orderIndex]['quantity'];// Get quantity
                var costParentOrderId = parentActiveOrderArr[orderIndex]['_id'];// Get _id
                var parentpurchasedPrice = parentActiveOrderArr[orderIndex]['purchased_price'];// Get Purchased
                var avg_orders_ids = parentActiveOrderArr[orderIndex]['avg_orders_ids'];// Get avg_orders_ids
                var definedSellPercentage = parentActiveOrderArr[orderIndex]['defined_sell_percentage'];// Get Defined Sell Percentage

                // We will run Loop to multiple 0.5 on each iteration
                for (let i = 1; i < 5000; i++) {
                    // Formula Goes Here
                    var XPrice = 0;
                    var finalValOverAll = 0;
                    var incrementVal = i * 0.3
                    var IncrePercnt = (currentMarketPrice * incrementVal) / 100
                    var XPrice = (currentMarketPrice + IncrePercnt);
                    var finalValOverAll = ((XPrice - parentpurchasedPrice) / parentpurchasedPrice) * 100;

                    var response = ''

                    if(i == 1){
                        response = await sumChildOrders(exchange, avg_orders_ids, XPrice, countOrderBuy, definedSellPercentage, finalValOverAll, costParentOrderId, quantity);
                        console.log ('loop iteration ', i)
                    }else{
                        console.log ('loop iteration ', i)
                    }

                    if (response == false) {
                        i = 1;
                        console.log(" ~~~~~~~~ ALL TRANSACTION OVERALL Response Is Good and Order cost average updated costParentOrderId ~~~~~~~~ ", costParentOrderId)
                        break;
                    } // END of if(response==false)
                    countOrderBuy = 1
                }// END of Iteration loop
            }// END of for(let orderIndex in parentActiveOrderArr){
        }// END of if (typeof parentActiveOrderArr!=='undefined' && parentActiveOrderArr !== '')

    })// END of  conn.then(async (db) =>
}// END of updateAvgSellFullTransactionPrice

async function updateAvgSellThreeTransactionPrice(order_id, exchange, coinSymbol){
    conn.then(async (db) => {

        var type = "three";
        var order_mode = 'live';
        var pricesObj = await get_current_market_prices(exchange, [coinSymbol])
        var currentMarketPrice = pricesObj[coinSymbol]
        //List all order for which deep price meet
        var parentActiveOrderArr = await getCostAverageParentOrdes(order_id, exchange, coinSymbol, order_mode, type);
        if (typeof parentActiveOrderArr !== 'undefined' && parentActiveOrderArr != '') {
            for (let orderIndex in parentActiveOrderArr) {
                // According to sir we need 5% profit on last three orders
                var countOrderBuy = 1;
                var definedSellPercentage = 5
                var quantity = parentActiveOrderArr[orderIndex]['quantity'];// Get quantity
                var costParentOrderId = parentActiveOrderArr[orderIndex]['_id'];// Get _id
                var avg_orders_ids = parentActiveOrderArr[orderIndex]['avg_orders_ids'];// Get avg_orders_ids
                var parentpurchasedPrice = parentActiveOrderArr[orderIndex]['purchased_price'];// Get purchased_price
                var definedSellPercentage = parentActiveOrderArr[orderIndex]['defined_sell_percentage'];// Get Defined Sell Percentage

                // We will run Loop to multiple 0.5 on each iteration
                if (typeof avg_orders_ids !== "undefined" && avg_orders_ids !== "") {
                    console.log("costParentOrderId IST ::: ", costParentOrderId)
                    for (let i = 1; i < 500; i++) {
                        // Formula Goes Here
                        var XPrice = 0;
                        var finalValOverAll = 0;
                        var incrementVal = i * 0.5
                        var IncrePercnt = (currentMarketPrice * incrementVal) / 100
                        var XPrice = (currentMarketPrice + IncrePercnt);
                        var finalValOverAll = ((XPrice - parentpurchasedPrice) / parentpurchasedPrice) * 100;

                        var response = ''
                        if (i == 1) {
                            response = await sumLastThreeChildOrders(order_id, exchange, costParentOrderId, avg_orders_ids, XPrice, countOrderBuy, definedSellPercentage, finalValOverAll, quantity);
                            console.log('loop iteration ', i)
                        } else {
                            console.log('loop iteration ', i)
                        }

                        if (response == false) {
                            i = 1;
                            console.log(" ~~~~~~~~ LAST THREE Response Is Good and Order cost average updated costParentOrderId ~~~~~~~~ ", costParentOrderId)
                            break;
                        }// END of if(response==false)
                        countOrderBuy = 1
                    }// END of Iteration loop
                }// END of if(typeof avg_orders_ids!=="undefined" && avg_orders_ids!=="")
            }// END of for(let orderIndex in parentActiveOrderArr){
        }// END of if (typeof parentActiveOrderArr!=='undefined' && parentActiveOrderArr !== '')

    })// END of conn.then(async (db) =>
}// END of costAvgSellOverAllOrders

async function sumChildOrders(exchange, avg_orders_ids, XPrice, countOrderBuy, definedSellPercentage, finalValOverAll, costParentOrderId, quantityAll){
    return new Promise((resolve) => {
        conn.then(async (db) => {

            //console.log("::::::::::::   finalValOverAll ::::::::::", finalValOverAll)
            var type = "all";
            var buyOrderArrsIds = []
            for (let avgIndex in avg_orders_ids) {
                // Here we Get the orders from Buy order collection
                var childBuyOrderId = avg_orders_ids[avgIndex];
                var childOrderArr = await getOrderBuyOrder(exchange, childBuyOrderId)
                if (typeof childOrderArr !== 'undefined' && childOrderArr["_id"] !== "" && childOrderArr["_id"] !== 'undefined') {
                    if (childOrderArr["status"] !== "canceled") {
                        // *countOrderBuy* used for to count the buy orders
                        countOrderBuy++;
                        buyOrderArrsIds.push(childOrderArr["_id"])
                        var quantityChild = parseFloat(childOrderArr['quantity']);
                        var purchasedPrice = parseFloat(childOrderArr['purchased_price']);
                        var topVariation = (XPrice - purchasedPrice);
                        var bottomVariation = purchasedPrice;
                        var singleOrderPercentage = (topVariation / bottomVariation) * 100;
                        quantityAll += quantityChild;
                        finalValOverAll += singleOrderPercentage;
                    }// END of childOrderArr["status"]!=="canceled"
                } else {
                    // ELSE we get the orders from sold_buy_order collection
                    var childOrderArr = await getOrderSoldBuyOrder(exchange, childBuyOrderId)
                    countOrderBuy++;
                    if (typeof childOrderArr !== 'undefined' && childOrderArr["_id"] !== "" && childOrderArr["_id"] !== 'undefined') {
                        var purchasedPrice = parseFloat(childOrderArr['purchased_price']);
                        var marketSoldPrice = parseFloat(childOrderArr['market_sold_price']);
                        var topVariation = (marketSoldPrice - purchasedPrice);
                        var bottomVariation = purchasedPrice;
                        var singleOrderPercentage = (topVariation / bottomVariation) * 100;
                        finalValOverAll += singleOrderPercentage;
                    } // END of (typeof childOrderArr!=='undefined' && childOrderArr["_id"]!== "" && childOrderArr["_id"]!== 'undefined')
                }// END of else
            } // END of for(let avgIndex in avg_orders_ids)
            var profitPercAndNoOrder = definedSellPercentage * countOrderBuy;
            //console.log("finalValOverAll ::::", finalValOverAll)
            //console.log("profitPercAndNoOrder ::::", profitPercAndNoOrder)
            if (finalValOverAll > profitPercAndNoOrder) {
                await updateaverageSellprice(exchange, costParentOrderId, XPrice, type, buyOrderArrsIds, quantityAll); //Status submitted_for_sell
                console.log("XPRICE ::::", XPrice)
                var response = false;
                resolve(response);
            }// END of if(finalValOverAll > profitPercAndNoOrder)
            var response = true;
            resolve(response);
        })
    })
} // END of sumChildOrders

async function updateaverageSellprice(exchange, buy_order_id, avg_sell_price, type, byyOrderArrsIds, quantityAll){
    return new Promise((resolve) => {
        conn.then((db) => {
            var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            var set = {};
            var where = {};
            var upd_data = {};
            console.log("buy_order_id ", buy_order_id)
            if (type == "three") {
                upd_data['avg_sell_price_three'] = avg_sell_price;
                upd_data['avg_price_three_upd'] = "yes";
                upd_data['last_three_ids'] = byyOrderArrsIds;
                upd_data['quantity_three'] = quantityAll;
            } else {
                upd_data['avg_sell_price'] = avg_sell_price;
                upd_data['avg_price_all_upd'] = "yes";
                upd_data['all_buy_ids'] = byyOrderArrsIds;
                upd_data['quantity_all'] = quantityAll;
            }
            set['$set'] = upd_data;
            where._id = new ObjectID(buy_order_id);
            db.collection(collectionName).updateOne(where, set, (err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result)
                }
            })
        })
    })
} //End of updateaverageSellpric

async function getOrderBuyOrder(exchange, buy_order_id){
    return new Promise(resolve => {
        conn.then(db => {

            var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            var where = {}
            where['_id'] = new ObjectID(buy_order_id);
            where['is_sell_order'] = { $ne: "sold" };
            db.collection(collectionName).find(where).limit(1).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result[0])
                }
            })
        })
    })
}

async function getOrderSoldBuyOrder(exchange, buy_order_id){
    return new Promise(resolve => {
        conn.then(db => {

            var collectionName = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
            var where = {}
            where['_id'] = new ObjectID(buy_order_id);
            db.collection(collectionName).find(where).limit(1).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result[0])
                }
            })
        })
    })
}

async function sumLastThreeChildOrders(exchange, costParentOrderId, avg_orders_ids, XPrice, countOrderBuy, definedSellPercentage, finalValOverAllParent, quantity){
    return new Promise((resolve) => {
        conn.then(async (db) => {
            var type = "three";
            var quantityAll = 0
            var finalValOverAll = 0
            var onlyCountBuyOrder = 0
            avg_orders_ids.reverse();
            var byyOrderArrsIds = []
            for (let avgIndex = 0; avgIndex <= avg_orders_ids.length; avgIndex++) {
                var childBuyOrderId = avg_orders_ids[avgIndex];
                // Here we Get the orders from Buy order collection
                var childOrderArr = await module.exports.getOrderBuyOrder(exchange, childBuyOrderId)
                if (typeof childOrderArr !== 'undefined' && childOrderArr["_id"] !== "" && childOrderArr["_id"] !== 'undefined') {
                    if (childOrderArr["status"] !== "canceled") {
                        // *countOrderBuy* used for to count the buy orders
                        console.log("childOrderArr ::::", childOrderArr["_id"])
                        countOrderBuy++;
                        onlyCountBuyOrder++;
                        byyOrderArrsIds.push(childOrderArr["_id"])
                        var quantityChild = parseFloat(childOrderArr['quantity']);
                        var purchasedPrice = parseFloat(childOrderArr['purchased_price']);
                        var topVariation = (XPrice - purchasedPrice);
                        var bottomVariation = purchasedPrice;
                        quantityAll += quantityChild
                        var singleOrderPercentage = (topVariation / bottomVariation) * 100;
                        console.log("singleOrderPercentage BUY ORDER ::::", singleOrderPercentage)
                        finalValOverAll += singleOrderPercentage;
                    }// END of childOrderArr["status"]!=="canceled"
                }// END of typeof childOrderArr!=='undefined' && childOrderArr["_id"]!== "" && childOrderArr["_id"]!== 'undefined')
                if (onlyCountBuyOrder == 3) { console.log("onlyCountBuyOrder inside break::::", onlyCountBuyOrder); break; }
            } // END of for(let avgIndex in avg_orders_ids)
            if (onlyCountBuyOrder < 3) {
                console.log(" Why I am here in onlyCountBuyOrder");
                finalValOverAll += finalValOverAllParent;
                quantityAll += quantity;
                byyOrderArrsIds.push(costParentOrderId);
                onlyCountBuyOrder++;
            }// END of if(onlyCountBuyOrder < 3)


            var profitPercAndNoOrder = definedSellPercentage * onlyCountBuyOrder;

            if (finalValOverAll > profitPercAndNoOrder) {

                console.log("definedSellPercentage ::::", definedSellPercentage)
                console.log("onlyCountBuyOrder ::::", onlyCountBuyOrder)
                console.log("profitPercAndNoOrder ::::", profitPercAndNoOrder)
                console.log("finalValOverAll ::::", finalValOverAll)

                await module.exports.updateaverageSellprice(exchange, costParentOrderId, XPrice, type, byyOrderArrsIds, quantityAll); //
                console.log("Response is going GOOD here :::: XPrice", XPrice)
                var response = false;
                resolve(response);
            }// END of if(finalValOverAll > profitPercAndNoOrder)
            var response = true;
            resolve(response);
        })
    })
} // END of sumLastThreeChildOrders

async function getCostAverageParentOrdes(order_id, exchange, coinSymbol, order_mode, type){
    return new Promise((resolve) => {
        conn.then((db) => {

            var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;

            var search_criteria = {}
            search_criteria['_id'] = new ObjectID(String(order_id));
            if (type == "three") {
                search_criteria['avg_price_three_upd'] = { $nin: ["yes", "fraction_submitted_sell"] };
            } else {
                search_criteria['avg_price_all_upd'] = { $nin: ["yes", "fraction_submitted_sell"] };
            }
            //search_criteria['admin_id']              = "5c0912b7fc9aadaac61dd072";
            search_criteria["cost_avg"] = { $in: ["yes", "taking_child"] };
            search_criteria['order_mode'] = order_mode;
            search_criteria['is_sell_order'] = 'yes';
            search_criteria['status'] = 'FILLED';
            search_criteria['symbol'] = coinSymbol;
            search_criteria['trigger_type'] = "barrier_percentile_trigger"; // Trigger Type
            search_criteria["cavg_parent"] = "yes";
            search_criteria["avg_orders_ids"] = { $exists: true };
            //console.log("search_criteria :::::", search_criteria)
            db.collection(collectionName).find(search_criteria).limit(1).toArray((error, success) => {
                if (error) {
                    resolve(error)
                } else {
                    if (success.length > 0) {
                        var response = true;
                        resolve(success);
                    } else {
                        var response = false;
                        resolve(response);
                    }
                }
            })
        })
    })
} // END of costAvgSellOverAllOrders

async function unsetCostAvgParent(order_id, exchange) {
    return new Promise(async (resolve)=>{
        const db = await conn
        let collection_name = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
        let where = {
            '_id': new ObjectID(order_id)
        }
        let set = {
            '$unset':{
                'cost_avg': ''
            }
        }
        await db.collection(collection_name).updateOne(where, set)
        resolve(true)
    })
}

//function which have all prerequisite for buying or selling any order
function marketMinNotation(symbol) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let where = {};
            where.symbol = symbol;
            db.collection('market_min_notation').find(where).toArray((err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    var min_notation = 0;
                    if (result.length > 0) {
                        min_notation = result[0].min_notation
                    }
                    resolve(min_notation)
                }
            })
        })
    })
} //End of marketMinNotation

//function which have all prerequisite for buying or selling any order, returns step size with min notation
function marketMinNotation_with_step_size(symbol, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {

            let collectionName = exchange == 'binance' || exchange == 'bam' ? 'market_min_notation' : 'market_min_notation_'+exchange;
            let where = {};
            where.symbol = symbol;
            db.collection(collectionName).find(where).toArray((err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    var obj = {}
                    if (result.length > 0) {
                        obj['min_notation'] = result[0].min_notation
                        obj['step_size'] = result[0].stepSize
                    }
                    resolve(obj)
                }
            })
        })
    })
} //End of marketMinNotation_with_step_size

//function which have all prerequisite for buying or selling any order, returns step size with min notation
function marketMinNotation_with_step_size_arr(symbol, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {

            let collectionName = exchange == 'binance' || exchange == 'bam' ? 'market_min_notation' : 'market_min_notation_' + exchange;
            let where = {};
            where.symbol = symbol;
            db.collection(collectionName).find(where).toArray((err, result) => {
                if (err) {
                    resolve(err);
                } else {

                    let arr = []
                    if (result.length > 0) {

                        result.map(item=>{
                            var obj = {}
                            obj['symbol'] = item.symbol
                            obj['min_notation'] = item.min_notation
                            obj['step_size'] = item.stepSize
                            arr.push(obj)
                        })
                    }
                    resolve(arr)
                }
            })
        })
    })
} //End of marketMinNotation_with_step_size

//function for getting current market price
function listCurrentMarketPriceArr(coin, exchange) {
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
                db.collection(collectionName).find(where).sort({
                    "created_date": -1
                }).toArray((err, result) => {
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

} //End of listCurrentMarketPriceArr



router.post('/find_user_by_id',async(req, res) => {

  if(typeof req.body.id != 'undefined' && req.body.id != '') {
    var user_exist = await getUserByID(req.body.id, 'yes');
    if(!user_exist.success){
      res.status(200).send({
        'success': false,
        'message': 'User Not exist'
      });
    } else {
      res.status(200).send({
        'success': true,
        'message':'User Exist'
      })
    }
  } else {
    res.status(200).send({
      'success': false,
      'message': 'User id needed in id param'
    });
  }

})

router.post('/find_user', auth_token.required, async(req, res) => {



  var user_exist = await getUserByID(req.payload.id);
  // console.log(user_exist)
  if(!user_exist){
    resp.status(401).send({
          message: 'User Not exist'
      });
      return false;
  }

  if(typeof req.body.id != 'undefined' && req.body.id != '') {
    var user_exist = await getUserByID(req.body.id, 'yes');
    if(!user_exist.success){
      res.status(200).send({
        'success': false,
        'message': 'User Not exist'
      });
    } else {
      res.status(200).send({
        'success': true,
        'data':user_exist.data['trading_ip'],
        'message':'User Exist'
      })
    }
  } else {
    res.status(200).send({
      'success': false,
      'message': 'User id needed in id param'
    });
  }

})


async function getUserByID(admin_id, user_detail='no'){


  console.log(admin_id)
    return new Promise((resolve) => {
        conn.then((db) => {

            let collectionName = 'users';
            let where = {};
            where._id = ObjectID(admin_id);
            db.collection(collectionName).find(where).toArray((err, result) => {
                if (err) {
                    console.log(err)
                    if(user_detail == 'yes'){
                      resolve({
                        'success': false,
                        'message': err
                      });
                    } else {
                      resolve(false);
                    }
                } else {
                    if (result.length > 0) {
                      if(user_detail == 'yes'){
                        resolve({
                          'success': true,
                          'message': 'Data Found',
                          'data': result[0]
                        });
                      } else {
                        resolve(true)
                      }
                    } else {
                      if(user_detail == 'yes'){
                        resolve({
                          'success': false,
                          'message': 'Data not Found',
                        });
                      } else {
                        resolve(false)
                      }
                    }
                }
            })
        })
    })
}

//function for getting order list from order-list angular  component
router.post('/listOrderListing', auth_token.required , async (req, resp) => {



    // var admin_id = req.body.postData.admin_id;
    // console.log(req.payload.id)

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }


    var admin_id = req.payload.id


    var application_mode = req.body.postData.application_mode;
    var postDAta = req.body.postData;
    var exchange = postDAta.exchange;

    var countArr = getOrderStats(postDAta)
    var userBalanceArr = get_user_wallet(admin_id, exchange)
    var avg_profit = 0; //total_profit / total_quantity;



    // console.log(req.body.postData,'-=-=-=-=--=-=-=-=-=-=-=-=-=-=')
    //function for listing orders

    let pricesObj = await get_current_market_prices(exchange, [])

    var BTCUSDTPRICE = parseFloat(pricesObj['BTCUSDT'])

    var orderListing = await listOrderListing(postDAta);

    var customOrderListing = [];

    var currentMarketPrice = 0;

    for (let index in orderListing) {

        // if(index >= 1){break}

        let currSymbol = orderListing[index].symbol
        currentMarketPrice = pricesObj[currSymbol]

        if (orderListing[index].status == 'new') {
            var convertToBtc = orderListing[index].quantity * currentMarketPrice;
            let splitArr = orderListing[index].symbol.split('USDT');
            var coinPriceInBtc = ((splitArr.length > 1) && (splitArr[1] == '')) ? ((orderListing[index].quantity) * currentMarketPrice) : (BTCUSDTPRICE * convertToBtc);
        } else {

            let order_price = (typeof orderListing[index].purchased_price != 'undefined' && orderListing[index].purchased_price != '' && !isNaN(parseFloat(orderListing[index].purchased_price)) ? parseFloat(orderListing[index].purchased_price) : currentMarketPrice)

            var convertToBtc = orderListing[index].quantity * order_price;
            let splitArr = orderListing[index].symbol.split('USDT');
            var coinPriceInBtc = ((splitArr.length > 1) && (splitArr[1] == '')) ? ((orderListing[index].quantity) * order_price) : (BTCUSDTPRICE * convertToBtc);

            //sold usd worth will not change
            if (orderListing[index]['is_sell_order'] == 'sold' && typeof orderListing[index]['market_sold_price_usd'] != 'undefined' && orderListing[index]['market_sold_price_usd'] != '' && !isNaN(parseFloat(orderListing[index]['market_sold_price_usd']))) {
                coinPriceInBtc = ((splitArr.length > 1) && (splitArr[1] == '')) ? ((orderListing[index].quantity) * orderListing[index]['market_sold_price']) : orderListing[index]['market_sold_price_usd'];
            }

        }

        var order = orderListing[index];
        order['customCurrentMarketPrice'] = parseFloat(currentMarketPrice).toFixed(8);

        let buy_trail_price = (typeof orderListing[index].buy_trail_price == 'undefined') ? 0 : orderListing[index].buy_trail_price;
        order['buy_trail_price_custom'] = (orderListing[index].trail_check == 'yes') ? (parseFloat(buy_trail_price).toFixed(8)) : '---';

        let actualPurchasePrice = (orderListing[index].status != 'new' && orderListing[index].status != 'eror') ? parseFloat(orderListing[index].purchased_price).toFixed(8) : parseFloat(currentMarketPrice).toFixed(8);

        order['actualPurchasePrice'] = isNaN(actualPurchasePrice) ? '---' : actualPurchasePrice;
        order['coinPriceInBtc'] = parseFloat(coinPriceInBtc).toFixed(2);
        order['quantity'] = (isNaN(parseFloat(parseFloat(order['quantity']).toFixed(8))) ? '' : parseFloat(parseFloat(order['quantity']).toFixed(8)))
        order['price'] = (isNaN(order['price']) ? '' : parseFloat(order['price']).toFixed(8))

        let market_sold_price = (typeof orderListing[index].market_sold_price == 'undefined') ? 0 : orderListing[index].market_sold_price;

        order['actualSoldPrice'] = parseFloat(isNaN(market_sold_price) ? '---' : market_sold_price).toFixed(8);




        var htmlStatus = '';
        var htmlStatusArr = [];

        var status = (typeof orderListing[index].status == 'undefined') ? '' : orderListing[index].status
        var is_sell_order = (typeof orderListing[index].is_sell_order == 'undefined') ? '' : orderListing[index].is_sell_order;
        var sellOrderId = (typeof orderListing[index].sell_order_id != 'undefined') ? orderListing[index].sell_order_id : '';
        var is_lth_order = (typeof orderListing[index].is_lth_order == 'undefined') ? '' : orderListing[index].is_lth_order
        var fraction_sell_type = (typeof orderListing[index].fraction_sell_type == 'undefined') ? '' : orderListing[index].fraction_sell_type;
        var fraction_buy_type = (typeof orderListing[index].fraction_buy_type == 'undefined') ? '' : orderListing[index].fraction_buy_type;

        var parent_status = (typeof orderListing[index].parent_status == 'undefined') ? '' : orderListing[index].parent_status;




        var sell_profit_percent = (typeof orderListing[index].sell_profit_percent == 'undefined') ? '' : orderListing[index].sell_profit_percent;
        var lth_profit = (typeof orderListing[index].lth_profit == 'undefined') ? '' : orderListing[index].lth_profit;

        var trigger_type = (typeof orderListing[index].trigger_type == 'undefined') ? '' : orderListing[index].trigger_type;

        var sell_order_id = (typeof orderListing[index].sell_order_id == 'undefined') ? '' : orderListing[index].sell_order_id;

        // var targetPrice = sell_profit_percent;

        // if (trigger_type == 'no' && sell_order_id != '') {
        //     //get sell order on the base of buy orders
        //     var sellOrder = await listSellOrderById(sell_order_id, exchange);
        //     if (sellOrder.length > 0) {
        //         let sellArr = sellOrder[0];
        //         let sell_profit_percent = (typeof sellArr.sell_profit_percent == 'undefined') ? '--' : sellArr.sell_profit_percent;
        //         targetPrice = (status == 'LTH') ? lth_profit : sell_profit_percent;
        //     } else {
        //         targetPrice = '';
        //     }
        // } else {
        //     targetPrice = (status == 'LTH') ? lth_profit : sell_profit_percent;
        // }

        // console.log(targetPrice + '---------' + sell_profit_percent)
        var targetPrice = (status == 'LTH') ? parseFloat(parseFloat(lth_profit).toFixed(2)) : parseFloat(parseFloat(sell_profit_percent).toFixed(2));
        order['targetPrice'] = (isNaN(targetPrice)) ? '---' : targetPrice

        // var orderSellPrice = (typeof orderListing[index].market_sold_price == 'undefined' || orderListing[index].market_sold_price == '') ? '' : orderListing[index].market_sold_price;
        // var orderPurchasePrice = (typeof orderListing[index].purchased_price == 'undefined' || orderListing[index].purchased_price == '') ? 0 : orderListing[index].purchased_price;

        var orderSellPrice = (typeof orderListing[index].market_sold_price != 'undefined' && orderListing[index].market_sold_price != '' && !isNaN(parseFloat(orderListing[index].market_sold_price))) ? parseFloat(orderListing[index].market_sold_price) : '';

        var orderPurchasePrice = (typeof orderListing[index].purchased_price != 'undefined' && orderListing[index].purchased_price != '' && !isNaN(parseFloat(orderListing[index].purchased_price))) ? parseFloat(orderListing[index].purchased_price) : 0;

        var profitLossPercentageHtml = '';

        let resumePL = 0
        if (typeof orderListing[index].resume_order_arr != 'undefined' && orderListing[index].resume_order_arr != null && orderListing[index].resume_order_arr.length > 0){
            await Promise.all(orderListing[index].resume_order_arr.map(item => {
                resumePL = parseFloat(resumePL) + parseFloat(item.resumeLossPercentage)
            }))
        }

        //part for calculating profit loss percentage
        if (orderSellPrice != '') {
            //function for calculating percentage
            let profitLossPercentage = calculate_percentage(orderPurchasePrice, orderSellPrice);
            // resumePL = parseFloat(resumePL) + parseFloat(profitLossPercentage)
            let profitLossCls = (orderSellPrice > orderPurchasePrice) ? 'success' : 'danger';
            profitLossPercentageHtml = '<span class="text-' + profitLossCls + '"><b>' + profitLossPercentage + '%</b></span>';
        } else {
            if (status == 'FILLED' || status == 'LTH') {
                if (is_sell_order == 'yes' || status == 'LTH') {
                    let percentage = calculate_percentage(orderPurchasePrice, currentMarketPrice);

                    if (postDAta.status == 'open'){
                        resumePL = parseFloat(resumePL) + parseFloat(percentage)
                    }
                    let PLCls = (currentMarketPrice > orderPurchasePrice) ? 'success' : 'danger'
                    profitLossPercentageHtml = '<span class="text-' + PLCls + '"><b>' + percentage + '%</b></span>';
                } else {
                    profitLossPercentageHtml = '<span class="text-default"><b>---</b></span>';
                }
            } else {
                profitLossPercentageHtml = '<span class="text-default"><b>-</b></span>';
            }
        } //End of profit loss Percentage

        if (trigger_type == 'no' && status == 'new' && typeof orderListing[index].deep_price_on_off != 'undefined' && orderListing[index].deep_price_on_off == 'yes' && typeof orderListing[index].expecteddeepPrice != 'undefined' && orderListing[index].expecteddeepPrice != ''){
            let expecteddeepPrice = orderListing[index].expecteddeepPrice
            let profitLossPercentage = calculate_percentage(parseFloat(expecteddeepPrice), currentMarketPrice);
            let PLCls = (currentMarketPrice <= expecteddeepPrice) ? 'success' : 'default'
            profitLossPercentageHtml = '<span class="text-' + PLCls + '"><b>' + Math.abs(profitLossPercentage) + '%</b></span>';

        } else if (trigger_type == 'no' && status == 'new' && (typeof orderListing[index].deep_price_on_off == 'undefined' || orderListing[index].deep_price_on_off != 'yes') && typeof orderListing[index].price != 'undefined' && orderListing[index].price != ''){

            let expecteddeepPrice = orderListing[index].price
            let profitLossPercentage = calculate_percentage(parseFloat(expecteddeepPrice), currentMarketPrice);
            let PLCls = (currentMarketPrice <= expecteddeepPrice) ? 'success' : 'default'
            profitLossPercentageHtml = '<span class="text-' + PLCls + '"><b>' + Math.abs(profitLossPercentage) + '%</b></span>';
        }

        order['profitLossPercentageHtml'] = profitLossPercentageHtml;

        let is_sold = false

        let pause_status_arr = ['pause', 'resume_pause', 'resume_complete']
        let front_status_arr = [];

        let is_resumed_label_added = false

        var childProfitLossPercentageHtml = '-'
        //part for showing different status labels
        if ((status == 'FILLED' && is_sell_order == 'yes') || status == "LTH") {
            var SellStatus = (sellOrderId == '') ? '' : await listSellOrderStatus(sellOrderId, exchange);
            order['sell_status'] = SellStatus;
            if (SellStatus == 'error') {
                htmlStatus += '<span class="badge badge-danger">ERROR IN SELL</span>';
                htmlStatusArr.push('ERROR IN SELL')
            } else if (SellStatus == 'submitted') {
                htmlStatus += '<span class="badge badge-success">SUBMITTED FOR SELL</span>';
                htmlStatusArr.push('SUBMITTED FOR SELL')
            } else {
                htmlStatus += '<span class="badge badge-info">WAITING FOR SELL </span>';
                htmlStatusArr.push('WAITING FOR SELL')
            }
        } else if (status == 'FILLED' && (is_sell_order == 'sold' || pause_status_arr.includes(is_sell_order))) {

            if (pause_status_arr.includes(is_sell_order)) {
                if (is_sell_order == 'pause') {
                    htmlStatus += '<span class="badge badge-success">Paused</span>';
                    htmlStatusArr.push('Paused')
                    front_status_arr.push('Paused')
                } else if (is_sell_order == 'resume_pause') {

                    if (typeof orderListing[index].resume_order_arr != 'undefined' && orderListing[index].resume_order_arr != null && orderListing[index].resume_order_arr.length > 0){
                        htmlStatus += '<span class="badge badge-info">In progress</span>';
                        htmlStatusArr.push('In progress')
                        front_status_arr.push('In progress')
                    }else{
                        htmlStatusArr.push('Resumed')
                        htmlStatus += '<span class="badge badge-warning">Resumed</span>';
                        is_resumed_label_added = true
                    }

                    //TODO: find child trade current profit
                    let child_order = await listOrderById(orderListing[index]._id, exchange)
                    child_order = (child_order.length > 0 ? child_order[0] : false)
                    if (child_order) {
                        let childPurchasePrice = (typeof child_order.purchased_price == 'undefined' || child_order.purchased_price == '') ? 0 : child_order.purchased_price;
                        let childPercentage = calculate_percentage(childPurchasePrice, currentMarketPrice);
                        if (currentMarketPrice > childPurchasePrice) {
                            childProfitLossPercentageHtml = '<span class="text-success"><b>' + childPercentage + '%</b></span>';
                        }
                    }

                } else if (is_sell_order == 'resume_complete') {
                    htmlStatus += '<span class="badge badge-warning">Completed</span>';
                    htmlStatusArr.push('Resumed')
                    front_status_arr.push('Completed')
                    //TODO: find child trade profit
                    let child_order = await listOrderById(orderListing[index]._id, exchange)
                    child_order = (child_order.length > 0 ? child_order[0] : false)
                    if (child_order) {
                        let childPurchasePrice = (typeof child_order.purchased_price == 'undefined' || child_order.purchased_price == '') ? 0 : child_order.purchased_price;
                        let marketSoldPrice = (typeof child_order.market_sold_price == 'undefined' || child_order.market_sold_price == '') ? 0 : child_order.market_sold_price;
                        let childPercentage = calculate_percentage(childPurchasePrice, marketSoldPrice);
                        if (marketSoldPrice > childPurchasePrice) {
                            childProfitLossPercentageHtml = '<span class="text-success"><b>' + childPercentage + '%</b></span>';
                        }
                    }

                }
            } else if (is_lth_order == 'yes' || (typeof orderListing[index].cavg_parent != 'undefined' && orderListing[index].cavg_parent == 'yes' && typeof orderListing[index].move_to_cost_avg != 'undefined' && orderListing[index].move_to_cost_avg == 'yes' && (typeof orderListing[index].avg_orders_ids == 'undefined' || orderListing[index].avg_orders_ids.length == 0))) {

                //if order is sold and no child is buy
                if (postDAta.status == 'costAvgTab' && typeof orderListing[index].cavg_parent != 'undefined' && orderListing[index].cavg_parent == 'yes' && typeof orderListing[index].move_to_cost_avg != 'undefined' && orderListing[index].move_to_cost_avg == 'yes' && (typeof orderListing[index].avg_orders_ids == 'undefined' || orderListing[index].avg_orders_ids.length == 0)){



                  var totalBuyOrders = typeof orderListing[index]['cost_avg_array'] != 'undefined' && orderListing[index]['cost_avg_array'].length > 0 ? orderListing[index]['cost_avg_array'].filter(order => order.order_sold == 'no').map(order => order.order_sold) : []

                  if(totalBuyOrders.length > 0){
                    htmlStatus += '<span class="badge umerr badge-info">WAITING FOR SELL</span>';
                    htmlStatusArr.push('WAITING FOR SELL')
                  } else {
                    htmlStatus += '<span class="badge umerr badge-warning">WAITING FOR BUY</span>';
                    htmlStatusArr.push('WAITING FOR BUY')
                  }

                    //if order is sold and child exists
                } else if (postDAta.status == 'costAvgTab' && typeof orderListing[index].cavg_parent != 'undefined' && orderListing[index].cavg_parent == 'yes' && typeof orderListing[index].move_to_cost_avg != 'undefined' && orderListing[index].move_to_cost_avg == 'yes' && typeof orderListing[index].avg_orders_ids != 'undefined' && orderListing[index].avg_orders_ids.length > 0){
                    htmlStatus += '<span class="badge badge-info">WAITING FOR SELL</span>';
                    htmlStatusArr.push('WAITING FOR SELL')

                } else {
                    htmlStatus += '<span class="badge badge-warning">LTH</span> <span class="badge badge-success">Sold</span>';
                    htmlStatusArr.push('LTH')
                    htmlStatusArr.push('Sold')
                }


                is_sold = true
            } else {
                htmlStatus += '<span class="badge badge-success">Sold</span>';
                htmlStatusArr.push('Sold')
                is_sold = true
            }
        } else {

            let errorStatusArr = [
                'error',
                'LTH_ERROR',
                'FILLED_ERROR',
                'submitted_ERROR',
                'new_ERROR',
                'canceled_ERROR',
                'SELL_ID_ERROR',
                'BUY_ID_ERROR',
            ]

            var statusClass = errorStatusArr.includes(status) ? 'danger' : 'success'
            status = (parent_status == 'parent') ? parent_status : status;
            if (errorStatusArr.includes(status)) {
                let err_lth_filled = status.replace('_', ' ')
                htmlStatus += '<span class="badge badge-' + statusClass + '">' + err_lth_filled + '</span>';
                htmlStatusArr.push(err_lth_filled)
            } else if(status != 'pause') {
              if(is_sell_order == 'sold' && orderListing[index].move_to_cost_avg == 'yes' && status == 'CA_SOLD_MOVE'){
                htmlStatus += '<span class="badge badge-warning">WAITING FOR BUY</span>';
                htmlStatusArr.push('WAITING FOR BUY');
              } else if(status == 'CA_TAKING_CHILD'){
                htmlStatus += '<span class="badge badge-info">WAITING FOR SELL</span>';
                htmlStatusArr.push('WAITING FOR SELL');
              } else {
                htmlStatus += '<span class="badge huzaifaa badge-' + statusClass + '">' + status + '</span>';
                htmlStatusArr.push(status);
              }


            }
        }

        if (fraction_sell_type == 'parent' || fraction_sell_type == 'child') {
            htmlStatus += '<span class="badge badge-warning" style="margin-left:4px;">Sell Fraction</span>';
            htmlStatusArr.push('Sell Fraction')
        } else if (fraction_buy_type == 'parent' || fraction_buy_type == 'child') {
            htmlStatus += '<span class="badge badge-warning" style="margin-left:4px;">Buy Fraction</span>';
            htmlStatusArr.push('Buy Fraction')
        }

        order['resume_order_id_exists'] = false
        order['resumeStopped'] = false
        order['showResume'] = true
        if (typeof orderListing[index].resume_order_id != 'undefined') {
            order['showResume'] = false
            order['resume_order_id_exists'] = true

            if (front_status_arr.length > 0){
                //Do nothing
            }else if(status == 'pause'){
                htmlStatus += '<span class="badge badge-warning" style="margin-left:4px;">Resume Stopped</span>';
                htmlStatusArr.push('Resume Stopped')
                order['resumeStopped'] = true
            } else if (!is_resumed_label_added){
                htmlStatus += '<span class="badge badge-warning" style="margin-left:4px;">Resumed</span>';
                htmlStatusArr.push('Resumed')
            }

            let resumePlClass = resumePL > 0 ? 'success' : 'danger'

            let lastRow = false
            //lth_pause check
            if (typeof orderListing[index].status != 'undefined' && (orderListing[index].status == 'pause' || orderListing[index].status == 'FILLED') && typeof orderListing[index].is_sell_order != 'undefined' && (orderListing[index].is_sell_order == 'pause' || orderListing[index].is_sell_order == 'resume_pause')) {
                lastRow = true
                //sold check
            } else if (typeof orderListing[index].is_sell_order != 'undefined' && orderListing[index].is_sell_order == 'sold') {
                lastRow = true
            }
            if (lastRow){
                // let lossPercent = (typeof orderListing[index].custom_stop_loss_percentage != 'undefined') && !isNaN(parseFloat(orderListing[index].custom_stop_loss_percentage)) ? parseFloat(orderListing[index].custom_stop_loss_percentage) : 0

                let pl = parseFloat((((orderListing[index].market_sold_price - orderListing[index].purchased_price) / orderListing[index].purchased_price) * 100).toFixed(2));
                pl = !isNaN(pl) ? pl : 0

                if (postDAta.status == 'lth_pause') {

                    let sell_p = typeof orderListing[index].last_sell != 'undefined' && orderListing[index].last_sell != '' ? orderListing[index].last_sell : orderListing[index].market_sold_price
                    let purchase_p = typeof orderListing[index].last_purchase != 'undefined' && orderListing[index].last_purchase != '' ? orderListing[index].last_purchase : orderListing[index].purchased_price

                    sell_p = parseFloat(sell_p)
                    purchase_p = parseFloat(purchase_p)

                    pl = parseFloat((((sell_p - purchase_p) / purchase_p) * 100).toFixed(2));
                    pl = !isNaN(pl) ? pl : 0

                }

                resumePL = parseFloat(resumePL) + parseFloat(pl)
                resumePlClass = resumePL > 0 ? 'success' : 'danger'

                if (postDAta.status == 'lth_pause') {
                    order['profitLossPercentageHtml'] = '<span class="text-' + resumePlClass + '"> <b>' + resumePL.toFixed(2) + '%</b></span>'
                }

            }
            resumePL = resumePL.toFixed(2)
            // if(is_sold){
            //     order['profitLossPercentageHtml'] = '<span class="text-' + resumePlClass + '"><b>' + resumePL + '%</b></span>';
            // }
            htmlStatus += ' <span class="text-' + resumePlClass + '" style="margin-left:4px;" ><b>' + resumePL + '%</b></span>'
            htmlStatusArr.push(resumePL)
        }

        if (typeof orderListing[index].secondary_resume_level != 'undefined') {
            order['order_level'] = orderListing[index].secondary_resume_level
        }

        if (typeof orderListing[index].resume_status != 'undefined' && orderListing[index].resume_status == 'completed') {

            resumePL = parseFloat(resumePL)
            resumePlClass = resumePL > 0 ? 'success' : 'danger'
            order['profitLossPercentageHtml'] = '<span class="text-' + resumePlClass + '"> <b>' + resumePL.toFixed(2) + '%</b></span>'

            htmlStatus = '<span class="badge badge-success" style="margin-left:4px;">Resume Completed</span>';
            htmlStatusArr.push('Resume Completed')
        }

        if (postDAta.status == 'sold') {

            if (typeof orderListing[index].resume_order_arr != 'undefined' && orderListing[index].resume_order_arr != null && orderListing[index].resume_order_arr.length > 0) {
                resumePL = 0
                await Promise.all(orderListing[index].resume_order_arr.map(item => {
                    resumePL = parseFloat(resumePL) + parseFloat(item.resumeLossPercentage)
                }))
            }

            let lastRow1 = false
            if (typeof orderListing[index].status != 'undefined' && (orderListing[index].status == 'pause' || orderListing[index].status == 'FILLED') && typeof orderListing[index].is_sell_order != 'undefined' && (orderListing[index].is_sell_order == 'pause' || orderListing[index].is_sell_order == 'resume_pause')) {
                lastRow1 = true
                //sold check
            } else if (typeof orderListing[index].is_sell_order != 'undefined' && orderListing[index].is_sell_order == 'sold') {
                lastRow1 = true
            }

            let pl = 0
            if (lastRow1) {
                let sell_p = typeof orderListing[index].last_sell != 'undefined' && orderListing[index].last_sell != '' ? orderListing[index].last_sell : orderListing[index].market_sold_price
                let purchase_p = typeof orderListing[index].last_purchase != 'undefined' && orderListing[index].last_purchase != '' ? orderListing[index].last_purchase : orderListing[index].purchased_price
                sell_p = parseFloat(sell_p)
                purchase_p = parseFloat(purchase_p)
                pl = parseFloat((((sell_p - purchase_p) / purchase_p) * 100).toFixed(2));
                pl = !isNaN(pl) ? pl : 0
            }

            resumePL = parseFloat(resumePL) + parseFloat(pl)
            resumePlClass = resumePL > 0 ? 'success' : 'danger'
            order['profitLossPercentageHtml'] = '<span class="text-' + resumePlClass + '"> <b>' + resumePL.toFixed(2) + '%</b></span>'
        }


        if (exchange == 'kraken' && typeof orderListing[index]['shifted_order_label'] != 'undefined' && typeof orderListing[index]['shifted_order_label'] != ''){
            htmlStatus += '<span class="badge badge-info">' + orderListing[index]['shifted_order_label'] + '</span>';
            htmlStatusArr.push(orderListing[index]['shifted_order_label'])
        }

        // if(postDAta.status == 'new'){
        //     if (typeof orderListing[index].deep_price_on_off != 'undefined' && orderListing[index].deep_price_on_off == 'yes'){
        //         htmlStatus += '<span class="badge badge-info">Deep buy price</span>';
        //         htmlStatusArr.push('Deep buy price')
        //     }
        // }


        /* *******      Cost average code     ******  */
        // if (typeof orderListing[index]['avg_orders_ids'] != 'undefined') {
        //     htmlStatus += ' <span class="badge badge-primary">Cost Avg Parent</span> ';
        //     htmlStatusArr.push('Cost Avg Parent')
        // }

        if (postDAta.status == 'filled' && typeof orderListing[index].trigger_type != 'undefined' && orderListing[index].trigger_type != 'no' && typeof orderListing[index].cost_avg != 'undefined' && (orderListing[index].cost_avg == 'yes' || orderListing[index].cost_avg == 'taking_child')) {
            htmlStatus += ' <span class="badge badge-primary">Cost Avg</span> ';
            htmlStatusArr.push('Cost Avg')
        }else if ((postDAta.status == 'LTH' || postDAta.status == 'open') && typeof orderListing[index].trigger_type != 'undefined' && orderListing[index].trigger_type != 'no') {
            if (typeof orderListing[index].cost_avg != 'undefined' && orderListing[index].cost_avg == 'yes'){
                htmlStatus += ' <span class="badge badge-primary">Cost Avg</span> ';
                htmlStatusArr.push('Cost Avg')
            } else if (typeof orderListing[index].cost_avg != 'undefined' && orderListing[index].cost_avg == 'taking_child') {
                htmlStatus += ' <span class="badge badge-primary">Take child cost avg</span> ';
                htmlStatusArr.push('Take child cost avg')
            }
        } else if ((postDAta.status == 'parent' || postDAta.status == 'sold' || postDAta.status == 'costAvgTab') && typeof orderListing[index].trigger_type != 'undefined' && orderListing[index].trigger_type != 'no') {

            if (postDAta.status != 'sold' && typeof orderListing[index].cost_avg != 'undefined' && orderListing[index].cost_avg != ''){
                htmlStatus += ' <span class="badge badge-primary">Cost Avg</span> ';
                htmlStatusArr.push('Cost Avg')
            }

            // if (typeof orderListing[index].cost_avg != 'undefined' && orderListing[index].cost_avg == 'completed' && typeof orderListing[index]['avg_orders_ids'] != 'undefined' && orderListing[index]['avg_orders_ids'].length > 0) {
            //     htmlStatus += ' <span class="badge badge-success">Cost Avg Completed</span> ';
            //     htmlStatusArr.push('Cost Avg Completed')
            // }


            if (typeof orderListing[index].cost_avg != 'undefined' && orderListing[index].cost_avg == 'completed') {
                htmlStatus += ' <span class="badge badge-success">Cost Avg Completed</span> ';
                htmlStatusArr.push('Cost Avg Completed')
            }

            if (postDAta.status == 'costAvgTab' || postDAta.status == 'sold'){

                if (typeof orderListing[index]['avg_orders_ids'] != 'undefined' && orderListing[index]['avg_orders_ids'].length > 0){
                    let cost_avg_order_ids = orderListing[index]['avg_orders_ids']
                    let cost_avg_order_ids_count = cost_avg_order_ids.length
                    for (let i = 0; i < cost_avg_order_ids_count; i++){cost_avg_order_ids[i] = String(cost_avg_order_ids[i])}
                    cost_avg_order_ids.push(String(orderListing[index]['_id']))

                    let costAvgData = await getCostAvgPLandUsdWorth(cost_avg_order_ids, exchange)





                    if (Object.keys(costAvgData).length >0){
                        order['profitLossPercentageHtml'] = '<span class="text-' + costAvgData['curr_avg_profit_color'] + '"><b>' + costAvgData['curr_avg_profit'] + '%</b> (' + cost_avg_order_ids.length + ')</span>';
                        order['coinPriceInBtc'] = costAvgData['total_usd_worth']
                        order['targetPrice'] = costAvgData['target_avg_profit']
                        order['quantity'] = costAvgData['totalQuantity']
                        // order['targetPrice'] = orderListing[index]['defined_sell_percentage']
                    }
                    // if(orderListing[index]['cost_avg_array'] != 'undefined'){
                    //     console.log('Working')
                    //     let totalCostAvgChildOrders = typeof orderListing[index]['cost_avg_array'] != 'undefined' ? orderListing[index]['cost_avg_array'].length : -1
                    //     order['profitLossPercentageHtml'] = '<span class="text-' + costAvgData['curr_avg_profit_color'] + '"><b>' + costAvgData['curr_avg_profit'] + '%</b> (' + totalCostAvgChildOrders > -1 ? totalCostAvgChildOrders : cost_avg_order_ids.length + ')</span>';
                    // }
                }

                if (typeof orderListing[index]['is_sell_order'] != 'undefined' && orderListing[index]['is_sell_order'] == 'sold'){
                    order['actualSoldPrice'] = parseFloat(isNaN(market_sold_price) ? '---' : market_sold_price).toFixed(8);
                }else{
                    order['actualSoldPrice'] = '---'
                }
                // New Cost Avg Checks added
            }

        }
        /* *******   End Cost average code    ******  */


        order['childProfitLossPercentageHtml'] = childProfitLossPercentageHtml


        if (postDAta.status == 'parent' && status != 'canceled' && typeof orderListing[index].parent_status != 'undefined' && orderListing[index].parent_status == 'parent') {

            htmlStatus = ''
            htmlStatusArr = []

            if (typeof orderListing[index].auto_trade_generator != 'undefined' && orderListing[index].auto_trade_generator == 'yes') {
                htmlStatus += '<span class="badge badge-info ml-1" style="margin-left:4px;">ATG</span>';
                htmlStatusArr.push('ATG')
            }

            //add parent label
            htmlStatus += '<span class="badge badge-success ml-1" style="margin-left:4px;">Parent</span>';
            htmlStatusArr.push('Parent')

            if (typeof orderListing[index].cost_avg != 'undefined' && orderListing[index].cost_avg == 'yes') {
                htmlStatus += '<span class="badge badge-primary ml-1" style="margin-left:4px;">Cost Avg</span>';
                htmlStatusArr.push('Cost Avg')
            }

            if (typeof orderListing[index].cost_avg != 'undefined' && orderListing[index].status == 'takingOrder') {
                htmlStatus += '<span class="badge badge-warning ml-1" style="margin-left:4px;">Child Order in Progress</span>';
                htmlStatusArr.push('Child Order in Progress')
            }
        } else if (exchange == 'kraken' && typeof postDAta.is_global_user != 'undefined' && postDAta.is_global_user === true && (postDAta.status == 'open' || postDAta.status == 'sold') && typeof orderListing[index].transaction_logs != 'undefined' && orderListing[index]['transaction_logs'].length > 1) {

            let buy_duplicate_arr = orderListing[index]['transaction_logs'].filter(item => { return item.type == 'buy' && item.errorString == 'No Error' ? true : false; })
            let sell_duplicate_arr = orderListing[index]['transaction_logs'].filter(item => { return item.type == 'sell' && item.errorString == 'No Error' ? true : false; })

            buy_duplicate_arr = buy_duplicate_arr.filter((thing, index, self) =>
                index === self.findIndex((t) => (
                    t.txid === thing.txid
                ))
            )

            sell_duplicate_arr = buy_duplicate_arr.filter((thing, index, self) =>
                index === self.findIndex((t) => (
                    t.txid === thing.txid
                ))
            )

            let buy_duplicate = buy_duplicate_arr.length > 1 ? true : false;
            let sell_duplicate = sell_duplicate_arr.length > 1 ? true : false;

            if (buy_duplicate || sell_duplicate) {
                htmlStatus += '<span class="badge badge-danger">Doubt</span>';
                htmlStatusArr.push('Doubt')
            }
        }

        order['htmlStatus'] = htmlStatus;
        order['htmlStatusArr'] = htmlStatusArr;
        customOrderListing.push(order)
    } //End of order Iteration

    //End of labels parts

    var response = {};
    response['customOrderListing'] = customOrderListing;
    response['countArr'] = await countArr;
    response['userBalanceArr'] = await userBalanceArr;
    response['avg_profit'] = avg_profit;
    resp.status(200).send({
        message: response
    });
}) //End of listOrderListing

//function for getting user balance from user wallet
function listUserBalance(admin_id, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let where = {};
            where['user_id'] = {
                $in: [new ObjectID(admin_id), admin_id]
            };
            let collection = (exchange == 'binance') ? 'user_wallet' : 'user_wallet_' + exchange;
            db.collection(collection).find(where).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of listUserBalance

//function for calculating percentage
function calculate_percentage(purchasedPrice, sellPrice) {
    let diff = sellPrice - purchasedPrice;
    if (purchasedPrice == 0) {
        return 0;
    } else {
        let profitPercentage = (diff * 100) / purchasedPrice;
        return profitPercentage = parseFloat(profitPercentage).toFixed(2)
    }

}

//get status for sell orders
function listSellOrderStatus(sellOrderId, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let where = {};
            const checkForHexRegExp = new RegExp('^[0-9a-fA-F]{24}$');
            where['_id'] = (checkForHexRegExp.test(sellOrderId)) ? {
                '$in': [sellOrderId, new ObjectID(sellOrderId)]
            } : '';
            let collection = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
            db.collection(collection).find(where).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    if (result.length > 0) {
                        let status = (typeof result[0]['status'] != 'undefined') ? result[0]['status'] : ''
                        resolve(status);
                    } else {
                        resolve('')
                    }
                }
            })
        })
    })
} //End of listSellOrderStatus


//functioin for count collection values on the bases of filtes
function countCollection(collectionName, filter) {
    return new Promise((resolve) => {
        conn.then((db) => {
            db.collection(collectionName).find(filter).count((err, result) => {
                if (err) {
                    console.log(err)
                } else {
                    resolve(result)
                }
            })
        })
    })
} //End of countCollection


function countATGExpectedOrders(collectionName, filter) {
    return new Promise((resolve) => {
        conn.then(async (db) => {

            var data = await db.collection(collectionName).aggregate(filter).toArray();
            // console.log('Data', data)
            if(data.length > 0){
                resolve(data[0]['total']);
            } else {
              resolve(0)
            }
        })
    })
} //End of countCollection


//function for calculation average profit for a user of all his sold orders
async function calculateAverageOrdersProfit(postDAta) {

    let tempPostData = Object.assign({}, postDAta)

    var filter = {};
    filter['application_mode'] = postDAta.application_mode
    filter['admin_id'] = postDAta.admin_id
    // filter['is_sell_order'] = 'sold'
    filter['market_sold_price'] = {
        '$exists': true
    }

    filter['$or'] = [
        { 'resume_status': 'completed' },
        { 'is_sell_order': 'sold', 'resume_order_id': { '$exists': false } }
    ];
    if (!digie_admin_ids.includes(postDAta.admin_id)) {
        filter['show_order'] = { '$ne': 'no' };
    }

    if (postDAta.coins != '') {
        filter['symbol'] = {
            '$in': postDAta.coins
        }
    }

    if (postDAta.order_type != '') {
        filter['order_type'] = postDAta.order_type
    }

    if (postDAta.trigger_type != '') {
        filter['trigger_type'] = postDAta.trigger_type
    }

    if (postDAta.order_level != '') {
        filter['order_level'] = postDAta.order_level
    }


    if (postDAta.application_mode == 'live' && (postDAta.start_date != '' || postDAta.end_date != '')) {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter['modified_date'] = obj;

    } else {

        if (filter['application_mode'] == 'test') {
            let end_date = new Date()
            let start_date = new Date(new Date().setDate(new Date().getDate() - 30))
            filter['modified_date'] = {
                '$gte': start_date,
                '$lte': end_date
            };

            tempPostData.start_date = start_date
            tempPostData.end_date = end_date
        }
    }

    tempPostData.skip = 0
    tempPostData.limit = 0
    tempPostData.status = 'sold'

    let soldOrders = await listOrderListing(tempPostData)

    // soldOrders = soldOrders.filter(item => String(item._id) != '5e5f008cfd4c0b001b8f74b5')
    // console.log(soldOrders.length)

    let totalSold = soldOrders.length
    let avg_order_ids = []
    for (let i = 0; i < totalSold; i++){
        if (typeof soldOrders[i]['avg_orders_ids'] != 'undefined' && soldOrders[i]['avg_orders_ids'].length > 0){
            avg_order_ids = avg_order_ids.concat(soldOrders[i]['avg_orders_ids'])
        }
    }
    const db = await conn
    let sold_collection = postDAta.exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + postDAta.exchange
    let cost_avg_sold_childs = await db.collection(sold_collection).find({ '_id': { '$in': avg_order_ids}}).toArray()
    soldOrders = soldOrders.concat(cost_avg_sold_childs)

    // console.log(soldOrders.length)

    return soldOrders

    // var exchange = postDAta.exchange;

    // var collectionName = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;

    // return new Promise((resolve) => {
    //     conn.then((db) => {
    //         // db.collection(collectionName).find(filter).sort({ modified_date: -1 }).toArray((err, result) => {
    //         db.collection(collectionName).find(filter).toArray((err, result) => {
    //             if (err) {
    //                 console.log(err)
    //             } else {

    //                 console.log(result.length)
    //                 resolve(result)
    //             }
    //         })
    //     })
    // })
} //End of calculateAverageOrdersProfit

//function for getting all order on the base of filters
async function listOrderListing(postDAta3, dbConnection) {

    let postDAta = Object.assign({}, postDAta3)
    var filter = {};
    var pagination = {};
    var limit = postDAta.limit;
    var skip = postDAta.skip;
    var exchange = postDAta.exchange;
    filter['application_mode'] = postDAta.application_mode
    filter['admin_id'] = postDAta.admin_id
    var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;


    // On Top Because of admin_id
    if (typeof postDAta.user_name != 'undefined' && postDAta.user_name != '') {
        let tempWhere = {}
        tempWhere['$or'] = [
            {
                username_lowercase: postDAta.user_name.toLowerCase()
            }, {
                email_address: postDAta.user_name
            }
        ]


        let user = await get_user_id_using_user_name('users', tempWhere)
        var user_id = user.length > 0 ? String(user[0]['_id']) : user_id
        filter['admin_id'] = user_id;
    }

    if (postDAta.coins != '') {
        filter['symbol'] = {
            '$in': postDAta.coins
        }
    }

    if (postDAta.order_type != '') {
        filter['order_type'] = postDAta.order_type
    }

    if (postDAta.trigger_type != '') {
        filter['trigger_type'] = postDAta.trigger_type
    }

    if (postDAta.order_level != '') {
        filter['order_level'] = postDAta.order_level
    }

    if (postDAta.start_date != '' || postDAta.end_date != '') {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter['created_date'] = obj;
    }


    if ((typeof postDAta.modified_start_date != 'undefined' && postDAta.modified_start_date != '') || (typeof postDAta.modified_end_date != 'undefined' && postDAta.modified_end_date != '')) {
        let obj = {}
        if (postDAta.modified_start_date != '') {
            obj['$gte'] = new Date(postDAta.modified_start_date);
        }
        if (postDAta.modified_end_date != '') {
            obj['$lte'] = new Date(postDAta.modified_end_date);
        }
        filter['modified_date'] = obj;
    }

    if (postDAta.status == 'open') {
        // filter['status'] = {
        //     '$in': ['FILLED', 'FILLED_ERROR', 'SELL_ID_ERROR']
        // }
        // filter['is_sell_order'] = 'yes';
        // filter['is_lth_order'] = {
        //     $ne: 'yes'
        // };
        // // filter['cost_avg'] = { '$exists': false }
        // filter['cost_avg'] = { '$nin': ['taking_child', 'yes', 'completed'] }

        filter['$or'] = [
            {
                'status': { '$in': ['FILLED', 'FILLED_ERROR', 'SELL_ID_ERROR'] },
                'is_sell_order': 'yes',
                'is_lth_order': { '$ne': 'yes' },
                'cost_avg': 'yes',
                'cavg_parent': 'yes',
                'show_order': 'yes',
                'avg_orders_ids.0': { '$exists': false },
                'move_to_cost_avg': { '$ne': 'yes' },
            },
            {
                'status': { '$in': ['FILLED', 'FILLED_ERROR', 'SELL_ID_ERROR'] },
                'is_sell_order': 'yes',
                'is_lth_order': { '$ne': 'yes' },
                'cost_avg': { '$nin': ['yes', 'taking_child', 'completed'] }
            },
        ]

    }

    if (postDAta.status == 'filled' || postDAta.status == 'FILLED') {
        // filter['status'] = {
        //     '$in': ['FILLED', 'fraction_submitted_buy', 'FILLED_ERROR']
        // }
        // // filter['cost_avg'] = { '$exists': false }
        // filter['cost_avg'] = { '$nin': ['taking_child', 'yes', 'completed'] }

        filter['$or'] = [
            {
                'status': { '$in': ['FILLED', 'FILLED_ERROR', 'SELL_ID_ERROR', 'fraction_submitted_buy'] },
                // 'is_sell_order': 'yes',
                'is_sell_order': {'$ne' : 'sold'},
                'is_lth_order': { '$ne': 'yes' },
                'cost_avg': 'yes',
                'cavg_parent': 'yes',
                'show_order': 'yes',
                'avg_orders_ids.0': { '$exists': false },
                'move_to_cost_avg': { '$ne': 'yes' },
            },
            {
                'status': { '$in': ['FILLED', 'FILLED_ERROR', 'SELL_ID_ERROR', 'fraction_submitted_buy'] },
                'is_sell_order': {'$ne' : 'sold'},
                // 'is_sell_order': 'yes',
                'is_lth_order': { '$ne': 'yes' },
                'cost_avg': { '$nin': ['yes', 'taking_child', 'completed'] }
            },
        ]

    }

    if (postDAta.status == 'sold') {
        // filter['$or'] = [
        //     { 'resume_status': 'completed', 'trading_status': 'complete' },
        //     { 'is_sell_order': 'sold', 'resume_order_id': {'$exists':false}}
        // ];
        // filter['cost_avg'] = { '$nin': ['taking_child', 'yes', 'completed'] }

        filter['$or'] = [
            { 'resume_status': 'completed', 'trading_status': 'complete' },
            { 'cost_avg': 'completed', 'cavg_parent': 'yes', 'show_order': 'yes' },
            // { 'is_sell_order': 'sold', 'resume_order_id': { '$exists': false }, 'cost_avg': { '$exists': false } },
            { 'is_sell_order': 'sold', 'resume_order_id': { '$exists': false }, 'cost_avg': { '$nin': ['yes', 'taking_child', 'completed'] } },
        ];
        filter['cost_avg'] = { '$nin': ['taking_child', 'yes'] }
        filter['status'] = { '$nin': ['CA_SOLD_COMPLETE'] }

        // if (!digie_admin_ids.includes(postDAta.admin_id)){
        //     filter['$or'][0]['show_order'] = 'yes'
        // }
        if (!digie_admin_ids.includes(filter['admin_id'])){
          filter['$or'][0]['show_order'] = 'yes'
        }

        var collectionName = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
    }

    if (postDAta.status == 'costAvgTab') {
        // // filter['is_sell_order'] = 'sold'
        // filter['cost_avg'] = { '$exists': true }
        // // filter['cost_avg'] = { '$ne': '' }
        // filter['show_order'] = 'yes'
        // // filter['cavg_parent'] = 'yes'
        // // filter['avg_orders_ids'] = { '$exists': true }
        // // if (!digie_admin_ids.includes(postDAta.admin_id)){
        // //     filter['$or'][0]['show_order'] = 'yes'
        // // }

        // if (postDAta.admin_id != '5c0912b7fc9aadaac61dd072') {
        //     filter['cavg_parent'] = 'yes'
        //     // filter['avg_orders_ids'] = { '$exists': true }
        // }


        filter['$or'] = [
            {
                'cost_avg': { '$in': ['taking_child', 'yes'] },
                'cavg_parent': 'yes',
                'show_order': 'yes',
                'avg_orders_ids.0': { '$exists': false },
                'move_to_cost_avg': 'yes',
            },
            {
                'cost_avg': { '$in': ['taking_child', 'yes'] },
                'cavg_parent': 'yes',
                'show_order': 'yes',
                'avg_orders_ids.0': { '$exists': true }
            },
        ]
        filter['status'] = { '$ne': 'canceled' }

        // if (filter['admin_id'] == '5c0912b7fc9aadaac61dd072') {
        //     filter['$or'][1] = {
        //         'cost_avg': { '$exists': true },
        //         'show_order': 'yes'
        //     }
        // }

        var collectionName = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
    }

    if (postDAta.status == 'lth_pause') {
        filter['status'] = { '$in': ['FILLED', 'pause'] }
        filter['is_sell_order'] = {
            '$in': ['pause', 'resume_pause']
            // '$in': ['pause', 'resume_pause', 'resume_complete']
        };
        filter['resume_status'] = { '$ne': 'completed' }
        filter['show_order'] = { '$ne': 'no' };

        var collectionName = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
    }

    if (postDAta.status == 'parent') {
        filter['parent_status'] = 'parent'
        filter['status'] = {
            '$in': ['new', 'takingOrder']
        };
    }

    if (postDAta.status == 'LTH') {
        filter['status'] = {
            '$in': ['LTH', 'LTH_ERROR']
        };
        filter['is_sell_order'] = 'yes';
        // filter['cost_avg'] = { '$exists': false }
        filter['cost_avg'] = { '$nin': ['taking_child', 'yes', 'completed'] }
    }

    if (postDAta.status == 'new') {
        filter['status'] = {
            '$in': ['new', 'new_ERROR', 'BUY_ID_ERROR']
        };
        filter['price'] = {
            '$ne': ''
        };
    }

    if (postDAta.status == 'canceled') {
        filter['status'] = 'canceled';
        // filter['cost_avg'] = { '$nin': ['taking_child', 'yes', 'completed'] };
    }

    if (postDAta.status == 'errors') {
        filter['parent_status'] = { '$exists': false };
        filter['status'] = { '$nin': ['new', 'FILLED', 'fraction_submitted_buy', 'canceled', 'LTH', 'submitted', 'submitted_for_sell', 'fraction_submitted_sell', 'CA_TAKING_CHILD'] }
    }

    if (postDAta.status == 'submitted') {
        filter['status'] = {
            '$in': ['submitted', 'submitted_for_sell', 'fraction_submitted_sell', 'submitted_ERROR']
        }
        filter['cost_avg'] = { '$nin': ['taking_child', 'yes', 'completed'] };
    }

    //if status is all the get from both buy_orders and sold_buy_orders
    if (postDAta.status == 'all') {


        let tempAllFilter = await getAllTabFilter()
        let filter_all_2 = Object.assign(tempAllFilter, filter)
        delete filter_all_2['cost_avg']



        // Comment By Huzaifa

        // //Sold tab extra dynamic check
        // if (!digie_admin_ids.includes(postDAta.admin_id)) {
        //     filter_all_2['$or'][4]['show_order'] = 'yes'
        // }

        // //CostAvg tab extra dynamic check
        // if (postDAta.admin_id == '5c0912b7fc9aadaac61dd072') {
        //     filter_all_2['$or'][8]['show_order'] = {
        //         'cost_avg': { '$exists': true },
        //         'show_order': 'yes'
        //     }
        // }

        // if (!digie_admin_ids.includes(postDAta.admin_id)) {
        //     filter['is_sell_order'] = {
        //         '$nin': ['pause', 'resume_pause']
        //         // '$in': ['pause', 'resume_pause', 'resume_complete']
        //     };
        //     filter['resume_status'] = { '$ne': 'complete' }
        //     filter['resume_order_id'] = { '$exists': false };
        //     filter['resumed_parent_buy_order_id'] = { '$exists': false }
        // }

        //Sold tab extra dynamic check
        if (!digie_admin_ids.includes(filter['admin_id'])) {
          filter_all_2['$or'][4]['show_order'] = 'yes'
        }

        //CostAvg tab extra dynamic check
        if (filter['admin_id'] == '5c0912b7fc9aadaac61dd072') {
            filter_all_2['$or'][8]['show_order'] = {
                'cost_avg': { '$exists': true },
                'show_order': 'yes'
            }
        }

        if (!digie_admin_ids.includes(filter['admin_id'])) {
            filter['is_sell_order'] = {
                '$nin': ['pause', 'resume_pause']
                // '$in': ['pause', 'resume_pause', 'resume_complete']
            };
            filter['resume_status'] = { '$ne': 'complete' }
            filter['resume_order_id'] = { '$exists': false };
            filter['resumed_parent_buy_order_id'] = { '$exists': false }
        }

        filter['cost_avg'] = { '$nin': ['taking_child', 'yes', 'completed'] }

        var soldOrdercollection = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
        var buyOrdercollection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
        // var SoldOrderArr = await list_orders_by_filter(soldOrdercollection, filter, pagination, limit, skip);
        // var buyOrderArr = await list_orders_by_filter(buyOrdercollection, filter, pagination, limit, skip);



        // console.log(filter_all_2, pagination, limit, skip, '=================')

        var SoldOrderArr = await list_orders_by_filter(soldOrdercollection, filter_all_2, pagination, limit, skip);
        var buyOrderArr = await list_orders_by_filter(buyOrdercollection, filter_all_2, pagination, limit, skip);

        // var returnArr = mergeOrdersArrays(SoldOrderArr, buyOrderArr);
        var returnArr = SoldOrderArr.concat(buyOrderArr);
        var orderArr = returnArr.slice().sort((a, b) => b.modified_date - a.modified_date)
    } else if (postDAta.status == 'costAvgTab') {

        var soldOrdercollection = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
        var buyOrdercollection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
        var SoldOrderArr = await list_orders_by_filter(soldOrdercollection, filter, pagination, limit, skip);
        var buyOrderArr = await list_orders_by_filter(buyOrdercollection, filter, pagination, limit, skip);

        // console.log(SoldOrderArr.length, buyOrderArr.length)
        var returnArr = SoldOrderArr.concat(buyOrderArr);
        var orderArr = returnArr.slice().sort((a, b) => b.modified_date - a.modified_date)

    } else {
        var orderArr = await list_orders_by_filter(collectionName, filter, pagination, limit, skip);
    }
    return orderArr;
} //End of listOrderListing


//get User id using username
function get_user_id_using_user_name(collectionName, filter) {
  return new Promise((resolve) => {
      conn.then((db) => {
          db.collection(collectionName).find(filter).project({ '_id': 1 }).toArray((err, result) => {
              if (err) {
                  console.log(err)
              } else {
                  resolve(result)
              }
          })
      })
  })
} //End of list_orders

//function for merging both buy_orders and sold_buy_orders
function mergeOrdersArrays(SoldOrderArr, buyOrderArr) {
    let merged = [];
    let index1 = 0;
    let index2 = 0;
    let current = 0;

    while (current < (SoldOrderArr.length + buyOrderArr.length)) {

        let isSoldOrderArrDepleted = index1 >= SoldOrderArr.length;
        let isbuyOrderArrDepleted = index2 >= buyOrderArr.length;

        if (!isSoldOrderArrDepleted && (isbuyOrderArrDepleted || (SoldOrderArr[index1] < buyOrderArr[index2]))) {
            merged[current] = SoldOrderArr[index1];
            index1++;
        } else {
            merged[current] = buyOrderArr[index2];
            index2++;
        }

        current++;
    }

    return merged;
} //End of mergeOrdersArrays



//list all orders on the base filter
function list_orders_by_filter(collectionName, filter, pagination, limit, skip) {
    return new Promise((resolve) => {
        conn.then((db) => {
            db.collection(collectionName).find(filter, pagination).limit(limit).skip(skip).sort({
                modified_date: -1
            }).toArray((err, result) => {
                if (err) {
                    console.log(err)
                } else {
                    resolve(result)
                }
            })
        })
    })
} //End of list_orders


router.post('/getMergeOrders', auth_token.required, async (req, res)=>{


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let user_id = req.body.user_id
    let symbol = req.body.symbol
    let tab = req.body.tab
    let exchange = req.body.exchange

    if(typeof user_id != 'undefined' && user_id != '' && typeof symbol != 'undefined' && symbol != '' && typeof tab != 'undefined' && tab != '' && typeof exchange != 'undefined' && exchange != ''){

        const db = await conn
        var collectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_'+ exchange

        let where = {}

        where['admin_id'] = user_id
        where['symbol'] = symbol
        where['application_mode'] = 'live'
        where['trigger_type'] = 'barrier_percentile_trigger'
        // where['order_level'] = ''
        where['$or'] = []

        // if (tab == 'openTab') {
            let openTab = {}
            openTab['$or'] = [
                {
                    'status': { '$in': ['FILLED', 'FILLED_ERROR', 'SELL_ID_ERROR'] },
                    'is_sell_order': 'yes',
                    'is_lth_order': { '$ne': 'yes' },
                    'cost_avg': 'yes',
                    'cavg_parent': 'yes',
                    'show_order': 'yes',
                    'avg_orders_ids.0': { '$exists': false },
                    'move_to_cost_avg': { '$ne': 'yes' },
                },
                {
                    'status': { '$in': ['FILLED', 'FILLED_ERROR', 'SELL_ID_ERROR'] },
                    'is_sell_order': 'yes',
                    'is_lth_order': { '$ne': 'yes' },
                    'cost_avg': { '$nin': ['yes', 'taking_child', 'completed'] }
                },
            ]

            where['$or'].push(openTab)
        // }

        // if (tab == 'lthTab') {

            let lthTab = {}
            lthTab['status'] = {
                '$in': ['LTH', 'LTH_ERROR']
            };
            lthTab['is_sell_order'] = 'yes';
            lthTab['cost_avg'] = { '$nin': ['taking_child', 'yes', 'completed'] }

            where['$or'].push(lthTab)
        // }

        // if (tab == 'costAvgTab') {

            let costAvgTab = {}

            costAvgTab['$or'] = [
                {
                    'cost_avg': { '$in': ['taking_child', 'yes'] },
                    'cavg_parent': 'yes',
                    'show_order': 'yes',
                    'avg_orders_ids.0': { '$exists': false },
                    'move_to_cost_avg': 'yes',
                },
                // {
                //     'cost_avg': { '$in': ['taking_child', 'yes'] },
                //     'cavg_parent': 'yes',
                //     'show_order': 'yes',
                //     'avg_orders_ids.0': { '$exists': true }
                // },
            ]
            costAvgTab['status'] = { '$ne': 'canceled' }

            where['$or'].push(costAvgTab)

            var collectionName = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
        // }

        // if (tab == 'soldTab') {

            let soldTab = {}

            soldTab['$or'] = [
                { 'resume_status': 'completed', 'trading_status': 'complete' },
                { 'cost_avg': 'completed', 'cavg_parent': 'yes', 'show_order': 'yes' },
                { 'is_sell_order': 'sold', 'resume_order_id': { '$exists': false }, 'cost_avg': { '$nin': ['', 'yes', 'taking_child', 'completed'] } },
            ];
            soldTab['cost_avg'] = { '$nin': ['taking_child', 'yes'] }
            soldTab['trade_history_issue'] = { '$exists': true }

            // if (!digie_admin_ids.includes(user_id)) {
                soldTab['$or'][0]['show_order'] = 'yes'
            // }

            where['$or'].push(soldTab)

            var collectionName = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
        // }

        // if (tab == 'costAvgTab') {
            var soldOrdercollection = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
            var buyOrdercollection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            var SoldOrderArr = await db.collection(soldOrdercollection).find(where).toArray();
            var buyOrderArr = await db.collection(buyOrdercollection).find(where).toArray();

        console.log('Sold orders ', SoldOrderArr.length, '   -----   Buy orders ', buyOrderArr.length)
            var returnArr = SoldOrderArr.concat(buyOrderArr);
            var orderArr = returnArr.slice().sort((a, b) => b.modified_date - a.modified_date)
        // } else {
        //     var orderArr = await db.collection(collectionName).find(where).toArray();
        // }

        // console.log(where)
        // console.log('tab: ', tab, '  -----  total orders: ', orderArr.length)

        if (orderArr.length > 0){
            res.send({
                'status': true,
                'data': orderArr,
                'message': 'data found'
            })
        }else{
            res.send({
                'status': false,
                'message': 'data not found'
            })
        }

    }else{
        res.send({
            'status':false,
            'message':'Invalid request'
        })
    }

})

router.post('/mergeAndMigrate', auth_token.required, async (req, res)=>{


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let mergedOrder = req.body.mergedOrder
    // let user_id = req.body.user_id
    let user_id = req.payload.id
    let tab = req.body.tab
    let exchange = req.body.exchange



    if (typeof user_id != 'undefined' && user_id != '' && typeof tab != 'undefined' && tab != '' && typeof exchange != 'undefined' && exchange != '', typeof mergedOrder != 'undefined' && mergedOrder.length > 0){

        const db = await conn
        var buy_collection = 'buy_orders'
        var sell_collection = 'sold_buy_orders'
        var buy_collection_kraken = 'buy_orders_kraken'
        var sell_collection_kraken = 'orders_kraken'

        // console.log(req.body)
        await db.collection('tempMergeTrades_testing').insertOne(req.body)
        // process.exit(1)

        let new_order = Object.assign(mergedOrder[0])
        new_order['_id'] = new ObjectID(new_order['_id'])
        mergedOrder[0]['all_merge_orders'] = mergedOrder[0]['all_merge_orders'].filter(item => {return item._id != new_order._id})
        mergedOrder[0]['merge_ids'] = mergedOrder[0]['merge_ids'].filter(item => {return item != new_order._id})

        let temp_all_merge_orders = mergedOrder[0]['all_merge_orders']

        let all_merge_orders = temp_all_merge_orders.map(item=>{
            let obj = item
            obj['created_date'] = new Date(obj['created_date'])
            obj['modified_date'] = new Date(obj['modified_date'])
            obj['_id'] = new ObjectID(obj['_id'])
            obj['buy_parent_id'] = new ObjectID(obj['buy_parent_id'])
            obj['sell_order_id'] = new ObjectID(obj['sell_order_id'])

            if (typeof obj['buy_date'] != 'undefined' && obj['buy_date'] != ''){
                obj['buy_date'] = new Date(obj['buy_date'])
            }
            if (typeof obj['sell_date'] != 'undefined' && obj['sell_date'] != ''){
                obj['sell_date'] = new Date(obj['sell_date'])
            }
            return obj;
        })

        /*********  Check minQuantity  ****************/
        //get curent market prices
        let coin = new_order['symbol']
        var whereCoins = { '$in': [coin, 'BTCUSDT'] }
        var coinData = await listmarketPriceMinNotationCoinArr(whereCoins, 'kraken')
        var BTCUSDTPRICE = parseFloat(coinData['BTCUSDT']['currentmarketPrice'])

        var currentMarketPrice = parseFloat(coinData[coin]['currentmarketPrice'])
        var marketMinNotation = coinData[coin]['marketMinNotation']
        var marketMinNotationStepSize = coinData[coin]['marketMinNotationStepSize']
        var toFixedNum = 6

        //find min required quantity
        var extra_qty_percentage = 40;
        var extra_qty_val = 0;
        extra_qty_val = (extra_qty_percentage * marketMinNotation) / 100
        var calculatedMinNotation = parseFloat(marketMinNotation) + extra_qty_val;
        var minReqQty = 0;
        minReqQty = (calculatedMinNotation / currentMarketPrice);

        if (true) {
            // if (exchange == 'kraken') {
            minReqQty = calculatedMinNotation
            toFixedNum = 6
        } else {
            // toFixedNum = (marketMinNotationStepSize + '.').split('.')[1].length
        }

        minReqQty += marketMinNotationStepSize
        minReqQty = parseFloat(minReqQty.toFixed(toFixedNum))
        /*********  End Check minQuantity  ************/

        let totalQty = 0
        totalQty += parseFloat(new_order['quantity'], new_order['quantity'])
        temp_all_merge_orders.forEach(item => { totalQty += parseFloat(item['quantity']) })

        // console.log(new_order['quantity'], totalQty, minReqQty)

        // console.log(new_order)
        // console.log('***********************************************************')
        // console.log(temp_all_merge_orders)
        // process.exit(1)

        if (totalQty < minReqQty) {

            //return with message
            res.send({
                'status': false,
                'message': 'Minimum Quantity Should Be ' + minReqQty
            })

        } else {
            //process this order

                delete new_order['all_merge_orders']
                // delete new_order['_id']
                // delete new_order['sell_order_id']
                new_order['merge_ids']

                let temp_avg_orders_ids = []
                let avgPurchasedPricesArr = [
                    {
                        'purchased_price': new_order['purchased_price']
                    }
                ]


                all_merge_orders.forEach(item=>{
                    avgPurchasedPricesArr.push(
                        {
                            'purchased_price': parseFloat(item['purchased_price'])
                        }
                    )
                    temp_avg_orders_ids.push(item['_id'])
                })

                //set or unset fields from new order
                //make ids as id object
                new_order['buy_parent_id'] = new ObjectID(new_order['buy_parent_id'])
                new_order['status'] = 'FILLED'
                new_order['order_level'] = 'level_'+new_order['order_level'].split(' ')[1]
                new_order['lth_functionality'] = 'no'
                new_order['lth_profi'] = ''
                new_order['is_sell_order'] = 'yes'
                new_order['is_lth_order'] = ''
                new_order['cavg_parent'] = 'yes'
                new_order['cost_avg'] = 'yes'
                // new_order['move_to_cost_avg'] = 'yes'
                new_order['show_order'] = 'yes'
                new_order['avg_purchase_price'] = avgPurchasedPricesArr
                new_order['stop_loss_rule'] = 'custom_stop_loss'
                new_order['custom_stop_loss_percentage'] = 5
                new_order['stop_loss'] = 'yes'
                // new_order['purchased_price'] = resultingFields['purchased_price']
                // new_order['sell_price'] = resultingFields['sell_price']
                // new_order['avg_sell_price'] = resultingFields['sell_price']
                // new_order['iniatial_trail_stop'] = resultingFields['iniatial_trail_stop']
                new_order['merge_migrated_order'] = 'yes'

                new_order['buy_date'] = new Date()
                new_order['created_date'] = new Date()
                new_order['modified_date'] = new Date()

                new_order['shifted_order'] = 'yes'
                new_order['shifted_order_label'] = 'shifted'
                new_order['ca_merge_migrated_order'] = 'yes'

                new_order['avg_orders_ids'] = temp_avg_orders_ids

                delete new_order['trading_status']
                delete new_order['market_sold_price']
                delete new_order['sell_date']
                delete new_order['exchange']

                //insert new order in kraken
                let insertBuyNew = await db.collection(buy_collection_kraken).insertOne(new_order)

                if (typeof insertBuyNew.insertedId != 'undefined') {
                    //insert sell order
                    let newSellOrder = {
                        "admin_id": new_order['admin_id'],
                        "symbol": new_order['symbol'],
                        "quantity": new_order['quantity'],
                        "trigger_type": new_order['trigger_type'],
                        "order_type": new_order['order_type'],
                        "cost_avg": new_order['cost_avg'],
                        "application_mode": new_order['application_mode'],
                        "order_mode": new_order['order_mode'],
                        "sell_profit_percent": new_order['sell_profit_percent'],
                        "order_level": new_order['order_level'],
                        "trading_ip": new_order['trading_ip'],
                        "buy_order_id": insertBuyNew.insertedId,
                        'status': 'new',
                        'market_value': new_order['purchased_price'],
                        'sell_price': new_order['sell_price'],
                        "created_date": new Date(),
                        "modified_date": new Date(),
                    }

                    let insertSellNew = await db.collection(sell_collection_kraken).insertOne(newSellOrder)
                    //insert sell order id in buy order
                    if (typeof insertSellNew.insertedId != 'undefined') {
                        await db.collection(buy_collection_kraken).updateOne({ '_id': insertBuyNew.insertedId }, { '$set': { 'sell_order_id': insertSellNew.insertedId } })
                    }
                    //insert log in new order
                    //save log
                    var migrated_ids = new_order['merge_ids'].join(', ')
                    var log_msg = 'Merge Order migrated (' + migrated_ids + ')'
                    var type = 'merge_migrated_order'
                    var show_hide_log = 'yes'
                    var order_created_date = new_order['created_date']
                    var order_mode = new_order['application_mode']
                    await create_orders_history_log(insertBuyNew.insertedId, log_msg, type, show_hide_log, 'kraken', order_mode, order_created_date)

                    let updateFields = {}

                    //update fields and insert logs in merged orders
                    let total_merge_orders = all_merge_orders.length
                    for (let i = 0; i < total_merge_orders; i++){

                        //move order to kraken
                        let caBuyOrders = await db.collection('buy_orders').find({ '_id': all_merge_orders[i]['_id'] }).toArray()
                        let caSoldOrders = await db.collection('sold_buy_orders').find({ '_id': all_merge_orders[i]['_id'] }).toArray()

                        if (caBuyOrders.length > 0) {

                            let newArr = caBuyOrders.map(item=>{
                                let obj = item
                                item['status'] = 'FILLED'
                                item['lth_functionality'] = ''
                                item['is_lth_order'] = ''
                                item['cost_avg'] = 'yes'
                                return obj
                            })

                            await db.collection('buy_orders_kraken').insertMany(newArr)
                            for (let bi = 0; bi < caBuyOrders.length; bi++) {

                                //insert sell order
                                let sellOrder = await db.collection('orders').find({ '_id': new ObjectID(String(caBuyOrders[bi]['sell_order_id'])) }).toArray()
                                let insertSellNew = {}
                                if (sellOrder.length > 0) {
                                    insertSellNew = await db.collection('orders_kraken').insertOne(sellOrder[0])
                                    //insert sell order id in buy order
                                    if (typeof insertSellNew.insertedId != 'undefined') {
                                        await db.collection('buy_orders_kraken').updateOne({ '_id': caBuyOrders[bi]['_id'] }, { '$set': { 'sell_order_id': insertSellNew.insertedId } })
                                    }
                                }
                                await move_order_logs(caBuyOrders[bi]['_id'], 'binance', 'live', caBuyOrders[bi]['created_date'], 'kraken')
                            }
                        }

                        if (caSoldOrders.length > 0) {

                            let newArr = caSoldOrders.map(item => {
                                let obj = item
                                item['status'] = 'FILLED'
                                item['lth_functionality'] = ''
                                item['is_lth_order'] = ''
                                item['cost_avg'] = 'yes'
                                return obj
                            })

                            await db.collection('sold_buy_orders_kraken').insertMany(newArr)
                            for (let bi = 0; bi < caSoldOrders.length; bi++) {

                                //insert sell order
                                let sellOrder = await db.collection('orders').find({ '_id': new ObjectID(String(caSoldOrders[bi]['sell_order_id'])) }).toArray()
                                let insertSellNew = {}
                                if (sellOrder.length > 0) {
                                    insertSellNew = await db.collection('orders_kraken').insertOne(sellOrder[0])
                                    //insert sell order id in buy order
                                    if (typeof insertSellNew.insertedId != 'undefined') {
                                        await db.collection('sold_buy_orders_kraken').updateOne({ '_id': caSoldOrders[bi]['_id'] }, { '$set': { 'sell_order_id': insertSellNew.insertedId } })
                                    }
                                }
                                await move_order_logs(caSoldOrders[bi]['_id'], 'binance', 'live', caSoldOrders[bi]['created_date'], 'kraken')
                            }
                        }

                        //mark as sold in binance
                        let symbol11 = all_merge_orders[i]['symbol']
                        let splitArr11111 = symbol11.split('USDT');
                        let market_sold_price_usd = (splitArr11111[1] == '' ? parseFloat(all_merge_orders[i]['quantity']) * currentMarketPrice : parseFloat(all_merge_orders[i]['quantity']) * currentMarketPrice * BTCUSDTPRICE)

                        //sold fields
                        updateFields = {
                            'trading_status': 'complete',
                            'status': 'FILLED',
                            'is_sell_order': 'sold',
                            'market_sold_price': currentMarketPrice,
                            'market_sold_price_usd': market_sold_price_usd,
                            'sell_date': new Date(),
                            'modified_date': new Date(),
                            'trade_migrated': 'yes',
                            'order_shifted_resume_exchange': 'yes',
                            'merge_migrated_order': 'yes',
                        }

                        let buy_order = await db.collection(buy_collection).find({ '_id': all_merge_orders[i]['_id']}).toArray()
                        if (buy_order.length > 0){

                            let tempInsert = Object.assign(buy_order[0], updateFields)

                            let insertttttt = await db.collection(sell_collection).insertOne(tempInsert)
                            if (typeof insertttttt.insertedId != 'undefined'){
                                //delete from buy_collection
                                await db.collection(buy_collection).deleteOne({ '_id': all_merge_orders[i]['_id'] })
                            }
                        }else{
                            let sold_order = await db.collection(sell_collection).find({ '_id': all_merge_orders[i]['_id']}).toArray()
                            if(sold_order.length > 0){
                                await db.collection(sell_collection).updateOne({ '_id': all_merge_orders[i]['_id'] }, { '$set': updateFields})
                            }
                        }

                        var log_msg = 'Order merged and migrated'
                        var type = 'merge_migrated_order'
                        var show_hide_log = 'yes'
                        var order_created_date = all_merge_orders[i]['created_date']
                        var order_mode = all_merge_orders[i]['application_mode']
                        await create_orders_history_log(all_merge_orders[i]['_id'], log_msg, type, show_hide_log, 'binance', order_mode, order_created_date)
                    }

                    let tempbuyorder = await db.collection('buy_orders').find({ '_id': new_order['_id'] }).toArray()
                    updateFields['cavg_parent'] = 'yes'
                    updateFields['cost_avg'] = 'completed'
                    updateFields['show_order'] = 'yes'
                    updateFields['avg_purchase_price'] = new_order['avg_purchase_price']
                    updateFields['avg_orders_ids'] = new_order['avg_orders_ids']
                    if (tempbuyorder.length > 0) {

                        // console.log(' ledger order parent')
                        let tempInsert = Object.assign(tempbuyorder[0], updateFields)

                        let insertttttt = await db.collection('sold_buy_orders').insertOne(tempInsert)
                        if (typeof insertttttt.insertedId != 'undefined') {
                            //delete from buy_collection
                            await db.collection('buy_orders').deleteOne({ '_id': new_order['_id'] })
                        }
                    } else {
                        let sold_order = await db.collection('sold_buy_orders').find({ '_id': new_order['_id'] }).toArray()
                        if (sold_order.length > 0) {
                            await db.collection('sold_buy_orders').updateOne({ '_id': new_order['_id'] }, { '$set': updateFields })
                        }
                    }

                }

                res.send({
                    'status': true,
                    'message': 'Merge successful'
                })
        }

    }else{
        res.send({
            'status':false,
            'message':'Invalid request'
        })
    }

})

async function calculate_merge_migrate_trade_values(merge_migrate_orders=[], currentMarketPrice){
    return new Promise(async resolve=>{
        if (merge_migrate_orders.length > 0){
            // const db = await conn

            let purchase_prices_sum = 0
            let sell_price = 0
            let initial_trail_stop = 0

            // let totalPL = 0;

            merge_migrate_orders.map(item=>{
                purchase_prices_sum += parseFloat(item.purchased_price)
                // totalPL += parseFloat(calculate_percentage(parseFloat(item.purchased_price), currentMarketPrice))

                // console.log('Purchased price: ', item.purchased_price, '  ----  target_profit: ', parseFloat(merge_migrate_orders[0]['defined_sell_percentage']), ' ----- : quantity ', parseFloat(item.quantity))

            })

            let avg_purchase_price = purchase_prices_sum / merge_migrate_orders.length
            // totalPL = totalPL / merge_migrate_orders.length

            let defined_sell_percentage = parseFloat(merge_migrate_orders[0]['defined_sell_percentage'])

            // let stop_loss = typeof merge_migrate_orders[0]['stop_loss_rule'] != 'undefined' && merge_migrate_orders[0]['stop_loss_rule'] == 'custom_stop_loss' && !isNaN(parseFloat(merge_migrate_orders[0]['custom_stop_loss_percentage'])) ? parseFloat(merge_migrate_orders[0]['custom_stop_loss_percentage']) : false

            // let custom_stop_loss_percentage = parseFloat(merge_migrate_orders[0]['custom_stop_loss_percentage'])

            sell_price = ((parseFloat(avg_purchase_price) * defined_sell_percentage) / 100) + parseFloat(avg_purchase_price);

            // if (stop_loss){
            //     initial_trail_stop = parseFloat(avg_purchase_price) - ((parseFloat(avg_purchase_price) * custom_stop_loss_percentage) / 100);
            // }else{
                initial_trail_stop = parseFloat(avg_purchase_price) - ((parseFloat(avg_purchase_price) * 5) / 100);
            // }

            // let purchased_price_by_pl = 0
            // if (totalPL > 0){
            //     purchased_price_by_pl = currentMarketPrice - ((totalPL/100) * currentMarketPrice)
            // } else if (totalPL == 0){
            //     purchased_price_by_pl = currentMarketPrice
            // }else{
            //     purchased_price_by_pl = currentMarketPrice + ((totalPL / 100) * currentMarketPrice)
            // }

            let result11 = {
                'currentMarketPrice': currentMarketPrice,
                'purchased_price': avg_purchase_price,
                'sell_price': sell_price,
                'iniatial_trail_stop': initial_trail_stop,
                // 'totalPL': totalPL,
                // 'purchased_price_by_pl': purchased_price_by_pl
            }

            // console.log(result11)

            if (!isNaN(avg_purchase_price) && !isNaN(sell_price) && !isNaN(initial_trail_stop)){
                resolve(result11)
            }else{
                resolve(false)
            }
        }else{
            resolve(false)
        }
    })
}

//post call from manage coins component
router.post('/manageCoins', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
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

router.post('/get_user_coins', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let exchange = req.body.exchange
    let admin_id = req.payload.id

    var urserCoinsPromise = getUserCoins(admin_id, exchange);
    var userFavouriteCoinsPromise = getUserFavouriteCoins(admin_id, exchange);
    var globalCoinsPromise = getGlobalCoins(exchange);
    var promisesResult = await Promise.all([urserCoinsPromise, globalCoinsPromise, userFavouriteCoinsPromise]);
    var responseReslt = {};
    responseReslt['userCoins'] = promisesResult[0];
    responseReslt['globalCoins'] = promisesResult[1];
    responseReslt['userFavouriteCoins'] = promisesResult[2];
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

//list global cons for an exchange
function getGlobalCoins(exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let filter = {};
            filter['user_id'] = 'global'
            filter['exchange_type'] = 'binance'

            let coins_collection = ''
            if (exchange == 'binance') {
                coins_collection = 'coins'
                filter['symbol'] = {
                    '$nin': ['NCASHBTC', 'POEBTC']
                }
            } else {
                coins_collection = 'coins_' + exchange
                delete filter['exchange_type']
            }

            db.collection(coins_collection).find(filter).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of listGlobalCoins

//play parent orders from order listing page
router.post('/playOrder', auth_token.required, async (req, resp) => {
    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }


    var playPromise = pausePlayParentOrder(req.body.orderId, req.body.status, req.body.exchange);
    let show_hide_log = 'yes';
    let type = 'play pause';
    let log_msg = "Parent Order was ACTIVE Manually";
    // var LogPromise = recordOrderLog(req.body.orderId, log_msg, type, show_hide_log, req.body.exchange);
    var getBuyOrder = await listOrderById(req.body.orderId, exchange);
    var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
    var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
    var LogPromise = create_orders_history_log(req.body.orderId, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
    var promiseResponse = await Promise.all([playPromise, LogPromise]);
    resp.status(200).send({
        message: promiseResponse
    });
}) //End of playOrder

//pause play parent order form orders listings
function pausePlayParentOrder(orderId, status, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let filter = {};
            filter['_id'] = new ObjectID(orderId);
            let set = {};
            set['$set'] = {
                'pause_status': status
            }
            let collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            db.collection(collection).updateOne(filter, set, (err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of listGlobalCoins


//post order for play and pause parent orders
router.post('/togglePausePlayOrder', auth_token.required, async (req, resp) => {
    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }


    let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
    var playPromise = togglePausePlayOrder(req.body.orderId, req.body.status, req.body.exchange);
    let show_hide_log = 'yes';
    let type = 'play pause';
    let log_msg = '';
    if (req.body.status == 'play') {
        log_msg = 'Parent Order was set to Play Manually ' + interfaceType;
    } else if (req.body.status == 'pause') {
        log_msg = 'Parent Order was set to Pause Manually ' + interfaceType;
    }
    // var LogPromise = recordOrderLog(req.body.orderId, log_msg, type, show_hide_log, req.body.exchange);
    var getBuyOrder = await listOrderById(req.body.orderId, req.body.exchange);
    var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
    var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
    var LogPromise = create_orders_history_log(req.body.orderId, log_msg, type, show_hide_log, req.body.exchange, order_mode, order_created_date)
    var promiseResponse = await Promise.all([playPromise, LogPromise]);
    resp.status(200).send({
        message: promiseResponse
    });

    //Send Notification
    send_notification(getBuyOrder[0]['admin_id'], 'news_alerts', 'medium', log_msg, req.body.orderId, req.body.exchange, getBuyOrder[0]['symbol'], order_mode, '')

}) //End of playOrder

function togglePausePlayOrder(orderId, status, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let filter = {};
            filter['_id'] = new ObjectID(orderId);
            let set = {};
            set['$set'] = {
                'pause_status': status,
                'pause_manually': status == 'pause' ? 'yes' : 'no',
                'modified_date': new Date()
            }
            let collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            db.collection(collection).updateOne(filter, set, (err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of togglePausePlayOrder

//function for record log agains orders
function recordOrderLog(order_id, log_msg, type, show_hide_log, exchange) {
    return new Promise((resolve, reject) => {
        conn.then((db) => {
            /** */
            let collectionName = (exchange == 'binance') ? 'orders_history_log' : 'orders_history_log_' + exchange;
            let insertArr = {};
            insertArr['order_id'] = new ObjectID(order_id);
            insertArr['log_msg'] = log_msg;
            insertArr['type'] = type;
            insertArr['show_error_log'] = show_hide_log;
            insertArr['created_date'] = new Date();
            db.collection(collectionName).insertOne(insertArr, (err, success) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(success.result)
                }
            })
            /** */
        })
    })
} //End of function(recordOrderLogQuery)
//post call for getting orders details
router.post('/listOrderDetail', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let orderId = req.body.orderId;
    let exchange = req.body.exchange;
    //get buy_order by id
    var ordeResp = await listOrderById(orderId, exchange);
    var orderArr = {}
    if (ordeResp.length > 0) {
        var orderArr = ordeResp[0];
        var sell_auto_manual = "";
        if (typeof orderArr['is_sell_order'] !== 'undefined' && orderArr['is_sell_order'] == 'sold') {
            if (typeof orderArr['is_manual_sold'] !== 'undefined' && orderArr['is_manual_sold'] == 'yes') {
                sell_auto_manual = "manual";
            } else {
                sell_auto_manual = "auto";
            }
        }

        orderArr['sell_auto_manual'] = sell_auto_manual;

        var coutnChilds = 0;
        if (typeof orderArr['parent_status'] !== 'undefined' && orderArr['parent_status'] == 'parent') {
            var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            var filter = {};
            filter['buy_parent_id'] = new ObjectID(orderId);
            var coutnChilds = await countCollection(collectionName, filter);
        }
        orderArr['coutnChilds'] = coutnChilds;
    } //end of length greater then zero


    resp.status(200).send({
        message: orderArr
    })
}) //End of listOrderDetail
//*********************************************************== */

//function for getting order from buy_order or buy_sold_orders
function listOrderById(orderId, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            var where = {};
            where['_id'] = new ObjectID(orderId);
            var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;

            //we check if order is not found on buy_orders collection then search it in sold_buy_orders
            db.collection(collectionName).find(where).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    if (result.length > 0) {
                        resolve(result)
                    } else {
                        var collectionName_2 = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
                        db.collection(collectionName_2).find(where).toArray((err, result) => {
                            if (err) {
                                resolve(err)
                            } else {
                                resolve(result)
                            }
                        })
                    }
                } //End of else of buy order empty
            })
        })
    })
} //End of listOrderById

//post call from component for deleting orders
router.post('/deleteOrder', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }


    let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
    var respPromise = deleteOrder(req.body.orderId, req.body.exchange);
    let show_hide_log = 'yes';
    let type = 'buy_canceled';
    let log_msg = "Buy Order was Canceled " + interfaceType;
    // var LogPromise = recordOrderLog(req.body.orderId, log_msg, type, show_hide_log)
    var getBuyOrder = await listOrderById(req.body.orderId, req.body.exchange);
    var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
    var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
    var LogPromise = create_orders_history_log(req.body.orderId, log_msg, type, show_hide_log, req.body.exchange, order_mode, order_created_date)
    var promiseResponse = await Promise.all([LogPromise, respPromise]);

    //Send Notification
    send_notification(getBuyOrder[0]['admin_id'], 'news_alerts', 'low', log_msg, req.body.orderId, req.body.exchange, getBuyOrder[0]['symbol'], order_mode, '')

    if ((getBuyOrder.length > 0) && typeof getBuyOrder[0]['buy_parent_id'] != 'undefined') {

        // find parent order and check if parent is already canceled
        var parentOrder = await listOrderById(String(getBuyOrder[0]['buy_parent_id']), req.body.exchange);

        if ((parentOrder.length > 0) && typeof parentOrder[0]['status'] != 'undefined' && parentOrder[0]['status'] != 'canceled') {

            let where = {};
            where['_id'] = new ObjectID(String(getBuyOrder[0]['buy_parent_id']));
            where['pause_manually'] = {'$ne': 'yes'};
            let updObj = {};
            updObj['status'] = 'new';
            updObj['pause_status'] = 'play';
            updObj['modified_date'] = new Date()
            let exchange = req.body.exchange
            let collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            let updPromise = updateOne(where, updObj, collection);

        }

    }


    //delete order from this collection also
    if (req.body.exchange == 'kraken' && getBuyOrder.length > 0){
        conn.then(async (db) => {
            let deleted = await db.collection('ready_orders_for_buy_ip_based_kraken').deleteOne({ 'buy_order_id': getBuyOrder[0]['_id']})
        })
    }


    resp.status(200).send({
        message: promiseResponse
    });

}) //End of deleteOrder

//post call from component for deleting orders permanently
router.post('/deleteOrderPermanently', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let order_id = req.body.orderId
    let exchange = req.body.exchange

    if (typeof order_id != 'undefined' && order_id != '' && typeof exchange != 'undefined' && exchange != ''){

        let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
        delete_order_history_logs(order_id, exchange);

        resp.status(200).send({
            status: true
        });

    }else{
        resp.status(200).send({
            status: false
        });
    }

}) //End of deleteOrderPermanently


//post call from component for makeCostAvg
router.post('/makeCostAvg', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let order_id = req.body.orderId
    let exchange = req.body.exchange
    let tab = req.body.tab

    if (typeof order_id != 'undefined' && order_id != '' && typeof exchange != 'undefined' && exchange != '' && typeof tab != 'undefined' && tab != ''){

        let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');

        let db = await conn

        //insert log
        var getBuyOrder = await listOrderById(order_id, exchange);

        if (getBuyOrder.length > 0){



            var sell_price = ((parseFloat(getBuyOrder[0]['purchased_price']) * parseFloat(getBuyOrder[0]['defined_sell_percentage'])) / 100) + parseFloat(getBuyOrder[0]['purchased_price']);


            if(tab == 'lthTab_admin' || tab == 'openTab_admin'){
                var pricesObj = await get_current_market_prices(exchange, getBuyOrder[0]['symbol'])
                var currentMarketPrice = pricesObj[getBuyOrder[0]['symbol']]
                var orderPurchasePrice = getBuyOrder[0]['purchased_price'];

                var percentage =  7
                var percentageDown   = (orderPurchasePrice * percentage) / 100
                var perctDownPrice     = orderPurchasePrice - percentageDown;
            }



            if (tab == 'lthTab' || tab == 'openTab'|| tab == 'lthTab_admin' || tab == 'openTab_admin'){
                var collectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_'+exchange
            }else if(tab == 'soldTab'){
                var collectionName = exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_'+exchange
            }

            let where = {
                '_id': new ObjectID(String(order_id))
            }
            let update = {
                '$set': {
                    'cost_avg': 'yes',
                    'show_order': 'yes',
                    'cavg_parent': 'yes',
                    'modified_date': new Date()
                }
            }

            // let temp = {'cost_avg': 'yes', 'show_order': 'yes', 'cavg_parent': 'yes', 'modified_date': ISODate(), 'cost_avg_buy': 'yes', 'move_to_cost_avg' : 'yes'}
            // let temp1 = { 'direct_child_order_id': '', 'direct_parent_child_id': '', 'ist_parent_child_buy_id': '', 'cost_avg_percentage': '', 'avg_sell_price': ''}

            if (tab == 'soldTab') {
                update['$set']['cost_avg_buy'] = 'yes'
                update['$set']['move_to_cost_avg'] = 'yes'

                update['$set']['avg_price_three_upd'] = ''
                update['$set']['avg_sell_price_three'] = ''
                update['$set']['last_three_ids'] = ''
                update['$set']['quantity_three'] = ''

                update['$set']['avg_price_all_upd'] = ''
                update['$set']['all_buy_ids'] = ''
                update['$set']['quantity_all'] = ''


                //Unset Fields
                update['$unset'] = {};
                update['$unset']['direct_child_order_id'] = '';
                update['$unset']['direct_parent_child_id'] = '';
                update['$unset']['ist_parent_child_buy_id'] = '';
                update['$unset']['cost_avg_percentage'] = '';
                update['$unset']['avg_sell_price'] = '';
            }

            if (tab == 'lthTab' || tab == 'openTab' || tab == 'lthTab_admin' || tab == 'openTab_admin') {




                if (!isNaN(parseFloat(sell_price))){
                    update['$set']['sell_price'] = parseFloat(sell_price)
                    update['$set']['status'] = 'FILLED'
                    update['$set']['lth_functionality'] = 'no'
                    update['$set']['lth_profit'] = ''
                    update['$set']['is_lth_order'] = ''
                }
                if(tab == 'lthTab' || tab == 'openTab' || tab == 'lthTab_admin' || tab == 'openTab_admin'){
                  update['$set']['move_to_cost_avg'] = 'yes'
                }
                if(tab == 'openTab_admin'){
                    update['$set']['iniatial_trail_stop'] = currentMarketPrice + (currentMarketPrice + 0.05);
                    update['$set']['is_sell_order'] = 'yes';
                    update['$set']['order_to_ca_activated'] = 'yes';
                }
            }

            if (tab == 'lthTab'){
                update['$set']['avg_sell_price'] = parseFloat(sell_price);
            }

            if(tab == 'lthTab_admin' || tab == 'openTab_admin'){
                update['$set']['avg_sell_price'] = '';
                update['$set']['new_child_buy_price'] = isNaN(parseFloat(perctDownPrice)) ?  '': parseFloat(perctDownPrice);

                update['$set']['cost_avg_array'] = []
                    var cost_avg_array_obj ={}
                    // Buy Fraction Array
                    if(typeof getBuyOrder[0]['buy_fraction_filled_order_arr'] != 'undefined' && getBuyOrder[0]['buy_fraction_filled_order_arr'].length > 0){
                        if(exchange == 'binance'){
                            cost_avg_array_obj['buyOrderId'] = typeof getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['buyOrderId'] != 'undefined' && getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['buyOrderId'] != '' ? getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['buyOrderId'] : ''
                        } else if(exchange == 'kraken'){
                            cost_avg_array_obj['buyOrderId'] = typeof getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['orderFilledId'] != 'undefined' && getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['orderFilledId'] != '' ? getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['orderFilledId'] : ''
                        }
                        cost_avg_array_obj['filledQtyBuy'] = typeof getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['filledQty'] != 'undefined' && getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['filledQty'] != '' ? getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['filledQty'] : ''
                        cost_avg_array_obj['commissionBuy'] = typeof getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['commission'] != 'undefined' && getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['commission'] != '' ? getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['commission'] : ''
                        cost_avg_array_obj['filledPriceBuy'] = typeof getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['filledPrice'] != 'undefined' && getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['filledPrice'] != '' ? getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['filledPrice'] : ''
                        cost_avg_array_obj['orderFilledIdBuy'] = typeof getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['orderFilledId'] != 'undefined' && getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['orderFilledId'] != '' ? getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['orderFilledId'] : ''
                        cost_avg_array_obj['avg_purchase_price'] = typeof getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['filledPrice'] != 'undefined' && getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['filledPrice'] != '' ? parseFloat(getBuyOrder[0]['buy_fraction_filled_order_arr'][0]['filledPrice']) : ''
                    } else{
                        if(exchange == 'binance'){
                            cost_avg_array_obj['buyOrderId']= typeof getBuyOrder[0]['binance_order_id'] != 'undefined' && getBuyOrder[0]['binance_order_id'] != '' ? getBuyOrder[0]['binance_order_id'] : ''
                        } else if(exchange == 'kraken') {
                            cost_avg_array_obj['buyOrderId']= typeof getBuyOrder[0]['kraken_order_id'] != 'undefined' && getBuyOrder[0]['kraken_order_id'] != '' ? getBuyOrder[0]['kraken_order_id'] : ''
                        }
                        cost_avg_array_obj['filledQtyBuy']= typeof getBuyOrder[0]['quantity'] != 'undefined' && getBuyOrder[0]['quantity'] != '' ? getBuyOrder[0]['quantity'].toFixed(8) : ''
                        cost_avg_array_obj['commissionBuy']= ''
                        cost_avg_array_obj['filledPriceBuy']= typeof getBuyOrder[0]['purchased_price'] != 'undefined' && getBuyOrder[0]['purchased_price'] != '' ? getBuyOrder[0]['purchased_price'].toFixed(8) : ''
                        cost_avg_array_obj['orderFilledIdBuy']= typeof getBuyOrder[0]['tradeId'] != 'undefined' && getBuyOrder[0]['tradeId'] != '' ? getBuyOrder[0]['tradeId'] : ''
                        cost_avg_array_obj['avg_purchase_price']= typeof getBuyOrder[0]['purchased_price'] != 'undefined' && getBuyOrder[0]['purchased_price'] != '' ? parseFloat(getBuyOrder[0]['purchased_price'].toFixed(8)) : ''
                    }

                    cost_avg_array_obj['order_sold'] = 'no';
                    cost_avg_array_obj['buy_order_id'] = getBuyOrder[0]['_id'];
                    cost_avg_array_obj['buyTimeDate'] = getBuyOrder[0]['created_date'];

                    update['$set']['cost_avg_array'].push(cost_avg_array_obj)
            }

            let result = await db.collection(collectionName).updateOne(where, update)

            if ((tab == 'openTab' || tab == 'openTab_admin') && result.modifiedCount > 0){
                //Revert CA parent
                let buy_collection = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
                db.collection(buy_collection).updateOne({ '_id': getBuyOrder[0]['buy_parent_id'], 'status': {'$ne':'canceled'} },{'$set':{'status':'new'}})
            }

            let tabName = ''
            if (tab == 'openTab' || tab == 'openTab_admin'){
                tabName = 'Open '
            } else if (tab == 'lthTab' || tab == 'lthTab_admin'){

                let tttttorder = {}
                if(tab == 'lthTab'){
                    await update_cost_avg_fields_shahzad(order_id, tttttorder, exchange)
                }
                await updateAvgSellFullTransactionPrice(order_id, exchange, getBuyOrder['symbol'])
                await updateAvgSellThreeTransactionPrice(order_id, exchange, getBuyOrder['symbol'])

                tabName = 'LTH '
            } else if (tab == 'soldTab'){
                tabName = 'Sold '
            }

            let show_hide_log = 'yes';
            let type = 'cost_avg';
            let log_msg = "Process " + tabName +"order by cost average set to yes " + interfaceType;
            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
            create_orders_history_log(req.body.orderId, log_msg, type, show_hide_log, req.body.exchange, order_mode, order_created_date)
        }

        resp.status(200).send({
            status: true
        });

    }else{
        resp.status(200).send({
            status: false
        });
    }

}) //End of makeCostAvg


function delete_order_history_logs(order_id, exchange) {
    return new Promise(async (resolve, reject) => {

        const db = await conn

        //get order
        let buy_collection = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
        let sell_collection = exchange == 'binance' ? 'orders' : 'orders_' + exchange
        let resume_collection = exchange == 'binance' ? 'resume_buy_orders' : 'resume_buy_orders_' + exchange
        let sold_collection = exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange

        let order = await db.collection(buy_collection).find({ '_id': new ObjectID(order_id) }).toArray()

        if (order.length > 0) {
            order = order[0]

            let order_created_date = order['created_date']
            let order_mode = order['application_mode']

            var created_date = new Date(order_created_date);
            var current_date = new Date('2019-12-27T11:04:21.912Z');
            if (created_date > current_date) {
                var collectionName = (exchange == 'binance') ? 'orders_history_log' : 'orders_history_log_' + exchange;
                var d = new Date(order_created_date);
                //create collection name on the base of date and mode
                var date_mode_string = '_' + order_mode + '_' + d.getFullYear() + '_' + d.getMonth();
                //create full name of collection
                var full_collection_name = collectionName + date_mode_string;
            } else {
                var full_collection_name = (exchange == 'binance') ? 'orders_history_log' : 'orders_history_log_' + exchange;
            }

            // (async () => { console.log('full_collection_name ::::::', full_collection_name) })();

            // //Count Logs
            // let logs_count = await db.collection(full_collection_name).find({ 'order_id': { '$in': [order_id, new ObjectID(order_id)] } }).count()
            // console.log('logs_count ::::', logs_count)

            //Delete Logs
            db.collection(full_collection_name).deleteMany({ 'order_id': { '$in': [order_id, new ObjectID(order_id)] } })
            // let res = await db.collection(full_collection_name).deleteMany({ 'order_id': { '$in': [order_id, new ObjectID(order_id)] } })
            // console.log(res)

            //Delete order
            db.collection(buy_collection).deleteOne({ '_id': new ObjectID(order_id) })
            // let res2 = await db.collection(buy_collection).deleteOne({ '_id': new ObjectID(order_id) })
            // console.log(res2)

        }

        resolve(true)
    })
}

//delete order on the base of orderid
function deleteOrder(orderId, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let filter = {};
            filter['_id'] = new ObjectID(orderId);
            let set = {};
            set['$set'] = {
                'status': 'canceled',
                'pause_status': 'pause',
                'pause_by_script': 'no',
                'modified_date': new Date()
            };

            let collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            db.collection(collection).updateOne(filter, set, (err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of deleteOrder

//When we click on move to LTH Button from order listing opentab it move the open order to LTH for any exchange
//Changing the target profit to  LTH profit rather than normal profit
router.post('/orderMoveToLth', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
    let exchange = req.body.exchange;
    let orderId = req.body.orderId;
    let lth_profit = req.body.lth_profit;
    var buyOrderArr = await listOrderById(orderId, exchange);
    var buyOrderObj = buyOrderArr[0];

    var purchased_price = (typeof buyOrderObj['purchased_price'] == 'undefined') ? 0 : buyOrderObj['purchased_price'];
    var sell_order_id = (typeof buyOrderObj['sell_order_id'] == 'undefined') ? '' : buyOrderObj['sell_order_id'];
    var sell_price = ((parseFloat(purchased_price) * lth_profit) / 100) + parseFloat(purchased_price)
    if (sell_order_id != '') {
        //Target sell price change to the lth taher than to the noraml price
        var collectionName = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
        var where = {};
        where['_id'] = new ObjectID(sell_order_id);
        var updObj = {};
        updObj['sell_price'] = parseFloat(sell_price);
        var updPromise = updateOne(where, updObj, collectionName);
        updPromise.then((resolve) => {});

        var buy_collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
        var where = {};
        where['_id'] = new ObjectID(orderId);
        var updObj = {};
        updObj['modified_date'] = new Date();
        var updBuyPromise = updateOne(where, updObj, buy_collection);
        updBuyPromise.then((resolve) => {});
    }


    if (typeof buyOrderObj['buy_parent_id'] != 'undefined') {
        let where = {};
        where['_id'] = new ObjectID(String(buyOrderObj['buy_parent_id']));
        where['status'] = {'$ne': 'canceled'};
        let updObj = {};
        updObj['status'] = 'new';
        let collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
        let updPromise = updateOne(where, updObj, collection);
    }

    var respPromise = orderMoveToLth(orderId, lth_profit, exchange, sell_price);
    let show_hide_log = 'yes';
    let type = 'move_lth';
    let log_msg = 'Buy Order  <span style="color:yellow;    font-size: 14px;"><b>Manually</b></span> Moved to <strong> LONG TERM HOLD </strong>  ' + interfaceType;
    // var LogPromise = recordOrderLog(req.body.orderId, log_msg, type, show_hide_log, exchange)
    var getBuyOrder = await listOrderById(req.body.orderId, exchange);
    var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
    var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
    var LogPromise = create_orders_history_log(req.body.orderId, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
    var promiseResponse = await Promise.all([LogPromise, respPromise]);

    //Send Notification
    send_notification(getBuyOrder[0]['admin_id'], 'news_alerts', 'medium', log_msg, req.body.orderId, exchange, getBuyOrder[0]['symbol'], order_mode, '')

    resp.status(200).send({
        message: promiseResponse
    });

}) //End of orderMoveToLth

//function for moving order to lth
function orderMoveToLth(orderId, lth_profit, exchange, sell_price) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let filter = {};
            filter['_id'] = new ObjectID(orderId);
            let set = {};
            set['$set'] = {
                'status': 'LTH',
                'is_lth_order': 'yes',
                'lth_profit': lth_profit,
                'lth_functionality': 'yes',
                'sell_price': sell_price,
                'modified_date': new Date(),
            };
            var collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            db.collection(collection).updateOne(filter, set, (err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of orderMoveToLth


//post call for getting order by id
router.post('/listOrderById', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    // console.log(req.body)

    let orderId = req.body.orderId;
    let exchange = req.body.exchange;
    var timezone = req.body.timezone;
    //promise for  getting order by id
    var ordeArr = await listOrderById(orderId, exchange);

    let show_special_logs = typeof req.body.show_special_logs != 'undefined' ? req.body.show_special_logs : false

    if (ordeArr.length > 0){
        var orderObj = ordeArr[0];
        var order_created_date = orderObj['created_date'];
        var order_mode = (typeof orderObj['order_mode'] == 'undefined') ? orderObj['application_mode'] : orderObj['order_mode'];


        //promise for gettiong order log
        var ordeLog = await listOrderLog(orderId, exchange, order_mode, order_created_date, show_special_logs);


        var respArr = {};
        respArr['ordeArr'] = ordeArr;
        let html = '';

        var index = 1;
        for (let row in ordeLog) {

            var timeZoneTime = ordeLog[row].created_date;
            try {
                timeZoneTime = new Date(ordeLog[row].created_date).toLocaleString("en-US", {
                    timeZone: timezone
                });
                timeZoneTime = new Date(timeZoneTime);
            } catch (e) {
                console.log(e);
            }



            var date = timeZoneTime.toLocaleString() + ' ' + timezone;
            //Remove indicator log message
            if (ordeLog[row].type != 'indicator_log_message') {
                html += '<tr>';
                html += '<th scope="row" class="text-danger">' + index + '</th>';
                html += '<td>' + ordeLog[row].log_msg + '</td>';
                html += '<td>' + date + '</td>'
                html += '</tr>';
                index++;
            }


        }


        respArr['logHtml'] = html;

        resp.status(200).send({
            message: respArr
        });
    }else{
        resp.status(200).send({
            message: {
                'ordeArr': []
            }
        });
    }
}) //End of listOrderById

//post call for getting order log by id //Umer Abbas [2-1-19]
router.post('/listOrderLogById', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    let orderId = req.body.orderId;
    let exchange = req.body.exchange;
    var timezone = req.body.timezone;

    var ordeArr = await listOrderById(orderId, exchange);
    var orderObj = ordeArr[0];
    var order_mode = (typeof orderObj['order_mode'] == 'undefined') ? orderObj['application_mode'] : orderObj['order_mode'];
    var order_created_date = orderObj['created_date'];

    //promise for gettiong order log
    var ordeLog = await listOrderLog(orderId, exchange, order_mode, order_created_date);

    var respArr = {};
    respArr['ordeArr'] = ordeArr;
    let html = '';
    var index = 1;
    for (let row in ordeLog) {

        var timeZoneTime = ordeLog[row].created_date;
        try {
            timeZoneTime = new Date(ordeLog[row].created_date).toLocaleString("en-US", {
                timeZone: timezone
            });
            timeZoneTime = new Date(timeZoneTime);
        } catch (e) {
            console.log(e);
        }

        var date = timeZoneTime.toLocaleString() + ' ' + timezone;
        //Remove indicator log message
        if (ordeLog[row].type != 'indicator_log_message') {
            html += '<tr>';
            html += '<th scope="row" class="text-danger">' + index + '</th>';
            html += '<td>' + ordeLog[row].log_msg + '</td>';
            html += '<td>' + date + '</td>'
            html += '</tr>';
            index++;
        }
    }

    respArr['logHtml'] = html;

    resp.status(200).send({
        message: respArr
    });
}) //End of listOrderLogById

//get order log on the base of order id
async function listOrderLog(orderId, exchange, order_mode, order_created_date, show_special_logs=false) {
    return new Promise((resolve) => {
        conn.then(async (db) => {
            var where = {};
            where['order_id'] = {
                $in: [orderId, new ObjectID(orderId)]
            }
            var created_date = new Date(order_created_date);
            var current_date = new Date('2019-12-27T11:04:21.912Z');

            if (created_date > current_date) {

                var collectionName = (exchange == 'binance') ? 'orders_history_log' : 'orders_history_log_' + exchange;

                var d = new Date(order_created_date);
                //create collection name on the base of date and mode
                var date_mode_string = '_' + order_mode + '_' + d.getFullYear() + '_' + d.getMonth();
                //create full name of collection
                var full_collection_name = collectionName + date_mode_string;

            } else {
                var full_collection_name = (exchange == 'binance') ? 'orders_history_log' : 'orders_history_log_' + exchange;
            }

            // if (!show_special_logs){
            //     where['type'] = { '$nin': ['test_logs_func', 'testing_apikey_secrets']}
            // }

            var pipeline = [{
                    $match: where
                },
                {
                    $sort: {
                        'created_date': -1
                    }
                },
                {
                    '$limit': 100
                }
            ];

            if (full_collection_name == 'orders_history_log') {

                var new_logs = await db.collection(full_collection_name).aggregate(pipeline).toArray();
                resolve(new_logs)

                // var old_logs = await db.collection('orders_history_log_2019_backup').find(where, {}).toArray()
                // var logs = old_logs.concat(new_logs)

            } else {

                var new_logs = await db.collection(full_collection_name).aggregate(pipeline).toArray();
                resolve(new_logs)

            }

        })
    })
} //End of listOrderLog


//post call for getting order by id
router.post('/costAvgChildLogs', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    let orderIds = req.body.orderIds;
    let exchange = req.body.exchange;
    var timezone = req.body.timezone;

    if (typeof orderIds != 'undefined' && orderIds.length > 0 && typeof exchange != 'undefined' && exchange != ''){
        // var ordeArr = await listOrderById(orderId, exchange);
        let promiseArr = []
        orderIds.map(item => { promiseArr.push(listOrderById(item, exchange)) })

        let promiseResponseArr = await Promise.all(promiseArr)

        let promiseArr2 = []
        promiseResponseArr.map(item => {
            if(item.length > 0){
                let itemObj = item[0]
                let order_created_date = itemObj['created_date']
                let order_mode = (typeof itemObj['order_mode'] == 'undefined') ? itemObj['application_mode'] : itemObj['order_mode']
                promiseArr2.push(costAvgChildLogs(itemObj['_id'], exchange, order_mode, order_created_date))
            }
        })

        let childOrderLogsArr = []
        let promiseResponseArr2 = await Promise.all(promiseArr2)

        promiseResponseArr2 = promiseResponseArr2.map(item =>{
            childOrderLogsArr = childOrderLogsArr.concat(item)
        })

        let childOrderLogs = {}

        if (childOrderLogsArr.length > 0) {
            for (let row in childOrderLogsArr) {

                let child_order_id = String(childOrderLogsArr[row].order_id)

                if (child_order_id in childOrderLogs) {
                    childOrderLogs[child_order_id].push(childOrderLogsArr[row])
                } else {
                    childOrderLogs[child_order_id] = []
                    childOrderLogs[child_order_id].push(childOrderLogsArr[row])
                }

            }

        }

        resp.status(200).send({
            'status': true,
            'data': childOrderLogs,
            'message': 'logs found'
        });

    }else{
        resp.status(200).send({
            'status': false,
            'data': {},
            'message': 'orderIds array and exchange is required'
        });
    }

}) //End of listOrderById

//get costAvgChildLogs
async function costAvgChildLogs(orderId, exchange, order_mode, order_created_date) {
    return new Promise(async (resolve) => {
        let db = await conn

        var where = {};
        where['order_id'] = {
            $in: [String(orderId), new ObjectID(String(orderId))],
        }
        where['type'] = {
            $in: [
                'buy_price_filled',
                // 'buy_commission',
                'sell_qty',
                'sell_commission',
                // 'sell_submitted',
            ],
        }
        var created_date = new Date(order_created_date);
        var current_date = new Date('2019-12-27T11:04:21.912Z');

        if (created_date > current_date) {

            var collectionName = (exchange == 'binance') ? 'orders_history_log' : 'orders_history_log_' + exchange;

            var d = new Date(order_created_date);
            //create collection name on the base of date and mode
            var date_mode_string = '_' + order_mode + '_' + d.getFullYear() + '_' + d.getMonth();
            //create full name of collection
            var full_collection_name = collectionName + date_mode_string;

        } else {
            var full_collection_name = (exchange == 'binance') ? 'orders_history_log' : 'orders_history_log_' + exchange;
        }

        var pipeline = [
            {
                $match: where
            },
            {
                $sort: {'created_date': -1}
            },
            {
                '$limit': 100
            }
        ];

        if (full_collection_name == 'orders_history_log') {

            var new_logs = await db.collection(full_collection_name).aggregate(pipeline).toArray();
            resolve(new_logs)

        } else {

            var new_logs = await db.collection(full_collection_name).aggregate(pipeline).toArray();
            resolve(new_logs)
        }
    })
} //End of costAvgChildLogs

//post call for sell order manually from order listing page
router.post('/sellOrderManually', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
    let orderId = req.body.orderId;
    let currentMarketPrice = req.body.currentMarketPriceByCoin;
    let exchange = req.body.exchange;

    let costAvgParent = typeof req.body.costAvgParent != 'undefined' ? req.body.costAvgParent : false;
    let costAvgParentAddedQty = typeof req.body.costAvgParentAddedQty != 'undefined' ? req.body.costAvgParentAddedQty : false;

    let action = typeof req.body.action != 'undefined' && req.body.action != '' ? req.body.action : '';
    let tab = typeof req.body.tab != 'undefined' && req.body.tab != '' ? req.body.tab : '';
    let sellNow = true


    let responseMessage = ''

    if (action != '') {
        if (action == 'isResumeExchange') {
            //only move
            if (await checkQuanity(orderId, tab)){

                if (tab == 'soldTab') {
                    await migrate_order(String(orderId), exchange, action, tab)
                }else{
                    await migrate_order(String(orderId), exchange, action)
                }
                responseMessage = 'Order shifted successfully'
            }else{
                responseMessage = 'Order not shifted becuse of min qty issue'
            }
            sellNow = false
        } else if (action == 'isResume') {
            //move then sell
            await migrate_order(String(orderId), exchange, action)
        } else if (action == 'isSellPaused'){

            if (tab == 'soldTab'){
                sellNow = false
                make_migrated_parent(orderId)
            }else{
                if (await is_sell_migrate_order_normally(String(orderId))){
                    let tempRes = await make_migrated_parent(orderId)
                    if (tempRes){
                        //sell normally
                        responseMessage = 'Order migrated successfully'
                    }else{
                        responseMessage = 'Order could not be migrated Because of min qty issue'
                        sellNow = false
                    }
                }else{
                    make_migrated_parent(orderId)
                    sellNow = false
                }
            }

        }
    }

    var ordeResp = ''
    if (sellNow){
        let collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
        //get buy order detail by id
        var ordeResp = await listOrderById(orderId, exchange);
        if (ordeResp.length > 0) {

            let buyOrderArr = ordeResp[0];
            let sell_order_id = (typeof buyOrderArr['sell_order_id'] == undefined) ? '' : buyOrderArr['sell_order_id'];
            let buyOrderStatus = (typeof buyOrderArr['status'] == undefined) ? '' : buyOrderArr['status'];
            var buyParentOrderId = (typeof buyOrderArr['buy_parent_id'] == undefined) ? '' : buyOrderArr['buy_parent_id'];

            console.log("sell_order_id ", sell_order_id)
            if (typeof sell_order_id != 'undefined' && sell_order_id != '') {
                let application_mode = (typeof buyOrderArr['application_mode'] == undefined) ? '' : buyOrderArr['application_mode'];
                let buy_order_id = buyOrderArr['_id'];
                let quantity = (typeof buyOrderArr['quantity'] == undefined) ? '' : buyOrderArr['quantity'];


                // console.log('1111 ', quantity)
                if (costAvgParent && costAvgParentAddedQty !== false){
                    quantity = costAvgParentAddedQty
                }
                // console.log('2222 ', quantity)

                let coin_symbol = (typeof buyOrderArr['symbol'] == undefined) ? '' : buyOrderArr['symbol'];
                let admin_id = (typeof buyOrderArr['admin_id'] == undefined) ? '' : buyOrderArr['admin_id'];
                let trigger_type = (typeof buyOrderArr['trigger_type'] == undefined) ? '' : buyOrderArr['trigger_type'];
                //getting user ip for trading
                var trading_ip = await listUsrIp(admin_id);

                console.log("trading_ip ", trading_ip)


                var log_msg = ' Order Has been sent for  <span style="color:yellow;font-size: 14px;"><b>Sold Manually</b></span> by Sell Now ' + interfaceType;
                // var logPromise = recordOrderLog(buy_order_id, log_msg, 'sell_manually', 'yes', exchange);
                var getBuyOrder = await listOrderById(buy_order_id, exchange);
                var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                var logPromise = create_orders_history_log(buy_order_id, log_msg, 'sell_manually', 'yes', exchange, order_mode, order_created_date)

                //Send Notification
                send_notification(getBuyOrder[0]['admin_id'], 'sell_alerts', 'medium', log_msg, buy_order_id, exchange, getBuyOrder[0]['symbol'], order_mode, '')

                var log_msg = 'Send Market Orde for sell by Ip: <b>' + trading_ip + '</b> ';
                // var logPromise_2 = recordOrderLog(buy_order_id, log_msg, 'order_ip', 'no', exchange);
                var logPromise_2 = create_orders_history_log(buy_order_id, log_msg, 'order_ip', 'no', exchange, order_mode, order_created_date)

                var update_1 = {};
                update_1['modified_date'] = new Date();
                update_1['is_manual_sold'] = 'yes';
                var filter_1 = {};
                filter_1['_id'] = {
                    $in: [orderId, new ObjectID(orderId)]
                }

                var collectionName_1 = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;


                var updatePromise_1 = updateOne(filter_1, update_1, collectionName_1);

                var collectionName_2 = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;;
                // update_1['status'] = 'FILLED';

                //By Ali to avoid showing in open tab [16-1-20]
                // update_1['status'] = buyOrderStatus + '_submitted_for_sell';
                update_1['status'] = 'submitted_for_sell';

                var updatePromise_2 = updateOne(filter_1, update_1, collectionName_2);
                var resolvePromise = Promise.all([updatePromise_1, updatePromise_2, logPromise, logPromise_2]);
                //in case of live order move it to specified api for selling
                if (application_mode == 'live') {


                    var log_msg = "Market Order Send For Sell On:  " + parseFloat(currentMarketPrice).toFixed(8);
                    // var logPromise_1 = recordOrderLog(buy_order_id, log_msg, 'sell_manually', 'yes', exchange);
                    var logPromise_1 = create_orders_history_log(buy_order_id, log_msg, 'sell_manually', 'yes', exchange, order_mode, order_created_date)

                    logPromise_1.then((resp) => {})
                    //send order for sell on specific ip
                    var SellOrderResolve = readySellOrderbyIp(sell_order_id, quantity, currentMarketPrice, coin_symbol, admin_id, buy_order_id, trading_ip, trigger_type, 'sell_market_order', exchange);
                    // console.log("SellOrderResolve ", SellOrderResolve)

                    SellOrderResolve.then((resp) => {})
                } else {
                    //if test order
                    var log_msg = "Market Order Send For Sell On **:  " + parseFloat(currentMarketPrice).toFixed(8);
                    // var logPromise_1 = recordOrderLog(buy_order_id, log_msg, 'sell_manually', 'yes', exchange);
                    var logPromise_1 = create_orders_history_log(buy_order_id, log_msg, 'sell_manually', 'yes', exchange, order_mode, order_created_date)

                    logPromise_1.then((resp) => {})
                    //call function for selling orders
                    sellTestOrder(sell_order_id, currentMarketPrice, buy_order_id, exchange,buyParentOrderId);

                }
            } //End of if sell order id not empty
        } //Order Arr End
    }

    if (responseMessage == 'Order shifted successfully'){
        sellNow = true
    }

    let responseObj = {
        'status': sellNow ? true : false,
        'message': responseMessage != '' ? responseMessage : (action == '' ? ordeResp : 'Action successful'),
        'showAlert': responseMessage != '' ? true : false
    }

    resp.status(200).send(responseObj);

}) //End of sellOrderManually


async function checkQuanity(order_id, tab=''){

    return new Promise(async resolve=>{

        var collection_name = 'buy_orders'
        if (tab == 'soldTab') {
            collection_name = 'sold_buy_orders'
        }

        // console.log('tab    === ', tab)

        const db = await conn

        let where = {
            '_id': new ObjectID(String(order_id))
        }
        let buy_order = await db.collection(collection_name).find(where).toArray()

        if (buy_order.length > 0){

            //check if parent of that symbol and level exists, if exists insert the following fields in it else create a new parent
            var coin = buy_order[0]['symbol']
            var whereCoins = { '$in': [coin, 'BTCUSDT'] }
            var coinData = await listmarketPriceMinNotationCoinArr(whereCoins, 'kraken')
            var BTCUSDTPRICE = parseFloat(coinData['BTCUSDT']['currentmarketPrice'])

            var currentMarketPrice = parseFloat(coinData[coin]['currentmarketPrice'])
            var marketMinNotation = coinData[coin]['marketMinNotation']
            var marketMinNotationStepSize = coinData[coin]['marketMinNotationStepSize']
            var toFixedNum = 6

            //find min required quantity
            var extra_qty_percentage = 40;
            var extra_qty_val = 0;
            extra_qty_val = (extra_qty_percentage * marketMinNotation) / 100
            var calculatedMinNotation = parseFloat(marketMinNotation) + extra_qty_val;
            var minReqQty = 0;
            minReqQty = (calculatedMinNotation / currentMarketPrice);

            if (true) {
                // if (exchange == 'kraken') {
                minReqQty = calculatedMinNotation
                toFixedNum = 6
            } else {
                // toFixedNum = (marketMinNotationStepSize + '.').split('.')[1].length
            }

            minReqQty += marketMinNotationStepSize
            minReqQty = parseFloat(minReqQty.toFixed(toFixedNum))

            //TODO: find one usd worth of quantity
            let selectedCoin = coin;

            let splitArr = selectedCoin.split('USDT');
            var quantity =  buy_order[0]['quantity']
            var usd_worth = splitArr[1] == '' ? quantity * currentMarketPrice : quantity * currentMarketPrice * BTCUSDTPRICE
            quantity = parseFloat(parseFloat(quantity).toFixed(toFixedNum))
            usd_worth = parseFloat(usd_worth.toFixed(2))

            //add new field to hide button
            await db.collection(collection_name).updateOne(where, {'$set':{'order_shifted_resume_exchange':'yes'}})

            // console.log(minReqQty, ' <= ', quantity)

            if (minReqQty <= quantity) {

                resolve(true)

            }else{
                //add log can not convert because min qty issue
                var log_msg = 'Can not shift order because of min qty issue'
                var type = 'migrated_order_min_qty_issue'
                var show_hide_log = 'yes'
                var order_created_date = ((buy_order.length > 0) ? buy_order[0]['created_date'] : new Date())
                var order_mode = ((buy_order.length > 0) ? buy_order[0]['application_mode'] : 'test')
                await create_orders_history_log(buy_order[0]['_id'], log_msg, type, show_hide_log, 'binance', order_mode, order_created_date)
                //end save log
                resolve(false)
            }

        }else{
            resolve(false)
        }

    })
}

async function migrate_order(order_id, exchange='', action='', tab=''){

    return new Promise(async resolve =>{
        const db = await conn

        var collection_name = 'buy_orders'
        if (action == 'isResumeExchange' && tab == 'soldTab') {
            collection_name = 'sold_buy_orders'
        }

        let where = {
            '_id': new ObjectID(String(order_id))
        }
        let buy_order = await db.collection(collection_name).find(where).toArray()

        if (buy_order.length > 0){

            //insert processed field flag ==> 'trade_migrated': 'yes'
            buy_order[0]['trade_migrated'] = 'yes'
            await db.collection(collection_name).updateOne({ '_id': buy_order[0]['_id'] }, { '$set': {'trade_migrated': 'yes'}})

            //save log
            var log_msg = 'Order migrated'
            if (action == 'isResumeExchange'){
                log_msg = 'Order shifted successfully'
            }else if(action == 'isResume'){
                log_msg = 'Order migrated and sold'
            }

            var type = 'migrated_order'
            var show_hide_log = 'yes'
            var order_created_date = ((buy_order.length > 0) ? buy_order[0]['created_date'] : new Date())
            var order_mode = ((buy_order.length > 0) ? buy_order[0]['application_mode'] : 'test')
            await create_orders_history_log(buy_order[0]['_id'], log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
            //end save log


            let pricesObj = await get_current_market_prices(exchange, [])
            let currSymbol = buy_order[0]['symbol']
            let currentMarketPrice = pricesObj[currSymbol]
            let orderPurchasePrice = buy_order[0]['purchased_price']
            //save pl before migration
            let pl_before_migration = calculate_percentage(orderPurchasePrice, currentMarketPrice)
            let pl_status_before_migration = (currentMarketPrice > orderPurchasePrice) ? 'positive' : 'negative'

            buy_order[0]['pl_before_migration'] = parseFloat(pl_before_migration)
            buy_order[0]['pl_status_before_migration'] = pl_status_before_migration
            buy_order[0]['shifted_order'] = 'yes'
            buy_order[0]['shifted_order_label'] = 'shifted'
            buy_order[0]['modified_date'] = new Date()

            let insData = Object.assign(buy_order[0])
            insData['exchange'] = 'kraken'
            delete insData['is_manual_sold']

            if(tab == 'soldTab'){
                insData['is_sell_order'] = 'yes'
                insData['status'] = 'FILLED'
                delete insData['market_sold_price']
                delete insData['trading_status']

                //unset cost avg fields
                delete insData['cost_avg']
                delete insData['show_order']
                delete insData['cavg_parent']
                delete insData['cost_avg_buy']
                delete insData['move_to_cost_avg']
                delete insData['direct_child_order_id']
                delete insData['direct_parent_child_id']
                delete insData['ist_parent_child_buy_id']
                delete insData['cost_avg_percentage']
                delete insData['avg_sell_price']

                //set LTH fields if cost avg
                if (typeof insData['stop_loss_rule'] != 'undefined' && insData['stop_loss_rule'] == 'custom_stop_loss' && !isNaN(parseFloat(insData['custom_stop_loss_percentage']))) {
                    insData['stop_loss'] = 'yes'

                    let loss_price = (parseFloat(insData['purchased_price']) * parseFloat(insData['custom_stop_loss_percentage'])) / 100;

                    insData['iniatial_trail_stop'] = parseFloat(insData['purchased_price']) - parseFloat(loss_price);

                    //enable LTH functionality
                    insData['lth_functionality'] = 'yes'
                    insData['lth_profit'] = 1.5

                } else {
                    insData['stop_loss_rule'] = ''
                    insData['iniatial_trail_stop'] = ''
                    insData['stop_loss'] = 'no'
                    insData['loss_percentage'] = ''
                    insData['custom_stop_loss_percentage'] = ''
                    insData['lth_functionality'] = 'no'
                    insData['lth_profit'] = ''
                }
                insData['modified_date'] = new Date()

            }

            //move buy order to buy_orders_kraken
            await db.collection('buy_orders_kraken').insertOne(insData)

            //save log
            var log_msg = 'Order migrated'
            if (action == 'isResumeExchange') {
                log_msg = 'Shifted order'
            } else if (action == 'isResume') {
                log_msg = 'Order migrated and sold'
            }

            var type = 'migrated_order'
            var show_hide_log = 'yes'
            var order_created_date = ((buy_order.length > 0) ? buy_order[0]['created_date'] : new Date())
            var order_mode = ((buy_order.length > 0) ? buy_order[0]['application_mode'] : 'test')
            await create_orders_history_log(buy_order[0]['_id'], log_msg, type, show_hide_log, 'kraken', order_mode, order_created_date)
            //end save log

            if (typeof buy_order[0]['sell_order_id'] != 'undefined' && buy_order[0]['sell_order_id'] != ''){

                let sell_order = await db.collection('orders').find({ '_id': new ObjectID(String(buy_order[0]['sell_order_id']))}).toArray()

                if (sell_order.length > 0){
                    let insSellOrder = Object.assign(sell_order[0])
                    insSellOrder['exchange'] = 'kraken'
                    delete insSellOrder['is_manual_sold']

                    if (tab == 'soldTab') {
                        insSellOrder['status'] = 'new'
                        delete insSellOrder['insSellOrder']
                        insSellOrder['modified_date'] = new Date()
                    }

                    await db.collection('orders_kraken').insertOne(insSellOrder)
                }else{

                    //Create sellArr
                    let insSellOrder = {
                        'admin_id': insData['admin_id'],
                        'application_mode': insData['application_mode'],
                        'buy_order_id': insData['_id'],
                        'custom_stop_loss_percentage': insData['custom_stop_loss_percentage'],
                        'iniatial_trail_stop': insData['iniatial_trail_stop'],
                        'order_level': insData['order_level'],
                        'order_mode': insData['order_mode'],
                        'order_type': insData['order_type'],
                        'purchased_price': insData['purchased_price'],
                        'quantity': insData['quantity'],
                        'sell_price': insData['sell_price'],
                        'defined_sell_percentage': insData['defined_sell_percentage'],
                        'sell_profit_percent': insData['defined_sell_percentage'],
                        'status': 'new',
                        'trigger_type': insData['trigger_type'],
                        'created_date': new Date(),
                        'modified_date': new Date()
                    }

                    if (typeof insData['sell_order_id'] != 'undefined' && insData['sell_order_id'] != ''){
                        insSellOrder['_id'] = new ObjectID(String(insData['sell_order_id']))
                    }

                    let insRes = await db.collection('orders_kraken').insertOne(insSellOrder)
                    if (typeof insRes.insertedId != 'undefined'){

                        await db.collection('buy_orders_kraken').updateOne({ '_id': new ObjectID(String(insData['_id'])) }, { '$set': { 'sell_order_id': insRes.insertedId }})

                    }

                }
            }

            if (action == 'isResumeExchange') {

                //update fields and move order to sold then delete from buy collection
                let pricesObj = await get_current_market_prices('binance', [])
                let symbol = buy_order[0]['symbol']
                buy_order[0]['is_sell_order'] = 'sold'
                buy_order[0]['status'] = 'FILLED'
                buy_order[0]['market_sold_price'] = pricesObj[symbol]
                buy_order[0]['modified_date'] = new Date()


                if(tab == 'soldTab'){
                    //DO nothing
                }else{
                    //move to sold collection
                    await db.collection('sold_buy_orders').insertOne(buy_order[0])
                }

                //delete from buy collection
                await db.collection('buy_orders').deleteOne({ '_id': buy_order[0]['_id'] })

            }

        }

        resolve(true)
    })

}

async function make_migrated_parent(order_id, action=''){
    return new Promise(async resolve=>{

        const db = await conn

        let successFlag = false
        let minQtyMigrationIssue = true

        let order_status = ''
        let buy_order = []
        //get order and check if it's open or sold
        buy_order = await db.collection('buy_orders').find({'_id': new ObjectID(String(order_id))}).toArray()
        if (buy_order.length > 0){
            order_status = 'open'
        } else {
            buy_order = await db.collection('sold_buy_orders').find({'_id': new ObjectID(String(order_id))}).toArray()
            order_status = 'sold'
        }

        if (order_status != ''){
            let notExistingCoinsArr = ['ZENBTC', 'XEMBTC', 'QTUMUSDT', 'NEOUSDT', 'NEOBTC', 'EOSUSDT']
            if (notExistingCoinsArr.includes(buy_order[0]['symbol'])){
                resolve(false)
            }

            //set new fields to add in parent
            var pricesObj = await get_current_market_prices('binance', [])
            var currSymbol = buy_order[0]['symbol']
            var orderSellPrice = order_status == 'open' ? pricesObj[currSymbol] : buy_order[0]['market_sold_price']
            var orderPurchasePrice = buy_order[0]['purchased_price']
            //save pl before migration
            var pl_before_migration = calculate_percentage(orderPurchasePrice, orderSellPrice)
            var pl_status_before_migration = (orderSellPrice > orderPurchasePrice) ? 'positive' : 'negative'

            last_trade_buy_price = parseFloat(orderPurchasePrice)
            last_trade_sell_price = parseFloat(orderSellPrice)
            last_trade_pl = parseFloat(pl_before_migration)
            last_trade_pl_status = pl_status_before_migration

            //try to get parent of this order
            let parentOrder = []
            if (typeof buy_order[0]['buy_parent_id'] != 'undefined' && buy_order[0]['buy_parent_id'] != ''){
                parentOrder = await db.collection('buy_orders').find({ '_id': { '$in': [new ObjectID(String(buy_order[0]['buy_parent_id'])), String(buy_order[0]['buy_parent_id']) ] } }).toArray()
            }

            //check if parent of that symbol and level exists, if exists insert the following fields in it else create a new parent
            var coin = buy_order[0]['symbol']
            var whereCoins = { '$in': [coin, 'BTCUSDT'] }
            var coinData = await listmarketPriceMinNotationCoinArr(whereCoins, 'kraken')
            var BTCUSDTPRICE = parseFloat(coinData['BTCUSDT']['currentmarketPrice'])

            var currentMarketPrice = parseFloat(coinData[coin]['currentmarketPrice'])
            var marketMinNotation = coinData[coin]['marketMinNotation']
            var marketMinNotationStepSize = coinData[coin]['marketMinNotationStepSize']
            var toFixedNum = 6

            //find min required quantity
            var extra_qty_percentage = 40;
            var extra_qty_val = 0;
            extra_qty_val = (extra_qty_percentage * marketMinNotation) / 100
            var calculatedMinNotation = parseFloat(marketMinNotation) + extra_qty_val;
            var minReqQty = 0;
            minReqQty = (calculatedMinNotation / currentMarketPrice);

            if (true) {
                // if (exchange == 'kraken') {
                minReqQty = calculatedMinNotation
                toFixedNum = 6
            } else {
                // toFixedNum = (marketMinNotationStepSize + '.').split('.')[1].length
            }

            minReqQty += marketMinNotationStepSize
            minReqQty = parseFloat(minReqQty.toFixed(toFixedNum))

            //TODO: find one usd worth of quantity
            let selectedCoin = coin;

            let splitArr = selectedCoin.split('USDT');
            var quantity = parentOrder.length > 0 ? parentOrder[0]['quantity'] : buy_order[0]['quantity']
            var usd_worth = splitArr[1] == '' ? quantity * currentMarketPrice : quantity * currentMarketPrice * BTCUSDTPRICE
            quantity = parseFloat(parseFloat(quantity).toFixed(toFixedNum))
            usd_worth = parseFloat(usd_worth.toFixed(2))

            //insert extra fields in parent
            if (parentOrder.length > 0){

                // console.log('parent order exists')

                parentOrder[0]['last_trade_buy_price'] = last_trade_buy_price
                parentOrder[0]['last_trade_sell_price'] = last_trade_sell_price
                parentOrder[0]['last_trade_pl'] = last_trade_pl
                parentOrder[0]['last_trade_pl_status'] = last_trade_pl_status

                if (minReqQty <= quantity) {
                    // console.log('creating new parent')



                    /*
                    let where1 = {
                        'admin_id': parentOrder[0]['admin_id'],
                        'order_mode': parentOrder[0]['application_mode'],
                        'application_mode': parentOrder[0]['application_mode'],
                        'order_level': parentOrder[0]['order_level'],
                        'symbol': parentOrder[0]['symbol'],
                        'parent_status': 'parent',
                        'status': { '$ne': 'canceled' },
                    }
                    let kraken_parent = await db.collection('buy_orders_kraken').find(where1).toArray()
                    if (kraken_parent.length > 0){
                        let updateParent = {
                            'last_trade_buy_price': last_trade_buy_price,
                            'last_trade_sell_price': last_trade_sell_price,
                            'last_trade_pl': last_trade_pl,
                            'last_trade_pl_status': last_trade_pl_status,
                            'status': 'new',
                            'migrated_parent': 'yes',
                            'modified_date': new Date(),
                        }
                        await db.collection('buy_orders_kraken').updateOne({ '_id': kraken_parent[0]['_id'] }, { '$set': updateParent})


                        //TODO: insert parent error log
                        var show_hide_log = 'yes'
                        var type = 'migrated_parent'
                        var log_msg = 'Parent has been migrated.'
                        var order_mode = kraken_parent[0]['application_mode']
                        create_orders_history_log(kraken_parent[0]['_id'], log_msg, type, show_hide_log, 'kraken', order_mode, kraken_parent[0]['created_date'])

                        //TODO:  log
                        var show_hide_log = 'yes'
                        var type = 'migrated_parent_'
                        var log_msg = 'Parent migrated successfully.'
                        var order_mode = buy_order[0]['application_mode']
                        create_orders_history_log(buy_order[0]['_id'], log_msg, type, show_hide_log, 'binance', order_mode, buy_order[0]['created_date'])

                    }else{

                        parentOrder[0]['status'] = 'new'
                        parentOrder[0]['migrated_parent'] = 'yes'
                        parentOrder[0]['created_date'] = new Date()
                        parentOrder[0]['modified_date'] = new Date()

                        await db.collection('buy_orders_kraken').insertOne(parentOrder[0], async (err, result) => {
                            if (err) {
                                console.log(err)
                            } else {
                                //TODO: insert parent error log
                                var show_hide_log = 'yes'
                                var type = 'migrated_parent'
                                var log_msg = 'Parent has been migrated.'
                                var order_mode = parentOrder[0]['application_mode']
                                create_orders_history_log(parentOrder[0]['_id'], log_msg, type, show_hide_log, 'kraken', order_mode, parentOrder[0]['created_date'])

                                //TODO:  log
                                var show_hide_log = 'yes'
                                var type = 'migrated_parent_'
                                var log_msg = 'Parent migrated successfully.'
                                var order_mode = buy_order[0]['application_mode']
                                create_orders_history_log(buy_order[0]['_id'], log_msg, type, show_hide_log, 'binance', order_mode, buy_order[0]['created_date'])
                            }
                        })

                    }
                    */

                    parentOrder[0]['status'] = 'new'
                    parentOrder[0]['migrated_parent'] = 'yes'
                    parentOrder[0]['new_insert'] = 'yes'
                    parentOrder[0]['created_date'] = new Date()
                    parentOrder[0]['modified_date'] = new Date()

                    var newObj = Object.assign(parentOrder[0])
                    delete newObj['_id']

                    await db.collection('buy_orders_kraken').insertOne(newObj, async (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            //TODO: insert parent error log
                            var show_hide_log = 'yes'
                            var type = 'migrated_parent'
                            var log_msg = 'Parent has been migrated.'
                            var order_mode = parentOrder[0]['application_mode']
                            create_orders_history_log(result.insertedId, log_msg, type, show_hide_log, 'kraken', order_mode, parentOrder[0]['created_date'])

                            //TODO:  log
                            var show_hide_log = 'yes'
                            var type = 'migrated_parent_'
                            var log_msg = 'Parent migrated successfully.'
                            var order_mode = buy_order[0]['application_mode']
                            create_orders_history_log(buy_order[0]['_id'], log_msg, type, show_hide_log, 'binance', order_mode, buy_order[0]['created_date'])
                        }
                    })

                    successFlag = true
                    minQtyMigrationIssue = false
                }else{

                    // console.log(' parent qty issue')

                    //TODO: insert parent error log
                    var show_hide_log = 'yes'
                    var type = 'migrated_parent_minQty_error'
                    var log_msg = 'Parent could not be migrated because of min qty.'
                    var order_mode = buy_order[0]['application_mode']
                    // create_orders_history_log(parentOrder[0]['_id'], log_msg, type, show_hide_log, 'binance', order_mode, parentOrder[0]['created_date'])
                    create_orders_history_log(buy_order[0]['_id'], log_msg, type, show_hide_log, 'binance', order_mode, buy_order[0]['created_date'])
                }

            }else{
                //create new parent

                // console.log(' creating newww parent ')

                if (minReqQty <= buy_order[0]['quantity']) {

                    // console.log(' newww parent qty ok ')

                    let where1 = {
                        'admin_id': buy_order[0]['admin_id'],
                        'application_mode': buy_order[0]['application_mode'],
                        'order_level': buy_order[0]['level'],
                        'symbol': buy_order[0]['symbol'],
                        'parent_status': 'parent',
                        'status': { '$ne': 'canceled' },
                    }
                    let set1 = {
                        '$set': {
                            'market_value': '',
                            'price': '',
                            'quantity': quantity,
                            'usd_worth': usd_worth,
                            'pick_parent': 'yes',
                            'defined_sell_percentage': buy_order[0]['defined_sell_percentage'],
                            'sell_profit_percent': buy_order[0]['defined_sell_percentage'],
                            'current_market_price': currentMarketPrice,
                            'stop_loss_rule': typeof buy_order[0]['stop_loss'] != 'undefined' && buy_order[0]['stop_loss'] == 'yes' ? 'custom_stop_loss' : '',
                            'custom_stop_loss_percentage': typeof buy_order[0]['custom_stop_loss_percentage'] != 'undefined' ? buy_order[0]['custom_stop_loss_percentage'] : '',
                            'loss_percentage': typeof buy_order[0]['custom_stop_loss_percentage'] != 'undefined' ? buy_order[0]['custom_stop_loss_percentage'] : '',
                            'activate_stop_loss_profit_percentage': 100,
                            'lth_functionality': typeof buy_order[0]['lth_functionality'] != 'undefined' ? buy_order[0]['lth_functionality'] : '',
                            'lth_profit': typeof buy_order[0]['lth_profit'] != 'undefined' ? buy_order[0]['lth_profit'] : '',
                            'stop_loss': typeof buy_order[0]['stop_loss'] != 'undefined' ? buy_order[0]['stop_loss'] : '',
                            'un_limit_child_orders': 'no',
                            'modified_date': new Date(),
                            'created_date': new Date(),
                            'is_sell_order': 'no',
                            'sell_price': '',
                            'randomize_sort': (Math.floor(Math.random() * (1000 - 0 + 1)) + 0),
                            'last_trade_buy_price': last_trade_buy_price,
                            'last_trade_sell_price': last_trade_sell_price,
                            'last_trade_pl': last_trade_pl,
                            'last_trade_pl_status': last_trade_pl_status,
                            'migrated_parent': 'yes',
                            'status': 'new',
                        }
                    }

                    /*
                    let upsert1 = {
                        'upsert': true
                    }
                    // continue
                    db.collection('buy_orders_kraken').updateOne(where1, set1, upsert1, async function (err, result) {
                        if (err) throw err;
                        if (result.upsertedCount > 0) {
                            let remainingFields = {
                                'market_value': '',
                                'price': '',
                                'status': 'new',
                                'pause_status': 'play',
                                'created_date': set1['$set']['modified_date'],
                            }
                            //get Id and update remaining fields
                            // console.log('Inserted_id ', result.upsertedId._id)
                            db.collection('buy_orders_kraken').updateOne({ '_id': result.upsertedId._id }, { '$set': remainingFields })

                            //TODO: insert parent creation log
                            var show_hide_log = 'yes'
                            var type = 'migrated_parent'
                            var log_msg = 'Parent has been migrated.'
                            var order_mode = application_mode
                            create_orders_history_log(result.upsertedId._id, log_msg, type, show_hide_log, 'kraken', order_mode, remainingFields['created_date'])

                            //TODO:  log
                            var show_hide_log = 'yes'
                            var type = 'migrated_parent_'
                            var log_msg = 'Parent migrated successfully.'
                            var order_mode = buy_order[0]['application_mode']
                            create_orders_history_log(buy_order[0]['_id'], log_msg, type, show_hide_log, 'binance', order_mode, buy_order[0]['created_date'])

                        } else if (result.modifiedCount > 0) {

                            db.collection('buy_orders_kraken').find(where1).limit(1).toArray(async function (err, result2) {
                                if (err) throw err;
                                if (result2.length > 0) {
                                    // console.log('modified_id ', String(result2[0]['_id']))

                                    //TODO: insert parent creation log
                                    var show_hide_log = 'yes'
                                    var type = 'migrated_parent'
                                    var log_msg = 'Parent has been migrated.'
                                    var order_mode = application_mode
                                    create_orders_history_log(result2[0]['_id'], log_msg, type, show_hide_log, exchange, order_mode, result2[0]['created_date'])

                                    //TODO:  log
                                    var show_hide_log = 'yes'
                                    var type = 'migrated_parent_'
                                    var log_msg = 'Parent migrated successfully.'
                                    var order_mode = buy_order[0]['application_mode']
                                    create_orders_history_log(buy_order[0]['_id'], log_msg, type, show_hide_log, 'binance', order_mode, buy_order[0]['created_date'])

                                }
                            })

                        }
                    })
                    */

                    var newObj = Object.assign(set1['$set'], {
                        'market_value': '',
                        'price': '',
                        'status': 'new',
                        'pause_status': 'play',
                        'created_date': set1['$set']['modified_date']})
                    delete newObj['_id']

                    await db.collection('buy_orders_kraken').insertOne(newObj, async (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            //TODO: insert parent error log
                            var show_hide_log = 'yes'
                            var type = 'migrated_parent'
                            var log_msg = 'Parent has been migrated.'
                            var order_mode = parentOrder[0]['application_mode']
                            create_orders_history_log(result.insertedId, log_msg, type, show_hide_log, 'kraken', order_mode, parentOrder[0]['created_date'])

                            //TODO:  log
                            var show_hide_log = 'yes'
                            var type = 'migrated_parent_'
                            var log_msg = 'Parent migrated successfully.'
                            var order_mode = buy_order[0]['application_mode']
                            create_orders_history_log(buy_order[0]['_id'], log_msg, type, show_hide_log, 'binance', order_mode, buy_order[0]['created_date'])
                        }
                    })

                    successFlag = true
                    minQtyMigrationIssue = false
                }else{

                    // console.log(' newww parent qty issue ')

                    //TODO: insert parent error log
                    var show_hide_log = 'yes'
                    var type = 'migrated_parent_minQty_error'
                    var log_msg = 'Parent could not be migrated because of min qty.'
                    var order_mode = buy_order[0]['application_mode']
                    create_orders_history_log(buy_order[0]['_id'], log_msg, type, show_hide_log, 'binance', order_mode, buy_order[0]['created_date'])
                }

            }


            let updddtemp = {
                '$set': {
                    'migrated_parent': 'yes',
                    'modified_date': new Date(),
                }
            }
            if (minQtyMigrationIssue){
                updddtemp['$set']['minQtyMigrationIssue'] = 'yes'
            }

            buy_order = await db.collection('buy_orders').find({ '_id': new ObjectID(String(order_id)) }).toArray()
            if (buy_order.length > 0) {
                //add field so button not show again
                await db.collection('buy_orders').updateOne({ '_id': new ObjectID(String(order_id)) }, updddtemp)
            } else {
                buy_order = await db.collection('sold_buy_orders').find({ '_id': new ObjectID(String(order_id)) }).toArray()
                //add field so button not show again
                await db.collection('sold_buy_orders').updateOne({ '_id': new ObjectID(String(order_id)) }, updddtemp)
            }

        }

        resolve(successFlag)
    })
}

async function verify_migrate_user_api_key(user_id){
    let reqObj = {
        'type': 'POST',
        'url': 'https://app.digiebot.com/admin/api_calls/verify_api_key_secret',
        'payload': {
            'user_id': user_id,
            'exchange': 'binance'
        },
    }
    let result = await customApiRequest(reqObj)
    return result.status && result.body['status'] ? true : false
}

async function is_sell_migrate_order_normally(order_id){

    //get order
    return new Promise(async resolve => {

        const db = await conn

        let order_status = ''
        let buy_order = []
        //get order and check if it's open or sold
        buy_order = await db.collection('buy_orders').find({ '_id': new ObjectID(String(order_id)) }).toArray()
        if (buy_order.length > 0) {
            order_status = 'open'

            //check this order owner api key if valid then send response true to sell normally else move order to sold collection from here
            if (await verify_migrate_user_api_key(buy_order[0]['admin_id'])){
                resolve(true)
            }else{

                //update fields and move order to sold then delete from buy collection
                let pricesObj = await get_current_market_prices('binance', [])
                let symbol = buy_order[0]['symbol']
                let updObj = {
                    'is_sell_order': 'sold',
                    'status': 'FILLED',
                    'market_sold_price': pricesObj[symbol],
                    'modified_date': new Date(),
                }

                //update fields to sell
                await db.collection('buy_orders').updateOne({ '_id': buy_order[0]['_id'] }, { '$set': updObj})

                //move to sold collection
                buy_order = await db.collection('buy_orders').find({ '_id': buy_order[0]['_id'] }).toArray()
                await db.collection('sold_buy_orders').insertOne(buy_order[0])

                //delete from buy collection
                // await db.collection('buy_orders').deleteOne({ '_id': buy_order[0]['_id'] })

                resolve(false)
            }
        }else{
            resolve(false)
        }
    })

}


router.post('/test_user_api_key', auth_token.required, async (req, resp)=>{

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let result = await verify_migrate_user_api_key('5c09134cfc9aadaac61dd09c')
    resp.send({result:result})
})


//function for updating any collection the base of collection and filtes
function updateOne(filter, update, collectionName) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let set = {};
            set['$set'] = update;
            db.collection(collectionName).updateOne(filter, set, (err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result)
                }
            })
        })
    })
} //End of updateCollection

//get user ip for trading
function listUsrIp(admin_id) {
    return new Promise((resolve, reject) => {
        conn.then((db) => {
            let searchCriteria = {};
            searchCriteria['_id'] = new ObjectID(admin_id)

            db.collection('users').find(searchCriteria).toArray((err, success) => {
                if (err) {
                    resolve(err)
                } else {
                    var trading_ip = '';

                    if (success.length > 0) {
                        trading_ip = success[0]['trading_ip'];
                    }
                    resolve(trading_ip);
                }
            })
        })
    })
} //End of listUsrIp

//this function save the ready order for sell after that the order is sold by specified ip
function readySellOrderbyIp(order_id, quantity, market_price, coin_symbol, admin_id, buy_orders_id, trading_ip, trigger_type, type, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            var insert_arr = {};
            insert_arr['order_id'] = order_id;
            insert_arr['quantity'] = quantity;
            insert_arr['market_price'] = parseFloat(market_price);
            insert_arr['coin_symbol'] = coin_symbol;
            insert_arr['admin_id'] = admin_id;
            insert_arr['buy_orders_id'] = buy_orders_id;
            insert_arr['trading_ip'] = trading_ip;
            insert_arr['trigger_type'] = trigger_type;
            insert_arr['order_type'] = type;
            insert_arr['order_status'] = 'ready';
            insert_arr['global'] = 'global';
            insert_arr['created_date'] = new Date();
            insert_arr['modified_date'] = new Date();
            let collection = (exchange == 'binance') ? 'ready_orders_for_sell_ip_based' : 'ready_orders_for_sell_ip_based_' + exchange;

            // console.log('insert_arr', insert_arr);
            let where = {
                'order_id': { '$in': [new ObjectID(String(order_id)), String(order_id)]},
                'buy_orders_id': { '$in': [new ObjectID(String(buy_orders_id)), String(buy_orders_id)]},
            }
            db.collection(collection).updateOne(where, {'$set':insert_arr}, {'upsert':true}, (err, result) => {

                // console.log('error', err);
                // console.log('result', result);

                if (err) {
                    resolve(err)
                } else {
                    resolve(result)
                }
            })
        })
    })
} //End of readySellOrderbyIp
//function for selling test order
function sellTestOrder(sell_order_id, currentMarketPrice, buy_order_id, exchange,buyParentOrderId) {

    (async () => {
        var collectionName = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
        var search = {};
        search['_id'] = new ObjectID(sell_order_id);
        //search['status'] = {'$in':['new','LTH']}

        var orderResp = await find(collectionName, search);
        if (orderResp.length > 0) {

            var orderArr = orderResp[0];

            var quantity = (typeof orderArr['quantity'] == 'undefined') ? 0 : orderArr['quantity'];
            var symbol   = (typeof orderArr['symbol'] == 'undefined') ? '' : orderArr['symbol'];

            var update = {};
            update['market_value'] = currentMarketPrice;
            update['status'] = 'submitted';
            update['modified_date'] = new Date();
            update['sell_date'] = new Date();
            update['binance_order_id'] = '111000';

            var filter = {};
            filter['_id'] = new ObjectID(sell_order_id)

            var collectionName = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
            var updatePromise_1 = updateOne(filter, update, collectionName);
            updatePromise_1.then((resp) => {})
            var log_msg = "Sell Market Order was <b>SUBMITTED</b>";
            // var logPromise_1 = recordOrderLog(buy_order_id, log_msg, 'sell_order_submitted', 'yes', exchange);
            var getBuyOrder = await listOrderById(buy_order_id, exchange);
            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
            var logPromise_1 = create_orders_history_log(buy_order_id, log_msg, 'sell_order_submitted', 'yes', exchange, order_mode, order_created_date)
            logPromise_1.then((resp) => {})


            //%%%%%%%%%%% Market Filled Process %%%%%%%%%%%%%%%%%%
            var commissionAsset = 'BTC';
            var commission_value = parseFloat(quantity) * (0.001);
            var commission = commission_value * currentMarketPrice;


            let globalCoin = (exchange == 'coinbasepro') ? 'BTCUSD' : 'BTCUSDT';
            var USDCURRENTVALUE = await listCurrentMarketPrice(globalCoin, exchange);

            var btcPriceArr = (typeof USDCURRENTVALUE[0] == 'undefined') ? [] : USDCURRENTVALUE[0];
            var BTCUSDTPRICE = (typeof btcPriceArr.market_value == 'undefined') ? btcPriceArr.price : btcPriceArr.market_value

            //getting the coin from global coin
            let splitArr = symbol.split('USDT');
            var sellUsdPrice = (quantity * currentMarketPrice) * BTCUSDTPRICE;
            var sellUsdPrice = (typeof splitArr[1] != 'undefined' && splitArr[1] == '') ? quantity : sellUsdPrice;

            var upd_data = {};
            upd_data['is_sell_order'] = 'sold';
            upd_data['market_sold_price'] = parseFloat(currentMarketPrice);
            upd_data['status'] = 'FILLED';
            upd_data['trading_status'] = 'complete';
            upd_data['market_sold_price_usd'] = sellUsdPrice;
            upd_data['modified_date'] = new Date();


            var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            var where = {};
            where['sell_order_id'] = {
                $in: [new ObjectID(sell_order_id), sell_order_id]
            };
            var updtPromise_1 = updateOne(where, upd_data, collectionName);
            updtPromise_1.then((callback) => {})


            var collectionName = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
            var where = {};
            var updOrder = {};
            updOrder['status'] = 'FILLED';
            updOrder['market_value'] = parseFloat(currentMarketPrice);
            where['_id'] = new ObjectID(sell_order_id)
            var updtPromise_1 = updateOne(where, updOrder, collectionName);
            updtPromise_1.then((callback) => {})


            var log_msg = "Sell Market Order is <b>FILLED</b> at price " + parseFloat(currentMarketPrice).toFixed(8);
            // var logPromise_3 = recordOrderLog(buy_order_id, log_msg, 'market_filled', 'yes', exchange);
            var logPromise_3 = create_orders_history_log(buy_order_id, log_msg, 'market_filled', 'yes', exchange, order_mode, order_created_date)
            logPromise_3.then((callback) => {})

            var log_msg = "Broker Fee <b>" + parseFloat(commission).toFixed(8) + " From " + commissionAsset + "</b> has token on this Trade";
            // var logPromise_3 = recordOrderLog(buy_order_id, log_msg, 'sell_filled', 'yes', exchange);
            var logPromise_3 = create_orders_history_log(buy_order_id, log_msg, 'sell_filled', 'yes', exchange, order_mode, order_created_date)
            logPromise_3.then((callback) => {})

            // Update parent order to NEW to take new order .
            if (buyParentOrderId != '' && buyParentOrderId != 'undefined') {
                var where = {};
                var updBuyOrder = {}
                let collection_name = (exchange == 'binance') ? 'buy_orders' : 'buy_orders' + exchange;
                updBuyOrder.status = 'new';
                updBuyOrder.modified_date = new Date();
                where['_id'] = new ObjectID(buyParentOrderId);
                where['status'] = 'takingOrder';
                var updBuyPromise = updateOne(where, updBuyOrder, collection_name);
                updBuyPromise.then((resolve) => {});
                var log_msg = "Parent status updated from child in progress TO new ";
                var logPromise_2 = create_orders_history_log(buy_order_id, log_msg, 'fee_deduction', 'yes', exchange, order_mode, order_created_date)
                logPromise_2.then((callback) => {})
            }// END of if (buyParentOrderId != '' && buyParentOrderId != 'undefined')
            copySoldOrders(buy_order_id, exchange);

        }
    })()
} //End of sellTestOrder
//function to find from a collection on the base for search
function find(collectionName, search) {
    return new Promise((resolve) => {
        conn.then((db) => {
            db.collection(collectionName).find(search).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result)
                }
            })
        })
    })
} //End of findOne

//post call from order listing to buy order
router.post('/buyOrderManually', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
    var orderId = req.body.orderId;
    var coin = req.body.coin;
    var exchange = req.body.exchange;
    //get buy order detail
    var ordeResp = await listOrderById(orderId, exchange);
    if (ordeResp.length > 0) {
        var orderArr = ordeResp[0];
        let admin_id = (typeof orderArr['admin_id'] == undefined) ? '' : orderArr['admin_id'];
        let status = (typeof orderArr['status'] == undefined) ? '' : orderArr['status'];
        let application_mode = (typeof orderArr['application_mode'] == undefined) ? '' : orderArr['application_mode'];

        let buy_quantity = (typeof orderArr['quantity'] == undefined) ? '' : orderArr['quantity'];
        let symbol = (typeof orderArr['symbol'] == undefined) ? '' : orderArr['symbol'];

        let buy_trigger_type = (typeof orderArr['trigger_type'] == undefined) ? '' : orderArr['trigger_type'];
        //geting trading ip
        var trading_ip = await listUsrIp(admin_id);

        if (status == 'new') {
            var update = {};
            update['modified_date'] = new Date();
            update['is_manual_buy'] = 'yes';
            update['buyRightAway']  = 'yes';
            update['sentforbuytoDigieiptrading']  = 'yes';
            var filter = {};
            filter['_id'] = new ObjectID(orderId);
            let collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            var updatePromise_1 = updateOne(filter, update, collectionName);
            updatePromise_1.then((resolve) => {})

            var currentMarketPriceArr = await listCurrentMarketPrice(symbol, exchange);
            var currentMarketPrice = (currentMarketPriceArr.length == 0) ? 0 : currentMarketPriceArr[0]['price'];
            currentMarketPrice = parseFloat(currentMarketPrice);


            var log_msg = "Order Send for buy Manually On " + parseFloat(currentMarketPrice).toFixed(8) + " " + interfaceType;
            // var logPromise = recordOrderLog(orderId, log_msg, 'submitted', 'yes', exchange);
            var getBuyOrder = await listOrderById(orderId, exchange);
            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
            var logPromise = create_orders_history_log(orderId, log_msg, 'sell_filled', 'yes', exchange, order_mode, order_created_date)
            logPromise.then((callback) => {
                // console.log(callback)
            })

            //Send Notification
            send_notification(getBuyOrder[0]['admin_id'], 'buy_alerts', 'medium', log_msg, orderId, exchange, getBuyOrder[0]['symbol'], order_mode, '')

            //if order mode  is live then send order from here to specific ip
            if (application_mode == 'live') {

                let buy_trigger_type = '';
                //order send to specif ip for buying
                var respPromise = orderReadyForBuy(orderId, buy_quantity, currentMarketPrice, symbol, admin_id, trading_ip, buy_trigger_type, 'buy_market_order', exchange);
                respPromise.then((callback) => {})
            } else {
                //function for buy test ordres
                buyTestOrder(orderArr, currentMarketPrice, exchange);
            }
        } //End of if status is new


        resp.status(200).send({
            message: 'response comming'
        });

    } //End of Order length
}) //End of buyOrderManually



//buy test order
function buyTestOrder(orders, market_value, exchange) {
    (async () => {
        if (orders['status'] == 'new') {
            var quantity = orders['quantity'];
            var sell_order_id = (typeof orders['sell_order_id'] == 'undefined') ? '' : orders['sell_order_id'];
            var symbol = (typeof orders['symbol'] == 'undefined') ? '' : orders['symbol'];
            var id = (typeof orders['_id'] == 'undefined') ? '' : orders['_id'];



            var symbol = orders['symbol'];
            let upd = {};
            upd['market_value'] = market_value;
            upd['status'] = 'submitted';
            upd['modified_date'] = new Date();
            upd['buy_date'] = new Date()
            var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            var where = {};
            where['_id'] = new ObjectID(id)
            var updPromise = updateOne(where, upd, collectionName);
            updPromise.then((callback) => {})
            var log_msg = "Buy Market Order was <b>SUBMITTED</b>";
            // var logPromise = recordOrderLog(id, log_msg, 'submitted', 'yes', exchange);
            var getBuyOrder = await listOrderById(id, exchange);
            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
            var logPromise = create_orders_history_log(id, log_msg, 'sell_filled', 'yes', exchange, order_mode, order_created_date)
            logPromise.then((callback) => {

            })

            //%%%%%%%%%%% Market Filled Process %%%%%%%%%%%%%%%%%%
            var commission = parseFloat(quantity) * (0.001);
            let splitUSDT = symbol.split('USDT');
            let splitBTC = symbol.split('BTC');
            var commissionAsset = (typeof splitUSDT[1] == 'undefined') ? splitBTC[0] : splitUSDT[0];
            var sellQty = quantity - commission;

            var log_msg = "Broker Fee <b>" + commission.toFixed(3) + "</b> Has been deducted from sell quantity ";
            // var logPromise_1 = recordOrderLog(id, log_msg, 'fee_deduction', 'yes', exchange);
            getBuyOrder = await listOrderById(id, exchange);
            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
            var logPromise_1 = create_orders_history_log(id, log_msg, 'fee_deduction', 'yes', exchange, order_mode, order_created_date)
            logPromise_1.then((callback) => {})


            var log_msg = "Order Quantity Updated from <b>(" + quantity + ")</b> To  <b>(" + sellQty + ')</b> Due to Deduction Binance Fee from buying Coin';
            // var logPromise_2 = recordOrderLog(id, log_msg, 'fee_deduction', 'yes', exchange);
            var getBuyOrder = await listOrderById(id, exchange);
            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
            var logPromise_2 = create_orders_history_log(id, log_msg, 'fee_deduction', 'yes', exchange, order_mode, order_created_date)
            logPromise_2.then((callback) => {})


            var USDCURRENTVALUEARR = await listCurrentMarketPrice('BTCUSDT', exchange);
            var USDCURRENTVALUE = (USDCURRENTVALUEARR.length == 0) ? 0 : USDCURRENTVALUEARR[0]['price'];
            USDCURRENTVALUE = parseFloat(USDCURRENTVALUE);


            let splitArr = symbol.split('USDT');
            var purchaseUsdPrice = (quantity * market_value) * USDCURRENTVALUE;
            var purchaseUsdPrice = (typeof splitArr[1] != 'undefined' && splitArr[1] == '') ? quantity : purchaseUsdPrice;


            var upd_data = {};
            upd_data['status'] = 'FILLED';
            upd_data['market_value'] = parseFloat(market_value);
            upd_data['purchased_price'] = market_value;
            upd_data['market_value_usd'] = purchaseUsdPrice;
            upd_data['modified_date'] = new Date();
            upd_data['buy_date'] = new Date()

            var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            var where = {};
            where['_id'] = new ObjectID(id)
            var updtPromise_1 = updateOne(where, upd_data, collectionName);
            updtPromise_1.then((callback) => {})

            if (sell_order_id != '') {
                var updOrder = {};
                updOrder['purchased_price'] = parseFloat(market_value);
                updOrder['quantity'] = sellQty;

                var collectionName = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;

                var where_1 = {};
                where_1['_id'] = new ObjectID(sell_order_id)
                updOrder['modified_date'] = new Date();
                var updtPromise_1 = updateOne(where_1, updOrder, collectionName);
                updtPromise_1.then((callback) => {})
            }


            var log_msg = "Buy Market Order is <b>FILLED</b> at price " + parseFloat(market_value).toFixed(8);
            // var logPromise_3 = recordOrderLog(id, log_msg, 'market_filled', 'yes', exchange);
            var getBuyOrder = await listOrderById(id, exchange);
            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
            var logPromise_3 = create_orders_history_log(id, log_msg, 'market_filled', 'yes', exchange, order_mode, order_created_date)
            logPromise_3.then((callback) => {})

            var log_msg = "Broker Fee <b>" + commission.toFixed(8) + " From " + commissionAsset + "</b> has token on this Trade";
            // var logPromise_3 = recordOrderLog(id, log_msg, 'market_filled', 'yes', exchange);
            var getBuyOrder = await listOrderById(id, exchange);
            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
            var logPromise_3 = create_orders_history_log(id, log_msg, 'market_filled', 'yes', exchange, order_mode, order_created_date)
            logPromise_3.then((callback) => {})



            //************ -- Make Order From Auto Sell -- ******
            var auto_sell = (typeof orders['auto_sell'] == 'undefined') ? '' : orders['auto_sell'];

            //if buy order is manual order and auto sell yes then after buy the order create sell orders
            if (auto_sell == 'yes') {
                createOrderFromAutoSell(orders, exchange);
            } //if auto sell is yes

            //End of Crate Auto Sell



        } //End if Order is New

    })()
} //End of buyTestOrder

//if auto sell is yes for manual order then create sell ordrs
function createOrderFromAutoSell(orderArr, exchange) {
    var buy_order_id = orderArr['_id'];
    var auto_sell = (typeof orderArr['auto_sell'] == 'undefined') ? '' : orderArr['auto_sell'];
    var admin_id = (typeof orderArr['admin_id'] == 'undefined') ? '' : orderArr['admin_id'];
    var symbol = (typeof orderArr['symbol'] == 'undefined') ? '' : orderArr['symbol'];
    var binance_order_id = (typeof orderArr['binance_order_id'] == 'undefined') ? '' : orderArr['binance_order_id'];
    var purchased_price = (typeof orderArr['market_value'] == 'undefined') ? '' : orderArr['market_value'];

    (async () => {
        ////////////////////////////////////////////////////////////////////////
        //Double check or suto sell is yes
        if (auto_sell == 'yes') {

            var buy_order_check = 'yes';
            //Get Sell Temp Data
            //get temp sell order for creating sell order
            var respArr = await listTempSellOrder(buy_order_id, exchange);
            var sell_data_arr = (typeof respArr[0] == 'undefined') ? [] : respArr[0];
            var profit_type = (typeof sell_data_arr['profit_type'] == 'undefined') ? '' : sell_data_arr['profit_type'];
            var sell_profit_percent = (typeof sell_data_arr['profit_percent'] == 'undefined') ? '' : sell_data_arr['profit_percent'];
            var sell_profit_price = (typeof sell_data_arr['profit_price'] == 'undefined') ? '' : sell_data_arr['profit_price'];
            var order_type = (typeof sell_data_arr['order_type'] == 'undefined') ? '' : sell_data_arr['order_type'];
            var trail_check = (typeof sell_data_arr['trail_check'] == 'undefined') ? '' : sell_data_arr['trail_check'];
            var trail_interval = (typeof sell_data_arr['trail_interval'] == 'undefined') ? '' : parseFloat(sell_data_arr['trail_interval']);
            var stop_loss = (typeof sell_data_arr['stop_loss'] == 'undefined') ? '' : sell_data_arr['stop_loss'];
            var loss_percentage = (typeof sell_data_arr['loss_percentage'] == 'undefined') ? '' : sell_data_arr['loss_percentage'];
            var application_mode = (typeof sell_data_arr['application_mode'] == 'undefined') ? '' : sell_data_arr['application_mode'];
            var lth_functionality = (typeof sell_data_arr['lth_functionality'] == 'undefined') ? '' : sell_data_arr['lth_functionality'];
            var lth_profit = (typeof sell_data_arr['lth_profit'] == 'undefined') ? '' : sell_data_arr['lth_profit'];
            var quantity = (typeof sell_data_arr['quantity'] == 'undefined') ? '' : sell_data_arr['quantity'];

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
            ins_data['lth_profit'] = lth_profit;
            ins_data['loss_percentage'] = loss_percentage;
            ins_data['application_mode'] = application_mode
            ins_data['trigger_type'] = 'no';
            ins_data['modified_date'] = new Date();
            ins_data['created_date'] = new Date();


            if (profit_type == 'percentage') {
                var sell_price = purchased_price * sell_profit_percent;
                var sell_price = sell_price / 100;
                var sell_price = sell_price + purchased_price;
                var sell_price = parseFloat(sell_price).toFixed(8)
                ins_data['sell_profit_percent'] = sell_profit_percent;
                ins_data['sell_price'] = sell_price;
            } else {
                var sell_price = sell_profit_price;
                ins_data['sell_profit_price'] = sell_profit_price;
                ins_data['sell_price'] = sell_price;
            }
            if (trail_check == 'yes') {
                ins_data['trail_check'] = 'yes';
                ins_data['trail_interval'] = parseFloat(trail_interval);
                ins_data['sell_trail_price'] = 0;
                ins_data['status'] = 'new';
            } else {
                ins_data['trail_check'] = 'no';
                ins_data['trail_interval'] = 0;
                ins_data['sell_trail_price'] = 0;
                ins_data['status'] = 'new';
            }


            var collectionName = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
            //create sell order from temp_sell_orders
            var order_id = await createOrder(collectionName, ins_data);
            if (buy_order_check == 'yes') {
                //Update Buy Order
                var upd_data = {};
                upd_data['is_sell_order'] = 'yes';
                upd_data['lth_functionality'] = lth_functionality;
                upd_data['sell_order_id'] = order_id;
                var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                var where = {};
                where['_id'] = new ObjectID(buy_order_id)
                upd_data['modified_date'] = new Date();
                var upsert = {
                    'upsert': true
                };
                //function for update buy_order in the case of create sell order
                var updPromise = updateSingle(collectionName, where, upd_data, upsert);
                updPromise.then((callback) => {})
            }

            var log_msg = "Sell Order was Created from Auto Sell";

            // var logPromise = recordOrderLog(buy_order_id, log_msg, 'create_sell_order', 'yes', exchange);
            var getBuyOrder = await listOrderById(buy_order_id, exchange);
            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
            var logPromise = create_orders_history_log(buy_order_id, log_msg, 'market_filled', 'yes', exchange, order_mode, order_created_date)
            logPromise.then((callback) => {})
        } // if($auto_sell =='yes')
        ////////////////////////////////////////////////////////////////////////
    })()

} //End of createOrderFromAutoSell

//function for creating orders buy order the base of provide data
function createOrder(collectionName, ins_data) {
    return new Promise((resolve) => {
        conn.then((db) => {
            db.collection(collectionName).insertOne(ins_data, (err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result.insertedId)
                }
            })
        })
    })
} //End of createOrder



//get temp sell order for creating auto sell orders
function listTempSellOrder(buy_order_id, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let where = {};
            where['buy_order_id'] = {
                $in: [buy_order_id, new ObjectID(buy_order_id)]
            };

            var collection = (exchange == 'binance') ? 'temp_sell_orders' : 'temp_sell_orders_' + exchange;
            db.collection(collection).find(where).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of listTempSellOrder

//function for send ready order to buy to specific ip
function orderReadyForBuy(buy_order_id, buy_quantity, market_value, coin_symbol, admin_id, trading_ip, trigger_type, type, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            var insert_arr = {};
            insert_arr['buy_order_id'] = new ObjectID(String(buy_order_id));
            insert_arr['buy_quantity'] = buy_quantity;
            insert_arr['market_value'] = market_value;
            insert_arr['coin_symbol'] = coin_symbol;
            insert_arr['admin_id'] = admin_id;
            insert_arr['trading_ip'] = trading_ip;
            insert_arr['trigger_type'] = trigger_type;
            insert_arr['order_type'] = type;
            insert_arr['order_status'] = 'ready';
            insert_arr['created_date'] = new Date();
            insert_arr['modified_date'] = new Date();
            insert_arr['global'] = 'global';
            let collection = (exchange == 'binance') ? 'ready_orders_for_buy_ip_based' : 'ready_orders_for_buy_ip_based_' + exchange;


            let where = {
                'buy_order_id': { '$in': [new ObjectID(String(buy_order_id)), String(buy_order_id)] }
            }

            db.collection(collection).updateOne(where, {'$set':insert_arr}, {'upsert':true}, (err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result.insertedId);
                }
            })
        })
    })
} //End of orderReadyForBuy


//get sold order by id
function listSoldOrders(primaryID, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let searchCriteria = {};
            searchCriteria.status = 'FILLED';
            searchCriteria.is_sell_order = 'sold';
            searchCriteria.is_order_copyed = {
                '$ne': 'yes'
            };
            if (primaryID != '') {
                searchCriteria._id = primaryID;
            }
            let collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            db.collection(collection).find(searchCriteria).limit(500).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of listSoldOrders

//when an order sold the we copy the order from buy_orders collection to sold_buy_orders collection
function copySoldOrders(order_id, exchange) {
    conn.then((db) => {

        (async () => {
            let soldOrdersArr = await listSoldOrders(order_id, exchange);
            if (typeof soldOrdersArr != 'undefined' && soldOrdersArr.length > 0) {
                let collection = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
                for (let index in soldOrdersArr) {
                    let _id = soldOrdersArr[index]['_id'];
                    let searchQuery = {};
                    searchQuery._id = _id;
                    let updateQuery = {};
                    updateQuery = soldOrdersArr[index];
                    let upsert = {};
                    upsert.upsert = true;
                    var deletePromise = deleteBuyOrders(order_id, exchange);
                    deletePromise.then((callback) => {})
                    var updSingle = updateSingle(collection, searchQuery, updateQuery, upsert);
                    updSingle.then((callback) => {})
                }
            }
        })()

    }).catch((err) => {
        throw err
    })
} //End of copySoldOrders

// Delete buy order by id
function deleteBuyOrders(_id, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let searchCriteria = {};
            searchCriteria._id = _id;
            let collection = 'buy_orders_' + exchange;
            db.collection(collection).deleteOne(searchCriteria, (err, response) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(response)
                }
            })
        }).catch((err) => {
            throw (err);
        })
    })
} //End of deleteBuyOrders


function updateSingle(collection, searchQuery, updateQuery, upsert) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let set = {};
            set['$set'] = updateQuery;
            db.collection(collection).updateOne(searchQuery, set, upsert, (err, success) => {
                if (err) {
                    resolve(err);
                } else {
                    resolve(success);
                }
            })
        })
    })
} //End of update

//post call frol listing order on chart
router.post('/listOrdersForChart', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

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
//function for getting order to show on chart
function listOrdersForChart(admin_id, exchange, application_mode, coin) {
    return new Promise((resolve) => {
        let filter = {};
        filter['status'] = {
            '$in': ['submitted', 'FILLED', 'new', 'LTH']
        }
        filter['price'] = {
            $nin: [null, ""]
        };
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

//get sell order detail by id
function listSellOrderById(ID, exchange) {
    return new Promise((resolve) => {
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

//get temp sell order detail in case of new buy orders
function listselTempOrders(ID, exchange) {
    return new Promise((resolve) => {
        let filter = {};
        filter['buy_order_id'] = (ID == '' || ID == undefined || ID == null) ? ID : new ObjectID(ID);
        conn.then((db) => {
            var collection = (exchange == 'binance') ? 'temp_sell_orders' : 'temp_sell_orders_' + exchange;
            db.collection(collection).find(filter).toArray((err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    resolve(result);
                }
            }) //End of collection
        }) //End of conn
    }) //End of Promise
} //End of listselTempOrders


//post call for updaing buy price from chart if order is not buyed
router.post('/updateBuyPriceFromDragging', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var exchange = req.body.exchange;
    var orderId = req.body.orderId;
    var previous_buy_price = parseFloat(req.body.previous_buy_price);
    var updated_buy_price = parseFloat(req.body.updated_buy_price);

    var buyOrderResp = await listOrderById(orderId, exchange);
    var buyOrderArr = (typeof buyOrderResp[0] == 'undefined') ? [] : buyOrderResp[0];

    var sell_order_id = (typeof buyOrderArr['sell_order_id'] == 'undefined') ? '' : buyOrderArr['sell_order_id'];

    var status = (typeof buyOrderArr['status'] == 'undefined') ? '' : buyOrderArr['status'];

    var trigger_type = (typeof buyOrderArr['trigger_type'] == 'undefined') ? '' : buyOrderArr['trigger_type'];

    if (trigger_type == 'no') {

        if (sell_order_id != '') {
            var sellOrderResp = await listSellOrderById(sell_order_id, exchange);

            var sellOrderArr = (typeof sellOrderResp[0] == 'undefined') ? [] : sellOrderResp[0];
            var sell_price = (typeof sellOrderArr.sell_price == 'undefined') ? 0 : sellOrderArr.sell_price;

            if (status == 'new') {
                var buy_price = buyOrderArr.price;
            } else {
                var buy_price = (typeof buyOrderArr.market_value == 'undefined') ? buyOrderArr.price : buyOrderArr.market_value;
            }

            var current_data2222 = sell_price - buy_price;
            var sell_percentage = (current_data2222 * 100 / buy_price);
            sell_percentage = isNaN(sell_percentage) ? 0 : sell_percentage;


            var new_sell_price = parseFloat(updated_buy_price) + parseFloat((updated_buy_price / 100) * sell_percentage);

            var filter = {};
            filter['_id'] = new ObjectID(sell_order_id);
            var update_order = {};
            update_order['sell_price'] = new_sell_price;
            var collection_order = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
            var updatePromise = updateOne(filter, update_order, collection_order);
            updatePromise.then((resolve) => {});

        } else { //End of sell order id not empty

            var tempOrderResp = await listselTempOrders(orderId, exchange);
            if (tempOrderResp.length > 0) {
                var tempOrderArr = (typeof tempOrderResp[0] == 'undefined') ? [] : tempOrderResp[0];
                var profit_price = (typeof tempOrderArr.profit_price == 'undefined') ? 0 : tempOrderArr.profit_price;


                var profit_percent = (typeof tempOrderArr.profit_percent == 'undefined') ? 0 : tempOrderArr.profit_percent;


                var temp_order_id = tempOrderArr['_id'];
                if (status == 'new') {
                    var buy_price = buyOrderArr.price;
                } else {
                    var buy_price = (typeof buyOrderArr.market_value == 'undefined') ? buyOrderArr.price : buyOrderArr.market_value;
                }


                if (profit_percent == 0 || profit_percent == '') {
                    var current_data2222 = profit_price - buy_price;
                    var sell_percentage = (current_data2222 * 100 / buy_price);
                    sell_percentage = isNaN(sell_percentage) ? 0 : sell_percentage;
                } else {
                    sell_percentage = profit_percent;
                }


                var new_sell_price = parseFloat(updated_buy_price) + parseFloat((updated_buy_price / 100) * sell_percentage);

                /*  (: Update the sell price form here  BY Ali 7-12-2019 According to sir  :) */
                var filter = {};
                filter['_id'] = new ObjectID(orderId);
                var update_order = {};
                update_order['sell_price'] = parseFloat(new_sell_price);
                update_order['exchange'] = exchange;
                var collection_order = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                var updatePromiseBuy = updateOne(filter, update_order, collection_order);
                updatePromiseBuy.then((resolve) => {});

                /*  (: Update the sell price form here  BY Ali 7-12-2019 According to sir  :) */




                var filter = {};
                filter['_id'] = temp_order_id;
                var update = {};
                update['profit_price'] = new_sell_price;
                var collection = (exchange == 'binance') ? 'temp_sell_orders' : 'temp_sell_orders_' + exchange;
                var updatePromise = updateOne(filter, update, collection);
                updatePromise.then((resolve) => {});
            } //End of temp order Arr
        }

    } //End of trigger type no




    var log_msg = "Order buy price updated from(" + parseFloat(previous_buy_price).toFixed(8) + ") to " + parseFloat(updated_buy_price).toFixed(8) + "  From Chart";

    // var logPromise = recordOrderLog(orderId, log_msg, 'buy_price_updated', 'yes', exchange);
    var getBuyOrder = await listOrderById(orderId, exchange);
    var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
    var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
    var logPromise = create_orders_history_log(orderId, log_msg, 'buy_price_updated', 'yes', exchange, order_mode, order_created_date)
    logPromise.then((callback) => {});

    var filter = {};
    filter['_id'] = new ObjectID(orderId);
    var update = {};
    update['price'] = updated_buy_price;

    console.log(getBuyOrder[0])
    if(getBuyOrder[0]['deep_price_on_off'] !== 'undefined' && getBuyOrder[0]['deep_price_on_off'] == 'yes' && getBuyOrder[0]['status'] == 'new'){
      console.log('Update Deep Price now')
      update['expecteddeepPrice'] = updated_buy_price;
    } else {
      console.log('Not Update Deep Price now')
    }
    update['modified_date'] = new Date();
    var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
    var updatePromise = await updateOne(filter, update, collectionName);

    resp.status(200).send({
        message: 'Order Buy Price Updated Successfully'
    })

}) //End of updateBuyPriceFromDragging
//post call for update profit and loss percentage for a specific order from chart
router.post('/updateOrderfromdraging', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    var exchange = req.body.exchange;
    var orderId = req.body.orderId;
    var side = req.body.side;
    var updated_price = req.body.updated_price;

    console.log('1 == request')
    console.log(req.body.exchange)

    var side = req.body.side;
    var nss = side.indexOf("profit_inBall");

    //to check update profit or loss percentage
    if (nss != -1) {
        side = "profit_inBall";
    }

    var message = '';
    //get buy order detail on the base of order id
    var orderArr = await listOrderById(orderId, exchange);

    if (orderArr.length > 0) {
        for (let index in orderArr) {

            console.log('2 == listOrderById')

            var orderid = orderArr[index]['_id'];
            var trigger_type = orderArr[index]['trigger_type'];
            var buy_price = orderArr[index]['price'];
            var previous_sell_price = (typeof orderArr[index]['sell_price'] == 'undefined') ? 0 : orderArr[index]['sell_price'];
            var admin_id = (typeof orderArr[index]['admin_id'] == 'undefined') ? 0 : orderArr[index]['admin_id'];
            var application_mode = (typeof orderArr[index]['application_mode'] == 'undefined') ? 0 : orderArr[index]['application_mode'];
            var sell_order_id = (typeof orderArr[index]['sell_order_id'] == 'undefined') ? '' : orderArr[index]['sell_order_id'];
            var statsus = (typeof orderArr[index]['statsus'] == 'undefined') ? '' : orderArr[index]['statsus'];
            var auto_sell = (typeof orderArr[index]['auto_sell'] == 'undefined') ? '' : orderArr[index]['auto_sell'];

            var purchased_price = (typeof orderArr[index]['purchased_price'] == 'undefined') ? '' : orderArr[index]['purchased_price'];
            purchased_price = (purchased_price == '') ? buy_price : purchased_price;
            var symbol = (typeof orderArr[index]['symbol'] == 'undefined') ? '' : orderArr[index]['symbol'];
            var quantity = (typeof orderArr[index]['quantity'] == 'undefined') ? '' : orderArr[index]['quantity'];
            var order_type = (typeof orderArr[index]['order_type'] == 'undefined') ? '' : orderArr[index]['order_type'];

            var buy_order_binance_id = (typeof orderArr[index]['buy_order_binance_id'] == 'undefined') ? '' : orderArr[index]['buy_order_binance_id'];


            //:::::: Auto Trigger Part ::::::::::
            //check order is auto order
            if (trigger_type != 'no') {

                console.log('3 == auto order')

                //In case of auto order if loss percentage is updated the change the value of initial order
                let iniatial_trail_stop = (typeof orderArr[index]['iniatial_trail_stop'] == 'undefined') ? 0 : orderArr[index]['iniatial_trail_stop'];

                let sell_profit_percent = (typeof orderArr[index]['sell_profit_percent'] == 'undefined') ? 0 : orderArr[index]['sell_profit_percent'];

                var current_data2222 = updated_price - purchased_price;
                var calculate_new_sell_percentage = (current_data2222 * 100 / purchased_price);




                //:::::::::::::::: triggers :::::::::::::::::::

                //check of  profit percentage is updated
                if (side == 'profit_inBall') {

                    console.log('4 == profit_inball')

                    message = ' Auto Order Sell Price Changed';
                    var filter = {};
                    filter['_id'] = new ObjectID(orderId);
                    var update = {};
                    update['sell_price'] = updated_price;
                    update['modified_date'] = new Date();
                    update['sell_profit_percent'] = parseFloat(calculate_new_sell_percentage).toFixed(2);
                    update['defined_sell_percentage'] = parseFloat(calculate_new_sell_percentage).toFixed(2);



                    var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                    var updatePromise = updateOne(filter, update, collectionName);
                    updatePromise.then((resolve) => {});


                    sell_profit_percent = isNaN(sell_profit_percent) ? 0 : sell_profit_percent;
                    calculate_new_sell_percentage = isNaN(calculate_new_sell_percentage) ? 0 : calculate_new_sell_percentage;

                    var log_msg_1 = "Order Profit percentage Change From(" + parseFloat(sell_profit_percent).toFixed(2) + " % ) To (" + parseFloat(calculate_new_sell_percentage).toFixed(2) + " %)  From Chart";
                    // var logPromise_1 = recordOrderLog(orderId, log_msg_1, 'order_profit_percentage_change', 'yes', exchange);
                    var getBuyOrder = await listOrderById(orderId, exchange);
                    var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                    var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                    var logPromise_1 = create_orders_history_log(orderId, log_msg_1, 'order_profit_percentage_change', 'yes', exchange, order_mode, order_created_date)
                    logPromise_1.then((callback) => {})

                } else { //End of side

                    console.log('5 == else profit_inBall')

                    message = "Auto Order stop Loss Changed";
                    var filter = {};
                    filter['_id'] = new ObjectID(orderId);
                    var update = {};
                    update['iniatial_trail_stop'] = parseFloat(updated_price);
                    update['stop_loss'] = 'yes';
                    update['loss_percentage'] = (isNaN(calculate_new_sell_percentage) ? '' : parseFloat(parseFloat(calculate_new_sell_percentage).toFixed(8)));
                    update['modified_date'] = new Date();
                    var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                    var updatePromise = updateOne(filter, update, collectionName);
                    updatePromise.then((resolve) => {});

                    iniatial_trail_stop = isNaN(iniatial_trail_stop) ? 0 : iniatial_trail_stop;
                    updated_price = isNaN(updated_price) ? 0 : updated_price;

                    var log_msg = "Order Stop Loss Updated From(" + parseFloat(iniatial_trail_stop).toFixed(8) + ") to " + parseFloat(updated_price).toFixed(8) + "  From Chart";
                    // var logPromise = recordOrderLog(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange);
                    getBuyOrder = await listOrderById(orderId, exchange);
                    var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                    var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                    var logPromise = create_orders_history_log(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange, order_mode, order_created_date)
                    logPromise.then((callback) => {})
                }
                //:::::::::::::::: triggers :::::::::::::::::::
            } else { //End of trigger type
                //:::::::::::::::::Manual Trading :::::::::::::::::

                console.log('6 == Manual order')

                //check of  sell order id
                if (sell_order_id != '') {

                    console.log('7 == if sell_order_id')

                    //get sell order by id
                    var sellOrderResp = await listSellOrderById(sell_order_id, exchange);
                    var sellOrderArr = (typeof sellOrderResp[0] == 'undefined') ? [] : sellOrderResp[0];


                    var sell_profit_percent = (typeof sellOrderArr.sell_profit_percent == 'undefined') ? '' : sellOrderArr.sell_profit_percent;
                    var sell_price = (typeof sellOrderArr.sell_price == 'undefined') ? '' : sellOrderArr.sell_price;
                    var stop_loss = (typeof sellOrderArr.stop_loss == 'undefined') ? '' : sellOrderArr.stop_loss;
                    var loss_percentage = (typeof sellOrderArr.loss_percentage == 'undefined') ? '' : sellOrderArr.loss_percentage;

                    var purchased_price = (typeof sellOrderArr.purchased_price == 'undefined') ? '' : sellOrderArr.purchased_price;

                    var market_value = (typeof sellOrderArr.market_value == 'undefined') ? '' : sellOrderArr.market_value;

                    purchased_price = (purchased_price == '') ? market_value : purchased_price;

                    var current_data2222 = updated_price - purchased_price;
                    var calculate_new_sell_percentage = (current_data2222 * 100 / purchased_price);


                    //cehck if manual order and sell price is changes

                    if (side == 'profit_inBall') {

                        console.log('8 == if profit_inBall')

                        message = "Manual Order  Profit price Changed"
                        var filter = {};
                        filter['_id'] = new ObjectID(sell_order_id);
                        var update = {};
                        update['sell_price'] = updated_price;
                        update['modified_date'] = new Date();
                        update['sell_profit_percent'] = calculate_new_sell_percentage
                        var collectionName = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
                        var updatePromise = updateOne(filter, update, collectionName);
                        updatePromise.then((resolve) => {});


                        var update_buy_order = {};
                        update_buy_order['modified_date'] = new Date();
                        update_buy_order['auto_sell'] = 'yes';
                        var filter_buy = {};
                        filter_buy['_id'] = orderid;

                        var collectionName_buy = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                        var updateBuyPromise = updateOne(filter_buy, update_buy_order, collectionName_buy);
                        updateBuyPromise.then((resolve) => {});





                        sell_price = isNaN(sell_price) ? 0 : sell_price;
                        updated_price = isNaN(updated_price) ? 0 : updated_price;

                        var log_msg = "Order sell price Updated from(" + parseFloat(sell_price).toFixed(8) + ") to " + parseFloat(updated_price).toFixed(8) + "  From Chart";
                        // var logPromise = recordOrderLog(orderId, log_msg, 'create_sell_order', 'yes', exchange);
                        var getBuyOrder = await listOrderById(orderId, exchange);
                        var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                        var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                        var logPromise = create_orders_history_log(orderId, log_msg, 'create_sell_order', 'yes', exchange, order_mode, order_created_date)
                        logPromise.then((callback) => {})


                        var log_msg_1 = "Order Profit percentage Change From(" + parseFloat(sell_profit_percent).toFixed(2) + ") To (" + parseFloat(calculate_new_sell_percentage).toFixed(2) + ")  From Chart";
                        // var logPromise_1 = recordOrderLog(orderId, log_msg_1, 'order_profit_percentage_change', 'yes', exchange);
                        getBuyOrder = await listOrderById(orderId, exchange);
                        order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                        order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                        logPromise_1 = create_orders_history_log(orderId, log_msg, 'order_profit_percentage_change', 'yes', exchange, order_mode, order_created_date)
                        logPromise_1.then((callback) => {})
                    } else { //End of profitable side

                        console.log('9 == else profit_inBall')

                        message = "Manual Order  stop loss price Changed";
                        var current_data2222 = purchased_price - updated_price;
                        var stop_loss_percentage = (current_data2222 * 100 / updated_price);




                        //if user not enter stop loss we by default consider stop loss 100 percent so that order never sell by stop loss and also avoid from generating any bug
                        var loss_price = 0;
                        loss_price = (parseFloat(purchased_price) * parseFloat(stop_loss_percentage)) / 100;
                        loss_price = (purchased_price) - parseFloat(loss_price);


                        var filter = {};
                        filter['_id'] = new ObjectID(sell_order_id);
                        var update = {};
                        update['stop_loss'] = 'yes';
                        update['iniatial_trail_stop'] = parseFloat(loss_price);
                        update['loss_percentage'] = parseFloat(stop_loss_percentage).toFixed(2);
                        update['modified_date'] = new Date();
                        var collectionName = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
                        var updatePromise = updateOne(filter, update, collectionName);
                        updatePromise.then((resolve) => {});


                        var update_buy_order = {};
                        update_buy_order['modified_date'] = new Date();
                        update_buy_order['auto_sell'] = 'yes';
                        var filter_buy = {};
                        filter_buy['_id'] = orderid;

                        var collectionName_buy = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                        var updateBuyPromise = updateOne(filter_buy, update_buy_order, collectionName_buy);
                        updateBuyPromise.then((resolve) => {});

                        stop_loss = isNaN(stop_loss) ? 0 : stop_loss;
                        updated_price = isNaN(updated_price) ? 0 : updated_price;

                        var log_msg = "Order Stop Loss Updated From(" + parseFloat(stop_loss).toFixed(8) + ") to " + parseFloat(updated_price).toFixed(8) + "  From Chart";
                        // var logPromise = recordOrderLog(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange);
                        var getBuyOrder = await listOrderById(orderId, exchange);
                        var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                        var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                        var logPromise = create_orders_history_log(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange, order_mode, order_created_date)
                        logPromise.then((callback) => {});

                        loss_percentage = isNaN(loss_percentage) ? 0 : loss_percentage;
                        stop_loss_percentage = isNaN(stop_loss_percentage) ? 0 : stop_loss_percentage;

                        var log_msg_1 = "Order stop Loss percentage Change From(" + parseFloat(loss_percentage).toFixed(2) + ") To (" + parseFloat(stop_loss_percentage).toFixed(2) + ")  From Chart";
                        // var logPromise_1 = recordOrderLog(orderId, log_msg_1, 'order_stop_loss_percentage_change', 'yes', exchange);
                        getBuyOrder = await listOrderById(orderId, exchange);
                        order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                        order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                        var logPromise_1 = create_orders_history_log(orderId, log_msg, 'order_stop_loss_percentage_change', 'yes', exchange, order_mode, order_created_date)
                        logPromise_1.then((callback) => {})

                    } //End of Stop Loss part






                } else if (sell_order_id == '' && statsus == 'FILLED' && side == 'profit_inBall') {
                    console.log('9 == else if sell_order_id')
                    console.log('10 == set for sell')
                    ///:::::::::set for sell ::::::::::::::::::::::::
                    let tempArrResp = await listselTempOrders(orderId, exchange);
                    if (tempArrResp.length > 0) {
                        console.log('11 == temp sell exist')
                        //::::::::::: if temp arr Exist ::::::::::::::::::
                        var tempObj = tempArrResp[0];
                        var stop_loss = (typeof tempObj['stop_loss'] == 'undefined') ? '' : tempObj['stop_loss'];
                        var loss_percentage = (typeof tempObj['loss_percentage'] == 'undefined') ? '' : tempObj['loss_percentage'];
                        var lth_functionality = (typeof tempObj['lth_functionality'] == 'undefined') ? '' : tempObj['lth_functionality'];
                        var current_data2222 = updated_price - buy_price;
                        var sell_profit_percent = (current_data2222 * 100 / buy_price);
                        //:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
                        //:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

                        //if user not enter stop loss we by default consider stop loss 100 percent so that order never sell by stop loss and also avoid from generating any bug
                        var loss_price = 0;
                        loss_price = (parseFloat(purchased_price) * parseFloat(stop_loss_percentage)) / 100;
                        loss_price = (purchased_price) - parseFloat(loss_price);


                        var ins_data = {};
                        ins_data['symbol'] = symbol,
                            ins_data['purchased_price'] = purchased_price;
                        ins_data['quantity'] = quantity,
                            ins_data['profit_type'] = 'percentage';
                        ins_data['order_type'] = order_type;
                        ins_data['admin_id'] = admin_id;
                        ins_data['buy_order_check'] = '',
                            ins_data['buy_order_id'] = orderid,
                            ins_data['buy_order_binance_id'] = buy_order_binance_id;
                        ins_data['stop_loss'] = stop_loss;
                        ins_data['loss_percentage'] = loss_percentage;
                        ins_data['iniatial_trail_stop'] = parseFloat(loss_price);
                        ins_data['application_mode'] = application_mode;
                        ins_data['trigger_type'] = 'no';
                        ins_data['sell_profit_percent'] = sell_profit_percent;
                        ins_data['sell_price'] = updated_price;
                        ins_data['trail_check'] = 'no';
                        ins_data['trail_interval'] = 0;
                        ins_data['buy_trail_percentage'] = '0';
                        ins_data['buy_trail_price'] = '0';
                        ins_data['status'] = 'new';
                        ins_data['lth_functionality'] = lth_functionality;
                        //::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
                        //::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
                        var sellOrderId = await setForSell(ins_data, exchange, orderId);
                        var collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                        var updArr = {};
                        updArr['is_sell_order'] = 'yes';
                        updArr['sell_order_id'] = sellOrderId;
                        var where = {};
                        where['_id'] = {
                            '$in': [buyOrderId, new ObjectID(buyOrderId)]
                        }
                        var updPrmise = updateOne(where, updArr, collection);
                        updPrmise.then((callback) => {})
                        let log_msg = "Sell Order was Created";
                        // var logPromise1 = recordOrderLog(buyOrderId, log_msg, 'set_for_sell', 'yes', exchange);
                        var getBuyOrder = await listOrderById(buyOrderId, exchange);
                        var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                        var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                        var logPromise1 = create_orders_history_log(buyOrderId, log_msg, 'set_for_sell', 'yes', exchange, order_mode, order_created_date)
                        logPromise1.then((resolve) => {})
                        //::::::::::: End of temp arr exist ::::::::::::::
                    }
                    //::::::::::::-:-:-: End of set for sell :-:-:-:-:-:
                } else { //End of if sell order Exist
                    let tempArrResp = await listselTempOrders(orderId, exchange);

                    console.log('12 == else sell_order_id')
                    //:::::::::::::::::::
                    if (tempArrResp.length == 0) {
                        console.log('13 == tempArrResp')

                        var filter = {};
                        filter['_id'] = new ObjectID(orderId);
                        var update = {};
                        update['auto_sell'] = 'yes';
                        update['modified_date'] = new Date();
                        var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                        var updatePromise = updateOne(filter, update, collectionName);
                        updatePromise.then((resolve) => {});

                        var temp_arr = {};

                        var current_data2222 = updated_price - buy_price;
                        var sell_profit_percent = (current_data2222 * 100 / buy_price);




                        if (side == 'profit_inBall') {

                            console.log('14 == profit in ball')

                            message = "Manual Order profit price changed and order Set to Auto Sell";
                            temp_arr['profit_percent'] = sell_profit_percent;
                            temp_arr['profit_price'] = updated_price;

                            sell_profit_percent = isNaN(sell_profit_percent) ? 0 : sell_profit_percent;
                            var log_msg = "Order profit percentage set to (" + parseFloat(sell_profit_percent).toFixed(2) + ") %";
                            // var logPromise = recordOrderLog(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange);
                            var getBuyOrder = await listOrderById(orderId, exchange);
                            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                            var logPromise = create_orders_history_log(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange, order_mode, order_created_date)
                            logPromise.then((callback) => {})

                            updated_price = isNaN(updated_price) ? 0 : updated_price;
                            var log_msg = "Order profit price set to (" + updated_price + ") %";
                            // var logPromise = recordOrderLog(orderId, log_msg, 'order_profit', 'yes', exchange);
                            getBuyOrder = await listOrderById(orderId, exchange);
                            order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                            order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                            var logPromise = create_orders_history_log(orderId, log_msg, 'order_profit', 'yes', exchange, order_mode, order_created_date)
                            logPromise.then((callback) => {})


                            var update_buy_order = {};
                            update_buy_order['modified_date'] = new Date();
                            update_buy_order['auto_sell'] = 'yes';
                            var filter_buy = {};
                            filter_buy['_id'] = orderid;

                            var collectionName_buy = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                            var updateBuyPromise = updateOne(filter_buy, update_buy_order, collectionName_buy);
                            updateBuyPromise.then((resolve) => {});


                        } else {

                            console.log('15 == else profit_inBall')

                            message = "Manual Order stoploss price changed and order Set to Auto Sell"
                            var current_data2222 = buy_price - updated_price;
                            var loss_percentage = (current_data2222 * 100 / updated_price);

                            temp_arr['stop_loss'] = 'yes',
                                temp_arr['loss_percentage'] = loss_percentage;

                            loss_percentage = isNaN(loss_percentage) ? 0 : loss_percentage;
                            var log_msg = "Order stop loss percentage set to (" + parseFloat(loss_percentage).toFixed(2) + ") % From Chart";
                            // var logPromise = recordOrderLog(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange);
                            var getBuyOrder = await listOrderById(orderId, exchange);
                            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                            var logPromise = create_orders_history_log(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange, order_mode, order_created_date)
                            logPromise.then((callback) => {})

                            updated_price = isNaN(updated_price) ? 0 : updated_price;
                            var log_msg = "Order stop loss  set to (" + updated_price + ") % From Chart";
                            // var logPromise = recordOrderLog(orderId, log_msg, 'order_profit', 'yes', exchange);
                            getBuyOrder = await listOrderById(orderId, exchange);
                            order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                            order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                            var logPromise = create_orders_history_log(orderId, log_msg, 'order_profit', 'yes', exchange, order_mode, order_created_date)
                            logPromise.then((callback) => {})
                        }

                        temp_arr['buy_order_id'] = new ObjectID(orderId);;
                        temp_arr['profit_type'] = 'percentage';
                        temp_arr['order_type'] = 'market_order';
                        temp_arr['trail_check'] = 'no';
                        temp_arr['trail_interval'] = 0;
                        temp_arr['sell_trail_percentage'] = 0;

                        temp_arr['admin_id'] = admin_id;
                        temp_arr['lth_functionality'] = '';
                        temp_arr['application_mode'] = application_mode;
                        temp_arr['created_date'] = new Date();
                        temp_arr['modified_date'] = new Date();

                        var log_msg = "Order Change Fron Normal to Auto Sell From Chart";
                        // var logPromise = recordOrderLog(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange);
                        var getBuyOrder = await listOrderById(orderId, exchange);
                        var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                        var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                        var logPromise = create_orders_history_log(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange, order_mode, order_created_date)
                        logPromise.then((callback) => {})


                        var update_buy_order = {};
                        update_buy_order['modified_date'] = new Date();
                        update_buy_order['auto_sell'] = 'yes';
                        var filter_buy = {};
                        filter_buy['_id'] = orderid;

                        var collectionName_buy = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                        var updateBuyPromise = updateOne(filter_buy, update_buy_order, collectionName_buy);
                        updateBuyPromise.then((resolve) => {});


                        var log_msg = "Order Change Fron Normal to Auto Sell From Chart";
                        // var logPromise = recordOrderLog(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange);
                        getBuyOrder = await listOrderById(orderId, exchange);
                        order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                        order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                        var logPromise = create_orders_history_log(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange, order_mode, order_created_date)
                        logPromise.then((callback) => {})


                        var collection = (exchange == 'binance') ? 'temp_sell_orders' : 'temp_sell_orders_' + exchange;
                        conn.then((db) => {
                            db.collection(collection).insertOne(temp_arr, (error, result) => {
                                if (error) {
                                    console.log(error)
                                } else {

                                }
                            })
                        })

                    } else { //End of auto sell is no
                        //:::::::::::::::: update temp order arr

                        var current_data2222 = updated_price - buy_price;
                        var sell_profit_percent = (current_data2222 * 100 / buy_price);


                        var update = {};
                        update['modified_date'] = new Date();
                        var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                        var filter = {};
                        filter['_id'] = new ObjectID(orderId);

                        var updatePromise = updateOne(filter, update, collectionName);
                        updatePromise.then((resolve) => {});


                        var upd_temp = {};
                        if (side == 'profit_inBall') {

                            console.log('16 == profit in ball temp sell order')

                            upd_temp['profit_percent'] = sell_profit_percent;
                            upd_temp['profit_price'] = updated_price;


                            var filter = {};
                            filter['buy_order_id'] = new ObjectID(orderId);
                            var collection = (exchange == 'binance') ? 'temp_sell_orders' : 'temp_sell_orders_' + exchange;
                            var updatePromise = updateOne(filter, upd_temp, collection);

                            updatePromise.then((resolve) => {});


                            sell_profit_percent = isNaN(sell_profit_percent) ? 0 : sell_profit_percent;
                            var log_msg = "Order profit percentage set to (" + parseFloat(sell_profit_percent).toFixed(2) + ") % From Chart";
                            // var logPromise = recordOrderLog(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange);
                            var getBuyOrder = await listOrderById(orderId, exchange);
                            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                            var logPromise = create_orders_history_log(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange, order_mode, order_created_date)
                            logPromise.then((callback) => {})

                            updated_price = isNaN(updated_price) ? 0 : updated_price;
                            var log_msg = "Order profit price set to (" + updated_price + ") % From Chart";
                            // var logPromise = recordOrderLog(orderId, log_msg, 'order_profit', 'yes', exchange);
                            getBuyOrder = await listOrderById(orderId, exchange);
                            order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                            order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                            var logPromise = create_orders_history_log(orderId, log_msg, 'order_profit', 'yes', exchange, order_mode, order_created_date)
                            logPromise.then((callback) => {})



                            var update_buy_order = {};
                            update_buy_order['modified_date'] = new Date();
                            update_buy_order['auto_sell'] = 'yes';
                            var filter_buy = {};
                            filter_buy['_id'] = orderid;

                            var collectionName_buy = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                            var updateBuyPromise = updateOne(filter_buy, update_buy_order, collectionName_buy);
                            updateBuyPromise.then((resolve) => {});

                        } else {

                            console.log('17 == profit in ball temp sell order')

                            message = "Manual Order stoploss price changed and order Set to Auto Sell"
                            var current_data2222 = buy_price - updated_price;
                            var loss_percentage = (current_data2222 * 100 / updated_price);

                            var upd_temp = {};
                            upd_temp['stop_loss'] = 'yes';
                            upd_temp['loss_percentage'] = loss_percentage;


                            var filter = {};
                            filter['buy_order_id'] = new ObjectID(orderId);
                            var collection = (exchange == 'binance') ? 'temp_sell_orders' : 'temp_sell_orders_' + exchange;
                            var updatePromise = updateOne(filter, upd_temp, collection);
                            updatePromise.then((resolve) => {});
                            loss_percentage = isNaN(loss_percentage) ? 0 : loss_percentage;
                            var log_msg = "Order stop loss percentage set to (" + parseFloat(loss_percentage).toFixed(2) + ") % From Chart";
                            // var logPromise = recordOrderLog(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange);
                            var getBuyOrder = await listOrderById(orderId, exchange);
                            var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                            var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                            var logPromise = create_orders_history_log(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange, order_mode, order_created_date)
                            logPromise.then((callback) => {})

                            updated_price = isNaN(updated_price) ? 0 : updated_price;
                            var log_msg = "Order stop loss  set to (" + updated_price + ") % From Chart";
                            // var logPromise = recordOrderLog(orderId, log_msg, 'order_profit', 'yes', exchange);
                            getBuyOrder = await listOrderById(orderId, exchange);
                            order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                            order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                            var logPromise = create_orders_history_log(orderId, log_msg, 'order_profit', 'yes', exchange, order_mode, order_created_date)
                            logPromise.then((callback) => {})

                            var update_buy_order = {};
                            update_buy_order['modified_date'] = new Date();
                            update_buy_order['auto_sell'] = 'yes';
                            var filter_buy = {};
                            filter_buy['_id'] = orderid;

                            var collectionName_buy = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                            var updateBuyPromise = updateOne(filter_buy, update_buy_order, collectionName_buy);
                            updateBuyPromise.then((resolve) => {});
                        }

                        //:::::::::::::::: End of temp Orser Arr
                    }
                    //::::::::::::::
                } //End of sell order not exist

                //:::::::::::::::::End Of Manual Trading :::::::::::::::::
            }
        } //End of foreach
    } //End of order array is not empty


    resp.status(200).send({
        message: message
    })


}) //End of updateOrderfromdraging


//post call for updaing buy price from chart if order is not buyed
router.post('/updateBuyPriceFromDraggingChart', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var exchange = req.body.exchange;
    var orderId = req.body.orderId;
    var previous_buy_price = parseFloat(req.body.previous_buy_price);
    var updated_buy_price = parseFloat(req.body.updated_buy_price);

    //get buy order detail on the base of order id
    var orderArr = await listOrderById(orderId, exchange);

    if (orderArr.length > 0) {
        for (let index in orderArr) {

            var order = orderArr[index]

            var sell_profit_percent = order['sell_profit_percent']
            sell_profit_percent = parseFloat(parseFloat(sell_profit_percent).toFixed(8));
            sell_profit_percent = (!isNaN(sell_profit_percent) ? sell_profit_percent : 0)

            var defined_sell_percentage = order['defined_sell_percentage']
            defined_sell_percentage = parseFloat(parseFloat(defined_sell_percentage).toFixed(8));
            defined_sell_percentage = (!isNaN(defined_sell_percentage) ? defined_sell_percentage : 0)

            //both fields are being used for the similar purpose with alternating insersition so we prioritise by sell_profit_percent
            sell_profit_percent = (sell_profit_percent != 0 ? sell_profit_percent : defined_sell_percentage)

            let loss_percentage = order['loss_percentage']
            loss_percentage = parseFloat(parseFloat(loss_percentage).toFixed(8));
            loss_percentage = (!isNaN(loss_percentage) ? loss_percentage : 0)

            //Check if Sell order exists then use it's values on priority
            var buy_collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            var sell_collection = buy_collection;
            var sellOrderExist = false;

            //try to find sell order for this buy order
            var sellArr = await get_sell_order(orderId, exchange);

            if (sellArr.length > 0) {

                sellArr = sellArr[0];
                sell_collection = sellArr['collection'];
                sellArr = sellArr['sellArr'];
                sellOrderExist = true;

                var s_sell_profit_percent = sellArr['sell_profit_percent']
                s_sell_profit_percent = parseFloat(parseFloat(s_sell_profit_percent).toFixed(8));
                s_sell_profit_percent = (!isNaN(s_sell_profit_percent) ? s_sell_profit_percent : 0)

                var s_defined_sell_percentage = sellArr['defined_sell_percentage']
                s_defined_sell_percentage = parseFloat(parseFloat(s_defined_sell_percentage).toFixed(8));
                s_defined_sell_percentage = (!isNaN(s_defined_sell_percentage) ? s_defined_sell_percentage : 0)

                //both fields are being used for the similar purpose with alternating insersition so we prioritise by sell_profit_percent
                s_sell_profit_percent = (s_sell_profit_percent != 0 ? s_sell_profit_percent : s_defined_sell_percentage)
                sell_profit_percent = (s_sell_profit_percent != 0 ? s_sell_profit_percent : sell_profit_percent)

                let s_loss_percentage = sellArr['loss_percentage']
                s_loss_percentage = parseFloat(parseFloat(s_loss_percentage).toFixed(8));
                s_loss_percentage = (!isNaN(s_loss_percentage) ? s_loss_percentage : 0)
                loss_percentage = (s_loss_percentage != 0 ? s_loss_percentage : loss_percentage)
            }

            var admin_id = (typeof sellArr['admin_id'] == 'undefined') ? 0 : order['admin_id'];
            var trigger_type = order['trigger_type'];
            var application_mode = (typeof order['application_mode'] == 'undefined') ? 0 : order['application_mode'];
            var order_mode = application_mode
            var order_created_date = order['created_date'];

            //price can not be zero return error
            if (updated_buy_price == 0 || (typeof trigger_type == 'undefined')) {
                resp.status(200).send({
                    status: false,
                    message: 'An error occured'
                })
            } else {

                //sell price / loss price calculation
                let sell_price = updated_buy_price + parseFloat((sell_profit_percent * updated_buy_price) / 100)
                let loss_price = updated_buy_price - parseFloat((loss_percentage * updated_buy_price) / 100)

                if (sellOrderExist) {

                    var filter = {};
                    filter['_id'] = sellArr['_id'];
                    var update = {};

                    update['price'] = updated_buy_price;
                    if(order['deep_price_on_off'] !== 'undefined' && order['deep_price_on_off'] == 'yes' && order['status'] == 'new'){
                      console.log('Update Deep Price now')
                      update['expecteddeepPrice'] = updated_buy_price;
                    } else {
                      console.log('Not Update Deep Price now')
                    }
                    if (!isNaN(sell_price)) {
                        update['sell_price'] = sell_price;
                    }
                    if (!isNaN(loss_price)) {
                        update['iniatial_trail_stop'] = parseFloat(loss_price);
                    }
                    update['modified_date'] = new Date();

                    var updatePromise = updateOne(filter, update, sell_collection);
                    updatePromise.then((resolve) => {});
                }

                var filter = {};
                filter['_id'] = new ObjectID(orderId);
                var update = {};

                update['price'] = updated_buy_price;
                if(order['deep_price_on_off'] !== 'undefined' && order['deep_price_on_off'] == 'yes' && order['status'] == 'new'){
                  console.log('Update Deep Price now')
                  update['expecteddeepPrice'] = updated_buy_price;
                } else {
                  console.log('Not Update Deep Price now')
                }
                if (!isNaN(sell_price)) {
                    update['sell_price'] = sell_price;
                }
                if (!isNaN(loss_price)) {
                    update['iniatial_trail_stop'] = parseFloat(loss_price);
                }
                update['modified_date'] = new Date();

                var updatePromise = updateOne(filter, update, buy_collection);
                updatePromise.then((resolve) => {});
            }

        } //End of foreach


        //SAVE_LOG:
        var log_msg = "Order buy price updated from(" + parseFloat(previous_buy_price).toFixed(8) + ") to " + parseFloat(updated_buy_price).toFixed(8) + "  From Chart";
        var order_created_date = order['created_date']
        var order_mode = order['application_mode']
        var logPromise = create_orders_history_log(orderId, log_msg, 'buy_price_updated', 'yes', exchange, order_mode, order_created_date)
        logPromise.then((callback) => {});

        resp.status(200).send({
            message: 'Order Buy Price Updated Successfully'
        })

    } else { //End of order array is not empty

        resp.status(200).send({
            message: 'An error occured'
        })
    }

}) //End of updateBuyPriceFromDraggingChart




//post call for updating digieSignal from chart
router.post('/updateDigieSignalChart', auth_token.required, async (req, resp) => {
    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var exchange = req.body.exchange;
    var orderId = req.body.orderId;
    var buy_signal = req.body.buy_signal;
    var sell_signal = req.body.sell_signal;


    console.log(buy_signal, sell_signal, orderId, exchange)

    if(buy_signal){
        console.log('buy_signal')
    }
    if(sell_signal){
        console.log('sell_signal')
    }
    //get buy order detail on the base of order id
    var orderArr = await listOrderById(orderId, exchange);

    if (orderArr.length > 0) {
        for (let index in orderArr) {

            var order = orderArr[index]


            //Check if Sell order exists then use it's values on priority
            var buy_collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;



            var application_mode = (typeof order['application_mode'] == 'undefined') ? 0 : order['application_mode'];
            var order_mode = application_mode
            var order_created_date = order['created_date'];



            var filter = {};
            filter['_id'] = new ObjectID(orderId);
            var update = {};
            if(buy_signal && buy_signal != ''){
                update['buy_on_buy_hit'] = buy_signal == 'yes' ? 'yes' : ''
            }
            if(sell_signal && sell_signal != ''){
                update['sell_on_sell_hit'] = sell_signal == 'yes' ? 'yes' : ''
            }


            update['modified_date'] = new Date();


            console.log(update, 'BUy Hit')

            var updatePromise = updateOne(filter, update, buy_collection);
            updatePromise.then((resolve) => {});

            //SAVE_LOG:


            if(buy_signal && buy_signal != ''){
                var log_msg = "Buy on Digie signal Updated to " + buy_signal;
                var order_created_date = order['created_date']
                var order_mode = order['application_mode']
                var logPromise = create_orders_history_log(orderId, log_msg, 'Buy on Digie Signal ', 'yes', exchange, order_mode, order_created_date)
                logPromise.then((callback) => {});
            }

            if(sell_signal && sell_signal != ''){
                var log_msg = "Sell on Digie signal Updated to " + sell_signal;
                var order_created_date = order['created_date']
                var order_mode = order['application_mode']
                var logPromise = create_orders_history_log(orderId, log_msg, 'Sell on Digie Signal', 'yes', exchange, order_mode, order_created_date)
                logPromise.then((callback) => {});
            }


        } //End of foreach
        if(buy_signal && buy_signal != ''){
            resp.status(200).send({
                message: 'Order Buy on  Digie Signal Updated Successfully'
            })
        }
        if(sell_signal && sell_signal != ''){
            resp.status(200).send({
                message: 'Order Sell on Digie Signal Updated Successfully'
            })
        }

    } else { //End of order array is not empty

        resp.status(200).send({
            message: 'An error occured'
        })
    }

}) //End of updateDigieSignalChart


//post call for update Buy Trail from chart
router.post('/updateBuyTrailChart', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var exchange = req.body.exchange;
    var orderId = req.body.orderId;
    var buy_trail_data = req.body.buy_trail_info;

    //get buy order detail on the base of order id
    var orderArr = await listOrderById(orderId, exchange);

    if (orderArr.length > 0) {
        for (let index in orderArr) {

            var order = orderArr[index]



            //Check if Sell order exists then use it's values on priority
            var buy_collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;


            var application_mode = (typeof order['application_mode'] == 'undefined') ? 0 : order['application_mode'];
            var order_mode = application_mode
            var order_created_date = order['created_date'];


            var filter = {};
            filter['_id'] = new ObjectID(orderId);
            var update = {};





            if (typeof req.body.buy_trail_info['buy_trail_check_temp'] != 'undefined' && req.body.buy_trail_info['buy_trail_check_temp'] == 'yes') {
                update['buy_trail_check'] = 'yes'
                update['buy_trail_interval'] = parseFloat(req.body.buy_trail_info['buy_trail_interval_temp'])
                update['trail_check'] = 'yes';
                update['buy_trail_percentage'] = parseFloat(req.body.buy_trail_info['buy_trail_interval_temp'])
                // update['buy_trail_price'] = 0
            }else{
                update['buy_trail_check'] = ''
                update['buy_trail_interval'] = ''
                update['buy_trail_price'] = 0
                update['trail_check'] = ''
                update['buy_trail_percentage'] = ''
            }



            console.log(update)





            update['modified_date'] = new Date();

            var updatePromise = updateOne(filter, update, buy_collection);
            updatePromise.then((resolve) => {});

            //SAVE_LOG:
            var log_msg = "Order Buy Trail updated to From Chart";
            var order_created_date = order['created_date']
            var order_mode = order['application_mode']
            var logPromise = create_orders_history_log(orderId, log_msg, 'Buy Trail Updated', 'yes', exchange, order_mode, order_created_date)
            logPromise.then((callback) => {});


        } //End of foreach

        resp.status(200).send({
            message: 'Order Buy Trail Updated Successfully'
        })

    } else { //End of order array is not empty

        resp.status(200).send({
            message: 'An error occured'
        })
    }

}) //End of updateBuyTrailChart



//post call for updating Sell Trail from chart
router.post('/updateSellTrailChart', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var exchange = req.body.exchange;
    var orderId = req.body.orderId;
    var lth_functionality = req.body.sell_trail_info;

    //get buy order detail on the base of order id
    var orderArr = await listOrderById(orderId, exchange);

    if (orderArr.length > 0) {
        for (let index in orderArr) {

            var order = orderArr[index]

            //Check if Sell order exists then use it's values on priority
            var buy_collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            var sell_collection = buy_collection;
            var sellOrderExist = false;

            //try to find sell order for this buy order
            var sellArr = await get_sell_order(orderId, exchange);

            if (sellArr.length > 0) {

                sellArr = sellArr[0];
                sell_collection = sellArr['collection'];
                sellArr = sellArr['sellArr'];
                sellOrderExist = true;

            }

            var application_mode = (typeof order['application_mode'] == 'undefined') ? 0 : order['application_mode'];
            var order_mode = application_mode
            var order_created_date = order['created_date'];

            if (sellOrderExist) {

                var filter = {};
                filter['_id'] = sellArr['_id'];
                var update = {};

                if (typeof req.body.sell_trail_info['sell_trail_check_temp'] != 'undefined' && req.body.sell_trail_info['sell_trail_check_temp'] == 'yes') {
                    update['sell_trail_check'] = 'yes'
                    update['sell_trail_interval'] = parseFloat(req.body.sell_trail_info['sell_trail_interval_temp'])
                    update['trail_check'] = 'yes';
                    // ins_temp_data['trail_interval'] = trail_interval_sell;
                    update['sell_trail_percentage'] = parseFloat(req.body.sell_trail_info['sell_trail_interval_temp'])
                    // sellOrderArr['sell_trail_price'] = 0
                }else{
                    update['sell_trail_check'] = ''
                    update['sell_trail_interval'] = ''
                    update['sell_trail_price'] = 0
                    update['trail_check'] = '';
                    update['sell_trail_percentage'] = ''
                }

                update['modified_date'] = new Date();

                var updatePromise = updateOne(filter, update, sell_collection);
                updatePromise.then((resolve) => {});
            }

            var filter = {};
            filter['_id'] = new ObjectID(orderId);
            var update = {};


            if (typeof req.body.sell_trail_info['sell_trail_check_temp'] != 'undefined' && req.body.sell_trail_info['sell_trail_check_temp'] == 'yes') {
                update['sell_trail_check'] = 'yes'
                update['sell_trail_interval'] = parseFloat(req.body.sell_trail_info['sell_trail_interval_temp'])
                update['trail_check'] = 'yes';
                // ins_temp_data['trail_interval'] = trail_interval_sell;
                update['sell_trail_percentage'] = parseFloat(req.body.sell_trail_info['sell_trail_interval_temp'])
                // sellOrderArr['sell_trail_price'] = 0
              }else{
                update['sell_trail_check'] = ''
                update['sell_trail_interval'] = ''
                update['sell_trail_price'] = 0
                update['trail_check'] = '';
                update['sell_trail_percentage'] = ''
              }


            update['modified_date'] = new Date();


            console.log(update)

            var updatePromise = updateOne(filter, update, buy_collection);
            updatePromise.then((resolve) => {});

            //SAVE_LOG:
            var log_msg = "Order Buy Trail updated to From Chart";
            var order_created_date = order['created_date']
            var order_mode = order['application_mode']
            var logPromise = create_orders_history_log(orderId, log_msg, 'Sell Trail Updated', 'yes', exchange, order_mode, order_created_date)
            logPromise.then((callback) => {});


        } //End of foreach

        resp.status(200).send({
            message: 'Order Sell Trail Updated Successfully'
        })

    } else { //End of order array is not empty

        resp.status(200).send({
            message: 'An error occured'
        })
    }

}) //End of updateSellTrailChart

//post call for updating lth profit from chart
router.post('/updateLthProfitChart', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var exchange = req.body.exchange;
    var orderId = req.body.orderId;
    var lth_functionality = req.body.lth_functionality;
    var lth_profit = parseFloat(req.body.lth_profit);

    //get buy order detail on the base of order id
    var orderArr = await listOrderById(orderId, exchange);

    if (orderArr.length > 0) {
        for (let index in orderArr) {

            var order = orderArr[index]

            //buy_price
            var buy_price = order['price'];
            buy_price = parseFloat(parseFloat(buy_price).toFixed(8));
            buy_price = (!isNaN(buy_price) ? buy_price : 0)
            //purchased_price
            var purchased_price = order['purchased_price'];
            purchased_price = parseFloat(parseFloat(purchased_price).toFixed(8));
            purchased_price = (!isNaN(purchased_price) ? purchased_price : 0)

            //we if obj is new purchased_price is 0 so use buy_price instead
            var price = (purchased_price != 0 ? purchased_price : buy_price)

            //Check if Sell order exists then use it's values on priority
            var buy_collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            var sell_collection = buy_collection;
            var sellOrderExist = false;

            //try to find sell order for this buy order
            var sellArr = await get_sell_order(orderId, exchange);

            if (sellArr.length > 0) {

                sellArr = sellArr[0];
                sell_collection = sellArr['collection'];
                sellArr = sellArr['sellArr'];
                sellOrderExist = true;

            }

            var application_mode = (typeof order['application_mode'] == 'undefined') ? 0 : order['application_mode'];
            var order_mode = application_mode
            var order_created_date = order['created_date'];

            if (sellOrderExist) {

                var filter = {};
                filter['_id'] = sellArr['_id'];
                var update = {};

                update['lth_functionality'] = (!isNaN(lth_profit) ? lth_functionality : '')
                update['lth_profit'] = (!isNaN(lth_profit) ? lth_profit : '')

                if (order['status'] == 'LTH' && !isNaN(price) && !isNaN(lth_profit)) {
                    update['sell_price'] = price + parseFloat((lth_profit * price) / 100);
                }

                update['modified_date'] = new Date();

                var updatePromise = updateOne(filter, update, sell_collection);
                updatePromise.then((resolve) => {});
            }

            var filter = {};
            filter['_id'] = new ObjectID(orderId);
            var update = {};

            update['lth_functionality'] = (!isNaN(lth_profit) ? lth_functionality : '')
            update['lth_profit'] = (!isNaN(lth_profit) ? lth_profit : '')

            if (order['status'] == 'LTH' && !isNaN(price) && !isNaN(lth_profit)) {
                update['sell_price'] = price + parseFloat((lth_profit * price) / 100);
            }

            update['modified_date'] = new Date();

            var updatePromise = updateOne(filter, update, buy_collection);
            updatePromise.then((resolve) => {});

            //SAVE_LOG:
            var log_msg = "Order LTH profit updated from(" + order['lth_profit'] + ") to " + lth_profit + "  From Chart";
            var order_created_date = order['created_date']
            var order_mode = order['application_mode']
            var logPromise = create_orders_history_log(orderId, log_msg, 'lth_profit_updated', 'yes', exchange, order_mode, order_created_date)
            logPromise.then((callback) => {});


        } //End of foreach

        resp.status(200).send({
            message: 'Order LTH profit Updated Successfully'
        })

    } else { //End of order array is not empty

        resp.status(200).send({
            message: 'An error occured'
        })
    }

}) //End of updateLthProfitChart

router.post('/updateOrderfromdragingChart', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var exchange = req.body.exchange;
    var orderId = req.body.orderId;
    var side = req.body.side;

    var updated_price = req.body.updated_price;
    updated_price = parseFloat(parseFloat(updated_price).toFixed(8));
    updated_price = (!isNaN(updated_price) ? updated_price : 0)

    var side = req.body.side;
    var nss = side.indexOf("profit_inBall");

    //to check update profit or loss percentage
    if (nss != -1) {
        side = "profit_inBall";
    }

    var message = '';
    //get buy order detail on the base of order id
    var orderArr = await listOrderById(orderId, exchange);

    if (orderArr.length > 0) {
        for (let index in orderArr) {

            var order = orderArr[index]

            //set order fields for use
            //buy_price
            var buy_price = order['price'];
            buy_price = parseFloat(parseFloat(buy_price).toFixed(8));
            buy_price = (!isNaN(buy_price) ? buy_price : 0)
            //purchased_price
            var purchased_price = order['purchased_price'];
            purchased_price = parseFloat(parseFloat(purchased_price).toFixed(8));
            purchased_price = (!isNaN(purchased_price) ? purchased_price : 0)

            //we if order is new purchased_price is 0 so use buy_price instead
            var price = (purchased_price != 0 ? purchased_price : buy_price)

            var previous_sell_price = order['sell_price']
            previous_sell_price = parseFloat(parseFloat(previous_sell_price).toFixed(8));
            previous_sell_price = (!isNaN(previous_sell_price) ? previous_sell_price : 0)

            var previous_profit_price = order['profit_price']
            previous_profit_price = parseFloat(parseFloat(previous_profit_price).toFixed(8));
            previous_profit_price = (!isNaN(previous_profit_price) ? previous_profit_price : 0)

            //Some where profit_price field was being updated instead of sell_price so here we set a priority
            previous_sell_price = (previous_sell_price != 0 ? previous_sell_price : previous_profit_price)

            var sell_profit_percent = order['sell_profit_percent']
            sell_profit_percent = parseFloat(parseFloat(sell_profit_percent).toFixed(8));
            sell_profit_percent = (!isNaN(sell_profit_percent) ? sell_profit_percent : 0)

            var defined_sell_percentage = order['defined_sell_percentage']
            defined_sell_percentage = parseFloat(parseFloat(defined_sell_percentage).toFixed(8));
            defined_sell_percentage = (!isNaN(defined_sell_percentage) ? defined_sell_percentage : 0)

            //both fields are being used for the similar purpose with alternating insersition so we prioritise by sell_profit_percent
            sell_profit_percent = (sell_profit_percent != 0 ? sell_profit_percent : defined_sell_percentage)

            let iniatial_trail_stop = order['iniatial_trail_stop']
            iniatial_trail_stop = parseFloat(parseFloat(iniatial_trail_stop).toFixed(8));
            iniatial_trail_stop = (!isNaN(iniatial_trail_stop) ? iniatial_trail_stop : 0)

            if (order['trigger_type'] != 'no') {
                var loss_percentage = order['custom_stop_loss_percentage']
                loss_percentage = parseFloat(parseFloat(loss_percentage).toFixed(8));
                loss_percentage = (!isNaN(loss_percentage) ? loss_percentage : 0)
            } else {
                var loss_percentage = order['loss_percentage']
                loss_percentage = parseFloat(parseFloat(loss_percentage).toFixed(8));
                loss_percentage = (!isNaN(loss_percentage) ? loss_percentage : 0)
            }
            //Check if Sell order exists then use it's values on priority
            var buy_collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            var sell_collection = buy_collection;
            var sellOrderExist = false;

            //try to find sell order for this buy order
            var sellArr = await get_sell_order(orderId, exchange);


            if (sellArr.length > 0) {

                sellArr = sellArr[0];
                sell_collection = sellArr['collection'];
                sellArr = sellArr['sellArr'];
                sellOrderExist = true;

                //purchased_price
                var s_purchased_price = sellArr['purchased_price'];
                s_purchased_price = parseFloat(parseFloat(s_purchased_price).toFixed(8));
                s_purchased_price = (!isNaN(s_purchased_price) ? s_purchased_price : 0)

                //market_value
                var s_market_value = sellArr['market_value'];
                s_market_value = parseFloat(parseFloat(s_market_value).toFixed(8));
                s_market_value = (!isNaN(s_market_value) ? s_market_value : 0)

                //if sellArr is new purchased_price is 0 so use buy_price instead
                var s_price = (s_purchased_price != 0 ? s_purchased_price : s_market_value)
                price = (s_price != 0 ? s_price : price)

                var s_previous_sell_price = sellArr['sell_price']
                s_previous_sell_price = parseFloat(parseFloat(s_previous_sell_price).toFixed(8));
                s_previous_sell_price = (!isNaN(s_previous_sell_price) ? s_previous_sell_price : 0)

                var s_previous_profit_price = sellArr['profit_price']
                s_previous_profit_price = parseFloat(parseFloat(s_previous_profit_price).toFixed(8));
                s_previous_profit_price = (!isNaN(s_previous_profit_price) ? s_previous_profit_price : 0)

                //Some where profit_price field was being updated instead of sell_price so here we set a priority
                s_previous_sell_price = (s_previous_sell_price != 0 ? s_previous_sell_price : s_previous_profit_price)
                previous_sell_price = (s_previous_sell_price != 0 ? previous_sell_price : s_previous_profit_price)


                var s_sell_profit_percent = sellArr['sell_profit_percent']
                s_sell_profit_percent = parseFloat(parseFloat(s_sell_profit_percent).toFixed(8));
                s_sell_profit_percent = (!isNaN(s_sell_profit_percent) ? s_sell_profit_percent : 0)

                var s_defined_sell_percentage = sellArr['defined_sell_percentage']
                s_defined_sell_percentage = parseFloat(parseFloat(s_defined_sell_percentage).toFixed(8));
                s_defined_sell_percentage = (!isNaN(s_defined_sell_percentage) ? s_defined_sell_percentage : 0)

                //both fields are being used for the similar purpose with alternating insersition so we prioritise by sell_profit_percent
                s_sell_profit_percent = (s_sell_profit_percent != 0 ? s_sell_profit_percent : s_defined_sell_percentage)
                sell_profit_percent = (s_sell_profit_percent != 0 ? s_sell_profit_percent : sell_profit_percent)

                let s_iniatial_trail_stop = sellArr['iniatial_trail_stop']
                s_iniatial_trail_stop = parseFloat(parseFloat(s_iniatial_trail_stop).toFixed(8));
                s_iniatial_trail_stop = (!isNaN(s_iniatial_trail_stop) ? s_iniatial_trail_stop : 0)

                iniatial_trail_stop = (s_iniatial_trail_stop != 0 ? s_iniatial_trail_stop : iniatial_trail_stop)

                if (order['trigger_type'] != 'no') {
                    var s_loss_percentage = sellArr['loss_percentage']
                    s_loss_percentage = parseFloat(parseFloat(s_loss_percentage).toFixed(8));
                    s_loss_percentage = (!isNaN(s_loss_percentage) ? s_loss_percentage : 0)
                } else {
                    var s_loss_percentage = sellArr['loss_percentage']
                    s_loss_percentage = parseFloat(parseFloat(s_loss_percentage).toFixed(8));
                    s_loss_percentage = (!isNaN(s_loss_percentage) ? s_loss_percentage : 0)
                }

                loss_percentage = (s_loss_percentage != 0 ? s_loss_percentage : loss_percentage)

            }

            var admin_id = (typeof sellArr['admin_id'] == 'undefined') ? 0 : order['admin_id'];
            var trigger_type = order['trigger_type'];
            var application_mode = (typeof order['application_mode'] == 'undefined') ? 0 : order['application_mode'];
            var order_mode = application_mode
            var order_created_date = order['created_date'];

            //price can not be zero return error
            if (price == 0 || (typeof trigger_type == 'undefined')) {
                resp.status(200).send({
                    status: false,
                    message: 'An error occured'
                })
            } else {

                //price calculation
                var diff_price = updated_price - price;
                diff_price = Math.abs(diff_price)
                var new_percentage = (diff_price * 100 / price);
                new_percentage = Math.abs(new_percentage)

                new_percentage = parseFloat(parseFloat(new_percentage).toFixed(1));
                new_percentage = (!isNaN(new_percentage) ? new_percentage : 0)

                if (trigger_type != 'no') { //Auto Order

                    if (side == 'profit_inBall') { //profit percentage is updated

                        if (sellOrderExist) {

                            var filter = {};
                            filter['_id'] = sellArr['_id'];
                            var update = {};

                            if (order['status'] == 'LTH') {
                                update['lth_profit'] = new_percentage;
                            }

                            update['auto_sell'] = 'yes';
                            update['sell_price'] = updated_price;
                            update['sell_profit_percent'] = new_percentage;
                            update['profit_percent'] = new_percentage;
                            update['defined_sell_percentage'] = new_percentage;
                            update['modified_date'] = new Date();

                            var updatePromise = updateOne(filter, update, sell_collection);
                            updatePromise.then((resolve) => {});

                        }

                        var filter = {};
                        filter['_id'] = new ObjectID(orderId);
                        var update = {};

                        if (order['status'] == 'LTH') {
                            update['lth_profit'] = new_percentage;
                        }

                        update['auto_sell'] = 'yes';
                        update['sell_price'] = updated_price;
                        update['sell_profit_percent'] = new_percentage;
                        update['defined_sell_percentage'] = new_percentage;
                        update['modified_date'] = new Date();

                        // var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                        var updatePromise = updateOne(filter, update, buy_collection);
                        updatePromise.then((resolve) => {});


                        message = ' Auto Order Sell Price Changed'

                        //SAVE_LOG:
                        var log_msg = " Auto Order Sell Price Changed From(" + parseFloat(previous_sell_price).toFixed(2) + "  ) To (" + parseFloat(updated_price).toFixed(2) + ")  From Chart";
                        var logPromise = create_orders_history_log(orderId, log_msg, 'sell_price_changed', 'yes', exchange, order_mode, order_created_date)
                        logPromise.then((callback) => {})

                        //SAVE_LOG:
                        var log_msg = "Order Profit percentage Change From(" + parseFloat(sell_profit_percent).toFixed(2) + " % ) To (" + parseFloat(new_percentage).toFixed(2) + " %)  From Chart";
                        var logPromise = create_orders_history_log(orderId, log_msg, 'order_profit_percentage_change', 'yes', exchange, order_mode, order_created_date)
                        logPromise.then((callback) => {})

                    } else { //loss_inBall

                        if (sellOrderExist) {

                            var filter = {};
                            filter['_id'] = sellArr['_id'];
                            var update = {};
                            update['auto_sell'] = 'yes';
                            update['iniatial_trail_stop'] = parseFloat(updated_price);
                            update['stop_loss'] = 'yes';
                            update['loss_percentage'] = new_percentage;
                            update['custom_stop_loss_percentage'] = new_percentage;

                            // if (typeof order['lth_proft'] == 'undefined' || order['lth_proft'] == '') {
                            //     update['lth_functionality'] = 'yes'
                            //     update['lth_profit'] = sell_profit_percent
                            // }

                            update['modified_date'] = new Date();

                            var updatePromise = updateOne(filter, update, sell_collection);
                            updatePromise.then((resolve) => {});

                        }

                        var filter = {};
                        filter['_id'] = new ObjectID(orderId);
                        var update = {};
                        update['auto_sell'] = 'yes';
                        update['iniatial_trail_stop'] = parseFloat(updated_price);
                        update['stop_loss'] = 'yes';
                        update['loss_percentage'] = new_percentage;
                        update['custom_stop_loss_percentage'] = new_percentage;

                        // if (typeof order['lth_proft'] == 'undefined' || order['lth_proft'] == '') {
                        //     update['lth_functionality'] = 'yes'
                        //     update['lth_profit'] = sell_profit_percent
                        // }

                        update['modified_date'] = new Date();

                        // var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
                        var updatePromise = updateOne(filter, update, buy_collection);
                        updatePromise.then((resolve) => {});

                        message = "Auto Order stop Loss Changed";

                        //SAVE_LOG:
                        var log_msg = "Order Stop Loss Updated From(" + parseFloat(iniatial_trail_stop).toFixed(8) + ") to " + parseFloat(updated_price).toFixed(8) + "  From Chart"
                        var logPromise = create_orders_history_log(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange, order_mode, order_created_date)
                        logPromise.then((callback) => {})

                    }
                } else { //Manual Order
                    if (side == 'profit_inBall') {

                        if (sellOrderExist) {

                            var filter = {};
                            filter['_id'] = sellArr['_id'];
                            var update = {};

                            if (order['status'] == 'LTH') {
                                update['lth_profit'] = new_percentage;
                            }

                            update['auto_sell'] = 'yes';
                            update['sell_price'] = updated_price;
                            update['sell_profit_percent'] = new_percentage
                            update['profit_percent'] = new_percentage
                            update['auto_sell'] = 'yes'
                            update['modified_date'] = new Date();
                            var updatePromise = updateOne(filter, update, sell_collection);
                            updatePromise.then((resolve) => {});

                        }

                        var filter = {};
                        filter['_id'] = new ObjectID(orderId);
                        var update = {};

                        if (order['status'] == 'LTH') {
                            update['lth_profit'] = new_percentage;
                        }

                        update['auto_sell'] = 'yes';
                        update['sell_price'] = updated_price;
                        update['sell_profit_percent'] = new_percentage
                        update['auto_sell'] = 'yes'
                        update['modified_date'] = new Date();
                        var updatePromise = updateOne(filter, update, buy_collection);
                        updatePromise.then((resolve) => {});

                        message = "Manual Order  Profit price Changed"

                        //SAVE_LOG:
                        var log_msg = "Order sell price Updated from(" + parseFloat(previous_sell_price).toFixed(8) + ") to " + parseFloat(updated_price).toFixed(8) + "  From Chart";
                        var logPromise = create_orders_history_log(orderId, log_msg, 'create_sell_order', 'yes', exchange, order_mode, order_created_date)
                        logPromise.then((callback) => {})

                        //SAVE_LOG:
                        var log_msg = "Order Profit percentage Change From(" + parseFloat(sell_profit_percent).toFixed(2) + ") To (" + parseFloat(new_percentage).toFixed(2) + ")  From Chart";
                        var logPromise = create_orders_history_log(orderId, log_msg, 'order_profit_percentage_change', 'yes', exchange, order_mode, order_created_date)
                        logPromise.then((callback) => {})

                    } else { //loss_inBall

                        if (sellOrderExist) {

                            var filter = {};
                            filter['_id'] = sellArr['_id'];
                            var update = {};
                            update['stop_loss'] = 'yes';
                            update['iniatial_trail_stop'] = parseFloat(updated_price);
                            update['loss_percentage'] = new_percentage;
                            update['custom_stop_loss_percentage'] = new_percentage;
                            update['auto_sell'] = 'yes';

                            // if (typeof order['lth_proft'] == 'undefined' || order['lth_proft'] == '') {
                            //     update['lth_functionality'] = 'yes'
                            //     update['lth_profit'] = sell_profit_percent
                            // }

                            update['modified_date'] = new Date();
                            var updatePromise = updateOne(filter, update, sell_collection);
                            updatePromise.then((resolve) => {});

                        }

                        var filter = {};
                        filter['_id'] = new ObjectID(orderId);
                        var update = {};
                        update['stop_loss'] = 'yes';
                        update['iniatial_trail_stop'] = parseFloat(updated_price);
                        update['loss_percentage'] = new_percentage;
                        update['custom_stop_loss_percentage'] = new_percentage;
                        update['auto_sell'] = 'yes';

                        // if (typeof order['lth_proft'] == 'undefined' || order['lth_proft'] == '') {
                        //     update['lth_functionality'] = 'yes'
                        //     update['lth_profit'] = sell_profit_percent
                        // }

                        update['modified_date'] = new Date();
                        var updatePromise = updateOne(filter, update, buy_collection);
                        updatePromise.then((resolve) => {});

                        message = "Manual Order  stop loss price Changed";

                        //SAVE_LOG:
                        var log_msg = "Order Stop Loss Updated From(" + parseFloat(iniatial_trail_stop).toFixed(8) + ") to " + parseFloat(updated_price).toFixed(8) + "  From Chart";
                        var logPromise = create_orders_history_log(orderId, log_msg, 'order_stop_loss_change', 'yes', exchange, order_mode, order_created_date)
                        logPromise.then((callback) => {})

                        //SAVE_LOG:
                        var log_msg = "Order stop Loss percentage Change From(" + parseFloat(loss_percentage).toFixed(2) + ") To (" + parseFloat(new_percentage).toFixed(2) + ")  From Chart";
                        var logPromise = create_orders_history_log(orderId, log_msg, 'order_stop_loss_percentage_change', 'yes', exchange, order_mode, order_created_date)
                        logPromise.then((callback) => {})

                    } //End of Stop Loss part
                } //end if/else Auto/manual order
            }

            // //compare new-old
            // var oldArr = orderArr
            // var orderArr = await listOrderById(orderId, exchange);
            // var oldSellArr = SellArr
            // var SellArr = await get_sell_order(orderId, exchange);

            // console.log('---------- old buyArr');
            // console.log(oldArr);
            // console.log('---------- new buyArr');
            // console.log(orderArr);


        } //End of foreach

        resp.status(200).send({
            message: message
        })

    } else { //End of order array is not empty

        resp.status(200).send({
            message: 'An error occured'
        })
    }

}) //End of updateOrderfromdragingChart



function listSellOrderByBuyOrderId(ID, exchange) {
    return new Promise((resolve) => {
        let filter = {};
        filter['_id'] = {
            '$in': [ID, new ObjectID(ID)]
        };
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
} //End of listSellOrderByBuyOrderId



//post call for Edit manual by order
router.post('/lisEditManualOrderById', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    let orderId = req.body.orderId;
    let exchange = req.body.exchange;
    var buyOrderResp = await listOrderById(orderId, exchange);
    var buyOrderArr = buyOrderResp[0];
    // console.log(buyOrderArr, 'buyOrderArr')
    var post_data = req.body
    var timezone = (typeof post_data.timezone == 'undefined' || post_data.timezone == '') ? 'America/Danmarkshavn' : post_data.timezone;

    var auto_sell = (typeof buyOrderArr['auto_sell'] == 'undefined') ? 'no' : buyOrderArr['auto_sell'];

    var sell_order_id = (typeof buyOrderArr['sell_order_id'] == 'undefined' || buyOrderArr['sell_order_id'] == null) ? '' : buyOrderArr['sell_order_id'];

    var order_created_date = (typeof buyOrderArr['created_date'] == 'undefined') ? '' : buyOrderArr['created_date'];
    var order_mode = (typeof buyOrderArr['order_mode'] == 'undefined') ? buyOrderArr['application_mode'] : buyOrderArr['order_mode'];






    // check Added By Huzaifa to Convert Value Into Float
    buyOrderArr['buy_trail_interval'] =(typeof buyOrderArr['buy_trail_interval'] != 'undefined' && buyOrderArr['buy_trail_interval'] != '') ? parseFloat(buyOrderArr['buy_trail_interval']) : ''
    buyOrderArr['sell_trail_interval'] = (typeof buyOrderArr['sell_trail_interval'] != 'undefined' && buyOrderArr['sell_trail_interval'] != '') ? parseFloat(buyOrderArr['sell_trail_interval']) : ''
    buyOrderArr['sell_trail_price'] = (typeof buyOrderArr['sell_trail_price'] != 'undefined' && buyOrderArr['sell_trail_price'] != '') ? parseFloat(buyOrderArr['sell_trail_price']) : ''
    buyOrderArr['buy_trail_price'] = (typeof buyOrderArr['buy_trail_price'] != 'undefined' && buyOrderArr['buy_trail_price'] != '') ? parseFloat(buyOrderArr['buy_trail_price']) : ''
    buyOrderArr['sell_price'] = (typeof buyOrderArr['sell_price'] != 'undefined' && buyOrderArr['sell_price'] != '') ? parseFloat(buyOrderArr['sell_price']) : ''
    buyOrderArr['iniatial_trail_stop'] = (typeof buyOrderArr['iniatial_trail_stop'] != 'undefined' && buyOrderArr['iniatial_trail_stop'] != '') ? parseFloat(buyOrderArr['iniatial_trail_stop']) : ''
    buyOrderArr['lth_profit'] = (typeof buyOrderArr['lth_profit'] != 'undefined' && buyOrderArr['lth_profit'] != '') ? parseFloat(buyOrderArr['lth_profit']) : ''
    buyOrderArr['expecteddeepPrice'] = (typeof buyOrderArr['expecteddeepPrice'] != 'undefined' && buyOrderArr['expecteddeepPrice'] != '') ? parseFloat(buyOrderArr['expecteddeepPrice']) : ''





    // Hassan Check Added here For Mobile developers
    buyOrderArr['buy_on_buy_hit'] = (typeof buyOrderArr['buy_on_buy_hit'] != 'undefined' && buyOrderArr['buy_on_buy_hit'] != '') ? buyOrderArr['buy_on_buy_hit'] : 'no'
    buyOrderArr['sell_on_sell_hit'] = (typeof buyOrderArr['sell_on_sell_hit'] != 'undefined' && buyOrderArr['sell_on_sell_hit'] != '') ? buyOrderArr['sell_on_sell_hit'] : 'no'
    buyOrderArr['deep_price_processed'] = (typeof buyOrderArr['deep_price_processed'] != 'undefined' && buyOrderArr['deep_price_processed'] != '') ? parseFloat(buyOrderArr['deep_price_processed']) : 'no'
    buyOrderArr['sell_trailing_starts'] = (typeof buyOrderArr['sell_trailing_starts'] != 'undefined' && buyOrderArr['sell_trailing_starts'] != '') ? parseFloat(buyOrderArr['sell_trailing_starts']) : 'no'
    buyOrderArr['sell_trailing_starts'] = (typeof buyOrderArr['sell_trailing_starts'] != 'undefined' && buyOrderArr['sell_trailing_starts'] != '') ? parseFloat(buyOrderArr['sell_trailing_starts']) : 'no'
    buyOrderArr['sent_for_sell'] = (typeof buyOrderArr['sentforselltoDigieiptrading'] != 'undefined' && buyOrderArr['sentforselltoDigieiptrading'] != '') ?buyOrderArr['sentforselltoDigieiptrading'] : 'no'
    //Get order log against order
    var ordrLogPromise = await listOrderLog(orderId, exchange, order_mode, order_created_date);

    let html = '';
    let ordeLog = ordrLogPromise;
    var index = 1;

    var index = 1;
    for (let row in ordeLog) {
        var timeZoneTime = ordeLog[row].created_date;
        try {
            timeZoneTime = new Date(ordeLog[row].created_date).toLocaleString("en-US", {
                timeZone: timezone
            });
            timeZoneTime = new Date(timeZoneTime);
        } catch (e) {
            console.log(e);
        }
        var date = timeZoneTime.toLocaleString() + ' ' + timezone;
        //Remove indicator log message
        if (ordeLog[row].type != 'indicator_log_message') {
            html += '<tr>';
            html += '<th scope="row" class="text-danger">' + index + '</th>';
            html += '<td>' + ordeLog[row].log_msg + '</td>';
            html += '<td>' + date + '</td>'
            html += '</tr>';
            index++;
        }
    }

    var sellArr = [];
    var tempSellArr = [];
    // if (auto_sell == 'yes' && (typeof buyOrderArr['is_sell_order'] != 'undefined' && buyOrderArr['is_sell_order'] != 'sold')) {
    if (auto_sell == 'yes') {
        //if sell order Exist the get value from sell order
        if (sell_order_id != '') {
            var sellOrderResp = await listSellOrderById(sell_order_id, exchange);
            var sellArr = sellOrderResp[0];
        } else {
            //get temp sell order value of sell order not exist
            var tempOrderResp = await listTempSellOrder(orderId, exchange);
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

}) //End of lisEditManualOrderById



//post call for updating manual orders
router.post('/updateManualOrder', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

  let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');

  let buyOrderId = req.body.buyOrderId;
  let exchange = req.body.exchange;
  var sellOrderId = req.body.sellOrderId;
  let tempSellOrderId = req.body.tempSellOrderId;


  let buyorderArr = req.body.buyorderArr;
  let sellOrderArr = req.body.sellOrderArr;
  let tempOrderArr = req.body.tempOrderArr;

  let show_hide_log = 'yes';
  let type = 'order_update';
  let log_msg = "Order has been updated " + interfaceType;
  // var logPromise = recordOrderLog(buyOrderId, log_msg, type, show_hide_log, exchange);
  getBuyOrder = await listOrderById(buyOrderId, exchange);
  order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
  order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
  var logPromise = create_orders_history_log(buyOrderId, log_msg, 'order_update', 'yes', exchange, order_mode, order_created_date)
  logPromise.then((resolve) => {})

  //Send Notification
  send_notification(getBuyOrder[0]['admin_id'], 'news_alerts', 'medium', log_msg, buyOrderId, exchange, getBuyOrder[0]['symbol'], order_mode, '')

  var orders_collection = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
  var buy_order_collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
  var temp_sell_order_collection = (exchange == 'binance') ? 'temp_sell_orders' : 'temp_sell_orders_' + exchange;




  if (typeof req.body.buyorderArr['buy_trail_check_temp'] != 'undefined' && req.body.buyorderArr['buy_trail_check_temp'] == 'yes') {
      buyorderArr['buy_trail_check'] = 'yes'
      buyorderArr['buy_trail_interval'] = parseFloat(req.body.buyorderArr['buy_trail_interval_temp'])
      // buyorderArr['buy_trail_price'] = 0
  }else{
      buyorderArr['buy_trail_check'] = ''
      buyorderArr['buy_trail_interval'] = ''
      buyorderArr['buy_trail_price'] = 0
  }


  if (typeof req.body.buyorderArr['sell_trail_check_temp'] != 'undefined' && req.body.buyorderArr['sell_trail_check_temp'] == 'yes') {
    buyorderArr['sell_trail_check'] = 'yes'
    buyorderArr['sell_trail_interval'] = parseFloat(req.body.buyorderArr['sell_trail_interval_temp'])
    // sellOrderArr['sell_trail_price'] = 0
  }else{
    buyorderArr['sell_trail_check'] = ''
    buyorderArr['sell_trail_interval'] = ''
    buyorderArr['sell_trail_price'] = 0
  }

  if (typeof req.body.buyorderArr['sell_trail_check_temp'] != 'undefined' && req.body.buyorderArr['sell_trail_check_temp'] == 'yes') {
      sellOrderArr['sell_trail_check'] = 'yes'
      sellOrderArr['sell_trail_interval'] = parseFloat(req.body.buyorderArr['sell_trail_interval_temp'])
      // sellOrderArr['sell_trail_price'] = 0
  }else{
      sellOrderArr['sell_trail_check'] = ''
      sellOrderArr['sell_trail_interval'] = ''
      sellOrderArr['sell_trail_price'] = 0
  }

  //remove temp keys
  delete req.body.buyorderArr['buy_trail_check_temp']
  delete req.body.buyorderArr['buy_trail_interval_temp']
  delete req.body.buyorderArr['buy_trail_price_temp']
  delete req.body.buyorderArr['sell_trail_check_temp']
  delete req.body.buyorderArr['sell_trail_interval_temp']
  delete req.body.buyorderArr['sell_trail_price_temp']





  var where = {};
  where['_id'] = new ObjectID(buyOrderId)

  if (sellOrderId != '') {
      //set profit percentage if sell price is fixed
      if (buyorderArr['profit_type'] == 'fixed_price') {
          let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
          let sell_profit_percent = ((parseFloat(buyorderArr['sell_price']) - purchased_price) / purchased_price) * 100
          buyorderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
          buyorderArr['profit_percent'] = buyorderArr['sell_profit_percent']
      }

      //set sell profit percentage
      if (buyorderArr['profit_type'] == 'percentage' && typeof sellOrderArr['sell_profit_percent'] != 'undefined') {
          let sell_profit_percent = parseFloat(parseFloat(sellOrderArr['sell_profit_percent']).toFixed(1))
          buyorderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
      }

      //set stop loss
      if (typeof sellOrderArr['stop_loss'] != 'undefined' && sellOrderArr['stop_loss'] == 'yes' && !isNaN(parseFloat(sellOrderArr['loss_percentage']))) {
          buyorderArr['stop_loss'] = 'yes'
          buyorderArr['loss_percentage'] = parseFloat(parseFloat(sellOrderArr['loss_percentage']).toFixed(1))

          let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
          let loss_price = (parseFloat(purchased_price) * parseFloat(buyorderArr['loss_percentage'])) / 100;
          buyorderArr['iniatial_trail_stop'] = parseFloat(purchased_price) - parseFloat(loss_price);

      } else {
          buyorderArr['stop_loss'] = 'no'
          buyorderArr['loss_percentage'] = ''
      }

      //set lth profit
      if (typeof buyorderArr['lth_functionality'] != 'undefined' && buyorderArr['lth_functionality'] == 'yes' && !isNaN(parseFloat(buyorderArr['lth_profit']))) {
          buyorderArr['lth_functionality'] = 'yes'
          buyorderArr['lth_profit'] = parseFloat(parseFloat(buyorderArr['lth_profit']).toFixed(1))
      } else {
          buyorderArr['lth_functionality'] = 'no'
          buyorderArr['lth_profit'] = ''

          if (getBuyOrder[0]['status'] == 'LTH'){
              let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
              buyorderArr['sell_price'] = ((parseFloat(purchased_price) / 100) * buyorderArr['sell_profit_percent']) + parseFloat(purchased_price);
              buyorderArr['is_lth_order'] = 'no'
              buyorderArr['status'] = 'FILLED'
          }

      }






      if (typeof buyorderArr['trail_interval'] != 'undefined' && buyorderArr['trail_interval'] != '') {
          buyorderArr['trail_interval'] = parseFloat(buyorderArr['trail_interval'])
      }



      // check Added By Huzaifa to Convert Value Into Float
      console.log(buyorderArr['buy_trail_price'], typeof buyorderArr['buy_trail_price'], '=-=-=-=-=IF=-=-=-=-=')
      buyorderArr['buy_trail_interval'] =(typeof buyorderArr['buy_trail_interval'] != 'undefined' && buyorderArr['buy_trail_interval'] != '') ? parseFloat(buyorderArr['buy_trail_interval']) : ''
      buyorderArr['sell_trail_interval'] = (typeof buyorderArr['sell_trail_interval'] != 'undefined' && buyorderArr['sell_trail_interval'] != '') ? parseFloat(buyorderArr['sell_trail_interval']) : ''
      buyorderArr['sell_trail_price'] = (typeof buyorderArr['sell_trail_price'] != 'undefined' && buyorderArr['sell_trail_price'] != '') ? parseFloat(buyorderArr['sell_trail_price']) : ''
      buyorderArr['buy_trail_price'] = (typeof buyorderArr['buy_trail_price'] != 'undefined' && buyorderArr['buy_trail_price'] != '') ? parseFloat(buyorderArr['buy_trail_price']) : ''
      buyorderArr['sell_price'] = (typeof buyorderArr['sell_price'] != 'undefined' && buyorderArr['sell_price'] != '') ? parseFloat(buyorderArr['sell_price']) : ''
      buyorderArr['iniatial_trail_stop'] = (typeof buyorderArr['iniatial_trail_stop'] != 'undefined' && buyorderArr['iniatial_trail_stop'] != '') ? parseFloat(buyorderArr['iniatial_trail_stop']) : ''
      buyorderArr['lth_profit'] = (typeof buyorderArr['lth_profit'] != 'undefined' && buyorderArr['lth_profit'] != '') ? parseFloat(buyorderArr['lth_profit']) : ''
      buyorderArr['expecteddeepPrice'] = (typeof buyorderArr['expecteddeepPrice'] != 'undefined' && buyorderArr['expecteddeepPrice'] != '') ? parseFloat(buyorderArr['expecteddeepPrice']) : ''




      if (parseFloat(getBuyOrder[0]['sell_profit_percent']) !== parseFloat(buyorderArr['sell_profit_percent']) && getBuyOrder[0]['status'] == 'FILLED'){
          sell_price = parseFloat(getBuyOrder[0]['purchased_price'])+(parseFloat(getBuyOrder[0]['purchased_price'])*parseFloat(buyorderArr['sell_profit_percent']))/100
      buyorderArr['sell_price'] = parseFloat(sell_price)
      }
      if (parseFloat(getBuyOrder[0]['lth_profit']) !== parseFloat(buyorderArr['lth_profit']) && getBuyOrder[0]['status'] == 'LTH'){
          sell_price = parseFloat(getBuyOrder[0]['purchased_price'])+(parseFloat(getBuyOrder[0]['purchased_price'])*parseFloat(buyorderArr['lth_profit']))/100
      buyorderArr['sell_price'] = parseFloat(sell_price)
      }

      console.log(buyorderArr['buy_trail_price'], typeof buyorderArr['buy_trail_price'], '=-=-=-=-=After IF=-=-=-=-=')


  } else {
      //set profit percentage if sell price is fixed
      if (buyorderArr['profit_type'] == 'fixed_price') {
          let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
          let sell_profit_percent = ((parseFloat(buyorderArr['sell_price']) - purchased_price) / purchased_price) * 100
          buyorderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
          buyorderArr['profit_percent'] = tempOrderArr['sell_profit_percent']
          buyorderArr['sell_price'] = !isNaN(parseFloat(buyorderArr['sell_price'])) ? parseFloat(buyorderArr['sell_price']) : ''
          buyorderArr['profit_price'] = buyorderArr['sell_price']
      }

      //set sell profit percentage
      if (buyorderArr['profit_type'] == 'percentage' && typeof tempOrderArr['sell_profit_percent'] != 'undefined') {
          let sell_profit_percent = parseFloat(parseFloat(tempOrderArr['sell_profit_percent']).toFixed(1))
          buyorderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
      }

      //set stop loss
      if (typeof tempOrderArr['stop_loss'] != 'undefined' && tempOrderArr['stop_loss'] == 'yes' && !isNaN(parseFloat(tempOrderArr['loss_percentage']))) {
          buyorderArr['stop_loss'] = 'yes'
          buyorderArr['loss_percentage'] = parseFloat(parseFloat(tempOrderArr['loss_percentage']).toFixed(1))

          let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
          let loss_price = (parseFloat(purchased_price) * parseFloat(buyorderArr['loss_percentage'])) / 100;
          buyorderArr['iniatial_trail_stop'] = parseFloat(purchased_price) - parseFloat(loss_price);

      } else {
          buyorderArr['stop_loss'] = 'no'
          buyorderArr['loss_percentage'] = ''
      }

      //set lth profit
      if (typeof tempOrderArr['lth_functionality'] != 'undefined' && tempOrderArr['lth_functionality'] == 'yes' && !isNaN(parseFloat(tempOrderArr['lth_profit']))) {
          buyorderArr['lth_functionality'] = 'yes'
          buyorderArr['lth_profit'] = parseFloat(parseFloat(tempOrderArr['lth_profit']).toFixed(1))
      } else {
          buyorderArr['lth_functionality'] = 'no'
          buyorderArr['lth_profit'] = ''

          if (getBuyOrder[0]['status'] == 'LTH') {
              let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
              buyorderArr['sell_price'] = ((parseFloat(purchased_price) / 100) * buyorderArr['sell_profit_percent']) + parseFloat(purchased_price);
              buyorderArr['is_lth_order'] = 'no'
              buyorderArr['status'] = 'FILLED'
          }
      }

      if (typeof buyorderArr['trail_interval'] != 'undefined' && buyorderArr['trail_interval'] != '') {
          buyorderArr['trail_interval'] = parseFloat(buyorderArr['trail_interval'])
      }



      // check Added By Huzaifa to Convert Value Into Float
      console.log(buyorderArr['buy_trail_price'], typeof buyorderArr['buy_trail_price'])
      buyorderArr['buy_trail_interval'] =(typeof buyorderArr['buy_trail_interval'] != 'undefined' && buyorderArr['buy_trail_interval'] != '') ? parseFloat(buyorderArr['buy_trail_interval']) : ''
      buyorderArr['sell_trail_interval'] = (typeof buyorderArr['sell_trail_interval'] != 'undefined' && buyorderArr['sell_trail_interval'] != '') ? parseFloat(buyorderArr['sell_trail_interval']) : ''
      buyorderArr['sell_trail_price'] = (typeof buyorderArr['sell_trail_price'] != 'undefined' && buyorderArr['sell_trail_price'] != '') ? parseFloat(buyorderArr['sell_trail_price']) : ''
      buyorderArr['buy_trail_price'] = (typeof buyorderArr['buy_trail_price'] != 'undefined' && buyorderArr['buy_trail_price'] != '') ? parseFloat(buyorderArr['buy_trail_price']) : ''
      buyorderArr['sell_price'] = (typeof buyorderArr['sell_price'] != 'undefined' && buyorderArr['sell_price'] != '') ? parseFloat(buyorderArr['sell_price']) : ''
      buyorderArr['iniatial_trail_stop'] = (typeof buyorderArr['iniatial_trail_stop'] != 'undefined' && buyorderArr['iniatial_trail_stop'] != '') ? parseFloat(buyorderArr['iniatial_trail_stop']) : ''
      buyorderArr['lth_profit'] = (typeof buyorderArr['lth_profit'] != 'undefined' && buyorderArr['lth_profit'] != '') ? parseFloat(buyorderArr['lth_profit']) : ''
      buyorderArr['expecteddeepPrice'] = (typeof buyorderArr['expecteddeepPrice'] != 'undefined' && buyorderArr['expecteddeepPrice'] != '') ? parseFloat(buyorderArr['expecteddeepPrice']) : ''



      if (getBuyOrder[0]['sell_profit_percent'] !== buyorderArr['sell_profit_percent'] && getBuyOrder[0]['status'] == 'FILLED'){
          sell_price = parseFloat(getBuyOrder[0]['purchased_price'])+(parseFloat(getBuyOrder[0]['purchased_price'])*parseFloat(buyorderArr['sell_profit_percent']))/100
      buyorderArr['sell_price'] = parseFloat(sell_price)
      }
      if (getBuyOrder[0]['lth_profit'] !== buyorderArr['lth_profit'] && getBuyOrder[0]['status'] == 'LTH'){
          sell_price = parseFloat(getBuyOrder[0]['purchased_price'])+(parseFloat(getBuyOrder[0]['purchased_price'])*parseFloat(buyorderArr['lth_profit']))/100
      buyorderArr['sell_price'] = parseFloat(sell_price)
      }
  }

  buyorderArr['modified_date'] = new Date();
  var upsert = {
      'upsert': true
  };


  //cancel_hour
  if (typeof buyorderArr['update_cancel_hour'] != 'undefined' && buyorderArr['update_cancel_hour'] == 'yes' && typeof buyorderArr['cancel_hour'] != 'undefined' && buyorderArr['cancel_hour'] != '' && buyorderArr['cancel_hour'] > 0) {
      let currTime = new Date()
      buyorderArr['cancel_hour_time'] = new Date(currTime.setTime(currTime.getTime() + (buyorderArr['cancel_hour'] * 60 * 60 * 1000)))
  } else {
      delete buyorderArr['update_cancel_hour']
      delete buyorderArr['cancel_hour_time']
      delete buyorderArr['cancel_hour']
  }

  //add these fields in kraken order array
  if (exchange == 'kraken') {
      buyorderArr['defined_sell_percentage'] = typeof buyorderArr['sell_profit_percent'] != 'undefined' ? buyorderArr['sell_profit_percent'] : ''
      buyorderArr['custom_stop_loss_percentage'] = typeof buyorderArr['loss_percentage'] != 'undefined' ? buyorderArr['loss_percentage'] : ''
  }

  var updPromise = updateSingle(buy_order_collection, where, buyorderArr, upsert);
  updPromise.then((callback) => {});


  if (sellOrderId != '') {
      var where_1 = {};
      where_1['_id'] = new ObjectID(sellOrderId)

      //set profit percentage if sell price is fixed
      if (buyorderArr['profit_type'] == 'fixed_price') {
          let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
          let sell_profit_percent = ((parseFloat(buyorderArr['sell_price']) - purchased_price) / purchased_price) * 100
          sellOrderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
          sellOrderArr['profit_percent'] = sellOrderArr['sell_profit_percent']
          sellOrderArr['sell_price'] = !isNaN(parseFloat(buyorderArr['sell_price'])) ? parseFloat(buyorderArr['sell_price']) : ''
      }

      //set sell profit percentage
      if (buyorderArr['profit_type'] == 'percentage' && typeof sellOrderArr['sell_profit_percent'] != 'undefined') {
          let sell_profit_percent = parseFloat(parseFloat(sellOrderArr['sell_profit_percent']).toFixed(1))
          sellOrderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
      }

      //set stop loss
      if (typeof sellOrderArr['stop_loss'] != 'undefined' && sellOrderArr['stop_loss'] == 'yes' && !isNaN(parseFloat(sellOrderArr['loss_percentage']))) {
          sellOrderArr['stop_loss'] = 'yes'
          sellOrderArr['loss_percentage'] = parseFloat(parseFloat(sellOrderArr['loss_percentage']).toFixed(1))

          let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
          let loss_price = (parseFloat(purchased_price) * parseFloat(sellOrderArr['loss_percentage'])) / 100;
          sellOrderArr['iniatial_trail_stop'] = parseFloat(purchased_price) - parseFloat(loss_price);

      } else {
          sellOrderArr['stop_loss'] = 'no'
          sellOrderArr['loss_percentage'] = ''
      }

      //set lth profit
      if (typeof sellOrderArr['lth_functionality'] != 'undefined' && sellOrderArr['lth_functionality'] == 'yes' && !isNaN(parseFloat(sellOrderArr['lth_profit']))) {
          sellOrderArr['lth_functionality'] = 'yes'
          sellOrderArr['lth_profit'] = parseFloat(parseFloat(sellOrderArr['lth_profit']).toFixed(1))
      } else {
          sellOrderArr['lth_functionality'] = 'no'
          sellOrderArr['lth_profit'] = ''

          if (getBuyOrder[0]['status'] == 'LTH') {
              let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
              sellOrderArr['sell_price'] = ((parseFloat(purchased_price) / 100) * buyorderArr['sell_profit_percent']) + parseFloat(purchased_price);
          }
      }

      if (typeof sellOrderArr['trail_interval'] != 'undefined' && sellOrderArr['trail_interval'] != '') {
          sellOrderArr['trail_interval'] = parseFloat(sellOrderArr['trail_interval'])
      }

      sellOrderArr['modified_date'] = new Date();
      var upsert = {
          'upsert': true
      };


      //add these fields in kraken order array
      if (exchange == 'kraken') {
          sellOrderArr['defined_sell_percentage'] = typeof sellOrderArr['sell_profit_percent'] != 'undefined' ? sellOrderArr['sell_profit_percent'] : ''
          sellOrderArr['custom_stop_loss_percentage'] = typeof sellOrderArr['loss_percentage'] != 'undefined' ? sellOrderArr['loss_percentage'] : ''
      }

      var updPromise_1 = updateSingle(orders_collection, where_1, sellOrderArr, upsert);
      updPromise_1.then((callback) => {});
  }else{

      if(typeof buyorderArr['auto_sell'] != 'undefined' && buyorderArr['auto_sell'] == 'yes'){

          //when order was created with out auto sell and after buy it does not create sell array from edit page so set it from here
          let sellOrderArr = tempOrderArr;
          var buy_order_id = buyOrderId;

          if (buy_order_id != '') {
              sellOrderArr['buy_order_id'] = new ObjectID(buy_order_id);
          }

          //set profit percentage if sell price is fixed
          if (sellOrderArr['profit_type'] == 'fixed_price') {
              let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
              let sell_profit_percent = ((parseFloat(sellOrderArr['sell_price']) - purchased_price) / purchased_price) * 100
              sellOrderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
              sellOrderArr['profit_percent'] = sellOrderArr['sell_profit_percent']
              sellOrderArr['sell_price'] = !isNaN(parseFloat(sellOrderArr['sell_price'])) ? parseFloat(sellOrderArr['sell_price']) : ''
          }

          //set sell profit percentage
          if (sellOrderArr['profit_type'] == 'percentage' && typeof sellOrderArr['sell_profit_percent'] != 'undefined') {
              let sell_profit_percent = parseFloat(parseFloat(sellOrderArr['sell_profit_percent']).toFixed(1))
              sellOrderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
          }

          //set stop loss
          if (typeof sellOrderArr['stop_loss'] != 'undefined' && sellOrderArr['stop_loss'] == 'yes' && !isNaN(parseFloat(sellOrderArr['loss_percentage']))) {
              sellOrderArr['stop_loss'] = 'yes'
              sellOrderArr['loss_percentage'] = parseFloat(parseFloat(sellOrderArr['loss_percentage']).toFixed(1))

              let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
              let loss_price = (parseFloat(purchased_price) * parseFloat(sellOrderArr['loss_percentage'])) / 100;
              sellOrderArr['iniatial_trail_stop'] = parseFloat(purchased_price) - parseFloat(loss_price);

          } else {
              sellOrderArr['stop_loss'] = 'no'
              sellOrderArr['loss_percentage'] = ''
          }

          //set lth profit
          if (typeof sellOrderArr['lth_functionality'] != 'undefined' && sellOrderArr['lth_functionality'] == 'yes' && !isNaN(parseFloat(sellOrderArr['lth_profit']))) {
              sellOrderArr['lth_functionality'] = 'yes'
              sellOrderArr['lth_profit'] = parseFloat(parseFloat(sellOrderArr['lth_profit']).toFixed(1))
          } else {
              sellOrderArr['lth_functionality'] = 'no'
              sellOrderArr['lth_profit'] = ''

              if (getBuyOrder[0]['status'] == 'LTH') {
                  let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
                  sellOrderArr['sell_price'] = ((parseFloat(purchased_price) / 100) * buyorderArr['sell_profit_percent']) + parseFloat(purchased_price);
              }
          }

          if (typeof sellOrderArr['trail_interval'] != 'undefined' && sellOrderArr['trail_interval'] != '') {
              sellOrderArr['trail_interval'] = parseFloat(sellOrderArr['trail_interval'])
          }

          //add these fields in kraken order array
          if (exchange == 'kraken') {
              sellOrderArr['defined_sell_percentage'] = typeof sellOrderArr['sell_profit_percent'] != 'undefined' ? sellOrderArr['sell_profit_percent'] : ''
              sellOrderArr['custom_stop_loss_percentage'] = typeof sellOrderArr['loss_percentage'] != 'undefined' ? sellOrderArr['loss_percentage'] : ''
          }

          //function to set manual order for sell
          var sellOrderId = await setForSell(sellOrderArr, exchange, buy_order_id);

          var collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
          var updArr = {};
          updArr['is_sell_order'] = 'yes';
          updArr['sell_order_id'] = sellOrderId;
          updArr['auto_sell'] = 'yes';
          // updArr['quantity'] = parseFloat(sellOrderArr['quantity']);

          //set profit percentage if sell price is fixed
          if (sellOrderArr['profit_type'] == 'fixed_price') {
              let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : ''
              let sell_profit_percent = ((parseFloat(sellOrderArr['sell_price']) - purchased_price) / purchased_price) * 100
              updArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
              updArr['profit_percent'] = updArr['sell_profit_percent']
          }

          //set sell profit percentage
          if (sellOrderArr['profit_type'] == 'percentage' && typeof sellOrderArr['sell_profit_percent'] != 'undefined') {
              let sell_profit_percent = parseFloat(parseFloat(sellOrderArr['sell_profit_percent']).toFixed(1))
              updArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
          }

          //set stop loss
          if (typeof sellOrderArr['stop_loss'] != 'undefined' && sellOrderArr['stop_loss'] == 'yes' && !isNaN(parseFloat(sellOrderArr['loss_percentage']))) {
              updArr['stop_loss'] = 'yes'
              updArr['loss_percentage'] = parseFloat(parseFloat(sellOrderArr['loss_percentage']).toFixed(1))
          } else {
              updArr['stop_loss'] = 'no'
              updArr['loss_percentage'] = ''
          }

          //set lth profit
          if (typeof sellOrderArr['lth_functionality'] != 'undefined' && sellOrderArr['lth_functionality'] == 'yes' && !isNaN(parseFloat(sellOrderArr['lth_profit']))) {
              updArr['lth_functionality'] = 'yes'
              updArr['lth_profit'] = parseFloat(parseFloat(sellOrderArr['lth_profit']).toFixed(1))
          } else {
              updArr['lth_functionality'] = 'no'
              updArr['lth_profit'] = ''

              if (getBuyOrder[0]['status'] == 'LTH') {
                  let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
                  updArr['sell_price'] = ((parseFloat(purchased_price) / 100) * buyorderArr['sell_profit_percent']) + parseFloat(purchased_price);
              }
          }

          if (typeof sellOrderArr['trail_interval'] != 'undefined' && sellOrderArr['trail_interval'] != '') {
              updArr['trail_interval'] = parseFloat(sellOrderArr['trail_interval'])
          }

          var where = {};
          where['_id'] = {
              '$in': [buyOrderId, new ObjectID(buyOrderId)]
          }
          updArr['modified_date'] = new Date();


          //add these fields in kraken order array
          if (exchange == 'kraken') {
              updArr['defined_sell_percentage'] = typeof updArr['sell_profit_percent'] != 'undefined' ? updArr['sell_profit_percent'] : ''
              updArr['custom_stop_loss_percentage'] = typeof updArr['loss_percentage'] != 'undefined' ? updArr['loss_percentage'] : ''
          }

          var updPrmise = updateOne(where, updArr, collection);
          updPrmise.then((callback) => { })

          let log_msg = "Sell Order was Created " + interfaceType;
          // var logPromise1 = recordOrderLog(buyOrderId, log_msg, 'set_for_sell', 'yes', exchange);
          var getBuyOrder = await listOrderById(buyOrderId, exchange);
          var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
          var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
          var logPromise1 = create_orders_history_log(buyOrderId, log_msg, 'set_for_sell', 'yes', exchange, order_mode, order_created_date)

          logPromise1.then((resolve) => { })
      }

  }

  /*
  if (tempSellOrderId != '') {
      var where_2 = {};
      where_2['_id'] = new ObjectID(tempSellOrderId)

      //set profit percentage if sell price is fixed
      if (buyorderArr['profit_type'] == 'fixed_price') {
          let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
          let sell_profit_percent = ((parseFloat(buyorderArr['sell_price']) - purchased_price) / purchased_price) * 100
          tempOrderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
          tempOrderArr['profit_percent'] = tempOrderArr['sell_profit_percent']
          tempOrderArr['sell_price'] = !isNaN(parseFloat(buyorderArr['sell_price'])) ? parseFloat(buyorderArr['sell_price']) : ''
          tempOrderArr['profit_price'] = tempOrderArr['sell_price']
      }

      //set sell profit percentage
      if (buyorderArr['profit_type'] == 'percentage' && typeof tempOrderArr['sell_profit_percent'] != 'undefined') {
          let sell_profit_percent = parseFloat(parseFloat(tempOrderArr['sell_profit_percent']).toFixed(1))
          tempOrderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
      }

      //set stop loss
      if (typeof tempOrderArr['stop_loss'] != 'undefined' && tempOrderArr['stop_loss'] == 'yes' && !isNaN(parseFloat(tempOrderArr['loss_percentage']))) {
          tempOrderArr['stop_loss'] = 'yes'
          tempOrderArr['loss_percentage'] = parseFloat(parseFloat(tempOrderArr['loss_percentage']).toFixed(1))

          let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
          let loss_price = (parseFloat(purchased_price) * parseFloat(tempOrderArr['loss_percentage'])) / 100;
          tempOrderArr['iniatial_trail_stop'] = parseFloat(purchased_price) - parseFloat(loss_price);

      } else {
          tempOrderArr['stop_loss'] = 'no'
          tempOrderArr['loss_percentage'] = ''
      }

      //set lth profit
      if (typeof tempOrderArr['lth_functionality'] != 'undefined' && tempOrderArr['lth_functionality'] == 'yes' && !isNaN(parseFloat(tempOrderArr['lth_profit']))) {
          tempOrderArr['lth_functionality'] = 'yes'
          tempOrderArr['lth_profit'] = parseFloat(parseFloat(tempOrderArr['lth_profit']).toFixed(1))
      } else {
          tempOrderArr['lth_functionality'] = 'no'
          tempOrderArr['lth_profit'] = ''

          if (getBuyOrder[0]['status'] == 'LTH') {
              let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
              tempOrderArr['sell_price'] = ((parseFloat(purchased_price) / 100) * buyorderArr['sell_profit_percent']) + parseFloat(purchased_price);
          }

      }

      if (typeof tempOrderArr['trail_interval'] != 'undefined' && tempOrderArr['trail_interval'] != '') {
          tempOrderArr['trail_interval'] = parseFloat(tempOrderArr['trail_interval'])
      }

      tempOrderArr['modified_date'] = new Date();
      var upsert = {
          'upsert': true
      };


      //add these fields in kraken order array
      if (exchange == 'kraken') {
          tempOrderArr['defined_sell_percentage'] = typeof tempOrderArr['sell_profit_percent'] != 'undefined' ? tempOrderArr['sell_profit_percent'] : ''
          tempOrderArr['custom_stop_loss_percentage'] = typeof tempOrderArr['loss_percentage'] != 'undefined' ? tempOrderArr['loss_percentage'] : ''
      }

      var updPromise_2 = updateSingle(temp_sell_order_collection, where_2, tempOrderArr, upsert);
      updPromise_2.then((callback) => {})
  }else{

      //when order was created with out auto sell and after buy it does not create sell array from edit page so set it from here
      let sellOrderArr = tempOrderArr;
      var buy_order_id = buyOrderId;

      if (buy_order_id != '') {
          sellOrderArr['buy_order_id'] = new ObjectID(buy_order_id);
      }

      //set profit percentage if sell price is fixed
      if (sellOrderArr['profit_type'] == 'fixed_price') {
          let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
          let sell_profit_percent = ((parseFloat(sellOrderArr['sell_price']) - purchased_price) / purchased_price) * 100
          sellOrderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
          sellOrderArr['profit_percent'] = sellOrderArr['sell_profit_percent']
          sellOrderArr['sell_price'] = !isNaN(parseFloat(sellOrderArr['sell_price'])) ? parseFloat(sellOrderArr['sell_price']) : ''
      }

      //set sell profit percentage
      if (sellOrderArr['profit_type'] == 'percentage' && typeof sellOrderArr['sell_profit_percent'] != 'undefined') {
          let sell_profit_percent = parseFloat(parseFloat(sellOrderArr['sell_profit_percent']).toFixed(1))
          sellOrderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
      }

      //set stop loss
      if (typeof sellOrderArr['stop_loss'] != 'undefined' && sellOrderArr['stop_loss'] == 'yes' && !isNaN(parseFloat(sellOrderArr['loss_percentage']))) {
          sellOrderArr['stop_loss'] = 'yes'
          sellOrderArr['loss_percentage'] = parseFloat(parseFloat(sellOrderArr['loss_percentage']).toFixed(1))

          let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
          let loss_price = (parseFloat(purchased_price) * parseFloat(sellOrderArr['loss_percentage'])) / 100;
          sellOrderArr['iniatial_trail_stop'] = parseFloat(purchased_price) - parseFloat(loss_price);

      } else {
          sellOrderArr['stop_loss'] = 'no'
          sellOrderArr['loss_percentage'] = ''
      }

      //set lth profit
      if (typeof sellOrderArr['lth_functionality'] != 'undefined' && sellOrderArr['lth_functionality'] == 'yes' && !isNaN(parseFloat(sellOrderArr['lth_profit']))) {
          sellOrderArr['lth_functionality'] = 'yes'
          sellOrderArr['lth_profit'] = parseFloat(parseFloat(sellOrderArr['lth_profit']).toFixed(1))
      } else {
          sellOrderArr['lth_functionality'] = 'no'
          sellOrderArr['lth_profit'] = ''

          if (getBuyOrder[0]['status'] == 'LTH') {
              let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
              sellOrderArr['sell_price'] = ((parseFloat(purchased_price) / 100) * buyorderArr['sell_profit_percent']) + parseFloat(purchased_price);
          }
      }

      if (typeof sellOrderArr['trail_interval'] != 'undefined' && sellOrderArr['trail_interval'] != '') {
          sellOrderArr['trail_interval'] = parseFloat(sellOrderArr['trail_interval'])
      }

      //add these fields in kraken order array
      if (exchange == 'kraken') {
          sellOrderArr['defined_sell_percentage'] = typeof sellOrderArr['sell_profit_percent'] != 'undefined' ? sellOrderArr['sell_profit_percent'] : ''
          sellOrderArr['custom_stop_loss_percentage'] = typeof sellOrderArr['loss_percentage'] != 'undefined' ? sellOrderArr['loss_percentage'] : ''
      }

      //function to set manual order for sell
      var sellOrderId = await setForSell(sellOrderArr, exchange, buy_order_id);

      var collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
      var updArr = {};
      updArr['is_sell_order'] = 'yes';
      updArr['sell_order_id'] = sellOrderId;
      updArr['auto_sell'] = 'yes';
      // updArr['quantity'] = parseFloat(sellOrderArr['quantity']);

      //set profit percentage if sell price is fixed
      if (sellOrderArr['profit_type'] == 'fixed_price') {
          let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : ''
          let sell_profit_percent = ((parseFloat(sellOrderArr['sell_price']) - purchased_price) / purchased_price) * 100
          updArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
          updArr['profit_percent'] = updArr['sell_profit_percent']
      }

      //set sell profit percentage
      if (sellOrderArr['profit_type'] == 'percentage' && typeof sellOrderArr['sell_profit_percent'] != 'undefined') {
          let sell_profit_percent = parseFloat(parseFloat(sellOrderArr['sell_profit_percent']).toFixed(1))
          updArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''
      }

      //set stop loss
      if (typeof sellOrderArr['stop_loss'] != 'undefined' && sellOrderArr['stop_loss'] == 'yes' && !isNaN(parseFloat(sellOrderArr['loss_percentage']))) {
          updArr['stop_loss'] = 'yes'
          updArr['loss_percentage'] = parseFloat(parseFloat(sellOrderArr['loss_percentage']).toFixed(1))
      } else {
          updArr['stop_loss'] = 'no'
          updArr['loss_percentage'] = ''
      }

      //set lth profit
      if (typeof sellOrderArr['lth_functionality'] != 'undefined' && sellOrderArr['lth_functionality'] == 'yes' && !isNaN(parseFloat(sellOrderArr['lth_profit']))) {
          updArr['lth_functionality'] = 'yes'
          updArr['lth_profit'] = parseFloat(parseFloat(sellOrderArr['lth_profit']).toFixed(1))
      } else {
          updArr['lth_functionality'] = 'no'
          updArr['lth_profit'] = ''

          if (getBuyOrder[0]['status'] == 'LTH') {
              let purchased_price = !isNaN(parseFloat(getBuyOrder[0]['purchased_price'])) ? parseFloat(getBuyOrder[0]['purchased_price']) : parseFloat(getBuyOrder[0]['price'])
              updArr['sell_price'] = ((parseFloat(purchased_price) / 100) * buyorderArr['sell_profit_percent']) + parseFloat(purchased_price);
          }
      }

      if (typeof sellOrderArr['trail_interval'] != 'undefined' && sellOrderArr['trail_interval'] != '') {
          updArr['trail_interval'] = parseFloat(sellOrderArr['trail_interval'])
      }

      var where = {};
      where['_id'] = {
          '$in': [buyOrderId, new ObjectID(buyOrderId)]
      }
      updArr['modified_date'] = new Date();


      //add these fields in kraken order array
      if (exchange == 'kraken') {
          updArr['defined_sell_percentage'] = typeof updArr['sell_profit_percent'] != 'undefined' ? updArr['sell_profit_percent'] : ''
          updArr['custom_stop_loss_percentage'] = typeof updArr['loss_percentage'] != 'undefined' ? updArr['loss_percentage'] : ''
      }

      var updPrmise = updateOne(where, updArr, collection);
      updPrmise.then((callback) => { })

      let log_msg = "Sell Order was Created " + interfaceType;
      // var logPromise1 = recordOrderLog(buyOrderId, log_msg, 'set_for_sell', 'yes', exchange);
      var getBuyOrder = await listOrderById(buyOrderId, exchange);
      var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
      var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
      var logPromise1 = create_orders_history_log(buyOrderId, log_msg, 'set_for_sell', 'yes', exchange, order_mode, order_created_date)

      logPromise1.then((resolve) => { })
  }
  */

  resp.status(200).send({
      message: 'order updated'
  });

}) //End of updateManualOrder

//post call for set manual order
router.post('/setForSell', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let sellOrderArr = req.body.sellOrderArr;
    var buy_order_id = (typeof sellOrderArr['buy_order_id'] == 'undefined') ? '' : sellOrderArr['buy_order_id'];

    if (buy_order_id != '') {
        sellOrderArr['buy_order_id'] = new ObjectID(buy_order_id);
    }

    //set profit percentage if sell price is fixed
    if (sellOrderArr['profit_type'] == 'fixed_price') {
        let purchased_price = !isNaN(parseFloat(sellOrderArr['purchased_price'])) ? parseFloat(sellOrderArr['purchased_price']) : ''
        let sell_profit_percent = ((parseFloat(sellOrderArr['sell_price']) - purchased_price) / purchased_price) * 100
        sellOrderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
        sellOrderArr['profit_percent'] = sellOrderArr['sell_profit_percent']

        // sellOrderArr['sell_price'] = ((parseFloat(purchased_price) / 100) * sellOrderArr['sell_profit_percent']) + parseFloat(purchased_price);
    }

    //set sell profit percentage
    if (sellOrderArr['profit_type'] == 'percentage' && typeof sellOrderArr['sell_profit_percent'] != 'undefined') {
        let purchased_price = !isNaN(parseFloat(sellOrderArr['purchased_price'])) ? parseFloat(sellOrderArr['purchased_price']) : ''
        let sell_profit_percent = parseFloat(parseFloat(sellOrderArr['sell_profit_percent']).toFixed(1))
        sellOrderArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''

        sellOrderArr['sell_price'] = ((parseFloat(purchased_price) / 100) * sellOrderArr['sell_profit_percent']) + parseFloat(purchased_price);
    }

    //set stop loss
    if (typeof sellOrderArr['stop_loss'] != 'undefined' && sellOrderArr['stop_loss'] == 'yes' && !isNaN(parseFloat(sellOrderArr['loss_percentage']))) {
        sellOrderArr['stop_loss'] = 'yes'
        sellOrderArr['loss_percentage'] = parseFloat(parseFloat(sellOrderArr['loss_percentage']).toFixed(1))
    } else {
        sellOrderArr['stop_loss'] = 'no'
        sellOrderArr['loss_percentage'] = ''
    }

    //set lth profit
    if (typeof sellOrderArr['lth_functionality'] != 'undefined' && sellOrderArr['lth_functionality'] == 'yes' && !isNaN(parseFloat(sellOrderArr['lth_profit']))) {
        sellOrderArr['lth_functionality'] = 'yes'
        sellOrderArr['lth_profit'] = parseFloat(parseFloat(sellOrderArr['lth_profit']).toFixed(1))
    } else {
        sellOrderArr['lth_functionality'] = 'no'
        sellOrderArr['lth_profit'] = ''
    }

    if (typeof sellOrderArr['trail_interval'] != 'undefined' && sellOrderArr['trail_interval'] != '') {
        sellOrderArr['trail_interval'] = parseFloat(sellOrderArr['trail_interval'])
    }

    let exchange = req.body.exchange;
    let buyOrderId = req.body.buyOrderId;

    //add these fields in kraken order array
    if (exchange == 'kraken') {
        sellOrderArr['defined_sell_percentage'] = typeof sellOrderArr['sell_profit_percent'] != 'undefined' ? sellOrderArr['sell_profit_percent'] : ''
        sellOrderArr['custom_stop_loss_percentage'] = typeof sellOrderArr['loss_percentage'] != 'undefined' ? sellOrderArr['loss_percentage'] : ''
    }

    //function to set manual order for sell
    var sellOrderId = await setForSell(sellOrderArr, exchange, buy_order_id);

    var collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
    var updArr = {};
    updArr['is_sell_order'] = 'yes';
    updArr['sell_order_id'] = sellOrderId;
    updArr['auto_sell'] = 'yes';
    // updArr['quantity'] = parseFloat(sellOrderArr['quantity']);

    //set profit percentage if sell price is fixed
    if (sellOrderArr['profit_type'] == 'fixed_price') {
        let purchased_price = !isNaN(parseFloat(sellOrderArr['purchased_price'])) ? parseFloat(sellOrderArr['purchased_price']) : ''
        let sell_profit_percent = ((parseFloat(sellOrderArr['sell_price']) - purchased_price) / purchased_price) * 100
        updArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? parseFloat(Math.abs(sell_profit_percent).toFixed(1)) : ''
        updArr['profit_percent'] = updArr['sell_profit_percent']

        updArr['sell_price'] = sellOrderArr['sell_price']
    }

    //set sell profit percentage
    if (sellOrderArr['profit_type'] == 'percentage' && typeof sellOrderArr['sell_profit_percent'] != 'undefined') {
        let purchased_price = !isNaN(parseFloat(sellOrderArr['purchased_price'])) ? parseFloat(sellOrderArr['purchased_price']) : ''

        let sell_profit_percent = parseFloat(parseFloat(sellOrderArr['sell_profit_percent']).toFixed(1))
        updArr['sell_profit_percent'] = !isNaN(sell_profit_percent) ? Math.abs(sell_profit_percent) : ''

        updArr['sell_price'] = ((parseFloat(purchased_price) / 100) * updArr['sell_profit_percent']) + parseFloat(purchased_price);
    }

    //set stop loss
    if (typeof sellOrderArr['stop_loss'] != 'undefined' && sellOrderArr['stop_loss'] == 'yes' && !isNaN(parseFloat(sellOrderArr['loss_percentage']))) {
        updArr['stop_loss'] = 'yes'
        updArr['loss_percentage'] = parseFloat(parseFloat(sellOrderArr['loss_percentage']).toFixed(1))
    } else {
        updArr['stop_loss'] = 'no'
        updArr['loss_percentage'] = ''
    }

    //set lth profit
    if (typeof sellOrderArr['lth_functionality'] != 'undefined' && sellOrderArr['lth_functionality'] == 'yes' && !isNaN(parseFloat(sellOrderArr['lth_profit']))) {
        updArr['lth_functionality'] = 'yes'
        updArr['lth_profit'] = parseFloat(parseFloat(sellOrderArr['lth_profit']).toFixed(1))
    } else {
        updArr['lth_functionality'] = 'no'
        updArr['lth_profit'] = ''
    }

    if (typeof sellOrderArr['trail_interval'] != 'undefined' && sellOrderArr['trail_interval'] != '') {
        updArr['trail_interval'] = parseFloat(sellOrderArr['trail_interval'])
    }

    var where = {};
    where['_id'] = {
        '$in': [buyOrderId, new ObjectID(buyOrderId)]
    }


    //add these fields in kraken order array
    if (exchange == 'kraken') {
        updArr['defined_sell_percentage'] = typeof updArr['sell_profit_percent'] != 'undefined' ? updArr['sell_profit_percent'] : ''
        updArr['custom_stop_loss_percentage'] = typeof updArr['loss_percentage'] != 'undefined' ? updArr['loss_percentage'] : ''
    }

    updArr['modified_date'] = new Date();
    var updPrmise = updateOne(where, updArr, collection);
    updPrmise.then((callback) => {})

    let log_msg = "Sell Order was Created";
    // var logPromise1 = recordOrderLog(buyOrderId, log_msg, 'set_for_sell', 'yes', exchange);
    var getBuyOrder = await listOrderById(buyOrderId, exchange);
    var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
    var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
    var logPromise1 = create_orders_history_log(buyOrderId, log_msg, 'set_for_sell', 'yes', exchange, order_mode, order_created_date)

    logPromise1.then((resolve) => {})



    resp.status(200).send({
        message: 'Order Set For sell'
    });
})

//function to set manual sell for sell
function setForSell(sellOrderArr, exchange, buy_order_id) {
    return new Promise((resolve) => {
        conn.then((db) => {
            var collection = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
            var where = {};
            where['buy_order_id'] = {
                '$in': [buy_order_id, new ObjectID(buy_order_id)]
            };
            var set = {};
            set['$set'] = sellOrderArr;
            var upsert = {
                'upsert': true
            };
            db.collection(collection).updateOne(where, set, upsert, (error, result) => {
                if (error) {
                    console.log(error)
                } else {
                    if (result.upsertedId == null) {
                        db.collection(collection).find(where).toArray((err, result) => {
                            if (err) {
                                resolve(err)
                            } else {
                                if (result.length > 0) {
                                    resolve(result[0]['_id']);
                                } else {
                                    resolve(result)
                                }
                            }
                        })
                    } else {
                        resolve(result.upsertedId._id);
                    }
                }
            })

        })
    })
} //End of setForSell



//::::::::::::::::::::::::::::::::::; /


// //post call from manage component to list user coin list and detail
// router.post('/manageCoins', async(req, resp) => {
//         var urserCoinsPromise = listUserCoins(req.body.admin_id);
//         var globalCoinsPromise = listGlobalCoins();
//         var promisesResult = await Promise.all([urserCoinsPromise, globalCoinsPromise]);
//         var responseReslt = {};
//         responseReslt['userCoins'] = promisesResult[0];
//         responseReslt['globalCoins'] = promisesResult[1];
//         resp.status(200).send({
//             message: responseReslt
//         });
//     }) //End of manageCoins

router.post('/get_orders_post', auth_token.required, async function (req, res, next) {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(db => {


        var post_data = req.body;
        let post_data_key_array = Object.keys(post_data);
        if (post_data_key_array.length == 0) {
            res.send({
                "success": "false",
                "message": "No data posted in a post request"
            })
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

                } else if (status == "lth") {
                    search_array['status'] = 'lth';
                } else if (status == 'new') {
                    search_array['status'] = 'new';
                    search_array['parent_status'] = {
                        $ne: 'parent'
                    };
                } else if (status == 'all') {
                    search_array['status'] = {
                        $in: ['error', 'canceled', 'submitted']
                    };
                    search_array['price'] = {
                        $ne: ''
                    };
                } else {
                    search_array['status'] = status;
                }

                search_array["application_mode"] = application_mode;
                search_array['admin_id'] = admin_id;
                if (Object.keys(filter_array).length > 0) {
                    if (filter_array['filter_coin'] != "") {
                        symbol = filter_array['filter_coin'];
                        search_array['symbol'] = {
                            $in: coin_array
                        };

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
                        search_array['created_date'] = {
                            $gte: start_date,
                            $lte: end_date
                        };
                    }
                }


                let final_orders_query_resolved = await db.collection('buy_orders').find(search_array).limit(perPage_limit).skip((perPage_limit * page) - perPage_limit).toArray();

                let order_count = await db.collection('buy_orders').count(search_array);
                let total_pages = Math.round(order_count / perPage_limit);



                if (final_orders_query_resolved.length > 0) {


                    let array_response = [];
                    let btc_price = await get_btc_price();
                    final_orders_query_resolved.forEach(async final_orders_element => {


                        let pulled_quantity = final_orders_element['quantity'];

                        let pulled_coin_symbol = final_orders_element['symbol'];
                        // let market_price_array = await db.collection('market_prices').find({ "coin": pulled_coin_symbol }).sort({ "created_date": -1 }).limit(1).toArray();

                        let market_price = get_market_price(pulled_coin_symbol); //market_price_array[0]['price'];


                        let amount_in_usd = pulled_quantity * market_price * btc_price;


                        final_orders_element['amount_in_usd'] = amount_in_usd;



                        array_response.push(final_orders_element);
                        //console.log(array_response, "===> array_response inside scope")
                    })



                    res.send({
                        "success": "true",
                        "data": final_orders_query_resolved,
                        "data_length": final_orders_query_resolved.length,
                        "total_pages": total_pages,
                        "message": "Orders fetched successfully"
                    });
                } else {
                    res.send({
                        "success": "false",
                        "message": "No data found"
                    });
                }


            }) // async function
        }

    })
})

// async function get_market_price(coin){
// 	return new Promise(async function(resolve, reject){
// 		request.post({
// 			url: "http://35.171.172.15:3000/api/listCurrentmarketPrice",
// 			json: {
// 				"coin": coin
// 			},
// 			headers: {"content-type": "application/json"}
// 		}, async function(error, response, body){
// 			if(body.message){
// 				return resolve(body.message);
// 			}else{
// 				return resolve(null);
// 			}
// 		})
// 	})
// }

//function for geting market prices
async function get_market_price(coin) {

    return new Promise((resolve, reject) => {
        conn.then((db) => {

            let symbol = commissionAsset + globalPair;
            let searchCriteria = {};
            searchCriteria['coin'] = coin;
            db.collection('market_prices').find(searchCriteria).sort({
                'created_date': -1
            }).limit(1).toArray((err, result) => {
                if (err) reject(err);
                if (typeof result !== 'undefined' && typeof result[0] !== 'undefined') {
                    resolve(result[0]['price'])
                }
            })

        })
    })

}










async function verify_user_info(api_key, user_ip, admin_id, exchange, kraken_id='', auth_token){
    return new Promise(async function (resolve, reject) {


      let ip ='';
      let port = 2500;
      let url;
      let data = {}
      // If Binance
      if(exchange == 'binance'){
        if(user_ip == '3.227.143.115'){
          ip = 'ip1.digiebot.com'
        } else if(user_ip == '3.228.180.22'){
          ip = 'ip2.digiebot.com'
        } else if(user_ip == '3.226.226.217'){
          ip = 'ip3.digiebot.com'
        } else if(user_ip == '3.228.245.92'){
          ip = 'ip4.digiebot.com'
        } else if(user_ip == '35.153.9.225'){
          ip = 'ip5.digiebot.com'
        } else if(user_ip == '54.157.102.20'){
          ip = 'ip6.digiebot.com'
        }

        url = 'https://'+ ip +'/apiKeySecret/validateApiKeySecret'

        if(kraken_id == 'second'){
            data =  {
                "user_id": admin_id,
                "exchange": exchange,
                "secret": api_key,
                "secret_type": 'balance'
            }
        } else if(kraken_id == 'third'){
            data =  {
                "user_id": admin_id,
                "exchange": exchange,
                "secret_3": api_key
            }
        } else {
            data =  {
                "user_id": admin_id,
                "exchange": exchange,
                "secret": api_key,
                "secret_type": 'trading'
            }
        }
      }
      // If Kraken
      else if(exchange == 'kraken') {



        if(user_ip == '3.227.143.115'){
          ip = 'ip1-kraken.digiebot.com/api/user'
        } else if(user_ip == '3.228.180.22'){
          ip = 'ip2-kraken.digiebot.com/api/user'
        } else if(user_ip == '3.226.226.217'){
          ip = 'ip3-kraken.digiebot.com/api/user'
        } else if(user_ip == '3.228.245.92'){
          ip = 'ip4-kraken.digiebot.com/api/user'
        } else if(user_ip == '35.153.9.225'){
          ip = 'ip5-kraken.digiebot.com/api/user'
        } else if(user_ip == '54.157.102.20'){
          ip = 'ip6-kraken.digiebot.com/api/user'
        }

        // if(kraken_id == 'second'){
        //   url = 'https://'+ ip +'/validateKeyAndSecret'
        // } else if(kraken_id == 'third'){
        //   url = 'https://'+ ip +'/validateKeyAndSecret'
        // } else {
        //   url = 'https://'+ ip +'/validateKeyAndSecret'
        // }


        if(kraken_id == 'second'){
            data =  {
                "user_id": admin_id,
                "exchange": exchange,
                "secret_2": api_key
            }
        } else if(kraken_id == 'third'){
            data =  {
                "user_id": admin_id,
                "exchange": exchange,
                "secret_3": api_key
            }
        } else {
            data =  {
                "user_id": admin_id,
                "exchange": exchange,
                "secret_1": api_key
            }
        }
        url = 'https://'+ ip +'/validateKeyAndSecret'
      }



      console.log(url)
        request.post({
            url: url,
            // json: {
            //     "user_id": admin_id,
            //     "exchange": exchange,
            //     "api_key":api_key
            // },
            json: data,
            headers: {
                'content-type': 'application/json',
                'Token': 'vizzwebsolutions12345678910',
                'Authorization': auth_token
            }
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
              console.log(body,api_key, exchange, 'BODY in user info')
                resolve(body);
            } else {
              if(body){
                resolve(body)
              } else {
                resolve(false)
              }
            }
        });
    });
}
//post call for verify user info
router.post('/verify_user_info', auth_token.required, async function (req, res, next) {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    var auth_token = req.headers.authorization;
    var user_ip = req.body.trading_ip;
    var user_id = req.payload.id;
    var exchange = req.body.exchange;
    var api_key = req.body.api_key;
    var kraken_id = req.body.kraken_id;


    let search_arr = {
      "_id": ObjectID(user_id)
    };
    let search_arr_investment = {
      "admin_id": user_id
    };
    let search_arr_kraken_credentials = {
      "user_id": user_id
    };



    kraken_collection = 'kraken_credentials'
    binance_collection = 'users'
    investment_collection = 'user_investment_'+exchange



    var updateArray = {
      'is_api_key_valid'      :  "yes",
      'count_invalid_api'     :  0,
      'account_block'         :  'no',
      'api_key_valid_checking': new Date()
    };
    var updateArrayinValid = {
        'is_api_key_valid'      :  "no"
        // 'count_invalid_api'     :  0,
        // 'account_block'         :  'yes',
        // 'api_key_valid_checking': new Date()
    };




      var data = await verify_user_info(api_key, user_ip, user_id, exchange, kraken_id, auth_token)
      console.log(data, '-=-=--=-=-=-=-=-=-=')
      if(data.success){


        conn.then(async db => {
            if(exchange == 'binance' ){
            var update_on_user_investment_binance_collection = await db.collection(investment_collection).updateOne(search_arr_investment, {$set: {'exchange_enabled':'yes'}});
            await update_user_wallet_binance(user_id, user_ip)
            var update_on_binance_collection = await db.collection(binance_collection).updateOne(search_arr, {$set: updateArray});
          } else {
            var update_on_kraken_collection = await db.collection(kraken_collection).updateOne(search_arr_kraken_credentials, {$set: updateArray});
          }
          res.status(200).send({
              "success": true,
              "status": 200,
              "message": "Valid Api Key"
          })
        })
      } else {
        conn.then(async db => {
            if(exchange == 'binance' ){
                var update_on_user_investment_binance_collection = await db.collection(investment_collection).updateOne(search_arr_investment, {$set: {'exchange_enabled':'no'}});
                var update_on_binance_collection = await db.collection(binance_collection).updateOne(search_arr, {$set: updateArrayinValid});
                if(data.error){
                    res.status(201).send({
                        "success": false,
                        "status": 201,
                        "message":data.error
                    })
                  } else {
                    res.status(201).send(data)
                  }
            } else {
                var update_on_kraken_collection = await db.collection(kraken_collection).updateOne(search_arr_kraken_credentials, {$set: updateArrayinValid});
                res.status(201).send(data)
            }
        })
        // if(exchange == 'binance'){
        //   if(data.error){
        //     res.status(201).send({
        //         "success": false,
        //         "status": 201,
        //         "message":data.error
        //     })
        //   } else {
        //     res.status(201).send(data)
        //   }
        // } else {
        //   res.status(201).send(data)
        // }
      }



})















async function generatejwtTokenForUserInfo(api_key, api_secret){
    return new Promise(async function (resolve, reject) {
    var today = new Date();
      var exp = new Date(today);
      exp.setDate(today.getDate() + 10000);

      let token =  jwt.sign({
        api_key: api_key,
        api_secret: api_secret,
        exp: parseInt(exp.getTime() / 1000),
      }, secret);

      resolve(token);
    });
}


async function authenticatejwtTokenForUserInfo(token) {
    return new Promise(async function (resolve, reject) {
        jwt.verify(token,secret, (err, data) => {
            if(err){
                console.log(err)
                resolve(false);
            } else {
                resolve(data)
            }
        })
    });
}





async function get_api_secret(user_ip, admin_id, auth_token){
    return new Promise(async function (resolve, reject) {

      let ip = '';
      let port = 2500




      if(user_ip == '3.227.143.115'){
        ip = 'ip1-kraken.digiebot.com/api/user'
      } else if(user_ip == '3.228.180.22'){
        ip = 'ip2-kraken.digiebot.com/api/user'
      } else if(user_ip == '3.226.226.217'){
        ip = 'ip3-kraken.digiebot.com/api/user'
      } else if(user_ip == '3.228.245.92'){
        ip = 'ip4-kraken.digiebot.com/api/user'
      } else if(user_ip == '35.153.9.225'){
        ip = 'ip5-kraken.digiebot.com/api/user'
      } else if(user_ip == '54.157.102.20'){
        ip = 'ip6-kraken.digiebot.com/api/user'
      }

      let url = 'https://'+ ip +'/getApiSecretBalanceTradingBinance'

        console.log(url)
        request.post({
          url: url,
          json: {
              "user_id": admin_id,
              "exchange": 'binance'
          },
          headers: {
              'content-type': 'application/json',
              'Token': 'vizzwebsolutions12345678910',
              'Authorization': auth_token
          }
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                // console.log(body, "get User API");
                if(body.success){
                  console.log(body)
                  resolve(body);
                } else {
                  resolve({
                    success: false,
                    message: "Value Do not Exist"
                  });
                }
            } else {
                resolve({
                  success: false,
                  message: "Error Occured"
                })
            }
        });
    });
}
//post call for getting user info for manage user component
router.post('/get_user_info', auth_token.required, async function (req, res, next) {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var auth_token = req.headers.authorization;
    var post_data = req.body;
    let post_data_key_array = Object.keys(post_data);
    if (post_data_key_array.length == 0) {
        res.status(400).send({
            "success": "false",
            "status": 400,
            "message": "Bad request. No data posted in a post request"
        })
    } else {
        if (req.payload.id) {
            let user_id = req.payload.id;
            conn.then(db => {
                let search_arr = {
                    "_id": ObjectID(user_id)
                };
                db.collection("users").findOne(search_arr,async function (err, data) {
                    if (err) throw err;
                    if (data != undefined || data != null) {
                        if (Object.keys(data).length > 0) {

                            let fieldsArr = [
                                'api_key',
                                'api_secret',
                                'pass_phrase',
                                'first_name',
                                'last_name',
                                'username',
                                'email_address',
                                'phone_number',
                                // 'password',
                                'permission_for',
                                'timezone',
                                'default_exchange',
                                'trading_ip',
                                'hash',
                                '_id'
                            ]

                            for (let [key, value] of Object.entries(data)) {
                                if (!fieldsArr.includes(key)) {
                                    delete data[key]
                                }
                            }



                            // if(typeof data['hash'] != 'undefined' && data['hash'] != ''){
                            //     var allData = await authenticatejwtTokenForUserInfo(data['hash'])
                            //     console.log(allData)


                            //     data['api_key'] = allData['api_key']
                            //     data['api_secret'] = allData['api_secret']
                            // }


                            // console.log(data, 'USER')


                            var userInfo = await get_api_secret(data['trading_ip'], (data['_id']).toString(), auth_token);

                            console.log(userInfo)

                            if(userInfo.success == false){
                              data['api_key'] = '';
                              data['api_secret'] = ''
                              data['api_key_2'] = '';
                              data['api_secret_2'] = ''
                              data['api_key_3'] = '';
                              data['api_secret_3'] = ''
                            } else{
                              data['api_key'] = userInfo.api_key_1;
                              data['api_secret'] = userInfo.secret_1;
                              data['api_key_2'] = userInfo.api_key_2;
                              data['api_secret_2'] = userInfo.secret_2;
                              data['api_key_3'] = userInfo.api_key_3;
                              data['api_secret_3'] = userInfo.secret_3;
                            }


                            // console.log(userInfo)
                            // return false






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
                        res.status(404).send({
                            "success": "false",
                            "status": 404,
                            "message": "Try a different user_id"
                        })
                    }
                })
            })
        } else {
            res.status(400).send({
                "success": "false",
                "status": 400,
                "message": "user_id was required to completed this request..."
            })
        }

    }
})






async function add_user_info(user_ip, admin_id, api_key, api_secret, interface, keyNo, auth_token){
    return new Promise(async function (resolve, reject) {

      let ip = '';
      let port = 2500



      if(user_ip == '3.227.143.115'){
        ip = 'ip1.digiebot.com'
      } else if(user_ip == '3.228.180.22'){
        ip = 'ip1.digiebot.com'
      } else if(user_ip == '3.226.226.217'){
        ip = 'ip1.digiebot.com'
      } else if(user_ip == '3.228.245.92'){
        ip = 'ip1.digiebot.com'
      } else if(user_ip == '35.153.9.225'){
        ip = 'ip1.digiebot.com'
      } else if(user_ip == '54.157.102.20'){
        ip = 'ip1.digiebot.com'
      }

      // let url = 'http://'+ip+
      let data = {};

      let url = 'https://'+ip+'/apiKeySecret/saveApiSecret';
      if(keyNo == 'primary'){
        data = {
            "user_id": admin_id,
            "api_key": api_key,
            "secret_1": api_secret,
            "source":interface,
            "exchange":'binance'
        }
      } else if(keyNo == 'second'){
        data = {
            "user_id": admin_id,
            "api_key_2": api_key,
            "secret_2": api_secret,
            "source":interface,
            "exchange":'binance'
        }
      } else {
        data = {
            "user_id": admin_id,
            "api_key_3": api_key,
            "secret_3": api_secret,
            "source":interface,
            "exchange":'binance'
        }
      }
        request.post({
            url: url,
            json: data,
            headers: {
                'content-type': 'application/json',
                'Token': 'vizzwebsolutions12345678910',
                'Authorization' : auth_token
            }
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                // console.log(body, "get User API");
                if(body.success){
                  resolve(body);
                } else {
                  resolve(false);
                }
            } else {
                resolve(false)
            }
        });
    });
}

const cry = require('crypto');

function decrypt(text) {
    let encryptedText = Buffer.from(text, 'Base64');
    let decipher = cry.createDecipheriv('aes-128-cbc', Buffer.from('digiebot_trading'), 'digiebot_trading');
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

//post call for edit user info
router.post('/update_user_info', auth_token.required, async function (req, res, next) {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }


    var post_data = req.body;
    var auth_token = req.headers.authorization;

    // console.log(post_data['interface'])
    var interface_data = post_data['interface']
    post_data['interface'] = typeof post_data['interface'] != 'undefined' && post_data['interface'] != '' ? 'ios' : 'other';
    if(interface_data == 'web'){
      post_data['interface'] = 'web'
    }

    // console.log(post_data)
    let post_data_key_array = Object.keys(post_data);
    if (post_data_key_array.length == 0) {
        res.status(400).send({
            "success": "false",
            "status": 400,
            "message": "Bad request. No data posted in a post request"
        })
    } else {
        if (req.payload.id) {
            let user_id = req.payload.id;
            conn.then(db => {
                let search_arr = {
                    "_id": ObjectID(user_id)
                };
                let search_arr_investment = {
                  "admin_id": user_id
                };
                db.collection("users").findOne(search_arr,async function (err, data) {
                    if (err) throw err;
                    if (Object.keys(data).length > 0) {
                        let update_arr = new Object(post_data);
                        delete update_arr.user_id;

                        update_arr['trading_ip'] = data['trading_ip'];

                        let fieldsArr = ['api_key', 'api_secret', 'pass_phrase', 'trading_ip', 'user_id', 'interface', 'keyNo']
                        for (let [key, value] of Object.entries(update_arr)) {
                            if (!fieldsArr.includes(key)) {
                                delete update_arr[key]
                            }
                        }



                        console.log(update_arr, 'update_arr' )



                        // if(update_arr['interface'] == 'ios'){
                        //   var key1 = decrypt(update_arr['api_key'])
                        //   update_arr['api_key'] = key1;
                        //   var secret1 = decrypt(update_arr['api_secret'])
                        //   update_arr['api_secret'] = secret1;
                        // } else {
                        //   var key1  = CryptoJS.AES.decrypt(update_arr['api_key'], 'digiebot_trading');
                        //   update_arr['api_key'] = key1.toString(CryptoJS.enc.Utf8);



                        //   var secret1  = CryptoJS.AES.decrypt(update_arr['api_secret'], 'digiebot_trading');
                        //   update_arr['api_secret'] = secret1.toString(CryptoJS.enc.Utf8);
                        // }






                        // console.log(update_arr['api_key'], update_arr['api_secret'] )

                        if(update_arr['keyNo'] == 'primary'){
                            var data = await add_user_info(update_arr['trading_ip'], user_id, update_arr['api_key'], update_arr['api_secret'], update_arr['interface'], update_arr['keyNo'], auth_token)
                        } else if(update_arr['keyNo'] == 'second') {
                            var data = await add_user_info(update_arr['trading_ip'], user_id, update_arr['api_key'], update_arr['api_secret'], update_arr['interface'], update_arr['keyNo'], auth_token)
                        } else {
                            var data = await add_user_info(update_arr['trading_ip'], user_id, update_arr['api_key'], update_arr['api_secret'], update_arr['interface'], update_arr['keyNo'], auth_token)
                        }



                        console.log(data, 'add_user_info')


                        var apikey = update_arr['api_key'].substring(0, 5);
                        var apisecret = update_arr['api_secret'].substring(0, 5);
                        var permision_for = update_arr['pass_phrase']




                        if(data.success){
                            if(update_arr['keyNo'] == 'primary'){
                                var update_on_user_investment_binance_collection = await db.collection("user_investment_binance").updateOne(search_arr_investment, {$set: {'exchange_enabled': 'yes', 'permission_for': permision_for}});
                                var update_on_users_collection = await db.collection("users").updateOne(search_arr, {$set: {'api_key':apikey, 'api_secret': apisecret, 'is_api_key_valid': 'yes', 'count_invalid_api': 0, 'account_block': 'no', 'api_key_valid_checking': new Date(), 'info_modified_date': new Date(), 'permission_for': permision_for}});
                                await update_user_wallet_binance(user_id, update_arr['trading_ip'])
                            } else if(update_arr['keyNo'] == 'second'){
                                var update_on_users_collection = await db.collection("users").updateOne(search_arr, {$set: {'api_key_secondary':apikey, 'api_secret_secondary': apisecret, 'is_api_key_valid_secondary': 'yes', 'count_invalid_api_secondary': 0, 'account_block_secondary': 'no', 'api_key_valid_checking_secondary': new Date(), 'info_modified_date_secondary': new Date(), 'permission_for_secondary': permision_for}});
                            } else {
                                var update_on_users_collection = await db.collection("users").updateOne(search_arr, {$set: {'api_key_third':apikey, 'api_secret_third': apisecret, 'is_api_key_valid_third': 'yes', 'count_invalid_api_third': 0, 'account_block_third': 'no', 'api_key_valid_checking_third': new Date(), 'info_modified_date_third_key': new Date(), 'permission_for_third': permision_for}});
                            }
                            res.status(200).send({
                                "success": true,
                                "status": 200,
                                "message": "Submitted on Digie Platform Successfully"
                            })
                        } else {
                            res.status(201).send({
                                "success": false,
                                "status": 201,
                                "message": "Not Submitted on Digie Platform Please Try Again"
                            })
                        }

                        return false;
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
            res.status(400).send({
                "success": "false",
                "status": 400,
                "message": "user_id was required to completed this request..."
            })
        }
    }
})



/*  Create Manual order Globally from
@  Order will create from Chart
@  Order will create from Mobile App
@  Order will create from dashboard
*/
router.post('/createManualOrderGlobally', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then((db) => {
        let orderArr = req.body.orderArr;

        let orderId = orderArr['orderId'];
        var price = orderArr['price'];
        let exchange = orderArr['exchange'];

        var setOrderArr = {}
        setOrderArr['price'] = ((orderArr['price'] != '') && (orderArr['price'] != 'undefined')) ? parseFloat(orderArr['price']) : '';
        setOrderArr['quantity'] = ((orderArr['quantity'] != '') && (orderArr['quantity'] != 'undefined')) ? orderArr['quantity'] : '';
        setOrderArr['symbol'] = ((orderArr['symbol'] != '') && (orderArr['symbol'] != 'undefined')) ? orderArr['symbol'] : '';
        setOrderArr['order_type'] = ((orderArr['order_type'] != '') && (orderArr['order_type'] != 'undefined')) ? orderArr['order_type'] : '';
        setOrderArr['admin_id'] = ((orderArr['admin_id'] != '') && (orderArr['admin_id'] != 'undefined')) ? orderArr['admin_id'] : '';
        setOrderArr['trigger_type'] = ((orderArr['trigger_type'] != '') && (orderArr['trigger_type'] != 'undefined')) ? orderArr['trigger_type'] : '';
        setOrderArr['application_mode'] = ((orderArr['application_mode'] != '') && (orderArr['application_mode'] != 'undefined')) ? orderArr['application_mode'] : '';
        setOrderArr['exchange'] = ((orderArr['exchange'] != '') && (orderArr['exchange'] != 'undefined')) ? orderArr['exchange'] : '';
        setOrderArr['status'] = ((orderArr['status'] != '') && (orderArr['status'] != 'undefined')) ? orderArr['status'] : '';
        setOrderArr['lth_functionality'] = ((orderArr['lth_functionality'] != '') && (orderArr['lth_functionality'] != 'undefined')) ? orderArr['lth_functionality'] : '';
        setOrderArr['lth_profit'] = ((orderArr['lth_profit'] != '') && (orderArr['lth_profit'] != 'undefined')) ? orderArr['lth_profit'] : '';
        setOrderArr['trail_check'] = ((orderArr['trail_check'] != '') && (orderArr['trail_check'] != 'undefined')) ? orderArr['trail_check'] : '';
        setOrderArr['trail_interval'] = ((orderArr['trail_interval'] != '') && (orderArr['trail_interval'] != 'undefined')) ? parseFloat(orderArr['trail_interval']) : '';
        setOrderArr['buy_trail_percentage'] = ((orderArr['buy_trail_percentage'] != '') && (orderArr['buy_trail_percentage'] != 'undefined')) ? orderArr['buy_trail_percentage'] : '';
        setOrderArr['buy_trail_price'] = ((orderArr['buy_trail_price'] != '') && (orderArr['buy_trail_price'] != 'undefined')) ? parseFloat(orderArr['buy_trail_price']) : '';
        setOrderArr['auto_sell'] = ((orderArr['auto_sell'] != '') && (orderArr['auto_sell'] != 'undefined')) ? parseFloat(orderArr['auto_sell']) : '';
        setOrderArr['iniatial_trail_stop'] = ((orderArr['iniatial_trail_stop'] != '') && (orderArr['iniatial_trail_stop'] != 'undefined')) ? parseFloat(orderArr['iniatial_trail_stop']) : '';
        setOrderArr['created_date'] = new Date();
        setOrderArr['modified_date'] = new Date();

        // Validate some of the fields i-e Quantity, Price, Symbol, Admin ID , exchange
        if (!setOrderArr['price']) { // if price is  empty
            resp.status(400).json({
                message: 'Price cannot be empty !'
            });
            return;
        }
        if (!setOrderArr['quantity']) { // if quantity is  empty
            resp.status(400).json({
                message: 'Quantity cannot be empty !'
            });
            return;
        }
        if (!setOrderArr['symbol']) { // if symbol is  empty
            resp.status(400).json({
                message: 'Symbol not found'
            });
            return;
        }
        if (!setOrderArr['admin_id']) { // if quantity is  empty
            resp.status(400).json({
                message: 'User cannot be empty !'
            });
            return;
        }
        if (!setOrderArr['application_mode']) { // if quantity is  empty
            resp.status(400).json({
                message: 'Select Apllication mode'
            });
            return;
        }
        if (!setOrderArr['exchange']) { // if quantity is  empty
            resp.status(400).json({
                message: 'Exchange name cannot be empty'
            });
            return;
        }

        // Insert data TO db  from here
        var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
        db.collection(collectionName).insertOne(setOrderArr, async (err, result) => {
            if (err) {
                resp.status(403).send({
                    message: err
                })
            } else {
                // Add logs in orders logs table
                var buyOrderId = result.insertedId
                var log_msg = "Buy Order was Created at Price " + parseFloat(price).toFixed(8);
                let profit_percent = req.body.tempOrderArr.profit_percent;

                if (req.body.orderArr.auto_sell == 'yes' && profit_percent != '') {
                    log_msg += ' with auto sell ' + parseFloat(profit_percent) + '%';
                }
                log_msg += 'With Chart';
                let show_hide_log = 'yes';
                let type = 'Order_created';
                // var promiseLog = recordOrderLog(buyOrderId, log_msg, type, show_hide_log, exchange)
                var getBuyOrder = await listOrderById(buyOrderId, exchange);
                var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
                var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
                var promiseLog = create_orders_history_log(buyOrderId, log_msg, 'Order_created', 'yes', exchange, order_mode, order_created_date)
                promiseLog.then((callback) => {})
                //if auto sell is yes then create sell order
                if (req.body.orderArr.auto_sell == 'yes') {
                    let tempOrder = req.body.tempOrderArr;
                    tempOrder['created_date'] = new Date();
                    tempOrder['buy_order_id'] = buyOrderId;
                    tempOrder['profit_price'] = parseFloat(tempOrder['profit_price']);
                    tempOrder['profit_percent'] = parseFloat(tempOrder['profit_percent']);
                    var tempCollection = (exchange == 'binance') ? 'temp_sell_orders' : 'temp_sell_orders_' + exchange;
                    //create sell order
                    db.collection(tempCollection).insertOne(tempOrder, (err, result) => {
                        if (err) {
                            resp.status(403).send({
                                message: 'Some thing went wrong while Creating order'
                            });
                        } else {
                            resp.status(200).send({
                                message: 'Order successfully created with auto sell'
                            });
                        }
                    }) // END of  db.collection(tempCollection).insertOne(tempOrder, (err, result) => {
                } else {
                    resp.status(200).send({
                        message: 'Order created with **'
                    });
                } // END of  if (req.body.orderArr.auto_sell == 'yes') {
            }
        }) // END of   db.collection(collectionName).insertOne(setOrderArr, (err, result) =>{
    }) // END  of  conn.then((db)=>{
}) // END of  router.post('/createManualOrderGlobally',(req,resp)=>{



//post call for adding user coins from global coins
router.post('/addUserCoins', auth_token.required, async function (req, res, next) {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var post_data = req.body;
    let post_data_key_array = Object.keys(post_data);
    if (post_data_key_array.length == 0) {
        res.send({
            "success": "false",
            "message": "No data posted in a post request"
        })
    } else {
        conn.then(db => {
            if ("admin_id" in post_data && "coin_ids" in post_data) {
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

            async function get_coins_by_ids(coin_id) {
                return new Promise(async function (resolve, reject) {
                    db.collection("coins").find({
                        "_id": ObjectID("coin_id")
                    }).toArray((err, data) => {
                        if (err) throw err;
                        resolve(data[0]['symbol']);
                    })
                })
            }
        })
    }
}) //End of addUserCoins

//:::::::::::::::::::::::::::::::::::::::::: /


//post call to all user coins
router.post('/addUserCoin', auth_token.required, async function (req, res, next) {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    conn.then(async (db) => {

        let exchange = req.body.exchange
        let symbols = req.body.symbols
        let user_id = req.body.user_id
        if (typeof symbols == 'undefined' || typeof user_id == 'undefined' || user_id == '' || typeof exchange == 'undefined' || exchange == '') {
            res.send({
                'status': true,
                'message': 'exchange, user_id and symbols array are required'
            });
        } else {

            let coins_collection = (exchange == 'binance' ? 'coins' : 'coins_' + exchange)
            //Delete all user coins
            db.collection(coins_collection).deleteMany({
                "user_id": user_id
            });

            //insert user coins
            if (symbols.length > 0) {
                let where = {
                    'user_id': 'global',
                    'symbol': {
                        '$in': symbols
                    },
                }
                if (coins_collection == 'coins') {
                    where['exchange_type'] = 'binance'
                }

                let data1 = await db.collection(coins_collection).find(where).toArray();
                let add_coins = [];
                if (data1.length > 0) {
                    await Promise.all(data1.map(coin => {
                        let obj = {
                            "user_id": user_id,
                            "symbol": coin['symbol'],
                            "coin_name": coin['coin_name'],
                            "coin_logo": coin['coin_logo'],
                        }
                        if (exchange == 'binance') {
                            obj["exchange_type"] = exchange
                        }
                        add_coins.push(obj)
                    }))
                    if (add_coins.length > 0) {
                        let ins = await db.collection(coins_collection).insertMany(add_coins);
                        let updateBalance = update_user_balance(user_id)
                    }
                }
            }
            res.send({
                'status': true,
                'message': 'Coins updated successfully'
            });
        }
    })
})



Date.prototype.addHours = function (h) {
    this.setHours(this.getHours() + h);
    return this;
}




/////////////////////rabi

//function for getting last price for manage coins
async function getLastPrice(coin) {
    return new Promise(async function (resolve, reject) {
        conn.then(async db => {
            db.collection("market_prices").find({
                "coin": coin
            }).sort({
                "_id": -1
            }).limit(1).toArray(async function (err, data) {
                if (err) throw err;
                if (data.length > 0) {
                    let last_value = parseFloat(data[0].price);
                    resolve(last_value);
                } else {
                    resolve(null);
                }
            })
        }).catch(err => {
            console.log(err);
        })
    })
} // End of getLastPrice
//get 24 hour price change for manage coins component
async function get24HrPriceChange(coin) {
    return new Promise(async function (resolve, reject) {
        conn.then(async db => {
            db.collection("coin_price_change").findOne({
                "symbol": coin
            }, async function (err, data) {
                if (err) throw err;
                if (data != undefined || data != null) {
                    if (Object.keys(data).length > 0) {
                        let return_json = new Object();
                        return_json['price_change'] = data['priceChange'];
                        return_json['price_change_percentage'] = data['priceChangePercent'];
                        resolve(return_json);
                    } else {
                        resolve({})
                    }
                } else {
                    resolve(null)
                }
            })
        })
    })
}

function mergeContentManageCoins(data) {

    var return_arr = [];
    var arrylen = data.length;
    var temlen = 0;

    (async () => {
        for (let index in data) {
            let data_element = {};
            data_element['last_price'] = await getLastPrice(data[index]['symbol']);
            let price_change_json = await get24HrPriceChange(data[index]['symbol']);

            if (price_change_json != null || Object.keys(price_change_json).length > 0) {
                data_element = Object.assign(data_element, price_change_json);
            }

            return_arr.push(data_element);
        }
    })()
    return return_arr;

}
//*********************************************************== */


function listBamCurrentMarketPrice(coin) {
    return new Promise(function (resolve, reject) {
        conn.then((db) => {
            let where = {};
            where['coin'] = coin;
            db.collection('market_prices_bam').find(where).toArray((err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    if (result.length > 0) {
                        resolve(result[0]['price']);
                    } else {
                        resolve(000);
                    }
                }
            })
        })
    })
} //End of listBamCurrentMarketPrice


//function for listing user bam coins from
function listBamUserCoins(admin_id) {
    return new Promise(function (resolve, reject) {
        request.post({
            url: 'http://54.156.174.16:3001/api/listUserCoinsAPI',
            json: {
                "admin_id": admin_id,
            },
            headers: {
                'content-type': 'application/json'
            }
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                if (body == undefined) {
                    resolve([])
                } else {
                    resolve(body.message)
                }
            } else {}
        });
    })
} //End of listBamUserCoins

//save bam credentials from setting component
router.post('/saveBamCredentials', auth_token.required, async(req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }


    var auth_token = req.headers.authorization;
    var user_id = req.body.user_id;
    var api_key = req.body.api_key;
    var api_secret = req.body.api_secret;

    api_key = api_key.trim()
    api_secret = api_secret.trim()

    conn.then((db) => {
        let insertArr = {};
        insertArr['user_id'] = user_id;
        insertArr['api_key'] = api_key;
        insertArr['api_secret'] = api_secret;
        let set = {};
        set['$set'] = insertArr;
        let where = {};
        where['user_id'] = user_id; {
            upsert: true
        }
        let upsert = {
            upsert: true
        };
        db.collection('bam_credentials').updateOne(where, set, upsert, async (err, result) => {
            if (err) {
                console.log(err);
            } else {

                var reqObj = {
                    'type': 'POST',
                    'url': 'https://app.digiebot.com/admin/Api_calls/important_user_activity_logs',
                    'header':{
                      'Authorization': auth_token
                    },
                    'payload': {
                        'user_id': String(user_id),
                        'type': 'api_key_updated',
                        'log': 'Bam API key is updated',
                    },
                }
                var apiResult = await customApiRequest(reqObj)

                let updateWallet = update_user_balance(user_id)

                let validation = validate_bam_credentials(api_key, api_secret, user_id)
                resp.status(200).send({
                    "success": "true",
                    "message": "Credentials Updated Successfully"
                })
            }
        })
    })


}) //End of saveBamCredentials



async function add_user_info_kraken1(user_ip, admin_id, api_key, api_secret, interface, auth_token){
  return new Promise(async function (resolve, reject) {





    let ip = '';
    let port = 2500


    if(user_ip == '3.227.143.115'){
      ip = 'ip1-kraken.digiebot.com/api/user'
    } else if(user_ip == '3.228.180.22'){
      ip = 'ip2-kraken.digiebot.com/api/user'
    } else if(user_ip == '3.226.226.217'){
      ip = 'ip3-kraken.digiebot.com/api/user'
    } else if(user_ip == '3.228.245.92'){
      ip = 'ip4-kraken.digiebot.com/api/user'
    } else if(user_ip == '35.153.9.225'){
      ip = 'ip5-kraken.digiebot.com/api/user'
    } else if(user_ip == '54.157.102.20'){
      ip = 'ip6-kraken.digiebot.com/api/user'
    }

    // let url = 'http://'+ip+

    let url = 'https://'+ip+'/saveSecretTrading';

      console.log(url)
      request.post({
          url: url,
          json: {
              "user_id": admin_id,
              "trading_ip": user_ip,
              "api_key": api_key,
              "secret_1": api_secret,
              "secret_2": '',
              "secret_3": '',
              "source":interface
          },
          headers: {
              'content-type': 'application/json',
              'Token': 'vizzwebsolutions12345678910',
              'Authorization': auth_token
          }
      }, function (error, response, body) {
          // console.log(body)
          if (!error && response.statusCode == 200) {
              console.log(body, "get User API");
              if(body.success){
                resolve(body);
              } else {
                resolve(false);
              }
          } else {
              resolve(false)
          }
      });
  });
}
async function add_user_info_kraken2(user_ip, admin_id, api_key, api_secret, interface, auth_token){
  return new Promise(async function (resolve, reject) {


    let ip = '';
    let port = 2500


    if(user_ip == '3.227.143.115'){
      ip = 'ip1-kraken.digiebot.com/api/user'
    } else if(user_ip == '3.228.180.22'){
      ip = 'ip2-kraken.digiebot.com/api/user'
    } else if(user_ip == '3.226.226.217'){
      ip = 'ip3-kraken.digiebot.com/api/user'
    } else if(user_ip == '3.228.245.92'){
      ip = 'ip4-kraken.digiebot.com/api/user'
    } else if(user_ip == '35.153.9.225'){
      ip = 'ip5-kraken.digiebot.com/api/user'
    } else if(user_ip == '54.157.102.20'){
      ip = 'ip6-kraken.digiebot.com/api/user'
    }

    let url = 'https://'+ip+'/saveSecretTrading';



      console.log(url)
      request.post({
          url: url,
          json: {
            "user_id": admin_id,
            "trading_ip": user_ip,
            "api_key": api_key,
            "secret_1": '',
            "secret_2": api_secret,
            "secret_3": '',
            "source":interface
          },
          headers: {
            'content-type': 'application/json',
            'Token': 'vizzwebsolutions12345678910',
            'Authorization': auth_token
          }
      }, function (error, response, body) {
          if (!error && response.statusCode == 200) {
              console.log(body, "get User API");
              if(body.success){
                resolve(body);
              } else {
                resolve(false);
              }
          } else {
              resolve(false)
          }
      });
  });
}
async function add_user_info_kraken3(user_ip, admin_id, api_key, api_secret, interface, auth_token){
  return new Promise(async function (resolve, reject) {



    let ip = '';
    let port = 2500


    if(user_ip == '3.227.143.115'){
      ip = 'ip1-kraken.digiebot.com/api/user'
    } else if(user_ip == '3.228.180.22'){
      ip = 'ip2-kraken.digiebot.com/api/user'
    } else if(user_ip == '3.226.226.217'){
      ip = 'ip3-kraken.digiebot.com/api/user'
    } else if(user_ip == '3.228.245.92'){
      ip = 'ip4-kraken.digiebot.com/api/user'
    } else if(user_ip == '35.153.9.225'){
      ip = 'ip5-kraken.digiebot.com/api/user'
    } else if(user_ip == '54.157.102.20'){
      ip = 'ip6-kraken.digiebot.com/api/user'
    }

    let url = 'https://'+ip+'/saveSecretTrading';

      console.log(url)
      request.post({
          url: url,
          json: {
            "user_id": admin_id,
            "trading_ip": user_ip,
            "api_key": api_key,
            "secret_1": '',
            "secret_2": '',
            "secret_3": api_secret,
            "source": interface
          },
          headers: {
            'content-type': 'application/json',
            'Token': 'vizzwebsolutions12345678910',
            'Authorization': auth_token
          }
      }, function (error, response, body) {
          if (!error && response.statusCode == 200) {
              console.log(body, "get User API");
              if(body.success){
                resolve(body);
              } else {
                resolve(false);
              }
          } else {
              resolve(false)
          }
      });
  });
}

//save kraken credentials from setting component
router.post('/saveKrakenCredentials', auth_token.required, async(req, resp) => {



    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    var auth_token = req.headers.authorization;
    var user_id = req.payload.id;
    var api_key = req.body.api_key;
    var api_secret = req.body.api_secret;
    var trading_ip = req.body.trading_ip;
    var source = req.body.source;
    var interface = typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'ios' : 'other';
    if(source == 'web'){
      interface = source
    }


    // console.log('-=-=-=-=-=-=-=-=-=-', interface, api_key)

    // if(interface== 'ios'){
    //     var key1 = decrypt(api_key)
    //     api_key = key1;
    //     var secret1 = decrypt(api_secret)
    //     api_secret = secret1;
    // } else {
    //     var key1  = CryptoJS.AES.decrypt(api_key, 'digiebot_trading');
    //     api_key = key1.toString(CryptoJS.enc.Utf8);
    //     var secret1  = CryptoJS.AES.decrypt(api_secret, 'digiebot_trading');
    //     api_secret = secret1.toString(CryptoJS.enc.Utf8);
    // }






    api_key = api_key.trim()
    api_secret = api_secret.trim()

    console.log(api_key, api_secret,'Huzaifa Test line')
    // return false;

    var data = await add_user_info_kraken1(trading_ip, user_id, api_key, api_secret, interface, auth_token);


    console.log(data, "DATA")
    if(data.success){



      // Update kraken_credentials Document
      conn.then(async (db) => {
        let insertArr = {};
        insertArr['user_id'] = user_id;
        // insertArr['api_key'] = api_key.substring(0, 5);
        insertArr['api_secret'] = api_secret.substring(0, 5);
        insertArr['modified_date'] = new Date();
        insertArr['modified_date_primary'] = new Date();
        insertArr['is_api_key_valid'] = 'yes';
        insertArr['api_key_valid_checking'] = new Date();
        insertArr['count_invalid_api'] = 0;
        insertArr['account_block'] = 'no';
        let set = {};
        set['$set'] = insertArr;
        let where = {};
        where['user_id'] = user_id;
        let upsert = {
            upsert: true
        };


        // console.log(where, set, upsert)
        let search_arr_investment = {
          "admin_id": user_id
        };

        var update_on_user_investment_binance_collection = await db.collection("user_investment_kraken").updateOne(search_arr_investment, {$set: {'exchange_enabled': 'yes'}});
        db.collection('kraken_credentials').updateOne(where, set, upsert, async (err, result) => {
          if(err){
            console.log(err);
            resp.status(200).send({
              "success": false,
              "message": "Credentials Not Saved on Kraken Credentials"
            });
          } else {
            resp.status(200).send({
              "success": true,
              "status": 200,
              "message": "Credentials Saved Successfully"
            });
          }
        });
      });

    } else {
      resp.status(200).send({
        "success": false,
        "message": "Credentials Not Saved on Shahzad End"
      });
    }

    return false
}) //End of saveKrakenCredentials

//save kraken credentials from setting component
router.post('/saveKrakenCredentialsSecondary', auth_token.required, async(req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    var auth_token = req.headers.authorization;
    var user_id = req.payload.id;
    var api_key = req.body.api_key_secondary;
    var api_secret = req.body.api_secret_secondary;
    var trading_ip = req.body.trading_ip;
    var source = req.body.source;
    var interface = typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'ios' : 'other';
    if(source == 'web'){
      interface = source
    }



    api_key = api_key.trim()
    api_secret = api_secret.trim()


    // console.log(interface, api_key, api_secret, '-=-=-=-=-=-=-=-=-=-=-')

    // if(interface== 'ios'){
    //     var key2 = decrypt(api_key)
    //     api_key = key2;
    //     var secret2 = decrypt(api_secret)
    //     api_secret = secret2;
    // } else {
    //     var key2  = CryptoJS.AES.decrypt(api_key, 'digiebot_trading');
    //     api_key = key2.toString(CryptoJS.enc.Utf8);



    //     var secret2  = CryptoJS.AES.decrypt(api_secret, 'digiebot_trading');
    //     api_secret = secret2.toString(CryptoJS.enc.Utf8);
    // }





    // console.log(api_key, api_secret)
    // return false;



    var data = await add_user_info_kraken2(trading_ip,user_id,api_key,api_secret, interface, auth_token);
    if(data.success){


      // Update kraken_credentials Document
      conn.then((db) => {
        let insertArr = {};
        insertArr['user_id'] = user_id;
        // insertArr['api_key_secondary'] = api_key.substring(0, 5);
        insertArr['api_secret_secondary'] = api_secret.substring(0, 5);
        insertArr['modified_date_secondary'] = new Date();
        let set = {};
        set['$set'] = insertArr;
        let where = {};
        where['user_id'] = user_id;
        let upsert = {
            upsert: true
        };


        // console.log(where, set, upsert)
        db.collection('kraken_credentials').updateOne(where, set, upsert, async (err, result) => {
          if(err){
            console.log(err);
            resp.status(200).send({
              "success": false,
              "message": "Credentials Not Saved on Kraken Credentials"
            });
          } else {
            resp.status(200).send({
              "success": true,
              "status": 200,
              "message": "Credentials Saved Successfully"
            });
          }
        });
      });
    } else {
      resp.status(200).send({
        "success": false,
        "message": "Credentials Not Saved"
      });
    }





    return false;
    // Old Code
}) //End of saveKrakenCredentialsSecondary

router.post('/saveKrakenCredentialsThirdKey', auth_token.required, async(req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }


    var auth_token = req.headers.authorization;
    var user_id = req.payload.id;
    var api_key = req.body.api_key_third_key;
    var api_secret = req.body.api_secret_third_key;
    var trading_ip = req.body.trading_ip;
    var source = req.body.source;
    var interface = typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'ios' : 'other';
    if(source == 'web'){
      interface = source
    }



    // var key3  = CryptoJS.AES.decrypt(api_key, 'digiebot_trading');
    // api_key = key3.toString(CryptoJS.enc.Utf8);



    // var secret3  = CryptoJS.AES.decrypt(api_secret, 'digiebot_trading');
    // api_secret = secret3.toString(CryptoJS.enc.Utf8);

    // console.log(api_key, api_secret)
    // return false;

    api_key = api_key.trim()
    api_secret = api_secret.trim()

    var data = await add_user_info_kraken3(trading_ip, user_id, api_key, api_secret, interface, auth_token);
    if(data.success){


        conn.then((db) => {
            let insertArr = {};
            insertArr['user_id'] = user_id;
            // insertArr['api_key_third_key'] = api_key.substring(0, 5);
            insertArr['api_secret_third_key'] = api_secret.substring(0, 5);
            insertArr['modified_date_third_key'] = new Date();
            let set = {};
            set['$set'] = insertArr;
            let where = {};
            where['user_id'] = user_id;
            let upsert = {
                upsert: true
            };


            // console.log(where, set, upsert)
            db.collection('kraken_credentials').updateOne(where, set, upsert, async (err, result) => {
              if(err){
                console.log(err);
                resp.status(200).send({
                  "success": false,
                  "message": "Credentials Not Saved on Kraken Credentials"
                });
              } else {
                resp.status(200).send({
                  "success": true,
                  "status": 200,
                  "message": "Credentials Saved Successfully"
                });
              }
            });
          });
    } else {
      resp.status(200).send({
        "success": false,
        "message": "Credentials Not Saved"
      });
    }





    return false;

}) //End of saveKrakenCredentialsThirdKey

router.post('/getBamCredentials', auth_token.required, async (req, resp) => {
    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var user_id = req.body.user_id;
    var bamCredentials = await getBamCredentials(user_id);
    resp.status(200).send({
        response: bamCredentials
    })

}) //End of getBamCredentials

function getBamCredentials(user_id) {
    return new Promise((resolve, reject) => {
        conn.then((db) => {
            let where = {};
            where['user_id'] = user_id;
            db.collection('bam_credentials').find(where).toArray((err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of getBamCredentials

router.post('/getKrakenCredentials', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    var auth_token = req.headers.authorization;
    var user_id = req.payload.id;
    var trading_ip = req.body.trading_ip;
    var interface = typeof (req.body.interface != 'undefined') ? req.body.interface : 'web';
    // var krakenCredentials1 = await getKrakenCredentials(trading_ip, user_id);
    // var krakenCredentials2 = await getKrakenCredentials2(trading_ip, user_id);
    // var krakenCredentials3 = await getKrakenCredentials3(trading_ip, user_id);

    var kraken_data = await getKrakenCredentials_new(trading_ip, user_id, auth_token);


    console.log(kraken_data)

    var obj = {}
    obj['api_secret'] = '';
    obj['api_secret_secondary'] = '';
    obj['api_secret_third_key'] = '';
    obj['api_key'] = '';
    obj['api_key_secondary'] = '';
    obj['api_key_third_key'] = '';
    // First Secret Key
    if(kraken_data != false){
        if(kraken_data.secret_1 == ''){
          obj['api_secret'] = '';
          obj['api_key'] = '';
        } else {
          obj['api_secret'] = kraken_data.secret_1;
          obj['api_key'] = kraken_data.api_key_1;
        }

        // Second Secret Key
        if(kraken_data.secret_2 == ''){
            obj['api_secret_secondary'] = '';
            obj['api_key_secondary'] = '';
        } else {
            obj['api_secret_secondary'] = kraken_data.secret_2;
            obj['api_key_secondary'] = kraken_data.api_key_2;
        }

        // Third Secret Key
        if(kraken_data.secret_3 == ''){
            obj['api_secret_third_key'] = '';
            obj['api_key_third_key'] = '';
        } else {
            obj['api_secret_third_key'] = kraken_data.secret_3;
            obj['api_key_third_key'] = kraken_data.api_key_3;
        }

    }


    var arr = [];
    arr.push(obj);




    if(interface == 'mobile'){
        resp.status(200).send({
            success:true,
            message:"ALL Good Bro Just Contact Me"
        })
    } else {
        resp.status(200).send({
            response: arr
        })
    }
    // console.log(krakenCredentials1, krakenCredentials2, krakenCredentials3)
    return false;



    var obj = {}
    var obj1_mobile = {}
    var obj2_mobile = {}
    var obj3_mobile = {}


    // First Secret Key
    if(krakenCredentials1 == false){
      obj['api_key'] = '';
      obj1_mobile['api_key'] = '';
    } else {
      obj['api_key'] = krakenCredentials1
      obj1_mobile['api_key'] = krakenCredentials1
    }

    // Second Secret Key
    if(krakenCredentials2 == false){
      obj['api_key_secondary'] = '';
      obj2_mobile['api_key'] = '';
    } else {
      obj['api_key_secondary'] = krakenCredentials2
      obj2_mobile['api_key'] = krakenCredentials2
    }

    // Third Secret Key
    if(krakenCredentials3 == false){
      obj['api_key_third_key'] = '';
      obj3_mobile['api_key'] = '';
    } else {
      obj['api_key_third_key'] = krakenCredentials3
      obj3_mobile['api_key'] = krakenCredentials3
    }


    obj['api_secret'] = '';
    obj['api_secret_secondary'] = '';
    obj['api_secret_third_key'] = '';

    obj1_mobile['api_secret'] = ''
    obj2_mobile['api_secret'] = ''
    obj3_mobile['api_secret'] = ''


    var arr = [];
    arr.push(obj);


    arr_mobile = [];
    arr_mobile.push(obj1_mobile)
    arr_mobile.push(obj2_mobile)
    // arr_mobile.push(obj3_mobile)



    if(interface == 'mobile'){
        resp.status(200).send({
            success: true,
            status: 200,
            kraken_data:arr_mobile
        })
    } else {
        resp.status(200).send({
            response: arr
        })
    }



}) //End of getKrakenCredentials


function getKrakenCredentials_new(trading_ip, user_id, auth_token) {
    return new Promise((resolve, reject) => {




        let ip = '';
        let port = 2500


        if(trading_ip == '3.227.143.115'){
          ip = 'ip1-kraken.digiebot.com/api/user'
        } else if(trading_ip == '3.228.180.22'){
          ip = 'ip2-kraken.digiebot.com/api/user'
        } else if(trading_ip == '3.226.226.217'){
          ip = 'ip3-kraken.digiebot.com/api/user'
        } else if(trading_ip == '3.228.245.92'){
          ip = 'ip4-kraken.digiebot.com/api/user'
        } else if(trading_ip == '35.153.9.225'){
          ip = 'ip5-kraken.digiebot.com/api/user'
        } else if(trading_ip == '54.157.102.20'){
          ip = 'ip6-kraken.digiebot.com/api/user'
        }

        let url1 = 'https://'+ip+'/getApiSecretBalanceTrading';
        console.log(url1)
        request.post({
            url: url1,
            json: {
                "user_id": user_id,
            },
            headers: {
                'content-type': 'application/json',
                'Token': 'vizzwebsolutions12345678910',
                'Authorization': auth_token
            }
        }, function (error, response, body) {
            // console.log(error,body)
            if (!error && response.statusCode == 200) {
                console.log(body, "get User API1");
                if(body.success){
                  resolve(body);
                } else {
                  resolve(false);
                }
            } else {
                resolve(false)
            }
        });
    })
} //End of getKrakenCredentials_new

function getKrakenCredentials(trading_ip, user_id) {
    return new Promise((resolve, reject) => {




        let ip = '';
        let port = 2500


        if(trading_ip == '3.227.143.115'){
          ip = 'ip1-kraken.digiebot.com/api/user'
        } else if(trading_ip == '3.228.180.22'){
          ip = 'ip2-kraken.digiebot.com/api/user'
        } else if(trading_ip == '3.226.226.217'){
          ip = 'ip3-kraken.digiebot.com/api/user'
        } else if(trading_ip == '3.228.245.92'){
          ip = 'ip4-kraken.digiebot.com/api/user'
        } else if(trading_ip == '35.153.9.225'){
          ip = 'ip5-kraken.digiebot.com/api/user'
        } else if(trading_ip == '54.157.102.20'){
          ip = 'ip6-kraken.digiebot.com/api/user'
        }

        let url1 = 'https://'+ip+'/getapiKeySecretKraken';

        // let url1 = 'http://35.153.9.225:3006/getapiKeySecretKraken';
        request.post({
            url: url1,
            json: {
                "user_id": user_id,
            },
            headers: {
                'content-type': 'application/json',
                'Token': 'vizzwebsolutions12345678910'
            }
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body, "get User API1");
                if(body.success){
                  resolve(body.api_key);
                } else {
                  resolve(false);
                }
            } else {
                resolve(false)
            }
        });

        // conn.then((db) => {
        //     let where = {};
        //     where['user_id'] = user_id;
        //     db.collection('kraken_credentials').find(where).toArray((err, result) => {
        //         if (err) {
        //             reject(err);
        //         } else {
        //             resolve(result);
        //         }
        //     })
        // })
    })
} //End of getKrakenCredentials
function getKrakenCredentials2(trading_ip, user_id) {
  return new Promise((resolve, reject) => {



    let ip = '';
    let port = 2500


    if(trading_ip == '3.227.143.115'){
      ip = 'ip1-kraken.digiebot.com/api/user'
    } else if(trading_ip == '3.228.180.22'){
      ip = 'ip2-kraken.digiebot.com/api/user'
    } else if(trading_ip == '3.226.226.217'){
      ip = 'ip3-kraken.digiebot.com/api/user'
    } else if(trading_ip == '3.228.245.92'){
      ip = 'ip4-kraken.digiebot.com/api/user'
    } else if(trading_ip == '35.153.9.225'){
      ip = 'ip5-kraken.digiebot.com/api/user'
    } else if(trading_ip == '54.157.102.20'){
      ip = 'ip6-kraken.digiebot.com/api/user'
    }

    let url2 = 'https://'+ip+'/getapiKeySecretKraken2';



      // let url2 = 'http://35.153.9.225:3006/getapiKeySecretKraken2';
      request.post({
          url: url2,
          json: {
              "user_id": user_id,
          },
          headers: {
            'content-type': 'application/json',
            'Token': 'vizzwebsolutions12345678910'
          }
      }, function (error, response, body) {
          if (!error && response.statusCode == 200) {
              console.log(body, "get User API2");
              if(body.success){
                resolve(body.api_key);
              } else {
                resolve(false);
              }
          } else {
              resolve(false)
          }
      });
  })
} //End of getKrakenCredentials
function getKrakenCredentials3(trading_ip, user_id) {
  return new Promise((resolve, reject) => {

    let ip = '';
    let port = 2500


    if(trading_ip == '3.227.143.115'){
      ip = 'ip1-kraken.digiebot.com/api/user'
    } else if(trading_ip == '3.228.180.22'){
      ip = 'ip2-kraken.digiebot.com/api/user'
    } else if(trading_ip == '3.226.226.217'){
      ip = 'ip3-kraken.digiebot.com/api/user'
    } else if(trading_ip == '3.228.245.92'){
      ip = 'ip4-kraken.digiebot.com/api/user'
    } else if(trading_ip == '35.153.9.225'){
      ip = 'ip5-kraken.digiebot.com/api/user'
    } else if(trading_ip == '54.157.102.20'){
      ip = 'ip6-kraken.digiebot.com/api/user'
    }

    let url3 = 'https://'+ip+'/getapiKeySecretKraken3';




      // let url3 = 'http://35.153.9.225:3006/getapiKeySecretKraken3';
      request.post({
          url: url3,
          json: {
              "user_id": user_id,
          },
          headers: {
            'content-type': 'application/json',
            'Token': 'vizzwebsolutions12345678910'
          }
      }, function (error, response, body) {
          if (!error && response.statusCode == 200) {
              console.log(body, "get User API3");
              if(body.success){
                resolve(body.api_key);
              } else {
                resolve(false);
              }
          } else {
              resolve(false)
          }
      });
  })
} //End of getKrakenCredentials


//post call for calculating average profit for order listing
router.post('/calculate_average_profit', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var soldOrderArr = await calculateAverageOrdersProfit(req.body.postData);
    var total_profit = 0;
    var total_quantity = 0;

    var profit_percentage_sum = 0;
    var total_trades = 0;

    // var totalBuyQty = 0
    // var totalSoldQty = 0

    for (let index in soldOrderArr) {

        var market_sold_price = (typeof soldOrderArr[index]['market_sold_price'] != 'undefined' && soldOrderArr[index]['market_sold_price'] != '') ? soldOrderArr[index]['market_sold_price'] : 0;

        let purchased_price = (typeof soldOrderArr[index]['purchased_price'] != 'undefined' && soldOrderArr[index]['purchased_price'] != '' ? soldOrderArr[index]['purchased_price'] : '')

        let market_val = (typeof soldOrderArr[index]['market_value'] != 'undefined' && soldOrderArr[index]['market_value'] != '' ? soldOrderArr[index]['market_value'] : '')

        var current_order_price = (purchased_price != '' ? purchased_price : market_val);
        current_order_price = (isNaN(parseFloat(current_order_price)) ? 0 : current_order_price);

        var quantity = (typeof soldOrderArr[index]['quantity'] == 'undefined') ? 0 : soldOrderArr[index]['quantity'];
        quantity = (isNaN(parseFloat(quantity)) ? 0 : quantity);

        if (req.body.postData.application_mode == 'test' && (isNaN(current_order_price) || isNaN(market_sold_price))) {
            continue
        }

        var percentage = calculate_percentage(current_order_price, market_sold_price);
        var total_btc = quantity * current_order_price;
        total_profit += total_btc * percentage;
        total_quantity += total_btc;

        profit_percentage_sum = parseFloat(profit_percentage_sum) + parseFloat(percentage)
        total_trades += 1

        // totalBuyQty += quantity * current_order_price
        // totalSoldQty += quantity * market_sold_price
        // console.log('pl: ', calculate_percentage(quantity * current_order_price, quantity * market_sold_price), ' --- buyQty ', quantity * current_order_price, ' --- soldQty: ', quantity * market_sold_price)

    }

    // console.log(totalBuyQty, totalSoldQty)

    let avg_per_trade = profit_percentage_sum / total_trades

    var avg_profit = total_profit / total_quantity;
    var responseReslt = {};
    responseReslt['avg_profit'] = avg_profit;
    resp.status(200).send({
        message: avg_profit,
        avg_per_trade: avg_per_trade
    });
})

//post call for validating bam credentials
router.post('/validate_bam_credentials', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    let APIKEY = req.body.APIKEY;
    let APISECRET = req.body.APISECRET;
    var credentials = await validate_bam_credentials(APIKEY, APISECRET);
    resp.status(200).send({
        message: credentials
    });
}) //End of validate_bam_credentials


function validate_bam_credentials(APIKEY, APISECRET, user_id = '') {

    APIKEY = APIKEY.trim()
    APISECRET = APISECRET.trim()

    return new Promise((resolve, reject) => {
        binance = require('node-binance-api')().options({
            APIKEY: APIKEY,
            APISECRET: APISECRET,
            useServerTime: true
        });
        binance.balance((error, balances) => {
            if (error) {


                //invalid Credentials
                let where = {
                    'api_key': APIKEY,
                    'api_secret': APISECRET
                }
                if (user_id != '') {
                    where['user_id'] = user_id
                }
                let set = {
                    '$set': {
                        'status': 'credentials_error'
                    }
                }
                conn.then(async (db) => {
                    await db.collection('bam_credentials').updateOne(where, set)
                })

                let message = {};
                message['status'] = 'error';
                message['message'] = error.body;
                resolve(message);
            } else {

                // console.log(' balances +++++++++++++++++++++++++++++++++++++++++++ ', balances)

                //valid Credentials
                let where = {
                    'api_key': APIKEY,
                    'api_secret': APISECRET
                }
                if (user_id != '') {
                    where['user_id'] = user_id
                }
                let set = {
                    '$set': {
                        'status': 'active'
                    }
                }
                conn.then(async (db) => {
                    await db.collection('bam_credentials').updateOne(where, set)
                })

                let updateWallet = update_user_balance(user_id)

                let message = {};
                message['status'] = 'success';
                message['message'] = balances;
                resolve(message);
            }
        });
    })
} //End of validate_bam_credentials

//post call for validating kraken credentials
router.post('/validate_kraken_credentials', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var auth_token = req.headers.authorization;
    let APIKEY = req.body.APIKEY;
    let user_id = req.payload.id;
    let trading_ip = req.body.trading_ip
    let exchange = req.body.exchange;
    let kraken_id = req.body.kraken_id;

    // var credentials = await validate_kraken_credentials(APIKEY, APISECRET, user_id);

    var credentials = await verify_user_info(APIKEY, trading_ip, user_id, exchange, kraken_id, auth_token);
    console.log(credentials, 'credentials')

    resp.status(200).send({
        message: credentials
    });
}) //End of validate_kraken_credentials

function validate_kraken_credentials(APIKEY, APISECRET, user_id = '') {
    return new Promise((resolve, reject) => {

        APIKEY = APIKEY != null && APIKEY != '' ? APIKEY.trim() : ''
        APISECRET = APISECRET != null && APISECRET != '' ? APISECRET.trim() : ''

        var options = {
            method: 'POST',
            url: 'http://35.153.9.225:3006/updateUserBalance',
            headers: {
                'cache-control': 'no-cache',
                'Connection': 'keep-alive',
                'Accept-Encoding': 'gzip, deflate',
                'Postman-Token': '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
                'Cache-Control': 'no-cache',
                'Accept': '*/*',
                'User-Agent': 'PostmanRuntime/7.20.1',
                'Content-Type': 'application/json'
            },
            json: {
                'validating': true,
                'user_id': user_id,
                'api_key': APIKEY,
                'api_secret': APISECRET,
            }
        };
        request(options, function (error, response, body) {
            // console.log(body)
            if (error) {
                let message = {};
                message['status'] = 'error';
                message['message'] = 'Something went wrong';
                resolve(message);
            } else {
                let message = {};
                message['status'] = (body['success'] == true || body['success'] == 'true'? 'success' : 'error');
                message['message'] = (body['success'] == true || body['success'] == 'true' ? 'Api key secret is valid' : 'Invalid Api key secret');
                resolve(message);
            }
        });

    })
} //End of validate_kraken_credentials

router.post('/update_user_wallet_kraken', auth_token.required, async (req, resp)=>{


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let user_id = req.body.user_id

    if (typeof user_id != 'undefined' && user_id != ''){

        //sleep 1 seconds before sending call next
        await new Promise(r => setTimeout(r, 1000));

        let status = await update_user_wallet_kraken(user_id)

        if (status){
            resp.send({
                'status': true,
                'message': 'Balance updated successfully'
            })
        }else{
            resp.send({
                'status': false,
                'message': 'something went wrong'
            })
        }
    }else{
        resp.send({
            'status':false,
            'message':'user_id is required'
        })
    }
})

async function update_user_wallet_kraken(user_id){

    return true;
    /*
    return new Promise(async resolve=>{

        const db = await conn

        let api_secret_arr = await db.collection('kraken_credentials').find({ 'user_id': user_id, 'api_key': { '$ne': '' }, 'api_secret':{ '$ne': '' }}).toArray()
        if (api_secret_arr.length > 0){


            let key = api_secret_arr[0]['api_key']
            let secret = api_secret_arr[0]['api_secret']

            console.log(key, secret)

            if(typeof key == 'undefined' || typeof secret == 'undefined'){
                resolve(false)
            }else{

                const KrakenClient = require('kraken-api');

                const kraken = new KrakenClient(key, secret);

                var balanceArr = await kraken.api('Balance');

                if (balanceArr['error'].length > 0){
                    console.log('Erorrrrrrrrrrrrrrrr::   user_id :: ', user_id)
                    console.log(balanceArr)
                    resolve(false)
                }else{

                    //update balance in collection
                    let wallet_collection = 'user_wallet_kraken'

                    if (typeof balanceArr['result'] == 'undefined' || typeof balanceArr['result'] == 'null' || (Object.keys(balanceArr['result']).length === 0 && balanceArr['result'].constructor === Object)){
                        resolve(false)
                    }else{

                        console.log('success ===  user_id :: ', user_id , ' ---- ', balanceArr)

                        for (const [key, value] of Object.entries(balanceArr['result'])) {
                            let symbol = key
                            // let currBalance = parseFloat(value)
                            let currBalance = value

                            // console.log(symbol, currBalance, typeof currBalance)

                            // let allCoins = [ 'ZUSD', 'XXBT', 'XXRP', 'XLTC', 'XXLM', 'XETH', 'XETC', 'XXMR', 'USDT', 'EOS', 'ADA', 'QTUM', 'LINK', 'TRX' ]

                            let changeCoinArr = [ 'XXBT', 'XXRP', 'XLTC', 'XXLM', 'XETH', 'XETC', 'XXMR', ]

                            if (changeCoinArr.includes(key)){
                                symbol = key == 'XXBT' ? 'BTC' : key.substring(1)
                            }

                            let where = {
                                'user_id': user_id,
                                'coin_symbol': symbol
                            }

                            let update = {
                                '$set':{
                                    'available': currBalance,
                                    'coin_balance': currBalance,
                                    'modified_date':new Date()
                                }
                            }

                            let upsert = {
                                'upsert': true
                            }

                            // console.log(symbol, currBalance, typeof currBalance)

                            await db.collection(wallet_collection).updateOne(where, update, upsert)

                        }
                        resolve(true)
                    }
                }
            }

        }else{
            resolve(true)
        }
    })
    */
}

//check error in sell for buy orders
router.post('/get_error_in_sell', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let order_id = req.body.order_id;
    let exchange = req.body.exchange;
    conn.then((db) => {

        let where = {};
        where['buy_order_id'] = {
            $in: [order_id, new ObjectID(order_id)]
        }
        where['status'] = {
            $in: ['error', 'LTH_ERROR', 'FILLED_ERROR', 'submitted_ERROR']
        }
        let update = {};
        update['status'] = 'new'

        let collection = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
        let set = {};
        set['$set'] = update;
        db.collection(collection).updateOne(where, set, async (err, result) => {
            if (err) {
                console.log(err)
                resp.status(200).send({
                    status: false,
                    message: 'Something went wrong'
                });
            } else {

                if (result['nModified'] > 0) {

                    // //create remove error log
                    // var log_msg = 'Order was updated And Removed Error ***';
                    // var getBuyOrder = await listOrderById(order_id, exchange);

                    // if (getBuyOrder.length > 0){
                    //     var order_created_date = getBuyOrder[0]['created_date']
                    //     var order_mode = getBuyOrder[0]['application_mode']
                    //     var promiseLog = create_orders_history_log(order_id, log_msg, 'remove_error', 'yes', exchange, order_mode, order_created_date)
                    //     promiseLog.then((callback) => { });
                    // }

                    resp.status(200).send({
                        status: true,
                        message: 'Error removed successfully',
                        result
                    });

                } else {
                    resp.status(200).send({
                        status: false,
                        message: 'Something went wrong'
                    });
                }

            }
        })
    })

}) //End of get_error_in_sell

//remove error from orders
router.post('/remove_error', auth_token.required, async (req, resp) => {

  var user_exist = await getUserByID(req.payload.id);
  // console.log(user_exist)
  if(!user_exist){
      resp.status(401).send({
          message: 'User Not exist'
      });
      return false;
  }

  let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
  let order_id = req.body.order_id;
  let exchange = req.body.exchange;
  conn.then(async (db) => {

      //delete sell order from ready_orders_for_sell_ip_based
      let ready_for_sell_collection = (exchange == 'binance') ? 'ready_orders_for_sell_ip_based' : 'ready_orders_for_sell_ip_based_' + exchange
      await db.collection(ready_for_sell_collection).deleteOne({ 'buy_order_id': { '$in': [order_id, new ObjectID(order_id)]}});

      //get buy order
      let buy_collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
      let sell_collection = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;

      let where = {
          '_id': {
              $in: [order_id, new ObjectID(order_id)]
          }
      }
      let buy_order = await db.collection(buy_collection).find(where).limit(1).toArray();
      if (buy_order.length > 0) {
          buy_order = buy_order[0]

          //find error in buy_order
          let buy_status = buy_order['status']
          let temp_buy_status_arr = buy_status.split('_')
          var error_type = '';

          var custom_unset = 0

          var update_buy_status = '';
          var buy_status_update = false

          if (buy_status == 'error') {

              custom_unset = 1
              update_buy_status = 'new'
              error_type = buy_status
          } else if (temp_buy_status_arr[0] == 'new') {

              //remove new error
              update_buy_status = 'canceled'
              error_type = temp_buy_status_arr.join(' ')

          } else if (temp_buy_status_arr[0] == 'buy' || temp_buy_status_arr[0] == 'BUY') {

              //remove buy error
              update_buy_status = 'canceled'
              error_type = temp_buy_status_arr.join(' ')

          } else if (temp_buy_status_arr[0] == 'FILLED' || temp_buy_status_arr[0] == 'LTH') {

              //remove FILLED or LTH error
              update_buy_status = 'FILLED'
              error_type = temp_buy_status_arr.join(' ')

          } else if (buy_status == 'KEYFILLED_ERROR' || buy_status == 'COIN_BAN_ERROR' || buy_status ==  'TEMPAPILOCK_ERROR' || buy_status == 'API_ERROR' || buy_status == 'APINONCE' || buy_status == 'API_NONCE' || buy_status =='APINONCE_ERROR') {
            //handle new types of error
            update_buy_status = 'FILLED'
            error_type = temp_buy_status_arr.join(' ')

            // console.log('error_type', update_buy_status, error_type)
          }else if (buy_status == 'FILLED_ERROR' || buy_status == 'submitted_ERROR' || buy_status == 'LTH_ERROR' || buy_status == 'new_ERROR') {
              let statusArr = buy_status.split('_');
              update_buy_status = statusArr[0];
              error_type = statusArr.join(' ');

              if(update_buy_status == 'new'){
                  custom_unset = 1
              }

          }else{
              update_buy_status = 'skip'
              //check if error exist in sell order status
          }

          if (update_buy_status != '') {

              //skip buy status update if error only exist in sell order
              if (update_buy_status != 'skip'){

                // console.log('Working')
                  let update = {}
                  let set1 = {}

                  //Calculate initial trail price
                  if (typeof buy_order['purchased_price'] != 'undefined' && buy_order['purchased_price'] != '' && typeof buy_order['custom_stop_loss_percentage'] != 'undefined' && buy_order['custom_stop_loss_percentage'] != ''){
                      var tt_purchased_price = parseFloat(buy_order['purchased_price'])
                      if (!isNaN(tt_purchased_price)) {
                          var tt_CSLP = parseFloat(parseFloat(buy_order['custom_stop_loss_percentage']).toFixed(1))
                          if (!isNaN(tt_CSLP)) {
                              var loss_price = (tt_purchased_price * tt_CSLP) / 100;
                              set1['iniatial_trail_stop'] = parseFloat(tt_purchased_price) - parseFloat(loss_price);
                              set1['custom_stop_loss_percentage'] = tt_CSLP;
                              set1['loss_percentage'] = tt_CSLP;
                              set1['custom_stop_loss_step'] = 0;
                          }
                      }
                  }

                  //remove error from buy_order
                  let where = {
                      '_id': new ObjectID(order_id)
                  }
                  set1['status'] = update_buy_status
                  set1['modified_date'] = new Date()

                  update['$set'] = set1
                  update['$unset'] = {
                      'is_lth_order':'',
                      'order_sell_process': ''
                  }

                  if (custom_unset === 1){
                      update['$unset']['sentforbuytoDigieiptrading'] = ''
                  }

                  let updated = await db.collection(buy_collection).updateOne(where, update)

                  if (update_buy_status == 'canceled'){
                      //Delete sell order
                      if (typeof buy_order['sell_order_id'] != 'undefined' && buy_order['sell_order_id'] != '') {
                          let where2 = {
                              '_id': new ObjectID(String(buy_order['sell_order_id']))
                          }
                          await db.collection(sell_collection).deleteOne(where2)
                      }

                      //set parent if exists
                      if (typeof buy_order['buy_parent_id'] != 'undefined' && buy_order['buy_parent_id'] != '') {
                          let where3 = {
                              '_id': new ObjectID(String(buy_order['buy_parent_id'])),
                              'pause_manually': { '$ne': 'yes' },
                              'status': { '$ne': 'canceled' },
                          }
                          let updObj3 = {};
                          updObj3['$set'] = {};
                          updObj3['$set']['status'] = 'new';
                          updObj3['$set']['pause_status'] = 'play';
                          updObj3['$set']['modified_date'] = new Date()
                          await db.collection(buy_collection).updateOne(where3, updObj3)
                      }
                  }

              }

              //remove error from sell_order
              if (typeof buy_order['sell_order_id'] != 'undefined') {

                  let update2 = {}
                  let set2 = {}

                  //Calculate initial trail price
                  if (typeof buy_order['purchased_price'] != 'undefined' && buy_order['purchased_price'] != '' && typeof buy_order['custom_stop_loss_percentage'] != 'undefined' && buy_order['custom_stop_loss_percentage'] != '') {
                      var tt_purchased_price = parseFloat(buy_order['purchased_price'])
                      if (!isNaN(tt_purchased_price)) {
                          var tt_CSLP = parseFloat(parseFloat(buy_order['custom_stop_loss_percentage']).toFixed(1))
                          if (!isNaN(tt_CSLP)) {
                              var loss_price = (tt_purchased_price * tt_CSLP) / 100;
                              set2['iniatial_trail_stop'] = parseFloat(tt_purchased_price) - parseFloat(loss_price);
                              set2['custom_stop_loss_percentage'] = tt_CSLP;
                              set2['loss_percentage'] = tt_CSLP;
                              set2['custom_stop_loss_step'] = 0;
                          }
                      }
                  }

                  let where2 = {
                      '_id': new ObjectID(String(buy_order['sell_order_id']))
                  }
                  set2['status'] = 'new'
                  set2['modified_date'] = new Date()
                  update2['$set'] = set2
                  let updated2 = await db.collection(sell_collection).updateOne(where2, update2)

                  await db.collection(buy_collection).updateOne({ '_id': new ObjectID(String(order_id)) }, { '$unset': { 'sentforselltoDigieiptrading': '','sell_opportunity_id':''} })

              }

              //create remove error log
              var log_msg = 'Order was updated And Removed ' + error_type + ' ' + interfaceType + ' ***';
              var promiseLog = create_orders_history_log(order_id, log_msg, 'remove_error', 'yes', exchange, buy_order['application_mode'], buy_order['created_date'])
              promiseLog.then((callback) => {});

              //Send Notification
              send_notification(buy_order['admin_id'], 'news_alerts', 'medium', log_msg, order_id, exchange, buy_order['symbol'], buy_order['application_mode'], '')

              resp.status(200).send({
                  status: true,
                  message: 'Error removed successfully',
              });
          } else {
              resp.status(200).send({
                  status: false,
                  message: 'Something went wrong'
              });
          }
      } else {
          resp.status(200).send({
              status: false,
              message: 'Something went wrong'
          });
      }

      // let where = {};
      // where['buy_order_id'] = { $in: [order_id, new ObjectID(order_id)] }
      // where['status'] = { $in: ['error', 'LTH_ERROR', 'FILLED_ERROR', 'submitted_ERROR'] }
      // let update = {};
      // update['status'] = 'new'

      // let collection = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
      // let set = {};
      // set['$set'] = update;
      // db.collection(collection).updateOne(where, set, async (err, result) => {
      //     if (err) {
      //         console.log(err)
      //         resp.status(200).send({
      //             status: false,
      //             message: 'Something went wrong'
      //         });
      //     } else {

      //         if (result['nModified'] > 0) {

      //             resp.status(200).send({
      //                 status: true,
      //                 message: 'Error removed successfully',
      //                 result
      //             });

      //         } else {
      //             resp.status(200).send({
      //                 status: false,
      //                 message: 'Something went wrong'
      //             });
      //         }

      //     }
      // })


  })

}) //End of remove_error



//chekc of order is in sell
function get_error_in_sell(order_id, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let where = {};
            where['order_id'] = (order_id == '') ? '' : new ObjectID(order_id);
            where['type'] = 'sell_error';
            var collection = (exchange == 'binance') ? 'orders_history_log' : 'orders_history_log_' + exchange;
            db.collection(collection).find(where).toArray((err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    var log_msg = '';
                    if (result.length > 0) {
                        log_msg = result[0]['log_msg'];
                    }
                    resolve(log_msg);
                }
            })
        })
    })
} //End of get_error_in_sell

//function for removing error in sell
router.post('/removeOrderManually', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    let order_id = req.body.order_id;
    let exchange = req.body.exchange;

    var show_hide_log = 'yes';
    var type = 'remove_error';
    var log_msg = 'Order was updated And Moved From Error To Open ***';
    // var promiseLog = recordOrderLog(order_id, log_msg, type, show_hide_log, exchange)
    var getBuyOrder = await listOrderById(order_id, exchange);
    var order_created_date = ((getBuyOrder.length > 0) ? getBuyOrder[0]['created_date'] : new Date())
    var order_mode = ((getBuyOrder.length > 0) ? getBuyOrder[0]['application_mode'] : 'test')
    var promiseLog = create_orders_history_log(order_id, log_msg, 'remove_error', 'yes', exchange, order_mode, order_created_date)
    promiseLog.then((callback) => {});




    /*
    @ Explode Status from here
    */
    var buyOrderStatus = getBuyOrder[0]['status'];
    var res = buyOrderStatus.split("_");
    var beforeStatus = res[0];


    var where_2 = {};
    where_2['_id'] = new ObjectID(order_id)
    var upsert = {
        'upsert': true
    };
    var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
    var upd = {};
    upd['modified_date'] = new Date();
    upd['status'] = beforeStatus;
    var updPromise_2 = updateSingle(collectionName, where_2, upd, upsert);
    updPromise_2.then((callback) => {});



    var where_3 = {};
    where_3['buy_order_id'] = {
        $in: [new ObjectId(order_id), order_id]
    }
    var upsert_2 = {
        'upsert': true
    };
    var collection = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
    var upd_2 = {};
    upd_2['status'] = 'new';
    var message = await updateSingle(collection, where_3, upd_2, upsert_2);
    resp.status(200).send({
        message: message
    });
}) //End of removeOrderManually

//validate user password for updting exchange credentials
router.post('/validate_user_password', auth_token.required, async (req, resp) => {
    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var password = req.body.user_password;
    password = password.trim();
    let md5Pass = md5(password);
    var user_id = req.body.user_id;
    var is_valid = await validate_user_password(user_id, md5Pass);
    resp.status(200).send({
        message: is_valid
    });
}) //End of validate_user_password

//validate user password for chaning api credentials
function validate_user_password(user_id, md5Pass) {
    return new Promise((resolve) => {
        var where = {};
        where._id = new ObjectID(user_id);
        where.password = md5Pass
        conn.then((db) => {
            db.collection('users').find(where).toArray((err, result) => {
                if (err) {
                    resolve(false);
                } else {
                    if (result.length > 0) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }
            })
        })
    })
} //End of validate_user_password


router.get('/delete_log', async (req, resp) => {
    var limit = 100;
    // for (var skip = 0; skip <100000; skip += 100) {
    // 	let log_arr = await list_logs(limit,skip);
    // 	var resp_obj = {};
    // 	for(let index in log_arr){
    // 		var order_id = log_arr[index]['order_id'];
    // 		var is_order_exist = await is_buy_order_exist(order_id);
    // 		if(!is_order_exist){
    // 			var del_arr = await delete_log(order_id);
    // 			console.log(del_arr)
    // 			//resp_obj[order_id] = del_arr;
    // 		}
    // 	}

    // }

    resp.status(200).send({
        message: limit
    });
}) //End of delete_log


function is_buy_order_exist(order_id) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let where = {};
            where['_id'] = order_id;
            db.collection('buy_orders').find(where).toArray((err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    var is_exist = false;
                    if (result.length > 0) {
                        is_exist = true;
                    }

                    resolve(is_exist);
                }
            })
        })
    })
} //End of is_buy_order_exist


function list_logs(limit, skip) {
    return new Promise((resolve) => {
        conn.then((db) => {
            db.collection('orders_history_log').find({}).limit(limit).skip(skip).toArray((err, result) => {
                if (err) {
                    console.log(err)
                } else {
                    resolve(result)
                }
            })
        })
    })

}



function delete_log(order_id) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let where = {};
            where['order_id'] = new ObjectID(order_id);
            db.collection('orders_history_log').deleteMany(where, (err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    resolve(result);
                }
            })
        })
    })

}


//post call for creating index for a key in a collections
router.post('/create_index', async (req, resp) => {
    var collection = req.body.collection;
    var index_obj = req.body.index_obj;
    var createIndexResp = await create_index(collection, index_obj);

    resp.status(200).send({
        message: createIndexResp
    });
}) //End of create_index

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

//get index of a collections
router.post('/get_index', async (req, resp) => {
    var collection = req.body.collection;
    var indexArr = await get_index(collection);
    resp.status(200).send({
        message: indexArr
    });
}) //End of get_index
//get index of a collection
function get_index(collection) {
    return new Promise((resolve) => {
        conn.then((db) => {
            db.collection(collection).getIndexes((err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of get_index

router.post('/testing', async (req, resp) => {
    var respArr = await delete_log_msg(req.body.from_dt, req.body.end_dt, );
    resp.status(200).send({
        message: respArr
    });
})

function delete_log_msg(from_dt, end_dt) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let start_date = new Date(from_dt);
            let end_date = new Date(end_dt);
            let where = {};
            where['created_date'] = {
                '$gte': start_date,
                '$lte': end_date
            }
            where['show_error_log'] = 'no';



            db.collection('orders_history_log').deleteMany(where, (err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    resolve(result)
                }
            })
        })
    })
}

router.post('/testing_count', async (req, resp) => {
    var respArr = await count_log_msg(req.body.from_dt, req.body.end_dt, );
    resp.status(200).send({
        message: respArr
    });
})



function count_log_msg(from_dt, end_dt) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let start_date = new Date(from_dt);
            let end_date = new Date(end_dt);
            let where = {};
            where['created_date'] = {
                '$gte': start_date,
                '$lte': end_date
            }
            where['show_error_log'] = 'no';
            db.collection('orders_history_log').count(where, (err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    resolve(result)
                }
            })
        })
    })
}


function listUserBalancebyCoin(admin_id, symbol, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let where = {};
            where['user_id'] = {
                $in: [new ObjectID(admin_id), admin_id]
            };
            where['coin_symbol'] = symbol;
            let collection = (exchange == 'binance') ? 'user_wallet' : 'user_wallet_' + exchange;
            db.collection(collection).find(where).toArray((err, result) => {
                if (err) {
                    resolve(err)
                } else {
                    resolve(result);
                }
            })
        })
    })
} //End of listUserBalancebyCoin

//function if bnb balance is enough
router.post('/is_bnb_balance_enough', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var admin_id = req.body.admin_id;
    var symbol = req.body.symbol;
    var exchange = req.body.exchange;
    //function for getting user balance
    var user_balance_arr = await listUserBalancebyCoin(admin_id, symbol, exchange);

    let globalCoin = (exchange == 'coinbasepro') ? 'BTCUSD' : 'BTCUSDT';
    //get market price for global coin
    var price_arr = await listCurrentMarketPrice(globalCoin, exchange);
    var current_usd_price = 0;
    if (price_arr.length > 0) {
        price_arr = price_arr[0];
        current_usd_price = (typeof price_arr['price'] == 'undefined') ? 0 : price_arr['price'];
    }
    var user_bnb_balance = 0;
    if (user_balance_arr.length > 0) {
        user_balance_arr = user_balance_arr[0];
        user_bnb_balance = (typeof user_balance_arr['coin_balance'] == 'undefined') ? 0 : user_balance_arr['coin_balance'];
    }

    var current_pr_arr = await listCurrentMarketPrice('BNBBTC', exchange);


    var market_price = 0;
    if (current_pr_arr.length > 0) {
        current_pr_arr = current_pr_arr[0];
        market_price = (typeof current_pr_arr['price'] == 'undefined') ? 0 : current_pr_arr['price'];
    }


    let btn_in_usd = (user_bnb_balance * market_price) * current_usd_price;
    resp.status(200).send({
        message: btn_in_usd
    });
})


router.post('/is_trading_points_exceeded', auth_token.required, async (req, resp) => {





    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }




    var auth_token = req.headers.authorization;

    const db = await conn
    var admin_id = req.body.user_id;

    var user = await db.collection('users').find({ '_id': new ObjectID(String(admin_id)) }).toArray()

    if (user.length > 0 && user[0]['trading_status'] == 'off') {

        let reqObj = {
            'type': 'POST',
            'url': 'https://app.digiebot.com/admin/Api_calls/get_user_current_trading_points',
            'headers':{
              'Authorization': auth_token
            },
            'payload': {
                'user_id' : admin_id
            },
        }
        let result = await customApiRequest(reqObj)
        let tradingPoints = result.status && result.body['status'] ? result.body['current_trading_points'] : 0

        resp.send({
            'status': true,
            'tradingPoints': tradingPoints
        });

    } else {
        resp.send({
            'status': false
        });
    }
})


function create_orders_history_log(order_id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date) {
    return new Promise((resolve, reject) => {
        conn.then((db) => {

            var created_date = new Date(order_created_date);
            var current_date = new Date('2019-12-27T11:04:21.912Z');
            if (created_date > current_date) {

                var collectionName = (exchange == 'binance') ? 'orders_history_log' : 'orders_history_log_' + exchange;
                var d = new Date(order_created_date);
                //create collection name on the base of date and mode
                var date_mode_string = '_' + order_mode + '_' + d.getFullYear() + '_' + d.getMonth();
                //create full name of collection
                var full_collection_name = collectionName + date_mode_string;
            } else {
                var full_collection_name = (exchange == 'binance') ? 'orders_history_log' : 'orders_history_log_' + exchange;
            }

            (async () => {
                //we check of collection is already created or not
                var collection_count = await is_collection_already_exist(full_collection_name);

                let insertArr = {};
                insertArr['order_id'] = new ObjectID(String(order_id));
                insertArr['log_msg'] = log_msg;
                insertArr['type'] = type;
                insertArr['show_error_log'] = show_hide_log;
                insertArr['created_date'] = new Date();

                db.collection(full_collection_name).insertOne(insertArr, (err, success) => {
                    if (err) {
                        reject(err)
                    } else {
                        if (collection_count == 0) {

                            var date_index = {
                                'created_date': -1
                            };
                            create_index(full_collection_name, date_index);

                            var order_index = {
                                'order_id': 1,
                            };
                            create_index(full_collection_name, order_index);

                            var order_index = {
                                'order_id': 1,
                                'type': 1,
                            };
                            create_index(full_collection_name, order_index);

                            resolve(true);
                        } else {
                            resolve(success.result)
                        }

                    }
                })

            })();
        })
    })
}

function is_collection_already_exist(collName) {
    return new Promise((resolve) => {
        conn.then((db) => {
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
}

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
}

function get_buy_order(order_id, exchange) {
    return new Promise((resolve, reject) => {
        let filter = {};
        filter['_id'] = new ObjectID(order_id);
        conn.then((db) => {
            let collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            db.collection(collection).find(filter).limit(1).toArray((err, result) => {
                if (err) {
                    resolve(err);
                } else {
                    if (result.length > 0) {
                        resolve(result[0]);
                    } else {
                        resolve(false);
                    }
                }
            }) //End of collection
        }) //End of conn
    }) //End of Promise
}

async function get_sell_order(order_id, exchange) {
    return new Promise(async (resolve, reject) => {
        let where = {};
        where['buy_order_id'] = {
            $in: [order_id, new ObjectID(order_id)]
        };
        conn.then(async (db) => {

            //try to find sell_order in orders
            var collection = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
            sell_order = await db.collection(collection).find(where).limit(1).toArray();
            if (sell_order.length > 0) {
                resolve([{
                    'collection': collection,
                    'sellArr': sell_order[0],
                }])
            } else {
                //try to find sell_order in temp_sell_orders
                collection = (exchange == 'binance') ? 'temp_sell_orders' : 'temp_sell_orders_' + exchange;
                sell_order = await db.collection(collection).find(where).limit(1).toArray();
                if (sell_order.length > 0) {
                    resolve([{
                        'collection': collection,
                        'sellArr': sell_order[0],
                    }])
                } else {
                    resolve([])
                }
            }

        }) //End of conn
    }) //End of Promise
}

router.post('/umer', async (req, resp) => {
    // let show_hide_log = 'yes';
    // let type = 'remove_error';
    // let created_date = new Date();
    // let oid = new ObjectID('5e05f0a9b55cc50019373fde');
    // $res = create_orders_history_log(oid, 'test 2222222222 ', 'remove_error', 'yes', 'binance', 'test', created_date);

    const forwarded = req.headers['x-forwarded-for']
    const ip = forwarded ? forwarded.split(/, /)[0] : req.connection.remoteAddress
    resp.send({
        'ips': req.ips,
        'ip': ip,
        'req_id': req.ip,
        'remoteAddress': req.connection.remoteAddress,
        'headers': req.headers,
    })
})
/**
 *
 * @param {username} "digiebot"
 * @param {password} "digiebot"
 * Helpers Functions
 */
function check(name, pass) {
    var valid = true

    // Simple method to prevent short-circut and use timing-safe compare
    valid = compare(name, 'digiebot') && valid
    valid = compare(pass, 'digiebot') && valid

    return valid
}

router.post('/get_order_levels', auth_token.required, async (req, resp) => {



    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    var filters = {};

    if(req.payload.id != "5c0915befc9aadaac61dd1b8" && req.payload.id !=="5c0912b7fc9aadaac61dd072")
    {
     filters.enable_status = 'global';
    }
    //console.log('hassan',req.payload.id,req.body);
    conn.then(async (db) => {
        levels = await db.collection('order_levels').find(filters).toArray();
        resp.status(200).send({
            'data': levels
        })
    }) //End of conn
})

router.post('/get_user_wallet', auth_token.required, async (req, resp) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }


    let admin_id = req.body.admin_id
    let exchange = req.body.exchange

    resp.status(200).send({
        'data': await get_user_wallet(admin_id, exchange)
    })

})

function get_user_wallet(admin_id, exchange) {
    return new Promise((resolve) => {
        conn.then(async (db) => {
            let where = {};
            where['user_id'] = {
                $in: [new ObjectID(admin_id), admin_id]
            };
            let collection = (exchange == 'binance') ? 'user_wallet' : 'user_wallet_' + exchange;
            let walletCoins = await db.collection(collection).find(where).toArray();

            let symbols = ['BNB'];
            if (walletCoins.length > 0) {
                walletCoins.forEach(function (item) {
                    let arr1 = item['coin_symbol'].split('BTC')
                    let arr2 = item['coin_symbol'].split('USDT')
                    let temp_symbol = '';
                    if ((arr1[0] == '' && arr1[1] == '') || (arr2[0] == '' && arr2[1] == '')) {
                        // symbols.push(item['coin_symbol'])
                        // console.log(' 1 ', item['coin_symbol'])
                        temp_symbol = item['coin_symbol']
                    } else if (arr1[1] == '') {
                        // symbols.push(arr1[0])
                        // console.log(' 2 ', arr1[0])
                        temp_symbol = arr1[0]
                    } else if (arr2[1] == '') {
                        // symbols.push(arr2[0])
                        // console.log(' 3 ', arr2[0])
                        temp_symbol = arr2[0]
                    }else{
                        // console.log(' 4 ', item['coin_symbol'])
                        temp_symbol = item['coin_symbol']
                    }

                    if (temp_symbol != '' && !symbols.includes(temp_symbol)){
                        symbols.push(temp_symbol)
                    }
                })
            }

            where['coin_symbol'] = {
                $in: symbols
            }
            let wallet2 = await db.collection(collection).find(where).toArray();
            resolve(wallet2);
        })
    })
}


router.post('/pause_sold_order', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    conn.then(async (db) => {

        let exchange = req.body.exchange
        let order_id = req.body.order_id

        if (typeof exchange == 'undefined' || exchange == '' || typeof order_id == 'undefined' || order_id == '') {
            res.send({
                'status': false,
                'message': 'order_id and exchange are required'
            });
        } else {
            let filter = {
                '_id': new ObjectID(order_id),
                'is_sell_order': 'sold'
            }

            let sold_collection = (exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange)

            let data1 = await db.collection(sold_collection).find(filter).limit(1).toArray();

            if (data1.length > 0) {
                obj = data1[0];


                var parent_fields = {}
                if (typeof obj['buy_parent_id'] != 'undefined') {
                    let parent_filter = {
                        '_id': new ObjectID(String(obj['buy_parent_id']))
                    }
                    let parent_order = await db.collection(sold_collection).find(parent_filter).limit(1).toArray();
                    if (parent_order.length > 0) {
                        parent_fields['parent_profit'] = parent_order[0]['defined_sell_percentage']
                        parent_fields['parent_custom_stop_loss'] = parent_order[0]['custom_stop_loss_percentage']
                        parent_fields['parent_LTH_profit'] = parent_order[0]['lth_profit']
                    } else {
                        parent_fields = {
                            'parent_profit': 1.2,
                            'parent_custom_stop_loss': 1,
                            'parent_LTH_profit': 1.2,
                        }
                    }
                }


                let set = {};
                set['$set'] = {
                    'is_sell_order': 'pause',
                    'modified_date': new Date()
                };
                let where = {
                    '_id': obj._id
                }


                // resume parent fields
                if (typeof parent_fields['parent_profit'] != 'undefined') {
                    set['$set']['parent_profit'] = parent_fields['parent_profit']
                }
                if (typeof parent_fields['parent_custom_stop_loss'] != 'undefined') {
                    set['$set']['parent_custom_stop_loss'] = parent_fields['parent_custom_stop_loss']
                }
                if (typeof parent_fields['parent_LTH_profit'] != 'undefined') {
                    set['$set']['parent_LTH_profit'] = parent_fields['parent_LTH_profit']
                }

                let update = db.collection(sold_collection).updateOne(where, set);

                // let pause_collection = (exchange == 'binance' ? 'pause_orders' : 'pause_orders_' + exchange)
                // let ins = await db.collection(pause_collection).insertOne(obj);

                let show_hide_log = 'yes';
                let type = 'pause_sold_order';
                let order_mode = obj.application_mode;
                let log_msg = 'Sold order paused manually.'
                var order_created_date = obj.created_date
                var promiseLog = create_orders_history_log(obj._id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                promiseLog.then((callback) => { })

                res.send({
                    'status': true,
                    'message': 'Order paused successfully'
                });
            } else {
                res.send({
                    'status': false,
                    'message': 'Something went wrong'
                });
            }
        }

    })
})
//End pause_sold_order

router.post('/pause_lth_order', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    conn.then(async (db) => {

        let exchange = req.body.exchange
        let order_id = req.body.order_id

        if (typeof exchange == 'undefined' || exchange == '' || typeof order_id == 'undefined' || order_id == '') {
            res.send({
                'status': false,
                'message': 'order_id and exchange are required'
            });
        } else {
            let filter = {
                '_id': new ObjectID(order_id)
            }

            let collection = (exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange)

            let data1 = await db.collection(collection).find(filter).limit(1).toArray();

            if (data1.length > 0) {
                obj = data1[0];

                let set = {};
                set['$set'] = {
                    'status': 'lth_pause',
                    'modified_date': new Date()
                };
                let where = {
                    '_id': obj._id
                }

                let update = db.collection(collection).updateOne(where, set);

                //Update Status in sell Orders also
                let sell_order_collection = (exchange == 'binance' ? 'orders' : 'orders_' + exchange)
                if (typeof obj.sell_order_id != 'undefined') {
                    update = db.collection(sell_order_collection).updateOne({
                        '_id': new ObjectID(String(obj.sell_order_id))
                    }, set);
                }
                // let pause_collection = (exchange == 'binance' ? 'pause_orders' : 'pause_orders_'+exchange)
                // let ins = await db.collection(pause_collection).insertOne(obj);

                let show_hide_log = 'yes';
                let type = 'pause_lth_order';
                let order_mode = obj.application_mode;
                let log_msg = 'LTH Order paused manually.'
                var order_created_date = obj.created_date
                var promiseLog = create_orders_history_log(obj._id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                promiseLog.then((callback) => { })

                res.send({
                    'status': true,
                    'message': 'Order paused successfully'
                });
            } else {
                res.send({
                    'status': false,
                    'message': 'Something went wrong'
                });
            }
        }

    })
})
//End pause_lth_order

router.post('/getUserbalance', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {
        let exchange = req.body.exchange
        let admin_id = req.body.user_id

        if (typeof exchange == 'undefined' || exchange == '' || typeof admin_id == 'undefined' || admin_id == '') {
            res.send({
                'status': false,
                'message': 'user_id and exchange are required'
            });
        } else {

            let userbalance = await get_user_wallet(admin_id, exchange);

            if (userbalance.length > 0) {
                res.send({
                    'status': true,
                    'balance': userbalance,
                    'message': 'Data found successfully'
                });
            } else {
                res.send({
                    'status': false,
                    'message': 'Something went wrong'
                });
            }
        }

    })
})
//End getUserbalance

router.post('/resume_order', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {
        let exchange = req.body.exchange
        let order_id = req.body.order_id

        if (typeof exchange == 'undefined' || exchange == '' || typeof order_id == 'undefined' || order_id == '') {
            res.send({
                'status': false,
                'message': 'order_id and exchange are required'
            });
        } else {
            let filter = {
                '_id': new ObjectID(order_id),
                'is_sell_order': 'pause'
            }

            let sold_collection = (exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange)

            let data1 = await db.collection(sold_collection).find(filter).limit(1).toArray();

            if (data1.length > 0) {
                obj = data1[0];

                let set = {};
                set['$set'] = {
                    'is_sell_order': 'resume_pause',
                    'modified_date': new Date()
                };
                let where = {
                    '_id': obj._id
                }


                if (await isMinQtyValid(obj.symbol, obj.quantity, exchange)){

                    let update = db.collection(sold_collection).updateOne(where, set);

                    // // let pause_collection = (exchange == 'binance' ? 'pause_orders' : 'pause_orders_'+exchange)
                    // // let ins = await db.collection(pause_collection).insertOne(obj);

                    let show_hide_log = 'yes';
                    let type = 'resume_order';
                    let order_mode = obj.application_mode;
                    let log_msg = 'Order resumed manually.'
                    var order_created_date = obj.created_date
                    var promiseLog = create_orders_history_log(obj._id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                    promiseLog.then((callback) => { })

                    res.send({
                        'status': true,
                        'message': 'Order resumed successfully'
                    });
                }else{
                    res.send({
                        'status': false,
                        'message': 'Order can not be resumed min quantity is not valid.'
                    });
                }
            } else {
                res.send({
                    'status': false,
                    'message': 'Something went wrong'
                });
            }
        }

    })
})
//End resume_order

router.post('/resume_order_minQty', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {
        let exchange = req.body.exchange
        let order_id = req.body.order_id
        let updateData = req.body.data

        if (typeof exchange == 'undefined' || exchange == '' || typeof order_id == 'undefined' || order_id == '') {
            res.send({
                'status': false,
                'message': 'order_id and exchange are required'
            });
        } else {

            if (typeof updateData['lth_pause_resume'] != 'undefined' && updateData['lth_pause_resume'] == 'yes'){
                let resumeCollectionName = exchange == 'binance' ? 'resume_buy_orders' : 'resume_buy_orders_'+exchange
                var buyCollectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_'+exchange

                if (typeof updateData['resumeOrderType'] != 'undefined' && updateData['resumeOrderType'] == 'lth_pause') {
                    buyCollectionName = exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange
                }

                let filter = {
                    '_id': new ObjectID(order_id),
                    // 'is_sell_order': 'pause'
                }

                let data1 = await db.collection(buyCollectionName).find(filter).limit(1).toArray();
                if (data1.length > 0) {
                    let obj = data1[0];

                    let resumeObj = obj;
                    resumeObj['buy_order_id'] = obj['_id']
                    resumeObj['buy_parent_id'] = obj['buy_parent_id']
                    delete resumeObj['_id']

                    if (typeof updateData['resumeOrderType'] != 'undefined' && updateData['lth_pause_resume'] == 'yes'){
                        resumeObj['status'] = 'resume'
                    }else{
                        resumeObj['status'] = 'resume_pending'
                    }

                    let insert = db.collection(resumeCollectionName).insertOne(resumeObj, async (err, result) => {
                        if (err) {
                            console.log(err)
                        } else {
                            let insert_id = result.insertedId

                            updateData['is_sell_order'] = 'resume_pause'
                            updateData['modified_date'] = new Date()
                            updateData['resume_date'] = typeof updateData['resume_date'] != 'undefined' && updateData['resume_date'] != '' ? new Date(updateData['resume_date']) : new Date()

                            var set = {};
                            set['$set'] = updateData
                            let where = {
                                '_id': insert_id
                            }
                            var update = db.collection(resumeCollectionName).updateOne(where, set);

                            var set = {};
                            set['$set'] = {
                                'resume_order_id': insert_id,
                            }

                            if (typeof updateData['resumeOrderType'] != 'undefined' && updateData['lth_pause_resume'] == 'yes') {
                                set['$set']['is_sell_order'] = 'resume_pause'
                                set['$set']['modified_date'] = new Date()
                            }

                            var update = db.collection(buyCollectionName).updateOne(filter, set)
                        }
                    })

                    let show_hide_log = 'yes';
                    let type = 'resume_order';
                    let order_mode = obj.application_mode;
                    let log_msg = 'Order paused from LTH manually.'
                    var order_created_date = obj.created_date
                    var promiseLog = create_orders_history_log(obj._id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                    promiseLog.then((callback) => { })

                    res.send({
                        'status': true,
                        'message': 'Order paused successfully'
                    });
                }
            }else{

                if (typeof updateData['resumeOrderType'] != 'undefined' && updateData['resumeOrderType'] == 'lth'){
                    let resumeCollectionName = exchange == 'binance' ? 'resume_buy_orders' : 'resume_buy_orders_' + exchange
                    var buyCollectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange

                    let filter = {
                        '_id': new ObjectID(order_id),
                        // 'is_sell_order': 'pause'
                    }

                    let data1 = await db.collection(buyCollectionName).find(filter).limit(1).toArray();
                    if (data1.length > 0) {
                        let obj = data1[0];

                        let resumeObj = obj;
                        resumeObj['buy_order_id'] = obj['_id']
                        resumeObj['buy_parent_id'] = obj['buy_parent_id']
                        delete resumeObj['_id']
                        resumeObj['status'] = 'resume_pending'

                        let insert = db.collection(resumeCollectionName).insertOne(resumeObj, async (err, result) => {
                            if (err) {
                                console.log(err)
                            } else {
                                let insert_id = result.insertedId

                                updateData['is_sell_order'] = 'resume_pause'
                                updateData['modified_date'] = new Date()
                                updateData['resume_date'] = typeof updateData['resume_date'] != 'undefined' && updateData['resume_date'] != '' ? new Date(updateData['resume_date']) : new Date()

                                var set = {};
                                set['$set'] = updateData
                                let where = {
                                    '_id': insert_id
                                }
                                var update = db.collection(resumeCollectionName).updateOne(where, set);

                                var set = {};
                                set['$set'] = {
                                    'resume_order_id': insert_id,
                                }

                                if (typeof updateData['resumeOrderType'] != 'undefined' && updateData['lth_pause_resume'] == 'yes') {
                                    set['$set']['is_sell_order'] = 'resume_pause'
                                    set['$set']['modified_date'] = new Date()
                                }

                                var update = db.collection(buyCollectionName).updateOne(filter, set)
                            }
                        })

                        let show_hide_log = 'yes';
                        let type = 'resume_order';
                        let order_mode = obj.application_mode;
                        let log_msg = 'Order paused from LTH manually.'
                        var order_created_date = obj.created_date
                        var promiseLog = create_orders_history_log(obj._id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                        promiseLog.then((callback) => { })

                        res.send({
                            'status': true,
                            'message': 'Order paused successfully'
                        });
                    }else{
                        res.send({
                            'status': false,
                            'message': 'Something went wrong'
                        });
                    }
                } else if (typeof updateData['resumeOrderType'] != 'undefined' && updateData['resumeOrderType'] == 'lth_pause'){

                    let filter = {
                        '_id': new ObjectID(order_id),
                        'is_sell_order': 'pause'
                    }

                    let sold_collection = (exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange)

                    let data1 = await db.collection(sold_collection).find(filter).limit(1).toArray();

                    if (data1.length > 0) {
                        obj = data1[0];

                        updateData['is_sell_order'] = 'resume_pause'
                        updateData['modified_date'] = new Date()
                        updateData['resume_date'] = typeof updateData['resume_date'] != 'undefined' && updateData['resume_date'] != '' ? new Date(updateData['resume_date']) : new Date()

                        let set = {};
                        set['$set'] = updateData

                        // set['$set'] = {
                        //     'is_sell_order': 'resume_pause',
                        //     'modified_date': new Date()
                        // };
                        let where = {
                            '_id': obj._id
                        }

                        let update = db.collection(sold_collection).updateOne(where, set);

                        // // let pause_collection = (exchange == 'binance' ? 'pause_orders' : 'pause_orders_'+exchange)
                        // // let ins = await db.collection(pause_collection).insertOne(obj);

                        let show_hide_log = 'yes';
                        let type = 'resume_order';
                        let order_mode = obj.application_mode;
                        let log_msg = 'Order resumed manually.'
                        var order_created_date = obj.created_date
                        var promiseLog = create_orders_history_log(obj._id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                        promiseLog.then((callback) => { })

                        res.send({
                            'status': true,
                            'message': 'Order resumed successfully'
                        });
                    } else {
                        res.send({
                            'status': false,
                            'message': 'Something went wrong'
                        });
                    }
                }else{
                    res.send({
                        'status': false,
                        'message': 'Something went wrong'
                    });
                }

            }
        }

    })
})
//End resume_order_minQty


// ******************* Resume / Pause APIs **************** //

router.post('/resume_order_test', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {
        let exchange = req.body.exchange
        let order_id = req.body.order_id
        let updateArr = req.body.order

        if (typeof exchange == 'undefined' || exchange == '' || typeof order_id == 'undefined' || order_id == '') {
            res.send({
                'status': false,
                'message': 'order_id and exchange are required'
            });
        } else {
            let filter = {
                '_id': new ObjectID(order_id),
                'is_sell_order': 'pause'
            }

            let sold_collection = (exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange)

            let data1 = await db.collection(sold_collection).find(filter).limit(1).toArray();

            if (data1.length > 0) {
                let obj = data1[0];

                let tempOrder = Object.assign({}, obj)

                //update new edit fields
                var count = 0;
                var i;
                for (i in updateArr) {
                    if (updateArr.hasOwnProperty(i)) {
                        count++;
                    }
                }
                if (count > 0) {
                    for (let [key, value] of Object.entries(updateArr)) {
                        tempOrder[key] = value;
                    }
                }

                //Save only resumeFileds Arr keys in resume order
                let resumeFieldsArr = [
                    "_id",
                    "admin_id",
                    "application_mode",
                    "buy_parent_id",
                    "custom_stop_loss_percentage",
                    "defined_sell_percentage",
                    "iniatial_trail_stop",
                    "is_lth_order",
                    "lth_functionality",
                    "lth_profit",
                    "market_sold_price",
                    "market_value",
                    "opportunityId",
                    "order_level",
                    "order_mode",
                    "price",
                    "purchased_price",
                    "quantity",
                    "sell_date",
                    "sell_order_id",
                    "sell_price",
                    "sell_profit_percent",
                    "status",
                    "stop_loss_rule",
                    "symbol",
                    "trading_ip",
                    "trigger_type",
                    "stop_loss",
                    "loss_percentage",
                    "resume_date",
                    "sold_buy_order_id",
                    "resume_order_arr",
                    "direct_resume",
                ]
                var resumeCount = 0;
                var resumeI;
                for (resumeI in tempOrder) {
                    if (tempOrder.hasOwnProperty(resumeI)) {
                        resumeCount++;
                    }
                }
                if (resumeCount > 0) {
                    for (let [key, value] of Object.entries(tempOrder)) {
                        if (!resumeFieldsArr.includes(key)) {
                            delete tempOrder[key]
                        }
                    }
                }

                tempOrder['modified_date'] = new Date()
                tempOrder['resume_date'] = new Date()
                tempOrder['status'] = 'resume'
                tempOrder['sold_buy_order_id'] = obj['_id']
                tempOrder['last_buy_order_id'] = obj['_id']
                delete tempOrder['_id']

                if (typeof tempOrder['direct_resume'] != 'undefined' && tempOrder['direct_resume'] == 'yes') {
                    tempOrder['order_level'] = 'direct_resume'
                }

                let resumeCollectionName = exchange == 'binance' ? 'resume_buy_orders' : 'resume_buy_orders_' + exchange
                let insert = db.collection(resumeCollectionName).insertOne(tempOrder, async (err, result) => {
                    if (err) {
                        console.log(err)
                    } else {

                        //don't update following fields in sold collection from resume
                        let fields_not_update_in_sold_collection = [
                            'stop_loss_rule',
                            'custom_stop_loss_percentage',
                            'stop_loss',
                            'loss_percentage',
                        ]

                        //insert resume id in sold collection order
                        let insert_id = result.insertedId
                        var set = {};

                        let updArr = {}

                        var count = 0;
                        var i;
                        for (i in updateArr) {
                            if (updateArr.hasOwnProperty(i)) {
                                count++;
                            }
                        }
                        if (count > 0) {
                            for (let [key, value] of Object.entries(updateArr)) {
                                if (!fields_not_update_in_sold_collection.includes(key)){
                                    updArr[key] = value;
                                }
                            }
                        }

                        updArr['resume_order_id'] = insert_id
                        updArr['is_sell_order'] = 'resume_pause'
                        updArr['modified_date'] = new Date()

                        if (typeof tempOrder['direct_resume'] != 'undefined' && tempOrder['direct_resume'] == 'yes') {
                            updArr['order_level'] = 'direct_resume'
                        }

                        set['$set'] = updArr
                        var update = db.collection(sold_collection).updateOne(filter, set)
                    }
                })

                let if_direct_resume = (typeof tempOrder['direct_resume'] != 'undefined' && tempOrder['direct_resume'] == 'yes') ? ' using Direct Resume' : ''

                let show_hide_log = 'yes';
                let type = 'resume_order';
                let order_mode = obj.application_mode;
                let log_msg = 'Order resumed manually ' + if_direct_resume
                var order_created_date = obj.created_date
                var promiseLog = create_orders_history_log(obj._id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                promiseLog.then((callback) => { })

                res.send({
                    'status': true,
                    'message': 'Order resumed successfully'
                });
            } else {
                res.send({
                    'status': false,
                    'message': 'Something went wrong'
                });
            }
        }

    })
})
//End resume_order

router.post('/resume_already_paused_test', auth_token.required, async (req, res) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {
        let exchange = req.body.exchange
        let order_id = req.body.order_id
        let updateArr = req.body.order

        if (typeof exchange == 'undefined' || exchange == '' || typeof order_id == 'undefined' || order_id == '') {
            res.send({
                'status': false,
                'message': 'order_id and exchange are required'
            });
        } else {
            let filter = {
                '_id': new ObjectID(order_id),
            }

            let sold_collection = (exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange)

            let data1 = await db.collection(sold_collection).find(filter).limit(1).toArray();

            if (data1.length > 0) {
                let obj = data1[0];

                let tempOrder = Object.assign({}, obj)

                //update new edit fields
                var count = 0;
                var i;
                for (i in updateArr) {
                    if (updateArr.hasOwnProperty(i)) {
                        count++;
                    }
                }
                if (count > 0) {
                    for (let [key, value] of Object.entries(updateArr)) {
                        tempOrder[key] = value;
                    }
                }

                //Save only resumeFileds Arr keys in resume order
                let resumeFieldsArr = [
                    "_id",
                    "admin_id",
                    "application_mode",
                    "buy_parent_id",
                    "custom_stop_loss_percentage",
                    "defined_sell_percentage",
                    "iniatial_trail_stop",
                    "is_lth_order",
                    "lth_functionality",
                    "lth_profit",
                    "market_sold_price",
                    "market_value",
                    "opportunityId",
                    "order_level",
                    "order_mode",
                    "price",
                    "purchased_price",
                    "quantity",
                    "sell_date",
                    "sell_order_id",
                    "sell_price",
                    "sell_profit_percent",
                    "status",
                    "stop_loss_rule",
                    "symbol",
                    "trading_ip",
                    "trigger_type",
                    "stop_loss",
                    "loss_percentage",
                    "resume_date",
                    "sold_buy_order_id",
                    "resume_order_arr",
                    "direct_resume",
                ]
                var resumeCount = 0;
                var resumeI;
                for (resumeI in tempOrder) {
                    if (tempOrder.hasOwnProperty(resumeI)) {
                        resumeCount++;
                    }
                }
                if (resumeCount > 0) {
                    for (let [key, value] of Object.entries(tempOrder)) {
                        if (!resumeFieldsArr.includes(key)) {
                            delete tempOrder[key]
                        }
                    }
                }

                tempOrder['modified_date'] = new Date()
                // tempOrder['resume_date'] = new Date()
                tempOrder['status'] = 'resume'
                delete tempOrder['_id']

                if (typeof tempOrder['direct_resume'] != 'undefined' && tempOrder['direct_resume'] == 'yes') {
                    tempOrder['order_level'] = 'direct_resume'
                }

                let resumeCollectionName = exchange == 'binance' ? 'resume_buy_orders' : 'resume_buy_orders_' + exchange
                let insert = db.collection(resumeCollectionName).updateOne({'_id':obj['resume_order_id']}, {'$set':tempOrder}, async (err, result) => {
                    if (err) {
                        console.log(err)
                    } else {

                        //don't update following fields in sold collection from resume
                        let fields_not_update_in_sold_collection = [
                            'stop_loss_rule',
                            'custom_stop_loss_percentage',
                            'stop_loss',
                            'loss_percentage',
                        ]

                        var set = {};
                        let updArr = {}
                        var count = 0;
                        var i;
                        for (i in updateArr) {
                            if (updateArr.hasOwnProperty(i)) {
                                count++;
                            }
                        }
                        if (count > 0) {
                            for (let [key, value] of Object.entries(updateArr)) {
                                if (!fields_not_update_in_sold_collection.includes(key)){
                                    updArr[key] = value;
                                }
                            }
                        }

                        if (typeof tempOrder['direct_resume'] != 'undefined' && tempOrder['direct_resume'] == 'yes') {
                            updArr['order_level'] = 'direct_resume'
                        }

                        updArr['status'] = 'FILLED'
                        updArr['modified_date'] = new Date()

                        set['$set'] = updArr
                        var update = db.collection(sold_collection).updateOne(filter, set)
                    }
                })

                let if_direct_resume = (typeof tempOrder['direct_resume'] != 'undefined' && tempOrder['direct_resume'] == 'yes') ? ' using Direct Resume' : ''

                let show_hide_log = 'yes';
                let type = 'resume_continue';
                let order_mode = obj.application_mode;
                let log_msg = 'Paused order was resumed again manually ' + if_direct_resume
                var order_created_date = obj.created_date
                var promiseLog = create_orders_history_log(obj._id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)

                if (typeof obj['order_level'] != 'undefined' && typeof tempOrder['order_level'] != 'undefined' && obj['order_level'] != tempOrder['order_level']){
                    let msg22 = 'Order level was updated from ' + obj['order_level'] + ' to ' + tempOrder['order_level']
                    create_orders_history_log(obj._id, msg22, type, show_hide_log, exchange, order_mode, order_created_date)
                }

                res.send({
                    'status': true,
                    'message': 'Order is resumed successfully'
                });
            } else {
                res.send({
                    'status': false,
                    'message': 'Something went wrong'
                });
            }
        }

    })
})
//End resume_already_paused_test

router.post('/pause_lth_order_test', auth_token.required, async (req, res) => {
    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {
        let exchange = req.body.exchange
        let order_id = req.body.order_id
        let updateArr = req.body.order

        if (typeof exchange == 'undefined' || exchange == '' || typeof order_id == 'undefined' || order_id == '') {
            res.send({
                'status': false,
                'message': 'order_id and exchange are required'
            });
        } else {
            let filter = {
                '_id': new ObjectID(order_id)
            }

            let buy_collection = (exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange)

            let data1 = await db.collection(buy_collection).find(filter).limit(1).toArray();

            if (data1.length > 0) {
                let obj = data1[0];

                let tempOrder = Object.assign({}, obj)

                //update new edit fields
                var count = 0;
                var i;
                for (i in updateArr) {
                    if (updateArr.hasOwnProperty(i)) {
                        count++;
                    }
                }
                if (count > 0) {
                    for (let [key, value] of Object.entries(updateArr)) {
                        tempOrder[key] = value;
                    }
                }

                //Save only resumeFileds Arr keys in resume order
                let resumeFieldsArr = [
                    "_id",
                    "admin_id",
                    "application_mode",
                    "buy_parent_id",
                    "custom_stop_loss_percentage",
                    "defined_sell_percentage",
                    "iniatial_trail_stop",
                    "is_lth_order",
                    "lth_functionality",
                    "lth_profit",
                    "market_sold_price",
                    "market_value",
                    "opportunityId",
                    "order_level",
                    "order_mode",
                    "price",
                    "purchased_price",
                    "quantity",
                    "sell_date",
                    "sell_order_id",
                    "sell_price",
                    "sell_profit_percent",
                    "status",
                    "stop_loss_rule",
                    "symbol",
                    "trading_ip",
                    "trigger_type",
                    "stop_loss",
                    "loss_percentage",
                    "resume_date",
                    "sold_buy_order_id",
                    "resume_order_arr",
                    "direct_resume",
                ]
                var resumeCount = 0;
                var resumeI;
                for (resumeI in tempOrder) {
                    if (tempOrder.hasOwnProperty(resumeI)) {
                        resumeCount++;
                    }
                }
                if (resumeCount > 0) {
                    for (let [key, value] of Object.entries(tempOrder)) {
                        if (!resumeFieldsArr.includes(key)) {
                            delete tempOrder[key]
                        }
                    }
                }

                tempOrder['modified_date'] = new Date()
                tempOrder['resume_date'] = new Date()
                tempOrder['status'] = 'resume_pending'
                tempOrder['buy_order_id'] = obj['_id']
                delete tempOrder['_id']
                let resumeCollectionName = exchange == 'binance' ? 'resume_buy_orders' : 'resume_buy_orders_' + exchange
                let insert = db.collection(resumeCollectionName).insertOne(tempOrder, async (err, result) => {
                    if (err) {
                        console.log(err)
                    } else {
                        //insert resume id in sold collection order
                        let insert_id = result.insertedId

                        let updArr = {}
                        var count = 0;
                        var i;
                        for (i in updateArr) {
                            if (updateArr.hasOwnProperty(i)) {
                                count++;
                            }
                        }
                        if (count > 0) {
                            for (let [key, value] of Object.entries(updateArr)) {
                                updArr[key] = value;
                            }
                        }
                        updArr['resume_order_id'] = insert_id
                        updArr['status'] = 'lth_pause'
                        updArr['is_sell_order'] = 'pause'
                        updArr['modified_date'] = new Date()

                        var set = {};
                        set['$set'] = updArr
                        var update = db.collection(buy_collection).updateOne(filter, set)
                    }
                })

                let show_hide_log = 'yes';
                let type = 'resume_order';
                let order_mode = obj.application_mode;
                let log_msg = 'Order paused manually from LTH.'
                var order_created_date = obj.created_date
                var promiseLog = create_orders_history_log(obj._id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                promiseLog.then((callback) => { })

                res.send({
                    'status': true,
                    'message': 'Order paused successfully'
                });
            } else {
                res.send({
                    'status': false,
                    'message': 'Something went wrong'
                });
            }
        }

    })
})
//End pause_lth_order_test

router.post('/pause_sold_order_test', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {
        let exchange = req.body.exchange
        let order_id = req.body.order_id
        let updateArr = req.body.order

        if (typeof exchange == 'undefined' || exchange == '' || typeof order_id == 'undefined' || order_id == '') {
            res.send({
                'status': false,
                'message': 'order_id and exchange are required'
            });
        } else {
            let filter = {
                '_id': new ObjectID(order_id)
            }

            let sold_collection = (exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange)

            let data1 = await db.collection(sold_collection).find(filter).limit(1).toArray();

            if (data1.length > 0) {
                let obj = data1[0];
                let tempOrder = Object.assign({}, obj)

                //Update new edit fields
                var count = 0;
                var i;
                for (i in updateArr) {
                    if (updateArr.hasOwnProperty(i)) {
                        count++;
                    }
                }
                if (count > 0) {
                    for (let [key, value] of Object.entries(updateArr)) {
                        tempOrder[key] = value;
                    }
                }

                //Save only resumeFileds Arr keys in resume order
                let resumeFieldsArr = [
                    "_id",
                    "admin_id",
                    "application_mode",
                    "buy_parent_id",
                    "custom_stop_loss_percentage",
                    "defined_sell_percentage",
                    "iniatial_trail_stop",
                    "is_lth_order",
                    "lth_functionality",
                    "lth_profit",
                    "market_sold_price",
                    "market_value",
                    "opportunityId",
                    "order_level",
                    "order_mode",
                    "price",
                    "purchased_price",
                    "quantity",
                    "sell_date",
                    "sell_order_id",
                    "sell_price",
                    "sell_profit_percent",
                    "status",
                    "stop_loss_rule",
                    "symbol",
                    "trading_ip",
                    "trigger_type",
                    "stop_loss",
                    "loss_percentage",
                    "resume_date",
                    "sold_buy_order_id",
                    "resume_order_arr",
                    "direct_resume",
                ]
                var resumeCount = 0;
                var resumeI;
                for (resumeI in tempOrder) {
                    if (tempOrder.hasOwnProperty(resumeI)) {
                        resumeCount++;
                    }
                }
                if (resumeCount > 0) {
                    for (let [key, value] of Object.entries(tempOrder)) {
                        if (!resumeFieldsArr.includes(key)) {
                            delete tempOrder[key]
                        }
                    }
                }

                tempOrder['modified_date'] = new Date()
                tempOrder['resume_date'] = new Date()
                tempOrder['status'] = 'resume'
                tempOrder['sold_buy_order_id'] = obj['_id']
                tempOrder['last_buy_order_id'] = obj['_id']
                delete tempOrder['_id']

                if (typeof tempOrder['direct_resume'] != 'undefined' && tempOrder['direct_resume'] == 'yes') {
                    tempOrder['order_level'] = 'direct_resume'
                }

                let resumeCollectionName = exchange == 'binance' ? 'resume_buy_orders' : 'resume_buy_orders_' + exchange
                let insert = db.collection(resumeCollectionName).insertOne(tempOrder, async (err, result) => {
                    if (err) {
                        console.log(err)
                    } else {
                        //insert resume id in sold collection order
                        let insert_id = result.insertedId


                        let updArr = {}
                        var count = 0;
                        var i;
                        for (i in updateArr) {
                            if (updateArr.hasOwnProperty(i)) {
                                count++;
                            }
                        }
                        if (count > 0) {
                            for (let [key, value] of Object.entries(updateArr)) {
                                updArr[key] = value;
                            }
                        }

                        updArr['resume_order_id'] = insert_id
                        updArr['is_sell_order'] = 'pause'
                        updArr['resume_status'] = 'resume'
                        updArr['is_sell_order'] = 'resume_pause'
                        updArr['modified_date'] = new Date()

                        var set = {};
                        set['$set'] = updArr
                        var update = db.collection(sold_collection).updateOne(filter, set)
                    }
                })

                let if_direct_resume = (typeof tempOrder['direct_resume'] != 'undefined' && tempOrder['direct_resume'] == 'yes') ? ' using Direct Resume' : ''

                let show_hide_log = 'yes';
                let type = 'resume_order';
                let order_mode = obj.application_mode;
                let log_msg = 'Order paused manually from Sold tab ' + if_direct_resume
                var order_created_date = obj.created_date
                var promiseLog = create_orders_history_log(obj._id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                promiseLog.then((callback) => { })

                res.send({
                    'status': true,
                    'message': 'Order paused successfully'
                });
            } else {
                res.send({
                    'status': false,
                    'message': 'Something went wrong'
                });
            }
        }

    })
})
//End pause_sold_order_test

router.post('/genral_order_update', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {
        let exchange = req.body.exchange
        let order_id = req.body.order_id
        let updateArr = req.body.order

        if (typeof exchange == 'undefined' || exchange == '' || typeof order_id == 'undefined' || order_id == '') {
            res.send({
                'status': false,
                'message': 'order_id and exchange are required'
            });
        } else {
            let filter = {
                '_id': new ObjectID(order_id)
            }
            let sold_collection = (exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange)
            let data1 = await db.collection(sold_collection).find(filter).limit(1).toArray();

            if (data1.length > 0) {
                let updateStatus = false

                let obj = data1[0];

                // console.log(obj['resume_order_id'])
                if (typeof obj['resume_order_id'] != 'undefined' && obj['resume_order_id'] != ''){
                    let where = {
                        '_id': obj['resume_order_id']
                    }
                    let set = {
                        '$set':updateArr
                    }
                    if (typeof updateArr['direct_resume'] != 'undefined' && updateArr['direct_resume'] == 'yes'){
                        set['$set']['order_level'] = 'direct_resume'
                    }
                    let resumeCollectionName = exchange == 'binance' ? 'resume_buy_orders' : 'resume_buy_orders_' + exchange
                    let update = db.collection(resumeCollectionName).updateOne(where, set, async (err, result) => {
                        if (err) {
                            updateStatus = false

                            res.send({
                                'status': updateStatus,
                                'message': updateStatus == true ? 'Order Updated successfully' : 'Unable to Update'
                            });

                        } else {

                            //update in sold collection too for user satsfaction
                            db.collection(sold_collection).updateOne({ '_id': new ObjectID(order_id) }, { '$set': { 'secondary_resume_level': updateArr['order_level']}})

                            updateStatus = true
                            let show_hide_log = 'yes';
                            let type = 'lth_pause_order_update';
                            let order_mode = obj['application_mode'];
                            let log_msg = 'Order updated from LTH pause tab manually'
                            var order_created_date = obj['created_date']
                            var promiseLog = create_orders_history_log(obj['_id'], log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                            promiseLog.then((callback) => { })

                            res.send({
                                'status': updateStatus,
                                'message': updateStatus == true ? 'Order Updated successfully' : 'Unable to Update'
                            });

                        }
                    })
                }else{
                    res.send({
                        'status': updateStatus,
                        'message': updateStatus == true ? 'Order Updated successfully' : 'Unable to Update'
                    });
                }


            } else {
                res.send({
                    'status': false,
                    'message': 'Something went wrong'
                });
            }
        }

    })
})
//End genral_order_update


router.post('/pauseAlreadyResumedOrder', auth_token.required, async (req, res) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {
        let exchange = req.body.exchange
        let order_id = req.body.order_id

        if (typeof exchange == 'undefined' || exchange == '' || typeof order_id == 'undefined' || order_id == '') {
            res.send({
                'status': false,
                'message': 'order_id and exchange are required'
            });
        } else {

            let filter = {
                '_id': new ObjectID(order_id),
            }

            let sold_collection = (exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange)
            let data1 = await db.collection(sold_collection).find(filter).limit(1).toArray();

            if (data1.length > 0) {
                let obj = data1[0];

                let updateArr = {
                    '$set': {
                        'modified_date': new Date(),
                        'status': 'pause',
                        'direct_resume': 'no',
                    }
                }
                let resumeCollectionName = exchange == 'binance' ? 'resume_buy_orders' : 'resume_buy_orders_' + exchange
                let update = db.collection(resumeCollectionName).updateOne({'_id': obj.resume_order_id}, updateArr, async (err, result) => {
                    if (err) {
                        console.log(err)
                    } else {
                        let set = {
                            '$set': {
                                'modified_date': new Date(),
                                'status': 'pause',
                            }
                        }
                        let update = db.collection(sold_collection).updateOne({'_id': obj._id}, set)
                    }
                })

                let show_hide_log = 'yes';
                let type = 'resume_stop';
                let order_mode = obj.application_mode;
                let log_msg = 'Resumed order was stopped manually'
                var order_created_date = obj.created_date
                var promiseLog = create_orders_history_log(obj._id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                promiseLog.then((callback) => { })

                res.send({
                    'status': true,
                    'message': 'Resumed order stopped successfully'
                });
            } else {
                res.send({
                    'status': false,
                    'message': 'Something went wrong'
                });
            }
        }

    })
})
//End pauseAlreadyResumedOrder

router.post('/resumeAlreadyPausedOrder', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {
        let exchange = req.body.exchange
        let order_id = req.body.order_id

        if (typeof exchange == 'undefined' || exchange == '' || typeof order_id == 'undefined' || order_id == '') {
            res.send({
                'status': false,
                'message': 'order_id and exchange are required'
            });
        } else {

            let filter = {
                '_id': new ObjectID(order_id),
            }

            let sold_collection = (exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange)
            let data1 = await db.collection(sold_collection).find(filter).limit(1).toArray();

            if (data1.length > 0) {
                let obj = data1[0];

                let updateArr = {
                    '$set': {
                        'modified_date': new Date(),
                        'status': 'resume',
                    }
                }
                let resumeCollectionName = exchange == 'binance' ? 'resume_buy_orders' : 'resume_buy_orders_' + exchange
                let update = db.collection(resumeCollectionName).updateOne({'_id': obj.resume_order_id}, updateArr, async (err, result) => {
                    if (err) {
                        console.log(err)
                    } else {
                        let set = {
                            '$set': {
                                'modified_date': new Date(),
                                'status': 'FILLED',
                            }
                        }
                        let update = db.collection(sold_collection).updateOne({'_id': obj._id}, set)
                    }
                })

                let show_hide_log = 'yes';
                let type = 'resume_continue';
                let order_mode = obj.application_mode;
                let log_msg = 'Paused order was resumed again manually'
                var order_created_date = obj.created_date
                var promiseLog = create_orders_history_log(obj._id, log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                promiseLog.then((callback) => { })

                res.send({
                    'status': true,
                    'message': 'Order is resumed successfully'
                });
            } else {
                res.send({
                    'status': false,
                    'message': 'Something went wrong'
                });
            }
        }

    })
})
//End resumeAlreadyPausedOrder


// ******************* End Resume / Pause APIs **************** //


// ******************* Cost Avg APIs ******************** //

router.post('/getCostAvgOrders', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let order_ids = req.body.ids
    let exchange = req.body.exchange

    if (typeof order_ids != 'undefined' && order_ids.length > 0 && typeof exchange != 'undefined' && exchange != '') {

        let ordersArr = await getCostAvgOrders(order_ids, exchange)
        let last3ordersArr = await getLast3CostAvgOpenOrders(order_ids, exchange)

        // var ordersArr = returnArr.slice().sort((a, b) => b.modified_date - a.modified_date)

        res.send({
            status: true,
            orders: ordersArr,
            last3ordersArr: last3ordersArr,
            message: 'data found',
        })

    } else {
        res.send({
            status: false,
            message: 'ids and exchange is required.'
        });
    }

})//end getCostAvgOrders


async function getCostAvgOrders(order_ids, exchange){

    return new Promise( async (resolve) =>{
        if (typeof order_ids != 'undefined' && order_ids.length > 0 && typeof exchange != 'undefined' && exchange != '') {

            let db = await conn

            let buy_collection = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
            let sold_collection = exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange

            let ids_arr = []
            let totalItems = order_ids.length

            for (let i = 0; i < totalItems; i++){
                ids_arr.push(new ObjectID(order_ids[i]))
            }

            let where = {
                '_id': { '$in': ids_arr }
            }

            let p1 = db.collection(buy_collection).find(where).toArray()
            let p2 = db.collection(sold_collection).find(where).toArray()

            let promiseResult = await Promise.all([p1, p2])

            let buy_orders = promiseResult[0]
            let sold_orders = promiseResult[1]

            let ordersArr = buy_orders.concat(sold_orders);
            delete buy_orders
            delete sold_orders
            delete promiseResult
            delete p1
            delete p2

            // var ordersArr = returnArr.slice().sort((a, b) => b.modified_date - a.modified_date)
            resolve(ordersArr)

        } else {
            resolve ([])
        }
    })
}

async function getLast3CostAvgOpenOrders(order_ids, exchange) {

    return new Promise(async (resolve) => {
        if (typeof order_ids != 'undefined' && order_ids.length > 0 && typeof exchange != 'undefined' && exchange != '') {

            let db = await conn

            let buy_collection = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
            let ids_arr = []
            let totalItems = order_ids.length

            for (let i = 0; i < totalItems; i++) {
                ids_arr.push(new ObjectID(String(order_ids[i])))
            }

            let where = {
                '_id': { '$in': ids_arr }
            }

            let p1 = await db.collection(buy_collection).find(where).sort({'created_date':-1}).limit(3).toArray()

            let buy_orders = p1

            let ordersArr = buy_orders

            resolve(ordersArr)

        } else {
            resolve([])
        }
    })
}

async function getCostAvgPLandUsdWorth(order_ids, exchange) {

    return new Promise(async (resolve) => {

        let totalUsdWorth = 0
        let sold_avg_order_count = 0
        let remaining_avg_order_count = 0
        let cost_avg_profit = 0
        let cost_avg_profit_color = 'red'
        let sold_avg_profit = 0
        let sold_avg_profit_color = 'red'
        let curr_avg_profit = 0
        let curr_avg_profit_color = 'red'
        let target_avg_profit = 0
        let target_avg_profit_color = 'red'
        let orders = await getCostAvgOrders(order_ids, exchange)
        if (orders.length > 0) {

            //Create Cost AVG ledger
            let totalOrders = orders.length
            let costAvgArr = []

            let splitArr = orders[0]['symbol'].split('USDT');
            let symbol = orders[0]['symbol'];

            let coinData = await listmarketPriceMinNotationCoinArr({ '$in': [symbol, 'BTCUSDT']}, exchange)
            let currPrice = coinData[symbol]['currentmarketPrice']
            let BTCUSDTPrice = coinData['BTCUSDT']['currentmarketPrice']

            // console.log('totalCount: ',orders.length , currPrice, BTCUSDTPrice)

            let totalQuantity = 0
            let temp_totalQuantity = 0

            for (let i = 0; i < totalOrders; i++) {

                let obj = orders[i]
                let costAvgObj = {}
                // let profitLoss = obj['is_sell_order'] == 'sold' ? obj['cost_avg_profit'] : getPercentageDiff(currPrice, obj['purchased_price'])
                let profitLoss = obj['is_sell_order'] == 'sold' ? getPercentageDiff(obj['market_sold_price'], obj['purchased_price']) : getPercentageDiff(currPrice, obj['purchased_price'])
                let usd_worth = 0

                //sold usd worth
                if (obj['is_sell_order'] == 'sold' && typeof obj['market_sold_price_usd'] != 'undefined' && obj['market_sold_price_usd'] != '' && !isNaN(parseFloat(obj['market_sold_price_usd']))){
                    usd_worth = (splitArr[1] == '' ? obj['quantity'] * obj['market_sold_price'] : obj['market_sold_price_usd'])
                }else{

                    if (obj['status'] == 'new') {
                        usd_worth = (splitArr[1] == '' ? obj['quantity'] * currPrice : obj['quantity'] * currPrice * BTCUSDTPrice)
                    } else {
                        usd_worth = (splitArr[1] == '' ? obj['quantity'] * obj['purchased_price'] : obj['quantity'] * obj['purchased_price'] * BTCUSDTPrice)
                    }
                }

                let statusHtml = ''
                let type = ''
                let target11Profit = 0
                if (obj['is_sell_order'] == 'sold') {
                    statusHtml = '<span class="badge badge-success">Sold</span>'
                    type = 'sold'
                    // target11Profit += (typeof obj['is_lth_order'] != 'undefined' && obj['is_lth_order'] != '' ? parseFloat(obj['is_lth_order']) : parseFloat(obj['defined_sell_percentage']))
                    target11Profit += parseFloat(obj['defined_sell_percentage'])
                } else if (obj['status'] == 'canceled') {
                    statusHtml = '<span class="badge badge-danger">Canceled</span>'
                    type = 'canceled'
                } else if (obj['is_sell_order'] == 'yes' && (obj['status'] != 'new' || obj['status'] != 'new_ERROR' && obj['status'] != 'canceled')) {
                    statusHtml = '<span class="badge badge-primary">Buy</span>'
                    type = 'buy'

                    // if (obj['status'] == 'LTH') {
                    //     target11Profit += (typeof obj['lth_profit'] != 'undefined' && obj['lth_profit'] != '' ? parseFloat(obj['lth_profit']) : parseFloat(obj['defined_sell_percentage']))
                    // } else {
                    //     target11Profit += (typeof obj['defined_sell_percentage'] != 'undefined' && obj['defined_sell_percentage'] != '' ? parseFloat(obj['defined_sell_percentage']) : 0)
                    // }

                    target11Profit += (typeof obj['defined_sell_percentage'] != 'undefined' && obj['defined_sell_percentage'] != '' ? parseFloat(obj['defined_sell_percentage']) : 0)

                } else {
                    statusHtml = '<span class="badge badge-info">' + obj['status'] + '</span>'
                }

                let childObjId = obj['_id']

                costAvgObj['_id'] = childObjId
                // costAvgObj['orderType'] = childObjId == parent_id ? 'costAvgParent' : 'costAvgChild'

                if (typeof obj['market_sold_price'] == 'undefined'){
                    obj['market_sold_price'] = 0;
                }
                // console.log(obj['_id'], obj['symbol'], obj['sell_price'], obj['market_sold_price'], obj['purchased_price'], typeof obj['purchased_price'])

                costAvgObj['buy_price'] = obj['purchased_price'].toFixed(8)
                costAvgObj['sell_price'] = obj['is_sell_order'] == 'sold' ? parseFloat(obj['market_sold_price']).toFixed(8) : parseFloat(obj['sell_price']).toFixed(8)
                costAvgObj['type'] = type
                costAvgObj['targetProfit'] = target11Profit
                costAvgObj['status'] = obj['status']
                costAvgObj['statusHtml'] = statusHtml
                costAvgObj['usd_worth'] = usd_worth.toFixed(2)
                costAvgObj['profitLoss'] = profitLoss
                costAvgObj['plColor'] = (profitLoss > 0 ? 'success' : 'danger')

                totalQuantity += typeof obj['is_sell_order'] != 'undefined' && obj['is_sell_order'] == 'yes' && typeof obj['quantity'] != 'undefined' && !isNaN(parseFloat(obj['quantity'])) ? parseFloat(obj['quantity']) : 0

                temp_totalQuantity += parseFloat(obj['quantity'])

                costAvgArr.push(costAvgObj)
            }

            sold_avg_order_count = orders.filter(x => (x['is_sell_order'] == 'sold')).length
            remaining_avg_order_count = orders.filter(x => (x['is_sell_order'] == 'yes' && (x['status'] == 'FILLED' || x['status'] == 'LTH'))).length

            if (sold_avg_order_count == orders.length){
                totalQuantity = temp_totalQuantity
            }

            let avgProfit = 0
            let soldProfit = 0
            let soldCount = 0
            let currProfit = 0
            let currCount = 0
            let targetProfit = 0
            let targetProfitCount = 0
            let soldTargetProfit = 0
            let soldTargetProfitCount = 0
            let totalItems = costAvgArr.length
            for(let i=0; i<totalItems; i++){
                avgProfit += parseFloat(costAvgArr[i].profitLoss)
                if (costAvgArr[i].type == 'sold') {
                    soldCount++
                    soldProfit += parseFloat(costAvgArr[i].profitLoss)
                    // targetProfitCount++
                    // targetProfit += parseFloat(costAvgArr[i].targetProfit)
                    soldTargetProfitCount++
                    soldTargetProfit += parseFloat(costAvgArr[i].targetProfit)
                } else if (costAvgArr[i].type == 'buy') {
                    targetProfitCount++
                    targetProfit += parseFloat(costAvgArr[i].targetProfit)
                }

                if (costAvgArr[i].type != 'canceled') {
                    // if (costAvgArr[i].profitLoss != 0) {
                    //     currCount++
                    // }
                    currCount++
                    currProfit += parseFloat(costAvgArr[i].profitLoss)
                    totalUsdWorth += parseFloat(costAvgArr[i].usd_worth)
                }

            }

            if (costAvgArr.length > 0) {
                avgProfit = parseFloat((avgProfit / costAvgArr.length).toFixed(1))

                cost_avg_profit = avgProfit
                cost_avg_profit_color = (avgProfit > 0 ? 'success' : 'danger')

                sold_avg_profit = !isNaN(parseFloat((soldProfit / soldCount).toFixed(1))) ? parseFloat((soldProfit / soldCount).toFixed(1)) : 0
                sold_avg_profit_color = (soldProfit > 0 ? 'success' : 'danger')

                // curr_avg_profit = !isNaN(parseFloat((currProfit / currCount).toFixed(1))) ? parseFloat((currProfit / currCount).toFixed(1)) : 0
                curr_avg_profit = !isNaN(parseFloat((currProfit / (currCount - (currCount == soldCount ? 0 : soldCount))).toFixed(1))) ? parseFloat((currProfit / (currCount - (currCount == soldCount ? 0 : soldCount))).toFixed(1)) : 0
                curr_avg_profit_color = (curr_avg_profit > 0 ? 'success' : 'danger')

                target_avg_profit = !isNaN(parseFloat((targetProfit / targetProfitCount).toFixed(1))) ? parseFloat((targetProfit / targetProfitCount).toFixed(1)) : 0
                target_avg_profit_color = (targetProfit > 0 ? 'success' : 'danger')

                if (target_avg_profit == 0) {
                    target_avg_profit = !isNaN(parseFloat((soldTargetProfit / soldTargetProfitCount).toFixed(1))) ? parseFloat((soldTargetProfit / soldTargetProfitCount).toFixed(1)) : 0
                    target_avg_profit_color = (soldTargetProfit > 0 ? 'success' : 'danger')
                }

                totalUsdWorth = parseFloat(parseFloat(totalUsdWorth).toFixed(2))
            }

            // console.log('sold_avg_order_count ', this.sold_avg_order_count)
            // console.log('remaining_avg_order_count ', this.remaining_avg_order_count)

            // this.costAvgLedgerExists = true;
            // this.costAvgLedger = costAvgArr;
            resolve({
                'cost_avg_profit': cost_avg_profit,
                'cost_avg_profit_color': cost_avg_profit_color,
                'sold_avg_profit': sold_avg_profit,
                'sold_avg_profit_color': sold_avg_profit_color,
                'curr_avg_profit': curr_avg_profit,
                'curr_avg_profit_color': curr_avg_profit_color,
                'target_avg_profit': target_avg_profit,
                'target_avg_profit_color': target_avg_profit_color,
                'total_usd_worth': totalUsdWorth,
                'totalQuantity': parseFloat(totalQuantity.toFixed(6)),
            })

            // (async() => {
            //     resolve({
            //         'cost_avg_profit': cost_avg_profit,
            //         'cost_avg_profit_color': cost_avg_profit_color,
            //         'sold_avg_profit': sold_avg_profit,
            //         'sold_avg_profit_color': sold_avg_profit_color,
            //         'curr_avg_profit': curr_avg_profit,
            //         'curr_avg_profit_color': curr_avg_profit_color,
            //         'target_avg_profit': target_avg_profit,
            //         'target_avg_profit_color': target_avg_profit_color,
            //         'total_usd_worth': totalUsdWorth,
            //     })
            // })

            // (async() => {
            //     delete costAvgArr
            //     delete orders
            // })


        } else {
            resolve({})
        }

    })
}


function getPercentageDiff(currentMarketPrice, purchased_price) {
    if (purchased_price == 0) {
        return 0
    } else {
        return parseFloat((((currentMarketPrice - purchased_price) / purchased_price) * 100).toFixed(1))
    }
}




router.post('/soldAll', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let orderType = req.body.orderType
    let exchange = req.body.exchange
    let order_id = req.body.order_id
    let tab = req.body.tab
    let action = typeof req.body.action != 'undefined' && req.body.action != '' ? req.body.action : '';

    let sellNow = true

    if (typeof orderType != 'undefined' && orderType != '' && typeof exchange != 'undefined' && exchange != '' && typeof order_id != 'undefined' && order_id != '') {

        //get order
        let order = await listOrderById(order_id, exchange);
        if (order.length > 0) {

            order = order[0]
            let symbol = order['symbol']
            //get currentMarket price
            let coinData = await listmarketPriceMinNotationCoinArr(symbol, exchange)
            let currentmarketPrice = coinData[symbol]['currentmarketPrice']
            var orderObj = {};

            //send sell request if costAvg child order
            const db = await conn

            var collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;

            let cavIdsToConsider = [new ObjectID(order_id)]
            if (typeof order['avg_orders_ids'] != 'undefined' && order['avg_orders_ids'].length > 0){
                cavIdsToConsider = cavIdsToConsider.concat(order['avg_orders_ids'])
            }

            // console.log(cavIdsToConsider, 'cavIdsToConsider');
            let cavgPipeline = [
                {
                    '$match': {
                        '_id': { '$in': cavIdsToConsider},
                        'status': 'FILLED',
                    }
                },
                {
                    '$group': {
                        '_id': null,
                        'quantitySum': {'$sum': '$quantity'}
                    }
                }
            ]


            // console.log(cavgPipeline, 'cavgPipeline')
            let cvgTotalBuyQty = await db.collection(collection).aggregate(cavgPipeline).toArray()
            if (cvgTotalBuyQty.length > 0){
                order['quantity_all'] = cvgTotalBuyQty[0]['quantitySum']
            }
            // console.log(order['quantity_all'], 'quantity_all')

            if (orderType == 'costAvgParent') {



              // avg_orders_ids

              orderObj['order_id'] = order['sell_order_id'];
              orderObj['quantity'] = order['quantity_all'];
              orderObj['market_price'] = currentmarketPrice;
              orderObj['coin_symbol'] = order['symbol'];
              orderObj['admin_id'] = order['admin_id'];
              orderObj['buy_order_id'] = order['_id'];
              orderObj['trigger_type'] = "barrier_percentile_trigger";
              orderObj['order_type'] = "sell_market_order";
              orderObj['order_status'] = "ready";
              orderObj['cost_avg'] = "ready";
              orderObj['global'] = "global";
              orderObj['cost_avg_sell'] = "cost_avg_all";
              orderObj['created_date'] = new Date();
              orderObj['modified_date'] = new Date();



            //  const db = await conn



            //  return false;

             let userObj = await db.collection('users').findOne({ '_id': new ObjectID(String(order['admin_id'])) }, { projection: { _id: 0, trading_ip: 1 } })

            //  console.log(userObj, orderObj)

             orderObj['trading_ip'] = userObj['trading_ip'];



            let id_based_collection = (exchange == 'binance') ? 'ready_orders_for_sell_ip_based_cost' : 'ready_orders_for_sell_ip_based_kraken_cost';
            await db.collection(id_based_collection).insertOne(orderObj);


             resp.status(200).send({
                 status: true,
                 message: 'Order Set for Sold Completely'
             })
            }

        } else {
            resp.status(200).send({
                status: false,
                message: 'An error occured'
            })
        }
    } else {
        resp.status(200).send({
            status: false,
            message: 'orderType, exchange, order_id is required'
        })
    }

}) //End of sellCostAvgOrder


//sellCostAvgOrder
router.post('/sellCostAvgOrder', auth_token.required, async (req, resp) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let orderType = req.body.orderType
    let exchange = req.body.exchange
    let order_id = req.body.order_id
    let tab = req.body.tab
    let action = typeof req.body.action != 'undefined' && req.body.action != '' ? req.body.action : '';

    let sellNow = true

    if (typeof orderType != 'undefined' && orderType != '' && typeof exchange != 'undefined' && exchange != '' && typeof order_id != 'undefined' && order_id != '') {

        //get order
        let order = await listOrderById(order_id, exchange);
        if (order.length > 0) {

            order = order[0]
            let symbol = order['symbol']
            //get currentMarket price
            let coinData = await listmarketPriceMinNotationCoinArr(symbol, exchange)
            let currentmarketPrice = coinData[symbol]['currentmarketPrice']

            //send sell request if costAvg child order
            if (orderType == 'costAvgChild') {

                if (action != '') {
                    if (action == 'isResumeExchange') {
                        //only move
                        await migrate_order(order_id, exchange, action)
                        sellNow = false
                    } else if (action == 'isResume'){
                        //move then sell
                        await migrate_order(order_id, exchange, action)
                    }
                }

                if (sellNow){
                    var options = {
                        method: 'POST',
                        // url: 'http://localhost:3010/apiEndPoint/apiEndPoint/sellOrderManually',
                        url: 'https://digiapis.digiebot.com/apiEndPoint/sellOrderManually',
                        headers: {
                            'cache-control': 'no-cache',
                            'Connection': 'keep-alive',
                            'Accept-Encoding': 'gzip, deflate',
                            'Postman-Token': '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
                            'Cache-Control': 'no-cache',
                            'Accept': '*/*',
                            'User-Agent': 'PostmanRuntime/7.20.1',
                            'Content-Type': 'application/json'
                        },
                        json: {
                            'orderId': order_id,
                            'exchange': exchange,
                            'currentMarketPriceByCoin': currentmarketPrice,
                        }
                    };
                    request(options, function (error, response, body) { });
                }

            } else if (orderType == 'costAvgParent') {

                const db = await conn
                let buyCollection = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange

                //loop all childs and send sell API call
                let ids = []
                ids.push(order_id)
                if (typeof order['avg_orders_ids'] != 'undefined'){
                    ids = ids.concat(order['avg_orders_ids'])
                }

                let childsCount = ids.length

                if (typeof tab != 'undefined' && tab == 'costAvgTab'){
                    // await db.collection(buyCollection).updateOne({ '_id': ObjectID(order_id) }, { '$set': { 'cost_avg': 'completed', 'move_to_cost_avg':'yes'}})
                }

                //sell parent by adding all open child quantity
                let allChildTrades = []
                let totalCostAvgQty = 0;
                let childIds = []
                for (let i = 0; i < ids.length; i++) {
                    childIds.push(new ObjectID(String(ids[i])))
                }
                var status_arr = ['canceled', 'new_ERROR']
                whereChilds = {
                    '_id': { '$in': childIds },
                    'status': { $nin: status_arr }
                }
                allChildTrades = await db.collection(buyCollection).find(whereChilds).toArray()
                if (allChildTrades.length > 0) {
                    allChildTrades.forEach(item => totalCostAvgQty += parseFloat(item.quantity))
                }
                // console.log('totalCostAvgQty ', totalCostAvgQty)
                // process.exit(0)

                for (let i = 0; i < allChildTrades.length; i++) {

                    // if (action != '') {
                    //     if (action == 'isResumeExchange') {
                    //         //only move
                    //         await migrate_order(String(ids[i]), exchange, action)
                    //         sellNow = false
                    //     } else if (action == 'isResume') {
                    //         //move then sell
                    //         await migrate_order(String(ids[i]), exchange, action)
                    //     }
                    // }

                    if (false && sellNow){
                        // var options = {
                        //     method: 'POST',
                        //     // url: 'http://localhost:3010/apiEndPoint/apiEndPoint/sellOrderManually',
                        //     url: 'https://digiapis.digiebot.com/apiEndPoint/sellOrderManually',
                        //     headers: {
                        //         'cache-control': 'no-cache',
                        //         'Connection': 'keep-alive',
                        //         'Accept-Encoding': 'gzip, deflate',
                        //         'Postman-Token': '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
                        //         'Cache-Control': 'no-cache',
                        //         'Accept': '*/*',
                        //         'User-Agent': 'PostmanRuntime/7.20.1',
                        //         'Content-Type': 'application/json'
                        //     },
                        //     json: {
                        //         'orderId': String(ids[i]),
                        //         'exchange': exchange,
                        //         'currentMarketPriceByCoin': currentmarketPrice,
                        //     }
                        // };
                        // request(options, function (error, response, body) { });
                    } else if (sellNow){
                        var options = {
                            method: 'POST',
                            // url: 'http://localhost:3010/apiEndPoint/sellOrderManually',
                            url: 'https://digiapis.digiebot.com/apiEndPoint/sellOrderManually',
                            headers: {
                                'cache-control': 'no-cache',
                                'Connection': 'keep-alive',
                                'Accept-Encoding': 'gzip, deflate',
                                'Postman-Token': '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
                                'Cache-Control': 'no-cache',
                                'Accept': '*/*',
                                'User-Agent': 'PostmanRuntime/7.20.1',
                                'Content-Type': 'application/json'
                            },
                            json: {
                                'orderId': String(order_id),
                                'exchange': exchange,
                                'currentMarketPriceByCoin': currentmarketPrice,
                                'costAvgParent': true,
                                'costAvgParentAddedQty': totalCostAvgQty,
                            }
                        };
                        request(options, function (error, response, body) { });
                        break;
                    }
                }
            }

            resp.status(200).send({
                status: true,
                message: (action == '' ? 'Sell request sent successfully' : 'Action successful')
            })
        } else {
            resp.status(200).send({
                status: false,
                message: 'An error occured'
            })
        }
    } else {
        resp.status(200).send({
            status: false,
            message: 'orderType, exchange, order_id is required'
        })
    }

}) //End of sellCostAvgOrder

// ******************* End Cost Avg APIs **************** //



router.post('/latest_user_activity', auth_token.required, async (req, res) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {
        const user_id = req.body.user_id

        if (typeof user_id == 'undefined' || user_id == '') {
            res.send({
                'status': false,
                'message': 'user_id is required'
            });
        } else {

            let exchanges = ['binance', 'bam']

            let binancePromise = latest_user_activity(user_id, 'binance')
            let bamPromise = latest_user_activity(user_id, 'bam')

            let myPrmises = await Promise.all([binancePromise, bamPromise]);

            let latest_activity = { ...myPrmises[0], ...myPrmises[1] }

            let user = await db.collection('users').aggregate([{
                $match: {
                    '_id': new ObjectID(user_id)
                }
            }]).toArray();

            let last_login = (user.length > 0 && user[0].last_login_datetime != 'undefined' ? user[0].last_login_datetime : '');
            last_login = typeof last_login != 'undefined' ? last_login : ''

            res.send({
                'last_login': last_login,
                'latest_orders': latest_activity,
            })
        }

    })
})
//End latest_user_activity

async function latest_user_activity(user_id, exchange){
    return new Promise(async (resolve) => {
        conn.then(async (db) => {
            let buy_order_collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
            let buy_order = db.collection(buy_order_collection).aggregate([{
                $match: {
                    'admin_id': user_id
                }
            },
            {
                $sort: {
                    'created_date': -1
                }
            },
            {
                $limit: 1
            }
            ]).toArray();

            var filter = {
                'admin_id': user_id,
                'application_mode': 'live',
                'status': 'FILLED'
            }
            var buy_order_count_promise = countCollection(buy_order_collection, filter);

            var filter = {
                'admin_id': user_id,
                'application_mode': 'live',
                'parent_status': 'parent',
                'status': {
                    '$in': ['new', 'takingOrder']
                }
            }
            var buy_parent_order_count_promise = countCollection(buy_order_collection, filter);

            let btc_balance_arr = listUserBalancebyCoin(user_id, 'BTC', exchange)
            let usdt_balance_arr = listUserBalancebyCoin(user_id, 'USDT', exchange)

            let myPrmises = await Promise.all([buy_order, buy_order_count_promise, buy_parent_order_count_promise, btc_balance_arr, usdt_balance_arr]);

            // console.log(buy_order)
            // console.log(myPrmises[0].length > 0)

            let obj = {}
            obj[exchange] = myPrmises[0].length > 0 ? myPrmises[0][0] : {}
            obj[exchange + '_buy_order_count'] = myPrmises[1]
            obj[exchange + '_parent_order_count'] = myPrmises[2]

            obj[exchange + '_BTC'] = myPrmises[3].length > 0 ? Number(myPrmises[3][0]['coin_balance']) : 0
            obj[exchange + '_USDT'] = myPrmises[4].length > 0 ? Number(myPrmises[4][0]['coin_balance']) : 0

            resolve(obj)

        })
    })
}

async function send_notification(admin_id, type, priority, message, order_id = '', exchange = '', symbol = '', application_mode = '', interface = '') {

    /*
    // Notifications can only be of the following types and priorities
    let types = [
        "security_alerts",
        "buy_alerts",
        "sell_alerts",
        "trading_alerts",
        "withdraw_alerts",
        "news_alerts"
    ]
    let priorities = [
        'high',
        'medium',
        'low'
    ]
    */

    // if (admin_id == '5c0912b7fc9aadaac61dd072') {
        if(application_mode == 'live'){
            var options = {
                method: 'POST',
                url: 'https://app.digiebot.com/admin/Api_services/send_notification',
                headers: {
                    'cache-control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Accept-Encoding': 'gzip, deflate',
                    'Postman-Token': '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
                    'Cache-Control': 'no-cache',
                    'Accept': '*/*',
                    'User-Agent': 'PostmanRuntime/7.20.1',
                    'Content-Type': 'application/json'
                },
                json: {
                    'admin_id': admin_id,
                    'type': type,
                    'priority': priority,
                    'message': message,
                    'order_id': order_id,
                    'exchange': exchange,
                    'symbol': symbol,
                    'interface': interface
                }
            };
            request(options, function (error, response, body) {});
        }
    // }
    return true;
}

router.post('/update_user_balance', auth_token.required, async (req, res)=>{


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let user_id = req.body.user_id
    let auth_token = req.headers.authorization;
    if(typeof user_id != 'undefined' && user_id != ''){
        var updateWallet = await update_user_balance(user_id, 'shahzad_check', auth_token)
        if(updateWallet || updateWallet == true){
          console.log(updateWallet)
          res.send({
            'status': true,
            'message': updateWallet
          });
        } else {
          res.send({
            'status': false,
            'message': 'Request Stuck somewhere'
          });
        }
    } else {
      res.send({
          'status': false,
          'message': 'user id needed'
      });
    }


      // Removed By huzaifa
      // res.send({
      //     'status': true,
      //     'message': updateWallet
      // });
      // Removed By huzaifa

})

async function update_user_balance(user_id, res='', auth_token='') {


  return new Promise(async resolve=>{

    let ip_bianance = ''
    const db = await conn
    let user = await db.collection('users').find({ '_id': new ObjectID(String(user_id)) }).project({ trading_ip:1}).toArray();


    let url_binance = ''
    if (user.length > 0 && typeof user[0]['trading_ip'] != 'undefined' && user[0]['trading_ip'] != ''){
      if(user[0]['trading_ip'] == '3.227.143.115'){
        ip_bianance = 'ip1.digiebot.com'
      } else if(user[0]['trading_ip'] == '3.228.180.22'){
        ip_bianance = 'ip2.digiebot.com'
      } else if(user[0]['trading_ip'] == '3.226.226.217'){
        ip_bianance = 'ip3.digiebot.com'
      } else if(user[0]['trading_ip'] == '3.228.245.92'){
        ip_bianance = 'ip4.digiebot.com'
      } else if(user[0]['trading_ip'] == '35.153.9.225'){
        ip_bianance = 'ip5.digiebot.com'
      } else if(user[0]['trading_ip'] == '54.157.102.20'){
        // ip_bianance = 'ip6-kraken-balance.digiebot.com'
        ip_bianance = 'ip6.digiebot.com'
      }
      url_binance = 'https://'+ ip_bianance +'/apiKeySecret/updateUserBalance'
    }



    // console.log(url_binance)


    //Update Binance Balance
    var options = {
        method: 'POST',
        url: url_binance,
        headers: {
            'cache-control'  : 'no-cache',
            'Connection'     : 'keep-alive',
            'Accept-Encoding': 'gzip, deflate',
            'Postman-Token'  : '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
            'Cache-Control'  : 'no-cache',
            'Accept'         : '*/*',
            'User-Agent'     : 'PostmanRuntime/7.20.1',
            'Content-Type'   : 'application/json',
            'Authorization'  :  auth_token
        },
        json: {
          'user_id': user_id,
      }
    };
    request(options, function (error, response, body) { });

    //Update Binance Bam
    var options = {
        method: 'GET',
        url: 'https://app.digiebot.com/admin/Updatebalance_bam/update_user_vallet_bam/' + user_id,
        headers: {
            'cache-control'  : 'no-cache',
            'Connection'     : 'keep-alive',
            'Accept-Encoding': 'gzip, deflate',
            'Postman-Token'  : '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
            'Cache-Control'  : 'no-cache',
            'Accept'         : '*/*',
            'User-Agent'     : 'PostmanRuntime/7.20.1',
            'Content-Type'   : 'application/json',
            'Authorization'  :  auth_token
        },
        json: {}
    };
    request(options, function (error, response, body) {

      console.log(body, 'body for binance')
    });

    // //Update kraken Balance
    // var options = {
    //     method: 'POST',
    //     url: 'http://52.22.53.12:2607/apiEndPoint/updateBalance',
    //     headers: {
    //         'cache-control'   : 'no-cache',
    //         'Connection'      : 'keep-alive',
    //         'Accept-Encoding' : 'gzip, deflate',
    //         'Postman-Token'   : '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
    //         'Cache-Control'   : 'no-cache',
    //         'Accept'          : '*/*',
    //         'User-Agent'      : 'PostmanRuntime/7.20.1',
    //         'Content-Type'    : 'application/json'
    //     },
    //     json: {
    //         'user_id': user_id
    //     }
    // };
    // request(options, function (error, response, body) { });


    //get user IP for sending request

    let ip = '35.153.9.225'
    let port = ':3006'

    if (user.length > 0 && typeof user[0]['trading_ip'] != 'undefined' && user[0]['trading_ip'] != ''){
        if(user[0]['trading_ip'] == '3.227.143.115'){
            ip = 'ip1-kraken.digiebot.com/api/user'
          } else if(user[0]['trading_ip'] == '3.228.180.22'){
            ip = 'ip2-kraken.digiebot.com/api/user'
          } else if(user[0]['trading_ip'] == '3.226.226.217'){
            ip = 'ip3-kraken.digiebot.com/api/user'
          } else if(user[0]['trading_ip'] == '3.228.245.92'){
            ip = 'ip4-kraken.digiebot.com/api/user'
          } else if(user[0]['trading_ip'] == '35.153.9.225'){
            ip = 'ip5-kraken.digiebot.com/api/user'
          } else if(user[0]['trading_ip'] == '54.157.102.20'){
            ip = 'ip6-kraken.digiebot.com/api/user'
          }
    }


    let url = 'https://' + ip +'/updateUserBalance'
    // console.log(url)


    //Update Kraken Balance
    var options = {
        method: 'POST',
        url: url,
        headers: {
            'cache-control'   : 'no-cache',
            'Connection'      : 'keep-alive',
            'Accept-Encoding' : 'gzip, deflate',
            'Postman-Token'   : '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
            'Cache-Control'   : 'no-cache',
            'Accept'          : '*/*',
            'User-Agent'      : 'PostmanRuntime/7.20.1',
            'Content-Type'    : 'application/json',
            'Token': 'vizzwebsolutions12345678910'
        },
        json: {
            'user_id': user_id,
        }
    };
    request(options, function (error, response, body) {
      if(error){

          if(res == 'shahzad_check'){
            console.log('error_if', error)
            resolve(false)
          } else {
            console.log('error_else', error)
            resolve(false)
          }
      }else{
        if(res == 'shahzad_check'){
          console.log('if')
          resolve(body)
        } else {
          console.log('else', body)
        //   Please Do remember Here is body['status'] in resolver
          resolve(true)
        }
      }
    });
  })



}

router.post('/getNotifications', auth_token.required, async (req, res) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {

        let admin_id = req.body.user_id
        let skip = req.body.skip
        let limit = req.body.limit
        let load_more = req.body.load_more
        let sort = {'created_date': -1}

        if (typeof admin_id == 'undefined' || admin_id == '') {
            res.send({
                'status': false,
                'message': 'user_id is required'
            });
        } else {

            var where = {
                'admin_id': admin_id,
            }

            if (typeof load_more == 'undefined' || load_more == '' || load_more != 'yes'){
                let MS_PER_MINUTE = 60000;
                let durationInMinutes = 15;
                let end_date = new Date();
                let start_date = new Date(new Date() - durationInMinutes * MS_PER_MINUTE);
                where['created_date'] = {
                    '$gte': start_date,
                    '$lte': end_date
                }
                skip = 0
                limit = 20
            }

            let latest_where = {
                'admin_id': admin_id
            }
            let notifications = await db.collection('notifications').find(where).sort(sort).skip(skip).limit(limit).toArray();
            let latest_notification = await db.collection('notifications').find(latest_where).sort(sort).limit(10).toArray();

            if (notifications.length > 0 || latest_notification.length > 0) {
                res.send({
                    'status': true,
                    'notifications': notifications.length > 0 ? notifications : latest_notification,
                    'latest_notification': latest_notification,
                    'message': 'Notifications found successfully'
                });
            } else {
                res.send({
                    'status': false,
                    'notifications': [],
                    'latest_notification': [],
                    'message': 'Notifications not found.'
                });
            }
        }

    })
})

router.post('/readNotifications', auth_token.required, async (req, res) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    conn.then(async (db) => {
        let notification_ids = req.body.notification_ids
        let admin_id = req.body.user_id

        if (typeof admin_id == 'undefined' || admin_id == '') {
            res.send({
                'status': false,
                'message': 'user_id is required'
            });
        } else {
            if (typeof notification_ids != 'undefined' && notification_ids.length > 0){

                let ids = [];
                await Promise.all(notification_ids.map(id=>{ids.push(new ObjectID(id))}));
                // console.log(ids);

                let set = {};
                set['$set'] = {
                    'status': '1'
                };
                let where = {
                    '_id': {'$in': ids}
                }
                let update = db.collection('notifications').updateMany(where, set);
            }
        }

        res.send({
            'status': true,
            'message': 'read success'
        });

    })
})

router.post('/getSubscription', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let user_id = req.body.user_id
    if (typeof user_id != 'undefined' && user_id != ''){

        let token = await get_temp_req_token('users')

        var options = {
            method: 'POST',
            url: 'https://users.digiebot.com/cronjob/GetUserSubscriptionDetails/',
            headers: {
                'cache-control': 'no-cache',
                'Connection': 'keep-alive',
                'Accept-Encoding': 'gzip, deflate',
                'Postman-Token': '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
                'Cache-Control': 'no-cache',
                'Accept': '*/*',
                'User-Agent': 'PostmanRuntime/7.20.1',
                'Content-Type': 'application/json'
            },
            json: {
                'user_id': String(user_id),
                'handshake': token,
            }
        };

        request(options, function (error, response, body) {
            if (error){
                res.send({
                    'status': false,
                    'message': 'some thing went wrong'
                });
            }else{
                res.send(body);
            }
        })
    }else{
        res.status(400).send({
            'status': false,
            'message': 'user_id is required'
        });
    }
})

async function getSubscription(user_id){

    return new Promise(async resolve=>{

        let token = await get_temp_req_token('users')

        var options = {
            method: 'POST',
            url: 'https://users.digiebot.com/cronjob/GetUserSubscriptionDetails/',
            headers: {
                'cache-control': 'no-cache',
                'Connection': 'keep-alive',
                'Accept-Encoding': 'gzip, deflate',
                'Postman-Token': '0f775934-0a34-46d5-9278-837f4d5f1598,e130f9e1-c850-49ee-93bf-2d35afbafbab',
                'Cache-Control': 'no-cache',
                'Accept': '*/*',
                'User-Agent': 'PostmanRuntime/7.20.1',
                'Content-Type': 'application/json'
            },
            json: {
                'user_id': String(user_id),
                'handshake': token,
            }
        };

        let package_limit = 1000

        request(options, function (error, response, body) {
            if (error) {
                resolve(package_limit)
            } else {
                if (body.trade_limit != null && body.trade_limit != 0 && body.trade_limit != '0') {
                    package_limit = parseFloat(parseFloat(body.trade_limit).toFixed(2))
                }
                resolve(package_limit)
            }
        })

    })
}

router.post('/updateUserPackage', auth_token.required, async (req, res)=>{


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let user_id = req.body.user_id
    let userPackage = req.body.userPackage

    if (typeof user_id != 'undefined' && user_id != '' && typeof userPackage != 'undefined'){
        // 'autoPackage'
        // 'manualPackage'

        let updatedItems = await  updateUserPackage(user_id, userPackage)

        // console.log(updatedItems == userPackage.length ? 'added' : 'error')

        res.send({
            'status': true,
            'message': 'updated successfully',
        })

    }else{
        res.send({
            'status': false,
            'message': 'user_id and package is required',
        })
    }
})

router.post('/getUserPackage', auth_token.required, async (req, res)=>{


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let user_id = req.body.user_id

    if (typeof user_id != 'undefined' && user_id != ''){
        let userPackage = await getUserPackage(user_id)
        res.send({
            'status': true,
            'userPackage': userPackage,
            'message': 'data found',
        })
    }else{
        res.send({
            'status': false,
            'message': 'user_id is required',
        })
    }
})

async function updateUserPackage(user_id, userPackage=[]){
    let db = await conn

    return new Promise(async resolve => {
        //remove all
        await db.collection('users').updateOne({'_id': new ObjectID(String(user_id))}, {'$unset':{'userPackage':''}})

        let totalModules = 0
        //add new
        await Promise.all([userPackage.map(item=>{
            let where = {
                '_id': new ObjectID(String(user_id)),
                'userPackage': { '$ne': item }
            }
            let set = {
                '$push': {'userPackage': item}
            }
            db.collection('users').updateOne(where, set)
            totalModules++
        })])

        resolve(totalModules)
    })
}

async function getUserPackage(user_id){
    return new Promise(async (resolve) =>{
        const db = await conn

        let defaultModules = [
            'autoTrading',
            'manualTrading'
        ]

        let user = await db.collection('users').find({'_id':new ObjectID(String(user_id))}).toArray()
        let userPackage = user.length > 0 && typeof user[0]['userPackage'] != 'undefined' && user[0]['userPackage'] != '' ? user[0]['userPackage'] : defaultModules
        resolve(userPackage)
    })
}

/* ************** temp request token ************ */
async function get_temp_req_token(type){

    let token_arr = [
        'cf31f1bc3a0b3729f35832ff25c7f838',
        '34e0e2a1b05b11dccec3a1f0e55f12ed',
        'cd6d40934f1b41485a34e551961dea47',
        '674cf50e89bac56f29d1e7c919608247',
        'd34aaa3fb16773581167023ddda3b9b2',
        'e1812af878fb6323b022658aeab88981',
        '16f1f98832e8a22d334583d1b55ca74e',
        'e5f604c9e53e8bd397f7a0299a6c67ee',
        'ec4724447307c2973de0bda64c8ac4f7',
        'f221ca4ba18d776579cc442defd63c59',
        '2ef28a3a254745dd124b9425e2c54826',
        'cfa03debbee649ff160a6b74d83d8ff8',
        '95b119e31ad12564723790193f118231',
        '035b4ed3b93bae0e5f912acaf0dbb914',
        '647240ad2a6edd157c7986261d8527ee',
        '671837b9788b7f5b59f00815b74cd889',
        'df632a8d5703229bc031ce40e6dc16d9',
        '83c86ede18cc3bb07f9ecde100631f1e',
        '303da99664d5acc06de8ecda890ce52b',
        '81d1d45dbb19a90fdfae4f87865b136a',
        '63cdf744b7d76f27357ba1722da51ee6',
    ];

    return token_arr[Math.floor(Math.random() * token_arr.length)]

    return new Promise((resolve) => {
        conn.then((db) => {
            let token = md5(String(new Date()))
            db.collection('temp_auth_tokens').insertOne({ 'type': type, 'token': token})
            resolve(token);
        })
    })
}

async function validate_temp_req_token(token) {

    return new Promise((resolve)=>{
        let token_arr = [
            'cf31f1bc3a0b3729f35832ff25c7f838',
            '34e0e2a1b05b11dccec3a1f0e55f12ed',
            'cd6d40934f1b41485a34e551961dea47',
            '674cf50e89bac56f29d1e7c919608247',
            'd34aaa3fb16773581167023ddda3b9b2',
            'e1812af878fb6323b022658aeab88981',
            '16f1f98832e8a22d334583d1b55ca74e',
            'e5f604c9e53e8bd397f7a0299a6c67ee',
            'ec4724447307c2973de0bda64c8ac4f7',
            'f221ca4ba18d776579cc442defd63c59',
            '2ef28a3a254745dd124b9425e2c54826',
            'cfa03debbee649ff160a6b74d83d8ff8',
            '95b119e31ad12564723790193f118231',
            '035b4ed3b93bae0e5f912acaf0dbb914',
            '647240ad2a6edd157c7986261d8527ee',
            '671837b9788b7f5b59f00815b74cd889',
            'df632a8d5703229bc031ce40e6dc16d9',
            '83c86ede18cc3bb07f9ecde100631f1e',
            '303da99664d5acc06de8ecda890ce52b',
            '81d1d45dbb19a90fdfae4f87865b136a',
            '63cdf744b7d76f27357ba1722da51ee6',
        ];
        resolve(token_arr.includes(token))
    })
}

async function destroy_temp_req_token(type, token){
    return new Promise((resolve) => {
        let where = {
            "type": type,
            "token": token,
        };
        conn.then((db) => {
            let token = md5(String(new Date()))
            db.collection('temp_auth_tokens').deleteOne(where)
            resolve(true)
        })
    })
}
/* ************** End temp request token ************ */

//helper function to get a sigle document by id
async function get_item_by_id(collection, _id) {
    return new Promise((resolve) => {
        let where = {
            "_id": new ObjectID(String(_id))
        };
        conn.then((db) => {
            db.collection("users").find(where).toArray((err, result) => {
                if (err) {
                    console.log(err)
                } else {
                    resolve(result[0]);
                }
            })
        })
    })
}//End get_item_by_id


// ***************** Auto Trading Module APIs **************** //
//getPrice
router.post('/getPrice', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    let symbol = req.body.symbol
    let exchange = req.body.exchange
    if (typeof symbol != 'undefined' && symbol != '' && typeof exchange != 'undefined' && exchange != ''){

        if (exchange == 'binance') {
            var options = {
                method: 'GET',
                url: 'https://api.binance.com/api/v1/ticker/price?symbol=' + symbol,
                headers: {}
            };
            request(options, function (error, response, body) {
                if (error) {
                    res.send({
                        status: false,
                        error: error,
                        message: 'Something went wrong'
                    })
                } else {
                    res.send({
                        status: true,
                        data: JSON.parse(body),
                        message: 'Data found successfully'
                    })
                }
            })
        } else if (exchange == 'bam') {
            var options = {
                method: 'GET',
                url: 'https://api.binance.us/api/v1/ticker/price?symbol=' + symbol,
                headers: {}
            };
            request(options, function (error, response, body) {
                if (error) {
                    res.send({
                        status: false,
                        error: error,
                        message: 'Something went wrong'
                    })
                } else {
                    res.send({
                        status: true,
                        data: JSON.parse(body),
                        message: 'Data found successfully'
                    })
                }
            });
        } else {
            res.send({
                status: false,
                message: 'Exchange not available'
            })
        }
    }else{
        res.send({
            status:false,
            message:'symbol and exchange is required.'
        });
    }

})//end getPrice

//listCurrentUserExchanges
router.post('/listCurrentUserExchanges', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let user_id = req.body.user_id
    let application_mode = req.body.application_mode
    let exchangesArr = ['binance', 'kraken']

    if (typeof application_mode != 'undefined' && application_mode == 'test' && typeof user_id != 'undefined' && user_id != ''){

        res.send({
            status: true,
            data: exchangesArr,
            message: 'Exchanges found successfully.'
        });

    }else if (typeof user_id != 'undefined' && user_id != '') {


        res.send({
            status: true,
            data: exchangesArr,
            message: 'Exchanges found successfully.'
        });
        return false;

        conn.then(async (db) => {

            let settingsArr = {}
            exchangesArr.map(exchange =>{
                let collectionName = exchange == 'binance' ? 'users' : exchange +'_credentials'
                if(exchange == 'binance'){
                    var where = {
                        '_id': new ObjectID(user_id)
                    }
                    settingsArr[exchange] = db.collection(collectionName).find(where).project().toArray();
                }else{
                    var where = {
                        'user_id': user_id
                    }
                    settingsArr[exchange] = db.collection(collectionName).find(where).project().toArray();
                }
            })
            let myPromises = await Promise.all([settingsArr.binance, settingsArr.bam, settingsArr.kraken])

            if (myPromises[0].length == 0 && myPromises[1].length == 0){
                res.send({
                    status: false,
                    data: {},
                    message: 'Something went wrong'
                });
            }else{

                let available_exchanges = []

                let binance = false
                if (myPromises[0].length) {
                    binance = myPromises[0][0]
                    binance = typeof binance.api_key != 'undefined' && binance.api_key != '' && typeof binance.api_secret != 'undefined' && binance.api_secret != '' ? true : false
                }
                // let bam = false
                // if (myPromises[1].length){
                //     bam = myPromises[1][0]
                //     bam = typeof bam.api_key != 'undefined' && bam.api_key != '' && typeof bam.api_secret != 'undefined' && bam.api_secret != '' ? true : false
                // }
                let kraken = false
                if (myPromises[2].length > 0){
                    kraken = myPromises[2][0]
                    kraken = typeof kraken.api_key != 'undefined' && kraken.api_key != '' && typeof kraken.api_secret != 'undefined' && kraken.api_secret != '' ? true : false
                }

                if (binance){
                    available_exchanges.push('binance')
                }
                // if (bam){
                //     available_exchanges.push('bam')
                // }
                if (kraken){
                    available_exchanges.push('kraken')
                }

                if (available_exchanges.length > 0 ){
                    // if (available_exchanges.length == 1 && available_exchanges[0] == 'kraken'){
                    //     res.send({
                    //         status: false,
                    //         data: available_exchanges,
                    //         message: 'Auto trade generator for kraken is coming soon.'
                    //     });
                    // }else{

                        // if (available_exchanges.includes('kraken')){
                        //     available_exchanges = available_exchanges.filter(item => item != 'kraken')
                        // }

                        res.send({
                            status: true,
                            data: available_exchanges,
                            message: 'Exchanges found successfully.'
                        });

                    // }
                }else{
                    res.send({
                        status: false,
                        data: available_exchanges,
                        message: 'Exchanges not found please add API Key/Secret.'
                    });
                }
            }

        })
    } else {
        res.send({
            status: false,
            message: 'user_id is required.'
        });
    }
})//end listCurrentUserExchanges

async function getUserExchangesWithAPISet(user_id){
    return new Promise((resolve)=>{
        conn.then(async (db) => {
            let exchangesArr = ['binance', 'kraken']
            let settingsArr = {}
            exchangesArr.map(exchange => {
                let collectionName = exchange == 'binance' ? 'users' : exchange + '_credentials'
                if (exchange == 'binance') {
                    var where = {
                        '_id': new ObjectID(user_id),
                        'api_key': { '$ne': null },
                        'api_secret': { '$ne': null },
                    }
                    settingsArr[exchange] = db.collection(collectionName).find(where).project().toArray();
                } else {
                    var where = {
                        'user_id': user_id,
                        'api_key': {'$ne': null },
                        'api_secret': {'$ne': null },
                    }
                    settingsArr[exchange] = db.collection(collectionName).find(where).project().toArray();
                }
            })
            let myPromises = await Promise.all([settingsArr.binance, settingsArr.kraken])
            if (myPromises[0].length == 0 && myPromises[1].length == 0) {
                resolve([])
            } else {
                let available_exchanges = []
                let binance = false
                if (myPromises[0].length) {
                    binance = myPromises[0][0]
                    binance = typeof binance.api_key != 'undefined' && binance.api_key != '' && typeof binance.api_secret != 'undefined' && binance.api_secret != '' ? true : false
                }
                // let bam = false
                // if (myPromises[1].length) {
                //     bam = myPromises[1][0]
                //     bam = typeof bam.api_key != 'undefined' && bam.api_key != '' && typeof bam.api_secret != 'undefined' && bam.api_secret != '' ? true : false
                // }
                let kraken = false
                if (myPromises[1].length > 0){
                    kraken = myPromises[1][0]
                    kraken = typeof kraken.api_key != 'undefined' && kraken.api_key != '' && typeof kraken.api_secret != 'undefined' && kraken.api_secret != '' ? true : false
                }

                if (binance) {
                    available_exchanges.push('binance')
                }
                // if (bam) {
                //     available_exchanges.push('bam')
                // }
                if (kraken) {
                    available_exchanges.push('kraken')
                }
                resolve(exchangesArr)
            }
        })
    })
}

router.post('/get_user_exchanges', auth_token.required, async (req,res) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    let user_id = typeof req.body.user_id != 'undefined' && req.body.user_id != '' ? req.body.user_id : ''
    if(user_id != ''){
        let result =  await getUserExchangesWithAPISet(user_id)
        res.send({
            'status': true,
            'data': result,
            'message': 'Data found',
        })
    }else{
        res.send({
            'status':false,
            'message': 'user_id is required',
        })
    }
})



//getAutoTradeSettings
router.post('/getAutoTradeSettings', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let user_id = req.body.user_id
    let application_mode = req.body.application_mode

    if (typeof user_id != 'undefined' && user_id != '' && typeof application_mode != 'undefined' && application_mode != '') {

        conn.then(async (db) => {

            let exchangesArr = ['binance', 'bam', 'kraken']
            let settingsArr = {}
            exchangesArr.map(exchange =>{
                let collectionName = exchange == 'binance' ? 'auto_trade_settings' : 'auto_trade_settings_' + exchange
                var where = {
                    'user_id': user_id,
                    'application_mode': application_mode,
                }
                settingsArr[exchange] = db.collection(collectionName).find(where).toArray();
            })
            let myPromises = await Promise.all([settingsArr.binance, settingsArr.bam, settingsArr.kraken])

            if (myPromises[0].length == 0 && myPromises[1].length == 0 && myPromises[2].length == 0){
                res.send({
                    status: true,
                    data: {},
                    message: 'Auto trade settings are not set.'
                });
            }else{
                res.send({
                    status: true,
                    data: {
                        'binance': myPromises[0],
                        'bam': myPromises[1],
                        'kraken': myPromises[2],
                    },
                    message: 'Settings found successfully.'
                });
            }

        })
    } else {
        res.send({
            status: false,
            message: 'user_id and application_mode is required.'
        });
    }
})//end getAutoTradeSettings

async function getAutoTradeSettings(user_id, exchange, application_mode) {
    return new Promise(async (resolve)=>{
        conn.then(async (db) => {
                let collectionName = exchange == 'binance' ? 'auto_trade_settings' : 'auto_trade_settings_' + exchange
                var where = {
                    'user_id': user_id,
                    'application_mode': application_mode,
                }
                let settingsArr = await db.collection(collectionName).find(where).toArray();
            if (settingsArr.length > 0){
                resolve(settingsArr)
            }
            resolve(false)
        })
    })
}

async function getAutoTradeParents(user_id, exchange, application_mode) {
    return new Promise(async (resolve) => {
        conn.then(async (db) => {
            let collectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
            var where = {
                'admin_id': user_id,
                'application_mode': application_mode,
                'auto_trade_generator': 'yes',
                'parent_status': 'parent',
                'status': {
                    '$in': ['new', 'takingOrder']
                }
            }
            let settingsArr = await db.collection(collectionName).find(where).toArray();
            if (settingsArr.length > 0) {
                resolve(settingsArr)
            }
            resolve([])
        })
    })
}

//getAutoTradeSettings
router.post('/getAutoTradeParents', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    let user_id = req.body.user_id
    let application_mode = req.body.application_mode
    let exchange = req.body.exchange

    if (typeof user_id != 'undefined' && user_id != '' && typeof application_mode != 'undefined' && application_mode != '' && typeof exchange != 'undefined' && exchange != '') {

        let parentTrades = await getAutoTradeParents(user_id, exchange, application_mode)
        if (parentTrades.length > 0){

            let parent_order_ids = []
            await Promise.all(parentTrades.map(item => {parent_order_ids.push(item['_id'])}))

            var myPromises = []
            conn.then(async (db) => {
                //find only today buy trades
                let startTime = new Date();
                let endTime = new Date();
                startTime.setHours(startTime.getHours() - 24)
                let buyCollectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
                let soldCollectionName = exchange == 'binance' ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange
                var where = {
                    'buy_parent_id': {'$in': parent_order_ids},
                    'status': {
                        '$nin': [
                            'canceled',
                            'error',
                            'new_ERROR',
                            'FILLED_ERROR',
                            'submitted_ERROR',
                            'LTH_ERROR',
                            'canceled_ERROR',
                            'credentials_ERROR',
                        ]
                    },
                    'buy_date': {
                        '$gte': startTime,
                        '$lte': endTime
                    },
                }
                let p1 = db.collection(buyCollectionName).aggregate([
                    {'$match': where},
                    { "$group": { "_id": "$buy_parent_id", "count": { "$sum": 1 } } },
                    { "$project": { "buy_parent_id": 1, "count": 1 } }
                ]).toArray();
                let p2 = db.collection(soldCollectionName).aggregate([
                    {'$match': where},
                    { "$group": { "_id": "$buy_parent_id", "count": { "$sum": 1 } } },
                    { "$project": { "buy_parent_id": 1, "count": 1 } }
                ]).toArray();
                myPromises = await Promise.all([p1, p2])

                res.send({
                    status: true,
                    data: {
                        'parentTrades': parentTrades,
                        'buyTradeCount': myPromises[0],
                        'sellTradeCount': myPromises[1],
                    },
                    message: 'Parent trades found successfully',
                });
            })
        }else{
            res.send({
                status: false,
                message: 'Parent trades not found',
            });
        }
    } else {
        res.send({
            status: false,
            message: 'user_id, exchange and  application_mode is required.'
        });
    }
})//end getAutoTradeSettings

// get User Manual Triggers
router.post('/get_user_manual_triggers', auth_token.required, async (req,res) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }
    let user_id = typeof req.body.user_id != 'undefined' && req.body.user_id != '' ? req.body.user_id : ''
    let application_mode = typeof req.body.application_mode != 'undefined' && req.body.application_mode != '' ? req.body.application_mode : ''
    let exchange = typeof req.body.exchange != 'undefined' && req.body.exchange != '' ? req.body.exchange : ''
    let coins = req.body.coins


    let collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange


    let where = {
        'admin_id': user_id,
        'application_mode': application_mode,
        'parent_status': 'parent',
        'status': { '$ne': 'canceled' },
        'auto_trade_generator': { '$ne': 'yes' },
        'symbol': { '$in': coins}
    }

    console.log(where, "===> where")

    conn.then(async (db) => {
        var Total_count = await db.collection(collectionName).find(where).count();
        res.send({status: true, count: Total_count, message: 'Count for Manaully Created Triggers.'});
    });
});

//saveAutoTradeSettings
router.post('/saveAutoTradeSettings', auth_token.required, async (req, res) => {


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }


    var auth_token = req.headers.authorization;

    let user_id = req.body.user_id
    let exchange = req.body.exchange
    let dataArr = req.body.data
    let application_mode = req.body.application_mode
    let trading_ip = req.body.trading_ip
    // let exchangesArr = ['binance', 'bam', 'kraken']

    if (typeof user_id != 'undefined' && user_id != '' && typeof exchange != 'undefined' && exchange != '' && typeof application_mode != 'undefined' && application_mode != '') {

        dataArr['step_1'] = {'exchange': exchange}
        let autoTradeData = {
            'user_id': user_id,
            'exchange': exchange,
            'settings': dataArr,
            'application_mode': application_mode
        }

        conn.then(async (db) => {
            let collectionName = exchange == 'binance' ? 'auto_trade_settings' : 'auto_trade_settings_' + exchange
            var where = {
                'user_id': user_id,
                'application_mode': application_mode,
            }
            let userSettings = await db.collection(collectionName).find(where).toArray();
            //update settings I already exist for this user
            if (userSettings.length > 0){
                delete dataArr._id
                delete dataArr.week_start_date
                delete dataArr.created_date

                dataArr['modified_date'] = new Date()
                let set = {};
                set['$set'] = dataArr
                let settings = await db.collection(collectionName).updateOne(where, set);

                if (application_mode == 'live') {
                    let field_name = exchange ==  'binance' ? 'atg_parents_update_cron_last_run' : 'atg_parents_update_cron_last_run_' + exchange
                    let tempUpdArr = {}
                    tempUpdArr[field_name] = new Date()

                    //update maxBtcCustomPackage, maxUsdtCustomPackage in users coll
                    let maxBtcCustomPackage = typeof dataArr['step_4'] != 'undefined' && typeof dataArr['step_4']['maxBtcCustomPackage'] != 'undefined' ? dataArr['step_4']['maxBtcCustomPackage'] : ''
                    let maxUsdtCustomPackage = typeof dataArr['step_4'] != 'undefined' && typeof dataArr['step_4']['maxUsdtCustomPackage'] != 'undefined' ? dataArr['step_4']['maxUsdtCustomPackage'] : ''
                    tempUpdArr['maxBtcCustomPackage'] = maxBtcCustomPackage
                    tempUpdArr['maxUsdtCustomPackage'] = maxUsdtCustomPackage

                    let maxDailTradeAbleBalancePercentage = typeof dataArr['step_4'] != 'undefined' && typeof dataArr['step_4']['maxDailTradeAbleBalancePercentage'] != 'undefined' ? dataArr['step_4']['maxDailTradeAbleBalancePercentage'] : ''

                    tempUpdArr['maxDailTradeAbleBalancePercentage'] = maxDailTradeAbleBalancePercentage

                    db.collection('users').updateOne({ '_id': new ObjectID(user_id) }, { '$set': tempUpdArr });
                }

                saveATGLog(user_id, exchange, 'update', 'Auto trade settings update manually successful', application_mode)

                await checkIfBnbAutoBuyNeeded(user_id, exchange, application_mode, trading_ip)

                if(application_mode == 'live'){
                    await createAutoTradeParents(autoTradeData)
                }else{
                    await createAutoTradeParents_test(autoTradeData)
                }

                res.send({
                    status: true,
                    message: 'Auto trade settings updated successfully'
                })

            }else{

                //Insert auto trade settings
                let data = dataArr
                data['user_id'] = user_id
                data['application_mode'] = application_mode
                data['usedDailyTrades'] = 0
                data['weeklyTrades'] = 35
                data['usedWeeklyTrades'] = 0
                data['week_start_date'] = new Date()
                dataArr['created_date'] = new Date()
                dataArr['modified_date'] = new Date()

                let settings = await db.collection(collectionName).insertOne(data);

                var reqObj = {
                    'type': 'POST',
                    'url': 'https://app.digiebot.com/admin/Api_calls/important_user_activity_logs',
                    'headers':{
                      'Authorization': auth_token
                    },
                    'payload': {
                        'user_id': String(user_id),
                        'type': 'ATG',
                        'log': 'ATG settings created ',
                    },
                }
                var apiResult = await customApiRequest(reqObj)

                if (application_mode == 'live') {
                    let field_name = exchange == 'binance' ? 'atg_parents_update_cron_last_run' : 'atg_parents_update_cron_last_run_' + exchange
                    let tempUpdArr = {}
                    tempUpdArr[field_name] = new Date()

                    //update maxBtcCustomPackage, maxUsdtCustomPackage in users coll
                    let maxBtcCustomPackage = typeof dataArr['step_4'] != 'undefined' && typeof dataArr['step_4']['maxBtcCustomPackage'] != 'undefined' ? dataArr['step_4']['maxBtcCustomPackage'] : ''
                    let maxUsdtCustomPackage = typeof dataArr['step_4'] != 'undefined' && typeof dataArr['step_4']['maxUsdtCustomPackage'] != 'undefined' ? dataArr['step_4']['maxUsdtCustomPackage'] : ''

                    tempUpdArr['maxBtcCustomPackage'] = maxBtcCustomPackage
                    tempUpdArr['maxUsdtCustomPackage'] = maxUsdtCustomPackage

                    let maxDailTradeAbleBalancePercentage = typeof dataArr['step_4'] != 'undefined' && typeof dataArr['step_4']['maxDailTradeAbleBalancePercentage'] != 'undefined' ? dataArr['step_4']['maxDailTradeAbleBalancePercentage'] : ''

                    tempUpdArr['maxDailTradeAbleBalancePercentage'] = maxDailTradeAbleBalancePercentage

                    db.collection('users').updateOne({ '_id': new ObjectID(user_id) }, { '$set': tempUpdArr });
                }

                saveATGLog(user_id, exchange, 'new', 'Auto trade settings added manually successful', application_mode)

                await checkIfBnbAutoBuyNeeded(user_id, exchange, application_mode, trading_ip)

                if (application_mode == 'live') {

                    autoTradeData['make_higher_sort_priority'] = 'yes'

                    await createAutoTradeParents(autoTradeData)
                } else {
                    await createAutoTradeParents_test(autoTradeData)
                }

                res.send({
                    status: true,
                    message: 'Auto trade settings saved successfully'
                })

            }

        })
    } else {
        res.send({
            status: false,
            message: 'user_id and exchange is required.'
        });
    }

})//end saveAutoTradeSettings

async function checkIfBnbAutoBuyNeeded(user_id, exchange, application_mode, trading_id=''){
    return new Promise(async resolve=>{
        //set BNB if not already set
        if ((exchange == 'binance' || exchange == 'bam') && application_mode == 'live') {
            let bnbAutoBuySetting = await getBnbBuySettings(user_id, exchange)
            // console.log(bnbAutoBuySetting)
            if (bnbAutoBuySetting.length == 0) {
                //set Auto buy bnb for very minimum val
                //by default use BTC as base currency
                //Insert CoinAutoBuy settings
                let buyArr = {
                    'admin_id': user_id,
                    'application_mode': 'live',
                    'symbol': 'BNBBTC',
                    'buy_currency': 'BTC',
                    'auto_buy': 'yes',
                    'trigger_buy_usdt_worth': 5,
                    'auto_buy_usdt_worth': 5,
                    'created_date': new Date(),
                    'updated_date': new Date(),
                }
                if (await coinAutoBuy(buyArr, exchange)) {
                    hit_auto_buy_cron(user_id, exchange)
                }
            }
        }
        resolve(true)
    })
}


router.get('/checkBnbMissingUsers', auth_token.required, async (req, res)=>{


    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    const db = await conn

    let user_ids = [
        // "5ce5c30efc9aadb43a5107b2",
        // "5eacb7127e3d9a5d907991f6",
        // "5ec09dd0de3bad2b8e1a0c83",
        // "5ec4010e3d54ca3f5e64ea55",
        // "5ece18f12c0ea241bf7bc374",
        // "5f6cba84e08cd706a933d5bc",


        // "5ff2378fb355937f37164483",
        // "5f647ec346781e3f6147ad34",
        // "5f9928063297197e4676d4f6",
        // "5ff0ebcc46ab4e637e332df4",
        // "5ff237a52812ce43842ac7d7",
        // "5ff417b3bcda3155d8242ea2",
        // "5ff83b18cdfba428f534c593",
        // "5ff85a99b8e1ff3dfc619159",
        // "5ffc8a1c1cdf025c7c7c5ee5",
    ]

    let collectionName = 'user_wallet'

    let result = await db.collection(collectionName).find({'coin_symbol':'BNB', 'user_id':{'$in':user_ids}, 'coin_balance':{'$lte':0}}).toArray()

    for(let i=0; i<result.length; i++){

        // console.log(result[i]['user_id'])
        // await checkIfBnbAutoBuyNeeded(result[i]['user_id'], 'binance', 'live')
        break;
    }

    // console.log(result)

    res.send({})

})

//getBtcUsdtBalance
router.post('/getBtcUsdtBalance', auth_token.required, async (req, res) => {

    var user_exist = await getUserByID(req.payload.id);
    // console.log(user_exist)
    if(!user_exist){
        resp.status(401).send({
            message: 'User Not exist'
        });
        return false;
    }

    let user_id = req.body.user_id
    let exchange = req.body.exchange
    if (typeof user_id != 'undefined' && user_id != '' && typeof exchange != 'undefined' && exchange != '') {

        conn.then(async (db) => {
            let collectionName = exchange == 'binance' ? 'user_wallet' : 'user_wallet_' + exchange
            var where = {
                'user_id': user_id,
                'coin_symbol': {$in:['BTC', 'USDT', 'BNB']}
            }
            let balanceArr = await db.collection(collectionName).find(where).toArray();
            if (balanceArr.length > 0) {
                res.send({
                    status: true,
                    data: balanceArr,
                    message: 'Data found successfully'
                })
            } else {
                res.send({
                    status: false,
                    data: [],
                    message: 'Data not found'
                })
            }
        })
    } else {
        res.send({
            status: false,
            message: 'user_id and exchange is required.'
        });
    }

})//end getBtcUsdtBalance

async function getBtcUsdtBalance(user_id, exchange){
    return new Promise(async (resolve) => {
        conn.then(async (db) => {
            let collectionName = exchange == 'binance' ? 'user_wallet' : 'user_wallet_' + exchange
            var where = {
                'user_id': user_id,
                'coin_symbol': { $in: ['BTC', 'USDT', 'BNB'] }
            }
            let balanceArr = await db.collection(collectionName).find(where).toArray()
            if (balanceArr.length > 0){
                resolve(balanceArr)
            }

            let defualt = [
                {
                    'coin_balance': 0,
                    'coin_symbol': "BTC",
                    'user_id': user_id,
                    '_id': '',
                },
                {
                    'coin_balance': 0,
                    'coin_symbol': "USDT",
                    'user_id': user_id,
                    '_id': '',
                }
            ]

            if(exchange != 'binance' && exchange != 'bam'){
                defualt.push({'coin_balance': 0, 'coin_symbol': "BNB", 'user_id': user_id, '_id': ''})
            }
            resolve(defualt)
        })
    })
}

async function saveATGLog(user_id, exchange, log_type, log_message, application_mode=''){
    return new Promise(async (resolve)=>{
        conn.then(async (db) => {
            let collectionName = exchange == 'binance' ? 'auto_trade_settings_log' : 'auto_trade_settings_log_' + exchange
            let obj = {
                'user_id': user_id,
                'application_mode': application_mode,
                'log_type': log_type,
                'log_message': log_message,
                'created_date': new Date(),
            }
            await db.collection(collectionName).insertOne(obj)
            resolve(true)
        })
    })
}


async function runDailyLimitUpdateCron(user_id, exchange){
    return new Promise(async resolve =>{
        const db = await conn
        //check if daily limit not exist calculate again
        let limit_collection = exchange == 'binance' ? 'daily_trade_buy_limit' : 'daily_trade_buy_limit_'+exchange
        let where = {
            'user_id': user_id,
        }


        // console.log(user_id, exchange, limit_collection)
        let dailyLimit = await db.collection(limit_collection).find(where).toArray()

        // console.log('CRONE 11111 ============================ ', dailyLimit)

        if (dailyLimit.length > 0){
            //get ATG settings and update daily limit fields on ATG update
            let ATG_collection = exchange == 'binance' ? 'auto_trade_settings' : 'auto_trade_settings_'+exchange
            let ATG_settings = await db.collection(ATG_collection).find({'application_mode':'live', 'user_id':user_id}).toArray()

            // console.log(ATG_settings[0]['step_4']['dailyTradeableBTC'], ATG_settings[0]['step_4']['dailyTradeableUSDT'])

            if (ATG_settings.length > 0){

                if (typeof ATG_settings[0]['step_4'] != 'undefined'){

                    if (typeof ATG_settings[0]['step_4']['dailyTradeableBTC'] != 'undefined' && typeof ATG_settings[0]['step_4']['dailyTradeableUSDT'] != 'undefined'){

                        var pricesObj = await get_current_market_prices(exchange, ['BTCUSDT'])
                        var BTCUSDTPRICE = parseFloat(pricesObj['BTCUSDT'])

                        var dailyTradeableBTC = ATG_settings[0]['step_4']['dailyTradeableBTC']
                        var dailyTradeableUSDT = ATG_settings[0]['step_4']['dailyTradeableUSDT']
                        var dailyTradeableBTC_usd_worth = parseFloat((ATG_settings[0]['step_4']['dailyTradeableBTC'] * BTCUSDTPRICE).toFixed(2))
                        var dailyTradeableUSDT_usd_worth = parseFloat((ATG_settings[0]['step_4']['dailyTradeableUSDT']).toFixed(2))
                        var daily_buy_usd_limit = parseFloat((dailyTradeableBTC_usd_worth + dailyTradeableUSDT_usd_worth).toFixed(2))

                        // console.log('CRONE ============================ ', ATG_settings[0]['step_4']['dailyTradeableBTC'], ATG_settings[0]['step_4']['dailyTradeableUSDT'])


                        //user_id not equal to admin and vizzdeveloper
                        if (user_id != '5c0912b7fc9aadaac61dd072' && user_id != '5c0915befc9aadaac61dd1b8'){
                            //update limit collection value
                            await db.collection(limit_collection).updateOne(where, {
                                '$set':{
                                    'dailyTradeableBTC': !isNaN(dailyTradeableBTC) ? dailyTradeableBTC : 0,
                                    'dailyTradeableUSDT': !isNaN(dailyTradeableUSDT) ? dailyTradeableUSDT : 0,
                                    'dailyTradeableBTC_usd_worth': !isNaN(dailyTradeableBTC_usd_worth) ? dailyTradeableBTC_usd_worth : 0,
                                    'dailyTradeableUSDT_usd_worth': !isNaN(dailyTradeableUSDT_usd_worth) ? dailyTradeableUSDT_usd_worth : 0,
                                    'daily_buy_usd_limit': !isNaN(daily_buy_usd_limit) ? daily_buy_usd_limit : 0,
                                    'modified_date': new Date()
                                }
                            })
                        }

                        //set pick parent to yes
                        let buy_collection = exchange == 'binance' ? 'buy_orders' : 'buy_orders_'+exchange
                        await db.collection(buy_collection).updateMany({ 'application_mode': 'live', 'admin_id': user_id, 'parent_status': 'parent', 'status': { '$ne': 'canceled' } }, { '$set': { 'pick_parent': 'yes'} })
                    }
                }

            }

            // resolve(false)
        }else{
            //Hit Cron
            var cron_name = exchange == 'binance' ? 'update_daily_buy_limit' : 'update_daily_buy_limit_'+exchange
            var save_history = 'no'
            var reqObj = {
                'type': 'GET',
                'url': 'http://app.digiebot.com/admin/trading_reports/cronjob/' + cron_name + '/' + user_id + '/' + save_history,
                'payload': {},
            }
            var apiResult = await customApiRequest(reqObj)
        }


        // console.log('Before Cron 2')

        //Hit Cron2
        var cron_name = exchange == 'binance' ? 'unset_pick_parent_based_on_base_currency_daily_limit' : 'unset_pick_parent_based_on_base_currency_daily_limit_' + exchange
        var save_history = 'no'
        var reqObj = {
            'type': 'GET',
            'url': 'http://app.digiebot.com/admin/trading_reports/cronjob/' + cron_name,
            'payload': {},
        }
        var apiResult = await customApiRequest(reqObj)
        resolve(true)
    })
}
async function getUsersHighLowRangevaluesMethod(admin_id,symbol,exchange){
    return new Promise(async (resolve)=>{
        let db = await conn
        let collection = exchange == 'binance' ? 'buy_orders' : 'buy_orders_'+exchange;

        let result = await db.collection(collection).find({"parent_status":"parent","pause_status":"play","trigger_type":"barrier_percentile_trigger","application_mode":"live","admin_id":admin_id,"symbol":symbol}).sort({'_id':-1}).limit(1).toArray()


        resolve(result)

    })
}
async function getUserRemainingLimit(user_id, exchange){
    return new Promise(async (resolve)=>{
        let db = await conn
        let daily_limit_collection = exchange == 'binance' ? 'daily_trade_buy_limit' : 'daily_trade_buy_limit_'+exchange;

        let result = await db.collection(daily_limit_collection).aggregate([
            {
                '$match' : {
                    'user_id': user_id
                }
            },
            {
                '$addFields':{
                    'remaining_btc_usd_limit': {
                        '$subtract': ['$dailyTradeableBTC_usd_worth', '$daily_bought_btc_usd_worth']
                    },
                    'remaining_usdt_usd_limit': {
                        '$subtract': ['$dailyTradeableUSDT_usd_worth', '$daily_bought_usdt_usd_worth']
                    }
                }
            },
            {
                '$project':{
                    'remaining_btc_usd_limit': 1,
                    'remaining_usdt_usd_limit': 1,
                    '_id': 0
                }
            }
        ]).toArray()

        let remaining_btc_usd_limit = (result.length > 0 && !isNaN(result[0]['remaining_btc_usd_limit'])) ? result[0]['remaining_btc_usd_limit'] : 0
        let remaining_usdt_usd_limit = (result.length > 0 && !isNaN(result[0]['remaining_usdt_usd_limit'])) ? result[0]['remaining_usdt_usd_limit'] : 0

        resolve({
            'remaining_btc_usd_limit': remaining_btc_usd_limit,
            'remaining_usdt_usd_limit': remaining_usdt_usd_limit,
        })

    })
}

router.get('/mytest', async(req, res)=>{

    // await getUserRemainingLimit('5c0915befc9aadaac61dd1b8', 'binance')

    let coinData = await listmarketPriceMinNotationCoinArr('XRPBTC', 'binance')
    res.send({ 'status': true, 'data': coinData})
})

async function listmarketPriceMinNotationCoinArr(coin, exchange) {
    //get market min notation for a coin minnotation mean minimum qty required for an order buy or sell and also detail for hoh many fraction point allow for an order
    // var marketMinNotationPromise = marketMinNotation(req.body.coin);

    return new Promise(async (resolve) => {

        var marketMinNotationPromise = marketMinNotation_with_step_size_arr(coin, exchange);
        var currentMarketPricePromise = listCurrentMarketPriceArr(coin, exchange);

        var promisesResult = await Promise.all([marketMinNotationPromise, currentMarketPricePromise]);
        if (promisesResult[0].length > 0 && promisesResult[1].length > 0){
            let coinObjArr = {}
            promisesResult[1].map(item=>{
                coinObjArr[item.coin] = {}
                coinObjArr[item.coin]['currentmarketPrice'] = item.price
                let notationObj =  promisesResult[0].find(item2=>{return item2.symbol == item.coin ? true : false })

                // console.log(item.coin, item.price, notationObj)
                if(typeof notationObj !== 'undefined'){
                  coinObjArr[item.coin]['marketMinNotation'] = typeof (notationObj.min_notation) !== 'undefined' ? notationObj.min_notation : 0;
                  coinObjArr[item.coin]['marketMinNotationStepSize'] = typeof (notationObj.step_size) !== 'undefined' ? notationObj.step_size : 0;
                } else {
                  coinObjArr[item.coin]['marketMinNotation'] = 0
                  coinObjArr[item.coin]['marketMinNotationStepSize'] = 0
                }
            })
            resolve(coinObjArr)
        }else{
            resolve(false)
        }
    })
} //End of listmarketPriceMinNotationCoinArr

async function createAutoTradeParents(settings){
    return new Promise(async (resolve) => {
        // resolve(true)

        var db = await conn

        let user_id = settings.user_id
        let application_mode = settings.application_mode
        let exchange = settings.settings.step_1.exchange
        let coins = settings.settings.step_2.coins
        let bots = settings.settings.step_3.bots
        let step4 = settings.settings.step_4

        // let btcPerTrade = step4.dailyTradeableBTC / step4.noOfDailyBTCTrades
        // let usdtPerTrade = step4.dailyTradeableUSDT / step4.noOfDailyUSDTTrades

        let btcPerTrade = step4.dailyTradeableBTC
        let usdtPerTrade = step4.dailyTradeableUSDT

        let profit_percentage = step4.profit_percentage
        let stop_loss = step4.stop_loss
        let loss_percentage = step4.loss_percentage
        let lth_profit = step4.lth_profit
        let lth_functionality = step4.lth_functionality
        let cancel_previous_parents = step4.cancel_previous_parents
        let remove_duplicates = step4.remove_duplicates

        let coinsWorthArr = await findCoinsTradeWorth(step4.totalTradeAbleInUSD, step4.dailyTradeableBTC, step4.dailyTradeableUSDT, coins, exchange)
        // console.log('coinsWorthArr ', coinsWorthArr)
        // process.exit(0)

        let whereCoins = { '$in': coins}
        let coinData = await listmarketPriceMinNotationCoinArr(whereCoins, exchange)
        let btcCoinObj = await listmarketPriceMinNotationCoinArr('BTCUSDT', exchange)
        let BTCUSDTPRICE = parseFloat(btcCoinObj['BTCUSDT']['currentmarketPrice'])

        let coninsCount = coins.length
        let keepParentIdsArr = []

        var db = await conn
        var collectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
        var level = ''

        let user_remaining_usd_limit = await getUserRemainingLimit(user_id, exchange)
        let user_remaining_limit = 0

        console.log('user_remaining_usd_limit ', user_remaining_usd_limit, 'test')



        //TODO: manual_parents_arrr :: get array of all manual parents grouped by order_level and coins
        let replace_manual_parent = step4.replace_manual_parent


        if(replace_manual_parent == 'yes'){
            var manual_parents_arrr = []
        } else {
           var manual_parents_pipeline = [
                {
                    '$match': {
                        // 'admin_id': '5eb5a5a628914a45246bacc6',
                        'admin_id' : user_id,
                        'application_mode': 'live',
                        'parent_status': 'parent',
                        'status': { '$ne': 'canceled' },
                        'auto_trade_generator': { '$ne': 'yes' }
                    }
                },
                {
                    '$group': {
                        '_id': { 'symbol': '$symbol', 'order_level': '$order_level' },
                        // 'order': { '$push': '$$ROOT' },
                        'total': { '$sum': 1 }
                    }
                },
                {
                    '$project': {
                        '_id': 1,
                        'total': 1
                    }
                },
                {
                    '$sort': {
                        '_id.symbol': 1
                    }
                }
            ]
            var manual_parents_arrr = await db.collection(collectionName).aggregate(manual_parents_pipeline).toArray()
        }





        console.log('Before Loop Start==============================')
        console.log(coins)
        for(let i=0; i<coninsCount; i++){

            let coin = coins[i]

            let currentMarketPrice = coinData[coin]['currentmarketPrice']
            let marketMinNotation = coinData[coin]['marketMinNotation']
            let marketMinNotationStepSize = coinData[coin]['marketMinNotationStepSize']
            var toFixedNum = 6

            //find min required quantity
            var extra_qty_percentage = 40;
            var extra_qty_val = 0;
            extra_qty_val = (extra_qty_percentage * marketMinNotation) / 100
            var calculatedMinNotation = parseFloat(marketMinNotation) + extra_qty_val;
            var minReqQty = 0;
            minReqQty = (calculatedMinNotation / currentMarketPrice);

            if (exchange == 'kraken') {
                minReqQty = calculatedMinNotation
                toFixedNum = 6
            }else{
                toFixedNum = (marketMinNotationStepSize + '.').split('.')[1].length
            }

            minReqQty += marketMinNotationStepSize
            minReqQty = parseFloat(minReqQty.toFixed(toFixedNum))

            //TODO: find one usd worth of quantity
            let selectedCoin = coin;
            let currCoin = coinsWorthArr.filter(item =>{return item.coin == selectedCoin})

            let splitArr = selectedCoin.split('USDT');
            let oneUsdWorthQty = 0;
            var usdWorthQty = 0
            var quantity = 0
            var usd_worth = currCoin.length > 0 ? currCoin[0]['worth'] : 5

            if (splitArr[1] == '') {
                oneUsdWorthQty = 1 / currentMarketPrice

                user_remaining_limit = user_remaining_usd_limit['remaining_usdt_usd_limit']

            } else {
                oneUsdWorthQty = 1 / (currentMarketPrice * BTCUSDTPRICE)

                user_remaining_limit = user_remaining_usd_limit['remaining_btc_usd_limit']
            }

            usd_worth = parseFloat(usd_worth.toFixed(2))
            usdWorthQty = usd_worth * oneUsdWorthQty
            quantity = parseFloat(usdWorthQty.toFixed(toFixedNum))
            // console.log('coin',coin,'quantity', quantity, ' < minReqQty', minReqQty, ' ------ usd_worth', usd_worth, ' :::: ','oneUsdWorthQty', oneUsdWorthQty, ' currentMarketPrice ', currentMarketPrice, 'BTCUSDTPRICE', BTCUSDTPRICE, 'user_remaining_limit', user_remaining_limit)
            // console.log('digie_admin_ids', digie_admin_ids)
            // console.log('user_id', user_id)
            // if(user_remaining_limit > usd_worth){
            //     console.log('yes')
            // } else {
            //     console.log('no')
            // }
            // return false
            // if(coin == 'BTCUSDT'){
            //   console.log(quantity, minReqQty)
            // }
            if (quantity < minReqQty) {
                //Create trades with minReqQty
                for (let index in bots){
                  console.log(i)
                  // if(coin == 'BTCUSDT'){
                  //   console.log(quantity, minReqQty)
                  // }
                    level = bots[index]

                    // IF Replace Manual Order is NO
                    if(replace_manual_parent == 'no'){
                        if(manual_parents_arrr.length > 0){
                            let if_manual_parent_exists = manual_parents_arrr.filter(item => { return item._id.symbol == coin && item._id.order_level == bots[index] }).length > 0 ? true : false
                            if (if_manual_parent_exists){
                                continue;
                            }
                        }
                    }


                    let where1 = {
                        // 'auto_trade_generator': 'yes',
                        'admin_id': user_id,
                        'order_mode': application_mode,
                        'application_mode': application_mode,
                        'order_level': level,
                        'symbol': coin,
                        'parent_status': 'parent',
                        'order_type': 'market_order',
                        'trigger_type': 'barrier_percentile_trigger',
                        'exchange': exchange,
                        'status': { '$ne': 'canceled' },
                    }
                    let set1 = {
                        '$set': {
                            'auto_trade_generator': 'yes',
                            'market_value': '',
                            'price': '',
                            'quantity': minReqQty,
                            'usd_worth': usd_worth,
                            'pick_parent': (digie_admin_ids.includes(user_id) || (user_remaining_limit > usd_worth) ? 'yes' : 'no'),
                            'defined_sell_percentage': profit_percentage,
                            'sell_profit_percent': profit_percentage,
                            'current_market_price': currentMarketPrice,
                            'stop_loss_rule': typeof stop_loss != 'undefined' && stop_loss == 'yes' ? 'custom_stop_loss' : '',
                            'custom_stop_loss_percentage': typeof loss_percentage != 'undefined' ? loss_percentage : '',
                            'loss_percentage': typeof loss_percentage != 'undefined' ? loss_percentage : '',
                            'activate_stop_loss_profit_percentage': 100,
                            'lth_functionality': typeof lth_functionality != 'undefined' ? lth_functionality : '',
                            'lth_profit': typeof lth_profit != 'undefined' ? lth_profit : '',
                            'stop_loss': typeof stop_loss != 'undefined' ? stop_loss : '',
                            'un_limit_child_orders': 'no',
                            'modified_date': new Date(),
                            'is_sell_order': 'no',
                            'sell_price': '',
                            'randomize_sort': (typeof settings.make_higher_sort_priority != 'undefined' && settings.make_higher_sort_priority == 'yes' ? (Math.floor(Math.random() * (1000 - 900 + 1)) + 900) : (Math.floor(Math.random() * (1000 - 0 + 1)) + 0)),
                        }
                    }

                    if (typeof user_id != 'undefined' && digie_admin_ids.includes(user_id)) {
                        set1['$set']['pick_parent'] = 'yes';
                    }

                    let upsert1 = {
                        'upsert': true
                    }
                    // continue
                    db.collection(collectionName).updateOne(where1, set1, upsert1, async function(err, result) {
                        if(err) throw err;
                        if (result.upsertedCount > 0) {
                            let remainingFields = {
                                'market_value': '',
                                'price': '',
                                'status': 'new',
                                'pause_status': 'play',
                                'created_date': set1['$set']['modified_date'],
                            }
                            //get Id and update remaining fields
                            // console.log('Inserted_id ', result.upsertedId._id)
                            db.collection(collectionName).updateOne({ '_id': result.upsertedId._id }, { '$set': remainingFields })

                            //TODO: insert parent creation log
                            let show_hide_log = 'yes'
                            let type = 'parent_created_by_ATG'
                            let log_msg = 'Parent created from auto trade generator.'
                            let order_mode = application_mode
                            create_orders_history_log(result.upsertedId._id, log_msg, type, show_hide_log, exchange, order_mode, remainingFields['created_date'])

                            keepParentIdsArr.push(result.upsertedId._id)

                        } else if (result.modifiedCount > 0) {

                            db.collection(collectionName).find(where1).limit(1).toArray(async function (err, result2) {
                                if (err) throw err;
                                if (result2.length > 0) {
                                    // console.log('modified_id ', String(result2[0]['_id']))

                                    db.collection(collectionName).updateOne({'_id': result2[0]['_id'], 'pause_manually': {'$ne': 'yes'}}, {'$set': {'pause_status': 'play'}})

                                    //TODO: insert parent creation log
                                    let show_hide_log = 'yes'
                                    let type = 'parent_updated_by_ATG_manually'
                                    let log_msg = 'Parent updated from auto trade generator manually.'
                                    let order_mode = application_mode
                                    create_orders_history_log(result2[0]['_id'], log_msg, type, show_hide_log, exchange, order_mode, result2[0]['created_date'])

                                    keepParentIdsArr.push(result2[0]['_id'])
                                }
                            })

                        }
                    })

                }
            } else {
                //Create trades with defined quantity
                for (let index in bots) {
                    console.log(i)
                    // if(coin == 'BTCUSDT'){
                    //   console.log(quantity, minReqQty)
                    // }
                    level = bots[index]

                    // IF Replace Manual Order is NO
                    if(replace_manual_parent == 'no'){
                        if(manual_parents_arrr.length > 0){
                            let if_manual_parent_exists = manual_parents_arrr.filter(item => { return item._id.symbol == coin && item._id.order_level == bots[index] }).length > 0 ? true : false
                            if (if_manual_parent_exists){
                                continue;
                            }
                        }
                    }

                    let where1 = {
                        // 'auto_trade_generator': 'yes',
                        'admin_id': user_id,
                        'order_mode': application_mode,
                        'application_mode': application_mode,
                        'order_level': level,
                        'symbol': coin,
                        'parent_status': 'parent',
                        'order_type': 'market_order',
                        'trigger_type': 'barrier_percentile_trigger',
                        'exchange': exchange,
                        'status': { '$ne': 'canceled' },
                    }
                    let set1 = {
                        '$set': {
                            'auto_trade_generator': 'yes',
                            'market_value': '',
                            'price': '',
                            'quantity': quantity,
                            'usd_worth': usd_worth,
                            'pick_parent': (digie_admin_ids.includes(user_id) || (user_remaining_limit > usd_worth) ? 'yes' : 'no'),
                            'defined_sell_percentage': profit_percentage,
                            'sell_profit_percent': profit_percentage,
                            'current_market_price': currentMarketPrice,
                            'stop_loss_rule': typeof stop_loss != 'undefined' && stop_loss == 'yes' ? 'custom_stop_loss' : '',
                            'custom_stop_loss_percentage': typeof loss_percentage != 'undefined' ? loss_percentage : '',
                            'loss_percentage': typeof loss_percentage != 'undefined' ? loss_percentage : '',
                            'activate_stop_loss_profit_percentage': 100,
                            'lth_functionality': typeof lth_functionality != 'undefined' ? lth_functionality : '',
                            'lth_profit': typeof lth_profit != 'undefined' ? lth_profit : '',
                            'stop_loss': typeof stop_loss != 'undefined' ? stop_loss : '',
                            'un_limit_child_orders': 'no',
                            'modified_date': new Date(),
                            'is_sell_order': 'no',
                            'sell_price': '',
                            'randomize_sort': (typeof settings.make_higher_sort_priority != 'undefined' && settings.make_higher_sort_priority == 'yes' ? (Math.floor(Math.random() * (1000 - 900 + 1)) + 900) : (Math.floor(Math.random() * (1000 - 0 + 1)) + 0)),
                        }
                    }

                    if (typeof user_id != 'undefined' && digie_admin_ids.includes(user_id)) {
                        set1['$set']['pick_parent'] = 'yes';
                    }

                    let upsert1 = {
                        'upsert': true
                    }

                    db.collection(collectionName).updateOne(where1, set1, upsert1, async function(err, result) {
                        if(err) throw err;
                        if (result.upsertedCount > 0) {
                            let remainingFields = {
                                'market_value': '',
                                'price': '',
                                'status': 'new',
                                'pause_status': 'play',
                                'created_date': set1['$set']['modified_date'],
                            }
                            //get Id and update remaining fields
                            // console.log('Inserted_id ', result.upsertedId._id)
                            db.collection(collectionName).updateOne({ '_id': result.upsertedId._id }, { '$set': remainingFields })

                            //TODO: insert parent creation log
                            let show_hide_log = 'yes'
                            let type = 'parent_created_by_ATG'
                            let log_msg = 'Parent created from auto trade generator.'
                            let order_mode = application_mode
                            create_orders_history_log(result.upsertedId._id, log_msg, type, show_hide_log, exchange, order_mode, remainingFields['created_date'])

                            keepParentIdsArr.push(result.upsertedId._id)

                        } else if (result.modifiedCount > 0) {
                            db.collection(collectionName).find(where1).limit(1).toArray(async function(err, result2) {
                                if(err) throw err;
                                if (result2.length > 0) {
                                    // console.log('modified_id ', String(result2[0]['_id']))

                                    db.collection(collectionName).updateOne({ '_id': result2[0]['_id'], 'pause_manually': { '$ne': 'yes' } }, { '$set': { 'pause_status': 'play' } })

                                    //TODO: insert parent creation log
                                    let show_hide_log = 'yes'
                                    let type = 'parent_updated_by_ATG_manually'
                                    let log_msg = 'Parent updated from auto trade generator manually.'
                                    let order_mode = application_mode
                                    create_orders_history_log(result2[0]['_id'], log_msg, type, show_hide_log, exchange, order_mode, result2[0]['created_date'])

                                    keepParentIdsArr.push(result2[0]['_id'])

                                }
                            })

                        }
                    })

                }
            }

        }

        console.log('=================================After Loop End')

        // { "_id" : ObjectId("5ef9cc0184c66a51207a3bb1"), "user_id" : "5c0912b7fc9aadaac61dd072", "daily_buy_usd_worth" : 0, "num_of_trades_buy_today" : 0, "daily_buy_usd_limit" : 41.412846272754, "created_date" : ISODate("2020-06-29T11:09:53Z"), "modified_date" : ISODate("2020-12-29T14:17:42.458Z"), "BTCTradesTodayCount" : 0, "USDTTradesTodayCount" : 0, "dailyTradeableBTC" : 0.27, "dailyTradeableBTC_usd_worth" : 20, "dailyTradeableUSDT" : 5000, "dailyTradeableUSDT_usd_worth" : 20, "daily_bought_btc_usd_worth" : 0, "daily_bought_usdt_usd_worth" : 0 }


        // sleep 7 seconds before sending call next()
        await new Promise(r => setTimeout(r, 7000));
        // console.log('after sleep parents processed: ', keepParentIdsArr.length)


        console.log('================After Wait for Seven Second=============')
        //cancel previous parent orders
        var collectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
        //TODO: if delete previous order selected then delete all previous parents
        if (typeof cancel_previous_parents != 'undefined' && cancel_previous_parents == 'yes' && (coins.length * bots.length) == keepParentIdsArr.length && keepParentIdsArr.length > 0) {
            let filter = {
                '_id': { '$nin': keepParentIdsArr},
                'auto_trade_generator': 'yes',
                'admin_id': user_id,
                'application_mode': application_mode,
                'parent_status': 'parent',
                'status': { '$ne': 'canceled' },
            };
            let set = {};
            set['$set'] = {
                'status': 'canceled',
                'pause_status': 'pause',
                'pick_parent': 'no',
                'pause_by_script': 'no',
                'modified_date': new Date()
            };
            let parents = await db.collection(collectionName).find(filter).project({ '_id': 1, 'application_mode': 1, 'created_date': 1 }).toArray()


            // console.log('Working Till there', parents.length)
            if (parents.length > 0) {
                let deleted = await db.collection(collectionName).updateMany(filter, set)

                parents.map(item => {
                    // TODO: set vars to create log
                    let show_hide_log = 'yes';
                    let type = 'canceled_by_auto_trade_generator';
                    let order_mode = item['application_mode'];
                    let order_created_date = item['created_date'];
                    let log_msg = 'Parent canceled becuase of auto trade generator cancel previous.'
                    //Save LOG
                    create_orders_history_log(item['_id'], log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                })
            }
        }



        // console.log('Before remove duplicate')
        //TODO: cancel duplicate orders if loop end here
        if (typeof remove_duplicates != 'undefined' && remove_duplicates == 'yes' && (coins.length * bots.length) == keepParentIdsArr.length) {
            removeDuplicateParentsOtherThanThese(user_id, exchange, application_mode, keepParentIdsArr)
        }


        // console.log('Before run DailyLimitCron')
        //send update Daily trade limit call on ATG update
        let runDailyCron = await runDailyLimitUpdateCron(user_id, exchange)

        resolve(true)

    })
}

async function createAutoTradeParents_test(settings) {
    return new Promise(async (resolve) => {
        // resolve(true)

        console.log('createAutoTradeParents_test')

        var db = await conn

        let user_id = settings.user_id
        let application_mode = settings.application_mode
        let exchange = settings.settings.step_1.exchange
        let coins = settings.settings.step_2.coins
        let bots = settings.settings.step_3.bots
        let step4 = settings.settings.step_4

        // let btcPerTrade = step4.dailyTradeableBTC / step4.noOfDailyBTCTrades
        // let usdtPerTrade = step4.dailyTradeableUSDT / step4.noOfDailyUSDTTrades

        let btcPerTrade = step4.dailyTradeableBTC
        let usdtPerTrade = step4.dailyTradeableUSDT

        let profit_percentage = step4.profit_percentage
        let stop_loss = step4.stop_loss
        let loss_percentage = step4.loss_percentage
        let lth_profit = step4.lth_profit
        let lth_functionality = step4.lth_functionality
        let cancel_previous_parents = step4.cancel_previous_parents
        let remove_duplicates = step4.remove_duplicates

        let coinsWorthArr = await findCoinsTradeWorth(step4.totalTradeAbleInUSD, step4.dailyTradeableBTC, step4.dailyTradeableUSDT, coins, exchange)
        // console.log('coinsWorthArr ', coinsWorthArr)
        // process.exit(0)

        let whereCoins = { '$in': coins }
        let coinData = await listmarketPriceMinNotationCoinArr(whereCoins, exchange)
        let btcCoinObj = await listmarketPriceMinNotationCoinArr('BTCUSDT', exchange)
        let BTCUSDTPRICE = parseFloat(btcCoinObj['BTCUSDT']['currentmarketPrice'])

        let coninsCount = coins.length
        let keepParentIdsArr = []

        var db = await conn
        var collectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
        var level = ''

        let user_remaining_limit = 7000

        for (let i = 0; i < coninsCount; i++) {

            let coin = coins[i]

            let currentMarketPrice = coinData[coin]['currentmarketPrice']
            let marketMinNotation = coinData[coin]['marketMinNotation']
            let marketMinNotationStepSize = coinData[coin]['marketMinNotationStepSize']
            var toFixedNum = 6

            //find min required quantity
            var extra_qty_percentage = 40;
            var extra_qty_val = 0;
            extra_qty_val = (extra_qty_percentage * marketMinNotation) / 100
            var calculatedMinNotation = parseFloat(marketMinNotation) + extra_qty_val;
            var minReqQty = 0;
            minReqQty = (calculatedMinNotation / currentMarketPrice);

            if (exchange == 'kraken') {
                minReqQty = calculatedMinNotation
                toFixedNum = 6
            } else {
                toFixedNum = (marketMinNotationStepSize + '.').split('.')[1].length
            }

            minReqQty += marketMinNotationStepSize
            minReqQty = parseFloat(minReqQty.toFixed(toFixedNum))

            //TODO: find one usd worth of quantity
            let selectedCoin = coin;
            let currCoin = coinsWorthArr.filter(item => { return item.coin == selectedCoin })

            let splitArr = selectedCoin.split('USDT');
            let oneUsdWorthQty = 0;
            var usdWorthQty = 0
            var quantity = 0
            var usd_worth = currCoin.length > 0 ? currCoin[0]['worth'] : 5

            if (splitArr[1] == '') {
                oneUsdWorthQty = 1 / currentMarketPrice
            } else {
                oneUsdWorthQty = 1 / (currentMarketPrice * BTCUSDTPRICE)
            }

            usd_worth = parseFloat(usd_worth.toFixed(2))
            usdWorthQty = usd_worth * oneUsdWorthQty
            quantity = parseFloat(usdWorthQty.toFixed(toFixedNum))
            // console.log(coin, quantity, ' < ', minReqQty, ' ------ ', usd_worth, ' :::: ', oneUsdWorthQty, ' price ', currentMarketPrice, 'btcusdt_price', BTCUSDTPRICE)

            if (quantity < minReqQty) {
                //Create trades with minReqQty
                for (let index in bots) {

                    level = bots[index]

                    let where1 = {
                        'auto_trade_generator': 'yes',
                        'admin_id': user_id,
                        'order_mode': application_mode,
                        'application_mode': application_mode,
                        'order_level': level,
                        'symbol': coin,
                        'parent_status': 'parent',
                        'order_type': 'market_order',
                        'trigger_type': 'barrier_percentile_trigger',
                        'exchange': exchange,
                        'status': { '$ne': 'canceled' },
                    }
                    let set1 = {
                        '$set': {
                            'market_value': '',
                            'price': '',
                            'quantity': minReqQty,
                            'usd_worth': usd_worth,
                            'pick_parent': (digie_admin_ids.includes(user_id) || (user_remaining_limit > usd_worth) ? 'yes' : 'no'),
                            'defined_sell_percentage': profit_percentage,
                            'sell_profit_percent': profit_percentage,
                            'current_market_price': currentMarketPrice,
                            'stop_loss_rule': typeof stop_loss != 'undefined' && stop_loss == 'yes' ? 'custom_stop_loss' : '',
                            'custom_stop_loss_percentage': typeof loss_percentage != 'undefined' ? loss_percentage : '',
                            'loss_percentage': typeof loss_percentage != 'undefined' ? loss_percentage : '',
                            'activate_stop_loss_profit_percentage': 100,
                            'lth_functionality': typeof lth_functionality != 'undefined' ? lth_functionality : '',
                            'lth_profit': typeof lth_profit != 'undefined' ? lth_profit : '',
                            'stop_loss': typeof stop_loss != 'undefined' ? stop_loss : '',
                            'un_limit_child_orders': 'no',
                            'modified_date': new Date(),
                            'is_sell_order': 'no',
                            'sell_price': '',
                            'randomize_sort': (Math.floor(Math.random() * (1000 - 0 + 1)) + 0),
                        }
                    }

                    if (typeof user_id != 'undefined' && digie_admin_ids.includes(user_id)) {
                        set1['$set']['pick_parent'] = 'yes';
                    }

                    let upsert1 = {
                        'upsert': true
                    }
                    // continue
                    db.collection(collectionName).updateOne(where1, set1, upsert1, async function (err, result) {
                        if (err) throw err;
                        if (result.upsertedCount > 0) {
                            let remainingFields = {
                                'market_value': '',
                                'price': '',
                                'status': 'new',
                                'pause_status': 'play',
                                'created_date': set1['$set']['modified_date'],
                            }
                            //get Id and update remaining fields
                            // console.log('Inserted_id ', result.upsertedId._id)
                            db.collection(collectionName).updateOne({ '_id': result.upsertedId._id }, { '$set': remainingFields })

                            //TODO: insert parent creation log
                            let show_hide_log = 'yes'
                            let type = 'parent_created_by_ATG'
                            let log_msg = 'Parent created from auto trade generator.'
                            let order_mode = application_mode
                            create_orders_history_log(result.upsertedId._id, log_msg, type, show_hide_log, exchange, order_mode, remainingFields['created_date'])

                            keepParentIdsArr.push(result.upsertedId._id)

                        } else if (result.modifiedCount > 0) {

                            db.collection(collectionName).find(where1).limit(1).toArray(async function (err, result2) {
                                if (err) throw err;
                                if (result2.length > 0) {
                                    // console.log('modified_id ', String(result2[0]['_id']))

                                    db.collection(collectionName).updateOne({ '_id': result2[0]['_id'], 'pause_manually': { '$ne': 'yes' } }, { '$set': { 'pause_status': 'play' } })

                                    //TODO: insert parent creation log
                                    let show_hide_log = 'yes'
                                    let type = 'parent_updated_by_ATG_manually'
                                    let log_msg = 'Parent updated from auto trade generator manually.'
                                    let order_mode = application_mode
                                    create_orders_history_log(result2[0]['_id'], log_msg, type, show_hide_log, exchange, order_mode, result2[0]['created_date'])

                                    keepParentIdsArr.push(result2[0]['_id'])
                                }
                            })

                        }
                    })

                }
            } else {
                //Create trades with defined quantity
                for (let index in bots) {

                    level = bots[index]

                    let where1 = {
                        'auto_trade_generator': 'yes',
                        'admin_id': user_id,
                        'order_mode': application_mode,
                        'application_mode': application_mode,
                        'order_level': level,
                        'symbol': coin,
                        'parent_status': 'parent',
                        'order_type': 'market_order',
                        'trigger_type': 'barrier_percentile_trigger',
                        'exchange': exchange,
                        'status': { '$ne': 'canceled' },
                    }
                    let set1 = {
                        '$set': {
                            'market_value': '',
                            'price': '',
                            'quantity': quantity,
                            'usd_worth': usd_worth,
                            'pick_parent': (digie_admin_ids.includes(user_id) || (user_remaining_limit > usd_worth) ? 'yes' : 'no'),
                            'defined_sell_percentage': profit_percentage,
                            'sell_profit_percent': profit_percentage,
                            'current_market_price': currentMarketPrice,
                            'stop_loss_rule': typeof stop_loss != 'undefined' && stop_loss == 'yes' ? 'custom_stop_loss' : '',
                            'custom_stop_loss_percentage': typeof loss_percentage != 'undefined' ? loss_percentage : '',
                            'loss_percentage': typeof loss_percentage != 'undefined' ? loss_percentage : '',
                            'activate_stop_loss_profit_percentage': 100,
                            'lth_functionality': typeof lth_functionality != 'undefined' ? lth_functionality : '',
                            'lth_profit': typeof lth_profit != 'undefined' ? lth_profit : '',
                            'stop_loss': typeof stop_loss != 'undefined' ? stop_loss : '',
                            'un_limit_child_orders': 'no',
                            'modified_date': new Date(),
                            'is_sell_order': 'no',
                            'sell_price': '',
                            'randomize_sort': (Math.floor(Math.random() * (1000 - 0 + 1)) + 0),
                        }
                    }

                    if (typeof user_id != 'undefined' && digie_admin_ids.includes(user_id)) {
                        set1['$set']['pick_parent'] = 'yes';
                    }

                    let upsert1 = {
                        'upsert': true
                    }

                    db.collection(collectionName).updateOne(where1, set1, upsert1, async function (err, result) {
                        if (err) throw err;
                        if (result.upsertedCount > 0) {
                            let remainingFields = {
                                'market_value': '',
                                'price': '',
                                'status': 'new',
                                'pause_status': 'play',
                                'created_date': set1['$set']['modified_date'],
                            }
                            //get Id and update remaining fields
                            // console.log('Inserted_id ', result.upsertedId._id)
                            db.collection(collectionName).updateOne({ '_id': result.upsertedId._id }, { '$set': remainingFields })

                            //TODO: insert parent creation log
                            let show_hide_log = 'yes'
                            let type = 'parent_created_by_ATG'
                            let log_msg = 'Parent created from auto trade generator.'
                            let order_mode = application_mode
                            create_orders_history_log(result.upsertedId._id, log_msg, type, show_hide_log, exchange, order_mode, remainingFields['created_date'])

                            keepParentIdsArr.push(result.upsertedId._id)

                        } else if (result.modifiedCount > 0) {
                            db.collection(collectionName).find(where1).limit(1).toArray(async function (err, result2) {
                                if (err) throw err;
                                if (result2.length > 0) {
                                    // console.log('modified_id ', String(result2[0]['_id']))

                                    db.collection(collectionName).updateOne({ '_id': result2[0]['_id'], 'pause_manually': { '$ne': 'yes' } }, { '$set': { 'pause_status': 'play' } })

                                    //TODO: insert parent creation log
                                    let show_hide_log = 'yes'
                                    let type = 'parent_updated_by_ATG_manually'
                                    let log_msg = 'Parent updated from auto trade generator manually.'
                                    let order_mode = application_mode
                                    create_orders_history_log(result2[0]['_id'], log_msg, type, show_hide_log, exchange, order_mode, result2[0]['created_date'])

                                    keepParentIdsArr.push(result2[0]['_id'])

                                }
                            })

                        }
                    })

                }
            }

        }


        //sleep 7 seconds before sending call next()
        await new Promise(r => setTimeout(r, 7000));
        // console.log('after sleep parents processed: ', keepParentIdsArr.length)

        //cancel previous parent orders
        var collectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange
        //TODO: if delete previous order selected then delete all previous parents
        if (typeof cancel_previous_parents != 'undefined' && cancel_previous_parents == 'yes' && (coins.length * bots.length) == keepParentIdsArr.length && keepParentIdsArr.length > 0) {
            let filter = {
                '_id': { '$nin': keepParentIdsArr },
                'auto_trade_generator': 'yes',
                'admin_id': user_id,
                'application_mode': application_mode,
                'parent_status': 'parent',
                'status': { '$ne': 'canceled' },
            };
            let set = {};
            set['$set'] = {
                'status': 'canceled',
                'pause_status': 'pause',
                'pick_parent': 'no',
                'pause_by_script': 'no',
                'modified_date': new Date()
            };
            let parents = await db.collection(collectionName).find(filter).project({ '_id': 1, 'application_mode': 1, 'created_date': 1 }).toArray()
            if (parents.length > 0) {
                let deleted = await db.collection(collectionName).updateMany(filter, set)

                parents.map(item => {
                    // TODO: set vars to create log
                    let show_hide_log = 'yes';
                    let type = 'canceled_by_auto_trade_generator';
                    let order_mode = item['application_mode'];
                    let order_created_date = item['created_date'];
                    let log_msg = 'Parent canceled becuase of auto trade generator cancel previous.'
                    //Save LOG
                    create_orders_history_log(item['_id'], log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                })
            }
        }

        //TODO: cancel duplicate orders if loop end here
        if (typeof remove_duplicates != 'undefined' && remove_duplicates == 'yes' && (coins.length * bots.length) == keepParentIdsArr.length) {
            removeDuplicateParentsOtherThanThese(user_id, exchange, application_mode, keepParentIdsArr)
        }

        resolve(true)

    })
}

async function removeDuplicateParentsOtherThanThese(user_id, exchange, application_mode){

    //TODO: Remove duplicate parents and only keep these parents
    if (typeof user_id != 'undefined' && user_id != '' && typeof exchange != 'undefined' && exchange != '' && typeof application_mode != 'undefined' && application_mode != 'undefined') {
        conn.then(async (db) => {

            let collectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_'+exchange

            let where = {
                // 'auto_trade_generator': 'yes',
                'admin_id': user_id,
                'application_mode': application_mode,
                'parent_status': 'parent',
                'status': { '$ne': 'canceled' },
            }
            let result = await db.collection(collectionName).find(where).sort({ 'modified_date': -1 }).project({ '_id': 1, 'order_level': 1, 'symbol': 1 }).toArray()

            let duplicateTestObj = {}
            let parentIdsToDelete = []
            result.map(item => {
                let duplicateKey = item.symbol + '_' + item.order_level
                if (!(duplicateKey in duplicateTestObj)) {
                    duplicateTestObj[duplicateKey] = item._id
                } else {
                    parentIdsToDelete.push(item._id)
                }
            })

            let filter = {
                '_id': { '$in': parentIdsToDelete},
                // 'auto_trade_generator': 'yes',
                'admin_id': user_id,
                'application_mode': application_mode,
                'parent_status': 'parent',
                'status': { '$ne': 'canceled' },
            };
            let set = {};
            set['$set'] = {
                'status': 'canceled',
