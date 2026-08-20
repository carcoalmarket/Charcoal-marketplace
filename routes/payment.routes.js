const router = require("express").Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");
const {
  getPiUser,
  fetchPayment,
  approvePayment,
  completePayment,
  cancelPayment
} = require("../piService");

async function getCheckoutForUser(checkoutRef,userId,connection){
  const [orders]=await connection.query(
    `SELECT o.*,p.name,p.vendor_id
     FROM orders o JOIN products p ON o.product_id=p.id
     WHERE o.checkout_ref=? AND o.buyer_id=?
     ORDER BY o.id`,
    [checkoutRef,userId]
  );
  return orders;
}

/* Called by Pi SDK onReadyForServerApproval. */
router.post("/approve", verifyToken(), async (req,res)=>{
  const {paymentId,checkout_ref:checkoutRef,accessToken}=req.body||{};
  if(!paymentId||!checkoutRef||!accessToken)
    return res.status(400).json({success:false,message:"paymentId, checkout_ref and Pi accessToken are required"});

  const connection=await db.promise().getConnection();
  try{
    const piUser=await getPiUser(accessToken);
    if(String(piUser.uid)!==String(req.user.pi_uid))
      return res.status(403).json({success:false,message:"Pi account does not match the signed-in account"});

    const orders=await getCheckoutForUser(checkoutRef,req.user.id,connection);
    if(!orders.length) return res.status(404).json({success:false,message:"Checkout not found"});
    if(orders.some(o=>o.status!=="pending"))
      return res.status(409).json({success:false,message:"Checkout is no longer pending"});

    const expected=Number(orders.reduce((s,o)=>s+Number(o.total_pi),0).toFixed(2));
    const payment=await fetchPayment(paymentId);
    if(!payment) return res.status(400).json({success:false,message:"Pi payment not found"});

    const amount=Number(payment.amount);
    if(Math.abs(amount-expected)>0.000001)
      return res.status(400).json({success:false,message:`Payment amount mismatch. Expected ${expected} Pi`});

    const paymentUid=payment.user_uid || payment.user?.uid;
    if(paymentUid && String(paymentUid)!==String(req.user.pi_uid))
      return res.status(403).json({success:false,message:"Payment user does not match buyer"});

    const metadata=payment.metadata||{};
    if(metadata.checkout_ref && String(metadata.checkout_ref)!==String(checkoutRef))
      return res.status(400).json({success:false,message:"Payment checkout does not match order"});

    await connection.beginTransaction();

    const [existing]=await connection.query(
      "SELECT id,status FROM payments WHERE payment_id=? LIMIT 1 FOR UPDATE",
      [paymentId]
    );

    if(existing.length && existing[0].status==="completed"){
      await connection.rollback();
      return res.json({success:true,message:"Payment already completed"});
    }

    const firstOrderId=orders[0].id;

    if(existing.length){
      await connection.query(
        `UPDATE payments SET order_id=?,amount_pi=?,status='pending',raw_data=? WHERE payment_id=?`,
        [firstOrderId,expected,JSON.stringify(payment),paymentId]
      );
    }else{
      await connection.query(
        `INSERT INTO payments(order_id,payment_id,amount_pi,status,raw_data)
         VALUES (?,?,?,'pending',?)`,
        [firstOrderId,paymentId,expected,JSON.stringify(payment)]
      );
    }

    await connection.query(
      `UPDATE orders SET payment_id=? WHERE checkout_ref=? AND buyer_id=? AND status='pending'`,
      [paymentId,checkoutRef,req.user.id]
    );

    await connection.commit();

    let approvedPiPayment=payment;

    if(payment.status!=="approved" && payment.status!=="completed"){
      try{
        approvedPiPayment=await approvePayment(paymentId);
      }catch(piError){
        await db.promise().query(
          `UPDATE payments SET status='failed',raw_data=? WHERE payment_id=?`,
          [JSON.stringify(piError.response?.data||piError.message),paymentId]
        );
        return res.status(502).json({success:false,message:"Pi payment approval failed"});
      }
    }

    await db.promise().query(
      `UPDATE payments SET status='approved',raw_data=? WHERE payment_id=?`,
      [JSON.stringify(approvedPiPayment||payment),paymentId]
    );

    await db.promise().query(
      `INSERT INTO payment_logs(payment_id,user_id,amount_pi,status,raw_data)
       VALUES (?,?,?,'approved',?)`,
      [paymentId,req.user.id,expected,JSON.stringify(approvedPiPayment||payment)]
    );

    res.json({success:true,message:"Payment approved"});
  }catch(error){
    try{await connection.rollback();}catch{}
    console.error("Payment approval:",error.response?.data||error.message);
    res.status(500).json({success:false,message:"Payment approval failed"});
  }finally{connection.release();}
});

