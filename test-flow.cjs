const assert = require("node:assert/strict");
const core = require("./wardrobe-core.js");

const items = core.withTimestamps(core.onlineTestItems, "2026-05-31T00:00:00.000Z");
const context = {
  temp: 18,
  weather: "rain",
  mood: "confident",
  occasion: "上班",
  styleGoal: "通勤 质感",
  anchorId: "",
};

assert.equal(items.length, 5, "should load five online shopping items");
assert.ok(items.every((item) => item.url.startsWith("https://")), "each online item needs a product URL");
assert.ok(items.some((item) => item.image.startsWith("https://")), "at least one online item needs an image URL");

const outfits = core.generateOutfits(items, context, (() => {
  let index = 0;
  return () => `test-outfit-${index++}`;
})());

assert.ok(outfits.length >= 1, "should generate at least one outfit");

const first = outfits[0];
const categories = new Set(first.pieces.map((item) => item.category));
assert.ok(categories.has("top"), "first outfit should include a top");
assert.ok(categories.has("bottom"), "first outfit should include a bottom");
assert.ok(categories.has("shoes"), "first outfit should include shoes");
assert.ok(first.pieces.length >= 4, "rainy work outfit should include at least four pieces");
assert.match(first.reason, /有雨/, "outfit reason should mention rainy weather");
assert.match(first.reason, /上班/, "outfit reason should mention the occasion");

const anchored = core.generateOutfits(items, { ...context, anchorId: "online-uniqlo-trench-479223" }, () => "anchored");
assert.ok(
  anchored[0].pieces.some((item) => item.id === "online-uniqlo-trench-479223"),
  "anchor item should appear in the first outfit",
);

console.log(JSON.stringify({
  loadedItems: items.length,
  generatedOutfits: outfits.length,
  firstOutfit: first.pieces.map((item) => item.name),
  firstReason: first.reason,
}, null, 2));
