const router = require("express").Router();
const crypto = require("crypto");
const db = require("../config/db");
const { verifyToken } = require("../middleware/auth.middleware");

/*
  Creates one checkout group containing one or more order rows.
  Prices are ALWAYS read from MySQL; client-supplied prices are ignored.
*/
router.post("/checkout", verifyToken(), async (req,res)=>{
  const items=Array.isArray(req.body?.items) ? req.body.items : [];
  if(!items.length) return res.status(400).json({success:false,message:"Cart is empty"});
  if(items.length>30) return res.status(400).json({success:false,message:"Too many items"});

  const normalized=items.map(i=>({
    product_id:Number(i.product_id ?? i.id),
    quantity:Number(i.quantity ?? i.qty ?? 1)
  }));

  if(normalized.some(i=>!Number.isInteger(i.product_id)||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>100))
    return res.status(400).json({success:false,message:"Invalid cart item"});

  const connection=await db.promise().getConnection();
  const checkoutRef=`CHK-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;

  try{
    await connection.beginTransaction();
    let total=0;
    const created=[];

    for(const item of normalized){
      const [rows]=await connection.query(
        `SELECT id,name,price_pi,stock,vendor_id
         FROM products
         WHERE id=? AND status='approved'
         FOR UPDATE`,
        [item.product_id]
      );

      if(!rows.length) throw new Error(`Product ${item.product_id} is not available`);
      const p=rows[0];

      if(Number(p.stock)<item.quantity)
        throw new Error(`${p.name} does not have enough stock`);

      const lineTotal=Number(p.price_pi)*item.quantity;
      total+=lineTotal;

      /* Reserve stock while the Pi payment is being completed. */
      await connection.query(
        `UPDATE products SET stock=stock-? WHERE id=? AND stock>=?`,
        [item.quantity,p.id,item.quantity]
      );

      const [result]=await connection.query(
        `INSERT INTO orders
         (buyer_id,product_id,quantity,total_pi,payment_id,status,checkout_ref,stock_reserved)
         VALUES (?,?,?,?,NULL,'pending',?,1)`,
        [req.user.id,p.id,item.quantity,lineTotal,checkoutRef]
      );

      created.push({order_id:result.insertId,product_id:p.id,name:p.name,quantity:item.quantity,line_total:lineTotal});
    }

    await connection.commit();

    res.status(201).json({
      success:true,
      checkout_ref:checkoutRef,
      total_pi:Number(total.toFixed(2)),
      orders:created
    });
  }catch(error){
    await connection.rollback();
    res.status(400).json({success:false,message:error.message||"Unable to create checkout"});
  }finally{
    connection.release();
  }
});

/* Legacy single-product order endpoint, now server-priced and stock-reserved. */
router.post("/", verifyToken(), async (req,res)=>{
  const product_id=Number(req.body?.product_id);
  const quantity=Number(req.body?.quantity||1);
  if(!Number.isInteger(product_id)||!Number.isInteger(quantity)||quantity<1)
    return res.status(400).json({success:false,message:"Invalid product or quantity"});

  req.body.items=[{product_id,quantity}];
  /* Reuse checkout implementation by forwarding internally is unnecessarily complex;
     keep the response contract compatible. */
  const connection=await db.promise().getConnection();
  const checkoutRef=`CHK-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
  try{
    await connection.beginTransaction();
    const [rows]=await connection.query(
      `SELECT id,name,price_pi,stock FROM products WHERE id=? AND status='approved' FOR UPDATE`,
      [product_id]
    );
    if(!rows.length) throw new Error("Product not found");
    const p=rows[0];
    if(Number(p.stock)<quantity) throw new Error("Insufficient stock");
    const total=Number(p.price_pi)*quantity;
    await connection.query(`UPDATE products SET stock=stock-? WHERE id=? AND stock>=?`,[quantity,p.id,quantity]);
    const [r]=await connection.query(
      `INSERT INTO orders (buyer_id,product_id,quantity,total_pi,payment_id,status,checkout_ref,stock_reserved)
       VALUES (?,?,?, ?,NULL,'pending',?,1)`,
      [req.user.id,p.id,quantity,total,checkoutRef]
    );
    await connection.commit();
    res.status(201).json({success:true,order_id:r.insertId,checkout_ref,total:Number(total.toFixed(2)),product:p});
  }catch(e){
    await connection.rollback();
    res.status(400).json({success:false,message:e.message||"Failed to create order"});
  }finally{connection.release();}
});

