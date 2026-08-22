const API="/api";

const $=id=>document.getElementById(id);

function showRegister(){
  $("loginSection").classList.add("hidden");
  $("registerSection").classList.remove("hidden");
  $("registerPrompt").classList.add("hidden");
  initPi();
}

function showLogin(){
  $("registerSection").classList.add("hidden");
  $("loginSection").classList.remove("hidden");
  $("registerPrompt").classList.remove("hidden");
  initPi();
}

function initPi(){
  if(!window.Pi) return;
  try{
    Pi.init({version:"2.0"});
  }catch(e){}
}

async function piAuth(scopes=["username"]){
  if(!window.Pi) throw new Error("Please open this app in Pi Browser");
  initPi();
  return await Pi.authenticate(scopes, function(payment){
    console.log("Incomplete payment:",payment);
  });
}

async function loginWithPi(){
  const btn=$("piLoginBtn"),msg=$("loginMsg");
  btn.disabled=true; msg.textContent="Connecting to Pi...";

  try{
    const auth=await piAuth(["username"]);
    const res=await fetch(`${API}/auth/pi-login`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({accessToken:auth.accessToken})
    });
    const data=await res.json();

    if(!res.ok){
      msg.textContent=data.message||"Pi login failed";
      return;
    }

    if(data.user?.role!=="vendor"){
      if(data.user?.vendor_status==="pending"){
        msg.textContent="Your vendor application is still awaiting Admin approval.";
      }else if(data.user?.vendor_status==="rejected"){
        msg.textContent="Your previous vendor application was rejected. You may submit a new application.";
        showRegister();
      }else{
        msg.textContent="This Pi account is not an approved vendor. Register as a vendor first.";
        showRegister();
      }
      return;
    }

    localStorage.setItem("token",data.token);
    localStorage.setItem("user",JSON.stringify(data.user));
    localStorage.setItem("vendorToken",data.token);
    window.location.href="vendor.html";
  }catch(error){
    console.error(error);
    msg.textContent=error.message||"Pi login failed";
  }finally{
    btn.disabled=false;
  }
}

$("vendorForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=$("registerBtn"),msg=$("registerMsg");
  btn.disabled=true; msg.textContent="Verifying Pi account and submitting...";

  try{
    const auth=await piAuth(["username"]);
    const body={
      accessToken:auth.accessToken,
      name:$("vendorName").value.trim(),
      business_name:$("businessName").value.trim(),
      business_phone:$("businessPhone").value.trim(),
      business_location:$("businessLocation").value.trim(),
      business_description:$("businessDescription").value.trim()
    };

    const res=await fetch(`${API}/auth/vendor-register`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)
    });
    const data=await res.json();

    if(!res.ok){
      msg.textContent=data.message||"Application failed";
      return;
    }

    msg.textContent="Application submitted successfully. Please wait for Admin approval.";
    $("vendorForm").reset();
  }catch(error){
    console.error(error);
    msg.textContent=error.message||"Unable to submit application";
  }finally{
    btn.disabled=false;
  }
});

$("emailLoginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=$("loginBtn"),msg=$("loginMsg");
  btn.disabled=true; msg.textContent="Logging in...";

  try{
    const res=await fetch(`${API}/auth/login`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({email:$("email").value.trim(),password:$("password").value})
    });
    const data=await res.json();
    if(!res.ok||!data.token){
      msg.textContent=data.message||"Login failed";
      return;
    }
    if(data.user?.role!=="vendor"){
      msg.textContent="This account is not an approved vendor.";
      return;
    }
    localStorage.setItem("token",data.token);
    localStorage.setItem("user",JSON.stringify(data.user));
    localStorage.setItem("vendorToken",data.token);
    window.location.href="vendor.html";
  }catch(error){
    console.error(error);
    msg.textContent="Server error";
  }finally{
    btn.disabled=false;
  }
});

initPi();
