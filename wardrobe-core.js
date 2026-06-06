(function initWardrobeCore(globalScope) {
  const onlineTestItems = [
    {
      id: "online-uniqlo-shirt-479079",
      image: "https://image.uniqlo.com/UQ/ST3/us/imagesgoods/479079/feature/usgoods_479079_feature1.jpg",
      name: "UNIQLO 条纹棉衬衫",
      category: "top",
      color: "粉蓝条纹",
      material: "100%棉",
      thickness: "light",
      season: "spring",
      styles: ["通勤", "简洁", "松弛"],
      occasions: ["上班", "朋友聚会"],
      url: "https://www.uniqlo.com/us/en/products/E479079-000/00",
      notes: "网售商品测试：适合单穿或叠穿",
    },
    {
      id: "online-uniqlo-jeans-480778",
      image: "https://image.uniqlo.com/UQ/ST3/us/imagesgoods/480778/feature/usgoods_480778_feature1.jpg",
      name: "UNIQLO 宽直筒牛仔裤",
      category: "bottom",
      color: "蓝色",
      material: "棉混纺牛仔",
      thickness: "medium",
      season: "all",
      styles: ["休闲", "利落", "松弛"],
      occasions: ["上班", "朋友聚会", "旅行"],
      url: "https://www.uniqlo.com/us/en/products/E480778-000/00",
      notes: "网售商品测试：高腰宽直筒",
    },
    {
      id: "online-uniqlo-trench-479223",
      image: "https://image.uniqlo.com/UQ/ST3/us/imagesgoods/479223/feature/usgoods_479223_feature1.jpg",
      name: "UNIQLO Relaxed 风衣",
      category: "outer",
      color: "黑色",
      material: "垂坠面料",
      thickness: "medium",
      season: "spring",
      styles: ["通勤", "质感", "有气场"],
      occasions: ["上班", "正式场合", "约会"],
      url: "https://www.uniqlo.com/us/en/products/E479223-000/00",
      notes: "网售商品测试：适合春秋外搭",
    },
    {
      id: "online-uniqlo-bag-478708",
      image: "https://image.uniqlo.com/UQ/ST3/gb/imagesgoods/478708/feature/gbgoods_478708_feature1.jpg",
      name: "UNIQLO 迷你肩背包",
      category: "bag",
      color: "绿色",
      material: "尼龙",
      thickness: "light",
      season: "all",
      styles: ["休闲", "亮色", "旅行"],
      occasions: ["朋友聚会", "旅行", "约会"],
      url: "https://www.uniqlo.com/uk/en/products/E478708-000",
      notes: "网售商品测试：轻便日常包",
    },
    {
      id: "online-hm-loafers-1260317009",
      image: "",
      name: "H&M 黑色乐福鞋",
      category: "shoes",
      color: "黑色",
      material: "皮革",
      thickness: "medium",
      season: "all",
      styles: ["通勤", "质感", "利落"],
      occasions: ["上班", "约会", "正式场合"],
      url: "https://www2.hm.com/en_us/productpage.1260317009.html",
      notes: "网售商品测试：页面可查商品信息，图片由 App 占位图兜底",
    },
  ];

  /* ── shared helpers ── */

  function splitTags(value) {
    return String(value || "")
      .split(/[,，、\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function desiredSeason(temp) {
    if (temp <= 8) return "winter";
    if (temp <= 18) return "autumn";
    if (temp >= 28) return "summer";
    return "spring";
  }

  function temperatureScore(item, temp) {
    const thickness = item.thickness;
    if (temp <= 8) return thickness === "warm" ? 4 : thickness === "medium" ? 2 : -2;
    if (temp <= 18) return thickness === "warm" ? 2 : thickness === "medium" ? 4 : 1;
    if (temp >= 28) return thickness === "light" ? 4 : thickness === "medium" ? 1 : -3;
    return thickness === "medium" ? 4 : thickness === "light" ? 3 : 1;
  }

  function moodStyleWords(mood) {
    var map = {
      calm: ["简洁", "基础", "通勤", "干净"],
      bright: ["亮色", "显气色", "甜美", "活泼"],
      confident: ["正式", "利落", "有气场", "质感"],
      soft: ["温柔", "浅色", "柔和", "松弛"],
      lazy: ["舒服", "休闲", "宽松", "省心"],
    };
    return map[mood] || [];
  }

  function scoreItem(item, context) {
    var score = 0;
    var tags = [].concat(item.styles || [], item.occasions || [], [item.notes, item.material].filter(Boolean)).join(" ");

    score += temperatureScore(item, context.temp);
    if (item.season === "all" || (item.season || "").indexOf(desiredSeason(context.temp)) !== -1) score += 2;
    if (item.occasions && item.occasions.indexOf(context.occasion) !== -1) score += 4;
    splitTags(context.styleGoal).forEach(function(word) {
      if (tags.indexOf(word) !== -1) score += 3;
    });
    moodStyleWords(context.mood).forEach(function(word) {
      if (tags.indexOf(word) !== -1 || (item.color || "").indexOf(word) !== -1) score += 1.5;
    });
    if (context.weather === "rain" && ["shoes", "outer"].indexOf(item.category) !== -1) score += 1.5;
    if (context.weather === "wind" && item.category === "outer") score += 2;
    if (context.anchorId === item.id) score += 8;

    return score;
  }

  function bestByCategory(items, category, context, usedIds, offset) {
    offset = offset || 0;
    usedIds = usedIds || new Set();
    var candidates = items
      .filter(function(item) { return item.category === category && !usedIds.has(item.id); })
      .map(function(item) { return { item: item, score: scoreItem(item, context) }; })
      .sort(function(a, b) { return b.score - a.score; });

    return (candidates[offset % Math.max(candidates.length, 1)] || {}).item || null;
  }

  /* ── outfit generation ── */

  function outfitTitle(context, variant) {
    var titles = [
      context.occasion + "稳妥组合",
      context.temp + "°C舒适组合",
      "带一点情绪的组合",
    ];
    return titles[variant] || "今日组合";
  }

  function outfitReason(pieces, context) {
    var names = pieces.map(function(item) { return item.name; }).join("、");
    var weatherText = ({
      clear: "天气稳定",
      cloudy: "多云光线柔和",
      rain: "有雨，需要更重视鞋和外套",
      wind: "风大，需要增加外层稳定感",
      snow: "雪天，需要保暖优先",
    })[context.weather] || "天气适中";
    var moodText = ({
      calm: "整体保持干净克制",
      bright: "用颜色和轻快感提气色",
      confident: "线条更利落，适合增强气场",
      soft: "色彩和材质更柔和",
      lazy: "优先省心和舒适",
    })[context.mood] || "按你喜欢的风格来";

    return names + "。" + weatherText + "，" + context.occasion + "场合下这套更容易穿出门；" + moodText + "。";
  }

  function createOutfit(items, context, variant, createId) {
    var used = new Set();
    var anchor = items.find(function(item) { return item.id === context.anchorId; });
    var preferDress = (anchor && anchor.category === "dress") || (variant === 2 && items.some(function(item) { return item.category === "dress"; }));
    var pieces = [];

    if (anchor) {
      pieces.push(anchor);
      used.add(anchor.id);
    }

    if (preferDress) {
      var dress = (anchor && anchor.category === "dress") ? anchor : bestByCategory(items, "dress", context, used, variant);
      if (dress) {
        pieces.push(dress);
        used.add(dress.id);
      }
    } else {
      var top = (anchor && anchor.category === "top") ? anchor : bestByCategory(items, "top", context, used, variant);
      var bottom = (anchor && anchor.category === "bottom") ? anchor : bestByCategory(items, "bottom", context, used, variant);
      [top, bottom].forEach(function(item) {
        if (item && !used.has(item.id)) {
          pieces.push(item);
          used.add(item.id);
        }
      });
    }

    var needsOuter = context.temp <= 20 || ["rain", "wind", "snow"].indexOf(context.weather) !== -1;
    var optionalCategories = [
      needsOuter ? "outer" : null,
      "shoes",
      "bag",
      variant === 1 ? "accessory" : null,
    ].filter(Boolean);

    optionalCategories.forEach(function(category, index) {
      var item = (anchor && anchor.category === category) ? anchor : bestByCategory(items, category, context, used, variant + index);
      if (item && !used.has(item.id)) {
        pieces.push(item);
        used.add(item.id);
      }
    });

    var score = Math.round(
      pieces.reduce(function(sum, item) { return sum + scoreItem(item, context); }, 0) / Math.max(pieces.length, 1),
    );

    return {
      id: createId(),
      title: outfitTitle(context, variant),
      pieces: pieces,
      score: score,
      reason: outfitReason(pieces, context),
    };
  }

  function generateOutfits(items, context, createId) {
    if (!createId) createId = function() { return String(Date.now()); };
    if (items.length < 2) return [];

    var outfits = [0, 1, 2]
      .map(function(variant) { return createOutfit(items, context, variant, createId); })
      .filter(function(outfit) { return outfit.pieces.length >= 2; });

    var seen = new Set();
    return outfits.filter(function(outfit) {
      var key = outfit.pieces.map(function(item) { return item.id; }).sort().join("-");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function withTimestamps(items, now) {
    var ts = now || new Date().toISOString();
    return items.map(function(item) {
      var o = {};
      for (var k in item) { o[k] = item[k]; }
      o.createdAt = o.createdAt || ts;
      return o;
    });
  }

  /* ── AI suggestions (client-side keyword-based) ── */

  function suggestStyleTags(item) {
    var tags = [];
    var text = [item.name, item.material, item.notes, item.color].filter(Boolean).join(" ");
    if (/衬衫|衬衣|白衬衫|蓝衬衫|条纹/.test(text)) { tags.push("通勤", "简洁"); }
    if (/t恤|T恤|卫衣|棉/.test(text)) { tags.push("休闲", "舒服"); }
    if (/西装|西服|正装|礼服/.test(text)) { tags.push("正式", "有气场", "质感"); }
    if (/裙|连衣裙|长裙|短裙/.test(text)) { tags.push("温柔", "甜美"); }
    if (/牛仔|牛仔裤|休闲裤/.test(text)) { tags.push("休闲", "利落"); }
    if (/针织|毛衣|开衫|羊毛/.test(text)) { tags.push("温柔", "舒服", "松弛"); }
    if (/风衣|大衣|外套|夹克/.test(text)) { tags.push("质感", "通勤", "松弛"); }
    if (/运动|速干|瑜伽|健身/.test(text)) { tags.push("运动", "舒服"); }
    if (/黑|深|藏蓝|深灰/.test(text)) { tags.push("显瘦"); }
    if (/亮|红|黄|粉|白/.test(text)) { tags.push("亮色", "显气色"); }
    return tags.slice(0, 3);
  }

  function suggestOccasionTags(item) {
    var tags = [];
    var text = [item.name, item.material, item.notes].filter(Boolean).join(" ");
    if (/衬衫|西装|通勤|正装/.test(text)) { tags.push("上班", "正式场合"); }
    if (/裙|约会|蕾丝|碎花/.test(text)) { tags.push("约会", "朋友聚会"); }
    if (/运动|速干|瑜伽|健身/.test(text)) { tags.push("运动"); }
    if (/休闲|宽松|卫衣|t恤|T恤/.test(text)) { tags.push("朋友聚会", "旅行"); }
    if (/牛仔|包|简约|基础|基本款/.test(text)) { tags.push("上班", "朋友聚会"); }
    return tags.slice(0, 3);
  }

  function inferThickness(item) {
    var text = [item.name, item.material, item.notes].filter(Boolean).join(" ");
    if (/厚|加绒|羽绒|棉服|羊毛|呢|羊绒/.test(text)) return "warm";
    if (/薄|夏|丝|雪纺|轻|纱|cool/.test(text.toLowerCase())) return "light";
    if (/针织|卫衣|风衣|西装|外套|夹克/.test(text)) return "medium";
    return "medium";
  }

  function inferSeason(item) {
    var text = [item.name, item.material, item.notes].filter(Boolean).join(" ");
    if (/羽绒|棉服|加绒|厚|冬|羊毛|呢/.test(text)) return "winter";
    if (/风衣|夹克|卫衣|针织|毛衣/.test(text)) return "autumn";
    if (/短袖|短裤|凉鞋|雪纺|夏|纱|薄/.test(text)) return "summer";
    return "all";
  }

  /* ── export ── */

  var api = {
    onlineTestItems: onlineTestItems,
    splitTags: splitTags,
    desiredSeason: desiredSeason,
    temperatureScore: temperatureScore,
    moodStyleWords: moodStyleWords,
    scoreItem: scoreItem,
    bestByCategory: bestByCategory,
    generateOutfits: generateOutfits,
    withTimestamps: withTimestamps,
    suggestStyleTags: suggestStyleTags,
    suggestOccasionTags: suggestOccasionTags,
    inferThickness: inferThickness,
    inferSeason: inferSeason,
  };

  globalScope.WardrobeCore = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
