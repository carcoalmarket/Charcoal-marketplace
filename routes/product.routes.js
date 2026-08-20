const router = require("express").Router();
const db = require("../config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { verifyToken, verifyAdmin } = require("../middleware/auth.middleware");

const uploadDir=path.join(__dirname,"..","uploads");
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir,{recursive:true});

const storage=multer.diskStorage({
  destination:(req,file,cb)=>cb(null,uploadDir),
  filename:(req,file,cb)=>{
    const ext=path.extname(file.originalname).toLowerCase();
    cb(null,`${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const upload=multer({
  storage,
  limits:{fileSize:5*1024*1024},
  fileFilter:(req,file,cb)=>{
    if(!["image/jpeg","image/png","image/webp"].includes(file.mimetype))
      return cb(new Error("Only JPG, PNG and WEBP images are allowed"));
    cb(null,true);
  }
});

router.post("/", verifyToken(["vendor","admin"]), (req,res)=>{
  upload.single("image")(req,res,err=>{
    if(err) return res.status(400).json({success:false,message:err.message||"Image upload error"});

    const {name,description="",price_pi,location,stock}=req.body||{};
    const price=Number(price_pi);
    const qty=Number(stock);

    if(!name?.trim()||!location?.trim()||!Number.isFinite(price)||price<=0||!Number.isInteger(qty)||qty<0||!req.file)
      return res.status(400).json({success:false,message:"Valid name, price, location, stock and image are required"});

    const status=req.user.role==="admin"?"approved":"pending";
    const image=`/uploads/${req.file.filename}`;

    db.query(
      `INSERT INTO products(vendor_id,name,description,price_pi,location,stock,image,status,added_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [req.user.id,name.trim(),description.trim(),price,location.trim(),qty,image,status,req.user.role],
      (e,r)=>{
        if(e){
          console.error(e);
          return res.status(500).json({success:false,message:"Failed to create product"});
        }
        res.status(201).json({
          success:true,
          product_id:r.insertId,
          status,
          message:status==="approved"?"Product published":"Product submitted for Admin approval"
        });
      }
    );
  });
});

router.get("/",(req,res)=>{
  db.query(
    `SELECT p.*,u.name AS vendor_name,u.pi_username AS vendor_pi_username
     FROM products p
     LEFT JOIN users u ON p.vendor_id=u.id
     WHERE p.status='approved'
     ORDER BY p.id DESC`,
    (err,rows)=>{
      if(err) return res.status(500).json({success:false,message:"DB error"});
      const base=(process.env.PUBLIC_BASE_URL||process.env.BASE_URL||"").replace(/\/$/,"");
      res.json((rows||[]).map(p=>({...p,image:p.image?(p.image.startsWith("http")?p.image:base+p.image):null})));
    }
  );
});

router.get("/my", verifyToken(["vendor"]), (req,res)=>{
  db.query(
    `SELECT * FROM products WHERE vendor_id=? ORDER BY id DESC`,
    [req.user.id],
    (err,rows)=>{
      if(err) return res.status(500).json({success:false,message:"DB error"});
      res.json(rows||[]);
    }
  );
});

router.post("/admin/approve/:id",verifyAdmin,(req,res)=>{
  db.query("UPDATE products SET status='approved' WHERE id=? AND status='pending'",[Number(req.params.id)],(e,r)=>{
    if(e) return res.status(500).json({success:false,message:"DB error"});
    if(!r.affectedRows) return res.status(404).json({success:false,message:"Pending product not found"});
    res.json({success:true,message:"Product approved"});
  });
});

router.post("/admin/reject/:id",verifyAdmin,(req,res)=>{
  db.query("UPDATE products SET status='rejected' WHERE id=? AND status='pending'",[Number(req.params.id)],(e,r)=>{
    if(e) return res.status(500).json({success:false,message:"DB error"});
    if(!r.affectedRows) return res.status(404).json({success:false,message:"Pending product not found"});
    res.json({success:true,message:"Product rejected"});
  });
});

router.get("/admin/pending",verifyAdmin,(req,res)=>{
  db.query(
    `SELECT p.*,u.name AS vendor_name,u.email AS vendor_email,u.pi_username
     FROM products p LEFT JOIN users u ON p.vendor_id=u.id
     WHERE p.status='pending' ORDER BY p.created_at DESC`,
    (e,rows)=>{
      if(e) return res.status(500).json({success:false,message:"DB error"});
      res.json(rows||[]);
    }
  );
});

module.exports=router;
