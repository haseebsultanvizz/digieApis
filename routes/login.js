const express = require('express');
const speakeasy = require('speakeasy');
const conn = require('../connection/database');
ObjectID = require('mongodb').ObjectID;
const router = express.Router();

router.post('/login', (req, res) => {
    console.log(`DEBUG: Received login request`);
    console.log(req.session.uname, "===> req.session.uname");
    console.log(req.session, "===> req.session")

    if (req.session.uname && req.session.upass) {
        if (!req.session.tfa || !req.session.tfa.secret) {
            console.log(req.session, "===> req.session");
            if (req.body.uname == req.session.uname && req.body.upass == req.session.upass) {
                console.log(`DEBUG: Login without TFA is successful`);

                return res.send({
                    "status": 200,
                    "message": "success",
                    "id": "f141cbcse1696gt5g6ugy67"
                });
            }
            console.log(`ERROR: Login without TFA is not successful`);

            return res.send({
                "status": 403,
                "message": "Invalid username or password",
                "id": "f141cbcse1696gt5g6ugy67"
            });

        } else {
            if (req.body.uname != req.session.uname || req.body.upass != req.session.upass) {
                console.log(`ERROR: Login with TFA is not successful`);

                return res.send({
                    "status": 403,
                    "message": "Invalid username or password",
                    "id": "f141cbcse1696gt5g6ugy67"
                });
            }
            if (!req.headers['x-tfa']) {
                console.log(`WARNING: Login was partial without TFA header`);

                return res.send({
                    "status": 206,
                    "message": "Please enter the Auth Code",
                    "id": "f141cbcse1696gt5g6ugy67"
                });
            }
            let isVerified = speakeasy.totp.verify({
                secret: req.session.tfa.secret,
                encoding: 'base32',
                token: req.headers['x-tfa']
            });

            if (isVerified) {
                console.log(`DEBUG: Login with TFA is verified to be successful`);

                return res.send({
                    "status": 200,
                    "message": "success",
                    "id": "f141cbcse1696gt5g6ugy67"
                });
            } else {
                console.log(`ERROR: Invalid AUTH code`);

                return res.send({
                    "status": 206,
                    "message": "Invalid Auth Code",
                    "id": "f141cbcse1696gt5g6ugy67"
                });
            }
        }
    }

    return res.send({
        "status": 404,
        "message": "Please register to login",
        "id": "f141cbcse1696gt5g6ugy67"
    });
});


router.post('/login1', (req, res) => {
    console.log(`DEBUG: Received login request`);
    console.log(req.session, "===> req.session")
    var post_data = req.body;
    let username = post_data["username"];
    let password = post_data["password"];
    conn.then(db=>{
        let where_json = {"username": username, "password": password};
        db.collection("users_test").find(where_json).toArray(function(err, data){
            if (err) throw err;
            if(data.length > 0){
                req.session.username = data[0].username;
                req.session.password = data[0].password;
                console.log(req.session.username, "req.session.username");
                console.log(req.session.password, "req.session.password");
                console.log(req.body.username, "req.body.username");
                console.log(req.body.password, "req.body.password");
                if (req.session.username && req.session.password) {
                    if (!req.session.tfa || !req.session.tfa.secret) {
                        console.log(req.session, "===> req.session");
                        if (req.body.username == req.session.username && req.body.password == req.session.password) {
                            console.log(`DEBUG: Login without TFA is successful`);
                            res.send({
                                "status": 200,
                                "message": "success",
                                "sd": "f141cbcse1696gt5g6ugy67"
                            });
                        } else{
                            console.log(`ERROR: Login without TFA is not successful`);
                            res.send({
                                "status": 403,
                                "message": "Invalid username or password",
                                "id": "f141cbcse1696gt5g6ugy67"
                            });
                        }
                    } else {
                        if (req.body.username != req.session.username || req.body.password != req.session.password) {
                            console.log(`ERROR: Login with TFA is not successful`);

                            res.send({
                                "status": 403,
                                "message": "Invalid username or password",
                                "id": "f141cbcse1696gt5g6ugy67"
                            });
                        }
                        if (!req.headers['x-tfa']) {
                            console.log(`WARNING: Login was partial without TFA header`);
                            res.send({
                                "status": 206,
                                "message": "Please enter the Auth Code",
                                "id": "f141cbcse1696gt5g6ugy67"
                            });
                        }
                        let isVerified = speakeasy.totp.verify({
                            secret: req.session.tfa.secret,
                            encoding: 'base32',
                            token: req.headers['x-tfa']
                        });

                        if (isVerified) {
                            console.log(`DEBUG: Login with TFA is verified to be successful`);

                            res.send({
                                "status": 200,
                                "message": "success",
                                "id": "f141cbcse1696gt5g6ugy67"
                            });
                        } else {
                            console.log(`ERROR: Invalid AUTH code`);

                            res.send({
                                "status": 206,
                                "message": "Invalid Auth Code",
                                "id": "f141cbcse1696gt5g6ugy67"
                            });
                        }
                    }
                } 
            } else{
                res.send({
                    "status": 404,
                    "message": "Please register to login",
                    "id": "f141cbcse1696gt5g6ugy67"
                });
            }
        })
    })
});

