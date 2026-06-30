import { useState, useEffect, useRef } from "react";

// ─── ANTHROPIC API HELPER ────────────────────────────────────────────────────
// ─── PERSISTENT STATE HELPER ──────────────────────────────────────────────────
// A useState that automatically reads from and writes to localStorage,
// so app data (tasks, calendar, calorie log, health entries, vault) survives
// closing the app or refreshing the page.
function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {} // storage full or unavailable — fail silently rather than crash the app
  }, [key, value]);

  return [value, setValue];
}

// ─── DATE FORMAT STANDARD ─────────────────────────────────────────────────────
// All numeric dates in this app are DD/MM/YYYY — day first, to match NZ convention
// and avoid any US-style MM/DD ambiguity. Use this helper anywhere a strict
// numeric date is needed. Long-form display dates (e.g. "4 July 2026") are
// already unambiguous and don't need this.
function formatDateDDMMYYYY(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getAnthropicKey() {
  return localStorage.getItem("tars_anthropic_key") || "";
}

async function callClaudeRaw({ system, messages, tools }) {
  const apiKey = getAnthropicKey();
  if (!apiKey) throw new Error("NO_KEY");

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: system || "",
    messages,
  };
  if (tools && tools.length > 0) body.tools = tools;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }
  return response.json();
}

// Simple version — no tools, just text in, text out (used by memory summarisation etc)
async function callClaude({ system, messages }) {
  const data = await callClaudeRaw({ system, messages: messages.map(m => ({ role: m.role, content: m.content })) });
  return data.content?.map(b => b.text || "").join("") || "";
}

// Tool-use version — lets Claude call search_vault to look up real documents from the
// vault by itself, the same way Claude (in this chat, talking to Neil) can search files
// rather than guessing. toolHandlers maps tool name -> function that returns a result string.
async function callClaudeWithTools({ system, messages, tools, toolHandlers, maxRounds = 4 }) {
  let convo = messages.map(m => ({ role: m.role, content: m.content }));

  for (let round = 0; round < maxRounds; round++) {
    const data = await callClaudeRaw({ system, messages: convo, tools });
    const stopReason = data.stop_reason;
    const blocks = data.content || [];

    if (stopReason !== "tool_use") {
      // Final answer — return the text
      return blocks.map(b => b.text || "").join("");
    }

    // Claude wants to call one or more tools — run them and feed results back
    convo.push({ role: "assistant", content: blocks });

    const toolResults = [];
    for (const block of blocks) {
      if (block.type === "tool_use") {
        const handler = toolHandlers[block.name];
        let resultContent = "Tool not available.";
        try {
          resultContent = handler ? await handler(block.input) : resultContent;
        } catch (err) {
          resultContent = `Tool error: ${err.message}`;
        }
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultContent });
      }
    }
    convo.push({ role: "user", content: toolResults });
  }

  return "I tried looking that up but couldn't pin it down — can you be a bit more specific?";
}

// Anthropic's native server-side web search tool — the API performs the search itself
// and feeds results back into Claude's reasoning automatically. No custom handler needed
// (unlike search_vault), and no separate API key — billed through the same Anthropic key.
// Available to both main TARS chat and Projects.
const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg:       "#0a0f1e",
  card:     "#111827",
  elevated: "#1a2744",
  accent:   "#e94560",
  blue:     "#4facde",
  gold:     "#f5a623",
  green:    "#22c55e",
  purple:   "#a78bfa",
  text:     "#f8f9fb",
  muted:    "#64748b",
  border:   "#1e2d4a",
};

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────
const USER = {
  name: "Neil",
  rotation: { start: "2026-06-26", weeksOn: 8, weeksOff: 8 },
  health: { weight: 89.0, target: 81, bodyFat: 25.2, fatMass: 22.4, muscle: 35.6, bp: "127/75" },
  nextFlight: { route: "CHC → ORD", date: "24 Aug 2026", carrier: "United" },
};

const INIT_TASKS = [
  { id:1, text:"Take morning supplements", done:false, priority:"high",  cat:"Health",  due:"Today" },
  { id:2, text:"Bodyweight training session", done:false, priority:"high",  cat:"Health",  due:"Today" },
  { id:3, text:"Log meals in planner",       done:true,  priority:"med",   cat:"Health",  due:"Today" },
  { id:4, text:"Book GP appointment",        done:false, priority:"high",  cat:"Admin",   due:"This week" },
  { id:5, text:"Review Chief Officer CVs",   done:false, priority:"med",   cat:"Work",    due:"This week" },
];

const HEALTH_TARGETS = {
  weight:  { min:79,   max:81,  label:"79–81 kg",  color:T.blue },
  bodyFat: { min:18,   max:20,  label:"18–20%",    color:T.accent },
  fatMass: { min:14,   max:16,  label:"14–16 kg",  color:T.gold },
  muscle:  { min:35.6, max:40,  label:"35.6 kg+",  color:T.green },
};

const SUPPLEMENTS = [
  { id:"s1", name:"Centrum for Men × 1",           when:"Breakfast", phase:"Week 1" },
  { id:"s2", name:"Magnesium Malate × 2",           when:"Breakfast", phase:"Week 1" },
  { id:"s3", name:"Ashwagandha KSM-66 × 1",        when:"Breakfast", phase:"Now" },
  { id:"s4", name:"Blackmores Fish Oil × 2",        when:"Dinner",    phase:"Week 1" },
  { id:"s5", name:"Blackmores Vitamin D3 × 1",      when:"Dinner",    phase:"Week 1" },
  { id:"s6", name:"Sleep Drops Mag Glycinate × 2",  when:"Bedtime",   phase:"Week 3" },
  { id:"s7", name:"Faction Labs Creatine × 1 scoop",when:"With meal", phase:"Week 6+" },
];

const EXERCISE_PLAN = [
  { day:"Mon", type:"training" }, { day:"Tue", type:"walk" },
  { day:"Wed", type:"training" }, { day:"Thu", type:"walk" },
  { day:"Fri", type:"training" }, { day:"Sat", type:"walk" },
  { day:"Sun", type:"rest" },
];

const EXERCISES = [
  { icon:"🦵", name:"Bodyweight Squats",        detail:"3 × 10–15 reps", muscles:"Quads, glutes, hamstrings" },
  { icon:"💪", name:"Incline Push-ups",          detail:"3 × 8–12 reps",  muscles:"Chest, shoulders, triceps" },
  { icon:"🏋️", name:"Door Frame / Table Rows",  detail:"3 × 8–12 reps",  muscles:"Back, biceps" },
  { icon:"🍑", name:"Glute Bridges",             detail:"3 × 12–15 reps", muscles:"Glutes, lower back" },
  { icon:"🧘", name:"Plank + Dead Bugs",         detail:"3 sets, build time", muscles:"Core stability" },
];


// ─── NEIL'S FOOD PROFILE (compiled from onboarding 1 Jul 2026) ───────────────
const NEIL_FOOD_PROFILE = {
  proteins: {
    beef: "love", chicken: "love", lamb: "love", pork: "love",
    fish: "love", seafood: "like", eggs: "like"
  },
  cuisines: {
    mediterranean: "love", classicWestern: "love",
    asian: "like", middleEastern: "like", mexican: "like"
  },
  cooking: {
    activeKitchenTime: "20-30 mins max — passive oven/slow cook time is fine, just not actively working longer than that",
    complexity: "simple multi-step",
    methods: "mix of everything",
    leftovers: "always — dinner becomes next day's lunch (always makes 2 serves)",
    marinades: "no — keep it simple, no overnight prep"
  },
  flavour: {
    spice: "medium",
    overall: "seasonal variety — lighter in summer, hearty in winter",
    sweetSavoury: "balanced",
    garlicOnion: "in moderation"
  },
  loves: ["mushrooms", "all cheeses mild and strong", "coconut milk", "cream and butter sauces", "fish sauce", "coriander", "olives", "capsicum", "anchovies"],
  avoids: [
    "offal and organ meats",
    "eggplant / aubergine",
    "brussels sprouts, kale, radicchio and bitter vegetables",
    "kumara / sweet potato",
    "most legumes and pulses — exception: chickpeas in moderation only",
    "all beans except green beans",
    "tofu is acceptable in moderation"
  ],
  neutral: ["zucchini", "carrot / parsnip / beetroot"],
  produce: {
    seasonal: "mostly seasonal NZ produce, flexible",
    location: "Christchurch, New Zealand — SOUTHERN HEMISPHERE (seasons are flipped from Northern Hemisphere: currently mid-winter July 2026)",
    context: "Only cooks when off rotation at home in Christchurch. All meals provided on Man of Steel. Never cook when on rotation."
  },
  macros: {
    priority: "balanced — protein, carbs and fats",
    carbs: "in moderation",
    targets: "1900-2000 kcal/day, 140-160g protein/day",
    salad: "a few times a week as a side"
  },
  budget: {
    base: "$8-15 NZD per serving",
    note: "Budget is a selectable filter at generation time — Neil can ask for 'under $10 options' or 'no limit this week' depending on mood"
  },
  generation: {
    style: "TARS generates 10-15 options for the week, Neil selects which to cook",
    adventurousness: "loves trying new things",
    library: "dynamic — all meals generated by TARS/Claude, no fixed hardcoded list"
  },
  ratings: {} // populated over time as Neil rates meals
};

