const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const db = require("../config/db");

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error("JWT_SECRET is required");

const PI_BASE_URL = "https://api.minepi.com/v2";
const PI_SUPER_ADMIN_USERNAME =
  process.env.PI_SUPER_ADMIN_USERNAME || "DoctorACool1";

function createToken(user) {
  return jwt.sign({
    id: user.id,
    email: user.email,
    role: user.role,
    admin_level: user.admin_level || "none"
  }, SECRET, { expiresIn: "1d" });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    pi_uid: user.pi_uid || null,
    pi_username: user.pi_username || null,
    admin_level: user.admin_level || "none",
    vendor_status: user.vendor_status || "none",
    business_name: user.business_name || null,
    business_phone: user.business_phone || null,
    business_location: user.business_location || null,
    business_description: user.business_description || null
  };
}

async function verifyPiAccount(accessToken) {
  if (!accessToken) throw new Error("Missing Pi access token");
  const response = await axios.get(`${PI_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000
  });
  if (!response.data?.uid) throw new Error("Invalid Pi account");
  return response.data;
}

/* Legacy email/vendor registration remains supported for existing deployments. */
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ success:false, message:"All fields required" });

  db.query("SELECT id FROM users WHERE email=? LIMIT 1", [email], async (err, rows) => {
    if (err) return res.status(500).json({ success:false, message:"Database error" });
    if (rows.length) return res.status(409).json({ success:false, message:"Email already exists" });

    try {
      const hashed = await bcrypt.hash(password, 10);
      db.query(
        `INSERT INTO users (name,email,password,role,status,admin_level,vendor_status)
         VALUES (?,?,?,?,?,?,?)`,
        [name,email,hashed,"vendor","pending","none","pending"],
        err2 => {
          if (err2) return res.status(500).json({ success:false, message:"Register failed" });
          res.status(201).json({ success:true, message:"Vendor submitted for approval" });
        }
      );
    } catch {
      res.status(500).json({ success:false, message:"Encryption error" });
    }
  });
});

/* Pi-first vendor application. */
router.post("/vendor-register", async (req, res) => {
  const { accessToken, name, business_name, business_phone, business_location, business_description } = req.body || {};
  if (!accessToken || !name || !business_name || !business_location) {
    return res.status(400).json({
      success:false,
      message:"Pi authentication, name, business name and business location are required"
    });
  }

  try {
    const piUser = await verifyPiAccount(accessToken);
    const uid = piUser.uid;
    const username = piUser.username || "Pi User";
    const email = `${uid}@pi.app`;

    db.query("SELECT * FROM users WHERE pi_uid=? LIMIT 1", [uid], (err, rows) => {
      if (err) return res.status(500).json({success:false,message:"Database error"});

      if (!rows.length) {
        const password = bcrypt.hashSync("PI_USER_INTERNAL", 10);
        return db.query(
          `INSERT INTO users
           (name,email,password,role,status,pi_uid,pi_username,admin_level,
            vendor_status,business_name,business_phone,business_location,business_description,vendor_applied_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
          [name,email,password,"buyer","approved",uid,username,"none","pending",
           business_name,business_phone||null,business_location,business_description||null],
          (e, result) => {
            if (e) return res.status(500).json({success:false,message:"Failed to submit vendor application"});
            res.status(201).json({
              success:true,
              message:"Vendor application submitted. Wait for Admin approval.",
              vendor_status:"pending",
              user_id:result.insertId
            });
          }
        );
      }

      const user = rows[0];
      if (user.role === "admin") {
        return res.status(403).json({success:false,message:"Administrator accounts cannot register as vendors"});
      }
      if (user.role === "vendor" && user.status === "approved") {
        return res.status(409).json({success:false,message:"This Pi account is already an approved vendor"});
      }
      if (user.vendor_status === "pending") {
        return res.status(409).json({success:false,message:"Vendor application is already pending"});
      }

      db.query(
        `UPDATE users SET
          vendor_status='pending',
          business_name=?,
          business_phone=?,
          business_location=?,
          business_description=?,
          vendor_applied_at=CURRENT_TIMESTAMP,
          vendor_reviewed_at=NULL,
          vendor_reviewed_by=NULL,
          vendor_rejection_reason=NULL
         WHERE id=?`,
        [business_name,business_phone||null,business_location,business_description||null,user.id],
        e => {
          if (e) return res.status(500).json({success:false,message:"Failed to submit vendor application"});
          res.json({success:true,message:"Vendor application submitted. Wait for Admin approval.",vendor_status:"pending"});
        }
      );
    });
  } catch (error) {
    console.error("Vendor Pi registration:", error.response?.data || error.message);
    res.status(401).json({success:false,message:"Pi authentication failed"});
  }
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({success:false,message:"Missing fields"});

  db.query("SELECT * FROM users WHERE email=? LIMIT 1", [email], async (err, rows) => {
    if (err) return res.status(500).json({success:false,message:"Database error"});
    if (!rows.length) return res.status(401).json({success:false,message:"User not found"});
    const user = rows[0];
    if (user.status !== "approved") return res.status(403).json({success:false,message:"Account not approved"});
    if (!await bcrypt.compare(password,user.password))
      return res.status(401).json({success:false,message:"Wrong password"});
    res.json({success:true,token:createToken(user),user:publicUser(user)});
  });
});

