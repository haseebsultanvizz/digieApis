const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const conn = require('./connection/database');
const router = express.Router();

router.post('/tfa/setup', (req, res) => {
    console.log(`DEBUG: Received TFA setup request`);

    const secret = speakeasy.generateSecret({
        length: 10,
        name: req.session.uname,
        issuer: 'NarenAuth v0.0'
    });
    var url = speakeasy.otpauthURL({
        secret: secret.base32,
        label: req.session.uname,
        issuer: 'NarenAuth v0.0',
        encoding: 'base32'
    });
    conn.then(db=>{
        db.collection("users_test").updateOne({"username": req.session.username, "password": req.session.password}, {$set: {"google_auth_code": secret.base32, "google_auth": "yes"}})
    })
    QRCode.toDataURL(url, (err, dataURL) => {
        req.session.tfa = {
            secret: '',
            tempSecret: secret.base32,
            dataURL,
            tfaURL: url
        };
        return res.json({
            message: 'TFA Auth needs to be verified',
            tempSecret: secret.base32,
            dataURL,
            tfaURL: secret.otpauth_url
        });
    });
});


router.get('/tfa/setup', (req, res) => {
    console.log(`DEBUG: Received FETCH TFA request`);

    res.json(req.session.tfa ? req.session.tfa : null);
});

router.delete('/tfa/setup', (req, res) => {
    console.log(`DEBUG: Received DELETE TFA request`);

    delete req.session.tfa;
    res.send({
        "status": 200,
        "message": "success"
    });
});

router.post('/tfa/verify', (req, res) => {
    console.log(`DEBUG: Received TFA Verify request`);

    let isVerified = speakeasy.totp.verify({
        secret: req.session.tfa.tempSecret,
        encoding: 'base32',
        token: req.body.token
    });

    if (isVerified) {
        console.log(`DEBUG: TFA is verified to be enabled`);

        req.session.tfa.secret = req.session.tfa.tempSecret;
        return res.send({
            "status": 200,
            "message": "Two-factor Auth is enabled successfully"
        });
    }

    console.log(`ERROR: TFA is verified to be wrong`);

    return res.send({
        "status": 403,
        "message": "Invalid Auth Code, verification failed. Please verify the system Date and Time"
    });
});




router.post('/tfa/setup1', (req, res) => {
    console.log(`DEBUG: Received TFA setup request`);

    const secret = speakeasy.generateSecret({
        length: 10,
        name: req.session.uname,
        issuer: 'NarenAuth v0.0'
    });
    var url = speakeasy.otpauthURL({
        secret: secret.base32,
        label: req.session.uname,
        issuer: 'NarenAuth v0.0',
        encoding: 'base32'
    });
    conn.then(db=>{
        db.collection("users_test").updateOne({"username": req.session.username, "password": req.session.password}, {$set: {"google_auth_code": secret.base32, "google_auth": "yes"}})
    })
    QRCode.toDataURL(url, (err, dataURL) => {
        req.session.tfa = {
            secret: '',
            tempSecret: secret.base32,
            dataURL,
            tfaURL: url
        };
        return res.json({
            message: 'TFA Auth needs to be verified',
            tempSecret: secret.base32,
            dataURL,
            tfaURL: secret.otpauth_url
        });
    });
});

router.get('/tfa/setup1', (req, res) => {
    console.log(`DEBUG: Received FETCH TFA request`);

    res.json(req.session.tfa ? req.session.tfa : null);
});

router.delete('/tfa/setup1', (req, res) => {
    console.log(`DEBUG: Received DELETE TFA request`);

    delete req.session.tfa;
    res.send({
        "status": 200,
        "message": "success"
    });
});
router.post('/tfa/verify1', (req, res) => {
    console.log(`DEBUG: Received TFA Verify request`);
    var post_data = req.body;
    let post_data_key_array = Object.keys(post_data);
    if(post_data_key_array.length == 0){
        res.send({"success": "false", "message": "please post token in order to verify"})
    } else{
        conn.then(db=>{
            db.collection("users_test").findOne({"username": req.session.username, "password": req.session.password}, {"google_auth_code": 1}, function(err, data){
                if (err) throw err;
                if (data){
                    let isVerified = speakeasy.totp.verify({
                        secret: data["google_auth_code"],
                        encoding: 'base32',
                        token: post_data.token
                    });

                    if (isVerified) {
                        console.log(`DEBUG: TFA is verified to be enabled`);

                        req.session.tfa.secret = data["google_auth_code"];
                        return res.send({
                            "status": 200,
                            "message": "Two-factor Auth is enabled successfully"
                        });
                    }

                    console.log(`ERROR: TFA is verified to be wrong`);

                    return res.send({
                        "status": 403,
                        "message": "Invalid Auth Code, verification failed. Please verify the system Date and Time"
                    });
                }
            })
        })
    }  
});

module.exports = router;