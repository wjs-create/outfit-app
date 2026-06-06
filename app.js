const STORAGE_KEY = "wardrobe_app_state_v3";
const LEADS_KEY = "wardrobe_site_leads_v1";
const PLANNER_DEFAULTS_KEY = "wardrobe_planner_defaults_v1";

var categoryLabels = {
  top: "上衣", bottom: "下装", dress: "连衣裙/套装", outer: "外套",
  shoes: "鞋", bag: "包", accessory: "配饰",
};
var seasonLabels = { all: "四季", spring: "春", summer: "夏", autumn: "秋", winter: "冬" };
var thicknessLabels = { light: "薄", medium: "适中", warm: "厚" };

var state = { items: [], generatedOutfits: [], feedback: [], currentImage: "", removedBgImage: "", lastPlannerContext: null };
var elements = {};

function $(sel) { return document.querySelector(sel); }

function initElements() {
  elements.tabs = document.querySelectorAll(".tab-button");
  elements.views = document.querySelectorAll(".view");
  elements.itemForm = $("#itemForm");
  elements.itemImage = $("#itemImage");
  elements.itemImageUrl = $("#itemImageUrl");
  elements.photoPreview = $("#photoPreview");
  elements.photoDrop = document.querySelector(".photo-drop");
  elements.photoText = document.querySelector(".photo-text");
  elements.resetFormButton = $("#resetFormButton");
  elements.cancelEditButton = $("#cancelEditButton");
  elements.saveItemButton = $("#saveItemButton");
  elements.editingItemId = $("#editingItemId");
  elements.closetGrid = $("#closetGrid");
  elements.searchInput = $("#searchInput");
  elements.categoryFilter = $("#categoryFilter");
  elements.plannerForm = $("#plannerForm");
  elements.outfitResults = $("#outfitResults");
  elements.regenerateArea = $("#regenerateArea");
  elements.regenerateButton = $("#regenerateButton");
  elements.anchorItem = $("#anchorItem");
  elements.quickSeedButton = $("#quickSeedButton");
  elements.itemCount = $("#itemCount");
  elements.favoriteCount = $("#favoriteCount");
  elements.metricItems = $("#metricItems");
  elements.metricFavorites = $("#metricFavorites");
  elements.metricColor = $("#metricColor");
  elements.metricStyle = $("#metricStyle");
  elements.feedbackList = $("#feedbackList");
  elements.waitlistForm = $("#waitlistForm");
  elements.leadName = $("#leadName");
  elements.leadContact = $("#leadContact");
  elements.leadPain = $("#leadPain");
  elements.waitlistStatus = $("#waitlistStatus");
  elements.temperature = $("#temperature");
  elements.weather = $("#weather");
  elements.mood = $("#mood");
  elements.occasion = $("#occasion");
  elements.styleGoal = $("#styleGoal");
  elements.fetchLinkInput = $("#fetchLinkInput");
  elements.fetchButton = $("#fetchButton");
  elements.fetchStatus = $("#fetchStatus");
  elements.seasonCheckGroup = $("#seasonCheckGroup");
  elements.removeBgButton = $("#removeBgButton");
}

/* persistence */

function loadState() {
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    var p = JSON.parse(saved);
    state.items = Array.isArray(p.items) ? p.items : [];
    state.feedback = Array.isArray(p.feedback) ? p.feedback : [];
    state.lastPlannerContext = p.lastPlannerContext || null;
  } catch(e) { localStorage.removeItem(STORAGE_KEY); }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({items:state.items, feedback:state.feedback, lastPlannerContext:state.lastPlannerContext})); }
  catch(e) { console.warn("localStorage full"); }
}

/* helpers */

function seasonDisplayText(val) {
  if (!val || val === "all") return "四季";
  return String(val).split(",").map(function(s) { return seasonLabels[s] || s; }).join("·");
}
function norm(v) { return String(v||"").trim(); }

function placeholderImage(item) {
  var hex = colorToHex(item.color);
  var label = categoryLabels[item.category] || "衣服";
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="700"><rect width="600" height="700" fill="#f6f7f4"/><rect x="95" y="85" width="410" height="530" rx="42" fill="'+hex+'"/><text x="300" y="352" text-anchor="middle" font-family="Arial" font-size="52" fill="#fff">'+label+'</text></svg>';
  return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
}

function getImageForItem(item) { return item.image || placeholderImage(item); }

