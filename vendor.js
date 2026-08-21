const API="/api";
const token=localStorage.getItem("token");

if(!token){
  window.location.replace("vendor-login.html");
}

function headers(){
  return {Authorization:`Bearer ${token}`};
}

function logout(){
  localStorage.removeItem("token");
  localStorage.removeItem("vendorToken");
  localStorage.removeItem("user");
  window.location.href="vendor-login.html";
}

function goHome(){window.location.href="home.html";}
function goVendor(){window.location.href="vendor.html";}
function goProfile(){window.location.href="profile.html";}

async function ensureVendor(){
  try{
    const res=await fetch(`${API}/orders/vendor`,{headers:headers()});
    if(res.status===401||res.status===403){
      logout();
      return false;
    }
    return true;
  }catch{
    return false;
  }
}

const form=document.getElementById("productForm");
if(form){
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const btn=document.getElementById("submitBtn");
    btn.disabled=true;
    btn.textContent="Uploading...";

    try{
      const fd=new FormData();
      fd.append("name",document.getElementById("name").value.trim());
      fd.append("price_pi",document.getElementById("price_pi").value);
      fd.append("location",document.getElementById("location").value.trim());
      fd.append("stock",document.getElementById("stock").value);
      fd.append("image",document.getElementById("image").files[0]);

      const res=await fetch(`${API}/products`,{
        method:"POST",
        headers:headers(),
        body:fd
      });
      const data=await res.json().catch(()=>({}));

      if(res.status===401||res.status===403){
        alert(data.message||"Vendor access denied");
        logout();
        return;
      }
      if(!res.ok) throw new Error(data.message||"Upload failed");

      alert(data.message||"Product submitted");
      form.reset();
      loadMyProducts();
    }catch(error){
      console.error(error);
      alert(error.message||"Server error");
    }finally{
      btn.disabled=false;
      btn.textContent="Add Product";
    }
  });
}

async function loadMyProducts(){
  const container=document.getElementById("myProducts");
  if(!container)return;

  try{
    const res=await fetch(`${API}/products/my`,{headers:headers()});
    const data=await res.json().catch(()=>[]);
    if(res.status===401||res.status===403){
      logout();
      return;
    }
    if(!Array.isArray(data)||!data.length){
      container.innerHTML="<p>No products yet.</p>";
      return;
    }
    container.innerHTML=data.map(p=>`
      <div class="card">
        <img src="${getImageURL(p.image)}" alt="${escapeHTML(p.name)}">
        <h3>${escapeHTML(p.name)}</h3>
        <p>${escapeHTML(p.location)}</p>
        <h4>${Number(p.price_pi).toFixed(2)} Pi</h4>
        <p>Stock: ${p.stock}</p>
        <p>Status: ${escapeHTML(p.status)}</p>
      </div>`).join("");
  }catch(error){
    console.error(error);
    container.innerHTML="<p>Failed to load products.</p>";
  }
}

function getImageURL(image){
  if(!image)return "";
  if(image.startsWith("http"))return image;
  return "https://charcoal-marketplace-2.onrender.com"+image;
}

function escapeHTML(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

document.addEventListener("DOMContentLoaded",async()=>{
  if(await ensureVendor()) loadMyProducts();
});
