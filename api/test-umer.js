const conn = require('../connection/database');
// live user
validate_bam_credentials('hVrnDhvqjsbcZ66lQj0P78UbCCPEvWWwMBYWje1b1o6tExPgrOZvcGc8bVsJS1sY', 'j35v0zGcc6uBdp47FbRehgA4fl24KeBILxrsFE3CP1MsFabhizdbL9NPhDQ3XWdQ', '5eb5a2658b65c31ff8233604')

//admin user
// validate_bam_credentials('RIdhBIHslQoloZM73trCFmcqUuDsn9vn0YGb3LkPvv1Z2XxmkNnkGugGKMB7YZSk', 'uWbSWW9Zz526nsyUrzUdYsqOzGkrb35w5hSNebErm1dCMW9uXKoKneIThAkcbVWG', '5c0912b7fc9aadaac61dd072')
function validate_bam_credentials(APIKEY, APISECRET, user_id = '') {
    return new Promise((resolve, reject) => {
        // Bam
        var binance = require('node-binance-api')().options({
            APIKEY: APIKEY,
            APISECRET: APISECRET,
            useServerTime: true
        });
        // binance.balance((error, balances) => {
            binance.depositHistory((error, balances) => {
            // binance.withdrawHistory((error, balances) => {
            if (error) {

                // //invalid Credentials
                // let where = {
                //     'api_key': APIKEY,
                //     'api_secret': APISECRET
                // }
                // if (user_id != '') {
                //     where['user_id'] = user_id
                // }
                // let set = {
                //     '$set': {
                //         'status': 'credentials_error'
                //     }
                // }
                // conn.then(async (db) => {
                //     await db.collection('bam_credentials').updateOne(where, set)
                // })

                console.log(error.body)

                let message = {};
                message['status'] = 'error';
                message['message'] = error.body;
                resolve(message);
            } else {

                console.log(balances)
                
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
                    // await db.collection('bam_credentials').updateOne(where, set)
                })

                let message = {};
                message['status'] = 'success';
                message['message'] = balances;
                resolve(message);
            }
        });
    })
} //End of validate_bam_credentials