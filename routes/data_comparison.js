var express = require('express');
var router = express.Router();
var request = require('request');
const conn = require('../connection/database');
ObjectID = require('mongodb').ObjectID;
var app = express();


router.post('/compare_live_test', function(req, res, next){
	var post_data = req.body;
	let post_data_key_array = Object.keys(post_data);
	console.log(post_data, "===> post_data")
	if(post_data_key_array.length == 0){
		res.send({"success": "false", "message": "No data posted in a post request"})
	} else{
		
	}
})