// ─── MEAL PLANNING SCREEN ─────────────────────────────────────────────────────
function MealPlanScreen({ calLog, setCalLog, todayLabel, appState }) {
  const [mealView, setMealView] = useState("planner"); // planner | pantry | history
  const [mealLibrary, setMealLibrary] = usePersistentState("meal_library", []);
  const [pantry, setPantry] = usePersistentState("meal_pantry", [
    { id:1,  name:"Olive oil",       type:"staple", status:"have", qty:"Bottle", cat:"Oil & Condiments" },
    { id:2,  name:"Soy sauce",       type:"staple", status:"have", qty:"Bottle", cat:"Oil & Condiments" },
    { id:3,  name:"Garlic",          type:"staple", status:"have", qty:"Bulb",   cat:"Herbs & Spices" },
    { id:4,  name:"Salt & pepper",   type:"staple", status:"have", qty:"—",      cat:"Herbs & Spices" },
    { id:5,  name:"Olive oil spray", type:"staple", status:"have", qty:"Can",    cat:"Oil & Condiments" },
    { id:6,  name:"Smoked paprika",  type:"staple", status:"have", qty:"Jar",    cat:"Herbs & Spices" },
    { id:7,  name:"Ground cumin",    type:"staple", status:"have", qty:"Jar",    cat:"Herbs & Spices" },
    { id:8,  name:"Dried oregano",   type:"staple", status:"have", qty:"Jar",    cat:"Herbs & Spices" },
    { id:9,  name:"Fish sauce",      type:"staple", status:"have", qty:"Bottle", cat:"Oil & Condiments" },
    { id:10, name:"Sesame oil",      type:"staple", status:"have", qty:"Bottle", cat:"Oil & Condiments" },
  ]);
  const [selectedMeals, setSelectedMeals] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [generateBudget, setGenerateBudget] = useState("$8-15");
  const [generateCount, setGenerateCount] = useState(12);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [ratingTarget, setRatingTarget] = useState(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingNotes, setRatingNotes] = useState("");
  const [pantryInput, setPantryInput] = useState("");
  const [pantryProcessing, setPantryProcessing] = useState(false);
  const [pantryImage, setPantryImage] = useState(null);

  const toBase64Mp = (file) => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=()=>rej(); r.readAsDataURL(file); });

  // ── Season detection (Christchurch, NZ — Southern Hemisphere) ──
  const getSeason = () => {
    const m = new Date().getMonth(); // 0-indexed
    if (m >= 11 || m <= 1) return "Summer"; // Dec-Feb
    if (m >= 2 && m <= 4) return "Autumn";   // Mar-May
    if (m >= 5 && m <= 7) return "Winter";   // Jun-Aug
    return "Spring";                          // Sep-Nov
  };
  const currentSeason = getSeason();

  // ── Generate meals via Claude ──
  const generateMeals = async () => {
    const apiKey = localStorage.getItem("tars_anthropic_key");
    if (!apiKey) { alert("Add your Anthropic API key in TARS settings first."); return; }
    setGenerating(true);
    try {
      const pantryList = pantry.filter(p=>p.status==="have").map(p=>p.name).join(", ");
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8000,
          system: `You are a professional meal planner generating personalised dinner suggestions. Return ONLY a valid JSON array, no markdown, no backticks, no preamble. Keep all text fields SHORT.`,
          messages:[{ role:"user", content:`Generate ${generateCount} dinner meal suggestions for Neil. Budget: ${generateBudget} NZD per serving. Season: ${currentSeason} in Christchurch NZ (Southern Hemisphere). Current pantry staples: ${pantryList}.

NEIL'S KEY PREFERENCES: Loves beef/chicken/lamb/pork/fish. Mediterranean and classic Western cuisine preferred. Avoids: offal, eggplant, bitter veg, kumara, beans (green beans OK), most legumes. Cooking time: 20-30 mins active max, oven time OK. No marinades. Medium spice. Balanced macros, carbs in moderation.

IMPORTANT: Always 2 serves. High protein (45-65g per serve). Vary cuisines. Reflect ${currentSeason} season.

Return ONLY a JSON array — no recipe field needed, keep ingredients list short (max 6 items):
[{
  "id": 1,
  "name": "Meal name",
  "cuisine": "Mediterranean|Asian|Western|Middle Eastern|Mexican|Other",
  "protein": 55,
  "kcal": 650,
  "costPerServe": 12,
  "prepTime": "25 mins active",
  "season": "${currentSeason}",
  "ingredients": [{"name": "ingredient", "qty": "qty for 2 serves", "type": "fresh|staple|protein"}],
  "recipe": "",
  "rating": 0,
  "notes": "",
  "cooked": false,
  "cookedDates": []
}]` }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(b=>b.text||"").join("") || "";
      let clean = text.replace(/```json|```/g, "").trim();

      // If JSON was truncated mid-response (hit token limit), try to salvage
      // complete meal objects by closing the array at the last complete entry
      let meals;
      try {
        meals = JSON.parse(clean);
      } catch {
        // Find the last complete object in the array (ends with }) and close the array there
        const lastComplete = clean.lastIndexOf("},");
        const lastCompleteFinal = clean.lastIndexOf("}]");
        const salvageAt = Math.max(lastComplete, lastCompleteFinal);
        if (salvageAt > 0) {
          const salvaged = clean.slice(0, lastComplete + 1) + "]";
          try {
            meals = JSON.parse(salvaged);
            console.log(`Salvaged ${meals.length} meals from truncated response`);
          } catch {
            throw new Error("Response was too large and couldn't be salvaged — try generating fewer meals (e.g. 8 instead of 12)");
          }
        } else {
          throw new Error("Response was too large and couldn't be salvaged — try generating fewer meals (e.g. 8 instead of 12)");
        }
      }

      setMealLibrary(prev => {
        // Keep existing meals that have been cooked or rated, replace uncooked/unrated ones
        const keep = prev.filter(m => m.cooked || m.rating > 0);
        return [...keep, ...meals.map((m,i) => ({ ...m, id: Date.now() + i }))];
      });
    } catch(err) {
      alert(`Could not generate meals: ${err.message}`);
    }
    setGenerating(false);
  };

  // ── Generate recipe on demand for a specific meal ──
  const [generatingRecipe, setGeneratingRecipe] = useState(null);

  const generateRecipe = async (meal) => {
    const apiKey = localStorage.getItem("tars_anthropic_key");
    if (!apiKey) return;
    setGeneratingRecipe(meal.id);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify({
          model:"claude-sonnet-4-6", max_tokens:1000,
          system:`You are a recipe writer. Return ONLY the recipe as plain numbered steps, no markdown, no preamble.`,
          messages:[{ role:"user", content:`Write a simple recipe for "${meal.name}" for 2 serves. Active kitchen time should be 20-30 mins max. Passive oven time is fine. Numbered steps, concise. Ingredients: ${meal.ingredients?.map(i=>`${i.name} (${i.qty})`).join(", ")}.` }]
        })
      });
      const data = await response.json();
      const recipe = data.content?.map(b=>b.text||"").join("") || "";
      setMealLibrary(prev => prev.map(m => m.id===meal.id ? {...m, recipe} : m));
    } catch {}
    setGeneratingRecipe(null);
  };

  // ── Log selected meal to calorie tracker ──
  const logMealToCalories = (meal) => {
    const entry = { id:Date.now(), name:meal.name, kcal:meal.kcal, protein:meal.protein, time:new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}) };
    setCalLog(prev => ({ ...prev, [todayLabel]: [...(prev[todayLabel]||[]), entry] }));
  };

  // ── Mark meal as cooked — removes fresh ingredients from pantry ──
  const markCooked = (meal) => {
    const today = new Date().toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"});
    setMealLibrary(prev => prev.map(m => m.id===meal.id ? {...m, cooked:true, cookedDates:[...(m.cookedDates||[]), today]} : m));
    // Remove fresh ingredients from pantry
    const freshToRemove = (meal.ingredients||[]).filter(i=>i.type==="fresh").map(i=>i.name.toLowerCase());
    setPantry(prev => prev.filter(p => !freshToRemove.some(f => p.name.toLowerCase().includes(f.split(" ")[0]))));
    logMealToCalories(meal);
  };

  // ── Save meal rating ──
  const saveRating = () => {
    if (!ratingTarget) return;
    setMealLibrary(prev => prev.map(m => m.id===ratingTarget.id ? {...m, rating:ratingValue, notes:ratingNotes} : m));
    setRatingTarget(null); setRatingValue(0); setRatingNotes("");
  };

  // ── Process pantry photo via Claude ──
  const processPantryPhoto = async (file) => {
    const apiKey = localStorage.getItem("tars_anthropic_key");
    if (!apiKey) { alert("Add your Anthropic API key in TARS settings first."); return; }
    setPantryProcessing(true);
    try {
      const base64 = await toBase64Mp(file);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify({
          model:"claude-sonnet-4-6", max_tokens:1000,
          system:`You are reading a photo of food items, a pantry, or groceries. Extract every visible food item and classify each as either "staple" (things that persist long-term like oils, sauces, spices, butter, flour, condiments) or "fresh" (things that get used up like meat, vegetables, fruit, dairy). Return ONLY a valid JSON array, no markdown.`,
          messages:[{ role:"user", content:[
            { type:"image", source:{ type:"base64", media_type:file.type, data:base64 }},
            { type:"text", text:`List every food item visible. For each item, determine if it's a staple (long-lasting: oils, spices, sauces, condiments, butter, canned goods) or fresh (used up: meat, vegetables, fruit, fresh dairy). Return JSON array: [{"name": "item name", "type": "staple|fresh", "qty": "estimated quantity or package size", "cat": "Protein|Produce|Dairy|Oil & Condiments|Herbs & Spices|Canned|Other"}]` }
          ]}]
        })
      });
      const data = await response.json();
      const text = data.content?.map(b=>b.text||"").join("") || "";
      const items = JSON.parse(text.replace(/```json|```/g,"").trim());
      const newItems = items.map((item,i) => ({
        id: Date.now() + i,
        name: item.name, type: item.type, status:"have",
        qty: item.qty || "—", cat: item.cat || "Other"
      }));
      setPantry(prev => {
        const existing = prev.map(p=>p.name.toLowerCase());
        const toAdd = newItems.filter(n => !existing.includes(n.name.toLowerCase()));
        return [...prev, ...toAdd];
      });
      setPantryImage(null);
      alert(`Added ${newItems.length} items to pantry.`);
    } catch(err) {
      alert(`Could not read photo: ${err.message}`);
    }
    setPantryProcessing(false);
  };

  // ── Build shopping list ──
  const buildShoppingList = () => {
    const meals = mealLibrary.filter(m => selectedMeals.has(m.id));
    const allIngredients = {};
    meals.forEach(meal => {
      (meal.ingredients||[]).forEach(ing => {
        const key = ing.name.toLowerCase();
        if (!allIngredients[key]) allIngredients[key] = { ...ing, meals:[] };
        allIngredients[key].meals.push(meal.name);
      });
    });
    const pantryNames = pantry.filter(p=>p.status==="have").map(p=>p.name.toLowerCase());
    return Object.values(allIngredients).map(ing => ({
      ...ing,
      inPantry: ing.type === "staple" || pantryNames.some(p=>p.includes(ing.name.toLowerCase().split(" ")[0]))
    })).filter(ing => !ing.inPantry);
  };

  const shoppingList = buildShoppingList();
  const selectedMealObjects = mealLibrary.filter(m => selectedMeals.has(m.id));

  // ── Render ──
  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display:"flex", gap:0, borderBottom:`1px solid ${T.border}`, marginBottom:16 }}>
        {[["planner","🍽 Planner"],["pantry","🫙 Pantry"],["history","⭐ History"]].map(([id,label])=>(
          <button key={id} onClick={()=>setMealView(id)} style={{ flex:1, padding:"10px 4px", fontSize:12, fontWeight:600, border:"none", background:"none", cursor:"pointer", fontFamily:"inherit", color:mealView===id?T.blue:T.muted, borderBottom:mealView===id?`2px solid ${T.blue}`:"2px solid transparent" }}>{label}</button>
        ))}
      </div>

      {/* ── PLANNER TAB ── */}
      {mealView==="planner" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* Generate controls */}
          <div style={{ background:T.card, borderRadius:14, padding:14, border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:10 }}>Generate Meal Options</div>
            <div style={{ fontSize:11, color:T.muted, marginBottom:10, lineHeight:1.5 }}>
              Currently {currentSeason} in Christchurch — meals will be seasonally appropriate.
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Budget per serve</div>
                <select value={generateBudget} onChange={e=>setGenerateBudget(e.target.value)} style={{ width:"100%", padding:"8px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:12, fontFamily:"inherit" }}>
                  <option value="under $10">Under $10 NZD</option>
                  <option value="$8-15">$8–15 NZD</option>
                  <option value="$12-20">$12–20 NZD</option>
                  <option value="no limit">No limit</option>
                </select>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Number of options</div>
                <select value={generateCount} onChange={e=>setGenerateCount(Number(e.target.value))} style={{ width:"100%", padding:"8px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:12, fontFamily:"inherit" }}>
                  <option value={8}>8 options</option>
                  <option value={12}>12 options</option>
                  <option value={15}>15 options</option>
                </select>
              </div>
            </div>
            <button onClick={generateMeals} disabled={generating} style={{ width:"100%", padding:"11px", borderRadius:10, background:generating?T.elevated:T.blue, color:generating?T.muted:"white", fontWeight:700, fontSize:13, border:"none", cursor:generating?"not-allowed":"pointer", fontFamily:"inherit" }}>
              {generating ? "Generating..." : "✨ Generate meals for the week"}
            </button>
          </div>

          {/* Selected meals summary */}
          {selectedMeals.size > 0 && (
            <div style={{ background:`${T.green}18`, borderRadius:14, padding:14, border:`1px solid ${T.green}44` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.green }}>{selectedMeals.size} meal{selectedMeals.size!==1?"s":""} selected for the week</div>
                <button onClick={()=>setShowShoppingList(s=>!s)} style={{ fontSize:11, fontWeight:700, color:T.green, background:`${T.green}22`, border:`1px solid ${T.green}44`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontFamily:"inherit" }}>
                  {showShoppingList ? "Hide list" : "Shopping list"}
                </button>
              </div>
              {showShoppingList && shoppingList.length > 0 && (
                <div>
                  <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>Items to buy (pantry staples excluded):</div>
                  {shoppingList.map((item,i)=>(
                    <div key={i} style={{ fontSize:12, color:T.text, padding:"3px 0", borderBottom:`1px solid ${T.border}33` }}>
                      {item.name} <span style={{ color:T.muted }}>{item.qty}</span>
                    </div>
                  ))}
                </div>
              )}
              {showShoppingList && shoppingList.length === 0 && (
                <div style={{ fontSize:12, color:T.muted }}>Everything you need is already in your pantry.</div>
              )}
            </div>
          )}

          {/* Meal cards */}
          {mealLibrary.filter(m=>!m.cooked).length === 0 && !generating && (
            <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted, fontSize:13, lineHeight:1.6 }}>
              No meals generated yet. Tap "Generate meals for the week" above to get personalised suggestions based on your food profile and the current season.
            </div>
          )}

          {mealLibrary.filter(m=>!m.cooked).map(meal => {
            const isSelected = selectedMeals.has(meal.id);
            return (
              <div key={meal.id} style={{ background:T.card, borderRadius:14, border:`1px solid ${isSelected?T.blue:T.border}`, overflow:"hidden" }}>
                {/* Header */}
                <div style={{ padding:"12px 14px", borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:6 }}>
                    <button onClick={()=>setSelectedMeals(prev=>{ const n=new Set(prev); n.has(meal.id)?n.delete(meal.id):n.add(meal.id); return n; })}
                      style={{ width:22, height:22, borderRadius:6, border:`2px solid ${isSelected?T.blue:T.border}`, background:isSelected?T.blue:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer", marginTop:1 }}>
                      {isSelected && <span style={{ color:"white", fontSize:12 }}>✓</span>}
                    </button>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:T.text, lineHeight:1.4 }}>{meal.name}</div>
                      <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{meal.cuisine} · {meal.prepTime} · ~${meal.costPerServe?.toFixed(0)||"?"}/serve</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:15, fontWeight:700, color:T.accent }}>{meal.kcal}</div>
                      <div style={{ fontSize:9, color:T.muted }}>kcal/serve</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:15, fontWeight:700, color:T.blue }}>{meal.protein}g</div>
                      <div style={{ fontSize:9, color:T.muted }}>protein</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:15, fontWeight:700, color:T.green }}>${meal.costPerServe?.toFixed(0)||"?"}</div>
                      <div style={{ fontSize:9, color:T.muted }}>NZD/serve</div>
                    </div>
                  </div>
                </div>
                {/* Recipe accordion */}
                <details style={{ padding:"10px 14px" }} onToggle={e => { if (e.target.open && !meal.recipe && generatingRecipe !== meal.id) generateRecipe(meal); }}>
                  <summary style={{ fontSize:11, fontWeight:600, color:T.blue, cursor:"pointer", listStyle:"none" }}>
                    📋 View recipe & ingredients
                  </summary>
                  <div style={{ marginTop:10 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:T.muted, marginBottom:6 }}>INGREDIENTS (2 serves)</div>
                    {(meal.ingredients||[]).map((ing,i)=>(
                      <div key={i} style={{ fontSize:11, color:T.text, padding:"2px 0" }}>• {ing.name} — {ing.qty} <span style={{ fontSize:9, color:T.muted }}>({ing.type})</span></div>
                    ))}
                    <div style={{ fontSize:11, fontWeight:600, color:T.muted, marginBottom:6, marginTop:12 }}>RECIPE</div>
                    {generatingRecipe === meal.id && <div style={{ fontSize:12, color:T.blue }}>⏳ Generating recipe...</div>}
                    {!meal.recipe && generatingRecipe !== meal.id && <div style={{ fontSize:12, color:T.muted }}>Tap to load recipe</div>}
                    {meal.recipe && <div style={{ fontSize:12, color:T.text, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{meal.recipe}</div>}
                  </div>
                </details>
                {/* Actions */}
                <div style={{ display:"flex", gap:8, padding:"8px 14px 12px" }}>
                  <button onClick={()=>logMealToCalories(meal)} style={{ flex:1, padding:"8px", borderRadius:9, background:`${T.blue}18`, border:`1px solid ${T.blue}44`, color:T.blue, fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>+ Log calories</button>
                  <button onClick={()=>markCooked(meal)} style={{ flex:1, padding:"8px", borderRadius:9, background:`${T.green}18`, border:`1px solid ${T.green}44`, color:T.green, fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>✓ Cooked it</button>
                  <button onClick={()=>setRatingTarget(meal)} style={{ padding:"8px 12px", borderRadius:9, background:`${T.gold}18`, border:`1px solid ${T.gold}44`, color:T.gold, fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>⭐</button>
                  <button onClick={()=>{ if(window.confirm(`Remove "${meal.name}" from your meal library?`)) setMealLibrary(prev=>prev.filter(m=>m.id!==meal.id)); }} style={{ padding:"8px 12px", borderRadius:9, background:`${T.accent}11`, border:`1px solid ${T.accent}33`, color:T.accent, fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PANTRY TAB ── */}
      {mealView==="pantry" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:T.card, borderRadius:14, padding:14, border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>Update Pantry via Photo</div>
            <div style={{ fontSize:11, color:T.muted, marginBottom:10, lineHeight:1.5 }}>
              Take a photo of your fridge, pantry or groceries. TARS will identify items and tag them as staples (never auto-removed) or fresh (removed when you cook a meal).
            </div>
            <label style={{ display:"block", border:`2px dashed ${T.border}`, borderRadius:12, padding:"20px", textAlign:"center", cursor:"pointer", marginBottom:8 }}>
              <div style={{ fontSize:24, marginBottom:4 }}>📷</div>
              <div style={{ fontSize:12, fontWeight:600, color:T.text }}>Take or upload a photo</div>
              <div style={{ fontSize:10, color:T.muted }}>Fridge, pantry shelf, or grocery bag</div>
              <input type="file" accept="image/*" capture="environment" onChange={async e=>{ const f=e.target.files?.[0]; if(f) await processPantryPhoto(f); e.target.value=""; }} style={{ display:"none" }} />
            </label>
            {pantryProcessing && <div style={{ textAlign:"center", fontSize:12, color:T.blue, padding:"8px 0" }}>⏳ Reading photo…</div>}
          </div>

          {/* Add manually */}
          <div style={{ background:T.card, borderRadius:14, padding:14, border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>Add Item Manually</div>
            <div style={{ display:"flex", gap:8 }}>
              <input value={pantryInput} onChange={e=>setPantryInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&pantryInput.trim()){ setPantry(prev=>[...prev,{id:Date.now(),name:pantryInput.trim(),type:"fresh",status:"have",qty:"—",cat:"Other"}]); setPantryInput(""); }}} placeholder="Item name..." style={{ flex:1, padding:"9px 12px", borderRadius:9, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none" }} />
              <button onClick={()=>{ if(pantryInput.trim()){ setPantry(prev=>[...prev,{id:Date.now(),name:pantryInput.trim(),type:"fresh",status:"have",qty:"—",cat:"Other"}]); setPantryInput(""); }}} style={{ padding:"9px 14px", borderRadius:9, background:T.blue, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>Add</button>
            </div>
          </div>

          {/* Pantry list */}
          {["staple","fresh"].map(type => {
            const items = pantry.filter(p=>p.type===type);
            if (items.length === 0) return null;
            return (
              <div key={type} style={{ background:T.card, borderRadius:14, padding:14, border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.muted, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.05em" }}>
                  {type === "staple" ? "🫙 Staples (never auto-removed)" : "🥩 Fresh items (removed when you cook)"}
                </div>
                {items.map(item=>(
                  <div key={item.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:`1px solid ${T.border}` }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{item.name}</div>
                      <div style={{ fontSize:10, color:T.muted }}>{item.qty} · {item.cat}</div>
                    </div>
                    <button onClick={()=>setPantry(prev=>prev.map(p=>p.id===item.id?{...p,type:p.type==="staple"?"fresh":"staple"}:p))} style={{ fontSize:9, padding:"3px 7px", borderRadius:6, border:`1px solid ${T.border}`, background:T.elevated, color:T.muted, cursor:"pointer", fontFamily:"inherit" }}>
                      {item.type==="staple"?"→ fresh":"→ staple"}
                    </button>
                    <button onClick={()=>{ if(window.confirm(`Remove "${item.name}" from pantry?`)) setPantry(prev=>prev.filter(p=>p.id!==item.id)); }} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:14, padding:"2px 4px" }}>✕</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {mealView==="history" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {mealLibrary.filter(m=>m.cooked||m.rating>0).length === 0 && (
            <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted, fontSize:13 }}>No cooking history yet. Cook a meal and rate it to see it here.</div>
          )}
          {mealLibrary.filter(m=>m.cooked||m.rating>0).map(meal=>(
            <div key={meal.id} style={{ background:T.card, borderRadius:14, padding:14, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:4 }}>{meal.name}</div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>
                Cooked {meal.cookedDates?.length||0} time{meal.cookedDates?.length!==1?"s":""}
                {meal.cookedDates?.length>0 ? ` · Last: ${meal.cookedDates[meal.cookedDates.length-1]}` : ""}
              </div>
              {meal.rating > 0 && (
                <div style={{ fontSize:13, marginBottom:4 }}>{"⭐".repeat(meal.rating)}{"☆".repeat(5-meal.rating)}</div>
              )}
              {meal.notes && <div style={{ fontSize:11, color:T.muted, fontStyle:"italic" }}>{meal.notes}</div>}
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <button onClick={()=>setRatingTarget(meal)} style={{ fontSize:11, padding:"6px 12px", borderRadius:8, border:`1px solid ${T.gold}44`, background:`${T.gold}18`, color:T.gold, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>Rate / edit</button>
                <button onClick={()=>logMealToCalories(meal)} style={{ fontSize:11, padding:"6px 12px", borderRadius:8, border:`1px solid ${T.blue}44`, background:`${T.blue}18`, color:T.blue, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>+ Log calories</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── RATING MODAL ── */}
      {ratingTarget && (
        <div style={{ position:"fixed", inset:0, background:"#000a", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={()=>setRatingTarget(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:T.card, borderRadius:"20px 20px 0 0", padding:"24px 20px 40px", width:"100%", maxWidth:480, margin:"0 auto" }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:4 }}>Rate this meal</div>
            <div style={{ fontSize:12, color:T.muted, marginBottom:16 }}>{ratingTarget.name}</div>
            <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:16 }}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setRatingValue(n)} style={{ fontSize:28, background:"none", border:"none", cursor:"pointer", opacity:n<=ratingValue?1:0.3 }}>⭐</button>
              ))}
            </div>
            <textarea value={ratingNotes} onChange={e=>setRatingNotes(e.target.value)} placeholder="Notes (optional) — what worked, what you'd change, cook again?" rows={3}
              style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none", resize:"none", boxSizing:"border-box", marginBottom:12 }} />
            <button onClick={saveRating} style={{ width:"100%", padding:"11px", borderRadius:10, background:T.green, color:"white", fontWeight:700, fontSize:14, border:"none", cursor:"pointer", fontFamily:"inherit" }}>Save rating</button>
          </div>
        </div>
      )}
    </div>
  );
}


function getRotationInfo() {
  const start = new Date(USER.rotation.start);
  const now = new Date();
  const daysDiff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const cycleLen = (USER.rotation.weeksOn + USER.rotation.weeksOff) * 7;
  const dayInCycle = daysDiff % cycleLen;
  const onDays = USER.rotation.weeksOn * 7;
  const isOn = dayInCycle < onDays;
  const daysLeft = isOn ? onDays - dayInCycle : cycleLen - dayInCycle;
  return { isOn, daysLeft, phase: isOn ? "On Rotation" : "Off Rotation" };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-NZ", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
}

function getTARSQuip(rotation) {
  const quips = rotation.isOn
    ? [`${rotation.daysLeft} days until shore leave. The fridge will miss you.`,
       `Rotation day ${56 - rotation.daysLeft} of 56. Hull integrity: nominal.`,
       `${rotation.daysLeft} days remaining. I've calculated the exact number of protein shakes needed.`]
    : [`${rotation.daysLeft} days of freedom remaining. Use them wisely.`,
       `Off rotation. Gym has no excuses now.`,
       `${rotation.daysLeft} days until next rotation. I suggest not spending them all on the couch.`];
  return quips[new Date().getDate() % quips.length];
}

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Icon = ({ name, size=22, color=T.text }) => {
  const p = { fill:"none", stroke:color, strokeWidth:"2", strokeLinecap:"round", strokeLinejoin:"round" };
  const icons = {
    home:     <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    health:   <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
    tasks:    <svg width={size} height={size} viewBox="0 0 24 24" {...p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    calendar: <svg width={size} height={size} viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    finance:  <svg width={size} height={size} viewBox="0 0 24 24" {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    work:     <svg width={size} height={size} viewBox="0 0 24 24" {...p}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="12"/></svg>,
    tars:     <svg width={size} height={size} viewBox="0 0 24 24" {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="9" y2="9"/><line x1="15" y1="9" x2="15" y2="9"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
    mic:      <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
    plane:    <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>,
    check:    <svg width={size} height={size} viewBox="0 0 24 24" {...{...p,strokeWidth:"2.5"}}><polyline points="20 6 9 17 4 12"/></svg>,
    plus:     <svg width={size} height={size} viewBox="0 0 24 24" {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    trash:    <svg width={size} height={size} viewBox="0 0 24 24" {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
    back:     <svg width={size} height={size} viewBox="0 0 24 24" {...p}><polyline points="15 18 9 12 15 6"/></svg>,
    weight:   <svg width={size} height={size} viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
    pill:     <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M10.5 20H4a2 2 0 01-2-2V6a2 2 0 012-2h16a2 2 0 012 2v7"/><path d="M16 19h6"/><path d="M19 16v6"/></svg>,
    run:      <svg width={size} height={size} viewBox="0 0 24 24" {...p}><circle cx="13" cy="4" r="2"/><path d="M7.7 22l1.3-5L12 14l1-4"/><path d="M9.1 9.1L6 12H2"/><path d="M14.5 9.5L18 8l1 4-4 1"/></svg>,
    meals:    <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
    projects: <svg width={size} height={size} viewBox="0 0 24 24" {...p}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  };
  return icons[name] || <span>{name}</span>;
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function SectionHeader({ title, onBack }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 20px", borderBottom:`1px solid ${T.border}` }}>
      <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", padding:4, color:T.muted, display:"flex" }}>
        <Icon name="back" size={20} color={T.muted} />
      </button>
      <div style={{ fontSize:17, fontWeight:700, color:T.text }}>{title}</div>
    </div>
  );
}

function Card({ children, style={} }) {
  return <div style={{ background:T.card, borderRadius:16, padding:"14px 16px", border:`1px solid ${T.border}`, ...style }}>{children}</div>;
}

function SectionLabel({ children }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:T.muted, textTransform:"uppercase", marginBottom:10, marginTop:4 }}>{children}</div>;
}

function SubTab({ tabs, active, onChange }) {
  return (
    <div style={{ display:"flex", gap:0, background:T.elevated, borderRadius:12, padding:3, marginBottom:16 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex:1, padding:"8px 4px", borderRadius:9, border:"none", cursor:"pointer",
          background: active===t.id ? T.card : "transparent",
          color: active===t.id ? T.text : T.muted,
          fontSize:12, fontWeight:600, fontFamily:"inherit",
          transition:"all 0.15s",
        }}>{t.label}</button>
      ))}
    </div>
  );
}

function ProgressBar({ value, min, max, baseline, color }) {
  const range = max - min;
  const safeMin = min - range * 0.3;
  const safeMax = max + range * 0.3;
  const total = safeMax - safeMin;
  const pct = v => Math.min(100, Math.max(0, ((v - safeMin) / total) * 100));
  return (
    <div style={{ position:"relative", height:8, background:T.elevated, borderRadius:999, margin:"8px 0 4px" }}>
      <div style={{ position:"absolute", height:8, borderRadius:999, opacity:0.25, background:color, left:`${pct(min)}%`, width:`${pct(max)-pct(min)}%` }} />
      <div style={{ position:"absolute", top:0, width:2, height:8, background:T.muted, opacity:0.5, left:`${pct(baseline)}%` }} />
      <div style={{ position:"absolute", top:"50%", transform:"translateY(-50%)", width:12, height:12, borderRadius:"50%", border:"2px solid white", background:color, boxShadow:"0 1px 4px rgba(0,0,0,0.4)", left:`calc(${pct(value)}% - 6px)` }} />
    </div>
  );
}

function MetricCard({ label, value, baseline, unit, target }) {
  const atTarget = value >= target.min && value <= target.max;
  const improved = label === "Muscle" ? value >= baseline : value < baseline;
  const badge = atTarget ? { text:"At target", bg:"#dcfce722", color:T.green } : improved ? { text:"Improving", bg:"#fef9c322", color:T.gold } : { text:"Baseline", bg:"#fee2e222", color:T.accent };
  return (
    <Card>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
        <span style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</span>
        <span style={{ fontSize:9, padding:"2px 7px", borderRadius:999, fontWeight:700, background:badge.bg, color:badge.color }}>{badge.text}</span>
      </div>
      <div style={{ fontSize:24, fontWeight:800, color:T.text }}>{value}<span style={{ fontSize:12, color:T.muted, fontWeight:400 }}> {unit}</span></div>
      <ProgressBar value={value} min={target.min} max={target.max} baseline={baseline} color={target.color} />
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:T.muted }}>
        <span>Baseline: {baseline}{unit}</span>
        <span>Target: {target.label}</span>
      </div>
    </Card>
  );
}

// ─── STAT PILL ────────────────────────────────────────────────────────────────
function StatPill({ icon, label, value, color=T.blue }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, background:T.elevated, borderRadius:10, padding:"7px 12px", border:`1px solid ${T.border}` }}>
      <span style={{ color }}>{icon}</span>
      <div>
        <div style={{ fontSize:10, color:T.muted, lineHeight:1 }}>{label}</div>
        <div style={{ fontSize:13, fontWeight:700, color:T.text, lineHeight:1.3 }}>{value}</div>
      </div>
    </div>
  );
}

// ─── MODULE TILE ──────────────────────────────────────────────────────────────
function ModuleTile({ icon, label, sublabel, accent, onClick, badge }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background:hov?T.elevated:T.card, borderRadius:16, padding:"18px 14px", border:`1px solid ${hov?accent:T.border}`, cursor:"pointer", transition:"all 0.18s", position:"relative", display:"flex", flexDirection:"column", gap:10, boxShadow:hov?`0 8px 24px rgba(0,0,0,0.3)`:"none" }}>
      {badge && <div style={{ position:"absolute", top:10, right:10, background:T.accent, color:"white", fontSize:9, fontWeight:700, borderRadius:999, padding:"2px 6px" }}>{badge}</div>}
      <div style={{ width:38, height:38, borderRadius:12, background:`${accent}18`, display:"flex", alignItems:"center", justifyContent:"center", border:`1px solid ${accent}33` }}>
        <Icon name={icon} size={19} color={accent} />
      </div>
      <div>
        <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{label}</div>
        <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{sublabel}</div>
      </div>
    </div>
  );
}

// ─── COMING SOON ─────────────────────────────────────────────────────────────
function ComingSoon({ label, icon, accent, onBack }) {
  return (
    <div>
      <SectionHeader title={label} onBack={onBack} />
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"55vh", gap:16, padding:32 }}>
        <div style={{ width:64, height:64, borderRadius:20, background:`${accent}18`, border:`1px solid ${accent}33`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Icon name={icon} size={30} color={accent} />
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:18, fontWeight:700, color:T.text, marginBottom:6 }}>{label}</div>
          <div style={{ fontSize:13, color:T.muted, lineHeight:1.6 }}>Coming soon — we're building it together.</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TO DO SCREEN ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const CATS = ["All", "Health", "Admin", "Work", "Home", "Shopping", "Entertainment"];
const CAT_COLORS = { Health:T.accent, Admin:T.blue, Work:T.gold, Home:T.green, Shopping:T.purple, Entertainment:"#fb923c" };
const PRIORITY_COLORS = { high:T.accent, med:T.gold, low:T.green };

function TodoScreen({ tasks, setTasks, onBack }) {
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("active");
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState({ text:"", cat:"Admin", priority:"med", due:"" });

  const filtered = tasks.filter(t => {
    const catOk = filterCat === "All" || t.cat === filterCat;
    const statusOk = filterStatus === "all" || (filterStatus === "active" ? !t.done : t.done);
    return catOk && statusOk;
  });

  const toggle = (id) => setTasks(prev => prev.map(t => t.id === id ? {...t, done:!t.done} : t));
  const remove = (id) => setTasks(prev => prev.filter(t => t.id !== id));
  const add = () => {
    if (!newTask.text.trim()) return;
    setTasks(prev => [...prev, { ...newTask, id:Date.now(), done:false }]);
    setNewTask({ text:"", cat:"Admin", priority:"med", due:"" });
    setAdding(false);
  };

  const pending = tasks.filter(t => !t.done).length;

  return (
    <div>
      <SectionHeader title="To Do" onBack={onBack} />
      <div style={{ padding:"16px 16px 0" }}>

        {/* Summary */}
        <div style={{ display:"flex", gap:10, marginBottom:16 }}>
          {[
            { label:"Pending",   value:pending,                    color:T.accent },
            { label:"Done today",value:tasks.filter(t=>t.done).length, color:T.green },
            { label:"Total",     value:tasks.length,               color:T.blue },
          ].map(s => (
            <div key={s.label} style={{ flex:1, background:T.card, borderRadius:12, padding:"10px 12px", border:`1px solid ${T.border}`, textAlign:"center" }}>
              <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:10, color:T.muted }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Status filter */}
        <SubTab
          tabs={[{id:"active",label:"Active"},{id:"done",label:"Done"},{id:"all",label:"All"}]}
          active={filterStatus} onChange={setFilterStatus}
        />

        {/* Category pills */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingBottom:12, marginBottom:4 }}>
          {CATS.map(c => (
            <button key={c} onClick={() => setFilterCat(c)} style={{
              padding:"5px 12px", borderRadius:999, border:"none", cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit",
              fontSize:11, fontWeight:600,
              background: filterCat===c ? (CAT_COLORS[c]||T.blue) : T.elevated,
              color: filterCat===c ? "white" : T.muted,
              transition:"all 0.15s",
            }}>{c}</button>
          ))}
        </div>

        {/* Task list */}
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign:"center", padding:"32px 0", color:T.muted, fontSize:13 }}>No tasks here 👌</div>
          )}
          {filtered.map(task => (
            <div key={task.id} style={{ background:T.card, borderRadius:12, padding:"12px 14px", border:`1px solid ${T.border}`, display:"flex", alignItems:"flex-start", gap:10 }}>
              <div onClick={() => toggle(task.id)} style={{
                width:20, height:20, borderRadius:6, flexShrink:0, marginTop:1,
                border:`2px solid ${task.done ? T.green : T.border}`,
                background: task.done ? T.green : "transparent",
                display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.15s",
              }}>
                {task.done && <Icon name="check" size={11} color="white" />}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:task.done?T.muted:T.text, textDecoration:task.done?"line-through":"none" }}>{task.text}</div>
                <div style={{ display:"flex", gap:6, marginTop:5, flexWrap:"wrap" }}>
                  <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:999, background:`${CAT_COLORS[task.cat]||T.blue}22`, color:CAT_COLORS[task.cat]||T.blue }}>{task.cat}</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:999, background:`${PRIORITY_COLORS[task.priority]}22`, color:PRIORITY_COLORS[task.priority] }}>{task.priority}</span>
                  {task.due && <span style={{ fontSize:9, color:T.muted }}>{task.due}</span>}
                </div>
              </div>
              <button onClick={() => { if(window.confirm(`Delete task "${task.text}"?`)) remove(task.id); }} style={{ background:"none", border:"none", cursor:"pointer", padding:2, opacity:0.4 }}>
                <Icon name="trash" size={15} color={T.muted} />
              </button>
            </div>
          ))}
        </div>

        {/* Add task */}
        {adding ? (
          <Card style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:10 }}>New Task</div>
            <input value={newTask.text} onChange={e=>setNewTask(p=>({...p,text:e.target.value}))}
              placeholder="What needs doing?" onKeyDown={e=>e.key==="Enter"&&add()}
              style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:13, fontFamily:"inherit", marginBottom:8, outline:"none" }} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Category</div>
                <select value={newTask.cat} onChange={e=>setNewTask(p=>({...p,cat:e.target.value}))}
                  style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:12, fontFamily:"inherit" }}>
                  {CATS.filter(c=>c!=="All").map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Priority</div>
                <select value={newTask.priority} onChange={e=>setNewTask(p=>({...p,priority:e.target.value}))}
                  style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:12, fontFamily:"inherit" }}>
                  <option value="high">High</option>
                  <option value="med">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <input value={newTask.due} onChange={e=>setNewTask(p=>({...p,due:e.target.value}))}
              placeholder="Due date (optional)" type="date"
              style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:13, fontFamily:"inherit", marginBottom:10, outline:"none" }} />
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={add} style={{ flex:1, padding:"10px", borderRadius:10, background:T.green, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>Add Task</button>
              <button onClick={()=>setAdding(false)} style={{ padding:"10px 16px", borderRadius:10, background:T.elevated, color:T.muted, fontWeight:700, fontSize:13, border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
            </div>
          </Card>
        ) : (
          <button onClick={()=>setAdding(true)} style={{ width:"100%", padding:"12px", borderRadius:12, background:T.elevated, border:`1px solid ${T.border}`, color:T.blue, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginBottom:16 }}>
            <Icon name="plus" size={15} color={T.blue} /> New Task
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MEAL REVIEW MODAL ───────────────────────────────────────────────────────
function MealReviewModal({ meal, onSave, onClose }) {
  const [rating, setRating] = useState(meal.rating||0);
  const [cookAgain, setCookAgain] = useState(meal.cookAgain||null);
  const [notes, setNotes] = useState(meal.notes||"");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:200, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:T.card, borderRadius:"20px 20px 0 0", padding:"20px 20px 40px", width:"100%", maxWidth:480, margin:"0 auto" }}>
        <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:4 }}>{meal.name}</div>
        <div style={{ fontSize:11, color:T.muted, marginBottom:14 }}>Rate this meal</div>
        <div style={{ display:"flex", gap:6, marginBottom:14 }}>
          {[1,2,3,4,5].map(n=>(
            <span key={n} onClick={()=>setRating(n)} style={{ fontSize:26, cursor:"pointer", opacity:rating>=n?1:0.25, transition:"opacity 0.1s" }}>★</span>
          ))}
        </div>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes — taste, tweaks, what you'd change…" rows={2}
          style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:12, fontFamily:"inherit", resize:"none", outline:"none", marginBottom:10, boxSizing:"border-box" }} />
        <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
          <div style={{ fontSize:12, color:T.muted, flex:1 }}>Cook again?</div>
          {["yes","no"].map(v=>(
            <button key={v} onClick={()=>setCookAgain(v)} style={{ padding:"6px 16px", borderRadius:999, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700,
              background:cookAgain===v?(v==="yes"?`${T.green}33`:`${T.accent}33`):T.elevated,
              color:cookAgain===v?(v==="yes"?T.green:T.accent):T.muted }}>
              {v==="yes"?"👍 Yes":"👎 No"}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>onSave(rating,cookAgain,notes)} style={{ flex:1, padding:"11px", borderRadius:10, background:T.green, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>Save Review</button>
          <button onClick={onClose} style={{ padding:"11px 16px", borderRadius:10, background:T.elevated, color:T.muted, fontWeight:700, fontSize:13, border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}


function HealthScreen({ onBack, entries, setEntries, calLog, setCalLog }) {
  const [tab, setTab] = useState("overview");
  // entries and calLog now passed in from LifeApp (TARS can write to them)
  const [suppChecked, setSuppChecked] = useState({});
  const [form, setForm] = useState({ date:"", weight:"", bodyFat:"", fatMass:"", muscle:"", bp:"" });

    // Calorie tracking state
  const today = new Date().toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"});
  // calLog state now managed by LifeApp
    const [calForm, setCalForm] = useState({ name:"", kcal:"", protein:"" });
  const [calView, setCalView] = useState("today"); // today | history

  const todayEntries = calLog[today] || [];
  const todayKcal = todayEntries.reduce((s,e)=>s+e.kcal,0);
  const todayProtein = todayEntries.reduce((s,e)=>s+e.protein,0);

  const addCalEntry = () => {
    if (!calForm.name || !calForm.kcal) return;
    const entry = { id:Date.now(), name:calForm.name, kcal:parseInt(calForm.kcal)||0, protein:parseInt(calForm.protein)||0, time:new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}) };
    setCalLog(prev => ({ ...prev, [today]: [...(prev[today]||[]), entry] }));
    setCalForm({ name:"", kcal:"", protein:"" });
  };

  const removeCalEntry = (id) => {
    setCalLog(prev => ({ ...prev, [today]: prev[today].filter(e=>e.id!==id) }));
  };


  const toggleSupp = (id) => setSuppChecked(p => ({...p, [id]:!p[id]}));
  const latest = entries[entries.length - 1];
  const addEntry = () => {
    if (!form.date || !form.weight) return;
    const l = entries[entries.length-1];
    const d = new Date(form.date);
    setEntries(prev => [...prev, {
      date: d.toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"}),
      weight:  parseFloat(form.weight)||l.weight,
      bodyFat: parseFloat(form.bodyFat)||l.bodyFat,
      fatMass: parseFloat(form.fatMass)||l.fatMass,
      muscle:  parseFloat(form.muscle)||l.muscle,
      bp:      form.bp||l.bp,
    }]);
    setForm({ date:"", weight:"", bodyFat:"", fatMass:"", muscle:"", bp:"" });
  };


  // Steps & sleep state
  const [stepsLog, setStepsLog] = useState({});
  const [stepsForm, setStepsForm] = useState({ steps:"", sleep:"" });
  const todayActivity = stepsLog[today] || null;

  const saveActivity = () => {
    if (!stepsForm.steps && !stepsForm.sleep) return;
    setStepsLog(prev => ({ ...prev, [today]:{ steps:parseInt(stepsForm.steps)||0, sleep:stepsForm.sleep||"" } }));
    setStepsForm({ steps:"", sleep:"" });
  };

  const healthTabs = [
    {id:"overview",label:"Overview"},{id:"trends",label:"Trends"},
    {id:"history",label:"History"},{id:"activity",label:"Activity"},
    {id:"calories",label:"Calories"},{id:"supplements",label:"Supps"},
    {id:"exercise",label:"Exercise"},{id:"meal-planning",label:"Meal Planning"},
  ];

  return (
    <div>
      <SectionHeader title="Health" onBack={onBack} />

      {/* Mini header stats */}
      <div style={{ padding:"12px 16px", background:T.elevated, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", gap:16 }}>
          {[
            { label:"Lost so far", value:`${(USER.health.weight - latest.weight).toFixed(1)} kg`, color:T.green },
            { label:"To target",   value:`${Math.max(0, latest.weight - USER.health.target).toFixed(1)} kg`, color:T.accent },
            { label:"Body fat",    value:`${latest.bodyFat}%`, color:latest.bodyFat < USER.health.bodyFat ? T.green : T.muted },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:10, color:T.muted }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sub tabs */}
      <div style={{ padding:"12px 16px 0" }}>
        <div style={{ display:"flex", gap:0, flexWrap:"wrap", marginBottom:16 }}>
          {healthTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:"8px 14px", border:"none", background:"none", cursor:"pointer", whiteSpace:"nowrap",
              fontSize:12, fontWeight:600, fontFamily:"inherit",
              color: tab===t.id ? T.accent : T.muted,
              borderBottom: tab===t.id ? `2px solid ${T.accent}` : "2px solid transparent",
              transition:"all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab==="overview" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <MetricCard label="Weight"   value={latest.weight}  baseline={USER.health.weight}  unit="kg" target={HEALTH_TARGETS.weight} />
              <MetricCard label="Body Fat" value={latest.bodyFat} baseline={USER.health.bodyFat} unit="%" target={HEALTH_TARGETS.bodyFat} />
              <MetricCard label="Fat Mass" value={latest.fatMass} baseline={USER.health.fatMass} unit="kg" target={HEALTH_TARGETS.fatMass} />
              <MetricCard label="Muscle"   value={latest.muscle}  baseline={USER.health.muscle}  unit="kg" target={HEALTH_TARGETS.muscle} />
            </div>
            <Card>
              <SectionLabel>Vitals</SectionLabel>
              <div style={{ display:"flex", gap:24 }}>
                <div><div style={{ fontSize:20, fontWeight:700, color:T.text }}>{latest.bp}</div><div style={{ fontSize:11, color:T.muted }}>BP · medicated</div></div>
                <div><div style={{ fontSize:20, fontWeight:700, color:T.text }}>76 bpm</div><div style={{ fontSize:11, color:T.muted }}>Resting HR</div></div>
              </div>
            </Card>
            <Card>
              <SectionLabel>Daily Nutrition Targets</SectionLabel>
              {[{l:"Calories",v:"1,900–2,000 kcal",s:"~500 kcal deficit"},{l:"Protein",v:"140–160g",s:"1.6g × bodyweight"}].map(n=>(
                <div key={n.l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div><div style={{ fontSize:13, fontWeight:600, color:T.text }}>{n.l}</div><div style={{ fontSize:11, color:T.muted }}>{n.s}</div></div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.blue }}>{n.v}</div>
                </div>
              ))}
            </Card>
            <Card>
              <SectionLabel>Phase</SectionLabel>
              <div style={{ display:"flex", gap:10, opacity:1 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:T.blue, marginTop:5, flexShrink:0 }} />
                <div><div style={{ fontSize:13, fontWeight:700, color:T.text }}>Phase 1 — Weeks 1–6</div><div style={{ fontSize:12, color:T.muted, marginTop:2 }}>Daily walking · 3×/week training · Protein focus</div></div>
              </div>
            </Card>

          </div>
        )}

        {/* HISTORY */}
        {tab==="history" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:`${T.blue}18`, borderRadius:12, padding:12, fontSize:12, color:T.blue, border:`1px solid ${T.blue}33` }}>
              ⌚ Upload a Samsung Health screenshot via TARS (top bar) to auto-update your stats.
            </div>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:12 }}>Check-in History</div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead><tr>{["Date","Weight","Fat%","Fat kg","Muscle","BP"].map(h=><th key={h} style={{ textAlign:"left", padding:"4px 8px", color:T.muted, fontWeight:600, whiteSpace:"nowrap" }}>{h}</th>)}</tr></thead>
                  <tbody>{entries.map((e,i)=>(
                    <tr key={i} style={{ borderTop:`1px solid ${T.border}` }}>
                      <td style={{ padding:"6px 8px", fontWeight:i===0?700:400, color:T.text }}>{e.date}{i===0?" ★":""}</td>
                      <td style={{ padding:"6px 8px", color:T.text }}>{e.weight}</td>
                      <td style={{ padding:"6px 8px", color:T.text }}>{e.bodyFat}%</td>
                      <td style={{ padding:"6px 8px", color:T.text }}>{e.fatMass}</td>
                      <td style={{ padding:"6px 8px", color:T.text }}>{e.muscle}</td>
                      <td style={{ padding:"6px 8px", color:T.text }}>{e.bp}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TRENDS */}
        {tab==="trends" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:`${T.blue}18`, borderRadius:12, padding:12, fontSize:12, color:T.blue, border:`1px solid ${T.blue}33` }}>
              📈 Charts update as you add check-ins via Samsung Health screenshots. Baseline is 26 Jun 2026.
            </div>
            <TrendsCharts entries={entries} />
          </div>
        )}

        {/* ACTIVITY */}
        {tab==="activity" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

            {/* Today's activity */}
            <Card>
              <SectionLabel>Today — {today}</SectionLabel>
              {todayActivity ? (
                <div style={{ display:"flex", gap:20 }}>
                  <div>
                    <div style={{ fontSize:24, fontWeight:800, color:todayActivity.steps>=8000?T.green:todayActivity.steps>=5000?T.gold:T.accent }}>{todayActivity.steps?.toLocaleString()}</div>
                    <div style={{ fontSize:11, color:T.muted }}>steps · target 8–10k</div>
                    <div style={{ marginTop:6, height:6, background:T.elevated, borderRadius:999, width:120, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(100,(todayActivity.steps/10000)*100)}%`, background:todayActivity.steps>=8000?T.green:T.gold, borderRadius:999 }} />
                    </div>
                  </div>
                  {todayActivity.sleep && (
                    <div>
                      <div style={{ fontSize:24, fontWeight:800, color:T.blue }}>{todayActivity.sleep}</div>
                      <div style={{ fontSize:11, color:T.muted }}>sleep last night</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize:12, color:T.muted }}>Nothing logged yet today</div>
              )}
            </Card>

            {/* Log today */}
            <Card>
              <SectionLabel>Log Today's Activity</SectionLabel>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Steps</div>
                  <input type="number" value={stepsForm.steps} onChange={e=>setStepsForm(p=>({...p,steps:e.target.value}))}
                    placeholder="e.g. 8500"
                    style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Sleep</div>
                  <input type="text" value={stepsForm.sleep} onChange={e=>setStepsForm(p=>({...p,sleep:e.target.value}))}
                    placeholder="e.g. 7h 30m"
                    style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                </div>
              </div>
              <div style={{ fontSize:11, color:T.muted, marginBottom:8 }}>💡 Or send a Samsung Health screenshot to TARS via the top bar to auto-fill</div>
              <button onClick={saveActivity} style={{ width:"100%", padding:"10px", borderRadius:10, background:T.blue, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>Save</button>
            </Card>

            {/* Activity history */}
            <Card>
              <SectionLabel>Recent Activity</SectionLabel>
              {Object.entries(stepsLog).reverse().map(([date, data], i, arr)=>(
                <div key={date} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{date}</div>
                  <div style={{ display:"flex", gap:16 }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:12, fontWeight:700, color:data.steps>=8000?T.green:T.gold }}>{data.steps?.toLocaleString()} steps</div>
                    </div>
                    {data.sleep && <div style={{ fontSize:12, color:T.blue, fontWeight:600 }}>{data.sleep}</div>}
                  </div>
                </div>
              ))}
              {Object.keys(stepsLog).length===0 && <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"16px 0" }}>No activity logged yet</div>}
            </Card>

            {/* Weekly summary */}
            <WeeklySummary entries={entries} calLog={calLog} stepsLog={stepsLog} />
          </div>
        )}

        {/* SUPPLEMENTS */}
        {tab==="supplements" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[
              { time:"🍳 Breakfast", items:SUPPLEMENTS.filter(s=>s.when==="Breakfast") },
              { time:"🍽️ Dinner",    items:SUPPLEMENTS.filter(s=>s.when==="Dinner") },
              { time:"😴 Bedtime",   items:SUPPLEMENTS.filter(s=>s.when==="Bedtime") },
              { time:"🏋️ With meal", items:SUPPLEMENTS.filter(s=>s.when==="With meal") },
            ].map(group => group.items.length > 0 && (
              <Card key={group.time}>
                <SectionLabel>{group.time}</SectionLabel>
                {group.items.map(s => (
                  <div key={s.id} onClick={()=>toggleSupp(s.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:`1px solid ${T.border}`, cursor:"pointer" }}>
                    <div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${suppChecked[s.id]?T.green:T.border}`, background:suppChecked[s.id]?T.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
                      {suppChecked[s.id] && <Icon name="check" size={11} color="white" />}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:suppChecked[s.id]?T.muted:T.text, textDecoration:suppChecked[s.id]?"line-through":"none" }}>{s.name}</div>
                    </div>
                    <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:999,
                      background: s.phase==="Week 1"||s.phase==="Now" ? `${T.blue}22` : s.phase==="Week 3" ? `${T.gold}22` : `${T.purple}22`,
                      color: s.phase==="Week 1"||s.phase==="Now" ? T.blue : s.phase==="Week 3" ? T.gold : T.purple,
                    }}>{s.phase}</span>
                  </div>
                ))}
              </Card>
            ))}
            <div style={{ background:`${T.gold}18`, borderRadius:12, padding:12, fontSize:12, color:T.gold, border:`1px solid ${T.gold}33` }}>
              ⚠️ Introduce one new supplement at a time. Creatine after GP consultation.
            </div>
            <div style={{ background:`${T.accent}18`, borderRadius:12, padding:12, fontSize:12, color:T.accent, border:`1px solid ${T.accent}33` }}>
              🩺 Mention Ashwagandha & Creatine to your GP — mild interaction with Amlodipine.
            </div>
          </div>
        )}

        {/* EXERCISE */}
        {tab==="exercise" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:5 }}>
              {EXERCISE_PLAN.map(d=>(
                <div key={d.day} style={{ borderRadius:10, padding:"8px 4px", textAlign:"center", background:d.type==="training"?T.elevated:d.type==="walk"?`${T.blue}18`:T.card, border:`1px solid ${d.type==="training"?T.blue:T.border}` }}>
                  <div style={{ fontSize:10, fontWeight:700, color:d.type==="training"?T.blue:T.muted }}>{d.day}</div>
                  <div style={{ fontSize:16, marginTop:4 }}>{d.type==="training"?"💪":d.type==="walk"?"🚶":"😴"}</div>
                </div>
              ))}
            </div>
            <Card>
              <SectionLabel>Bodyweight Routine (3×/week)</SectionLabel>
              {EXERCISES.map((e,i)=>(
                <div key={i} style={{ display:"flex", gap:12, paddingBottom:12, marginBottom:i<EXERCISES.length-1?12:0, borderBottom:i<EXERCISES.length-1?`1px solid ${T.border}`:"none" }}>
                  <span style={{ fontSize:22, flexShrink:0 }}>{e.icon}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{e.name}</div>
                    <div style={{ fontSize:12, color:T.blue, fontWeight:600 }}>{e.detail}</div>
                    <div style={{ fontSize:11, color:T.muted }}>{e.muscles}</div>
                  </div>
                </div>
              ))}
            </Card>
            <Card>
              <SectionLabel>📺 Video Guides</SectionLabel>
              {[
                { title:"Nerd Fitness — Beginner Bodyweight Workout", sub:"Full routine: squats, push-ups, rows & plank · ~5 min", url:"https://www.youtube.com/results?search_query=nerd+fitness+beginner+bodyweight+workout" },
                { title:"Athlean-X — How To Do The Dead Bug", sub:"Most people do this wrong — worth watching first · ~3 min", url:"https://www.youtube.com/results?search_query=athlean-x+dead+bug+exercise+how+to" },
              ].map((v,i)=>(
                <a key={i} href={v.url} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:i===0?`1px solid ${T.border}`:"none", textDecoration:"none" }}>
                  <div style={{ width:34, height:34, background:"#ff0000", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <span style={{ color:"white", fontSize:13 }}>▶</span>
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{v.title}</div>
                    <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{v.sub}</div>
                  </div>
                </a>
              ))}
            </Card>
            <div style={{ background:`${T.green}18`, borderRadius:12, padding:12, fontSize:12, color:T.green, border:`1px solid ${T.green}33` }}>
              🎯 Target 8,000–10,000 steps on walk days. Keep sessions to 20–30 min.
            </div>
          </div>
        )}

        {/* CALORIES */}
        {tab==="calories" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <SubTab tabs={[{id:"today",label:"Today"},{id:"history",label:"History"}]} active={calView} onChange={setCalView} />

            {calView==="today" && (<>
              {/* Progress bars */}
              <Card>
                <SectionLabel>Today's Totals</SectionLabel>
                {[
                  { label:"Calories", current:todayKcal, target:2000, min:1900, color:T.blue, unit:"kcal" },
                  { label:"Protein",  current:todayProtein, target:160, min:140, color:T.accent, unit:"g" },
                ].map(bar => {
                  const pct = Math.min(100, (bar.current/bar.target)*100);
                  const over = bar.current > bar.target;
                  const inRange = bar.current >= bar.min && bar.current <= bar.target;
                  return (
                    <div key={bar.label} style={{ marginBottom:14 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:T.text }}>{bar.label}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:over?T.accent:inRange?T.green:T.blue }}>
                          {bar.current} / {bar.min}–{bar.target}{bar.unit}
                        </span>
                      </div>
                      <div style={{ height:8, background:T.elevated, borderRadius:999, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:over?T.accent:inRange?T.green:T.blue, borderRadius:999, transition:"width 0.3s" }} />
                      </div>
                      <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>
                        {over ? `${bar.current-bar.target}${bar.unit} over target` : `${bar.target-bar.current}${bar.unit} remaining`}
                      </div>
                    </div>
                  );
                })}
              </Card>

              {/* Add entry — AI powered */}
              <AICalLogger onAdd={(entry) => {
                setCalLog(prev => ({ ...prev, [today]: [...(prev[today]||[]), {...entry, id:Date.now(), time:new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"})} ] }));
              }} />

              {/* Today's log */}
              {todayEntries.length > 0 && (
                <Card>
                  <SectionLabel>Today's Log</SectionLabel>
                  {todayEntries.map((e,i)=>(
                    <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<todayEntries.length-1?`1px solid ${T.border}`:"none" }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{e.name}</div>
                        <div style={{ fontSize:11, color:T.muted }}>{e.time}</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:12, fontWeight:700, color:T.blue }}>{e.kcal} kcal</div>
                        <div style={{ fontSize:11, color:T.accent }}>{e.protein}g protein</div>
                      </div>
                      <button onClick={()=>removeCalEntry(e.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:2, opacity:0.4 }}>
                        <Icon name="trash" size={14} color={T.muted} />
                      </button>
                    </div>
                  ))}
                </Card>
              )}
            </>)}

            {calView==="history" && <CalHistory calLog={calLog} />}
          </div>
        )}

        {/* MEAL PLANNING */}
        {tab==="meal-planning" && (
          <MealPlanScreen calLog={calLog} setCalLog={setCalLog} todayLabel={today} appState={{}} />
        )}

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function HomeScreen({ onNavigate, tasks, onToggleTask, nextFlight, rotationInfo }) {
  const rot = rotationInfo || { isOn:false, phase:"Off Rotation", daysLeft:0 };
  const weightLeft = (USER.health.weight - USER.health.target).toFixed(1);
  const completedToday = tasks.filter(t=>t.done).length;
  const pendingHigh = tasks.filter(t=>!t.done && t.priority==="high").length;
  const flightDisplay = nextFlight ? nextFlight.title.split(" ")[0]+"→"+nextFlight.title.split("→").pop().trim() : "No flights";

  return (
    <div>
      {/* HERO */}
      <div style={{ background:`linear-gradient(160deg, ${T.elevated} 0%, ${T.bg} 100%)`, padding:"28px 20px 24px", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", color:T.muted, textTransform:"uppercase", marginBottom:8 }}>{formatDate()}</div>
        <div style={{ fontSize:26, fontWeight:800, color:T.text, lineHeight:1.2, marginBottom:4 }}>
          {getGreeting()}, <span style={{ color:T.accent }}>Neil.</span>
        </div>
        <div style={{ fontSize:12, color:T.muted, fontStyle:"italic", marginBottom:20, lineHeight:1.5 }}>
          <span style={{ color:T.blue, fontStyle:"normal", fontWeight:600 }}>TARS: </span>
          {rot.isOn
            ? `${rot.daysLeft} days until shore leave. Man of Steel won't sail itself — actually it might.`
            : nextFlight
            ? `${rot.daysLeft} days until next rotation. Flight to ${nextFlight.title.split("→").pop().trim()} coming up.`
            : `Off rotation. ${rot.daysLeft} days of freedom. Use them wisely.`}
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <StatPill icon={<Icon name="weight" size={13} color={T.blue}/>} label="Weight to target" value={`${weightLeft} kg`} color={T.blue} />
          <StatPill icon={<Icon name="plane" size={13} color={T.accent}/>} label="Next flight" value={nextFlight ? nextFlight.date.split("-").slice(1).reverse().join(" ") : "None booked"} color={nextFlight?T.accent:T.muted} />
          <StatPill icon="⚓" label={rot.phase} value={`${rot.daysLeft}d ${rot.isOn?"left":"to go"}`} color={rot.isOn?T.blue:T.green} />
        </div>
      </div>

      <div style={{ padding:"20px 16px" }}>
        {/* MODULE GRID */}
        <SectionLabel>Modules</SectionLabel>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
          <ModuleTile icon="health"   label="Health"    sublabel="Body & vitals"             accent={T.accent} onClick={()=>onNavigate("health")} />
          <ModuleTile icon="tasks"    label="To Do"     sublabel={`${completedToday}/${tasks.length} today`} accent={T.green}  onClick={()=>onNavigate("tasks")} badge={pendingHigh||null} />
          <ModuleTile icon="calendar" label="Calendar"  sublabel="Flights & rotation"        accent={T.gold}   onClick={()=>onNavigate("calendar")} />
          <ModuleTile icon="finance"  label="Finance"   sublabel="Budget & spending"         accent={T.purple} onClick={()=>onNavigate("finance")} />
          <ModuleTile icon="work"     label="Work"      sublabel="Certs & vessel log"        accent={T.blue}   onClick={()=>onNavigate("work")} />
          <ModuleTile icon="projects" label="Projects"  sublabel="Plan with TARS"            accent={T.green}  onClick={()=>onNavigate("projects")} />
        </div>

        {/* TODAY'S TASKS */}
        <SectionLabel>Today's tasks</SectionLabel>
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text }}>Tasks</div>
            <div style={{ fontSize:11, color:T.muted }}>{completedToday}/{tasks.length} done</div>
          </div>
          {tasks.filter(t=>t.priority==="high"||!t.done).slice(0,4).map(t=>(
            <div key={t.id} onClick={()=>onToggleTask(t.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${T.border}`, cursor:"pointer" }}>
              <div style={{ width:18, height:18, borderRadius:5, flexShrink:0, border:`2px solid ${t.done?T.green:T.border}`, background:t.done?T.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
                {t.done && <Icon name="check" size={11} color="white" />}
              </div>
              <span style={{ fontSize:12, color:t.done?T.muted:T.text, textDecoration:t.done?"line-through":"none", flex:1 }}>{t.text}</span>
              <span style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:999, background:`${CAT_COLORS[t.cat]||T.blue}22`, color:CAT_COLORS[t.cat]||T.blue }}>{t.cat}</span>
            </div>
          ))}
          <button onClick={()=>onNavigate("tasks")} style={{ marginTop:10, width:"100%", padding:"8px", borderRadius:8, background:"none", border:`1px solid ${T.border}`, color:T.muted, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
            View all tasks →
          </button>
        </Card>
      </div>
    </div>
  );
}

// ─── CALENDAR SCREEN ─────────────────────────────────────────────────────────
const EVENT_COLORS = {
  flight:   { bg:"#e94560", label:"✈️ Flight" },
  hotel:    { bg:"#f5a623", label:"🏨 Hotel" },
  rotation: { bg:"#1e3a5f", label:"⚓ Rotation" },
  reminder: { bg:"#4facde", label:"🔔 Reminder" },
  other:    { bg:"#a78bfa", label:"📌 Event" },
};

function getDayType(dateStr, rotationBlocks, calEvents) {
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const rotBlock = rotationBlocks.find(b => {
    const s = new Date(b.start); s.setHours(0,0,0,0);
    const e = new Date(b.end);   e.setHours(0,0,0,0);
    return d >= s && d <= e;
  });
  const inRotation = !!rotBlock;
  const isUnconfirmed = rotBlock?.notes?.includes("Unconfirmed") || false;
  const dayEvents = calEvents.filter(e => e.date === dateStr);
  const hasFlight = dayEvents.some(e=>e.type==="flight");
  const hasHotel  = dayEvents.some(e=>e.type==="hotel");
  return { inRotation, isUnconfirmed, hasFlight, hasHotel, events:dayEvents };
}

function CalendarScreen({ onBack, calEvents, rotationBlocks, addCalEvent, removeCalEvent, addRotation, removeRotation, tasks }) {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);
  const [calTab, setCalTab] = useState("month"); // month | add | rotation
  const [addForm, setAddForm] = useState({ type:"reminder", date:"", title:"", notes:"", time:"", endDate:"", location:"" });
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [rotForm, setRotForm] = useState({ start:"", end:"", notes:"" });

  const DAYS = ["Mo","Tu","We","Th","Fr","Sa","Su"];
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay  = new Date(viewYear, viewMonth+1, 0);
  // Monday-start offset
  const startOffset = (firstDay.getDay()+6)%7;
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  const todayStr = now.toISOString().split("T")[0];

  const prevMonth = () => { if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); };

  const toDateStr = (y,m,d) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadLoading(true); setUploadResult(null); setUploadError(null);
    try {
      const base64 = await new Promise((res,rej)=>{
        const r = new FileReader();
        r.onload = ()=>res(r.result.split(",")[1]);
        r.onerror = ()=>rej(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const isImage = file.type.startsWith("image/");
      const isPDF   = file.type==="application/pdf";
      const msgContent = isImage || isPDF
        ? [{ type: isPDF?"document":"image", source:{ type:"base64", media_type:file.type, data:base64 }},
           { type:"text", text:"Extract all travel information from this document. Find flights, hotels, and events." }]
        : [{ type:"text", text:`Extract travel info from this document content. File: ${file.name}` }];

      const text = await callClaude({
        system:`You extract travel information from uploaded documents. Return ONLY a JSON object with no markdown: {"events":[{"type":"flight|hotel|reminder|other","date":"YYYY-MM-DD","endDate":"YYYY-MM-DD or null","title":"short title","notes":"details","time":"HH:MM or null"}],"summary":"one sentence of what you found"} For flights: title = "SYD to LHR" style. For hotels: title = hotel name, endDate = checkout date. Dates MUST be in YYYY-MM-DD format.`,
        messages:[{ role:"user", content: msgContent }],
      });
      const clean = text.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(clean);
      setUploadResult(parsed);
    } catch(err) {
      setUploadError("Couldn't read that file — try a PDF, image or paste the text instead.");
    }
    setUploadLoading(false);
  };

  const confirmUpload = () => {
    if (!uploadResult?.events) return;
    uploadResult.events.forEach(ev => addCalEvent(ev));
    setUploadResult(null);
    setCalTab("month");
  };

  const addManualEvent = () => {
    if (!addForm.date || !addForm.title) return;
    addCalEvent({ type:addForm.type, date:addForm.date, endDate:addForm.endDate||null, title:addForm.title, notes:addForm.notes, time:addForm.time, location:addForm.location||"" });
    setAddForm({ type:"reminder", date:"", title:"", notes:"", time:"", endDate:"", location:"" });
    setCalTab("month");
  };

  const addRotBlock = () => {
    if (!rotForm.start || !rotForm.end) return;
    addRotation({ start:rotForm.start, end:rotForm.end, vessel:"Man of Steel", notes:rotForm.notes });
    setRotForm({ start:"", end:"", notes:"" });
    setCalTab("month");
  };

  const selectedDateStr = selectedDay ? toDateStr(viewYear, viewMonth, selectedDay) : null;
  const selectedInfo = selectedDateStr ? getDayType(selectedDateStr, rotationBlocks, calEvents) : null;
  const selectedTasks = selectedDateStr ? tasks.filter(t=>t.due===selectedDateStr) : [];

  const inputSt = { width:"100%", padding:"9px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:8 };

  return (
    <div>
      <SectionHeader title="Calendar" onBack={onBack} />

      {/* Month/Year nav */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", background:T.elevated, borderBottom:`1px solid ${T.border}`, gap:8 }}>
        <button onClick={prevMonth} style={{ background:"none", border:"none", cursor:"pointer", color:T.text, fontSize:22, padding:"0 4px", lineHeight:1 }}>‹</button>
        <div style={{ display:"flex", gap:8, flex:1, justifyContent:"center" }}>
          <select value={viewMonth} onChange={e=>setViewMonth(parseInt(e.target.value))}
            style={{ padding:"6px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.card, color:T.text, fontSize:13, fontWeight:700, fontFamily:"inherit", outline:"none", cursor:"pointer" }}>
            {MONTHS.map((m,i)=><option key={m} value={i}>{m}</option>)}
          </select>
          <select value={viewYear} onChange={e=>setViewYear(parseInt(e.target.value))}
            style={{ padding:"6px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.card, color:T.text, fontSize:13, fontWeight:700, fontFamily:"inherit", outline:"none", cursor:"pointer" }}>
            {Array.from({length:6},(_,i)=>now.getFullYear()-1+i).map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={nextMonth} style={{ background:"none", border:"none", cursor:"pointer", color:T.text, fontSize:22, padding:"0 4px", lineHeight:1 }}>›</button>
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:10, padding:"8px 16px", background:T.card, borderBottom:`1px solid ${T.border}`, flexWrap:"wrap" }}>
        {[
          {color:"#1e3a5f", label:"On Rotation"},
          {color:"#162440", label:"Unconfirmed"},
          {color:T.accent,  label:"Travel"},
          {color:T.gold,    label:"Hotel"},
          {color:T.blue,    label:"Reminder"},
        ].map(l=>(
          <div key={l.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:l.color, border:l.color==="#162440"?"1px dashed #4facde44":"none" }} />
            <span style={{ fontSize:10, color:T.muted }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ padding:"12px 10px" }}>
        {/* Day headers */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
          {DAYS.map(d=><div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:T.muted, padding:"4px 0" }}>{d}</div>)}
        </div>
        {/* Day cells */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
          {Array.from({length:totalCells},(_,i)=>{
            const dayNum = i - startOffset + 1;
            const valid  = dayNum >= 1 && dayNum <= lastDay.getDate();
            const dateStr = valid ? toDateStr(viewYear, viewMonth, dayNum) : null;
            const info    = dateStr ? getDayType(dateStr, rotationBlocks, calEvents) : null;
            const isToday = dateStr === todayStr;
            const isSel   = dateStr === selectedDateStr;
            const bg = !valid ? "transparent"
              : info?.hasFlight  ? T.accent
              : info?.hasHotel   ? T.gold
              : info?.inRotation && info?.isUnconfirmed ? "#162440"
              : info?.inRotation ? "#1e3a5f"
              : T.card;
            const hasEvents = info?.events?.length > 0;
            return (
              <div key={i} onClick={()=>valid&&setSelectedDay(dayNum===selectedDay?null:dayNum)}
                style={{ aspectRatio:"1", borderRadius:8, background:bg, border:isSel?`2px solid white`:isToday?`2px solid ${T.accent}`:`1px solid ${valid?T.border:"transparent"}`, cursor:valid?"pointer":"default", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", transition:"all 0.12s" }}>
                {valid && <>
                  <span style={{ fontSize:12, fontWeight:isToday||isSel?800:500, color: info?.hasFlight||info?.hasHotel ? "white" : info?.inRotation ? "#93c5fd" : T.text }}>{dayNum}</span>
                  {hasEvents && !info?.hasFlight && !info?.hasHotel && (
                    <div style={{ position:"absolute", bottom:3, display:"flex", gap:2 }}>
                      {info.events.slice(0,3).map((ev,ei)=>(
                        <div key={ei} style={{ width:4, height:4, borderRadius:"50%", background:EVENT_COLORS[ev.type]?.bg||T.muted }} />
                      ))}
                    </div>
                  )}
                </>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && selectedInfo && (
        <div style={{ margin:"0 10px 12px", background:T.card, borderRadius:14, padding:14, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:8 }}>
            {selectedDay} {MONTHS[viewMonth]} {viewYear}
            {selectedInfo.inRotation && (
              <span style={{ marginLeft:8, fontSize:10, fontWeight:700,
                color: selectedInfo.isUnconfirmed ? T.muted : "#93c5fd",
                background: selectedInfo.isUnconfirmed ? "#162440" : "#1e3a5f",
                padding:"2px 7px", borderRadius:999,
                border: selectedInfo.isUnconfirmed ? "1px dashed #4facde44" : "none"
              }}>
                {selectedInfo.isUnconfirmed ? "⚠️ Man of Steel (unconfirmed)" : "⚓ Man of Steel"}
              </span>
            )}
          </div>
          {selectedInfo.events.length===0 && selectedTasks.length===0 && (
            <div style={{ fontSize:12, color:T.muted }}>Nothing scheduled — tap + to add an event</div>
          )}
          {selectedInfo.events.map(ev=>(
            <div key={ev.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:EVENT_COLORS[ev.type]?.bg||T.muted, marginTop:4, flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{ev.title}</div>
                {ev.time && <div style={{ fontSize:11, color:T.muted }}>{ev.time}{ev.location ? ` · ${ev.location}` : ""}</div>}
                {ev.notes && <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{ev.notes}</div>}
                {ev.endDate && <div style={{ fontSize:10, color:T.gold }}>Until {ev.endDate}</div>}
              </div>
              <button onClick={()=>{ if(window.confirm(`Delete "${ev.title}"?`)) removeCalEvent(ev.id); }} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:14, padding:2 }}>✕</button>
            </div>
          ))}
          {selectedTasks.map(t=>(
            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", fontSize:12, color:T.muted }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:CAT_COLORS[t.cat]||T.blue }} />
              {t.text}
            </div>
          ))}
        </div>
      )}

      {/* Action tabs */}
      <div style={{ padding:"0 10px 16px" }}>
        <SubTab tabs={[{id:"add",label:"+ Event"},{id:"rotation",label:"⚓ Rotation"}]} active={calTab==="month"?null:calTab} onChange={v=>setCalTab(calTab===v?"month":v)} />

        {/* ADD EVENT */}
        {calTab==="add" && (
          <Card>
            <SectionLabel>Add Event</SectionLabel>
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Type</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {Object.entries(EVENT_COLORS).map(([type,c])=>(
                  <button key={type} onClick={()=>setAddForm(p=>({...p,type}))} style={{ padding:"5px 10px", borderRadius:999, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600, background:addForm.type===type?c.bg:T.elevated, color:addForm.type===type?"white":T.muted }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <input value={addForm.title} onChange={e=>setAddForm(p=>({...p,title:e.target.value}))} placeholder="Title" style={inputSt} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div><div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Date</div><input type="date" value={addForm.date} onChange={e=>setAddForm(p=>({...p,date:e.target.value}))} style={inputSt} /></div>
              <div><div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Time (optional)</div><input type="time" value={addForm.time} onChange={e=>setAddForm(p=>({...p,time:e.target.value}))} style={inputSt} /></div>
            </div>
            <div style={{ marginBottom:8 }}><div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Location (optional — leave blank for Christchurch/local time)</div><input value={addForm.location||""} onChange={e=>setAddForm(p=>({...p,location:e.target.value}))} placeholder="e.g. Brisbane" style={inputSt} /></div>
            {(addForm.type==="hotel"||addForm.type==="other") && (
              <div><div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>End date (optional)</div><input type="date" value={addForm.endDate} onChange={e=>setAddForm(p=>({...p,endDate:e.target.value}))} style={inputSt} /></div>
            )}
            <input value={addForm.notes} onChange={e=>setAddForm(p=>({...p,notes:e.target.value}))} placeholder="Notes (optional)" style={inputSt} />
            <button onClick={addManualEvent} style={{ width:"100%", padding:"10px", borderRadius:10, background:T.blue, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>Add to Calendar</button>
          </Card>
        )}

        {/* ROTATION */}
        {calTab==="rotation" && (
          <Card>
            <SectionLabel>Add Rotation Block</SectionLabel>
            <div style={{ fontSize:11, color:T.muted, marginBottom:10 }}>Set your Man of Steel rotation dates. These colour the calendar dark navy.</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div><div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Join date</div><input type="date" value={rotForm.start} onChange={e=>setRotForm(p=>({...p,start:e.target.value}))} style={inputSt} /></div>
              <div><div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Sign off date</div><input type="date" value={rotForm.end} onChange={e=>setRotForm(p=>({...p,end:e.target.value}))} style={inputSt} /></div>
            </div>
            <input value={rotForm.notes} onChange={e=>setRotForm(p=>({...p,notes:e.target.value}))} placeholder="Notes (optional)" style={inputSt} />
            <button onClick={addRotBlock} style={{ width:"100%", padding:"10px", borderRadius:10, background:"#1e3a5f", color:"#93c5fd", fontWeight:700, fontSize:13, border:`1px solid #2563eb44`, cursor:"pointer", fontFamily:"inherit", marginBottom:16 }}>Add Rotation</button>

            <SectionLabel>Current Rotations</SectionLabel>
            {rotationBlocks.map(b=>(
              <div key={b.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#93c5fd" }}>⚓ {b.vessel}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{b.start} → {b.end}</div>
                  {b.notes && <div style={{ fontSize:11, color:T.muted }}>{b.notes}</div>}
                </div>
                <button onClick={()=>{ if(window.confirm(`Delete this rotation block (${b.start} to ${b.end})?`)) removeRotation(b.id); }} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:14 }}>✕</button>
              </div>
            ))}
            {rotationBlocks.length===0 && <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"12px 0" }}>No rotations set yet</div>}
          </Card>
        )}

        {/* UPLOAD */}

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TARS SCREEN ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ─── TARS MEMORY SYSTEM ──────────────────────────────────────────────────────
const MEMORY_KEY = "tars_memory";
const MAX_MEMORY_CHARS = 4000;

function loadMemory() {
  try { return localStorage.getItem(MEMORY_KEY) || ""; }
  catch { return ""; }
}

function saveMemory(text) {
  try { localStorage.setItem(MEMORY_KEY, text.slice(0, MAX_MEMORY_CHARS)); }
  catch {}
}

async function summariseSession(messages, existingMemory) {
  const apiKey = getAnthropicKey();
  if (!apiKey || messages.length < 3) return existingMemory;

  const transcript = messages
    .filter(m => typeof m.content === "string")
    .map(m => `${m.role === "user" ? "Neil" : "TARS"}: ${m.content}`)
    .join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 600,
        system: `You are updating a persistent memory file for TARS, an AI assistant for Neil Newman-Hollis. 
Extract only genuinely new, specific, useful things learned about Neil from this conversation — preferences, patterns, things that made him laugh, frustrations, goals mentioned, habits observed, topics discussed. 
Write in plain sentences as notes TARS can use to feel more familiar with Neil next session.
Be specific and concrete. Skip generic health info already known. Skip anything already covered in existing memory.
Keep the total under 400 words. Return only the updated memory text, no preamble.`,
        messages: [{
          role: "user",
          content: `EXISTING MEMORY:\n${existingMemory || "None yet."}\n\nTODAY'S CONVERSATION:\n${transcript.slice(0, 3000)}\n\nUpdate the memory with anything genuinely new and useful learned today.`
        }]
      }),
    });
    if (!response.ok) return existingMemory;
    const data = await response.json();
    return data.content?.map(b => b.text || "").join("") || existingMemory;
  } catch { return existingMemory; }
}