/* Called by Pi SDK onReadyForServerCompletion. */
router.post("/complete", verifyToken(), async (req,res)=>{
  const {paymentId,txid,accessToken}=req.body||{};
  if(!paymentId||!txid||!accessToken)
    return res.status(400).json({success:false,message:"paymentId, txid and Pi accessToken are required"});

  const connection=await db.promise().getConnection();
  try{
    const piUser=await getPiUser(accessToken);
    if(String(piUser.uid)!==String(req.user.pi_uid))
      return res.status(403).json({success:false,message:"Pi account does not match signed-in account"});

    await connection.beginTransaction();

    const [paymentRows]=await connection.query(
      `SELECT * FROM payments WHERE payment_id=? LIMIT 1 FOR UPDATE`,
      [paymentId]
    );
    if(!paymentRows.length){ await connection.rollback(); return res.status(404).json({success:false,message:"Payment record not found"});}
    const dbPayment=paymentRows[0];

    if(dbPayment.status==="completed"){ await connection.rollback(); return res.json({success:true,message:"Payment already completed"});}

    const piPayment=await fetchPayment(paymentId);
    if(!piPayment){ await connection.rollback(); return res.status(400).json({success:false,message:"Unable to verify Pi payment"});}

    const piTxid=piPayment.transaction_id || piPayment.transaction?.txid;
    if(piTxid && String(piTxid)!==String(txid)){ await connection.rollback(); return res.status(400).json({success:false,message:"Transaction ID mismatch"});}

    const expected=Number(dbPayment.amount_pi);
    if(Math.abs(Number(piPayment.amount)-expected)>0.000001){ await connection.rollback(); return res.status(400).json({success:false,message:"Payment amount mismatch"});}

    await completePayment(paymentId,txid);

    const confirmed=await fetchPayment(paymentId);
    if(!confirmed || confirmed.status!=="completed"){ await connection.rollback(); return res.status(400).json({success:false,message:"Pi did not confirm payment completion"});}

    const [orders]=await connection.query(
      `SELECT o.*,p.vendor_id,p.name
       FROM orders o JOIN products p ON o.product_id=p.id
       WHERE o.payment_id=? AND o.buyer_id=? FOR UPDATE`,
      [paymentId,req.user.id]
    );
    if(!orders.length) throw new Error("Orders not found for payment");

    for(const order of orders){
      /* Stock was reserved during checkout, so only release the reservation flag. */
      await connection.query(
        `UPDATE orders SET status='paid',stock_reserved=0 WHERE id=?`,
        [order.id]
      );

      const platformFee=Number((Number(order.total_pi)*Number(process.env.PLATFORM_FEE_PERCENT||0)/100).toFixed(2));
      const net=Number((Number(order.total_pi)-platformFee).toFixed(2));

      const [earnings]=await connection.query(
        `SELECT id FROM earnings WHERE order_id=? LIMIT 1`,
        [order.id]
      );

      if(!earnings.length){
        await connection.query(
          `INSERT INTO earnings(vendor_id,order_id,amount_pi,platform_fee,net_amount,status)
           VALUES (?,?,?,?,?,'pending')`,
          [order.vendor_id,order.id,order.total_pi,platformFee,net]
        );
      }
    }

    await connection.query(
      `UPDATE payments SET status='completed',txid=?,raw_data=? WHERE payment_id=?`,
      [txid,JSON.stringify(confirmed),paymentId]
    );

    await connection.query(
      `INSERT INTO payment_logs(payment_id,user_id,amount_pi,status,txid,raw_data)
       VALUES (?,?,?,'completed',?,?)`,
      [paymentId,req.user.id,expected,txid,JSON.stringify(confirmed)]
    ).catch(()=>{});

    /* Buyer notification. */
    await connection.query(
      `INSERT INTO notifications(user_id,message,type) VALUES (?,?,?)`,
      [req.user.id,`Payment of ${expected} Pi completed successfully.`,`payment`]
    );

    /* Vendor notifications. */
    for(const order of orders){
      await connection.query(
        `INSERT INTO notifications(user_id,message,type) VALUES (?,?,?)`,
        [order.vendor_id,`New paid order received for ${order.name}.`,`order`]
      );
    }

    await connection.commit();
    res.json({success:true,message:"Payment completed successfully",payment_id:paymentId});
  }catch(error){
    try{await connection.rollback();}catch{}
    console.error("Payment completion:",error.response?.data||error.message);
    res.status(500).json({success:false,message:"Payment completion failed"});
  }finally{connection.release();}
});

/* Cancel/error callbacks restore reserved stock. */
router.post("/cancel", verifyToken(), async (req,res)=>{
  const {paymentId,checkout_ref:checkoutRef}=req.body||{};
  if(!paymentId && !checkoutRef)
    return res.status(400).json({success:false,message:"paymentId or checkout_ref required"});

  const connection=await db.promise().getConnection();
  try{
    if(paymentId){
      try{await cancelPayment(paymentId);}catch{}
    }
    await connection.beginTransaction();
    const [orders]=await connection.query(
      `SELECT * FROM orders WHERE buyer_id=? AND ${paymentId?"payment_id=?":"checkout_ref=?"} AND status='pending' FOR UPDATE`,
      paymentId?[req.user.id,paymentId]:[req.user.id,checkoutRef]
    );

    for(const o of orders){
      if(Number(o.stock_reserved)===1)
        await connection.query(`UPDATE products SET stock=stock+? WHERE id=?`,[o.quantity,o.product_id]);
      await connection.query(`UPDATE orders SET status='cancelled',stock_reserved=0 WHERE id=?`,[o.id]);
    }

    if(paymentId)
      await connection.query(`UPDATE payments SET status='failed' WHERE payment_id=? AND status<>'completed'`,[paymentId]);

    await connection.commit();
    res.json({success:true,message:"Payment cancelled"});
  }catch(error){
    try{await connection.rollback();}catch{}
    res.status(500).json({success:false,message:"Cancellation failed"});
  }finally{connection.release();}
});

/* Recover an incomplete Pi payment. */
router.post("/incomplete", verifyToken(), async (req,res)=>{
  const {paymentId,txid,accessToken}=req.body||{};
  if(!paymentId||!txid||!accessToken)
    return res.status(400).json({success:false,message:"Missing incomplete payment data"});
  req.body.checkout_ref = req.body.checkout_ref || null;
  /* If the payment already has a server record, use the normal completion flow. */
  return res.redirect(307,"/api/payments/complete");
});

module.exports=router;