function colorToHex(name) {
  var m = {白:"#f4f1e8",黑:"#242424",灰:"#8d9690",蓝:"#476f9f",牛仔:"#476f9f",绿:"#4f7b61",红:"#b14d4d",粉:"#d796a2",黄:"#d3a940",米:"#d8c7a8",棕:"#8c6045",卡其:"#b9a277",紫:"#8066a8"};
  for (var k in m) { if (name.indexOf(k)!==-1) return m[k]; }
  return "#8aa097";
}

function mode(vals) {
  var c={}; vals.filter(Boolean).forEach(function(v){c[v]=(c[v]||0)+1});
  var e=Object.entries(c).sort(function(a,b){return b[1]-a[1]});
  return (e[0]||[])[0]||"-";
}

/* Image-to-text helpers: extract dominant color from image data */

function analyzeImageColors(canvas) {
  var ctx = canvas.getContext("2d");
  var w = canvas.width, h = canvas.height;
  // sample a 10x10 grid for speed
  var step = Math.max(1, Math.floor(Math.min(w,h)/10));
  var samples = [];
  for (var y = step; y < h - step; y += step) {
    for (var x = step; x < w - step; x += step) {
      var px = ctx.getImageData(x, y, 1, 1).data;
      if (px[3] < 80) continue; // skip transparent
      samples.push([px[0], px[1], px[2]]);
    }
  }
  if (samples.length < 5) return {dominant:"未识别", hex:"#cccccc"};
  // average
  var r=0,g=0,b=0;
  samples.forEach(function(s){r+=s[0];g+=s[1];b+=s[2];});
  r=Math.round(r/samples.length); g=Math.round(g/samples.length); b=Math.round(b/samples.length);
  return {dominant:rgbToColorName(r,g,b), hex:rgbToHex(r,g,b)};
}

function rgbToHex(r,g,b) { return "#"+[r,g,b].map(function(c){var h=c.toString(16);return h.length<2?"0"+h:h}).join(""); }

function rgbToColorName(r,g,b) {
  var names = [
    {n:"黑色", r:0, g:0, b:0}, {n:"白色", r:255, g:255, b:255},
    {n:"灰色", r:128, g:128, b:128}, {n:"红色", r:200, g:60, b:60},
    {n:"粉色", r:230, g:150, b:170}, {n:"蓝色", r:70, g:110, b:160},
    {n:"绿色", r:80, g:130, b:100}, {n:"黄色", r:220, g:190, b:80},
    {n:"棕色", r:140, g:100, b:70}, {n:"卡其", r:180, g:160, b:120},
    {n:"紫色", r:140, g:100, b:170}, {n:"牛仔蓝", r:80, g:110, b:150},
    {n:"米色", r:220, g:200, b:170}, {n:"藏蓝", r:30, g:50, b:100},
  ];
  var best=null, bestD=Infinity;
  names.forEach(function(c){
    var d = Math.abs(r-c.r)+Math.abs(g-c.g)+Math.abs(b-c.b);
    if (d<bestD) {bestD=d; best=c;}
  });
  return bestD < 120 ? best.n : "未识别";
}

function loadImageToCanvas(img, cb) {
  var canvas = document.createElement("canvas");
  var maxW = 300;
  var scale = Math.min(1, maxW / img.naturalWidth);
  canvas.width = img.naturalWidth * scale;
  canvas.height = img.naturalHeight * scale;
  var ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  cb(canvas);
}

/* auto-analyze uploaded or pasted image */

function autoAnalyzeImage(imageDataUrl) {
  state.currentImage = imageDataUrl;
  state.removedBgImage = "";
  elements.photoPreview.style.backgroundImage = 'url("'+imageDataUrl+'")';
  elements.photoText.textContent = "正在分析图片...";

  var img = new Image();
  img.onload = function() {
    loadImageToCanvas(img, function(canvas) {
      var colors = analyzeImageColors(canvas);
      if (!$("#itemColor").value && colors.dominant !== "未识别") {
        $("#itemColor").value = colors.dominant;
      }
      var brightColors = ["红色","粉色","黄色","亮色","白色"];
      var darkColors = ["黑色","藏蓝","深蓝"];
      var item = { name: "", color: colors.dominant, material: "", notes: "" };
      if (brightColors.indexOf(colors.dominant)!==-1) {
        item.notes = "亮色单品";
      } else if (darkColors.indexOf(colors.dominant)!==-1) {
        item.notes = "深色基础款";
      }
      $("#itemStyles").value = WardrobeCore.suggestStyleTags(item).join(", ");
      $("#itemOccasions").value = WardrobeCore.suggestOccasionTags(item).join(", ");
      $("#itemThickness").value = WardrobeCore.inferThickness(item);
      setSeasonCheckboxValue(WardrobeCore.inferSeason(item));
      elements.photoText.textContent = "图片已就绪 · 主色: "+colors.dominant;
      elements.fetchStatus.textContent = "已识别主色: "+colors.dominant+"，点击「去除背景」可抠图";
      elements.fetchStatus.style.color = "#3fb950";
    });
  };
  img.src = imageDataUrl;
}