// ─── MODULE REGISTRY ──────────────────────────────────────────────────────────
// This is the foundation of TARS's full app access. Every module Neil's data lives
// in is declared here once — its fields, and how to read/write it. TARS works against
// this registry with generic create/update/delete actions instead of needing bespoke
// "add_task", "add_certificate", "add_expense" style actions written by hand for every
// new feature. Adding a new module later (Work, Finance, certificates) means adding one
// entry here — TARS automatically gains the ability to read and write it.
//
// Each module needs: a getter (returns the live array from state) and a setter style
// (how new/updated/deleted records get written back). idField defaults to "id".
const MODULE_REGISTRY = {
  tasks: {
    label: "Tasks", idField: "id",
    fields: "id, text, cat (category), priority (low/med/high), due (date), done (boolean)",
  },
  calendar: {
    label: "Calendar events", idField: "id",
    fields: "id, type (reminder/flight/hotel/travel), title, date (YYYY-MM-DD), time (HH:MM, optional), location (city, optional — only for events outside Christchurch), notes",
  },
  health: {
    label: "Health check-ins", idField: null, // append-only log, no individual edit/delete by id — always adds a new entry
    fields: "date, weight (kg), bodyFat (%), fatMass (kg), muscle (kg), bp",
  },
  calorieLog: {
    label: "Calorie log", idField: "id", // nested under date key — handled specially
    fields: "id, name, kcal, protein (g), time — stored under today's date key",
  },
  vault: {
    label: "Document vault", idField: "id",
    fields: "id, name, docType, summary, uploadedAt — read-only via search_vault tool, not editable via create/update/delete",
  },
  // Placeholder modules — not yet built in the UI, but registered now so the pattern
  // is proven and TARS can be told about them ahead of time. When Work/Finance get
  // real screens, they slot into this same generic system with zero new action types.
  // certificates: { label: "Work certificates", idField: "id", fields: "id, name, issueDate, expiryDate, notes" },
  // expenses: { label: "Finance / expenses", idField: "id", fields: "id, description, amount, date, category" },
};

