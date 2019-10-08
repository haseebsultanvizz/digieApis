const express = require('express');
const conn = require('../database');
ObjectID = require('mongodb').ObjectID;
const router = express.Router();


router.post('/register', (req, res) => {
    console.log(`DEBUG: Received request to register user`);

    const result = req.body;

    if ((!result.uname && !result.upass) || (result.uname.trim() == "" || result.upass.trim() == "")) {
        return res.send({
            "status": 400,
            "message": "Username / password is required"
        });
    }

    req.session.uname = result.uname;
    req.session.upass = result.upass;
    console.log(req.session, "===> req.session userObject");
    delete req.session.tfa;

    return res.send({
        "status": 200,
        "message": "User is successfully registered"
    });
});


router.post('/register2', (req, res) => {
    console.log(`DEBUG: Received request to register user`);

    const result = req.body;
    console.log(result, "===> result")

    if ((!result.username && !result.password) || (result.username.trim() == "" || result.password.trim() == "")) {
        return res.send({
            "status": 400,
            "message": "Username / password is required"
        });
    }
    console.log(result.username, "===> result")
    req.session.username = result.username;
    req.session.password = result.password;
    console.log(req.session, "===> req.session userObject");
    delete req.session.tfa;

    return res.send({
        "status": 200,
        "message": "User is successfully registered"
    });
});

router.post('/register1', (req, res) => {
    console.log(`DEBUG: Received request to register user`);
    const post_data = req.body;
    if(Object.keys(post_data).length > 0){
        conn.then(db=>{
            db.collection("users_test").find(post_data).toArray(function(err, data){
                if (err) throw err;
                if(data.length > 0){
                    console.log(req.session, "===> req.session")
                    res.send({"status": 400,"success": "false", "message": "user already exists"})
                } else{
                    db.collection('users_test').insertOne(post_data, function(err, obj){
                        if (err) throw err;
                        console.log(obj.result, "===> data inserted");
                        res.send({"status": 200,"success": "true", "message": "user created successfully", "_id": obj.insertedId});
                    })
                }
            })
        })
    }
    else{
        res.send({"success": "false", "message": "require some sort of data for signup"})
    }
});

// firstName: req.body.firstName,
// lastName: req.body.lastName,
// username: req.body.username,
// email: req.body.email,
// phone: req.body.phone,
// code: req.body.code,
// password: req.body.password,
// timeZone: req.body.timeZone,
// userType: user,
// created_date: Date.now()

module.exports = router;

