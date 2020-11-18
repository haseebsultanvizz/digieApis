
// *** COST AVERAGE ORDERS GOES HERE *** //
updateAveragePrice : (ist_parent_child_buy_id, currentPurchasePrice )=>{
return new Promise((resolve) =>{
conn.then((db)=>{
(async () => {
var istParentOrderArr = await module.exports.listSoldBuyOrderCostParent(ist_parent_child_buy_id);

if(typeof istParentOrderArr == "undefined" || istParentOrderArr == ""){
var ObjPurch = {'purchased_price' : parseFloat(currentPurchasePrice)};
module.exports.update_sub_document(ist_parent_child_buy_id, "buy_orders", ObjPurch, 'avg_purchase_price');
var istParentOrderArr = await module.exports.listBuyOrderCostParent(ist_parent_child_buy_id);
}else{

var ObjPurch = {'purchased_price' : parseFloat(currentPurchasePrice)};
module.exports.update_sub_document(ist_parent_child_buy_id, "sold_buy_orders", ObjPurch, 'avg_purchase_price');
if((istParentOrderArr['cavg_parent']=='yes') && (typeof istParentOrderArr['avg_purchase_price'] ==="undefined" || istParentOrderArr['avg_purchase_price'] =="undefined")){
var ObjPurch = {'purchased_price' : parseFloat(istParentOrderArr['purchased_price'])};
module.exports.update_sub_document(ist_parent_child_buy_id, "sold_buy_orders", ObjPurch, 'avg_purchase_price');
}
}

var countOrderBuy = 1;
var OverAllSellPrice = 0
var byyOrderArrsIdToSell = [];
var overAllBuyPercentage = 0;
var overAllpurchasedPrice = 0;
var overAllSoldPercentage = 0;
var overAllSellPercentage = 0
byyOrderArrsIdToSell.push(istParentOrderArr['_id']);
var purchasePrice = istParentOrderArr['purchased_price'];// Get purchasePrice
var avg_orders_ids = istParentOrderArr['avg_orders_ids'];// Get avg_orders_ids
var definedSellPercentage = istParentOrderArr['defined_sell_percentage'];// Get Defined Sell Percentage

// For parent Order we have
overAllBuyPercentage += definedSellPercentage;
overAllpurchasedPrice += purchasePrice;

if(avg_orders_ids!== "undefined"){
if(avg_orders_ids.length > 0){
for(let avgIndex in avg_orders_ids){
var childBuyOrderId = avg_orders_ids[avgIndex];
// Here we Get the orders from Buy order collection
var childOrderArr = await module.exports.getBuyOrderNotSold(childBuyOrderId)
if(typeof childOrderArr!=='undefined' && childOrderArr.length > 0){
// *countOrderBuy* used for to count the buy orders
countOrderBuy++;
// *profitPercentage* used for to get the default profit percentage from buy order collection like i-e 1.2
var profitPercentage = childOrderArr[0]['sell_profit_percent'];
// *purchasedPrice* used for to get the purchased price from buy order collection
var purchasedPrice = childOrderArr[0]['purchased_price'];
// *overAllBuyPercentage* used to sum overall buy percentage from buy order collection
overAllBuyPercentage += profitPercentage;
// *overAllpurchasedPrice* used to sum overall buy purchased price from buy order collection
overAllpurchasedPrice += purchasedPrice;
byyOrderArrsIdToSell.push(childBuyOrderId);
}else{
// ELSE we get the orders from sold_buy_order collectio
var childOrderArr = await module.exports.getSoldBuyOrder(childBuyOrderId)
if(typeof childOrderArr!=='undefined' && childOrderArr.length > 0){
// *SoldprofitPerc* used for to get the default profit percentage from sold_buy_orders collection like i-e 1.2
var SoldprofitPerc = childOrderArr[0]['sell_profit_percent'];
// *overAllSellPercentage* used for to SUM overall sold percentage from sold_buy_orders collection
overAllSellPercentage += SoldprofitPerc;
// *purchasedPrice* To get purchsed price from sold_buy_orders collection
var purchasedPrice = childOrderArr[0]['purchased_price'];
// *marketSoldPrice* To get market sold price from sold_buy_orders collection
var marketSoldPrice = childOrderArr[0]['market_sold_price'];
// *differenceBetwn* To calucalte percentage first we take differnce from sold_buy_orders collection
var differenceBetwn = marketSoldPrice - purchasedPrice ;
// *profitPercentage* Get single order percentage from sold_buy_orders collection
let profitPercentage = (differenceBetwn * 100) / purchasedPrice;
// *overAllSoldPercentage* Sum overall the percentages from sold_buy_orders collection
overAllSoldPercentage += profitPercentage;
}
}// END of else
}
}
}
// Update the price in parent order
var finalSoldPercentage = -1 * overAllSellPercentage + (1* overAllSoldPercentage)
var buyAvgpercentage = overAllBuyPercentage / countOrderBuy;
if(finalSoldPercentage < 0){
// *soldProfitAndLoss* Its mean that we can distribute the sold order profit and loss on current open orders
var soldProfitAndLoss = finalSoldPercentage / countOrderBuy;
// *eachOrderNeedPerc* Its mean that now the current open orders profit and loss need to be sold of each order
var eachOrderNeedPerc = (-1 * soldProfitAndLoss) + buyAvgpercentage;
// Break Even Here it means profit and loss zero 0
var avgPurchasedPrice = overAllpurchasedPrice / countOrderBuy
// *TargetSellPriceOrder* Calculate the needed profit and loss perrcentage on current open orders
var TargetSellPriceOrder = avgPurchasedPrice + (avgPurchasedPrice * eachOrderNeedPerc /100)
// *OverAllSellPrice* So its the requiered price that we need to sold the over all ledger on this price
OverAllSellPrice = parseFloat(TargetSellPriceOrder);
}else if(finalSoldPercentage > 0){ // When the sold order percentage are greater than 0 so we distrubit the profit and loss on current Open orders

// *soldProfitAndLoss* Its mean that we can distribute the sold order profit and loss on current open orders
var soldProfitAndLoss = finalSoldPercentage / countOrderBuy;
// *eachOrderNeedPerc* Its mean that now the current open orders profit and loss need to be sold of each order
var eachOrderNeedPerc = buyAvgpercentage - soldProfitAndLoss;
// Break Even Here it smean profit and loss zero 0
var avgPurchasedPrice = overAllpurchasedPrice / countOrderBuy
// *TargetSellPriceOrder* Calculate the needed profit and loss perrcentage on current open orders
var TargetSellPriceOrder = avgPurchasedPrice + (avgPurchasedPrice * eachOrderNeedPerc /100)
// *OverAllSellPrice* So its the requiered price that we need to sold the over all ledger on this price
OverAllSellPrice = parseFloat(TargetSellPriceOrder);
}else{// When the ledger have no sold orders so then else condition become true
// *eachOrderNeedPerc* Its mean that we can take the percentage profit from sinlge order i-e take from parent order .
var eachOrderNeedPerc = definedSellPercentage;
// Break Even Here it smean profit and loss zero 0
var avgPurchasedPrice = overAllpurchasedPrice / countOrderBuy
// *TargetSellPriceOrder* Calculate the needed profit and loss perrcentage on current open orders
var TargetSellPriceOrder = avgPurchasedPrice + (avgPurchasedPrice * eachOrderNeedPerc /100)
// *OverAllSellPrice* So its the requiered price that we need to sold the over all ledger on this price
OverAllSellPrice = parseFloat(TargetSellPriceOrder);
}
// END Here we need new code to be update avg_sell_price in parent order
if(typeof istParentOrderArr == "undefined" || istParentOrderArr == ""){
console.log("if condition update line number 1336", OverAllSellPrice)
let updBuyCost = {};
let bO_searchCriteriaCost = {};
updBuyCost.avg_sell_price = OverAllSellPrice;
let bO_collection = "buy_orders";
bO_searchCriteriaCost['_id'] = new ObjectId(ist_parent_child_buy_id);
module.exports.update(bO_searchCriteriaCost, updBuyCost, bO_collection);
resolve(true);
}else{

console.log("Else condition update line number 1346", OverAllSellPrice)
let updBuyCost = {};
let bO_searchCriteriaCost = {};
updBuyCost.avg_sell_price = OverAllSellPrice;
let bO_collection = "sold_buy_orders";
bO_searchCriteriaCost['_id'] = new ObjectId(ist_parent_child_buy_id);
module.exports.update(bO_searchCriteriaCost, updBuyCost, bO_collection);
resolve(true);
}
})();
})// END of db.collection("sold_buy_orders")
})
},// END of getDownOrdersFromPurchasedPrice