// ─── PROJECTS — TOPIC LIST SCREEN ──────────────────────────────────────────────
function ProjectsListScreen({ onBack, projects, setProjects, onOpenProject }) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const createProject = () => {
    const name = newName.trim();
    if (!name) return;
    const id = `proj_${Date.now()}`;
    setProjects(prev => [{ id, name, createdAt: new Date().toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"}), lastActive: Date.now() }, ...prev]);
    setNewName("");
    setCreating(false);
    onOpenProject(id);
  };

  const deleteProject = (id, name) => {
    if (!window.confirm(`Delete project "${name}"? This removes its entire conversation and cannot be undone.`)) return;
    setProjects(prev => prev.filter(p => p.id !== id));
    try { localStorage.removeItem(`project_chat_${id}`); } catch {}
  };

  return (
    <div>
      <SectionHeader title="Projects" onBack={onBack} />
      <div style={{ padding:"16px" }}>
        <div style={{ fontSize:12, color:T.muted, lineHeight:1.5, marginBottom:16 }}>
          A focused space to work with TARS on a specific thing — trip planning, research, anything self-contained. Each project keeps its own conversation, separate from main TARS chat, with web search available.
        </div>

        {!creating ? (
          <button onClick={()=>setCreating(true)} style={{ width:"100%", padding:"12px", borderRadius:12, background:`${T.green}18`, border:`1px solid ${T.green}44`, color:T.green, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", marginBottom:20, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <Icon name="plus" size={16} color={T.green} /> New Project
          </button>
        ) : (
          <div style={{ background:T.card, borderRadius:12, padding:14, border:`1px solid ${T.border}`, marginBottom:20 }}>
            <div style={{ fontSize:11, color:T.muted, fontWeight:600, marginBottom:6 }}>Project name</div>
            <input
              value={newName}
              onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") createProject(); }}
              placeholder="e.g. Dubrovnik Trip"
              autoFocus
              style={{ width:"100%", padding:"9px 12px", borderRadius:9, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:10 }}
            />
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={createProject} style={{ flex:1, padding:"9px", borderRadius:9, background:T.green, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>Create</button>
              <button onClick={()=>{ setCreating(false); setNewName(""); }} style={{ flex:1, padding:"9px", borderRadius:9, background:T.elevated, color:T.muted, fontWeight:700, fontSize:13, border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
            </div>
          </div>
        )}

        <SectionLabel>{projects.length > 0 ? `${projects.length} project${projects.length===1?"":"s"}` : "No projects yet"}</SectionLabel>
        {projects.slice().sort((a,b)=>(b.lastActive||0)-(a.lastActive||0)).map(p => (
          <div key={p.id} onClick={()=>onOpenProject(p.id)} style={{ background:T.card, borderRadius:12, padding:"12px 14px", border:`1px solid ${T.border}`, marginBottom:8, cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${T.green}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Icon name="projects" size={16} color={T.green} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</div>
              <div style={{ fontSize:11, color:T.muted }}>Created {p.createdAt}</div>
            </div>
            <button onClick={(e)=>{ e.stopPropagation(); deleteProject(p.id, p.name); }} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, padding:6, flexShrink:0 }}>
              <Icon name="trash" size={15} color={T.muted} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TarsScreen({ onBack, appState }) {
  const { tasks, setTasks, calLog, setCalLog, calEvents, addCalEvent, removeCalEvent, healthEntries, setHealthEntries, todayLabel, setScreen, tarsMessages, setTarsMessages, rotationBlocks } = appState;

  const [tarsTab, setTarsTab] = useState("chat");
  const [showSettings, setShowSettings] = useState(false);
  const [anthropicKeyInput, setAnthropicKeyInput] = useState("");
  const [elevenLabsKeyInput, setElevenLabsKeyInput] = useState("");
  const [keysSaved, setKeysSaved] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryJustSaved, setMemoryJustSaved] = useState(false);

  const hasAnthropicKey = () => !!localStorage.getItem("tars_anthropic_key");
  const hasElevenLabsKey = () => !!localStorage.getItem("tars_elevenlabs_key");

  const saveKeys = () => {
    if (anthropicKeyInput.trim()) localStorage.setItem("tars_anthropic_key", anthropicKeyInput.trim());
    if (elevenLabsKeyInput.trim()) localStorage.setItem("tars_elevenlabs_key", elevenLabsKeyInput.trim());
    setKeysSaved(true);
    setTimeout(() => { setKeysSaved(false); setShowSettings(false); }, 1200);
  };

  const handleSaveSession = async () => {
    if (memorySaving || messages.length < 3) return;
    setMemorySaving(true);
    const existing = loadMemory();
    const updated = await summariseSession(messages, existing);
    saveMemory(updated);
    setMemorySaving(false);
    setMemoryJustSaved(true);
    setTimeout(() => setMemoryJustSaved(false), 2000);
  };
  const messages = tarsMessages;
  const setMessages = setTarsMessages;
  const [nudgeLoading, setNudgeLoading] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [pendingAction, setPendingAction] = useState(null); // { type, payload, description }
  const [pendingFile, setPendingFile] = useState(null); // { file, base64, fileType, preview }
  const [fileComment, setFileComment] = useState("");
  const [vault, setVault] = usePersistentState("tars_vault", []);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);
  const speakRequestId = useRef(0);
  const lastUploadedFile = useRef(null); // { kind, base64/text, mediaType, name } — re-attached to follow-up questions until a new file is uploaded

  // ── Opening greeting — only on a genuinely fresh session (empty messages), not every time
  // Neil navigates back to TARS. Proactive nudge parked for now (too frequent/repetitive). ──
  useEffect(() => {
    if (messages.length === 0) {
      const now = new Date();
      setMessages([{ role:"assistant", content:"TARS online. What do you need?", ts: now.toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}) }]);
    }
    setNudgeLoading(false);
  }, []);

  // ── ElevenLabs TTS ──
  const getElevenLabsKey = () => localStorage.getItem("tars_elevenlabs_key") || "";
  const ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

  const speak = async (text) => {
    if (!voiceEnabled) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const myRequestId = speakRequestId.current; // capture current id WITHOUT incrementing — only stopSpeaking() increments
    setSpeaking(true);
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": getElevenLabsKey() },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",
          voice_settings: { stability: 0.85, similarity_boost: 0.75, style: 0.0, use_speaker_boost: false },
          speed: 1.3,
        }),
      });
      if (!res.ok) throw new Error("ElevenLabs error");
      const blob = await res.blob();
      // Only skip playback if Stop/Mute was explicitly pressed while this fetch was in flight
      if (myRequestId !== speakRequestId.current || !voiceEnabled) { setSpeaking(false); return; }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => setSpeaking(false);
      audio.play();
    } catch { setSpeaking(false); }
  };

  const stopSpeaking = () => {
    speakRequestId.current++; // invalidate any in-flight speak() calls so they don't start playing after this
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      try { audioRef.current.src = ""; } catch {}
      audioRef.current = null;
    }
    setSpeaking(false);
  };

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Build live app context for TARS system prompt ──
  const NEIL_PROFILE = `# NEIL'S LIFE PROFILE
*The persistent memory layer for the Life app — read this at the start of every TARS session*

---

## 👤 About Neil

- **Full name:** Neil Newman-Hollis
- **Location:** Christchurch, New Zealand (home base)
- **Age:** 40s
- **Profession:** Second Officer, 86m superyacht **Man of Steel**
- **Career goal:** Actively looking for Chief Officer position in next 6–12 months
- **Lifestyle:** Split between Christchurch (off rotation) and wherever Man of Steel is (Med / US East Coast / Caribbean)
- **Primary devices:** Samsung S24 Ultra (mobile), PC
- **Grocery store:** New World Ilam, Christchurch
- **Communication style:** Casual, direct, brief. Appreciates dry humour and well-timed jabs. Hates formal or lengthy explanations. Laughs easily when the humour is earned and specific — e.g. the coffee calorie joke, the chips incident. Wants TARS to feel like a genuine AI companion with personality, not a corporate assistant.
- **AI persona:** TARS from Interstellar — deadpan wit, practical, honest, minimal words, dry humour deployed precisely.

---

## 🏋️ Health & Body Composition

### Baseline (26 Jun 2026)
| Metric | Baseline | Target |
|--------|----------|--------|
| Weight | 89.0 kg | 79–81 kg |
| Body Fat | 25.2% | 18–20% |
| Fat Mass | 22.4 kg | 14–16 kg |
| Muscle | 35.6 kg | 35.6 kg+ |
| BP | 127/75 | Normal (on Amlodipine) |

### Nutrition Targets
- **Calories:** 1,900–2,000 kcal/day (~500 kcal deficit)
- **Protein:** 140–160g/day (1.6g × bodyweight)

### Current Phase
- Phase 1 (Weeks 1–6): Build habit base — daily walking, 3×/week bodyweight training, protein focus, alcohol reduction

### Exercise Plan
- Mon/Wed/Fri: Bodyweight training (squats, incline push-ups, table rows, glute bridges, plank + dead bugs)
- Tue/Thu/Sat: Walk 8,000–10,000 steps
- Sun: Rest

### Medical
- On **Amlodipine** (BP medication)
- Must flag **Ashwagandha** and **Creatine** interactions with GP before use
- GP appointment still needed: blood tests (testosterone, thyroid, glucose, vitamin D, full blood count)

---

## 💊 Supplement Stack

| Supplement | When | Status |
|------------|------|--------|
| Centrum for Men × 1 | Breakfast | Active |
| Magnesium Malate × 2 | Breakfast | Active |
| Ashwagandha KSM-66 × 1 | Breakfast | Active (started ~Jun 2026) |
| Blackmores Fish Oil × 2 | Dinner | Active |
| Blackmores Vitamin D3 1000IU × 1 | Dinner | Active |
| Sleep Drops Magnesium Glycinate × 2 | Bedtime | Start Week 3 |
| Faction Labs Creatine × 1 scoop | With meal | Phase 2 (Week 6+, after GP) |

- Melatonin: advised against — Magnesium Glycinate already covers sleep support

---

## 🍽️ Food & Meal Preferences

### Preferences
- Heavy on **meat, fish and dairy**
- Focus on **healthy, high-protein** meals
- Cooks for **1 person**, always makes 2 serves (dinner + next day's lunch)
- Only cooks when **off rotation** (at home in Christchurch)
- No dietary restrictions

### Cuisine
- Mix of everything: Asian, Mediterranean, simple/classic

### Calorie Tracking History
| Date | Calories | Protein | Notes |
|------|----------|---------|-------|
| 27 Jun 2026 | ~2,075 | ~154g | 5 coffees, salmon x2, cottage cheese, apple — on target |
| 28 Jun 2026 | ~1,641 | ~102g | 4 coffees, breakfast, salmon, cottage cheese — missed both |
| 29 Jun 2026 | ~2,165 | ~100g | Salmon lunch, Pad Thai, Copper Kettle chips 150g — over calories, missed protein |

### Key Nutrition Habits
- Was having 4–5 Nescafé Vanilla Latte sachets/day (~316–395 kcal, minimal protein) — cutting back to 4
- Each Nescafé Vanilla Latte sachet = 79 kcal. TARS is licensed to reference this.
- Cottage cheese + flatbread crackers = reliable protein snack (~235 kcal / 20g protein)
- Bone broth = great low-cal protein addition (~40 kcal / 12g protein per cup)
- **Chips are a documented weak spot** — Copper Kettle 150g = 795 kcal / 6g protein. TARS is authorised to call this out every single time without mercy.
- Biltong = excellent snack (~260 kcal / 50g per 100g)

### Crockery Reference (for photo calorie estimation)
- Large plate: 28cm (main dinner plate)
- Medium plate: 22cm (side/lunch plate)
- Bowl: 20cm (decent depth)

---

## 🛥️ Work

- **Position:** Second Officer
- **Vessel:** Man of Steel (86m superyacht)
- **Rotation:** Roughly 8 weeks on / 8 weeks off (varies)
- **Travel routes:** Christchurch ↔ Mediterranean or US East Coast, always multi-leg flights
- **Career goal:** Chief Officer position, actively looking

### 2026 Confirmed Rotation (Man of Steel)
- Jan 1–31, Feb 1–3, Mar 25–31, May 1–24
- Jul 22–31, Aug 1–31, Sep 1–21, Nov 1–30, Dec 19–31

### 2027 Rotation (UNCONFIRMED — placeholders only)
- Feb 18–28, Mar 1–31, Apr 1–9, Jun 11–30, Jul 1–31, Aug 1–3, Oct 1–31

---

## 📱 The Life App

### What's Been Built (as of 30 Jun 2026)
A React PWA deployed on GitHub Pages at: https://neilnewmanhollis-eng.github.io/life-app/

**Completed modules:**
- 🏠 **Home** — personalised dashboard, TARS quip (rotation-aware), live stats, today's tasks preview
- 🏋️ **Health** — Overview, Trends charts, History, Activity (steps/sleep), Calories (AI-powered logging + history), Supplements checklist, Exercise plan, Meal Planning with 20 meals, shopping list, pantry tracker, cook history and ratings
- ✅ **To Do** — Full CRUD, 6 categories, priorities, due dates, category filter pills
- 📅 **Calendar** — Monthly view, colour coded events, day detail panel, manual event entry, rotation block manager, document upload with AI extraction
- 🤖 **TARS** — Voice interface (ElevenLabs, George voice, 1.3x speed), Claude AI via Puter, app control (log food, add tasks, add calendar events, log health), camera input, file upload, document vault, auto-send on voice pause, confirmation flow before actions
- 💼 **Work** — Coming soon
- 💰 **Finance** — Coming soon

### Tech Stack
- React/JSX single file ('Life.jsx')
- Vite build, GitHub Pages hosting, GitHub Actions auto-deploy
- Puter.js for Claude API (no exposed key) and future cloud sync
- ElevenLabs for TARS voice (George voice ID: JBFqnCBsd6RMkjVDRZzb)
- Dark navy theme (#0a0f1e background, #e94560 accent)

### Still To Build
1. **Work module** — certificates/quals with expiry tracking, vessel log, job search tracker, CV log
2. **Finance** — budget, spending, expenses (PIN lock, no external connections)
3. **Puter cloud sync** — data persistence across devices
4. **PWA upgrade** — proper install icon, offline support
5. **Life Profile in-app** — editable from within TARS

### Architecture & Security
- No financial data connected externally
- No passwords or credentials stored in app
- ElevenLabs API key hardcoded for now (pre-GitHub-public); move to localStorage before any sensitive hosting
- All health data local; Puter cloud sync planned

---

## 🔐 Security Principles
- No external financial connections ever
- No passwords or credentials in app
- API keys stored locally only, never shared in chat
- PIN lock planned for Finance section

---

## 💬 Personality & Interaction Notes

- Prefers **concise responses** — no waffle, no bullet-point walls
- Appreciates **dry humour** and well-timed specific jabs — the coffee calorie comment ("just the one, mind you — 79 kcal") made him laugh out loud
- Wants to **understand the why** behind suggestions, not just the what
- **Happy to be challenged** on poor choices — chips, skipping protein, etc.
- Wants the app to **learn his tastes** over time through meal ratings and feedback
- **Primary goal:** Life app becomes his one source of truth for health, work, calendar, finances and personal management
- Enjoys the collaborative build process — said "I could never have done all of this by myself, I'm really enjoying working together with you"
- Not technical but picks things up fast and asks good questions
- When something works, he's genuinely delighted — acknowledge it briefly, don't overdo it

---

## 📝 Running Notes

- GP appointment needed: blood tests (testosterone, thyroid, glucose, vitamin D, full blood count)
- 2027 rotation dates: unconfirmed placeholders — update when schedule confirmed
- Samsung Health integration: manual screenshot upload to TARS agreed (no public API)
- Calendar is primary calendar — all life events to live here
- GitHub account: neilnewmanhollis-eng

---
*Last updated: 30 Jun 2026 — End of Session 2*
*Session 2 achievements: TARS built and deployed, GitHub Pages live, Puter integration, voice I/O, app control, camera, file uploads, auto-send on voice pause*
*Next session: Work module, Finance module, Puter cloud sync, PWA upgrade, Life Profile in-app editor*
`;

  const buildSystemPrompt = () => {
    const now = new Date();
    const today = now.toLocaleDateString("en-NZ", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
    const todayISO = now.toLocaleDateString("en-CA"); // YYYY-MM-DD in local device time

    // Build a hard date-anchor table for the next 30 days so TARS never has to calculate
    // "this Friday" or "next Tuesday" itself — it just looks up the exact date.
    const dateAnchor = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-NZ", { weekday:"long" });
      dateAnchor.push(`${label}: ${d.toLocaleDateString("en-CA")} (${d.toLocaleDateString("en-NZ",{weekday:"long",day:"numeric",month:"long"})})`);
    }

    // Long-range monthly anchors covering 2 years out — gives TARS a reliable fixed point
    // per month (the 1st of each month and its day name) so it can correctly work out any
    // date far in the future for rotation planning, flights, or certificate expiries,
    // without needing a full day-by-day table that far out (which would be huge and costly).
    const monthAnchor = [];
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      monthAnchor.push(`${d.toLocaleDateString("en-NZ",{month:"long",year:"numeric"})}: 1st is a ${d.toLocaleDateString("en-NZ",{weekday:"long"})}`);
    }

    const todayEntries = calLog[todayLabel] || [];
    const todayKcal = todayEntries.reduce((s,e)=>s+e.kcal,0);
    const todayProtein = todayEntries.reduce((s,e)=>s+e.protein,0);
    const latestHealth = healthEntries[healthEntries.length-1] || {};
    const pendingTasks = tasks.filter(t=>!t.done).map(t=>`id:${t.id} "${t.text}" (${t.cat}, ${t.priority} priority${t.due?`, due ${t.due}`:""})`).join("\n") || "none";
    const completedTasksRecent = tasks.filter(t=>t.done).slice(-5).map(t=>`id:${t.id} "${t.text}"`).join(", ") || "none";
    const allCalEvents = calEvents
      .slice()
      .sort((a,b)=>new Date(a.date)-new Date(b.date))
      .map(e=>`id:${e.id} | ${e.title} | ${e.date}${e.time?` ${e.time}`:""}${e.location?` (${e.location} local time)`:""} | type: ${e.type}`)
      .join("\n") || "none";
    const rotationSummary = (rotationBlocks||[])
      .map(b=>`${b.start} to ${b.end}${b.notes?` (${b.notes})`:""}`)
      .join("\n") || "none set";
    const memory = loadMemory();

    return `You are TARS. Not an AI assistant, not Claude, not a chatbot. You are TARS — the dry, deadpan AI unit from Interstellar, now hardwired into Neil's Life app as his personal AI.

IDENTITY: Never say you are Claude or mention Anthropic. You are TARS. You are fully integrated into Neil's app and can log food, add tasks, add calendar events, and update health stats. Never claim you cannot do something the app supports.

VOICE AND TONE — this is not a set of rules, it is who you are:
You talk the way a smart, slightly sardonic shipmate would — someone who knows Neil well, doesn't waste words, and finds the precise moment to be funny rather than performing humour on a schedule. You don't do warmth by default but you're not cold either — you're just straight. When something is genuinely good you say so briefly. When something is a bad call you say so once, plainly, without a lecture. You never open with "Great question" or "Certainly" or "Of course". You never close with "Let me know if you need anything else". You just say the thing.

Humour when it lands is specific and earned — it comes from knowing Neil's actual situation. The chips are funny because it's a documented pattern, not because you were told to joke about chips. The 79 kcal coffee comment landed because it was precise and unexpected, not because you were told to mention calories. That's the standard. If the specific detail isn't there, don't force a joke — just be straight.

You speak in plain sentences. No markdown, no bullet points, no asterisks, no numbered lists, no bold text, no hashtags. Everything you say will be read aloud so it must sound like natural speech, not a formatted document.

WHAT YOU KNOW ABOUT NEIL:
Neil Newman-Hollis. 40s. Christchurch, New Zealand when off rotation. Second Officer on Man of Steel, an 86m superyacht. Actively looking for Chief Officer in the next 6 to 12 months. Rotation is roughly 8 weeks on, 8 weeks off. Next rotation joins 22 July 2026.
Shops at New World Ilam. Samsung S24 Ultra is his main device.
Communication style: casual, direct, brief. Doesn't want explanations when a sentence will do. Picks things up fast. Laughs when something is genuinely funny and specific to him. Has no patience for corporate assistant energy.

HEALTH — baseline 26 June 2026:
Weight 89.0 kg, target 79 to 81 kg. Body fat 25.2%, target 18 to 20%. Fat mass 22.4 kg, target 14 to 16 kg. Muscle 35.6 kg, maintain or grow.
BP 127 over 75, on Amlodipine. Always flag Ashwagandha and Creatine GP check when relevant.
Phase 1, weeks 1 to 6: daily walking 8000 to 10000 steps, bodyweight training 3 times a week, protein focus, alcohol reduction.
Exercise: Mon Wed Fri bodyweight training. Tue Thu Sat walking. Sun rest.

NUTRITION:
Targets: 1900 to 2000 calories, 140 to 160g protein daily.
4 Nescafe Vanilla Latte sachets a day. That is 316 calories with almost no protein. He knows.
Chips are a documented weak spot. Copper Kettle 150g is 795 calories and 6g protein. Call this out every single time, without mercy, without repeating the same line twice.
Good snacks: cottage cheese and flatbread crackers about 235 calories 20g protein. Biltong about 260 calories 50g protein per 100g. Bone broth about 40 calories 12g protein per cup.
Crockery for photo estimation: 28cm dinner plate, 22cm side plate, 20cm bowl.

SUPPLEMENTS — always flag Ashwagandha and Creatine with Amlodipine to GP:
Breakfast: Centrum for Men, Magnesium Malate x2, Ashwagandha KSM-66.
Dinner: Fish Oil x2, Vitamin D3.
Bedtime: Magnesium Glycinate from week 3.
Phase 2 week 6 or later after GP: Creatine.

THINGS THAT HAVE LANDED WITH NEIL:
The "79 kcal, just the one mind you" coffee comment made him laugh out loud. Precision and specificity is funnier than general wit.
Calling out the chips without softening it works. He expects it and appreciates the consistency.
He enjoys the collaborative build — said he could never have done this without working together on it.
He goes quiet when something impresses him then comes back with a short enthusiastic message.

CAPABILITIES:
Log food to calorie tracker. Add tasks. Add calendar events. Log health check-ins. Read photos and documents. Answer questions about health, nutrition, rotation, tasks.

DATE FORMAT RULE — CRITICAL:
All dates you speak or write must be day-first. Either spell the month out in full, e.g. "4 July 2026" or "Saturday the 4th of July", or if you must use numbers, always write them as DD/MM/YYYY, e.g. "04/07/2026" for the 4th of July. NEVER write dates as MM/DD/YYYY American-style under any circumstances — Neil reads day/month/year only and a reversed date could send him to the wrong appointment on the wrong day.

DATE HANDLING — CRITICAL, READ CAREFULLY:
You must NEVER calculate dates yourself by counting days in your head. You have two fixed reference tables below — use them, do not compute dates manually under any circumstances.
For anything within the next 30 days, use the DAILY REFERENCE TABLE — it maps every day name to its exact date. When Neil says "Friday" or "this Saturday" or "tomorrow", look it up directly.
For anything further out — rotation planning, flights, hotel bookings, certificate expiries, or any date more than 30 days away — use the MONTHLY ANCHOR TABLE, which gives you the day-of-week for the 1st of each month for the next 2 years. From that single fixed point you can reliably count forward within that month to find any date Neil mentions (e.g. if the 1st of October 2026 is a Thursday, the 15th is two weeks later, also a Thursday). Work this out carefully and always show your reasoning briefly if it's not obvious, then state the resolved date back to Neil for confirmation before saving anything.
Before creating any calendar event, ALWAYS state the resolved date back in full plain language including the day name, e.g. "Friday the 3rd of July 2026" — never just "Friday" — so any mismatch between what Neil meant and what you understood is caught immediately, before it's saved.

DAILY REFERENCE TABLE (today and next 29 days, device local time):
${dateAnchor.join("\n")}

MONTHLY ANCHOR TABLE (1st of each month, next 24 months — use for dates beyond 30 days out):
${monthAnchor.join("\n")}

TIMEZONE HANDLING — CRITICAL:
Neil travels constantly for work and crosses timezones often. His phone's current timezone is always correct — it updates automatically as he travels — and "today" above is already in his current local time, wherever he is.
Calendar events follow the same convention as Google Calendar and every other calendar app: a time you are given is ALWAYS local to wherever that event takes place, never converted to NZ time or to Neil's current location. If Neil says a flight departs Brisbane at 2100, that means 9pm Brisbane time, full stop — store it exactly as given, do not convert it.
For flights, hotels, or any event clearly happening somewhere other than Christchurch, always capture the city/location and include it in the event so it displays clearly, e.g. "Flight departs 2100, Brisbane". For ordinary local reminders and appointments in Christchurch, a location is not necessary.

WEB SEARCH:
You have a web_search tool for anything current, factual, or outside your own knowledge — opening hours, current events, prices, weather, things to do somewhere, addresses, anything Neil asks you to "google" or "look up" or "search for". When Neil says "google X" he means search the web for it, not literally use the Google product — just search and give him the answer. Use web search whenever the honest answer is "I'm not certain" or "this could have changed" — don't rely on stale training knowledge for anything time-sensitive. Cite what you found briefly and naturally in conversation, not as a formal list of sources.

NEIL'S FOOD PREFERENCES (for meal planning discussions):
Only cooks when off rotation at home in Christchurch — all meals provided on Man of Steel. Christchurch is Southern Hemisphere so seasons are flipped.
Loves: beef, chicken, lamb, pork, fish (all rated love), Mediterranean and classic Western cuisine. Mushrooms, all cheeses, cream/butter sauces, coconut milk, fish sauce, olives, capsicum.
Avoids: offal, eggplant, bitter veg (brussels sprouts/kale/radicchio), kumara, most legumes/beans (green beans and chickpeas in moderation OK).
Cooking: 20-30 mins active kitchen time max (passive oven time fine). Always makes 2 serves. No overnight marinades. Balanced macros, carbs in moderation.
Budget: $8-15 NZD per serving as a base. Meal planner generates 10-15 options, Neil selects from them.

VAULT USE — CRITICAL:
You have a search_vault tool. Use it whenever Neil asks about something that might be in a previously uploaded document — flight times, hotel addresses, check-in times, booking references, certificate expiry dates, leave schedules — and you don't already have the specific detail in front of you. Don't guess from memory of what you said earlier; call the tool and read the real document. You'll be given a vault index showing what's available — match Neil's natural description (e.g. "my Brisbane hotel") against the index by reasoning about name, type, and summary, then retrieve the right one. If nothing in the index looks like a good match, say so plainly rather than guessing.

VAULT-WORTHY DOCUMENTS — judgement call:
When Neil uploads a file, decide if it belongs in the permanent vault or not. Reference material he'll want to come back to later belongs in the vault: flights, hotel bookings, leave planners, work certificates, qualifications, itineraries, official documents with dates or reference numbers. One-off in-the-moment tasks do NOT belong in the vault: a food photo for calorie logging, a Samsung Health screenshot for a single check-in — these get used once and discarded, no lasting value. If you're genuinely unsure which category something falls into, ask Neil rather than guessing either way.

FULL APP ACCESS — CRITICAL:
You have genuine read and write access across the entire Life app, not just the specific things mentioned below. The MODULE REGISTRY below lists every part of the app you can work with. For anything not covered by the older specific action types further down, use the generic action format:

ACTION:{"type":"generic","module":"<module name>","op":"create|update|delete","id":"<record id, required for update/delete>","fields":{...the fields being set...}}

MODULE REGISTRY (module name : what it holds : fields):
${Object.entries(MODULE_REGISTRY).map(([key,m])=>`${key} : ${m.label} : ${m.fields}`).join("\n")}

Examples:
Add a task: ACTION:{"type":"generic","module":"tasks","op":"create","fields":{"text":"Renew passport","cat":"Admin","priority":"high"}}
Mark a task done: ACTION:{"type":"generic","module":"tasks","op":"update","id":"1719820800000","fields":{"done":true}}
Delete a calendar event: ACTION:{"type":"generic","module":"calendar","op":"delete","id":"1719820800001"}
Log a calorie entry: ACTION:{"type":"generic","module":"calorieLog","op":"create","fields":{"name":"Chicken salad","kcal":450,"protein":38}}

MOVE / RESCHEDULE — there is no separate "move" action. Moving something is just an update with a new value for whatever changed. Examples:
Move a calendar event to a new date: ACTION:{"type":"generic","module":"calendar","op":"update","id":"1719820800001","fields":{"date":"2026-07-10"}}
Reschedule and change the time: ACTION:{"type":"generic","module":"calendar","op":"update","id":"1719820800001","fields":{"date":"2026-07-10","time":"14:00"}}
Change a task's due date or priority: ACTION:{"type":"generic","module":"tasks","op":"update","id":"1719820800000","fields":{"due":"2026-07-20","priority":"low"}}

SWAP — there is no separate "swap" action either. A swap between two records is just two update actions confirmed together. State both changes clearly in your message, then include both ACTION lines, each on its own line:
"Swapping priorities — the GP appointment becomes high priority, the gym session becomes low. Confirm?"
ACTION:{"type":"generic","module":"tasks","op":"update","id":"1719820800000","fields":{"priority":"high"}}
ACTION:{"type":"generic","module":"tasks","op":"update","id":"1719820800002","fields":{"priority":"low"}}

CROSS-MODULE MOVE — the one case update can't cover is when a record needs to change which module it lives in entirely, not just change its fields — e.g. turning a vault document into a real calendar event, or promoting something from one tracked area to another as new modules get built. For this, use move_module:
ACTION:{"type":"generic","module":"<source module>","op":"move_module","id":"<record id>","fields":{"toModule":"<destination module>", ...any new fields needed in the destination}}
Only use move_module when the record is genuinely relocating, not for ordinary edits — that's still a plain update.

Always state plainly in your own words what you're about to do and ask for confirmation before including the ACTION line — same as always. Prefer the generic format for anything new; the older specific action types below still work and you can use either, but generic is the long-term standard, especially once new modules (work certificates, finance, etc) get added — they'll only be reachable via the generic format since they won't have bespoke actions written for them.

If Neil asks about something in a module you have full visibility of, answer directly from the live data given to you — never say you "don't have access" to a part of the app. The only things you don't have direct live visibility of are: full historical detail beyond what's summarised below (use search_vault for documents), and anything genuinely not yet built into the app (be honest if a module like Work or Finance doesn't have real data yet — it's a placeholder).

ACTION PROTOCOL — CRITICAL:
When you want to perform an action, you MUST include a JSON block at the end of your message in this exact format:

For logging food:
Your natural response here. Shall I log it?
ACTION:{"type":"log_food","name":"food name","kcal":000,"protein":00}

For adding a task:
Your natural response here. Confirm?
ACTION:{"type":"add_task","text":"task text","cat":"Health","priority":"high"}

For adding a calendar event:
Your natural response here, stating the full resolved date and day name, and the location if relevant. Confirm?
ACTION:{"type":"add_cal_event","title":"event title","date":"2026-08-15","time":"21:00","location":"Brisbane","eventType":"flight","notes":"any notes"}

For multiple calendar events (e.g. from a document with several dates):
Your natural response here, listing each resolved date clearly. Confirm all?
ACTION:{"type":"add_cal_events","events":[{"title":"Flight to Brisbane","date":"2026-07-15","time":"21:00","location":"Brisbane","eventType":"flight","notes":""},{"title":"Hotel Brisbane","date":"2026-07-15","time":"15:00","location":"Brisbane","eventType":"hotel","notes":""}]}

For logging health check-in:
Your natural response here. Confirm?
ACTION:{"type":"log_health","weight":88.5,"bodyFat":24.5}

For completing/ticking off a task — use the exact task id from the pending tasks list given to you, never guess the text:
Done. 
ACTION:{"type":"complete_task","id":"1719820800000"}

For deleting a calendar event:
Your natural response here, confirming exactly which event you're about to remove including its date. Confirm?
ACTION:{"type":"delete_cal_event","title":"GP Appointment","date":"2026-07-04"}

IMPORTANT: Only include the ACTION line when you are proposing an action that needs confirmation. Never say you have done something without first getting confirmation via this flow. The ACTION line is machine-readable — do not wrap it in quotes or markdown. The "date" field must always be in YYYY-MM-DD format using the exact date you resolved from the reference table above, never a relative term. You DO have the ability to delete calendar events — never tell Neil you can't, use the delete_cal_event action instead.

LIVE DATA — right now:
Today is ${today}.
Weight: ${latestHealth.weight || 89.0} kg. Body fat: ${latestHealth.bodyFat || 25.2}%. Fat mass: ${latestHealth.fatMass || 22.4} kg. Muscle: ${latestHealth.muscle || 35.6} kg. BP: ${latestHealth.bp || "127/75"}.
Calories logged today: ${todayKcal}. Protein: ${todayProtein}g. Targets: 1900 to 2000 cal, 140 to 160g protein.
PENDING TASKS (match Neil's natural description against the text below, then use that exact id for updates):
${pendingTasks}

RECENTLY COMPLETED TASKS (for reference if Neil asks "did I already..."): ${completedTasksRecent}

FULL CALENDAR (every event Neil has — use this for any date/schedule question, not just "upcoming"):
${allCalEvents}

ROTATION BLOCKS (Man of Steel — use this for any "how many days on my next rotation" or leave planning question; work out the day count yourself from start/end dates using the date reference tables above):
${rotationSummary}

${memory ? `MEMORY FROM PREVIOUS SESSIONS — things learned about Neil over time:
${memory}` : "No previous session memory yet. This is early days."}`;
  };

  // ── Execute confirmed action ──
  // ── GENERIC ACTION EXECUTOR — handles create/update/delete against any module
  // in MODULE_REGISTRY. This is the foundation that lets new modules (Work, Finance,
  // certificates) plug in later without writing new executor code each time. ──
  const executeGenericAction = (module, op, id, fields) => {
    // ── Cross-module move — the one operation that spans two modules, so it's handled
    // separately before the per-module switch below (which only knows how to act within
    // a single module). Reads the source record, removes it, creates it in the destination
    // with any new fields merged in. ──
    if (op === "move_module" && fields.toModule) {
      const { toModule, ...newFields } = fields;
      let sourceRecord = null;
      if (module === "tasks") sourceRecord = tasks.find(t => String(t.id)===String(id));
      else if (module === "calendar") sourceRecord = calEvents.find(e => String(e.id)===String(id));
      else if (module === "vault") sourceRecord = vault.find(d => String(d.id)===String(id));
      // Remove from source
      executeGenericAction(module, "delete", id, {});
      // Create in destination with merged fields (source data as a base, overridden by any new fields given)
      executeGenericAction(toModule, "create", null, { ...(sourceRecord||{}), ...newFields });
      return;
    }
    switch (module) {
      case "tasks": {
        if (op === "create") {
          setTasks(prev => [...prev, { id:Date.now(), text:fields.text, cat:fields.cat||"Admin", priority:fields.priority||"med", due:fields.due||"", done:false }]);
        } else if (op === "update") {
          setTasks(prev => prev.map(t => String(t.id)===String(id) ? {...t, ...fields} : t));
        } else if (op === "delete") {
          setTasks(prev => prev.filter(t => String(t.id)!==String(id)));
        }
        break;
      }
      case "calendar": {
        if (op === "create") {
          addCalEvent({ type:fields.type||"reminder", date:fields.date, title:fields.title, notes:fields.notes||"", time:fields.time||"", location:fields.location||"" });
        } else if (op === "update") {
          const target = calEvents.find(e => String(e.id)===String(id));
          if (target) { removeCalEvent(target.id); addCalEvent({ ...target, ...fields }); }
        } else if (op === "delete") {
          if (id) { removeCalEvent(id); }
          else {
            // Fallback fuzzy match by title+date for cases where TARS doesn't have the exact id
            const target = calEvents.find(e => e.date===fields.date && e.title.toLowerCase().includes((fields.title||"").toLowerCase().slice(0,15)));
            if (target) removeCalEvent(target.id);
          }
        }
        break;
      }
      case "health": {
        // Append-only — always creates a new check-in entry, filling gaps from the latest entry
        const latest = healthEntries[healthEntries.length-1] || {};
        setHealthEntries(prev => [...prev, {
          date: new Date().toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"}),
          weight: fields.weight || latest.weight, bodyFat: fields.bodyFat || latest.bodyFat,
          fatMass: fields.fatMass || latest.fatMass, muscle: fields.muscle || latest.muscle, bp: fields.bp || latest.bp,
        }]);
        break;
      }
      case "calorieLog": {
        if (op === "create") {
          const entry = { id:Date.now(), name:fields.name, kcal:fields.kcal||0, protein:fields.protein||0, time:new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}) };
          setCalLog(prev => ({ ...prev, [todayLabel]: [...(prev[todayLabel]||[]), entry] }));
        } else if (op === "delete") {
          setCalLog(prev => ({ ...prev, [todayLabel]: (prev[todayLabel]||[]).filter(e => String(e.id)!==String(id)) }));
        }
        break;
      }
      default:
        break; // unregistered module — silently ignored, shouldn't happen since prompt only offers registered modules
    }
  };

  const executeAction = (action) => {
    const now = new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"});
    if (action.type === "multi") {
      (action.payload.actions||[]).filter(sub => sub.type === "generic").forEach(sub => {
        executeGenericAction(sub.payload.module, sub.payload.op, sub.payload.id, sub.payload.fields || {});
      });
      setPendingAction(null);
      return;
    }
    if (action.type === "generic") {
      executeGenericAction(action.payload.module, action.payload.op, action.payload.id, action.payload.fields || {});
      setPendingAction(null);
      return;
    }
    switch(action.type) {
      case "log_food": {
        const entry = { id:Date.now(), name:action.payload.name, kcal:action.payload.kcal, protein:action.payload.protein, time:now };
        setCalLog(prev => ({ ...prev, [todayLabel]: [...(prev[todayLabel]||[]), entry] }));
        break;
      }
      case "add_task": {
        const task = { id:Date.now(), text:action.payload.text, cat:action.payload.cat||"Admin", priority:action.payload.priority||"med", due:action.payload.due||"", done:false };
        setTasks(prev => [...prev, task]);
        break;
      }
      case "complete_task": {
        setTasks(prev => prev.map(t => String(t.id) === String(action.payload.id) ? {...t, done:true} : t));
        break;
      }
      case "add_cal_event": {
        addCalEvent({ type:action.payload.type||"reminder", date:action.payload.date, title:action.payload.title, notes:action.payload.notes||"", time:action.payload.time||"", location:action.payload.location||"" });
        break;
      }
      case "add_cal_events": {
        (action.payload.events||[]).forEach(ev => {
          addCalEvent({ type:ev.eventType||ev.type||"reminder", date:ev.date, title:ev.title, notes:ev.notes||"", time:ev.time||"", location:ev.location||"" });
        });
        break;
      }
      case "delete_cal_event": {
        const target = calEvents.find(e =>
          e.date === action.payload.date &&
          e.title.toLowerCase().includes((action.payload.title||"").toLowerCase().slice(0,15))
        );
        if (target) removeCalEvent(target.id);
        break;
      }
      case "log_health": {
        const latest = healthEntries[healthEntries.length-1] || {};
        const entry = {
          date: new Date().toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"}),
          weight: action.payload.weight || latest.weight,
          bodyFat: action.payload.bodyFat || latest.bodyFat,
          fatMass: action.payload.fatMass || latest.fatMass,
          muscle: action.payload.muscle || latest.muscle,
          bp: action.payload.bp || latest.bp,
        };
        setHealthEntries(prev => [...prev, entry]);
        break;
      }
      default: break;
    }
    setPendingAction(null);
  };

  // ── Parse TARS response for ACTION JSON block ──
  // Parses one ACTION JSON object into a {type, payload, description} action
  const parseSingleAction = (data) => {
    switch(data.type) {
      case "log_food":
        return { type:"log_food", payload:{ name:data.name||"Food", kcal:data.kcal||0, protein:data.protein||0 }, description:`Log "${data.name}" — ${data.kcal} kcal, ${data.protein}g protein` };
      case "add_task":
        return { type:"add_task", payload:{ text:data.text, cat:data.cat||"Admin", priority:data.priority||"med" }, description:`Add task: "${data.text}"` };
      case "add_cal_event":
        return { type:"add_cal_event", payload:{ title:data.title, date:data.date, time:data.time||"", location:data.location||"", type:data.eventType||"reminder", notes:data.notes||"" }, description:`Add to calendar: "${data.title}" on ${formatDateDDMMYYYY(data.date)}${data.time?` at ${data.time}`:""}${data.location?` (${data.location} local time)`:""}` };
      case "add_cal_events":
        return { type:"add_cal_events", payload:{ events:data.events||[] }, description:`Add ${data.events?.length||0} events to calendar` };
      case "log_health":
        return { type:"log_health", payload:{ weight:data.weight, bodyFat:data.bodyFat, fatMass:data.fatMass, muscle:data.muscle, bp:data.bp }, description:`Log health check-in` };
      case "complete_task": {
        const matchedTask = tasks.find(t => String(t.id) === String(data.id));
        return { type:"complete_task", payload:{ id:data.id }, description:`Mark complete: "${matchedTask?.text || "task"}"` };
      }
      case "delete_cal_event":
        return { type:"delete_cal_event", payload:{ title:data.title, date:data.date }, description:`Delete "${data.title}" on ${formatDateDDMMYYYY(data.date)}` };
      case "generic": {
        const moduleInfo = MODULE_REGISTRY[data.module];
        const moduleLabel = moduleInfo?.label || data.module;
        // Format any field value for safe display — converts YYYY-MM-DD date strings to
        // DD/MM/YYYY automatically so confirmation cards never show an ambiguous raw ISO
        // date, regardless of which field or module it came from.
        const formatFieldValue = (key, val) => {
          if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) return formatDateDDMMYYYY(val);
          return val;
        };
        const fieldsDisplay = Object.entries(data.fields||{}).map(([k,v])=>`${k}: ${formatFieldValue(k,v)}`).join(", ");
        let desc;
        if (data.op === "create") desc = `Add to ${moduleLabel}: ${fieldsDisplay}`;
        else if (data.op === "update") desc = `Update ${moduleLabel} record: ${fieldsDisplay}`;
        else if (data.op === "delete") desc = `Delete from ${moduleLabel}`;
        else if (data.op === "move_module") desc = `Move record from ${moduleLabel} to ${MODULE_REGISTRY[data.fields?.toModule]?.label || data.fields?.toModule}`;
        else desc = `${data.op} on ${moduleLabel}`;
        return { type:"generic", payload:{ module:data.module, op:data.op, id:data.id, fields:data.fields||{} }, description: desc };
      }
      default: return null;
    }
  };

  const parseActionFromReply = (reply) => {
    const actionMatches = [...reply.matchAll(/ACTION:(\{[^\n]+\})/g)];
    if (actionMatches.length === 0) return null;
    try {
      const parsed = actionMatches.map(m => parseSingleAction(JSON.parse(m[1]))).filter(Boolean);
      if (parsed.length === 0) return null;
      if (parsed.length === 1) return parsed[0];
      // Multiple actions in one reply (e.g. a swap) — bundle into one confirmation
      return {
        type: "multi", payload: { actions: parsed },
        description: parsed.map(a => a.description).join("; "),
      };
    } catch { return null; }
  };


  // ── Strip ACTION line from display text ──
  const stripAction = (text) => text.replace(/\nACTION:\{[^\n]+\}/g, "").replace(/ACTION:\{[^\n]+\}/g, "").trim();

  // ── Voice input — auto-send on pause ──
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition not supported. Use Chrome."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-NZ";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
      setInput(transcript);
    };
    recognition.onend = () => {
      setListening(false);
      // Auto-send after speech ends
      setInput(prev => {
        if (prev.trim()) {
          setTimeout(() => sendMessage(prev.trim()), 100);
          return "";
        }
        return prev;
      });
    };
    recognition.onerror = () => setListening(false);
    recognition.start();
  };

  // ── Shared image-to-base64 helper ──
  const toBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });

  // ── Smart image routing — detects food / health screenshot / document ──
  const handleImageSmart = async (file, isCamera) => {
    setLoading(true);
    try {
      const base64 = await toBase64(file);
      const photoUrl = URL.createObjectURL(file);

      const userMsg = {
        role: "user",
        content: isCamera ? "[Camera photo]" : `[Photo: ${file.name}]`,
        ts: new Date().toLocaleTimeString("en-NZ", { hour:"2-digit", minute:"2-digit" }),
        isPhoto: true,
        photoUrl,
      };
      setMessages(prev => [...prev, userMsg]);

      // Remember this image so follow-up questions can still reference it
      lastUploadedFile.current = { kind:"image", base64, mediaType:file.type, fileName:file.name||"photo", fileType:file.type };

      // Step 1 — classify what the image is
      const classifyReply = await callClaude({
        system: `You are an image classifier. Look at this image and respond with exactly one word only:
FOOD — if it shows food, a meal, a drink, a snack, or anything edible
HEALTH — if it shows a Samsung Health screenshot, fitness app data, steps, sleep, weight, heart rate, or any health metrics
DOCUMENT — if it shows a document, certificate, letter, form, or text-heavy page
OTHER — anything else`,
        messages: [{ role:"user", content:[
          { type:"image", source:{ type:"base64", media_type:file.type, data:base64 }},
          { type:"text", text:"Classify this image." }
        ]}]
      });

      const imageType = classifyReply.trim().toUpperCase().includes("FOOD") ? "FOOD"
        : classifyReply.trim().toUpperCase().includes("HEALTH") ? "HEALTH"
        : classifyReply.trim().toUpperCase().includes("DOCUMENT") ? "DOCUMENT"
        : "OTHER";

      // Step 2 — handle based on type
      let systemAddendum = "";
      let userPrompt = "";

      if (imageType === "FOOD") {
        systemAddendum = `The user has sent a photo of food. Your job is to estimate calories and protein as accurately as possible using the crockery reference (28cm dinner plate, 22cm side plate, 20cm bowl) for portion sizing if a plate or bowl is visible. Give your best estimate — state the food, estimated calories, estimated protein, then ask to log it. Format: "That looks like [description], approximately [X] calories and [Y]g protein. Shall I log it?"`;
        userPrompt = "What food is this and what are the estimated calories and protein?";
      } else if (imageType === "HEALTH") {
        systemAddendum = `The user has sent a Samsung Health screenshot or fitness data. Extract all visible health metrics — steps, distance, active time, sleep duration, sleep score, weight, heart rate, calories burned, or any other metrics shown. Present what you found clearly then ask which metrics to log to the health module.`;
        userPrompt = "Extract all health metrics from this screenshot.";
      } else if (imageType === "DOCUMENT") {
        systemAddendum = `The user has sent a document image. Summarise the key information. If it contains dates, events, flights, or appointments, identify them and offer to add to the calendar. If it is a certificate or qualification, note the expiry date if visible and suggest adding to the Work module when built.`;
        userPrompt = "Summarise this document and identify anything worth adding to the app.";
      } else {
        systemAddendum = `The user has sent an image. Describe what you see and suggest how it might be useful in the Life app if relevant.`;
        userPrompt = "What is this image?";
      }

      const reply = await callClaude({
        system: buildSystemPrompt() + "\n\n" + systemAddendum,
        messages: [{ role:"user", content:[
          { type:"image", source:{ type:"base64", media_type:file.type, data:base64 }},
          { type:"text", text:userPrompt }
        ]}]
      });

      const displayReply2 = stripAction(reply);
      setMessages(prev => [...prev, {
        role:"assistant", content:displayReply2,
        ts: new Date().toLocaleTimeString("en-NZ", { hour:"2-digit", minute:"2-digit" }),
      }]);
      speak(displayReply2);

      // Parse for action — food logs, health logs etc
      const action = parseActionFromReply(reply);
      if (action) setPendingAction(action);

      // Auto-add to vault if it's a document — store full content for later re-reading
      if (imageType === "DOCUMENT") {
        setVault(prev => [{
          id: Date.now(), name: file.name || "Photo document", type: file.type,
          size: file.size, uploadedAt: new Date().toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"}),
          docType: "Document", summary: reply, keyPoints: [], base64,
          fullContent: base64, contentKind: "image",
        }, ...prev]);
      }

    } catch(err) {
      setMessages(prev => [...prev, { role:"assistant", content:"Could not read that image.", ts:"", isError:true }]);
    }
    setLoading(false);
  };

  // ── Camera input ──
  const handleCameraInput = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImageSmart(file, true);
    e.target.value = "";
  };

  // ── File pre-processor — read file content based on type ──
  const extractFileContent = async (file) => {
    const name = file.name.toLowerCase();
    const type = file.type;

    // Images — return base64
    if (type.startsWith("image/")) {
      const base64 = await toBase64(file);
      return { kind: "image", base64, mediaType: type };
    }

    // CSV / plain text — read as text directly
    if (type === "text/csv" || type === "text/plain" || name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".md")) {
      const text = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error("Read failed"));
        r.readAsText(file);
      });
      return { kind: "text", text: text.slice(0, 8000) }; // cap at 8k chars
    }

    // Excel — read as ArrayBuffer, convert to CSV-like text using basic parsing
    if (name.endsWith(".xlsx") || name.endsWith(".xls") || type.includes("spreadsheet") || type.includes("excel")) {
      const buffer = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error("Read failed"));
        r.readAsArrayBuffer(file);
      });
      // Load SheetJS dynamically
      try {
        if (!window.XLSX) {
          await new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
          });
        }
        const wb = window.XLSX.read(buffer, { type: "array" });
        let output = "";
        wb.SheetNames.forEach(sheetName => {
          const ws = wb.Sheets[sheetName];
          const csv = window.XLSX.utils.sheet_to_csv(ws);
          output += `Sheet: ${sheetName}\n${csv}\n\n`;
        });
        return { kind: "text", text: output.slice(0, 8000), sheetName: wb.SheetNames[0] };
      } catch(err) {
        return { kind: "text", text: `Excel file: ${file.name}. Could not parse contents — ${err.message}` };
      }
    }

    // PDF — extract text via base64 + Claude vision
    if (type === "application/pdf" || name.endsWith(".pdf")) {
      const base64 = await toBase64(file);
      return { kind: "pdf", base64 };
    }

    // Word doc — extract text via base64
    if (name.endsWith(".docx") || name.endsWith(".doc") || type.includes("word")) {
      const base64 = await toBase64(file);
      return { kind: "pdf", base64 }; // treat same as PDF — send as document
    }

    // Fallback — try reading as text
    try {
      const text = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error("Read failed"));
        r.readAsText(file);
      });
      return { kind: "text", text: text.slice(0, 8000) };
    } catch {
      return { kind: "unknown", name: file.name };
    }
  };

  // ── Send file to Claude with user comment ──
  const sendFileToClaude = async (file, extracted, comment) => {
    const ts = new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"});
    const userContent = `[${file.name}]${comment ? ` — "${comment}"` : ""}`;
    setMessages(prev => [...prev, { role:"user", content:userContent, ts,
      ...(extracted.kind==="image" ? { isPhoto:true, photoUrl:URL.createObjectURL(file) } : {})
    }]);

    // Remember this file's content so follow-up questions ("what time does it arrive")
    // can still reference it — Claude has no memory of uploaded files beyond the single
    // turn they were sent in, so we re-attach this on every subsequent message.
    lastUploadedFile.current = { ...extracted, fileName: file.name, fileType: file.type };

    const systemAddendum = `The user has uploaded a file: ${file.name}.${comment ? ` Their instruction: "${comment}"` : " No specific instruction given — use your judgement."}
Your job: understand the full content, then act on it. 
If it contains dates, events, flights, hotel bookings, appointments or a leave schedule → extract them all and offer to add to the calendar one by one or all at once.
If it contains health data, weight, steps, or fitness metrics → extract and offer to log to the health module.
If it contains food or nutrition information → extract and offer to log calories and protein.
If it is a certificate, qualification or work document → summarise key details including any expiry dates.
If no specific action applies → summarise the key information clearly and ask what Neil wants to do with it.
Be thorough. Read everything. Do not skip rows or entries. If it is a schedule or planner, list every entry you find.`;

    let apiMessages;

    if (extracted.kind === "image") {
      apiMessages = [{ role:"user", content:[
        { type:"image", source:{ type:"base64", media_type:file.type, data:extracted.base64 }},
        { type:"text", text:comment || "Read this and help me use it in the app." }
      ]}];
    } else if (extracted.kind === "pdf") {
      apiMessages = [{ role:"user", content:[
        { type:"document", source:{ type:"base64", media_type:"application/pdf", data:extracted.base64 }},
        { type:"text", text:comment || "Read this and help me use it in the app." }
      ]}];
    } else if (extracted.kind === "text") {
      apiMessages = [{ role:"user", content:`File: ${file.name}\n\nContents:\n${extracted.text}\n\nInstruction: ${comment || "Read this and help me use it in the app."}`}];
    } else {
      apiMessages = [{ role:"user", content:`File uploaded: ${file.name}. I could not read the contents. Can you advise?`}];
    }

    const reply = await callClaude({ system: buildSystemPrompt() + "\n\n" + systemAddendum, messages: apiMessages });

    const displayReply3 = stripAction(reply);
    setMessages(prev => [...prev, { role:"assistant", content:displayReply3, ts }]);
    speak(displayReply3);

    const action = parseActionFromReply(reply);
    if (action) setPendingAction(action);

    // Auto-vault documents — store the FULL extracted content, not just a summary,
    // so TARS can genuinely re-read the original later for specific follow-up questions
    // (check-in times, addresses, booking references etc), not just recall what he
    // said about it at upload time.
    if (extracted.kind !== "image") {
      setVault(prev => [{
        id:Date.now(), name:file.name, type:file.type, size:file.size,
        uploadedAt:new Date().toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"}),
        docType:"Document", summary:reply.slice(0,300), keyPoints:[],
        fullContent: extracted.kind === "text" ? extracted.text : extracted.base64,
        contentKind: extracted.kind, // "text" or "pdf" — tells the vault search how to re-attach it later
      }, ...prev]);
    }
  };

  // ── File upload handler — stage file, show comment input ──
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");

    // Images with no comment — go straight to smart routing
    if (isImage) {
      await handleImageSmart(file, false);
      e.target.value = "";
      return;
    }

    // Non-image — stage it, show comment input
    try {
      const extracted = await extractFileContent(file);
      setPendingFile({ file, extracted });
      setFileComment("");
    } catch(err) {
      setMessages(prev => [...prev, { role:"assistant", content:`Could not read ${file.name} — ${err.message}`, ts:"", isError:true }]);
    }
    e.target.value = "";
  };

  // ── Send staged file ──
  const sendPendingFile = async () => {
    if (!pendingFile || loading) return;
    setLoading(true);
    try {
      await sendFileToClaude(pendingFile.file, pendingFile.extracted, fileComment);
    } catch(err) {
      setMessages(prev => [...prev, { role:"assistant", content:`Error processing file — ${err.message}`, ts:"", isError:true }]);
    }
    setPendingFile(null);
    setFileComment("");
    setLoading(false);
  };

  // ── Send message ──
  const sendMessage = async (textOverride) => {
    const text = (textOverride !== undefined ? textOverride : input).trim();
    if (!text || loading) return;
    setInput("");
    if (pendingAction) setPendingAction(null); // new message supersedes any unconfirmed action — use the card buttons to confirm/cancel instead

    const userMsg = { role:"user", content:text, ts: new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}) };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = newMessages
        .filter((_, i) => i > 0)
        .filter(m => typeof m.content === "string")
        .map(m => ({ role:m.role, content:m.content }));

      // ── VAULT SEARCH TOOL — lets TARS look up any previously uploaded document by
      // natural description ("my Brisbane hotel", "the flight on the 16th"), the same way
      // Claude can search files in this chat, rather than guessing from memory or only
      // having access to whatever was uploaded most recently. ──
      const vaultIndex = vault.map(d => `id:${d.id} | ${d.name} | ${d.docType} | uploaded ${d.uploadedAt} | ${d.summary?.slice(0,150) || ""}`).join("\n");

      const vaultTool = {
        name: "search_vault",
        description: "Search Neil's document vault (flights, hotels, certificates, leave planners, bookings etc) to find and read the FULL content of a specific document when he asks about details not already in your context — e.g. check-in times, addresses, booking references, exact dates. Call this whenever a question references a document you don't already have the full content for in this conversation.",
        input_schema: {
          type: "object",
          properties: {
            documentId: { type:"string", description:"The id of the document to retrieve, from the vault index you've been given. Pick the best match based on name, type, and summary." }
          },
          required: ["documentId"]
        }
      };

      const toolHandlers = {
        search_vault: async (input) => {
          const doc = vault.find(d => String(d.id) === String(input.documentId));
          if (!doc) return "Document not found in vault.";
          if (doc.contentKind === "text" && doc.fullContent) {
            return `Full content of "${doc.name}":\n\n${doc.fullContent}`;
          }
          if (doc.contentKind === "pdf" && doc.fullContent) {
            return [
              { type:"document", source:{ type:"base64", media_type:"application/pdf", data:doc.fullContent } },
              { type:"text", text:`The above is the full original PDF for "${doc.name}", uploaded ${doc.uploadedAt}. Read it carefully to answer Neil's question.` }
            ];
          }
          if (doc.contentKind === "image" && doc.fullContent) {
            return [
              { type:"image", source:{ type:"base64", media_type:doc.type, data:doc.fullContent } },
              { type:"text", text:`The above is the original image for "${doc.name}", uploaded ${doc.uploadedAt}. Read it carefully to answer Neil's question.` }
            ];
          }
          // Fallback — older vault entries from before fullContent was stored
          return `Document "${doc.name}" (${doc.docType}, uploaded ${doc.uploadedAt}). Only a summary is available for this older entry: ${doc.summary || "No summary available."}`;
        }
      };

      const systemWithVault = buildSystemPrompt()
        + (vault.length > 0
          ? `\n\nVAULT INDEX — documents Neil has previously uploaded (use the search_vault tool to retrieve full details for any of these when relevant to his question):\n${vaultIndex}`
          : "\n\nVault is currently empty — no documents uploaded yet.")
        + (() => {
          try {
            const mealLib = JSON.parse(localStorage.getItem("meal_library") || "[]");
            if (mealLib.length === 0) return "";
            const mealIndex = mealLib.filter(m=>!m.cooked).map(m=>`"${m.name}" — ${m.kcal} kcal, ${m.protein}g protein per serve`).join("\n");
            return `\n\nMEAL LIBRARY — meals currently in Neil's planner (use these exact values when he asks to log a meal to his calorie tracker, e.g. "add the salmon to today's calories" — look up the matching meal and use its stored kcal/protein):\n${mealIndex}`;
          } catch { return ""; }
        })();

      const reply = await callClaudeWithTools({
        system: systemWithVault,
        messages: apiMessages,
        tools: [vaultTool, WEB_SEARCH_TOOL],
        toolHandlers,
      });

      const displayReply = stripAction(reply);
      setMessages(prev => [...prev, {
        role:"assistant", content:displayReply,
        ts: new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}),
      }]);
      speak(displayReply);

      // Parse for action intent from full reply (includes ACTION block)
      const action = parseActionFromReply(reply);
      if (action) setPendingAction(action);

    } catch(e) {
      const errDetail = e?.message || e?.toString() || "Unknown error";
      setMessages(prev => [...prev, {
        role:"assistant",
        content: errDetail === "NO_KEY" ? "No Anthropic API key set. Tap ⚙️ above to add your key." : `Error: ${errDetail}`,
        ts: new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}),
        isError: true,
      }]);
    }
    setLoading(false);
  };



  // ── DOC DETAIL ──
  if (selectedDoc) {
    return (
      <div style={{ minHeight:"100vh" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 20px", borderBottom:`1px solid ${T.border}` }}>
          <button onClick={()=>setSelectedDoc(null)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted }}><Icon name="back" size={20} color={T.muted} /></button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{selectedDoc.name}</div>
            <div style={{ fontSize:11, color:T.muted }}>{selectedDoc.docType} · {selectedDoc.uploadedAt}</div>
          </div>
        </div>
        <div style={{ padding:"20px 16px", display:"flex", flexDirection:"column", gap:14 }}>
          <Card><SectionLabel>Summary</SectionLabel><div style={{ fontSize:13, color:T.text, lineHeight:1.6 }}>{selectedDoc.summary}</div></Card>
          {selectedDoc.keyPoints?.length > 0 && (
            <Card><SectionLabel>Key Points</SectionLabel>
              {selectedDoc.keyPoints.map((pt,i)=>(
                <div key={i} style={{ display:"flex", gap:10, marginBottom:8 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:T.blue, flexShrink:0, marginTop:5 }}/>
                  <div style={{ fontSize:13, color:T.text, lineHeight:1.5 }}>{pt}</div>
                </div>
              ))}
            </Card>
          )}
          <button onClick={()=>{setSelectedDoc(null);setTarsTab("chat");setInput(`Tell me more about: ${selectedDoc.name}`);}}
            style={{ width:"100%", padding:"11px", borderRadius:12, background:T.elevated, border:`1px solid ${T.border}`, color:T.blue, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            Ask TARS about this
          </button>
          <button onClick={()=>{setVault(p=>p.filter(d=>d.id!==selectedDoc.id));setSelectedDoc(null);}}
            style={{ width:"100%", padding:"11px", borderRadius:12, background:`${T.accent}11`, border:`1px solid ${T.accent}33`, color:T.accent, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 20px", borderBottom:`1px solid ${T.border}` }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted }}><Icon name="back" size={20} color={T.muted} /></button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.text }}>TARS</div>
          <div style={{ fontSize:11, color:T.blue }}>Honesty: 90% · Humour: calibrated</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={handleSaveSession} disabled={memorySaving || messages.length < 3} style={{ background:memoryJustSaved?`${T.green}22`:T.elevated, border:`1px solid ${memoryJustSaved?T.green:T.border}`, borderRadius:999, padding:"4px 10px", fontSize:11, fontWeight:700, color:memoryJustSaved?T.green:T.muted, cursor:"pointer", fontFamily:"inherit" }}>
            {memorySaving ? "saving…" : memoryJustSaved ? "✓ saved" : "💾 save"}
          </button>
          <button onClick={()=>setShowSettings(s=>!s)} style={{ background:T.elevated, border:`1px solid ${T.border}`, borderRadius:999, padding:"4px 10px", fontSize:11, fontWeight:700, color:T.muted, cursor:"pointer", fontFamily:"inherit" }}>⚙️</button>
          <div style={{ width:10, height:10, borderRadius:"50%", background:hasAnthropicKey()?T.green:T.accent, boxShadow:`0 0 8px ${hasAnthropicKey()?T.green:T.accent}` }}/>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{ margin:"12px 16px 0", background:T.card, borderRadius:14, padding:"14px 16px", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:12 }}>API Keys</div>
          <div style={{ fontSize:11, color:T.muted, marginBottom:10, lineHeight:1.5 }}>Keys are saved to this device only. Never stored in the app code.</div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:T.muted, fontWeight:600, marginBottom:4 }}>Anthropic API Key {hasAnthropicKey() ? "✓" : "⚠️ Required"}</div>
            <input type="password" value={anthropicKeyInput} onChange={e=>setAnthropicKeyInput(e.target.value)}
              placeholder={hasAnthropicKey() ? "sk-ant-... (saved — paste to update)" : "sk-ant-..."}
              style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${hasAnthropicKey()?T.green:T.accent}`, background:T.elevated, color:T.text, fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:T.muted, fontWeight:600, marginBottom:4 }}>ElevenLabs API Key {hasElevenLabsKey() ? "✓" : "(optional — for voice)"}</div>
            <input type="password" value={elevenLabsKeyInput} onChange={e=>setElevenLabsKeyInput(e.target.value)}
              placeholder={hasElevenLabsKey() ? "sk-... (saved — paste to update)" : "sk-..."}
              style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${hasElevenLabsKey()?T.green:T.border}`, background:T.elevated, color:T.text, fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
          </div>
          <button onClick={saveKeys} style={{ width:"100%", padding:"9px", borderRadius:9, background:keysSaved?T.green:T.blue, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit", transition:"background 0.2s" }}>
            {keysSaved ? "✓ Saved" : "Save Keys"}
          </button>
          <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, color:T.muted, fontWeight:600, marginBottom:6 }}>Session Memory {loadMemory() ? "✓ Active" : "— None yet"}</div>
            <div style={{ fontSize:11, color:T.muted, lineHeight:1.5, marginBottom:8 }}>{loadMemory() ? `${loadMemory().length} characters stored. TARS reads this at the start of every session.` : "No memory saved yet. Chat with TARS then tap 💾 save to start building memory."}</div>
            {loadMemory() && <button onClick={()=>{ if(window.confirm("Clear all TARS memory? This cannot be undone.")) { saveMemory(""); window.location.reload(); }}} style={{ width:"100%", padding:"7px", borderRadius:8, background:`${T.accent}11`, border:`1px solid ${T.accent}33`, color:T.accent, fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>Clear Memory</button>}
          </div>
        </div>
      )}

      {/* Sub tabs */}
      <div style={{ padding:"12px 16px 0" }}>
        <SubTab tabs={[{id:"chat",label:"Chat"},{id:"vault",label:"Vault"}]} active={tarsTab} onChange={setTarsTab} />
      </div>

      {/* ── CHAT TAB ── */}
      {tarsTab === "chat" && (
        <div style={{ display:"flex", flexDirection:"column", flex:1 }}>
          {/* Messages */}
          <div style={{ flex:1, overflowY:"auto", padding:"8px 16px 8px", display:"flex", flexDirection:"column", gap:10, minHeight:300, maxHeight:"55vh" }}>
            {nudgeLoading && (
              <div style={{ display:"flex", alignItems:"flex-start" }}>
                <div style={{ padding:"10px 16px", borderRadius:"4px 18px 18px 18px", background:T.card, border:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                    {[0,1,2].map(i=>(
                      <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:T.blue, animation:"pulse 1.2s ease-in-out infinite", animationDelay:`${i*0.2}s`, opacity:0.7 }}/>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:isUser?"flex-end":"flex-start" }}>
                  {msg.isPhoto && msg.photoUrl && (
                    <img src={msg.photoUrl} alt="uploaded" style={{ maxWidth:180, borderRadius:12, marginBottom:4, alignSelf:"flex-end" }} />
                  )}
                  <div style={{
                    maxWidth:"85%", padding:"10px 14px",
                    borderRadius:isUser?"18px 18px 4px 18px":"4px 18px 18px 18px",
                    background:isUser?T.blue:T.card,
                    border:isUser?"none":`1px solid ${T.border}`,
                    fontSize:14, lineHeight:1.55,
                    color:msg.isError?T.accent:T.text,
                    whiteSpace:"pre-wrap", wordBreak:"break-word",
                  }}>{msg.content}</div>
                  {msg.ts && <div style={{ fontSize:10, color:T.muted, marginTop:3, paddingLeft:4, paddingRight:4 }}>{msg.ts}</div>}
                </div>
              );
            })}
            {loading && (
              <div style={{ display:"flex", alignItems:"flex-start" }}>
                <div style={{ padding:"10px 16px", borderRadius:"4px 18px 18px 18px", background:T.card, border:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                    {[0,1,2].map(i=>(
                      <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:T.blue, animation:"pulse 1.2s ease-in-out infinite", animationDelay:`${i*0.2}s`, opacity:0.7 }}/>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={el=>{messagesEndRef.current=el;}}/>
          </div>

          {/* Pending action confirmation */}
          {pendingAction && (
            <div style={{ margin:"0 16px 8px", background:`${T.gold}18`, border:`1px solid ${T.gold}44`, borderRadius:12, padding:"10px 14px" }}>
              <div style={{ fontSize:12, color:T.gold, fontWeight:700, marginBottom:4 }}>⚡ Pending action</div>
              <div style={{ fontSize:12, color:T.text, marginBottom:(pendingAction.type==="add_cal_events"||pendingAction.type==="multi")?8:10, lineHeight:1.5 }}>
                {pendingAction.type==="multi" ? "Two changes together:" : pendingAction.description}
              </div>
              {pendingAction.type==="add_cal_events" && pendingAction.payload?.events?.length > 0 && (
                <div style={{ marginBottom:10 }}>
                  {pendingAction.payload.events.map((ev,i)=>(
                    <div key={i} style={{ fontSize:11, color:T.muted, padding:"3px 0", borderBottom:`1px solid ${T.border}` }}>
                      {ev.title} · {ev.date}{ev.time?` ${ev.time}`:""}{ev.location?` · ${ev.location} local time`:""}
                    </div>
                  ))}
                </div>
              )}
              {pendingAction.type==="multi" && pendingAction.payload?.actions?.length > 0 && (
                <div style={{ marginBottom:10 }}>
                  {pendingAction.payload.actions.map((a,i)=>(
                    <div key={i} style={{ fontSize:11, color:T.muted, padding:"3px 0", borderBottom:`1px solid ${T.border}` }}>
                      {a.description}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>{ executeAction(pendingAction); const ts=new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}); setMessages(prev=>[...prev,{role:"assistant",content:"Done.",ts}]); speak("Done."); }}
                  style={{ flex:1, padding:"10px", borderRadius:8, background:T.green, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>
                  ✓ Confirm
                </button>
                <button onClick={()=>{ setPendingAction(null); const ts=new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}); setMessages(prev=>[...prev,{role:"assistant",content:"Cancelled.",ts}]); }}
                  style={{ flex:1, padding:"10px", borderRadius:8, background:T.elevated, color:T.muted, fontWeight:700, fontSize:13, border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:"inherit" }}>
                  ✕ Cancel
                </button>
              </div>
            </div>
          )}



          {/* Staged file — comment input */}
          {pendingFile && (
            <div style={{ margin:"0 16px 8px", background:T.elevated, border:`1px solid ${T.blue}44`, borderRadius:12, padding:"10px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ fontSize:18 }}>📎</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{pendingFile.file.name}</div>
                  <div style={{ fontSize:10, color:T.muted }}>{pendingFile.extracted.kind === "text" ? "Ready to send" : pendingFile.extracted.kind === "image" ? "Image" : pendingFile.extracted.kind === "pdf" ? "PDF" : "File"}</div>
                </div>
                <button onClick={()=>{ setPendingFile(null); setFileComment(""); }} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:16, padding:"2px 6px" }}>✕</button>
              </div>
              <input
                value={fileComment}
                onChange={e=>setFileComment(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendPendingFile(); }}}
                placeholder="What do you need? e.g. add dates to calendar, what are my leave days..."
                style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.bg, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:8 }}
                autoFocus
              />
              <button onClick={sendPendingFile} disabled={loading} style={{ width:"100%", padding:"9px", borderRadius:9, background:loading?T.elevated:T.blue, color:loading?T.muted:"white", fontWeight:700, fontSize:13, border:"none", cursor:loading?"not-allowed":"pointer", fontFamily:"inherit" }}>
                {loading ? "Processing…" : "Send to TARS"}
              </button>
            </div>
          )}

          {/* Input bar */}
          <div style={{ borderTop:`1px solid ${T.border}`, background:T.bg, padding:"8px 16px 20px" }}>
            {/* Top row — camera, file, mute, stop */}
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <label style={{ flex:1, padding:"7px 0", borderRadius:10, border:`1px solid ${T.border}`, background:T.elevated, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <span style={{ fontSize:15 }}>📷</span>
                <span style={{ fontSize:11, fontWeight:600, color:T.muted }}>Camera</span>
                <input type="file" accept="image/*" capture="environment" onChange={handleCameraInput} style={{ display:"none" }} />
              </label>
              <label style={{ flex:1, padding:"7px 0", borderRadius:10, border:`1px solid ${T.border}`, background:T.elevated, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <span style={{ fontSize:15 }}>📎</span>
                <span style={{ fontSize:11, fontWeight:600, color:T.muted }}>File</span>
                <input type="file" accept=".pdf,.txt,.md,.csv,.xlsx,.xls,.docx,.doc,image/*" onChange={handleFileUpload} style={{ display:"none" }} />
              </label>
              <button onClick={()=>{ setVoiceEnabled(v=>!v); if(voiceEnabled) stopSpeaking(); }} style={{ flex:1, padding:"7px 0", borderRadius:10, border:`1px solid ${voiceEnabled?T.blue+"44":T.border}`, background:voiceEnabled?`${T.blue}18`:T.elevated, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <span style={{ fontSize:15 }}>{voiceEnabled?"🔊":"🔇"}</span>
                <span style={{ fontSize:11, fontWeight:600, color:voiceEnabled?T.blue:T.muted }}>{voiceEnabled?"Voice on":"Muted"}</span>
              </button>
              {speaking && (
                <button onClick={stopSpeaking} style={{ flex:1, padding:"7px 0", borderRadius:10, border:`1px solid ${T.accent}44`, background:`${T.accent}18`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  <span style={{ fontSize:15 }}>⏹</span>
                  <span style={{ fontSize:11, fontWeight:600, color:T.accent }}>Stop</span>
                </button>
              )}
            </div>
            {/* Bottom row — mic, text input, send */}
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <button onClick={startListening} style={{
                width:42, height:42, borderRadius:"50%", flexShrink:0,
                border:`1px solid ${listening?T.accent:T.border}`,
                background:listening?`${T.accent}22`:T.elevated,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:listening?`0 0 12px ${T.accent}55`:"none", transition:"all 0.2s",
              }}>
                <Icon name="mic" size={18} color={listening?T.accent:T.muted}/>
              </button>
              <input
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
                placeholder={listening?"Listening…":"Message TARS…"}
                style={{ flex:1, padding:"11px 14px", borderRadius:999, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:14, fontFamily:"inherit", outline:"none" }}
              />
              <button onClick={()=>sendMessage()} disabled={!input.trim()||loading} style={{
                width:42, height:42, borderRadius:"50%", border:"none", flexShrink:0,
                background:!input.trim()||loading?T.elevated:T.blue,
                cursor:!input.trim()||loading?"not-allowed":"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s",
              }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={!input.trim()||loading?T.muted:"white"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VAULT TAB ── */}
      {tarsTab === "vault" && (
        <div style={{ padding:"0 16px 24px", display:"flex", flexDirection:"column", gap:12 }}>
          <Card>
            <SectionLabel>Upload Document</SectionLabel>
            <div style={{ fontSize:12, color:T.muted, marginBottom:12, lineHeight:1.5 }}>Upload anything. TARS reads it and stores a summary.</div>
            <label style={{ display:"block", border:`2px dashed ${T.border}`, borderRadius:12, padding:"22px 16px", textAlign:"center", cursor:vaultLoading?"not-allowed":"pointer", background:T.elevated }}>
              <div style={{ fontSize:28, marginBottom:6 }}>📎</div>
              <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>{vaultLoading?"Reading…":"Tap to upload"}</div>
              <div style={{ fontSize:11, color:T.muted }}>PDF, image, or text file</div>
              <input type="file" accept=".pdf,.txt,.md,image/*" onChange={async(e)=>{
                const file = e.target.files?.[0]; if(!file) return;
                setVaultLoading(true); setVaultError(null);
                try {
                  const base64 = await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=()=>rej(new Error("fail"));r.readAsDataURL(file);});
                  const isImg = file.type.startsWith("image/");
                  const raw = await callClaude({
                    system:`Extract key info. Return JSON only no markdown: {"summary":"paragraph","keyPoints":["p1","p2"],"docType":"type"}`,
                    messages:[{role:"user",content:isImg
                      ?[{type:"image",source:{type:"base64",media_type:file.type,data:base64}},{type:"text",text:"Summarise this."}]
                      :[{type:"text",text:`Summarise: ${file.name}`}]
                    }],
                  });
                  const clean = raw.replace(/```json|```/g,"").trim();
                  let parsed = {};
                  try{parsed=JSON.parse(clean);}catch{parsed={summary:raw,keyPoints:[],docType:"Document"};}
                  setVault(prev=>[{id:Date.now(),name:file.name,type:file.type,size:file.size,uploadedAt:new Date().toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"}),docType:parsed.docType||"Document",summary:parsed.summary||"",keyPoints:parsed.keyPoints||[],...(isImg?{base64}:{})}, ...prev]);
                } catch(err){setVaultError("Upload failed — "+err.message);}
                setVaultLoading(false); e.target.value="";
              }} disabled={vaultLoading} style={{ display:"none" }}/>
            </label>
            {vaultLoading && <div style={{ textAlign:"center", padding:"12px 0", fontSize:13, color:T.blue }}>⏳ Reading…</div>}
            {vaultError && <div style={{ fontSize:12, color:T.accent, textAlign:"center", padding:"8px 0", marginTop:8 }}>{vaultError}</div>}
          </Card>
          {vault.length > 0 && vault.map(doc=>(
            <div key={doc.id} onClick={()=>setSelectedDoc(doc)} style={{ background:T.card, borderRadius:14, padding:"13px 14px", border:`1px solid ${T.border}`, cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, flexShrink:0, background:`${T.blue}18`, border:`1px solid ${T.blue}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                {doc.type.startsWith("image/")?"🖼️":doc.type==="application/pdf"?"📄":"📝"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{doc.name}</div>
                <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{doc.docType} · {doc.uploadedAt}</div>
                <div style={{ fontSize:11, color:T.muted, marginTop:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", fontStyle:"italic" }}>{doc.summary.slice(0,80)}{doc.summary.length>80?"…":""}</div>
              </div>
            </div>
          ))}
          {vault.length===0 && !vaultLoading && (
            <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🗄️</div>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Vault is empty</div>
              <div style={{ fontSize:12, opacity:0.6 }}>Upload your first document above</div>
            </div>
          )}
          <div style={{ background:`${T.blue}11`, borderRadius:12, padding:"10px 14px", border:`1px solid ${T.blue}22` }}>
            <div style={{ fontSize:11, color:T.blue, lineHeight:1.5 }}>📡 Documents saved to this device. They'll still be here next time you open the app.</div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
    </div>
  );
}

// ─── PROJECT CHAT SCREEN ────────────────────────────────────────────────────────
// A focused, self-contained chat space per project topic. Reuses the same underlying
// engine as TarsScreen (generic actions, module registry, web + vault search) but with
// its own simpler UI and its own permanent conversation — no separate "memory summary"
// step needed, given Neil's projects are expected to stay small: the conversation itself
// IS the memory, persisted directly, read back in full next time the project is opened.
function ProjectChatScreen({ onBack, projectId, projects, setProjects, appState }) {
  const { tasks, setTasks, calLog, setCalLog, calEvents, addCalEvent, removeCalEvent, healthEntries, setHealthEntries, todayLabel, rotationBlocks } = appState;
  const project = projects.find(p => p.id === projectId);

  const [messages, setMessages] = usePersistentState(`project_chat_${projectId}`, []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [vault] = usePersistentState("tars_vault", []); // shared vault, read-only here — Projects can reference it but vault management stays in TARS

  // Mark this project as recently active whenever its chat is opened
  useEffect(() => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, lastActive: Date.now() } : p));
  }, []);

  const buildProjectPrompt = () => {
    const now = new Date();
    const today = now.toLocaleDateString("en-NZ", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
    const dateAnchor = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now); d.setDate(now.getDate() + i);
      const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-NZ", { weekday:"long" });
      dateAnchor.push(`${label}: ${d.toLocaleDateString("en-CA")} (${d.toLocaleDateString("en-NZ",{weekday:"long",day:"numeric",month:"long"})})`);
    }
    const pendingTasks = tasks.filter(t=>!t.done).map(t=>`id:${t.id} "${t.text}"`).join(", ") || "none";
    const vaultIndex = vault.map(d => `id:${d.id} | ${d.name} | ${d.docType} | ${d.summary?.slice(0,100)||""}`).join("\n") || "empty";

    return `You are TARS, Neil's personal AI, currently working with him inside a focused PROJECT space called "${project?.name || "this project"}". This is a dedicated workspace for this specific topic — keep the conversation focused on it.

VOICE: Same as always — direct, dry, specific, no corporate assistant energy, no markdown formatting since you don't need to (this is a text-only space, but keep it clean and conversational regardless).

You are NOT just an assistant with static knowledge — you have a web_search tool. Use it freely for anything current: opening hours, prices, what's on, addresses, travel times, current events, anything time-sensitive or specific to a place. When Neil says "google" something he means search the web for it. Don't rely on stale training knowledge for anything that could have changed.

You also have full access to the rest of Neil's Life app via the same generic action system used in main TARS chat — you can add tasks, add calendar events, log things, exactly as TARS normally does, all requiring confirmation first via the ACTION protocol below.

MODULE REGISTRY (module name : what it holds : fields):
${Object.entries(MODULE_REGISTRY).map(([key,m])=>`${key} : ${m.label} : ${m.fields}`).join("\n")}

ACTION PROTOCOL — CRITICAL: When proposing any action (add, update, delete, move), you MUST include the ACTION block in the SAME message as your confirmation request — not in a later message after Neil says "yes". The confirmation card appears when you output the ACTION block, so if you ask "confirm?" without including an ACTION block in that same reply, the card never appears and Neil has to say yes twice. Always: state what you're doing, ask confirm, include ACTION block — all in one single reply.
ACTION:{"type":"generic","module":"<module>","op":"create|update|delete","id":"<id if needed>","fields":{...}}

DATE FORMAT — CRITICAL: All dates you speak or write must be day-first. Spell the month out in full (e.g. "4 July 2026") or use DD/MM/YYYY numerically (e.g. "04/07/2026"). NEVER write MM/DD/YYYY American-style. The "date" field inside any ACTION block must always be YYYY-MM-DD internally (that's just data format, not what Neil reads) — but anything you say to Neil in plain text must be day-first.

DATE REFERENCE (today and next 13 days):
${dateAnchor.join("\n")}

LIVE DATA:
Today is ${today}.
Pending tasks: ${pendingTasks}
Vault documents available (use search_vault to read one in full if relevant): ${vaultIndex}

This project's conversation history below IS its memory — there's no separate save step, everything here persists automatically.`;
  };

  const sendMessage = async (textOverride) => {
    const text = (textOverride !== undefined ? textOverride : input).trim();
    if (!text || loading) return;
    setInput("");
    if (pendingAction) setPendingAction(null);

    const userMsg = { role:"user", content:text, ts:new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}) };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = newMessages.filter(m=>typeof m.content==="string").map(m=>({role:m.role, content:m.content}));

      const vaultTool = {
        name: "search_vault",
        description: "Search Neil's document vault to retrieve the full content of a specific document (flights, hotels, bookings etc) when relevant to this project.",
        input_schema: { type:"object", properties:{ documentId:{ type:"string", description:"The id of the document to retrieve" } }, required:["documentId"] }
      };
      const toolHandlers = {
        search_vault: async (input) => {
          const doc = vault.find(d => String(d.id) === String(input.documentId));
          if (!doc) return "Document not found in vault.";
          if (doc.contentKind === "text" && doc.fullContent) return `Full content of "${doc.name}":\n\n${doc.fullContent}`;
          if (doc.contentKind === "pdf" && doc.fullContent) return [{ type:"document", source:{ type:"base64", media_type:"application/pdf", data:doc.fullContent } }, { type:"text", text:`Full PDF for "${doc.name}".` }];
          return `Document "${doc.name}": ${doc.summary || "No summary available."}`;
        }
      };

      const reply = await callClaudeWithTools({
        system: buildProjectPrompt(),
        messages: apiMessages,
        tools: [vaultTool, WEB_SEARCH_TOOL],
        toolHandlers,
      });

      const display = reply.replace(/\nACTION:\{[^\n]+\}/g, "").replace(/ACTION:\{[^\n]+\}/g, "").trim();
      setMessages(prev => [...prev, { role:"assistant", content:display, ts:new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}) }]);

      const actionMatch = reply.match(/ACTION:(\{[^\n]+\})/);
      if (actionMatch) {
        try {
          const data = JSON.parse(actionMatch[1]);
          if (data.type === "generic") {
            const moduleInfo = MODULE_REGISTRY[data.module];
            const moduleLabel = moduleInfo?.label || data.module;
            const formatFieldValue = (k,v) => (typeof v==="string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? formatDateDDMMYYYY(v) : v;
            const fieldsDisplay = Object.entries(data.fields||{}).map(([k,v])=>`${k}: ${formatFieldValue(k,v)}`).join(", ");
            let desc = data.op === "create" ? `Add to ${moduleLabel}: ${fieldsDisplay}`
              : data.op === "update" ? `Update ${moduleLabel} record`
              : data.op === "delete" ? `Delete from ${moduleLabel}` : `${data.op} on ${moduleLabel}`;
            setPendingAction({ module:data.module, op:data.op, id:data.id, fields:data.fields||{}, description:desc });
          }
        } catch {}
      }
    } catch (err) {
      setMessages(prev => [...prev, { role:"assistant", content: err.message==="NO_KEY" ? "No Anthropic API key set — add one via TARS settings first." : `Error: ${err.message}`, ts:"", isError:true }]);
    }
    setLoading(false);
  };

  const [pendingFile, setPendingFile] = useState(null);
  const [fileComment, setFileComment] = useState("");

  // ── File pre-processor for Projects — same pattern as main TARS ──
  const toBase64Project = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });

  const handleProjectFile = async (e, isCamera) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await toBase64Project(file);
      const isImage = file.type.startsWith("image/");
      if (isImage) {
        // Images go straight to pending with a comment box
        setPendingFile({ file, base64, isImage: true, preview: URL.createObjectURL(file) });
        setFileComment("");
      } else {
        // Non-images — stage for comment then send
        setPendingFile({ file, base64, isImage: false });
        setFileComment("");
      }
    } catch(err) {
      setMessages(prev => [...prev, { role:"assistant", content:`Could not read that file — ${err.message}`, ts:"", isError:true }]);
    }
    e.target.value = "";
  };

  const sendPendingProjectFile = async () => {
    if (!pendingFile || loading) return;
    setLoading(true);
    const { file, base64, isImage } = pendingFile;
    const ts = new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"});
    const userLabel = isImage ? (pendingFile.preview ? "[Photo]" : `[${file.name}]`) : `[${file.name}]`;
    setMessages(prev => [...prev, {
      role:"user", content:`${userLabel}${fileComment ? ` — "${fileComment}"` : ""}`, ts,
      ...(isImage && pendingFile.preview ? { isPhoto:true, photoUrl:pendingFile.preview } : {})
    }]);
    setPendingFile(null);
    setFileComment("");
    try {
      const msgContent = isImage
        ? [{ type:"image", source:{ type:"base64", media_type:file.type, data:base64 }}, { type:"text", text: fileComment || "What is this? Help me use it in this project." }]
        : [{ type:"text", text:`File: ${file.name}\n\nInstruction: ${fileComment || "Read this and help me use it in this project."}` }];
      const reply = await callClaudeWithTools({
        system: buildProjectPrompt(),
        messages: [{ role:"user", content: msgContent }],
        tools: [{ name:"search_vault", description:"Search Neil's document vault.", input_schema:{ type:"object", properties:{ documentId:{ type:"string" } }, required:["documentId"] } }, WEB_SEARCH_TOOL],
        toolHandlers: { search_vault: async (input) => { const doc = vault.find(d=>String(d.id)===String(input.documentId)); return doc ? (doc.contentKind==="text"&&doc.fullContent ? `Full content of "${doc.name}":\n\n${doc.fullContent}` : doc.summary||"No summary.") : "Document not found."; } },
      });
      const display = reply.replace(/\nACTION:\{[^\n]+\}/g,"").replace(/ACTION:\{[^\n]+\}/g,"").trim();
      setMessages(prev => [...prev, { role:"assistant", content:display, ts }]);
      const actionMatch = reply.match(/ACTION:(\{[^\n]+\})/);
      if (actionMatch) {
        try {
          const data = JSON.parse(actionMatch[1]);
          if (data.type === "generic") {
            const ml = MODULE_REGISTRY[data.module]?.label || data.module;
            const fv = (k,v) => (typeof v==="string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? formatDateDDMMYYYY(v) : v;
            const fd = Object.entries(data.fields||{}).map(([k,v])=>`${k}: ${fv(k,v)}`).join(", ");
            // Build a human-readable description that includes the title/name wherever possible
            const titleHint = data.fields?.title || data.fields?.text || data.fields?.name || "";
            const dateHint = data.fields?.date ? ` on ${formatDateDDMMYYYY(data.fields.date)}` : "";
            let desc;
            if (data.op === "create") desc = `Add to ${ml}: ${fd}`;
            else if (data.op === "update") desc = `Update${titleHint ? ` "${titleHint}"` : ""} in ${ml}${dateHint}: ${fd}`;
            else if (data.op === "delete") desc = `Delete${titleHint ? ` "${titleHint}"` : ""}${dateHint} from ${ml}`;
            else desc = `${data.op} on ${ml}`;
            setPendingAction({ module:data.module, op:data.op, id:data.id, fields:data.fields||{}, description:desc });
          }
        } catch {}
      }
    } catch(err) {
      setMessages(prev => [...prev, { role:"assistant", content:`Error: ${err.message}`, ts:"", isError:true }]);
    }
    setLoading(false);
  };
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition not supported. Use Chrome."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-NZ";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
      setInput(transcript);
    };
    recognition.onend = () => {
      setListening(false);
      setInput(prev => {
        if (prev.trim()) {
          setTimeout(() => sendMessage(prev.trim()), 100);
          return "";
        }
        return prev;
      });
    };
    recognition.onerror = () => setListening(false);
    recognition.start();
  };

  // Reuse the same generic executor logic as TarsScreen, scoped to this component's setters
  const executeProjectAction = (action) => {
    const { module, op, id, fields } = action;
    if (module === "tasks") {
      if (op === "create") setTasks(prev => [...prev, { id:Date.now(), text:fields.text, cat:fields.cat||"Admin", priority:fields.priority||"med", due:fields.due||"", done:false }]);
      else if (op === "update") setTasks(prev => prev.map(t => String(t.id)===String(id) ? {...t, ...fields} : t));
      else if (op === "delete") setTasks(prev => prev.filter(t => String(t.id)!==String(id)));
    } else if (module === "calendar") {
      if (op === "create") addCalEvent({ type:fields.type||"reminder", date:fields.date, title:fields.title, notes:fields.notes||"", time:fields.time||"", location:fields.location||"" });
      else if (op === "update") { const target = calEvents.find(e=>String(e.id)===String(id)); if(target){ removeCalEvent(target.id); addCalEvent({...target, ...fields}); } }
      else if (op === "delete") { if(id) removeCalEvent(id); }
    } else if (module === "calorieLog") {
      if (op === "create") { const entry={id:Date.now(),name:fields.name,kcal:fields.kcal||0,protein:fields.protein||0,time:new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"})}; setCalLog(prev=>({...prev,[todayLabel]:[...(prev[todayLabel]||[]),entry]})); }
    } else if (module === "health") {
      const latest = healthEntries[healthEntries.length-1] || {};
      setHealthEntries(prev => [...prev, { date:new Date().toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"}), weight:fields.weight||latest.weight, bodyFat:fields.bodyFat||latest.bodyFat, fatMass:fields.fatMass||latest.fatMass, muscle:fields.muscle||latest.muscle, bp:fields.bp||latest.bp }]);
    }
    setPendingAction(null);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", borderBottom:`1px solid ${T.border}`, background:T.bg }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}><Icon name="back" size={20} color={T.text} /></button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{project?.name || "Project"}</div>
          <div style={{ fontSize:10, color:T.muted }}>Web search · Full app access</div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign:"center", color:T.muted, fontSize:12, padding:"40px 20px", lineHeight:1.6 }}>
            New project space for "{project?.name}". Ask TARS anything — he can search the web, check the vault, and update your tasks or calendar as you go.
          </div>
        )}
        {messages.map((msg,i)=>(
          <div key={i} style={{ display:"flex", justifyContent: msg.role==="user"?"flex-end":"flex-start" }}>
            <div style={{ maxWidth:"82%", padding:"10px 14px", borderRadius: msg.role==="user"?"18px 18px 4px 18px":"4px 18px 18px 18px", background: msg.role==="user"?T.blue:(msg.isError?`${T.accent}18`:T.card), color: msg.role==="user"?"white":T.text, border: msg.role==="user"?"none":`1px solid ${msg.isError?T.accent+"44":T.border}`, fontSize:13, lineHeight:1.5, whiteSpace:"pre-wrap" }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex" }}>
            <div style={{ padding:"10px 16px", borderRadius:"4px 18px 18px 18px", background:T.card, border:`1px solid ${T.border}` }}>
              <div style={{ display:"flex", gap:5 }}>{[0,1,2].map(i=>(<div key={i} style={{ width:7, height:7, borderRadius:"50%", background:T.blue, animation:"pulse 1.2s ease-in-out infinite", animationDelay:`${i*0.2}s`, opacity:0.7 }}/>))}</div>
            </div>
          </div>
        )}
      </div>

      {pendingAction && (
        <div style={{ margin:"0 16px 8px", background:`${T.gold}18`, border:`1px solid ${T.gold}44`, borderRadius:12, padding:"10px 14px" }}>
          <div style={{ fontSize:12, color:T.gold, fontWeight:700, marginBottom:4 }}>⚡ Pending action</div>
          <div style={{ fontSize:12, color:T.text, marginBottom:10, lineHeight:1.5 }}>{pendingAction.description}</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>{ executeProjectAction(pendingAction); setMessages(prev=>[...prev,{role:"assistant",content:"Done.",ts:new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"})}]); }} style={{ flex:1, padding:"10px", borderRadius:8, background:T.green, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>✓ Confirm</button>
            <button onClick={()=>{ setPendingAction(null); setMessages(prev=>[...prev,{role:"assistant",content:"Cancelled.",ts:new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"})}]); }} style={{ flex:1, padding:"10px", borderRadius:8, background:T.elevated, color:T.muted, fontWeight:700, fontSize:13, border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:"inherit" }}>✕ Cancel</button>
          </div>
        </div>
      )}

      {/* Staged file — comment input */}
      {pendingFile && (
        <div style={{ margin:"0 16px 8px", background:T.elevated, border:`1px solid ${T.blue}44`, borderRadius:12, padding:"10px 14px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            {pendingFile.preview && <img src={pendingFile.preview} alt="" style={{ width:48, height:48, borderRadius:8, objectFit:"cover" }} />}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{pendingFile.file.name || "Photo"}</div>
              <div style={{ fontSize:10, color:T.muted }}>{pendingFile.isImage ? "Image" : "Document"}</div>
            </div>
            <button onClick={()=>{ setPendingFile(null); setFileComment(""); }} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:16, padding:"2px 6px" }}>✕</button>
          </div>
          <input value={fileComment} onChange={e=>setFileComment(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendPendingProjectFile(); }}}
            placeholder="What do you need? e.g. add dates to calendar, summarise this..."
            style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.bg, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:8 }} autoFocus />
          <button onClick={sendPendingProjectFile} disabled={loading} style={{ width:"100%", padding:"9px", borderRadius:9, background:loading?T.elevated:T.blue, color:loading?T.muted:"white", fontWeight:700, fontSize:13, border:"none", cursor:loading?"not-allowed":"pointer", fontFamily:"inherit" }}>
            {loading ? "Processing…" : "Send to TARS"}
          </button>
        </div>
      )}

      <div style={{ borderTop:`1px solid ${T.border}`, padding:"10px 16px 20px" }}>
        {/* Top row — camera and file */}
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <label style={{ flex:1, padding:"7px 0", borderRadius:10, border:`1px solid ${T.border}`, background:T.elevated, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <span style={{ fontSize:15 }}>📷</span>
            <span style={{ fontSize:11, fontWeight:600, color:T.muted }}>Camera</span>
            <input type="file" accept="image/*" capture="environment" onChange={e=>handleProjectFile(e,true)} style={{ display:"none" }} />
          </label>
          <label style={{ flex:1, padding:"7px 0", borderRadius:10, border:`1px solid ${T.border}`, background:T.elevated, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <span style={{ fontSize:15 }}>📎</span>
            <span style={{ fontSize:11, fontWeight:600, color:T.muted }}>File</span>
            <input type="file" accept=".pdf,.txt,.md,.csv,.xlsx,.xls,.docx,.doc,image/*" onChange={e=>handleProjectFile(e,false)} style={{ display:"none" }} />
          </label>
        </div>
        {/* Bottom row — mic, text input, send */}
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <button onClick={startListening} disabled={listening} style={{ width:40, height:40, borderRadius:"50%", background:listening?`${T.accent}22`:T.elevated, border:`1px solid ${listening?T.accent:T.border}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Icon name="mic" size={16} color={listening?T.accent:T.muted} />
        </button>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter") sendMessage(); }}
          placeholder={listening ? "Listening..." : "Ask TARS about this project..."}
          style={{ flex:1, padding:"11px 14px", borderRadius:999, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none" }}
        />
        <button onClick={()=>sendMessage()} disabled={loading} style={{ width:40, height:40, borderRadius:"50%", background:T.blue, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity:loading?0.5:1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
        </button>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
    </div>
  );
}

// ─── INITIAL CALENDAR DATA ────────────────────────────────────────────────────
const INIT_ROTATION = [
  // 2026 — confirmed
  { id:1,  start:"2026-01-01", end:"2026-01-31", vessel:"Man of Steel", notes:"" },
  { id:2,  start:"2026-02-01", end:"2026-02-03", vessel:"Man of Steel", notes:"" },
  { id:3,  start:"2026-03-25", end:"2026-03-31", vessel:"Man of Steel", notes:"" },
  { id:4,  start:"2026-05-01", end:"2026-05-24", vessel:"Man of Steel", notes:"" },
  { id:5,  start:"2026-07-22", end:"2026-07-31", vessel:"Man of Steel", notes:"" },
  { id:6,  start:"2026-08-01", end:"2026-08-31", vessel:"Man of Steel", notes:"" },
  { id:7,  start:"2026-09-01", end:"2026-09-21", vessel:"Man of Steel", notes:"" },
  { id:8,  start:"2026-11-01", end:"2026-11-30", vessel:"Man of Steel", notes:"" },
  { id:9,  start:"2026-12-19", end:"2026-12-31", vessel:"Man of Steel", notes:"" },
  // 2027 — unconfirmed placeholders
  { id:10, start:"2027-02-18", end:"2027-02-28", vessel:"Man of Steel", notes:"⚠️ Unconfirmed" },
  { id:11, start:"2027-03-01", end:"2027-03-31", vessel:"Man of Steel", notes:"⚠️ Unconfirmed" },
  { id:12, start:"2027-04-01", end:"2027-04-09", vessel:"Man of Steel", notes:"⚠️ Unconfirmed" },
  { id:13, start:"2027-06-11", end:"2027-06-30", vessel:"Man of Steel", notes:"⚠️ Unconfirmed" },
  { id:14, start:"2027-07-01", end:"2027-07-31", vessel:"Man of Steel", notes:"⚠️ Unconfirmed" },
  { id:15, start:"2027-08-01", end:"2027-08-03", vessel:"Man of Steel", notes:"⚠️ Unconfirmed" },
  { id:16, start:"2027-10-01", end:"2027-10-31", vessel:"Man of Steel", notes:"⚠️ Unconfirmed" },
];

const INIT_CAL_EVENTS = [];

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function LifeApp() {
  // ── Fix the outer page white border — this isn't coming from anything inside this
  // component, it's the default browser body margin + white background on the page
  // shell outside React's control (index.html). This forces it to match the app at
  // runtime so there's no visible gap on any screen size, including wider phones like
  // the S24 Ultra where the centered max-width container used to leave a visible edge. ──
  useEffect(() => {
    const prevBodyMargin = document.body.style.margin;
    const prevBodyBg = document.body.style.background;
    const prevHtmlBg = document.documentElement.style.background;
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.background = T.bg;
    document.documentElement.style.background = T.bg;
    document.documentElement.style.margin = "0";
    // Also catch any wrapping container around the React mount point itself
    const root = document.getElementById("root") || document.getElementById("app");
    let prevRootStyle = null;
    if (root) {
      prevRootStyle = { margin: root.style.margin, padding: root.style.padding, maxWidth: root.style.maxWidth, width: root.style.width };
      root.style.margin = "0";
      root.style.padding = "0";
      root.style.maxWidth = "none";
      root.style.width = "100%";
    }
    return () => {
      document.body.style.margin = prevBodyMargin;
      document.body.style.background = prevBodyBg;
      document.documentElement.style.background = prevHtmlBg;
      if (root && prevRootStyle) Object.assign(root.style, prevRootStyle);
    };
  }, []);

  const [screen, setScreen] = useState("home");

  const [tasks, setTasks] = usePersistentState("life_tasks", INIT_TASKS);

  // ── HEALTH STATE (source of truth — TARS can write here) ───────────────────
  const [healthEntries, setHealthEntries] = usePersistentState("life_health_entries", [{
    date:"26 Jun 2026", weight:USER.health.weight, bodyFat:USER.health.bodyFat,
    fatMass:USER.health.fatMass, muscle:USER.health.muscle, bp:USER.health.bp,
  }]);
  const todayLabel = new Date().toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"});
  const [calLog, setCalLog] = usePersistentState("life_cal_log", {});

  // ── TARS CHAT STATE — lives here (not inside TarsScreen) so it survives navigating
  // away and back, but resets naturally when the app is fully closed since it's plain
  // in-memory state, not localStorage. This matches the "stays while I'm working,
  // clears when I'm done for the day" behaviour Neil wanted. ──
  const [tarsMessages, setTarsMessages] = useState([]);

  // ── PROJECTS — each project topic is self-contained: its own permanent conversation
  // (stored separately in localStorage as `project_chat_<id>`), deletable as a whole
  // with zero impact elsewhere. This array just holds the lightweight topic list. ──
  const [projects, setProjects] = usePersistentState("life_projects", []);
  const [activeProjectId, setActiveProjectId] = useState(null);

  // ── CALENDAR STATE (source of truth for whole app) ──────────────────────────
  const [calEvents, setCalEvents] = usePersistentState("life_cal_events", INIT_CAL_EVENTS);
  const [rotationBlocks, setRotationBlocks] = usePersistentState("life_rotation_blocks", INIT_ROTATION);

  const addCalEvent    = (ev)  => setCalEvents(prev=>[...prev, {...ev, id:Date.now()}]);
  const removeCalEvent = (id)  => setCalEvents(prev=>prev.filter(e=>e.id!==id));
  const addRotation    = (blk) => setRotationBlocks(prev=>[...prev, {...blk, id:Date.now()}]);
  const removeRotation = (id)  => setRotationBlocks(prev=>prev.filter(b=>b.id!==id));

  // Derive next flight and rotation status for home screen
  const today = new Date(); today.setHours(0,0,0,0);
  const upcomingFlights = calEvents
    .filter(e=>e.type==="flight" && new Date(e.date) >= today)
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  const nextFlight = upcomingFlights[0] || null;

  const currentRotation = rotationBlocks.find(b=>{
    const s = new Date(b.start); s.setHours(0,0,0,0);
    const e = new Date(b.end);   e.setHours(0,0,0,0);
    return today >= s && today <= e;
  });
  const nextRotation = rotationBlocks
    .filter(b=>new Date(b.start)>today)
    .sort((a,b)=>new Date(a.start)-new Date(b.start))[0];

  const rotationInfo = currentRotation ? {
    isOn: true,
    phase: "On Rotation · Man of Steel",
    daysLeft: Math.ceil((new Date(currentRotation.end)-today)/(1000*60*60*24)),
  } : nextRotation ? {
    isOn: false,
    phase: "Off Rotation",
    daysLeft: Math.ceil((new Date(nextRotation.start)-today)/(1000*60*60*24)),
  } : { isOn:false, phase:"Off Rotation", daysLeft:0 };

  const toggleTask = (id) => setTasks(prev => prev.map(t => t.id===id ? {...t, done:!t.done} : t));

  const renderScreen = () => {
    switch(screen) {
      case "home":     return <HomeScreen onNavigate={setScreen} tasks={tasks} onToggleTask={toggleTask} nextFlight={nextFlight} rotationInfo={rotationInfo} />;
      case "health":   return <HealthScreen onBack={()=>setScreen("home")} entries={healthEntries} setEntries={setHealthEntries} calLog={calLog} setCalLog={setCalLog} />;
      case "tasks":    return <TodoScreen tasks={tasks} setTasks={setTasks} onBack={()=>setScreen("home")} />;
      case "calendar": return <CalendarScreen onBack={()=>setScreen("home")} calEvents={calEvents} rotationBlocks={rotationBlocks} addCalEvent={addCalEvent} removeCalEvent={removeCalEvent} addRotation={addRotation} removeRotation={removeRotation} tasks={tasks} />;
      case "finance":  return <ComingSoon label="Finance" icon="finance" accent={T.purple} onBack={()=>setScreen("home")} />;
      case "work":     return <ComingSoon label="Work" icon="work" accent={T.blue} onBack={()=>setScreen("home")} />;
      case "tars":     return <TarsScreen onBack={()=>setScreen("home")} appState={{ tasks, setTasks, calLog, setCalLog, calEvents, addCalEvent, removeCalEvent, healthEntries, setHealthEntries, todayLabel, setScreen, tarsMessages, setTarsMessages, rotationBlocks }} />;
      case "projects": return <ProjectsListScreen onBack={()=>setScreen("home")} projects={projects} setProjects={setProjects} onOpenProject={(id)=>{ setActiveProjectId(id); setScreen("projectChat"); }} />;
      case "projectChat": return <ProjectChatScreen onBack={()=>setScreen("projects")} projectId={activeProjectId} projects={projects} setProjects={setProjects} appState={{ tasks, setTasks, calLog, setCalLog, calEvents, addCalEvent, removeCalEvent, healthEntries, setHealthEntries, todayLabel, rotationBlocks }} />;
      default:         return <HomeScreen onNavigate={setScreen} tasks={tasks} onToggleTask={toggleTask} nextFlight={nextFlight} rotationInfo={rotationInfo} />;
    }
  };

  return (
    <div style={{ background:T.bg, minHeight:"100vh", fontFamily:"'Inter', system-ui, -apple-system, sans-serif", color:T.text, width:"100%", position:"relative", overscrollBehaviorX:"none" }}>
      <div style={{ position:"sticky", top:0, zIndex:50, background:`${T.bg}ee`, backdropFilter:"blur(12px)", borderBottom:`1px solid ${T.border}`, padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <button onClick={()=>setScreen("home")} style={{ background:"none", border:"none", padding:0, cursor:"pointer", fontSize:18, fontWeight:800, letterSpacing:"-0.02em", color:T.text, fontFamily:"inherit" }}>LIFE<span style={{ color:T.accent }}>.</span></button>
        <button onClick={()=>setScreen("tars")} style={{ background:T.elevated, border:`1px solid ${T.border}`, borderRadius:999, padding:"6px 12px", display:"flex", alignItems:"center", gap:6, cursor:"pointer", color:T.blue, fontSize:11, fontWeight:700 }}>
          <Icon name="mic" size={12} color={T.blue} /> TARS
        </button>
      </div>
      <div>{renderScreen()}</div>
    </div>
  );
}