/* ── background removal ── */

var _dynamicImport = new Function("specifier", "return import(specifier)");
var _bgRemovalReady = false;
var _bgRemovalLoading = false;
var _bgRemovalMod = null;

function loadBgRemovalModule() {
  if (_bgRemovalMod) return Promise.resolve(_bgRemovalMod);
  if (_bgRemovalLoading) {
    return new Promise(function(resolve, reject) {
      var start = Date.now();
      function check() {
        if (_bgRemovalMod) { resolve(_bgRemovalMod); return; }
        if (Date.now() - start > 35000) { reject(new Error("timeout waiting for AI model")); return; }
        setTimeout(check, 200);
      }
      check();
    });
  }
  _bgRemovalLoading = true;
  return _dynamicImport("https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm")
    .then(function(mod) {
      _bgRemovalMod = mod;
      _bgRemovalReady = true;
      _bgRemovalLoading = false;
      return mod;
    })
    .catch(function(err) {
      _bgRemovalLoading = false;
      throw err;
    });
}

function removeBackground() {
  if (!state.currentImage) {
    elements.fetchStatus.textContent = "请先上传或粘贴图片";
    elements.fetchStatus.style.color = "#f85149";
    return;
  }
  elements.removeBgButton.disabled = true;
  elements.removeBgButton.textContent = "加载AI模型...";
  elements.fetchStatus.textContent = "正在下载AI模型（约45MB，仅首次需要）...";
  elements.fetchStatus.style.color = "#d2991d";

  var imgSrc = state.currentImage;

  // Start loading the AI module
  loadBgRemovalModule()
    .then(function(mod) {
      elements.removeBgButton.textContent = "AI抠图中...";
      elements.fetchStatus.textContent = "AI正在处理，大约需要2-5秒...";
      // Use isnet (FP32, highest quality) for best results
      // publicPath needed for GitHub Pages: host model files ourselves
      return mod.default(imgSrc, { model: "isnet" }).catch(function(err) {
        console.warn("isnet model failed, trying medium:", err && err.message || err);
        return mod.default(imgSrc, { model: "medium" });
      });
    })
    .then(function(blob) {
      var url = URL.createObjectURL(blob);
      state.removedBgImage = url;
      state.currentImage = url;
      elements.photoPreview.style.backgroundImage = 'url("' + url + '")';
      elements.photoText.textContent = "AI抠图完成 ✓";
      elements.fetchStatus.textContent = "AI抠图完成！";
      elements.fetchStatus.style.color = "#3fb950";
      elements.removeBgButton.textContent = "去除背景 ✓";
      elements.removeBgButton.style.background = "#3fb950";
      elements.removeBgButton.style.color = "#fff";
      elements.removeBgButton.style.borderColor = "#3fb950";
      elements.removeBgButton.disabled = false;
    })
    .catch(function(err) {
      console.warn("AI抠图失败，降级到本地算法:", err && err.message || err);
      applyFallbackRemoveBg();
    });
}

function applyFallbackRemoveBg() {
  elements.fetchStatus.textContent = "AI模型暂不可用，使用本地算法代替...";
  elements.fetchStatus.style.color = "#d2991d";

  // For cross-origin images, proxy through our server
  var src = state.currentImage;
  if (/^https?:\/\//.test(src) && !src.startsWith("http://127.0.0.1") && !src.startsWith(location.origin)) {
    src = "/api/proxy-image?url=" + encodeURIComponent(src);
  }

  var img = new Image();
  img.onload = function() {
    try {
      var result = simpleRemoveBg(img);
      state.removedBgImage = result;
      state.currentImage = result;
      elements.photoPreview.style.backgroundImage = 'url("' + result + '")';
      elements.photoText.textContent = "背景已去除 ✓（本地算法）";
      elements.fetchStatus.textContent = "抠图完成！（使用本地算法）";
      elements.fetchStatus.style.color = "#3fb950";
      elements.removeBgButton.textContent = "去除背景 ✓";
    } catch (e) {
      console.error(e);
      elements.fetchStatus.textContent = "抠图失败: " + e.message;
      elements.fetchStatus.style.color = "#f85149";
      elements.removeBgButton.textContent = "去除背景";
      elements.removeBgButton.style.background = "";
      elements.removeBgButton.style.color = "";
      elements.removeBgButton.style.borderColor = "";
    }
    elements.removeBgButton.disabled = false;
  };
  img.onerror = function() {
    elements.fetchStatus.textContent = "图片加载失败，请尝试截图粘贴方式";
    elements.fetchStatus.style.color = "#f85149";
    elements.removeBgButton.textContent = "去除背景";
    elements.removeBgButton.style.background = "";
    elements.removeBgButton.style.color = "";
    elements.removeBgButton.style.borderColor = "";
    elements.removeBgButton.disabled = false;
  };
  img.src = src;
}