router.post("/pi-login", async (req,res) => {
  try {
    const piUser = await verifyPiAccount(req.body?.accessToken);
    const uid = piUser.uid;
    const username = piUser.username || "Pi User";
    const email = `${uid}@pi.app`;

    db.query("SELECT * FROM users WHERE pi_uid=? LIMIT 1",[uid],(err,rows)=>{
      if (err) return res.status(500).json({success:false,message:"Database error"});

      if (rows.length) {
        const user=rows[0];
        if (user.status !== "approved")
          return res.status(403).json({
            success:false,
            message:user.vendor_status === "pending"
              ? "Your vendor application is awaiting Admin approval."
              : "Account is not approved"
          });
        res.json({success:true,token:createToken(user),user:publicUser(user)});
        return;
      }

      const hashed=bcrypt.hashSync("PI_USER_INTERNAL",10);
      db.query(
        `INSERT INTO users
         (name,email,password,role,status,pi_uid,pi_username,admin_level,vendor_status)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [username,email,hashed,"buyer","approved",uid,username,"none","none"],
        (e,r)=>{
          if(e) return res.status(500).json({success:false,message:"Failed to create Pi user"});
          db.query("SELECT * FROM users WHERE id=? LIMIT 1",[r.insertId],(e2,rows2)=>{
            if(e2 || !rows2.length) return res.status(500).json({success:false,message:"User fetch failed"});
            res.json({success:true,token:createToken(rows2[0]),user:publicUser(rows2[0])});
          });
        }
      );
    });
  } catch(error) {
    console.error("Pi login:",error.response?.data || error.message);
    res.status(401).json({success:false,message:"Pi authentication failed"});
  }
});

router.post("/pi-admin-login", async (req,res)=>{
  try {
    const piUser=await verifyPiAccount(req.body?.accessToken);
    const uid=piUser.uid;
    const username=piUser.username || "Pi User";

    db.query("SELECT * FROM users WHERE pi_uid=? LIMIT 1",[uid],(err,rows)=>{
      if(err) return res.status(500).json({success:false,message:"Database error"});

      if(rows.length){
        const user=rows[0];
        if(user.status!=="approved") return res.status(403).json({success:false,message:"Administrator account is not approved"});
        if(user.role!=="admin" || !["super_admin","admin","moderator"].includes(user.admin_level))
          return res.status(403).json({success:false,message:"This Pi account is not authorized for the Admin Panel"});
        return res.json({
          success:true,
          message:user.admin_level==="super_admin"?"Super Admin login successful":"Administrator login successful",
          token:createToken(user),user:publicUser(user)
        });
      }

      if(username !== PI_SUPER_ADMIN_USERNAME)
        return res.status(403).json({success:false,message:"This Pi account is not an authorized administrator"});

      const email=`${uid}@pi.app`;
      const hashed=bcrypt.hashSync("PI_ADMIN_INTERNAL",10);
      db.query(
        `INSERT INTO users
         (name,email,password,role,status,pi_uid,pi_username,admin_level,vendor_status)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [username,email,hashed,"admin","approved",uid,username,"super_admin","none"],
        (e,r)=>{
          if(e) return res.status(500).json({success:false,message:"Failed to create Super Admin"});
          db.query("SELECT * FROM users WHERE id=? LIMIT 1",[r.insertId],(e2,rows2)=>{
            if(e2 || !rows2.length) return res.status(500).json({success:false,message:"Super Admin fetch failed"});
            res.json({success:true,message:"Super Admin created successfully",token:createToken(rows2[0]),user:publicUser(rows2[0])});
          });
        }
      );
    });
  } catch(error) {
    console.error("Pi admin verification:",error.response?.data || error.message);
    res.status(401).json({success:false,message:"Pi account verification failed"});
  }
});

module.exports = router;
