var express = require('express');
var router = express.Router();
var request = require('request');
const conn = require('../connection/database');
ObjectID = require('mongodb').ObjectID;
var md5 = require('md5');
var app = express();

var auth = require('basic-auth')
var compare = require('tsscmp')
var googleAuthenticator = require('authenticator');

//********************************************************* */
//TODO: verify old password
//verifyOldPassword //Umer Abbas [6-1-2020]
router.post('/verifyOldPassword', async function (req, resp) {
    conn.then(async (db) => {
        let post_data = req.body;
        let user_id = req.body.user_id;
        let password = req.body.password;
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

//when first time user login call this function 
router.post('/authenticate-old', async function (req, resp, next) {
    conn.then(async (db) => {
        let username = req.body.username;
        let pass = req.body.password;
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
                    username: username
                }, {
                    email_address: username
                }]
                where['status'] = '0';
                where['user_soft_delete'] = '0';

                let UserPromise = db.collection('users').find(where).toArray();
                UserPromise.then((userArr) => {
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

                        respObj.id = userArr['_id'];
                        respObj.username = userArr['username'];
                        respObj.firstName = userArr['first_name'];
                        respObj.lastName = userArr['last_name'];
                        respObj.profile_image = userArr['profile_image'];
                        respObj.role = 'admin'; //userArr['user_role'];
                        respObj.token = `fake-jwt-token.`;
                        respObj.email_address = userArr['email_address'];
                        respObj.timezone = userArr['timezone'];
                        respObj.check_api_settings = check_api_settings;
                        respObj.application_mode = app_mode
                        respObj.leftmenu = userArr['leftmenu'];
                        respObj.user_role = userArr['user_role'];
                        respObj.special_role = userArr['special_role'];
                        respObj.google_auth = userArr['google_auth'];
                        respObj.trigger_enable = userArr['trigger_enable'];
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
                username: username
            }, {
                email_address: username
            }]
            where['status'] = '0';
            where['user_soft_delete'] = '0';
            conn.then((db) => {
                let UserPromise = db.collection('users').find(where).toArray();
                UserPromise.then((userArr) => {
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

                        respObj.id = userArr['_id'];
                        respObj.username = userArr['username'];
                        respObj.firstName = userArr['first_name'];
                        respObj.lastName = userArr['last_name'];
                        respObj.profile_image = userArr['profile_image'];
                        respObj.role = 'admin'; //userArr['user_role'];
                        respObj.token = `fake-jwt-token.`;
                        respObj.email_address = userArr['email_address'];
                        respObj.timezone = userArr['timezone'];
                        respObj.check_api_settings = check_api_settings;
                        respObj.application_mode = app_mode
                        respObj.leftmenu = userArr['leftmenu'];
                        respObj.user_role = userArr['user_role'];
                        respObj.special_role = userArr['special_role'];
                        respObj.google_auth = userArr['google_auth'];
                        respObj.trigger_enable = userArr['trigger_enable'];
                        resp.send(respObj);

                    } else {
                        resp.status(400).send({
                            message: 'username or Password Incorrect'
                        });
                    }
                })
            })
        }
    })
}) //End of authenticate

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
                                if (login_block_expiry >= current_time) {
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
                            if (set['unsuccessfull_login_attempt_count'] >= 3) {
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

//when first time user login call this function 
router.post('/authenticate', async function (req, resp, next) {
    conn.then(async (db) => {
        var credentials = auth(req)
        console.log(credentials);
        if (!credentials || !check(credentials.name, credentials.pass)) {
            resp.status(403).send({
                "message": "You are not Authorized"
            })
        } else {
            let username = req.body.username;
            let pass = req.body.password;
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
                        username: username
                    }, {
                        email_address: username
                    }]
                    where['status'] = '0';
                    where['user_soft_delete'] = '0';

                    let UserPromise = db.collection('users').find(where).toArray();
                    UserPromise.then((userArr) => {
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

                            respObj.id = userArr['_id'];
                            respObj.username = userArr['username'];
                            respObj.firstName = userArr['first_name'];
                            respObj.lastName = userArr['last_name'];
                            respObj.profile_image = userArr['profile_image'];
                            respObj.role = 'admin'; //userArr['user_role'];
                            respObj.token = `fake-jwt-token.`;
                            respObj.email_address = userArr['email_address'];
                            respObj.timezone = userArr['timezone'];
                            respObj.check_api_settings = check_api_settings;
                            respObj.application_mode = app_mode
                            respObj.leftmenu = userArr['leftmenu'];
                            respObj.user_role = userArr['user_role'];
                            respObj.special_role = userArr['special_role'];
                            // respObj.google_auth = userArr['google_auth'];
                            respObj.trigger_enable = userArr['trigger_enable'];
                            respObj.is_global_user = 'yes';
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
                    username: username
                }, {
                    email_address: username
                }]
                where['status'] = '0';
                where['user_soft_delete'] = '0';
                conn.then((db) => {
                    let UserPromise = db.collection('users').find(where).toArray();
                    UserPromise.then(async (userArr) => {
                        let respObj = {};
                        if (userArr.length > 0) {
                            if (await blockLoginAttempt(username, 'temp_block_check')) {
                                resp.status(400).send({
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

                                respObj.id = userArr['_id'];
                                respObj.username = userArr['username'];
                                respObj.firstName = userArr['first_name'];
                                respObj.lastName = userArr['last_name'];
                                respObj.profile_image = userArr['profile_image'];
                                respObj.role = 'admin'; //userArr['user_role'];
                                respObj.token = `fake-jwt-token.`;
                                respObj.email_address = userArr['email_address'];
                                respObj.timezone = userArr['timezone'];
                                respObj.check_api_settings = check_api_settings;
                                respObj.application_mode = app_mode
                                respObj.leftmenu = userArr['leftmenu'];
                                respObj.user_role = userArr['user_role'];
                                respObj.special_role = userArr['special_role'];
                                respObj.google_auth = userArr['google_auth'];
                                respObj.trigger_enable = userArr['trigger_enable'];
                                respObj.is_global_user = 'no';

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
                                resp.status(400).send({
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
        let post_data = req.body;
        let user_id = req.body.user_id;
        let password = req.body.password;
        if (Object.keys(post_data).length > 0) {
            if ("user_id" in post_data && "password" in post_data) {
                let md5Password = md5(password);
                let where = {
                    "_id": new ObjectID(user_id)
                };
                let set = {
                    '$set': {
                        'password': md5Password
                    }
                }

                let reset = await db.collection("users").updateOne(where, set);
                if (reset.result.ok) {
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


/****************** Google Authentication //Umer Abbas [5-4-20] *******************/
//generateGoogleAuthSecret
router.post('/generateGoogleAuthSecret', async function (req, res) {

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
            'Content-Type': 'application/json'
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

    var options = {
        method: 'POST',
        url: 'https://app.digiebot.com/admin/Api_calls/very_google_auth_code',
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
            'user_id': admin_id,
            'code': token
        }
    };
    request(options, async function (error, response, body) {
        if (error) {
            resp.send({
                'status': false,
                'message': 'Something went wrong.'
            });
        } else {
            if (body.status) {
                let secret = await getGoogleAuthSecret(admin_id)
                let enable = setGoogleAuthSecret(admin_id, secret, true)
                resp.status(200).send({
                    status: true,
                    message: 'Google Auth Enabled.'
                });
            } else {
                resp.status(200).send({
                    status: false,
                    message: 'Google Auth Failed.'
                });
            }
        }
    })


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
router.post('/listDashboardData', async (req, resp) => {
    //Function to get all user coins
    let userCoinsArr = await listUserCoins(req.body._id);
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
router.post('/listManualOrderComponent', async (req, resp) => {
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
        where.symbol = {
            '$nin': ['', null, 'BTC', 'BNBBTC']
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
        where.symbol = {
            '$nin': ['', null, 'BTC', 'BNBBTC']
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
router.post('/listCurrentmarketPrice', async (req, resp) => {
    let exchange = req.body.exchange;
    var urserCoinsArr = await listCurrentMarketPrice(req.body.coin, exchange)
    resp.status(200).send({
        message: urserCoinsArr
    });
}) //End of listCurrentmarketPrice

//function for getting current market price 
function listCurrentMarketPrice(coin, exchange) {
    //get market price on the base of exchange 
    if (exchange == 'bam') {
        return new Promise(function (resolve, reject) {
            conn.then((db) => {
                let where = {};
                where['coin'] = coin;
                db.collection('market_prices_node_bam').find(where).toArray((err, result) => {
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
                }).limit(1).toArray((err, result) => {
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
router.post('/listManualOrderDetail', async (req, resp) => {
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
router.post('/listAutoOrderDetail', async (req, resp) => {
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


router.post('/listmarketPriceMinNotation', async (req, resp) => {
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
router.post('/createManualOrder', (req, resp) => {

    conn.then((db) => {
        let orders = req.body.orderArr;
        let tempOrder = req.body.tempOrderArr;
        let orderId = req.body.orderId;
        let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
        var price = parseFloat(orders['price']);
        let exchange = orders['exchange'];
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
router.post('/createManualOrderByChart', (req, resp) => {
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
router.post('/makeManualOrderSetForSell', async (req, resp) => {
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
router.post('/createAutoOrder', async (req, resp) => {
    let order = req.body.orderArr;

    order['created_date'] = new Date()
    order['modified_date'] = new Date()
    let orderResp = await createAutoOrder(order);
    resp.status(200).send({
        message: orderResp
    });
}) //End of createAutoOrder

//post call from angular to edit triggers orders
router.post('/editAutoOrder', async (req, resp) => {

    let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
    let order = req.body.orderArr;
    order['modified_date'] = new Date()
    let orderId = order['orderId'];
    var exchange = order['exchange'];
    var lth_profit = order['lth_profit'];
    var defined_sell_percentage = order['defined_sell_percentage'];
    //get order detail which you want to update
    var buyOrderArr = await listOrderById(orderId, exchange);
    var purchased_price = (typeof buyOrderArr[0]['purchased_price'] != 'undefined' && buyOrderArr[0]['purchased_price'] != '' ? buyOrderArr[0]['purchased_price'] : buyOrderArr[0]['price']);
    var status = buyOrderArr[0]['status'];
    //The order which you want to update if in LTH then update the sell_price on the base of lth profit 
    if (status == 'LTH') {
        var sell_price = ((parseFloat(purchased_price) * lth_profit) / 100) + parseFloat(purchased_price);
        order['sell_price'] = sell_price;
    } else {
        var sell_price = ((parseFloat(purchased_price) * defined_sell_percentage) / 100) + parseFloat(purchased_price);
        order['sell_price'] = sell_price;
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

        // let purchased_price = !isNaN(parseFloat(purchased_price)) ? parseFloat(purchased_price) : parseFloat(buyOrderArr[0]['price'])
        let loss_price = (parseFloat(purchased_price) * parseFloat(order['loss_percentage'])) / 100;
        order['iniatial_trail_stop'] = parseFloat(purchased_price) - parseFloat(loss_price);

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
    }

    order['modified_date'] = new Date();

    var collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
    delete order['orderId'];
    var where = {};
    where['_id'] = new ObjectID(orderId);
    var updPrmise = updateOne(where, order, collection);
    updPrmise.then((callback) => {})



    //Update sell_price in Sell Order
    if (typeof buyOrderArr[0]['sell_order_id'] != 'undefined') {
        let sell_collection = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
        var where = {};
        let sell_order = {
            'sell_price': order['sell_price']
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
    promiseLog.then((callback) => {

    })

    //Send Notification
    send_notification(getBuyOrder[0]['admin_id'], 'news_alerts', 'medium', notification_msg, orderId, exchange, getBuyOrder[0]['symbol'], order_mode, '')

    resp.status(200).send({
        message: 'updated'
    });
}) //End of editAutoOrder

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
                    resolve(result)
                }
            })
        })
    })
} //End of createAutoOrder

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

//function for getting order list from order-list angular  component 
router.post('/listOrderListing', async (req, resp) => {

    var admin_id = req.body.postData.admin_id;
    var application_mode = req.body.postData.application_mode;
    var postDAta = req.body.postData;
    var search = {};
    //if filter values exist for order list create filter on the base of selected filters
    if (postDAta.coins != '') {
        //search on the bases of coins
        search['symbol'] = {
            '$in': postDAta.coins
        }
    }

    if (postDAta.order_type != '') {
        //search on the base of order type mean manual order or trigger order
        search['order_type'] = postDAta.order_type
    }

    if (postDAta.trigger_type != '') {
        //seatch on the base of specific trigger
        search['trigger_type'] = postDAta.trigger_type
    }

    if (postDAta.order_level != '') {
        //search on the base of order level for auto trading
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
    var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
    //::::::::::::::::::::::::::::::::::::::::::::::::
    //Filter_1 part for count number of parent orders
    var filter_1 = {};
    filter_1['parent_status'] = 'parent';
    filter_1['admin_id'] = admin_id;
    filter_1['application_mode'] = application_mode;
    filter_1['status'] = {
        '$in': ['new', 'takingOrder']
    }

    if (postDAta.start_date != '' || postDAta.end_date != '') {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter_1['created_date'] = obj;
    }

    if (count > 0) {
        for (let [key, value] of Object.entries(search)) {
            filter_1[key] = value;
        }
    }
    //:::::::::::::::::::::: End of count parent ordes Filter :::::::::::::: 
    //count parent orders Promise
    var parentCountPromise = countCollection(collectionName, filter_1);



    //::::::::::::: filter_2 count new orders for order listing ::::::::::::
    var filter_2 = {};
    filter_2['status'] = {
        '$in': ['new', 'new_ERROR']
    };
    filter_2['price'] = {
        '$nin': ['', null]
    };
    filter_2['admin_id'] = admin_id;
    filter_2['application_mode'] = application_mode;

    if (postDAta.start_date != '' || postDAta.end_date != '') {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter_2['created_date'] = obj;
    }

    if (count > 0) {
        for (let [key, value] of Object.entries(search)) {
            filter_2[key] = value;
        }
    }
    //:::::::::: End of filter_2 for couting new orders :::::::::::::
    //Promise for count new orders
    var newCountPromise = countCollection(collectionName, filter_2);



    //:::::::::::::::: filter_3 for count open order :::::::::::::::::
    var filter_3 = {};
    filter_3['status'] = {
        '$in': ['FILLED', 'FILLED_ERROR']
    }
    filter_3['is_sell_order'] = 'yes';
    filter_3['is_lth_order'] = {
        $ne: 'yes'
    };
    filter_3['admin_id'] = admin_id;
    filter_3['application_mode'] = application_mode;

    if (postDAta.start_date != '' || postDAta.end_date != '') {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter_3['created_date'] = obj;
    }
    if (count > 0) {
        for (let [key, value] of Object.entries(search)) {
            filter_3[key] = value;
        }
    }
    //::::::::::::::::End of filter_3 for count open order :::::::::::::::::

    //::::::::: Open-orders count Promise :::::::::::::::::::::::::::::::::
    var openCountPromise = countCollection(collectionName, filter_3);


    //::::::::::::::: filter_33 for count filled orders :::::::::::::
    var filter_33 = {};
    filter_33['status'] = {
        '$in': ['FILLED', 'fraction_submitted_buy', 'FILLED_ERROR']
    }
    filter_33['admin_id'] = admin_id;
    filter_33['application_mode'] = application_mode;

    if (postDAta.start_date != '' || postDAta.end_date != '') {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter_33['created_date'] = obj;
    }
    if (count > 0) {
        for (let [key, value] of Object.entries(search)) {
            filter_33[key] = value;
        }
    }
    //:::::::::::::::End of  filter_33 for count filled orders :::::::::::::
    //promise of count filled orders
    var filledCountPromise = countCollection(collectionName, filter_33);




    //:::::::::::; filter_4 for count all canceled orders ::::::::::::;
    var filter_4 = {};
    filter_4['status'] = 'canceled';
    filter_4['admin_id'] = admin_id;
    filter_4['application_mode'] = application_mode;

    if (postDAta.start_date != '' || postDAta.end_date != '') {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter_4['created_date'] = obj;
    }
    if (count > 0) {
        for (let [key, value] of Object.entries(search)) {
            filter_4[key] = value;
        }
    }
    //:::::::::::: End of  filter_4 for count all canceled orders ::::::::::::;
    //Promise for canceled count orders :::::::::::::::::
    var cancelCountPromise = countCollection(collectionName, filter_4);


    //::::::: filter_5  for count all error orders ::::::::::::::::::::::: 
    var filter_5 = {};
    filter_5['status'] = 'error';
    filter_5['admin_id'] = admin_id;
    filter_5['application_mode'] = application_mode;

    if (postDAta.start_date != '' || postDAta.end_date != '') {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter_5['created_date'] = obj;
    }
    if (count > 0) {
        for (let [key, value] of Object.entries(search)) {
            filter_5[key] = value;
        }
    }
    //::::::: End of  filter_5  for count all error orders ::::::::::::::::::::::: 
    //Promise for count error orders ::::::::::
    var errorCountPromise = countCollection(collectionName, filter_5);

    //::::::::::::: filter_6 for count all lth order :::::::::::::::::::
    var filter_6 = {};
    filter_6['status'] = {
        $in: ['LTH', 'LTH_ERROR']
    };
    filter_6['admin_id'] = admin_id;
    filter_6['application_mode'] = application_mode;
    filter_6['is_sell_order'] = 'yes';

    if (postDAta.start_date != '' || postDAta.end_date != '') {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter_6['created_date'] = obj;
    }
    if (count > 0) {
        for (let [key, value] of Object.entries(search)) {
            filter_6[key] = value;
        }
    }
    //::::::::::::: End of filter_6 for count all lth order :::::::::::::::::::
    //Promise for count lth orders
    var lthCountPromise = countCollection(collectionName, filter_6);



    //:::::::::::::  filter_7 for count all submitted order :::::::::::::::::::
    var filter_7 = {};
    filter_7['status'] = {
        '$in': ['submitted', 'fraction_submitted_sell', 'submitted_ERROR']
    }
    filter_7['admin_id'] = admin_id;
    filter_7['application_mode'] = application_mode;

    if (postDAta.start_date != '' || postDAta.end_date != '') {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter_7['created_date'] = obj;
    }
    if (count > 0) {
        for (let [key, value] of Object.entries(search)) {
            filter_7[key] = value;
        }
    }
    //::::::::::::: End of filter_7 for count all submitted order :::::::::::::::::::
    //promise for count submitted orders
    var submittedCountPromise = countCollection(collectionName, filter_7);


    var collectionName = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;

    //::::::::::::: filter_8 for count all sold order :::::::::::::::::::
    var filter_8 = {};
    filter_8['admin_id'] = admin_id;
    filter_8['application_mode'] = application_mode;
    filter_8['is_sell_order'] = 'sold';

    if (postDAta.start_date != '' || postDAta.end_date != '') {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter_8['created_date'] = obj;
    }

    if (count > 0) {
        for (let [key, value] of Object.entries(search)) {
            filter_8[key] = value;
        }
    }
    //::::::::::::: End of filter_8 for count all sold order :::::::::::::::::::
    //Promise for count all sold orders 
    var soldCountPromise = countCollection(collectionName, filter_8);

    //::::::::::::: filter_9 for count all lth_pause order :::::::::::::::::::
    var filter_9 = {};
    filter_9['admin_id'] = admin_id;
    filter_9['application_mode'] = application_mode;
    filter_9['is_sell_order'] = {
        '$in': ['pause', 'resume_pause', 'resume_complete']
    };

    if (postDAta.start_date != '' || postDAta.end_date != '') {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter_9['created_date'] = obj;
    }

    if (count > 0) {
        for (let [key, value] of Object.entries(search)) {
            filter_9[key] = value;
        }
    }
    //::::::::::::: End of filter_9 for count all lth_pause  order :::::::::::::::::::
    //Promise for count all lth_pause orders
    var lthPauseCountPromise = countCollection(collectionName, filter_9);


    //Count all tab
    let filter_all = {};
    filter_all['application_mode'] = postDAta.application_mode
    filter_all['admin_id'] = postDAta.admin_id

    if (postDAta.start_date != '' || postDAta.end_date != '') {
        let obj = {}
        if (postDAta.start_date != '') {
            obj['$gte'] = new Date(postDAta.start_date);
        }
        if (postDAta.end_date != '') {
            obj['$lte'] = new Date(postDAta.end_date);
        }
        filter_all['created_date'] = obj;
    }

    if (count > 0) {
        for (let [key, value] of Object.entries(search)) {
            filter_all[key] = value;
        }
    }
    let soldOrdercollection = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
    let all1Promise = countCollection(soldOrdercollection, filter_all);
    // filter_all['parent_status'] = {'$exists': false}
    let buyOrdercollection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
    let all2Promise = countCollection(buyOrdercollection, filter_all);
    //End count All tab


    //Resolve promised for count order for all tabs
    var PromiseResponse = await Promise.all([parentCountPromise, newCountPromise, openCountPromise, cancelCountPromise, errorCountPromise, lthCountPromise, submittedCountPromise, soldCountPromise, filledCountPromise, lthPauseCountPromise, all1Promise, all2Promise]);

    var parentCount = PromiseResponse[0];
    var newCount = PromiseResponse[1];
    var openCount = PromiseResponse[2];
    var cancelCount = PromiseResponse[3];
    var errorCount = PromiseResponse[4];
    var lthCount = PromiseResponse[5];
    var submitCount = PromiseResponse[6];
    var soldCount = PromiseResponse[7];
    var filledCount = PromiseResponse[8];
    var lthPauseCount = PromiseResponse[9];
    var all1Count = PromiseResponse[10];
    var all2Count = PromiseResponse[11];

    // var totalCount = parseFloat(parentCount) + parseFloat(newCount) + parseFloat(openCount) + parseFloat(cancelCount) + parseFloat(errorCount) + parseFloat(lthCount) + parseFloat(submitCount) + parseFloat(soldCount) + parseFloat(lthPauseCount);

    var totalCount = parseFloat(all1Count) + parseFloat(all2Count);

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
    countArr['lthPauseCount'] = lthPauseCount;
    countArr['totalBuyCount'] = all2Count;
    countArr['totalSoldCount'] = all1Count;
    //get user balance for listing on list-order page
    var userBalanceArr = []
    userBalanceArr = await get_user_wallet(admin_id, exchange)

    // if(exchange == 'binance'){
    //     userBalanceArr = await get_user_wallet(admin_id, exchange)
    // }else{
    //     userBalanceArr = await listUserBalance(admin_id, exchange);
    // }
    var soldOrderArr = []; //await calculateAverageOrdersProfit(req.body.postData);
    var total_profit = 0;
    var total_quantity = 0;
    for (let index in soldOrderArr) {
        var market_sold_price = (typeof soldOrderArr[index]['market_sold_price'] == 'undefined') ? 0 : soldOrderArr[index]['market_sold_price'];
        market_sold_price = parseFloat((isNaN(market_sold_price)) ? 0 : market_sold_price);

        var current_order_price = (typeof soldOrderArr[index]['market_value'] == 'undefined') ? 0 : soldOrderArr[index]['market_value'];
        current_order_price = parseFloat((isNaN(current_order_price)) ? 0 : current_order_price);

        var quantity = (typeof soldOrderArr[index]['quantity'] == 'undefined') ? 0 : soldOrderArr[index]['quantity'];
        quantity = parseFloat((isNaN(quantity)) ? 0 : quantity);

        var percentage = calculate_percentage(current_order_price, market_sold_price);
        var total_btc = quantity * current_order_price;
        total_profit += total_btc * percentage;
        total_quantity += total_btc;
    }

    var avg_profit = 0; //total_profit / total_quantity;
    //function for listing orders 
    var orderListing = await listOrderListing(req.body.postData);
    var customOrderListing = [];
    for (let index in orderListing) {
        //get market price on the base of exchange 
        if (exchange == 'bam') {
            var currentMarketPrice = await listBamCurrentMarketPrice(orderListing[index].symbol);
            //get price of global coins
            var BTCUSDTPRICE = await listBamCurrentMarketPrice('BTCUSDT');

        } else {

            let currentMarketPricePromise = listCurrentMarketPrice(orderListing[index].symbol, exchange);
            let globalCoin = (exchange == 'coinbasepro') ? 'BTCUSD' : 'BTCUSDT';
            //get price for global coins
            var BTCUSDTPRICEPromise = listCurrentMarketPrice(globalCoin, exchange);
            var responsePromise = await Promise.all([currentMarketPricePromise, BTCUSDTPRICEPromise]);
            var currentMarketPriceArr = (typeof responsePromise[0][0] == 'undefined') ? [] : responsePromise[0][0];
            var currentMarketPrice = (typeof (currentMarketPriceArr.price) == 'undefined') ? 0 : currentMarketPriceArr.price;
            var btcPriceArr = (typeof responsePromise[1][0] == 'undefined') ? [] : responsePromise[1][0];
            var BTCUSDTPRICE = (typeof btcPriceArr.market_value == 'undefined') ? btcPriceArr.price : btcPriceArr.market_value;
        }



        if (orderListing[index].status == 'new') {
            var convertToBtc = orderListing[index].quantity * currentMarketPrice;
            let splitArr = orderListing[index].symbol.split('USDT');
            var coinPriceInBtc = ((splitArr.length > 1) && (splitArr[1] == '')) ? ((orderListing[index].quantity) * currentMarketPrice) : (BTCUSDTPRICE * convertToBtc);
        } else {

            let order_price = (typeof orderListing[index].purchased_price != 'undefined' && orderListing[index].purchased_price != '' && !isNaN(parseFloat(orderListing[index].purchased_price)) ? parseFloat(orderListing[index].purchased_price) : currentMarketPrice)

            var convertToBtc = orderListing[index].quantity * order_price;
            let splitArr = orderListing[index].symbol.split('USDT');
            var coinPriceInBtc = ((splitArr.length > 1) && (splitArr[1] == '')) ? ((orderListing[index].quantity) * order_price) : (BTCUSDTPRICE * convertToBtc);
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

        var orderSellPrice = (typeof orderListing[index].market_sold_price == 'undefined' || orderListing[index].market_sold_price == '') ? '' : orderListing[index].market_sold_price;
        var orderPurchasePrice = (typeof orderListing[index].purchased_price == 'undefined' || orderListing[index].purchased_price == '') ? 0 : orderListing[index].purchased_price;
        var profitLossPercentageHtml = '';

        //part for calculating profit loss percentage 
        if (orderSellPrice != '') {
            //function for calculating percentage 
            let profitLossPercentage = calculate_percentage(orderPurchasePrice, orderSellPrice);
            let profitLossCls = (orderSellPrice > orderPurchasePrice) ? 'success' : 'danger';
            profitLossPercentageHtml = '<span class="text-' + profitLossCls + '"><b>' + profitLossPercentage + '%</b></span>';
        } else {
            if (status == 'FILLED' || status == 'LTH') {
                if (is_sell_order == 'yes' || status == 'LTH') {
                    let percentage = calculate_percentage(orderPurchasePrice, currentMarketPrice);
                    let PLCls = (currentMarketPrice > orderPurchasePrice) ? 'success' : 'danger'
                    profitLossPercentageHtml = '<span class="text-' + PLCls + '"><b>' + percentage + '%</b></span>';
                } else {
                    profitLossPercentageHtml = '<span class="text-default"><b>---</b></span>';
                }
            } else {
                profitLossPercentageHtml = '<span class="text-default"><b>-</b></span>';
            }
        } //End of profit loss Percentage


        order['profitLossPercentageHtml'] = profitLossPercentageHtml;


        let pause_status_arr = ['pause', 'resume_pause', 'resume_complete']

        var childProfitLossPercentageHtml = '-'
        //part for showing different status labels
        if ((status == 'FILLED' && is_sell_order == 'yes') || status == "LTH") {
            var SellStatus = (sellOrderId == '') ? '' : await listSellOrderStatus(sellOrderId, exchange);
            order['sell_status'] = SellStatus;
            if (SellStatus == 'error') {
                htmlStatus += '<span class="badge badge-danger">ERROR IN SELL</span>';
            } else if (SellStatus == 'submitted') {
                htmlStatus += '<span class="badge badge-success">SUBMITTED FOR SELL</span>';
            } else {
                htmlStatus += '<span class="badge badge-info">WAITING FOR SELL </span>';
            }
        } else if (status == 'FILLED' && (is_sell_order == 'sold' || pause_status_arr.includes(is_sell_order))) {

            if (pause_status_arr.includes(is_sell_order)) {
                if (is_sell_order == 'pause') {
                    htmlStatus += '<span class="badge badge-success">Paused</span>';
                } else if (is_sell_order == 'resume_pause') {
                    htmlStatus += '<span class="badge badge-info">Resumed</span>';
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
            } else if (is_lth_order == 'yes') {
                htmlStatus += '<span class="badge badge-warning">LTH</span><span class="badge badge-success">Sold</span>';
            } else {
                htmlStatus += '<span class="badge badge-success">Sold</span>';
            }
        } else {
            var statusClass = (status == 'error' || status == 'LTH_ERROR' || status == 'FILLED_ERROR' || status == 'submitted_ERROR' || status == 'new_ERROR' || status == 'canceled_ERROR') ? 'danger' : 'success'
            status = (parent_status == 'parent') ? parent_status : status;
            if (status == 'LTH_ERROR' || status == 'FILLED_ERROR' || status == 'submitted_ERROR' || status == 'new_ERROR' || status == 'canceled_ERROR') {
                let err_lth_filled = status.replace('_', ' ')
                htmlStatus += '<span class="badge badge-' + statusClass + '">' + err_lth_filled + '</span>';
            } else {
                htmlStatus += '<span class="badge badge-' + statusClass + '">' + status + '</span>';
            }
        }

        if (fraction_sell_type == 'parent' || fraction_sell_type == 'child') {
            htmlStatus += '<span class="badge badge-warning" style="margin-left:4px;">Sell Fraction</span>';
        } else if (fraction_buy_type == 'parent' || fraction_buy_type == 'child') {
            htmlStatus += '<span class="badge badge-warning" style="margin-left:4px;">Buy Fraction</span>';
        }

        order['childProfitLossPercentageHtml'] = childProfitLossPercentageHtml


        order['htmlStatus'] = htmlStatus;
        customOrderListing.push(order)
    } //End of order Iteration

    //End of labels parts

    var response = {};
    response['customOrderListing'] = customOrderListing;
    response['countArr'] = countArr;
    response['userBalanceArr'] = userBalanceArr;
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



//function for calculation average profit for a user of all his sold orders
function calculateAverageOrdersProfit(postDAta) {
    var filter = {};
    filter['application_mode'] = postDAta.application_mode
    filter['admin_id'] = postDAta.admin_id
    filter['is_sell_order'] = 'sold'
    filter['market_sold_price'] = {
        '$exists': true
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
        }
    }

    var exchange = postDAta.exchange;

    var collectionName = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;

    return new Promise((resolve) => {
        conn.then((db) => {
            // db.collection(collectionName).find(filter).sort({ modified_date: -1 }).toArray((err, result) => {
            db.collection(collectionName).find(filter).toArray((err, result) => {
                if (err) {
                    console.log(err)
                } else {
                    resolve(result)
                }
            })
        })
    })
} //End of calculateAverageOrdersProfit

//function for getting all order on the base of filters
async function listOrderListing(postDAta, dbConnection) {

    var filter = {};
    var pagination = {};
    var limit = postDAta.limit;
    var skip = postDAta.skip;
    var exchange = postDAta.exchange;
    filter['application_mode'] = postDAta.application_mode
    filter['admin_id'] = postDAta.admin_id
    var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
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

    if (postDAta.status == 'open') {
        filter['status'] = {
            '$in': ['FILLED', 'FILLED_ERROR']
        }
        filter['is_sell_order'] = 'yes';
        filter['is_lth_order'] = {
            $ne: 'yes'
        };
    }

    if (postDAta.status == 'filled') {
        filter['status'] = {
            '$in': ['FILLED', 'fraction_submitted_buy', 'FILLED_ERROR']
        }
    }

    if (postDAta.status == 'sold') {
        filter['status'] = 'FILLED'
        filter['is_sell_order'] = 'sold';
        var collectionName = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
    }

    if (postDAta.status == 'lth_pause') {
        filter['status'] = 'FILLED'
        filter['is_sell_order'] = {
            '$in': ['pause', 'resume_pause', 'resume_complete']
        };
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
    }

    if (postDAta.status == 'new') {
        filter['status'] = {
            '$in': ['new', 'new_ERROR']
        };
        filter['price'] = {
            '$ne': ''
        };
    }

    if (postDAta.status == 'canceled') {
        filter['status'] = 'canceled';
    }

    if (postDAta.status == 'submitted') {
        filter['status'] = {
            '$in': ['submitted', 'fraction_submitted_sell', 'submitted_ERROR']
        }
    }

    //if status is all the get from both buy_orders and sold_buy_orders 
    if (postDAta.status == 'all') {
        var soldOrdercollection = (exchange == 'binance') ? 'sold_buy_orders' : 'sold_buy_orders_' + exchange;
        var buyOrdercollection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
        var SoldOrderArr = await list_orders_by_filter(soldOrdercollection, filter, pagination, limit, skip);
        var buyOrderArr = await list_orders_by_filter(buyOrdercollection, filter, pagination, limit, skip);
        // var returnArr = mergeOrdersArrays(SoldOrderArr, buyOrderArr);
        var returnArr = SoldOrderArr.concat(buyOrderArr);
        var orderArr = returnArr.slice().sort((a, b) => b.modified_date - a.modified_date)
    } else {
        var orderArr = await list_orders_by_filter(collectionName, filter, pagination, limit, skip);
    }
    return orderArr;
} //End of listOrderListing

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

router.post('/get_user_coins', async (req, resp) => {

    let exchange = req.body.exchange
    let admin_id = req.body.admin_id

    var urserCoinsPromise = getUserCoins(admin_id, exchange);
    var globalCoinsPromise = getGlobalCoins(exchange);
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
router.post('/playOrder', async (req, resp) => {
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
router.post('/togglePausePlayOrder', async (req, resp) => {
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
router.post('/listOrderDetail', async (req, resp) => {
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
router.post('/deleteOrder', async (req, resp) => {
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
        let where = {};
        where['_id'] = new ObjectID(String(getBuyOrder[0]['buy_parent_id']));
        let updObj = {};
        updObj['status'] = 'new';
        let exchange = req.body.exchange
        let collection = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
        let updPromise = updateOne(where, updObj, collection);
    }

    resp.status(200).send({
        message: promiseResponse
    });

}) //End of deleteOrder
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
router.post('/orderMoveToLth', async (req, resp) => {

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
router.post('/listOrderById', async (req, resp) => {
    let orderId = req.body.orderId;
    let exchange = req.body.exchange;
    var timezone = req.body.timezone;
    //promise for  getting order by id 
    var ordeArr = await listOrderById(orderId, exchange);
    var orderObj = ordeArr[0];
    var order_created_date = orderObj['created_date'];
    var order_mode = (typeof orderObj['order_mode'] == 'undefined') ? orderObj['application_mode'] : orderObj['order_mode'];


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
}) //End of listOrderById

//post call for getting order log by id //Umer Abbas [2-1-19]
router.post('/listOrderLogById', async (req, resp) => {
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
async function listOrderLog(orderId, exchange, order_mode, order_created_date) {
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

//post call for sell order manually from order listing page 
router.post('/sellOrderManually', async (req, resp) => {

    let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
    let orderId = req.body.orderId;
    let currentMarketPrice = req.body.currentMarketPriceByCoin;
    let exchange = req.body.exchange;
    let collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
    //get buy order detail by id
    var ordeResp = await listOrderById(orderId, exchange);
    if (ordeResp.length > 0) {

        let buyOrderArr = ordeResp[0];
        let sell_order_id = (typeof buyOrderArr['sell_order_id'] == undefined) ? '' : buyOrderArr['sell_order_id'];
        let buyOrderStatus = (typeof buyOrderArr['status'] == undefined) ? '' : buyOrderArr['status'];

        console.log("sell_order_id ", sell_order_id)
        if (sell_order_id != '') {
            let application_mode = (typeof buyOrderArr['application_mode'] == undefined) ? '' : buyOrderArr['application_mode'];
            let buy_order_id = buyOrderArr['_id'];
            let quantity = (typeof buyOrderArr['quantity'] == undefined) ? '' : buyOrderArr['quantity'];
            let coin_symbol = (typeof buyOrderArr['symbol'] == undefined) ? '' : buyOrderArr['symbol'];
            let admin_id = (typeof buyOrderArr['admin_id'] == undefined) ? '' : buyOrderArr['admin_id'];
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
            update_1['status'] = buyOrderStatus + '_submitted_for_sell';

            var updatePromise_2 = updateOne(filter_1, update_1, collectionName_2);
            var resolvePromise = Promise.all([updatePromise_1, updatePromise_2, logPromise, logPromise_2]);
            //in case of live order move it to specified api for selling
            if (application_mode == 'live') {


                var log_msg = "Market Order Send For Sell On:  " + parseFloat(currentMarketPrice).toFixed(8);
                // var logPromise_1 = recordOrderLog(buy_order_id, log_msg, 'sell_manually', 'yes', exchange);
                var logPromise_1 = create_orders_history_log(buy_order_id, log_msg, 'sell_manually', 'yes', exchange, order_mode, order_created_date)

                logPromise_1.then((resp) => {})
                //send order for sell on specific ip
                var SellOrderResolve = readySellOrderbyIp(sell_order_id, quantity, currentMarketPrice, coin_symbol, admin_id, buy_order_id, trading_ip, 'barrier_percentile_trigger', 'sell_market_order', exchange);
                console.log("SellOrderResolve ", SellOrderResolve)

                SellOrderResolve.then((resp) => {})
            } else {
                //if test order 
                var log_msg = "Market Order Send For Sell On **:  " + parseFloat(currentMarketPrice).toFixed(8);
                // var logPromise_1 = recordOrderLog(buy_order_id, log_msg, 'sell_manually', 'yes', exchange);
                var logPromise_1 = create_orders_history_log(buy_order_id, log_msg, 'sell_manually', 'yes', exchange, order_mode, order_created_date)

                logPromise_1.then((resp) => {})
                //call function for selling orders
                sellTestOrder(sell_order_id, currentMarketPrice, buy_order_id, exchange);

            }
        } //End of if sell order id not empty	
    } //Order Arr End 


    resp.status(200).send({
        message: ordeResp
    });

}) //End of sellOrderManually


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
            insert_arr['modified_date'] = new Date();
            let collection = (exchange == 'binance') ? 'ready_orders_for_sell_ip_based' : 'ready_orders_for_sell_ip_based_' + exchange;

            console.log('insert_arr', insert_arr);

            db.collection(collection).insertOne(insert_arr, (err, result) => {

                console.log('result', result);

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
function sellTestOrder(sell_order_id, currentMarketPrice, buy_order_id, exchange) {

    (async () => {
        var collectionName = (exchange == 'binance') ? 'orders' : 'orders_' + exchange;
        var search = {};
        search['_id'] = new ObjectID(sell_order_id);
        //search['status'] = {'$in':['new','LTH']}

        var orderResp = await find(collectionName, search);
        if (orderResp.length > 0) {

            var orderArr = orderResp[0];

            var quantity = (typeof orderArr['quantity'] == 'undefined') ? 0 : orderArr['quantity'];
            var symbol = (typeof orderArr['symbol'] == 'undefined') ? '' : orderArr['symbol'];

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
            var commission_value = parseFloat(quantity) * (0.001);
            var commission = commission_value * currentMarketPrice;
            var commissionAsset = 'BTC';

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
router.post('/buyOrderManually', async (req, resp) => {

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
            insert_arr['buy_order_id'] = buy_order_id;
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


            db.collection(collection).insertOne(insert_arr, (err, result) => {
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
router.post('/updateBuyPriceFromDragging', async (req, resp) => {
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
    update['modified_date'] = new Date();
    var collectionName = (exchange == 'binance') ? 'buy_orders' : 'buy_orders_' + exchange;
    var updatePromise = await updateOne(filter, update, collectionName);

    resp.status(200).send({
        message: 'Order Buy Price Updated Successfully'
    })

}) //End of updateBuyPriceFromDragging
//post call for update profit and loss percentage for a specific order from chart
router.post('/updateOrderfromdraging', async (req, resp) => {
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
router.post('/updateBuyPriceFromDraggingChart', async (req, resp) => {
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

//post call for updating lth profit from chart
router.post('/updateLthProfitChart', async (req, resp) => {
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

router.post('/updateOrderfromdragingChart', async (req, resp) => {
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

                            if (typeof order['lth_proft'] == 'undefined' || order['lth_proft'] == '') {
                                update['lth_functionality'] = 'yes'
                                update['lth_profit'] = sell_profit_percent
                            }

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

                        if (typeof order['lth_proft'] == 'undefined' || order['lth_proft'] == '') {
                            update['lth_functionality'] = 'yes'
                            update['lth_profit'] = sell_profit_percent
                        }

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

                            if (typeof order['lth_proft'] == 'undefined' || order['lth_proft'] == '') {
                                update['lth_functionality'] = 'yes'
                                update['lth_profit'] = sell_profit_percent
                            }

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

                        if (typeof order['lth_proft'] == 'undefined' || order['lth_proft'] == '') {
                            update['lth_functionality'] = 'yes'
                            update['lth_profit'] = sell_profit_percent
                        }

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
router.post('/lisEditManualOrderById', async (req, resp) => {
    let orderId = req.body.orderId;
    let exchange = req.body.exchange;
    var buyOrderResp = await listOrderById(orderId, exchange);
    var buyOrderArr = buyOrderResp[0];
    var post_data = req.body
    var timezone = (typeof post_data.timezone == 'undefined' || post_data.timezone == '') ? 'America/Danmarkshavn' : post_data.timezone;

    var auto_sell = (typeof buyOrderArr['auto_sell'] == 'undefined') ? 'no' : buyOrderArr['auto_sell'];

    var sell_order_id = (typeof buyOrderArr['sell_order_id'] == 'undefined' || buyOrderArr['sell_order_id'] == null) ? '' : buyOrderArr['sell_order_id'];

    var order_created_date = (typeof buyOrderArr['created_date'] == 'undefined') ? '' : buyOrderArr['created_date'];
    var order_mode = (typeof buyOrderArr['order_mode'] == 'undefined') ? buyOrderArr['application_mode'] : buyOrderArr['order_mode'];



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
router.post('/updateManualOrder', async (req, resp) => {

    let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');

    let buyOrderId = req.body.buyOrderId;
    let exchange = req.body.exchange;
    let sellOrderId = req.body.sellOrderId;
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
        }

        if (typeof buyorderArr['trail_interval'] != 'undefined' && buyorderArr['trail_interval'] != '') {
            buyorderArr['trail_interval'] = parseFloat(buyorderArr['trail_interval'])
        }

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
        }

        if (typeof buyorderArr['trail_interval'] != 'undefined' && buyorderArr['trail_interval'] != '') {
            buyorderArr['trail_interval'] = parseFloat(buyorderArr['trail_interval'])
        }

    }

    buyorderArr['modified_date'] = new Date();
    var upsert = {
        'upsert': true
    };
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
        }

        if (typeof sellOrderArr['trail_interval'] != 'undefined' && sellOrderArr['trail_interval'] != '') {
            sellOrderArr['trail_interval'] = parseFloat(sellOrderArr['trail_interval'])
        }

        sellOrderArr['modified_date'] = new Date();
        var upsert = {
            'upsert': true
        };
        var updPromise_1 = updateSingle(orders_collection, where_1, sellOrderArr, upsert);
        updPromise_1.then((callback) => {});
    }


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
        }

        if (typeof tempOrderArr['trail_interval'] != 'undefined' && tempOrderArr['trail_interval'] != '') {
            tempOrderArr['trail_interval'] = parseFloat(tempOrderArr['trail_interval'])
        }

        tempOrderArr['modified_date'] = new Date();
        var upsert = {
            'upsert': true
        };
        var updPromise_2 = updateSingle(temp_sell_order_collection, where_2, tempOrderArr, upsert);
        updPromise_2.then((callback) => {})
    }



    resp.status(200).send({
        message: 'order updated'
    });

}) //End of updateManualOrder

//post call for set manual order  
router.post('/setForSell', async (req, resp) => {
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
    }

    if (typeof sellOrderArr['trail_interval'] != 'undefined' && sellOrderArr['trail_interval'] != '') {
        updArr['trail_interval'] = parseFloat(sellOrderArr['trail_interval'])
    }

    var where = {};
    where['_id'] = {
        '$in': [buyOrderId, new ObjectID(buyOrderId)]
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
        message: 'Order Set For ell'
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

router.post('/get_orders_post', function (req, res, next) {
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



//post call for getting user info for manage user component
router.post('/get_user_info', function (req, res, next) {
    var post_data = req.body;
    let post_data_key_array = Object.keys(post_data);
    if (post_data_key_array.length == 0) {
        res.status(400).send({
            "success": "false",
            "status": 400,
            "message": "Bad request. No data posted in a post request"
        })
    } else {
        if ('user_id' in post_data) {
            let user_id = post_data['user_id'];
            conn.then(db => {
                let search_arr = {
                    "_id": ObjectID(user_id)
                };
                db.collection("users").findOne(search_arr, function (err, data) {
                    if (err) throw err;
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
//post call for edit user info
router.post('/update_user_info', function (req, res, next) {
    var post_data = req.body;
    let post_data_key_array = Object.keys(post_data);
    if (post_data_key_array.length == 0) {
        res.status(400).send({
            "success": "false",
            "status": 400,
            "message": "Bad request. No data posted in a post request"
        })
    } else {
        if ('user_id' in post_data) {
            let user_id = post_data['user_id'];
            conn.then(db => {
                let search_arr = {
                    "_id": ObjectID(user_id)
                };
                db.collection("users").findOne(search_arr, function (err, data) {
                    if (err) throw err;
                    if (Object.keys(data).length > 0) {
                        let update_arr = new Object(post_data);
                        delete update_arr.user_id;
                        db.collection("users").updateOne(search_arr, {
                            $set: update_arr
                        }, function (err1, obj) {
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
                            let updateWallet = update_user_balance(user_id)
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
router.post('/createManualOrderGlobally', (req, resp) => {
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
router.post('/addUserCoins', function (req, res, next) {
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
router.post('/addUserCoin', async function (req, res, next) {

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
            db.collection('market_prices_node_bam').find(where).toArray((err, result) => {
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
router.post('/saveBamCredentials', (req, resp) => {
    var user_id = req.body.user_id;
    var api_key = req.body.api_key;
    var api_secret = req.body.api_secret;

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
        db.collection('bam_credentials').updateOne(where, set, upsert, (err, result) => {
            if (err) {
                console.log(err);
            } else {
                let validation = validate_bam_credentials(api_key, api_secret, user_id)
                resp.status(200).send({
                    "success": "true",
                    "message": "Credentials Updated Successfully"
                })
            }
        })
    })


}) //End of saveBamCredentials


router.post('/getBamCredentials', async (req, resp) => {
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

//post call for calculating average profit for order listing
router.post('/calculate_average_profit', async (req, resp) => {
    var soldOrderArr = await calculateAverageOrdersProfit(req.body.postData);
    var total_profit = 0;
    var total_quantity = 0;

    var profit_percentage_sum = 0;
    var total_trades = 0;

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

    }

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
router.post('/validate_bam_credentials', async (req, resp) => {
    let APIKEY = req.body.APIKEY;
    let APISECRET = req.body.APISECRET;
    var credentials = await validate_bam_credentials(APIKEY, APISECRET);
    resp.status(200).send({
        message: credentials
    });
}) //End of validate_bam_credentials


function validate_bam_credentials(APIKEY, APISECRET, user_id = '') {
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

//check error in sell for buy orders
router.post('/get_error_in_sell', async (req, resp) => {

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
router.post('/remove_error', async (req, resp) => {

    let interfaceType = (typeof req.body.interface != 'undefined' && req.body.interface != '' ? 'from ' + req.body.interface : '');
    let order_id = req.body.order_id;
    let exchange = req.body.exchange;
    conn.then(async (db) => {

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
            var error_type = '';

            var update_buy_status = '';

            if (buy_status == 'error') {
                update_buy_status = 'new'
                error_type = buy_status
            } else if (buy_status == 'FILLED_ERROR' || buy_status == 'submitted_ERROR' || buy_status == 'LTH_ERROR' || buy_status == 'new_ERROR') {
                let statusArr = buy_status.split('_');
                update_buy_status = statusArr[0];
                error_type = statusArr.join(' ');
            }

            if (update_buy_status != '') {
                //remove error from buy_order
                let where = {
                    '_id': new ObjectID(order_id)
                }
                let update = {
                    '$set': {
                        'status': update_buy_status,
                        'modified_date': new Date()
                    }
                }
                let updated = await db.collection(buy_collection).updateOne(where, update)

                //remove error from sell_order
                if (typeof buy_order['sell_order_id'] != 'undefined') {
                    let where2 = {
                        '_id': new ObjectID(String(buy_order['sell_order_id']))
                    }
                    let update2 = {
                        '$set': {
                            'status': 'new',
                            'modified_date': new Date()
                        }
                    }
                    let updated2 = await db.collection(sell_collection).updateOne(where2, update2)
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
router.post('/removeOrderManually', async (req, resp) => {
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
router.post('/validate_user_password', async (req, resp) => {
    var password = req.body.user_password;
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
router.post('/is_bnb_balance_enough', async (req, resp) => {
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
                            var dateIndexPromise = create_index(full_collection_name, date_index);
                            dateIndexPromise.then((resolve) => {});

                            var order_index = {
                                'order_id': 1
                            };
                            var orderIndexPromise = create_index(full_collection_name, order_index);
                            orderIndexPromise.then((resolve) => {});
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

router.post('/get_order_levels', async (req, resp) => {
    conn.then(async (db) => {
        levels = await db.collection('order_levels').find({}).toArray();
        resp.status(200).send({
            'data': levels
        })
    }) //End of conn
})

router.post('/get_user_wallet', async (req, resp) => {
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
                    if ((arr1[0] == '' && arr1[1] == '') || (arr2[0] == '' && arr2[1] == '')) {
                        symbols.push(item['coin_symbol'])
                    } else if (arr1[1] == '') {
                        symbols.push(arr1[0])
                    } else if (arr2[1] == '') {
                        symbols.push(arr2[0])
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


router.post('/pause_sold_order', (req, res) => {

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

                let set = {};
                set['$set'] = {
                    'is_sell_order': 'pause'
                };
                let where = {
                    '_id': obj._id
                }

                let update = db.collection(sold_collection).updateOne(where, set);

                let pause_collection = (exchange == 'binance' ? 'pause_orders' : 'pause_orders_' + exchange)
                let ins = await db.collection(pause_collection).insertOne(obj);

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

router.post('/pause_lth_order', (req, res) => {

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
                    'status': 'lth_pause'
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

router.post('/getUserbalance', (req, res) => {
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

router.post('/resume_order', (req, res) => {
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
                    'is_sell_order': 'resume_pause'
                };
                let where = {
                    '_id': obj._id
                }

                let update = db.collection(sold_collection).updateOne(where, set);

                // let pause_collection = (exchange == 'binance' ? 'pause_orders' : 'pause_orders_'+exchange)
                // let ins = await db.collection(pause_collection).insertOne(obj);

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

router.post('/latest_user_activity', (req, res) => {
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

router.post('/update_user_balance', (req, res)=>{

    let user_id = req.body.user_id
    if(typeof user_id != 'undefined' && user_id != ''){
        let updateWallet = update_user_balance(user_id)
    }

    res.send({
        'status': true,
        'message': 'balance updated'
    });

})

async function update_user_balance(user_id) {
    //Update Binance Balance
    var options = {
        method: 'GET',
        url: 'https://app.digiebot.com/admin/Updatebalance/update_user_vallet/' + user_id,
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
        json: {}
    };
    request(options, function (error, response, body) { });

    //Update Bam Balance
    var options = {
        method: 'POST',
        url: 'http://34.205.124.51:2607/apiEndPoint/updateBalance',
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
            'user_id': user_id
        }
    };
    request(options, function (error, response, body) { });

    return true
}

router.post('/getNotifications', (req, res) => {
    conn.then(async (db) => {

        let admin_id = req.body.user_id
        let skip = req.body.skip
        let limit = req.body.limit
        let load_more = req.body.load_more
        let sort = {'_id': -1}

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

            let notifications = await db.collection('notifications').find(where).sort(sort).skip(skip).limit(limit).toArray();

            if (notifications.length > 0) {
                res.send({
                    'status': true,
                    'notifications': notifications,
                    'message': 'Notifications found successfully'
                });
            } else {
                res.send({
                    'status': false,
                    'notifications': [],
                    'message': 'Notifications not found.'
                });
            }
        }

    })
})

router.post('/readNotifications', (req, res) => {
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
                console.log(ids);

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

router.post('/getSubscription', async (req, res) => {

    let user_id = req.body.user_id
    if (typeof user_id != 'undefined' && user_id != ''){
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
                'user_id': user_id,
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

//getPrice
router.post('/getPrice', async (req, res) => {

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

router.post('/buyCoin', (req, res) => {
    conn.then(async (db) => {
        let data = req.body.data
        let exchange = data.exchange
        let application_mode = data.application_mode
        let admin_id = data.admin_id
        let symbol = data.symbol
        let quantity = data.quantity
        let buy_currency = data.buy_currency
        let buy_now = data.buy_now
        let auto_buy = data.auto_buy
        let trigger_buy_usdt_worth = data.trigger_buy_usdt_worth
        let auto_buy_usdt_worth = data.auto_buy_usdt_worth

        let created_date = new Date()
        let updated_date = new Date()

        if (typeof exchange == 'undefined' || exchange == '' 
        || typeof application_mode == 'undefined' || application_mode == '' 
        || typeof admin_id == 'undefined' || admin_id == '' 
        || typeof symbol == 'undefined' || symbol == '' 
        || typeof buy_currency == 'undefined' || buy_currency == '' 
        || typeof buy_now == 'undefined' || buy_now == ''
        || typeof auto_buy == 'undefined' || auto_buy == '') {
            res.send({
                'status': false,
                'message': 'exchange, application_mode, admin_id, symbol, buy_currency, buy_now, auto_buy are required fields.'
            });
        } else {

            //Check if AutoBuy enbled
            if (auto_buy == 'yes'){
                //Set the coin auto buy and hit cronjob now for this user
                let buyArr = {
                    'application_mode': application_mode,
                    'admin_id': admin_id,
                    'symbol': symbol,
                    'buy_currency': buy_currency,
                    // 'quantity': quantity,
                    // 'buy_now': buy_now,
                    // 'status': status,
                    'auto_buy': auto_buy,
                    'trigger_buy_usdt_worth': trigger_buy_usdt_worth,
                    'auto_buy_usdt_worth': auto_buy_usdt_worth,
                    'created_date': created_date,
                    'updated_date': updated_date,
                }

                //Update or Insert CoinAutoBuy settings 
                if (await coinAutoBuy(buyArr, exchange)){
                    hit_auto_buy_cron(admin_id)
                    res.send({
                        'status': true,
                        'message': 'Auto Buy settings saved successfully.'
                    });
                }else{
                    res.send({
                        'status': false,
                        'message': 'Something went wrong while saving Auto Buy settings.'
                    });
                }

            }else{

                //Check if BuyNow enabled
                if (buy_now == 'yes') {
                    //Send buy now call fro this quantity for this user

                    if (typeof quantity == 'undefined' || quantity == ''){
                        res.send({
                            'status': false,
                            'message': 'Quantity is required.'
                        });
                    }else{
                        let buyArr = {
                            'application_mode': application_mode,
                            'admin_id': admin_id,
                            'symbol': symbol,
                            'buy_currency': buy_currency,
                            'quantity': quantity,
                            'buy_now': buy_now,
                            'status': 'new_bnb_autoBuy',
                            'created_date': created_date,
                        }
                        //TODO: send for buyNow
                        if(await coinBuyNow(buyArr, exchange)){
                            res.send({
                                'status': true,
                                'message': 'Buy now request sent successfully.'
                            });
                        }else{
                            res.send({
                                'status': false,
                                'message': 'Something went wrong while sending Buy now request.'
                            });
                        }
                    }

                }else{
                    res.send({
                        'status': false,
                        'message': 'Something went wrong please recheck request data.'
                    });
                }
            }
        }

    })
})//End buyCoin

//coinBuyNow
async function coinBuyNow(buyArr, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            let collectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_'+exchange
            db.collection(collectionName).insertOne(buyArr, async (err, result) => {
                if (err) {
                    console.log(err)
                    resolve(false)
                } else {
                    resolve(true)
                }
            })
        })
    })
}//End coinBuyNow

//coinAutoBuy
async function coinAutoBuy(buyArr, exchange) {
    return new Promise((resolve) => {
        conn.then((db) => {
            var where = {
                'admin_id': buyArr.admin_id,
                'symbol': buyArr.symbol,
                'application_mode': buyArr.application_mode,
            }
            let collectionName = exchange == 'binance' ? 'auto_buy' : 'auto_buy_'+exchange
            db.collection(collectionName).find(where).toArray(async (err, data) => {
                if (err) {
                    resolve(false)
                } else {
                    //TODO: if already exit update the entry otherwise create new entry
                    if (data.length > 0) {
                        delete buyArr['created_date']
                        var set = {};
                        set['$set'] = buyArr

                        //Update AutoBuy setting  
                        db.collection(collectionName).updateOne(where, set, async (err, result) => {
                            if (err) {
                                console.log(err)
                                resolve(false)
                            } else {
                                resolve(true)
                            }
                        })
                    }else{
                        //Insert AutoBuy setting
                        db.collection(collectionName).insertOne(buyArr, async (err, result) => {
                            if (err) {
                                console.log(err)
                                resolve(false)
                            } else {
                                resolve(true)
                            }
                        })
                    }
                }
            })
        })
    })
}//End coinAutoBuy

//hit_auto_buy_cron
async function hit_auto_buy_cron(user_id) {
    var options = {
        method: 'GET',
        url: 'https://app.digiebot.com/admin/api_calls/auto_buy_bnb/' + user_id,
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
        json: {}
    };
    request(options, function (error, response, body) { });

    return true
}//end hit_auto_buy_cron(user_id)

router.post('/update_qty_from_usd_worth', (req, res) => {
    let user_id = req.body.user_id
    let exchange = req.body.exchange
    let symbol = req.body.symbol

    let where_user = { 
        'application_mode': { 
            '$in': ['live', 'both', 'BOTH', 'LIVE'] 
        } 
    }

    if (typeof user_id != 'undefined' && user_id != ''){
        where_user['_id'] = new ObjectID(String(user_id))
    }
    
    conn.then((db) => {
        db.collection('users').find(where_user).project({ '_id': 1, 'username':1 }).toArray(async (err, result) => {
            if (err) {
                console.log(err)
            } else {
                // let user_ids = [];
                // let usernames = [];
                // await Promise.all(result.map(user => { user_ids.push({ 'user_id': String(user._id), 'username': user.username}); }))

                result.forEach(async user => {
                    let curr_user_id = String(user._id)
                    console.log('==================================   ', user.username)

                    if (typeof exchange != 'undefined' && exchange != '' && typeof symbol != 'undefined' && symbol != '') {
                        
                        // for only this exchange and this symbol only
                        await update_qty_from_usd_worth(curr_user_id, exchange, symbol)

                    } else if (typeof exchange != 'undefined' && exchange != ''){

                        // for only this exchange but all it's symbols
                        await update_qty_from_usd_worth(curr_user_id, exchange)

                    } else if (typeof symbol != 'undefined' && symbol != ''){
        
                        // for all exchange but only this symbol
                        await update_qty_from_usd_worth(curr_user_id, 'binance', symbol)
                        await update_qty_from_usd_worth(curr_user_id, 'bam', symbol)

                    }else{

                        // for all exchange and all coins
                        await update_qty_from_usd_worth(curr_user_id, 'binance')
                        await update_qty_from_usd_worth(curr_user_id, 'bam')
                    }
                });

            }
        })
    })

    res.send({
        'status': true,
        'message': 'Qty updated successfully.'
    });
})//End update_qty_from_usd_worth

//update_qty_from_usd_worth
async function update_qty_from_usd_worth(user_id, exchange, symbol='') {

    console.log('update_qty_from_usd_worth')

    return new Promise(async (resolve) => {
        conn.then(async (db) => {
            var where = {
                'admin_id': user_id,
                'application_mode': 'test',
                'parent_status': 'parent',
                'status': {'$in': ['new', 'takingOrder']},
                'usd_worth': {'$exists': true},
            }
            if (typeof symbol != 'undefined' && symbol != ''){
                where['symbol'] = symbol
            }
            const collectionName = exchange == 'binance' ? 'buy_orders' : 'buy_orders_' + exchange

            let parent_orders = await db.collection(collectionName).aggregate([
                {
                    $match: where
                },
                {
                    $group: {
                        '_id': { 
                            'symbol': '$symbol', 
                        },
                        'orders': { '$push': '$$ROOT' } 
                    }
                },
            ], { allowDiskUse: true }).toArray()

            let parentArrLen = parent_orders.length
            for (var i = 0; i < parentArrLen; i++) {
                let item = parent_orders[i]
                
                console.log(item['_id']['symbol'], ' total orders : ', item.orders.length)
                // console.log(item.orders)

                let promise1 = listmarketPriceMinNotation('BTCUSDT', exchange)
                let promise2 = listmarketPriceMinNotation(item['_id']['symbol'], exchange)

                let myPromises = await Promise.all([promise1, promise2])
                let BTCUSDT_Data = myPromises[0]
                let symbol_Data = myPromises[1]

                // console.log(item['_id']['symbol'])
                // console.log(BTCUSDT_Data)
                // console.log(symbol_Data)

                let BTCUSDTPRICE = BTCUSDT_Data['currentmarketPrice'][0]['price']
                let currentMarketPrice = symbol_Data['currentmarketPrice'][0]['price']
                let marketMinNotation = symbol_Data.marketMinNotation
                let marketMinNotationStepSize = symbol_Data.marketMinNotationStepSize
                let toFixedNum = (marketMinNotationStepSize + '.').split('.')[1].length

                //find min required quantity
                var extra_qty_percentage = 30;
                var extra_qty_val = 0;
                extra_qty_val = (extra_qty_percentage * marketMinNotation) / 100
                var calculatedMinNotation = parseFloat(marketMinNotation) + extra_qty_val;
                var minReqQty = (calculatedMinNotation / currentMarketPrice);
                minReqQty += marketMinNotationStepSize
                minReqQty = parseFloat(minReqQty.toFixed(toFixedNum))

                //TODO: find one usd worth of quantity
                let selectedCoin = item['_id']['symbol'];
                let splitArr = selectedCoin.split('USDT');
                let oneUsdWorthQty = 0;
                var usdWorthQty = 0
                var quantity = 0

                if (splitArr[1] == '') {
                    oneUsdWorthQty = 1 / currentMarketPrice
                    // console.log('USD COIN', oneUsdWorthQty);
                } else {
                    oneUsdWorthQty = 1 / (currentMarketPrice * BTCUSDTPRICE)
                    // console.log('BTC COIN', oneUsdWorthQty);
                }
                
                let ordersArrLen = item.orders.length
                for (var j = 0; j < ordersArrLen; j++) {
                    let order = item['orders'][j]

                    //TODO: update individual order
                    usdWorthQty = order['usd_worth'] * oneUsdWorthQty
                    quantity = parseFloat(usdWorthQty.toFixed(toFixedNum))
                    if (quantity < minReqQty) {
                        //do nothing
                        console.log('minQty error :  ', quantity, 'new calculated', ' < ', minReqQty, '(min required)', '   old Qty ===== ', order['quantity'])
                    } else {
                        //update quantity
                        updateFields = {
                            'quantity': quantity,
                            'modified_date': new Date()
                        }
                        let where22 = { '_id': order['_id'] }
                        console.log('old Qty ===== ', order['quantity'])
                        console.log('updatedQty ===== ', quantity)
                        console.log('order_id ', order['_id'])
                        // let updatePromise = updateOne(where22, updateFields, collectionName)

                        let show_hide_log = 'yes';
                        let type = 'usd_worth_qty_update';
                        let order_mode = order['application_mode'];
                        let order_created_date = order['created_date'];
                        let log_msg = 'Quantity was updated by usd worth with the change in market price from script'
                        //Save LOG
                        // let promiseLog = create_orders_history_log(order['_id'], log_msg, type, show_hide_log, exchange, order_mode, order_created_date)
                        // promiseLog.then((callback) => { })
                        
                    }
                }
            }

            // console.log(parent_orders[0]['orders'][0])
            resolve(true)
        })
    })
}//end update_qty_from_usd_worth(user_id)

module.exports = router;