/**
 * Simple background removal: detect edge pixels as bg color, make them transparent.
 * Works best on product photos with uniform backgrounds (white, light gray, etc.)
 */
function simpleRemoveBg(img) {
  var canvas = document.createElement("canvas");
  var maxDim = 600;
  var scale = Math.min(1, maxDim / img.naturalWidth, maxDim / img.naturalHeight);
  canvas.width = img.naturalWidth * scale;
  canvas.height = img.naturalHeight * scale;
  var ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var data = imageData.data;
  var w = canvas.width, h = canvas.height;

  // sample corners + edges to determine background color
  var samples = [];
  var margin = Math.max(3, Math.floor(Math.min(w, h) * 0.05));
  for (var y = 0; y < h; y += Math.max(1, Math.floor(h/20))) {
    for (var x = 0; x < margin; x++) { var i=(y*w+x)*4; samples.push([data[i],data[i+1],data[i+2],data[i+3]]); }
    for (var x = w-margin; x < w; x++) { var i=(y*w+x)*4; samples.push([data[i],data[i+1],data[i+2],data[i+3]]); }
  }
  for (var x = 0; x < w; x += Math.max(1, Math.floor(w/20))) {
    for (var y = 0; y < margin; y++) { var i=(y*w+x)*4; samples.push([data[i],data[i+1],data[i+2],data[i+3]]); }
    for (var y = h-margin; y < h; y++) { var i=(y*w+x)*4; samples.push([data[i],data[i+1],data[i+2],data[i+3]]); }
  }

  // average bg color from edge samples
  var bgR=0,bgG=0,bgB=0,cnt=0;
  samples.forEach(function(s){bgR+=s[0];bgG+=s[1];bgB+=s[2];cnt++;});
  bgR=Math.round(bgR/cnt); bgG=Math.round(bgG/cnt); bgB=Math.round(bgB/cnt);

  // make pixels close to bg color transparent, with tolerance
  var tolerance = 55;
  for (var i = 0; i < data.length; i += 4) {
    var dr = Math.abs(data[i] - bgR);
    var dg = Math.abs(data[i+1] - bgG);
    var db = Math.abs(data[i+2] - bgB);
    if (dr < tolerance && dg < tolerance && db < tolerance) {
      data[i+3] = 0; // transparent
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function getFormItem() {
  // use removed-bg image if available, otherwise original
  var finalImage = state.removedBgImage || state.currentImage || norm(elements.itemImageUrl.value);
  return {
    id: elements.editingItemId.value || crypto.randomUUID(),
    image: finalImage,
    name: norm($("#itemName").value),
    category: $("#itemCategory").value,
    color: norm($("#itemColor").value) || "未标注",
    material: norm($("#itemMaterial").value),
    thickness: $("#itemThickness").value,
	season: getSeasonCheckboxValue(),
    styles: splitTags($("#itemStyles").value),
    occasions: splitTags($("#itemOccasions").value),
    url: norm($("#itemUrl").value),
    notes: norm($("#itemNotes").value),
    createdAt: new Date().toISOString(),
  };
}

function setFormItem(item) {
  elements.editingItemId.value = item.id;
  $("#itemName").value = item.name||"";
  $("#itemCategory").value = item.category||"top";
  $("#itemColor").value = item.color||"";
  $("#itemMaterial").value = item.material||"";
  $("#itemThickness").value = item.thickness||"medium";
  setSeasonCheckboxValue(item.season||"all");
  $("#itemStyles").value = (item.styles||[]).join(", ");
  $("#itemOccasions").value = (item.occasions||[]).join(", ");
  $("#itemUrl").value = item.url||"";
  $("#itemNotes").value = item.notes||"";
  elements.itemImageUrl.value = item.image||"";
  state.currentImage = item.image||"";
  elements.photoPreview.style.backgroundImage = item.image ? 'url("'+item.image+'")' : "";
  elements.photoText.textContent = "选择衣服照片（Ctrl+V 截图直接粘贴）";
  elements.saveItemButton.textContent = "更新衣服";
  elements.cancelEditButton.style.display = "";
}

function resetForm() {
  elements.itemForm.reset();
  state.currentImage = "";
  elements.photoPreview.style.backgroundImage = "";
  elements.editingItemId.value = "";
  elements.saveItemButton.textContent = "保存衣服";
  elements.cancelEditButton.style.display = "none";
  elements.photoText.textContent = "选择衣服照片（Ctrl+V 截图直接粘贴）";
  elements.fetchStatus.textContent = "";
}

function editItem(itemId) {
  var item = state.items.find(function(c){return c.id===itemId});
  if (!item) return;
  setFormItem(item);
  document.querySelector(".photo-drop").scrollIntoView({behavior:"smooth"});
}

/* clipboard paste → auto analyze */

function handleGlobalPaste(e) {
  // only if closetView is visible
  if (!$("#closetView").classList.contains("is-visible")) return;
  var items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (var i=0;i<items.length;i++) {
    if (items[i].type.indexOf("image")===0) {
      e.preventDefault();
      var blob = items[i].getAsFile();
      var reader = new FileReader();
      reader.onload = function(ev) {
        autoAnalyzeImage(ev.target.result);
      };
      reader.readAsDataURL(blob);
      elements.fetchStatus.textContent = "截图已粘贴，正在分析...";
      elements.fetchStatus.style.color = "#d2991d";
      return;
    }
  }
}

/* file upload → auto analyze */

function handleFileUpload(file) {
  var reader = new FileReader();
  reader.onload = function(ev) { autoAnalyzeImage(ev.target.result); };
  reader.readAsDataURL(file);
}

/* image URL input → auto analyze */

function handleImageUrlInput() {
  if (state.currentImage) return; // file upload takes priority
  var url = norm(elements.itemImageUrl.value);
  if (!url || !/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)/i.test(url)) return;
  // First, show the image preview without crossOrigin (avoids CORS block)
  state.currentImage = url;
  elements.photoPreview.style.backgroundImage = 'url("'+url+'")';
  elements.photoText.textContent = "商品图已加载，分析颜色...";
  elements.fetchStatus.textContent = "";
  elements.fetchStatus.style.color = "";

  // Then try to load with crossOrigin for color analysis
  var img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = function() {
    loadImageToCanvas(img, function(canvas) {
      var colors = analyzeImageColors(canvas);
      if (!$("#itemColor").value && colors.dominant !== "未识别") {
        $("#itemColor").value = colors.dominant;
      }
      var item = { name: ($("#itemName").value||""), color: colors.dominant, material: "", notes: "" };
      var brightColors = ["红色","粉色","黄色","亮色","白色"];
      var darkColors = ["黑色","藏蓝","深蓝"];
      if (brightColors.indexOf(colors.dominant)!==-1) item.notes = "亮色单品";
      else if (darkColors.indexOf(colors.dominant)!==-1) item.notes = "深色基础款";
      if (!$("#itemStyles").value) $("#itemStyles").value = WardrobeCore.suggestStyleTags(item).join(", ");
      if (!$("#itemOccasions").value) $("#itemOccasions").value = WardrobeCore.suggestOccasionTags(item).join(", ");
      elements.photoText.textContent = "商品图已加载 · 主色: "+colors.dominant;
      elements.fetchStatus.textContent = "已自动识别主色: "+colors.dominant;
      elements.fetchStatus.style.color = "#3fb950";
    });
  };
  img.onerror = function() {
    // CORS blocked — image is still shown, just can't auto-analyze
    elements.photoText.textContent = "图片已加载（无法自动分析，请手动填写）";
    elements.fetchStatus.textContent = "此图片链接不支持自动分析，请手动填写颜色和标签";
    elements.fetchStatus.style.color = "#d2991d";
  };
  img.src = url;
}

/* shopping link import — with clear guidance */

function handleFetchClick() {
  var url = norm(elements.fetchLinkInput.value);
  if (!url) {
    elements.fetchStatus.textContent = "请粘贴商品页面链接";
    elements.fetchStatus.style.color = "#f85149";
    return;
  }
  // check if it looks like a shopping link
  if (/tmall\.com|taobao\.com|jd\.com|pinduoduo\.com|yangkeduo\.com/i.test(url)) {
    elements.fetchStatus.innerHTML = "淘宝/京东有反爬保护，无法自动提取。请改用以下方式：<br>① 右键商品图 → 复制图像地址 → 粘贴到下方「商品图链接」<br>② 电脑截图后直接 Ctrl+V 粘贴在此页面任意位置";
    elements.fetchStatus.style.color = "#d2991d";
    return;
  }
  if (/\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(url)) {
    elements.itemImageUrl.value = url;
    handleImageUrlInput();
    elements.fetchStatus.textContent = "已加载图片并分析";
    elements.fetchStatus.style.color = "#3fb950";
    return;
  }
  elements.fetchStatus.textContent = "暂不支持该链接。请复制商品图片地址，粘贴到「商品图链接」字段。";
  elements.fetchStatus.style.color = "#d2991d";
}

/* render */

function renderCloset() {
  var q = norm(elements.searchInput.value).toLowerCase();
  var cat = elements.categoryFilter.value;
  var items = state.items.filter(function(item){
    var hay = [item.name,item.color,item.material,item.notes].concat(item.styles||[],item.occasions||[]).join(" ").toLowerCase();
    return (!q||hay.indexOf(q)!==-1) && (cat==="all"||item.category===cat);
  });
  elements.closetGrid.innerHTML = "";
  if (!items.length) { elements.closetGrid.innerHTML = '<div class="empty-state">衣橱还是空的。<br>截图粘贴 或 导入示例衣橱 开始吧。</div>'; updateStats(); return; }
  var tpl = document.querySelector("#itemTemplate");
  items.forEach(function(item){
    var n = tpl.content.cloneNode(true);
    n.querySelector(".item-image").style.backgroundImage = 'url("'+getImageForItem(item)+'")';
    n.querySelector("h3").textContent = item.name;
    n.querySelector(".item-meta").textContent = [categoryLabels[item.category],item.color,thicknessLabels[item.thickness],seasonDisplayText(item.season)].filter(Boolean).join(" · ");
    var tags = n.querySelector(".tag-row");
    [].concat(item.styles||[],item.occasions||[]).slice(0,5).forEach(function(t){
      var el=document.createElement("span"); el.className="tag"; el.textContent=t; tags.appendChild(el);
    });
    var link = n.querySelector(".item-link");
    if (item.url) link.href = item.url; else link.remove();
    n.querySelector(".edit-item").addEventListener("click",function(){editItem(item.id)});
    n.querySelector(".delete-item").addEventListener("click",function(){
      state.items=state.items.filter(function(c){return c.id!==item.id});
      saveState(); renderAll();
    });
    elements.closetGrid.appendChild(n);
  });
  updateStats();
}

function renderAnchorOptions() {
  elements.anchorItem.innerHTML = '<option value="">不指定</option>';
  state.items.forEach(function(item){
    var o=document.createElement("option"); o.value=item.id;
    o.textContent=item.name+" · "+(categoryLabels[item.category]||""); elements.anchorItem.appendChild(o);
  });
}

function generateOutfits(ctx) { return WardrobeCore.generateOutfits(state.items, ctx, function(){return crypto.randomUUID()}); }

function renderOutfits() {
  elements.outfitResults.innerHTML = "";
  if (!state.generatedOutfits.length) {
    elements.outfitResults.innerHTML = '<div class="empty-state">至少录入几件单品就能生成搭配。</div>';
    elements.regenerateArea.style.display="none"; return;
  }
  elements.regenerateArea.style.display="";
  var tpl = document.querySelector("#outfitTemplate");
  state.generatedOutfits.forEach(function(o){
    var n = tpl.content.cloneNode(true);
    n.querySelector("h3").textContent = o.title;
    n.querySelector(".outfit-score").textContent = Math.max(o.score,0)+" 分";
    n.querySelector(".outfit-reason").textContent = o.reason;
    var preview = n.querySelector(".outfit-preview");
    var items = n.querySelector(".outfit-items");
    o.pieces.forEach(function(p){
      var d=document.createElement("div"); d.className="preview-piece piece-"+p.category;
      d.style.backgroundImage='url("'+getImageForItem(p)+'")'; preview.appendChild(d);
      var s=document.createElement("span"); s.className="score-pill"; s.textContent=p.name; items.appendChild(s);
    });
    n.querySelector(".like-outfit").addEventListener("click",function(){saveFeedback(o,"喜欢")});
    n.querySelector(".dislike-outfit").addEventListener("click",function(){saveFeedback(o,"不喜欢")});
    elements.outfitResults.appendChild(n);
  });
}

function saveFeedback(o,v) {
  state.feedback.unshift({id:crypto.randomUUID(),outfitTitle:o.title,items:o.pieces.map(function(p){return p.name}),value:v,createdAt:new Date().toISOString()});
  saveState(); renderInsights(); updateStats();
}

function updateStats() {
  var cnt = state.feedback.filter(function(e){return e.value==="喜欢"}).length;
  elements.itemCount.textContent = state.items.length+" 件衣服";
  elements.favoriteCount.textContent = cnt+" 套收藏";
  elements.metricItems.textContent = state.items.length;
  elements.metricFavorites.textContent = cnt;
  elements.metricColor.textContent = mode(state.items.map(function(i){return i.color}));
  elements.metricStyle.textContent = mode(state.items.flatMap(function(i){return i.styles||[]}));
}

function renderInsights() {
  updateStats();
  elements.feedbackList.innerHTML = "";
  if (!state.feedback.length) { elements.feedbackList.innerHTML = '<div class="empty-state">喜欢或不喜欢的反馈会出现。</div>'; return; }
  state.feedback.slice(0,8).forEach(function(e){
    var r=document.createElement("div"); r.className="item-card";
    r.innerHTML = '<div class="item-body"><div class="item-title-row"><h3>'+e.value+' · '+e.outfitTitle+'</h3><span class="tag">'+new Date(e.createdAt).toLocaleDateString("zh-CN")+'</span></div><p class="item-meta">'+e.items.join("、")+'</p></div>';
    elements.feedbackList.appendChild(r);
  });
}

function renderAll() { renderCloset(); renderAnchorOptions(); renderInsights(); }

/* planner */

function savePlannerDefaults(ctx) { state.lastPlannerContext = Object.assign({}, ctx); saveState(); }
function restorePlannerDefaults() {
  var ctx=state.lastPlannerContext; if(!ctx) return;
  if(ctx.temp!=null) elements.temperature.value=ctx.temp;
  if(ctx.weather) elements.weather.value=ctx.weather;
  if(ctx.mood) elements.mood.value=ctx.mood;
  if(ctx.occasion) elements.occasion.value=ctx.occasion;
  if(ctx.styleGoal) elements.styleGoal.value=ctx.styleGoal;
}

/* seed */

function addQuickSeedItems() {
  var exist = new Set(state.items.map(function(i){return i.id}));
  var combined = WardrobeCore.withTimestamps(WardrobeCore.onlineTestItems).concat([
    {id:crypto.randomUUID(),image:"",name:"白色棉质衬衫",category:"top",color:"白色",material:"棉",thickness:"medium",season:"all",styles:["通勤","简洁"],occasions:["上班","正式场合"],url:"",notes:"",createdAt:new Date().toISOString()},
    {id:crypto.randomUUID(),image:"",name:"深蓝直筒牛仔裤",category:"bottom",color:"深蓝",material:"牛仔",thickness:"medium",season:"all",styles:["休闲","利落"],occasions:["上班","朋友聚会","旅行"],url:"",notes:"",createdAt:new Date().toISOString()},
    {id:crypto.randomUUID(),image:"",name:"黑色乐福鞋",category:"shoes",color:"黑色",material:"皮革",thickness:"medium",season:"all",styles:["通勤","质感"],occasions:["上班","约会","正式场合"],url:"",notes:"",createdAt:new Date().toISOString()},
    {id:crypto.randomUUID(),image:"",name:"浅卡其风衣",category:"outer",color:"卡其",material:"棉混纺",thickness:"medium",season:"spring",styles:["松弛","质感"],occasions:["上班","约会","旅行"],url:"",notes:"",createdAt:new Date().toISOString()},
    {id:crypto.randomUUID(),image:"",name:"灰色针织开衫",category:"outer",color:"灰色",material:"针织",thickness:"warm",season:"autumn",styles:["温柔","舒服"],occasions:["上班","朋友聚会"],url:"",notes:"",createdAt:new Date().toISOString()},
    {id:crypto.randomUUID(),image:"",name:"红色小包",category:"bag",color:"红色",material:"皮革",thickness:"light",season:"all",styles:["显气色","亮色"],occasions:["约会","朋友聚会"],url:"",notes:"",createdAt:new Date().toISOString()},
    {id:crypto.randomUUID(),image:"",name:"黑色连衣裙",category:"dress",color:"黑色",material:"醋酸",thickness:"medium",season:"all",styles:["正式","显瘦","有气场"],occasions:["约会","正式场合"],url:"",notes:"",createdAt:new Date().toISOString()},
  ]);
  state.items = combined.filter(function(i){return !exist.has(i.id)}).concat(state.items);
  saveState(); renderAll();
}

/* leads */

function saveLead() {
  var lead = {id:crypto.randomUUID(),name:norm(elements.leadName.value),contact:norm(elements.leadContact.value),pain:norm(elements.leadPain.value),createdAt:new Date().toISOString()};
  try {
    var leads = JSON.parse(localStorage.getItem(LEADS_KEY)||"[]");
    leads.unshift(lead); localStorage.setItem(LEADS_KEY,JSON.stringify(leads));
    elements.waitlistForm.reset(); elements.waitlistStatus.textContent="已保存。";
  } catch(e) { elements.waitlistStatus.textContent="保存失败。"; }
}

function getSeasonCheckboxValue() {
  var checks = elements.seasonCheckGroup.querySelectorAll("input:checked");
  if (!checks.length) return "all";
  var vals = [];
  checks.forEach(function(c) { vals.push(c.value); });
  // "all" checked or everything selected = all
  if (vals.indexOf("all") !== -1 || vals.length >= 5) return "all";
  return vals.join(",");
}

function setSeasonCheckboxValue(val) {
  var checks = elements.seasonCheckGroup.querySelectorAll("input");
  if (!val || val === "all") {
    checks.forEach(function(c) { c.checked = (c.value === "all"); });
    return;
  }
  var parts = typeof val === "string" ? val.split(",") : val;
  checks.forEach(function(c) { c.checked = (parts.indexOf(c.value) !== -1); });
}

/* wire events */

function wireEvents() {
  elements.tabs.forEach(function(btn){
    btn.addEventListener("click", function(){
      elements.tabs.forEach(function(t){t.classList.remove("is-active")});
      elements.views.forEach(function(v){v.classList.remove("is-visible")});
      btn.classList.add("is-active");
      $(("#"+btn.dataset.view)).classList.add("is-visible");
    });
  });

  // file upload
  elements.itemImage.addEventListener("change", function(ev){
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    handleFileUpload(f);
  });

  // image URL input
  elements.itemImageUrl.addEventListener("change", handleImageUrlInput);

  elements.itemForm.addEventListener("submit", function(ev){
    ev.preventDefault();
    var item = getFormItem();
    var eid = elements.editingItemId.value;
    if (eid) { state.items = state.items.map(function(ex){return ex.id===eid?Object.assign({},item,{id:eid}):ex}); }
    else { state.items.unshift(item); }
    saveState(); resetForm(); renderAll();
  });

  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.resetFormButton.addEventListener("click", resetForm);
  elements.searchInput.addEventListener("input", renderCloset);
  elements.categoryFilter.addEventListener("change", renderCloset);
  elements.quickSeedButton.addEventListener("click", addQuickSeedItems);

  elements.regenerateButton.addEventListener("click", function(){
    if (state.lastPlannerContext) {
      var ctx = Object.assign({}, state.lastPlannerContext, {anchorId: state.lastPlannerContext.anchorId||""});
      state.generatedOutfits = generateOutfits(ctx);
      renderOutfits();
    }
  });

  elements.waitlistForm.addEventListener("submit", function(ev){ ev.preventDefault(); saveLead(); });

  elements.plannerForm.addEventListener("submit", function(ev){
    ev.preventDefault();
    var ctx = {temp:Number(elements.temperature.value),weather:elements.weather.value,mood:elements.mood.value,occasion:elements.occasion.value,styleGoal:norm(elements.styleGoal.value),anchorId:elements.anchorItem.value};
    savePlannerDefaults(ctx);
    state.generatedOutfits = generateOutfits(ctx);
    renderOutfits();
  });

  if (elements.fetchButton) {
    elements.fetchButton.addEventListener("click", handleFetchClick);
  }
  if (elements.fetchLinkInput) {
    elements.fetchLinkInput.addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); handleFetchClick(); }});
  }
  if (elements.removeBgButton) {
    elements.removeBgButton.addEventListener("click", removeBackground);
  }

  // global paste handler: Ctrl+V anywhere = screenshot import
  document.addEventListener("paste", handleGlobalPaste);
}

/* init */
initElements();
loadState();
wireEvents();
restorePlannerDefaults();
renderAll();
renderOutfits();

// Preload AI model in background (wrapped to avoid parse error)
setTimeout(function() {
  loadBgRemovalModule().then(function() {
    console.log("AI抠图模型已预加载");
  }).catch(function() {
    console.log("AI抠图模型预加载跳过");
  });
}, 1200);