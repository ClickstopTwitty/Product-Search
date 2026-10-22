import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use(express.static("public"));

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const MODEL = process.env.MODEL || "claude-sonnet-5-5";
const PASSWORD = process.env.APP_PASSWORD || "";
const DOMAINS = (process.env.SITE_DOMAINS || "uscargocontrol.com,fastenersplus.com")
  .split(",").map(s => s.trim()).filter(Boolean);

const PROMPT = `You identify products from a photo for warehouse staff at a company that sells cargo control products (straps, chains, binders, hooks, tie-downs, nets, tarps) and fasteners (bolts, nuts, screws, washers, anchors).

Steps:
1. Study the photo. Note product type, size/length/grade/thread/working load clues, color, material, and ALL legible text, stamps, or part numbers.
2. Use web search (restricted to our two sites) to find the exact product or the closest look-alikes. Try several queries: the visible part number first if there is one, then descriptive keywords.
3. Part number rule: Report ONLY our own part number, meaning the SKU or item number the website itself lists for the product. Ignore manufacturer, vendor, supplier, and MPN numbers, even if they are printed on the product, visible in the photo, or shown on the page. If the photo shows a vendor number, use it only as a search term, then report our SKU from the matching product page. The number MUST come from the product page. Never guess or invent one. If you cannot find our SKU, leave part_number empty.

Respond with ONLY a JSON object, no markdown:
{"seen":"one-line description of what's in the photo","visible_text":["..."],"matches":[{"part_number":"","title":"","url":"","match":"exact|similar","confidence":"high|medium|low","reason":"one short sentence","confirm":"what to verify (length, grade, WLL...) or empty string"}]}
Return up to 5 matches, best first. Use "exact" only if markings or distinctive features and size clearly settle it. Return an empty matches list if nothing fits.`;

function extractJson(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("no json");
  return JSON.parse(text.slice(a, b + 1));
}
const hostOk = u => {
  try { const h = new URL(u).hostname.replace(/^www\./, ""); return DOMAINS.some(d => h === d || h.endsWith("." + d)); }
  catch { return false; }
};

app.post("/api/identify", async (req, res) => {
  if (PASSWORD && req.get("x-app-password") !== PASSWORD) return res.status(401).json({ error: "bad_password" });
  const { image, mediaType = "image/jpeg" } = req.body || {};
  if (!image) return res.status(400).json({ error: "no_image" });

  try {
    const messages = [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
      { type: "text", text: PROMPT }
    ]}];
    const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 8, allowed_domains: DOMAINS }];

    let resp;
    for (let i = 0; i < 4; i++) {
      resp = await client.messages.create({ model: MODEL, max_tokens: 2500, tools, messages });
      if (resp.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: resp.content });
    }

    // URLs the search tool actually returned (guards against made-up links)
    const seenUrls = new Set();
    for (const b of resp.content) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content))
        b.content.forEach(r => r.url && seenUrls.add(r.url));
    }
    const text = resp.content.filter(b => b.type === "text").map(b => b.text).join("");
    const out = extractJson(text);
    out.matches = (out.matches || []).filter(m => m.part_number && m.url && hostOk(m.url))
      .map(m => ({ ...m, verified_link: seenUrls.has(m.url) }));
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed", detail: String(e.message || e) });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Part Finder running"));