/* Buyer orders */
router.get("/my", verifyToken(), (req,res)=>{
  db.query(
    `SELECT o.*,p.name,p.price_pi,p.image,p.location
     FROM orders o JOIN products p ON o.product_id=p.id
     WHERE o.buyer_id=? ORDER BY o.id DESC`,
    [req.user.id],
    (err,rows)=>{
      if(err) return res.status(500).json({success:false,message:"DB error"});
      res.json(rows||[]);
    }
  );
});

/* Vendor's orders */
router.get("/vendor", verifyToken(), (req,res)=>{
  if(req.user.role!=="vendor") return res.status(403).json({success:false,message:"Vendor access required"});
  db.query(
    `SELECT o.*,p.name,p.image,u.name AS buyer_name,u.pi_username
     FROM orders o
     JOIN products p ON o.product_id=p.id
     JOIN users u ON o.buyer_id=u.id
     WHERE p.vendor_id=?
     ORDER BY o.id DESC`,
    [req.user.id],
    (err,rows)=>{
      if(err) return res.status(500).json({success:false,message:"DB error"});
      res.json(rows||[]);
    }
  );
});

/* Admin orders */
router.get("/", verifyToken(), (req,res)=>{
  if(req.user.role!=="admin") return res.status(403).json({success:false,message:"Admin only access"});
  db.query(
    `SELECT o.*,p.name,p.price_pi,u.name AS buyer_name,u.pi_username
     FROM orders o
     JOIN products p ON o.product_id=p.id
     JOIN users u ON o.buyer_id=u.id
     ORDER BY o.id DESC`,
    (err,rows)=>{
      if(err) return res.status(500).json({success:false,message:"DB error"});
      res.json(rows||[]);
    }
  );
});

/* Status updates: admin can manage all; vendor can manage their own orders. */
router.put("/:id/status", verifyToken(), (req,res)=>{
  const orderId=Number(req.params.id);
  const status=req.body?.status;
  const allowed=["pending","paid","shipped","completed","cancelled"];
  if(!Number.isInteger(orderId)||!allowed.includes(status))
    return res.status(400).json({success:false,message:"Invalid order/status"});

  db.query(
    `SELECT o.*,p.vendor_id FROM orders o JOIN products p ON o.product_id=p.id WHERE o.id=? LIMIT 1`,
    [orderId],
    (err,rows)=>{
      if(err) return res.status(500).json({success:false,message:"DB error"});
      if(!rows.length) return res.status(404).json({success:false,message:"Order not found"});
      const o=rows[0];

      const allowedUser =
        req.user.role==="admin" ||
        (req.user.role==="vendor" && o.vendor_id===req.user.id);
      if(!allowedUser) return res.status(403).json({success:false,message:"Not allowed"});

      db.query("UPDATE orders SET status=? WHERE id=?",[status,orderId],(e)=>{
        if(e) return res.status(500).json({success:false,message:"DB error"});
        res.json({success:true,message:"Order updated successfully"});
      });
    }
  );
});

router.delete("/:id", verifyToken(), (req,res)=>{
  if(req.user.role!=="admin") return res.status(403).json({success:false,message:"Admin only"});
  db.query("DELETE FROM orders WHERE id=?",[Number(req.params.id)],err=>{
    if(err) return res.status(500).json({success:false,message:"DB error"});
    res.json({success:true});
  });
});

module.exports=router;