router.post('/login2', (req, res) => {
    console.log(`DEBUG: Received login request`);
    var post_data = req.body;

    if(Object.keys(post_data).length > 0){
        conn.then(db=>{
            let username = post_data.username;
            let password = post_data.password;
            let where_json = {};
            where_json['username'] = username;
            where_json['password'] = password;
            db.collection("users_test").find(where_json).toArray(function(err, data){
                if (err) throw err;
                if(data.length > 0){
                    let db_id = data[0]['_id'];
                    req.session.first_name = data[0].first_name;
                    req.session.last_name = data[0].last_name;
                    req.session.email_address = data[0].email_address;
                    req.session.phone_number = data[0].phone_number;
                    req.session.profile_image = data[0].profile_image;
                    req.session.timezone = data[0].timezone;
                    req.session.google_auth = data[0].google_auth;
                    req.session.google_auth_code = data[0].google_auth_code;
                    req.session.application_mode = data[0].application_mode;
                    req.session.last_login_datetime = data[0].last_login_datetime;
                    req.session.auto_sell_enable = data[0].auto_sell_enable;
                    req.session.user_role = data[0].user_role;
                    req.session.status = data[0].status;
                    req.session.special_role = data[0].special_role;
                    req.session.settings_id = data[0].settings_id;
                    req.session.api_key = data[0].api_key;
                    req.session.api_secret = data[0].api_secret;
                    console.log(req.session, "===> req.session data")
                    res.send({"status": 200, "success": "true", "message": "user logged in successfully", "_id": String(db_id), "data": data[0]});
                } else{
                    res.send({"status": 401, "success": "false", "message": "user does not exist please register first"})
                }
            })
        })
    } else{
        res.send({"success": "false", "status": 404, "message": "please post some data before continuing "})
    }



    

    // if (req.session.uname && req.session.upass) {
    //     if (!req.session.tfa || !req.session.tfa.secret) {
    //         if (req.body.uname == req.session.uname && req.body.upass == req.session.upass) {
    //             console.log(`DEBUG: Login without TFA is successful`);

    //             return res.send({
    //                 "status": 200,
    //                 "message": "success",
    //                 "id": "f141cbcse1696gt5g6ugy67"
    //             });
    //         }
    //         console.log(`ERROR: Login without TFA is not successful`);

    //         return res.send({
    //             "status": 403,
    //             "message": "Invalid username or password",
    //             "id": "f141cbcse1696gt5g6ugy67"
    //         });

    //     } else {
    //         if (req.body.uname != req.session.uname || req.body.upass != req.session.upass) {
    //             console.log(`ERROR: Login with TFA is not successful`);

    //             return res.send({
    //                 "status": 403,
    //                 "message": "Invalid username or password",
    //                 "id": "f141cbcse1696gt5g6ugy67"
    //             });
    //         }
    //         if (!req.headers['x-tfa']) {
    //             console.log(`WARNING: Login was partial without TFA header`);

    //             return res.send({
    //                 "status": 206,
    //                 "message": "Please enter the Auth Code",
    //                 "id": "f141cbcse1696gt5g6ugy67"
    //             });
    //         }
    //         let isVerified = speakeasy.totp.verify({
    //             secret: req.session.tfa.secret,
    //             encoding: 'base32',
    //             token: req.headers['x-tfa']
    //         });

    //         if (isVerified) {
    //             console.log(`DEBUG: Login with TFA is verified to be successful`);

    //             return res.send({
    //                 "status": 200,
    //                 "message": "success",
    //                 "id": "f141cbcse1696gt5g6ugy67"
    //             });
    //         } else {
    //             console.log(`ERROR: Invalid AUTH code`);

    //             return res.send({
    //                 "status": 206,
    //                 "message": "Invalid Auth Code",
    //                 "id": "f141cbcse1696gt5g6ugy67"
    //             });
    //         }
    //     }
    // }

    // return res.send({
    //     "status": 404,
    //     "message": "Please register to login",
    //     "id": "f141cbcse1696gt5g6ugy67"
    // });
});

router.post('/logout', function(req, res, next){
    req.session.destroy();
    res.send({"success": "true", "message": "logged out successfully"});
})

module.exports = router;