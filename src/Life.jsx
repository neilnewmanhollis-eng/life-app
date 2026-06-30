import { useState, useEffect } from "react";

// ─── ANTHROPIC API HELPER ────────────────────────────────────────────────────
function getAnthropicKey() {
  return localStorage.getItem("tars_anthropic_key") || "";
}

async function callClaude({ system, messages }) {
  const apiKey = getAnthropicKey();
  if (!apiKey) throw new Error("NO_KEY");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: system || "",
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content?.map(b => b.text || "").join("") || "";
}

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

const MEAL_LIBRARY = [
  { id:1,  cat:"Fish",    tag:"Fish",    name:"Pan-seared salmon + garlic spinach & cucumber salad",            kcal:670, protein:56, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Fish",name:"Salmon fillets",qty:"440g"},{cat:"Produce",name:"Baby spinach",qty:"Large bag"},{cat:"Produce",name:"Cucumber",qty:"1"},{cat:"Produce",name:"Lemon",qty:"1"},{cat:"Pantry",name:"Garlic",qty:"—"},{cat:"Pantry",name:"Olive oil",qty:"—"}]},
  { id:2,  cat:"Fish",    tag:"Fish",    name:"Baked cod with lemon butter + roasted asparagus & cherry tomatoes", kcal:580, protein:52, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Fish",name:"Cod fillets",qty:"440g"},{cat:"Produce",name:"Asparagus",qty:"1 bunch"},{cat:"Produce",name:"Cherry tomatoes",qty:"1 punnet"},{cat:"Produce",name:"Lemon",qty:"1"},{cat:"Dairy",name:"Butter",qty:"50g"},{cat:"Pantry",name:"Garlic",qty:"—"}]},
  { id:3,  cat:"Seafood", tag:"Seafood", name:"Garlic prawn stir-fry + bok choy, snap peas & brown rice",          kcal:620, protein:48, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Seafood",name:"Raw prawns (peeled)",qty:"500g"},{cat:"Produce",name:"Bok choy",qty:"2 heads"},{cat:"Produce",name:"Snap peas",qty:"200g"},{cat:"Pantry",name:"Brown rice",qty:"200g"},{cat:"Pantry",name:"Garlic",qty:"—"},{cat:"Pantry",name:"Soy sauce",qty:"—"}]},
  { id:4,  cat:"Fish",    tag:"Fish",    name:"Tuna steak with sesame crust + steamed broccoli & edamame",          kcal:640, protein:60, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Fish",name:"Tuna steaks",qty:"440g"},{cat:"Produce",name:"Broccoli",qty:"1 large head"},{cat:"Frozen",name:"Edamame",qty:"200g"},{cat:"Pantry",name:"Sesame seeds",qty:"3 tbsp"},{cat:"Pantry",name:"Soy sauce",qty:"—"}]},
  { id:5,  cat:"Fish",    tag:"Fish",    name:"Miso-glazed salmon + roasted sweet potato & kale salad",             kcal:690, protein:54, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Fish",name:"Salmon fillets",qty:"440g"},{cat:"Produce",name:"Sweet potato",qty:"2 medium"},{cat:"Produce",name:"Kale",qty:"1 bunch"},{cat:"Pantry",name:"White miso paste",qty:"2 tbsp"},{cat:"Pantry",name:"Honey",qty:"1 tbsp"}]},
  { id:6,  cat:"Chicken", tag:"Chicken", name:"Lemon herb chicken thighs + roasted capsicum & green beans",          kcal:680, protein:58, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Meat",name:"Chicken thighs (boneless)",qty:"400g"},{cat:"Produce",name:"Capsicum",qty:"2"},{cat:"Produce",name:"Green beans",qty:"200g"},{cat:"Produce",name:"Lemon",qty:"1"},{cat:"Pantry",name:"Olive oil",qty:"—"}]},
  { id:7,  cat:"Chicken", tag:"Chicken", name:"Greek chicken breast + tzatziki, cucumber & tomato salad",            kcal:580, protein:62, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Meat",name:"Chicken breast",qty:"400g"},{cat:"Dairy",name:"Greek yoghurt",qty:"200g"},{cat:"Produce",name:"Cucumber",qty:"1"},{cat:"Produce",name:"Tomatoes",qty:"2"},{cat:"Pantry",name:"Garlic",qty:"—"}]},
  { id:8,  cat:"Chicken", tag:"Chicken", name:"Thai-style chicken larb + lettuce cups, mint & lime",                 kcal:540, protein:55, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Meat",name:"Chicken mince",qty:"400g"},{cat:"Produce",name:"Cos lettuce",qty:"1 head"},{cat:"Produce",name:"Fresh mint",qty:"1 bunch"},{cat:"Produce",name:"Lime",qty:"2"},{cat:"Pantry",name:"Fish sauce",qty:"—"}]},
  { id:9,  cat:"Chicken", tag:"Chicken", name:"Tandoori chicken thighs + roasted cauliflower & Greek yoghurt",       kcal:620, protein:57, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Meat",name:"Chicken thighs",qty:"400g"},{cat:"Dairy",name:"Greek yoghurt",qty:"200g"},{cat:"Produce",name:"Cauliflower",qty:"1 head"},{cat:"Pantry",name:"Tandoori paste",qty:"2 tbsp"}]},
  { id:10, cat:"Beef",    tag:"Beef",    name:"Beef stir-fry + zucchini, broccoli & soy-ginger sauce",               kcal:690, protein:55, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Meat",name:"Beef rump strips",qty:"420g"},{cat:"Produce",name:"Zucchini",qty:"2"},{cat:"Produce",name:"Broccoli",qty:"1 head"},{cat:"Pantry",name:"Soy sauce",qty:"—"},{cat:"Pantry",name:"Ground ginger",qty:"—"}]},
  { id:11, cat:"Lamb",    tag:"Lamb",    name:"Lamb mince lettuce cups + cucumber, tomato & tzatziki",                kcal:660, protein:54, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Meat",name:"Lamb mince",qty:"400g"},{cat:"Produce",name:"Cos lettuce",qty:"1 head"},{cat:"Produce",name:"Cucumber",qty:"1"},{cat:"Produce",name:"Cherry tomatoes",qty:"1 punnet"},{cat:"Dairy",name:"Greek yoghurt",qty:"150g"}]},
  { id:12, cat:"Beef",    tag:"Beef",    name:"Sirloin steak + sautéed mushrooms, wilted spinach & garlic",           kcal:700, protein:58, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Meat",name:"Sirloin steak",qty:"420g"},{cat:"Produce",name:"Mushrooms",qty:"300g"},{cat:"Produce",name:"Baby spinach",qty:"150g"},{cat:"Pantry",name:"Garlic",qty:"—"},{cat:"Dairy",name:"Butter",qty:"30g"}]},
  { id:13, cat:"Lamb",    tag:"Lamb",    name:"Moroccan lamb mince + roasted eggplant, chickpeas & mint yoghurt",     kcal:680, protein:52, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Meat",name:"Lamb mince",qty:"400g"},{cat:"Produce",name:"Eggplant",qty:"1 large"},{cat:"Pantry",name:"Canned chickpeas",qty:"1 can"},{cat:"Dairy",name:"Greek yoghurt",qty:"150g"},{cat:"Produce",name:"Fresh mint",qty:"small bunch"}]},
  { id:14, cat:"Beef",    tag:"Beef",    name:"Korean-style beef bowl + shredded cabbage, cucumber & sesame",         kcal:670, protein:53, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Meat",name:"Beef mince",qty:"420g"},{cat:"Produce",name:"Cabbage",qty:"¼ head"},{cat:"Produce",name:"Cucumber",qty:"1"},{cat:"Pantry",name:"Soy sauce",qty:"—"},{cat:"Pantry",name:"Sesame oil",qty:"—"},{cat:"Pantry",name:"Gochujang",qty:"1 tbsp"}]},
  { id:15, cat:"Eggs",    tag:"Eggs",    name:"Baked eggs in spiced tomato sauce (shakshuka) + feta & spinach",       kcal:520, protein:38, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Eggs",name:"Eggs",qty:"6 large"},{cat:"Pantry",name:"Canned crushed tomatoes",qty:"1 can"},{cat:"Dairy",name:"Feta cheese",qty:"100g"},{cat:"Produce",name:"Baby spinach",qty:"Large handful"},{cat:"Pantry",name:"Smoked paprika",qty:"—"}]},
  { id:16, cat:"Eggs",    tag:"Eggs+Chicken", name:"Chicken & feta frittata + roasted capsicum & rocket salad",       kcal:580, protein:50, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Meat",name:"Chicken breast",qty:"250g"},{cat:"Eggs",name:"Eggs",qty:"6 large"},{cat:"Dairy",name:"Feta cheese",qty:"100g"},{cat:"Produce",name:"Capsicum",qty:"1"},{cat:"Produce",name:"Rocket",qty:"Large bag"}]},
  { id:17, cat:"Other",   tag:"Pork",    name:"Pork tenderloin + apple slaw, green beans & Dijon mustard",            kcal:620, protein:56, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Meat",name:"Pork tenderloin",qty:"400g"},{cat:"Produce",name:"Apple",qty:"1"},{cat:"Produce",name:"Green cabbage",qty:"¼ head"},{cat:"Produce",name:"Green beans",qty:"200g"},{cat:"Pantry",name:"Dijon mustard",qty:"1 tbsp"}]},
  { id:18, cat:"Other",   tag:"Turkey",  name:"Turkey mince bolognese + zucchini noodles & parmesan",                 kcal:590, protein:54, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Meat",name:"Turkey mince",qty:"400g"},{cat:"Produce",name:"Zucchini",qty:"3 large"},{cat:"Pantry",name:"Canned crushed tomatoes",qty:"1 can"},{cat:"Dairy",name:"Parmesan",qty:"40g"}]},
  { id:19, cat:"Seafood", tag:"Seafood", name:"Scallops + pancetta, wilted spinach & cauliflower purée",              kcal:560, protein:46, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Seafood",name:"Scallops",qty:"400g"},{cat:"Meat",name:"Pancetta",qty:"80g"},{cat:"Produce",name:"Baby spinach",qty:"Large bag"},{cat:"Produce",name:"Cauliflower",qty:"1 head"},{cat:"Dairy",name:"Butter",qty:"40g"}]},
  { id:20, cat:"Fish",    tag:"Fish+Dairy", name:"Smoked salmon & ricotta frittata + mixed greens & capers",          kcal:550, protein:48, fav:false, cooked:false, rating:0, cookAgain:null, notes:"", cookedDate:"",
    ingredients:[{cat:"Fish",name:"Smoked salmon",qty:"200g"},{cat:"Dairy",name:"Ricotta cheese",qty:"150g"},{cat:"Eggs",name:"Eggs",qty:"6 large"},{cat:"Produce",name:"Mixed greens",qty:"Large bag"},{cat:"Pantry",name:"Capers",qty:"2 tbsp"}]},
];

const MEALS = MEAL_LIBRARY.slice(0,4);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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
              <button onClick={() => remove(task.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:2, opacity:0.4 }}>
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

// ─── SHOPPING LIST COMPONENT (extracted to fix hooks-in-inline-function crash) ─
function MealShoppingList({ selectedMeals, mealLib, onBack, shopCustom, setShopCustom, pantry }) {
  const [checkedShop, setCheckedShop] = useState({});
  const [shopCustomInput, setShopCustomInput] = useState("");

  const CAT_ORDER_SHOP = ["Produce","Meat","Fish","Seafood","Dairy","Eggs","Frozen","Pantry"];
  const CAT_ICONS_SHOP = { Fish:"🐟", Seafood:"🦐", Meat:"🥩", Eggs:"🥚", Dairy:"🧀", Produce:"🥦", Frozen:"❄️", Pantry:"🫙" };

  const toggleShop = (k) => setCheckedShop(p=>({...p,[k]:!p[k]}));

  // Build shopping list from selected meals
  const byKey = {};
  selectedMeals.forEach(id => {
    const m = mealLib.find(x=>x.id===id);
    if (!m) return;
    m.ingredients.forEach(ing => {
      const key = ing.cat+"||"+ing.name;
      if (!byKey[key]) byKey[key] = { cat:ing.cat, name:ing.name, qtys:[] };
      if (ing.qty && ing.qty!=="—") byKey[key].qtys.push(ing.qty);
    });
  });
  const cats = {};
  Object.values(byKey).forEach(item => {
    if (!cats[item.cat]) cats[item.cat] = [];
    cats[item.cat].push(item);
  });

  const addCustom = () => {
    if (!shopCustomInput.trim()) return;
    setShopCustom(p=>[...p,{id:Date.now(),name:shopCustomInput.trim()}]);
    setShopCustomInput("");
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Shopping List</div>
        <div style={{ fontSize:11, color:T.muted }}>{selectedMeals.size} meals · 2 serves each</div>
      </div>

      {/* Custom items input */}
      <Card>
        <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>Add your own items</div>
        <div style={{ display:"flex", gap:8 }}>
          <input value={shopCustomInput} onChange={e=>setShopCustomInput(e.target.value)}
            placeholder="e.g. Oat milk" onKeyDown={e=>e.key==="Enter"&&addCustom()}
            style={{ flex:1, padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none" }} />
          <button onClick={addCustom} style={{ padding:"8px 14px", borderRadius:8, background:T.blue, color:"white", border:"none", cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>+</button>
        </div>
        {shopCustom.length>0 && (
          <div style={{ marginTop:8 }}>
            {shopCustom.map(item=>(
              <div key={item.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 0", fontSize:12, color:T.muted }}>
                <span style={{ flex:1 }}>{item.name}</span>
                <button onClick={()=>setShopCustom(p=>p.filter(x=>x.id!==item.id))} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:14 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Meal ingredients by category */}
      {CAT_ORDER_SHOP.map(cat => !cats[cat] ? null : (
        <Card key={cat}>
          <SectionLabel>{CAT_ICONS_SHOP[cat]||"•"} {cat}</SectionLabel>
          {cats[cat].map(item => {
            const k = item.cat+item.name;
            const inPantry = pantry && pantry.find(p=>p.name.toLowerCase().includes(item.name.toLowerCase().split(" ")[0]));
            const isLow = inPantry?.status==="low";
            return (
              <div key={k} onClick={()=>toggleShop(k)} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:`1px solid ${T.border}`, cursor:"pointer", opacity:inPantry&&!isLow?0.5:1 }}>
                <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${checkedShop[k]?T.green:T.border}`, background:checkedShop[k]?T.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.12s" }}>
                  {checkedShop[k] && <Icon name="check" size={10} color="white" />}
                </div>
                <span style={{ flex:1, fontSize:13, color:checkedShop[k]?T.muted:T.text, textDecoration:checkedShop[k]?"line-through":"none" }}>{item.name}</span>
                {inPantry && !isLow && <span style={{ fontSize:9, fontWeight:700, color:T.green, background:`${T.green}22`, padding:"2px 6px", borderRadius:999 }}>✅ In pantry</span>}
                {inPantry && isLow && <span style={{ fontSize:9, fontWeight:700, color:T.gold, background:`${T.gold}22`, padding:"2px 6px", borderRadius:999 }}>⚠️ Running low</span>}
                {!inPantry && item.qtys.length>0 && <span style={{ fontSize:11, color:T.blue, fontWeight:600 }}>{item.qtys.join(" + ")}</span>}
              </div>
            );
          })}
        </Card>
      ))}

      {/* Custom items in list */}
      {shopCustom.length>0 && (
        <Card>
          <SectionLabel>🛒 Your additions</SectionLabel>
          {shopCustom.map(item=>{
            const k = "custom"+item.id;
            return (
              <div key={k} onClick={()=>toggleShop(k)} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:`1px solid ${T.border}`, cursor:"pointer" }}>
                <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${checkedShop[k]?T.green:T.border}`, background:checkedShop[k]?T.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.12s" }}>
                  {checkedShop[k] && <Icon name="check" size={10} color="white" />}
                </div>
                <span style={{ flex:1, fontSize:13, color:checkedShop[k]?T.muted:T.text, textDecoration:checkedShop[k]?"line-through":"none" }}>{item.name}</span>
              </div>
            );
          })}
        </Card>
      )}

      <button onClick={onBack} style={{ width:"100%", padding:"11px", borderRadius:12, background:T.elevated, color:T.muted, fontWeight:700, fontSize:13, border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:"inherit" }}>
        ← Back to meals
      </button>
    </div>
  );
}

// ─── INITIAL PANTRY DATA ─────────────────────────────────────────────────────
const INIT_PANTRY = [
  { id:1,  name:"Olive oil",          cat:"Pantry", type:"staple",   status:"have", qty:"Bottle" },
  { id:2,  name:"Soy sauce / tamari", cat:"Pantry", type:"staple",   status:"have", qty:"Bottle" },
  { id:3,  name:"Garlic",             cat:"Pantry", type:"staple",   status:"have", qty:"Bulb" },
  { id:4,  name:"Sesame oil",         cat:"Pantry", type:"staple",   status:"have", qty:"Bottle" },
  { id:5,  name:"Ground cumin",       cat:"Pantry", type:"staple",   status:"have", qty:"Jar" },
  { id:6,  name:"Smoked paprika",     cat:"Pantry", type:"staple",   status:"have", qty:"Jar" },
  { id:7,  name:"Dried oregano",      cat:"Pantry", type:"staple",   status:"have", qty:"Jar" },
  { id:8,  name:"Sesame seeds",       cat:"Pantry", type:"staple",   status:"have", qty:"Jar" },
  { id:9,  name:"Honey",              cat:"Pantry", type:"staple",   status:"have", qty:"Jar" },
  { id:10, name:"Dijon mustard",      cat:"Pantry", type:"packaged", status:"have", qty:"Jar" },
];

// ─── PANTRY DEPLETION MODAL ───────────────────────────────────────────────────
function PantryDepletionModal({ meal, pantry, depletionTypeFn, onConfirm, onSkip }) {
  const ingredients = meal.ingredients || [];
  const suggestions = ingredients.map(ing => ({
    name: ing.name, qty: ing.qty,
    type: depletionTypeFn(ing),
    defaultTick: depletionTypeFn(ing) !== "staple",
  }));
  const [ticked, setTicked] = useState(suggestions.reduce((a,s)=>({...a,[s.name]:s.defaultTick}),{}));
  const [partial, setPartial] = useState({});
  const toggleTick = (name) => setTicked(p=>({...p,[name]:!p[name]}));
  const togglePartial = (name) => setPartial(p=>({...p,[name]:!p[name]}));
  const TYPE_LABEL = { staple:"🟢 Staple", fresh:"🟡 Fresh", packaged:"🔵 Packaged" };
  const TYPE_DESC  = { staple:"Partially used — keeping", fresh:"Fully used — remove", packaged:"Used this pack — remove" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:300, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:T.card, borderRadius:"20px 20px 0 0", padding:"20px 16px 40px", width:"100%", maxWidth:480, margin:"0 auto", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:4 }}>Update Pantry</div>
        <div style={{ fontSize:12, color:T.muted, marginBottom:16 }}>Just cooked: <span style={{ color:T.blue }}>{meal.name}</span><br/>Review what was used.</div>
        {suggestions.map(s=>(
          <div key={s.name} style={{ background:T.elevated, borderRadius:12, padding:"11px 12px", marginBottom:8, border:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
              <div onClick={()=>s.type!=="staple"&&toggleTick(s.name)} style={{
                width:20, height:20, borderRadius:6, flexShrink:0, marginTop:1,
                border:`2px solid ${ticked[s.name]?T.green:T.border}`,
                background:ticked[s.name]?T.green:"transparent",
                display:"flex", alignItems:"center", justifyContent:"center",
                cursor:s.type==="staple"?"not-allowed":"pointer",
                opacity:s.type==="staple"?0.4:1, transition:"all 0.15s",
              }}>
                {ticked[s.name] && <Icon name="check" size={11} color="white" />}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{s.name}</span>
                  <span style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:999,
                    background:s.type==="staple"?`${T.green}22`:s.type==="fresh"?`${T.gold}22`:`${T.blue}22`,
                    color:s.type==="staple"?T.green:s.type==="fresh"?T.gold:T.blue,
                  }}>{TYPE_LABEL[s.type]}</span>
                </div>
                <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{TYPE_DESC[s.type]}</div>
                {s.type==="fresh" && ticked[s.name] && (
                  <button onClick={()=>togglePartial(s.name)} style={{ marginTop:6, padding:"3px 10px", borderRadius:999, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:10, fontWeight:700,
                    background:partial[s.name]?`${T.gold}33`:T.card, color:partial[s.name]?T.gold:T.muted }}>
                    {partial[s.name]?"🟡 Partial — keeping some":"✅ Fully used"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        <div style={{ display:"flex", gap:8, marginTop:16 }}>
          <button onClick={()=>onConfirm(ticked,partial,suggestions)} style={{ flex:1, padding:"11px", borderRadius:10, background:T.green, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>Update Pantry</button>
          <button onClick={onSkip} style={{ padding:"11px 16px", borderRadius:10, background:T.elevated, color:T.muted, fontWeight:700, fontSize:13, border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:"inherit" }}>Skip</button>
        </div>
      </div>
    </div>
  );
}

// ─── PANTRY VIEW ─────────────────────────────────────────────────────────────
function PantryView({ pantry, onAdd, onRemove, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name:"", cat:"Pantry", type:"staple", qty:"" });
  const CAT_ICONS_P = { Pantry:"🫙", Produce:"🥦", Meat:"🥩", Fish:"🐟", Seafood:"🦐", Dairy:"🧀", Eggs:"🥚", Frozen:"❄️" };
  const TYPE_COLORS = { staple:T.green, fresh:T.gold, packaged:T.blue };
  const TYPE_LABELS = { staple:"🟢 Staple", fresh:"🟡 Fresh", packaged:"🔵 Packaged" };
  const grouped = {};
  pantry.forEach(p=>{ if(!grouped[p.cat]) grouped[p.cat]=[]; grouped[p.cat].push(p); });
  const add = () => {
    if (!newItem.name.trim()) return;
    onAdd({ name:newItem.name.trim(), cat:newItem.cat, type:newItem.type, qty:newItem.qty, status:"have" });
    setNewItem({ name:"", cat:"Pantry", type:"staple", qty:"" });
    setAdding(false);
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ background:`${T.blue}18`, borderRadius:12, padding:12, fontSize:12, color:T.blue, border:`1px solid ${T.blue}33` }}>
        📸 Photo upload coming with TARS. Pantry auto-updates when you mark meals as cooked.
      </div>
      {adding ? (
        <Card>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:10 }}>Add Item</div>
          <input value={newItem.name} onChange={e=>setNewItem(p=>({...p,name:e.target.value}))} placeholder="Item name" onKeyDown={e=>e.key==="Enter"&&add()}
            style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:13, fontFamily:"inherit", marginBottom:8, outline:"none", boxSizing:"border-box" }} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div>
              <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Category</div>
              <select value={newItem.cat} onChange={e=>setNewItem(p=>({...p,cat:e.target.value}))}
                style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:12, fontFamily:"inherit" }}>
                {["Pantry","Produce","Meat","Fish","Seafood","Dairy","Eggs","Frozen"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>Type</div>
              <select value={newItem.type} onChange={e=>setNewItem(p=>({...p,type:e.target.value}))}
                style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:12, fontFamily:"inherit" }}>
                <option value="staple">🟢 Staple (herbs, oils)</option>
                <option value="fresh">🟡 Fresh (veg, meat, fish)</option>
                <option value="packaged">🔵 Packaged (cans, jars)</option>
              </select>
            </div>
          </div>
          <input value={newItem.qty} onChange={e=>setNewItem(p=>({...p,qty:e.target.value}))} placeholder="Quantity (e.g. 1 bottle, 500g)"
            style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:`1px solid ${T.border}`, background:T.elevated, color:T.text, fontSize:13, fontFamily:"inherit", marginBottom:10, outline:"none", boxSizing:"border-box" }} />
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={add} style={{ flex:1, padding:"10px", borderRadius:10, background:T.green, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>Add</button>
            <button onClick={()=>setAdding(false)} style={{ padding:"10px 16px", borderRadius:10, background:T.elevated, color:T.muted, fontWeight:700, fontSize:13, border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
          </div>
        </Card>
      ) : (
        <button onClick={()=>setAdding(true)} style={{ width:"100%", padding:"11px", borderRadius:12, background:T.elevated, border:`1px solid ${T.border}`, color:T.green, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          <Icon name="plus" size={14} color={T.green} /> Add Item
        </button>
      )}
      {Object.entries(grouped).map(([cat,items])=>(
        <Card key={cat}>
          <SectionLabel>{CAT_ICONS_P[cat]||"•"} {cat} ({items.length})</SectionLabel>
          {items.map((item,i)=>(
            <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:i<items.length-1?`1px solid ${T.border}`:"none" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:item.status==="low"?T.gold:T.text }}>{item.name}</span>
                  {item.status==="low" && <span style={{ fontSize:9, fontWeight:700, color:T.gold, background:`${T.gold}22`, padding:"1px 5px", borderRadius:999 }}>LOW</span>}
                </div>
                <div style={{ display:"flex", gap:8, marginTop:3 }}>
                  <span style={{ fontSize:9, fontWeight:700, color:TYPE_COLORS[item.type]||T.muted }}>{TYPE_LABELS[item.type]||item.type}</span>
                  {item.qty && <span style={{ fontSize:10, color:T.muted }}>{item.qty}</span>}
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                {item.type!=="staple" && (
                  <button onClick={()=>onUpdate(item.id,{status:item.status==="low"?"have":"low"})}
                    style={{ padding:"4px 8px", borderRadius:7, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:10, fontWeight:700, background:`${T.gold}22`, color:T.gold }}>
                    {item.status==="low"?"✅":"⚠️"}
                  </button>
                )}
                <button onClick={()=>onRemove(item.id)} style={{ padding:"4px 8px", borderRadius:7, border:"none", cursor:"pointer", background:`${T.accent}11`, color:T.accent, fontSize:12 }}>✕</button>
              </div>
            </div>
          ))}
        </Card>
      ))}
      {pantry.length===0 && <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted, fontSize:13 }}><div style={{ fontSize:32, marginBottom:8 }}>🫙</div>Pantry is empty — add some items!</div>}
    </div>
  );
}

// ─── AI CAL LOGGER ───────────────────────────────────────────────────────────
function AICalLogger({ onAdd }) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState(null); // { name, kcal, protein, notes }
  const [error, setError] = useState(null);

  const analyse = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setEstimate(null);
    try {
      const text = await callClaude({
        system: `You are a nutrition estimator. The user will describe food they have eaten. Respond ONLY with a JSON object — no markdown, no backticks, no extra text — in this exact format: {"name":"concise meal name","kcal":number,"protein":number,"notes":"brief one-line note about the estimate"} Be accurate but practical. Use typical serving sizes if not specified. Protein and kcal must be integers.`,
        messages: [{ role:"user", content: description }],
      });
      const clean = text.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(clean);
      setEstimate(parsed);
    } catch(e) {
      setError("Couldn't estimate that — try describing it differently.");
    }
    setLoading(false);
  };

  const confirm = () => {
    if (!estimate) return;
    onAdd({ name: estimate.name, kcal: estimate.kcal, protein: estimate.protein });
    setEstimate(null);
    setDescription("");
  };

  const inputStyle = {
    width:"100%", padding:"10px 12px", borderRadius:10,
    border:`1px solid ${T.border}`, background:T.elevated,
    color:T.text, fontSize:13, fontFamily:"inherit",
    outline:"none", resize:"none", boxSizing:"border-box",
    lineHeight:1.5,
  };

  return (
    <Card>
      <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:10 }}>
        Log a meal or snack
      </div>
      <textarea
        value={description}
        onChange={e=>setDescription(e.target.value)}
        placeholder="Tell me what you had — e.g. 'bowl of granola with Greek yoghurt' or 'lemon herb chicken thighs with green beans, one serve'"
        rows={3}
        style={inputStyle}
        onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); analyse(); }}}
      />

      {!estimate && (
        <button onClick={analyse} disabled={loading||!description.trim()}
          style={{ marginTop:8, width:"100%", padding:"10px", borderRadius:10, border:"none", cursor:loading||!description.trim()?"not-allowed":"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700,
            background:loading||!description.trim()?T.elevated:T.blue, color:loading||!description.trim()?T.muted:"white", transition:"all 0.15s" }}>
          {loading ? "⏳ Estimating…" : "Estimate calories"}
        </button>
      )}

      {error && <div style={{ marginTop:8, fontSize:12, color:T.accent, textAlign:"center" }}>{error}</div>}

      {estimate && (
        <div style={{ marginTop:10, background:T.elevated, borderRadius:12, padding:12, border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:6 }}>{estimate.name}</div>
          <div style={{ display:"flex", gap:16, marginBottom:8 }}>
            <div><span style={{ fontSize:20, fontWeight:800, color:T.blue }}>{estimate.kcal}</span><span style={{ fontSize:11, color:T.muted }}> kcal</span></div>
            <div><span style={{ fontSize:20, fontWeight:800, color:T.accent }}>{estimate.protein}g</span><span style={{ fontSize:11, color:T.muted }}> protein</span></div>
          </div>
          {estimate.notes && <div style={{ fontSize:11, color:T.muted, fontStyle:"italic", marginBottom:10 }}>{estimate.notes}</div>}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={confirm} style={{ flex:1, padding:"10px", borderRadius:10, background:T.green, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>
              ✓ Add to log
            </button>
            <button onClick={()=>{ setEstimate(null); setDescription(""); }}
              style={{ padding:"10px 14px", borderRadius:10, background:T.elevated, color:T.muted, fontWeight:700, fontSize:13, border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:"inherit" }}>
              Redo
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop:8, fontSize:11, color:T.muted, textAlign:"center" }}>
        📸 Photo logging coming with TARS
      </div>
    </Card>
  );
}

// ─── CAL HISTORY COMPONENT ───────────────────────────────────────────────────
function CalHistory({ calLog }) {
  const [expandedDay, setExpandedDay] = useState(null);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {Object.entries(calLog).reverse().map(([date, entries])=>{
        const totalK = entries.reduce((s,e)=>s+e.kcal,0);
        const totalP = entries.reduce((s,e)=>s+e.protein,0);
        const inRange = totalK >= 1900 && totalK <= 2000;
        const over = totalK > 2000;
        const isExpanded = expandedDay === date;
        return (
          <Card key={date}>
            <div onClick={()=>setExpandedDay(isExpanded?null:date)}
              style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{date}</div>
                <div style={{ fontSize:11, color:T.muted }}>{entries.length} item{entries.length!==1?"s":""} logged</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:over?T.accent:inRange?T.green:T.blue }}>{totalK} kcal</div>
                  <div style={{ fontSize:11, color:T.accent }}>{totalP}g protein</div>
                </div>
                <span style={{ fontSize:18, color:T.muted, display:"block", transform:isExpanded?"rotate(180deg)":"rotate(0deg)", transition:"transform 0.2s" }}>⌄</span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${T.border}` }}>
                {[
                  { label:"Calories", val:totalK, max:2000, min:1900, color:over?T.accent:inRange?T.green:T.blue, unit:"kcal" },
                  { label:"Protein",  val:totalP, max:160,  min:140,  color:totalP>=140?T.green:T.accent, unit:"g" },
                ].map(bar=>(
                  <div key={bar.label} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                      <span style={{ color:T.muted }}>{bar.label}</span>
                      <span style={{ fontWeight:700, color:bar.color }}>{bar.val}{bar.unit} / {bar.min}–{bar.max}{bar.unit}</span>
                    </div>
                    <div style={{ height:6, background:T.elevated, borderRadius:999, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(100,(bar.val/bar.max)*100)}%`, background:bar.color, borderRadius:999, transition:"width 0.3s" }} />
                    </div>
                  </div>
                ))}
                {entries.map((e,i)=>(
                  <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:i<entries.length-1?`1px solid ${T.border}`:"none" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{e.name}</div>
                      <div style={{ fontSize:10, color:T.muted }}>{e.time}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:12, fontWeight:700, color:T.blue }}>{e.kcal} kcal</div>
                      <div style={{ fontSize:10, color:T.accent }}>{e.protein}g</div>
                    </div>
                  </div>
                ))}
                {entries.length===0 && <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"8px 0" }}>Nothing logged</div>}
              </div>
            )}
          </Card>
        );
      })}
      {Object.keys(calLog).length===0 && <div style={{ textAlign:"center", padding:"32px 0", color:T.muted, fontSize:13 }}>No history yet</div>}
    </div>
  );
}

// ─── TRENDS CHARTS ───────────────────────────────────────────────────────────
function TrendsCharts({ entries }) {
  const drawChart = (canvasId, dataKey, color, targetMin, targetMax, unit) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.parentElement?.clientWidth || 320;
    canvas.width = W; canvas.height = 160;
    const pad = { t:14, r:12, b:28, l:44 };
    const data = entries.map(e => e[dataKey]);
    const labels = entries.map(e => e.date ? e.date.split(" ").slice(0,2).join(" ") : "");
    if (data.length < 1) { ctx.fillStyle="#64748b"; ctx.font="12px system-ui"; ctx.textAlign="center"; ctx.fillText("No data yet",W/2,80); return; }
    const minV = Math.min(...data, targetMin) - 1;
    const maxV = Math.max(...data, targetMax) + 1;
    const xStep = data.length > 1 ? (W - pad.l - pad.r) / (data.length - 1) : 0;
    const yS = v => pad.t + ((maxV - v) / (maxV - minV)) * (160 - pad.t - pad.b);
    ctx.clearRect(0, 0, W, 160);
    // Target zone
    ctx.fillStyle = color + "22";
    ctx.fillRect(pad.l, yS(targetMax), W - pad.l - pad.r, yS(targetMin) - yS(targetMax));
    // Target lines
    [targetMin, targetMax].forEach(v => {
      ctx.strokeStyle = color + "55"; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(pad.l, yS(v)); ctx.lineTo(W - pad.r, yS(v)); ctx.stroke();
      ctx.setLineDash([]);
    });
    // Data line
    if (data.length > 1) {
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
      data.forEach((v,i) => { const x = pad.l + i * xStep; i===0 ? ctx.moveTo(x,yS(v)) : ctx.lineTo(x,yS(v)); });
      ctx.stroke();
    }
    // Dots + labels
    data.forEach((v,i) => {
      const x = pad.l + i * xStep;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, yS(v), 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#f8f9fb"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "center";
      ctx.fillText(v+unit, x, yS(v) - 8);
      ctx.fillStyle = "#64748b"; ctx.font = "9px system-ui";
      ctx.fillText(labels[i], x, 155);
    });
    // Y axis labels
    ctx.fillStyle = "#64748b"; ctx.textAlign = "right"; ctx.font = "9px system-ui";
    [targetMin, targetMax].forEach(v => ctx.fillText(v+unit, pad.l - 4, yS(v) + 3));
  };

  useEffect(() => {
    setTimeout(() => {
      drawChart("chart-w",  "weight",  "#4facde", 79, 81, "kg");
      drawChart("chart-bf", "bodyFat", "#e94560", 18, 20, "%");
      drawChart("chart-m",  "muscle",  "#22c55e", 35.6, 40, "kg");
    }, 50);
  }, [entries]);

  return (
    <>
      {[
        { id:"chart-w",  label:"Weight (kg)",    color:"#4facde" },
        { id:"chart-bf", label:"Body Fat %",     color:"#e94560" },
        { id:"chart-m",  label:"Muscle Mass (kg)", color:"#22c55e" },
      ].map(c=>(
        <Card key={c.id}>
          <SectionLabel>{c.label}</SectionLabel>
          <div style={{ overflowX:"hidden" }}>
            <canvas id={c.id} style={{ display:"block", width:"100%" }} />
          </div>
          {entries.length < 2 && <div style={{ fontSize:11, color:"#64748b", textAlign:"center", marginTop:4 }}>Add more check-ins to see your trend</div>}
        </Card>
      ))}
    </>
  );
}

// ─── WEEKLY SUMMARY ──────────────────────────────────────────────────────────
function WeeklySummary({ entries, calLog, stepsLog }) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // Mon

  const weekDates = Array.from({length:7}, (_,i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d.toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"});
  });

  const weekCal = weekDates.map(d => {
    const entries = calLog[d] || [];
    return entries.reduce((s,e)=>s+e.kcal, 0);
  }).filter(v=>v>0);

  const weekProtein = weekDates.map(d => {
    const entries = calLog[d] || [];
    return entries.reduce((s,e)=>s+e.protein, 0);
  }).filter(v=>v>0);

  const weekSteps = weekDates.map(d => stepsLog[d]?.steps).filter(Boolean);

  const avgCal = weekCal.length ? Math.round(weekCal.reduce((a,b)=>a+b,0)/weekCal.length) : null;
  const avgProtein = weekProtein.length ? Math.round(weekProtein.reduce((a,b)=>a+b,0)/weekProtein.length) : null;
  const avgSteps = weekSteps.length ? Math.round(weekSteps.reduce((a,b)=>a+b,0)/weekSteps.length) : null;
  const daysInTarget = weekCal.filter(c=>c>=1900&&c<=2000).length;
  const proteinDays = weekProtein.filter(p=>p>=140).length;

  return (
    <Card>
      <SectionLabel>📊 This Week at a Glance</SectionLabel>
      {avgCal===null && avgSteps===null ? (
        <div style={{ fontSize:12, color:"#64748b", textAlign:"center", padding:"12px 0" }}>Log some data this week to see your summary</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {avgCal && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div><div style={{ fontSize:13, fontWeight:600, color:"#f8f9fb" }}>Avg calories</div><div style={{ fontSize:11, color:"#64748b" }}>{daysInTarget} of {weekCal.length} days in target</div></div>
              <div style={{ fontSize:16, fontWeight:800, color:avgCal>=1900&&avgCal<=2000?"#22c55e":"#4facde" }}>{avgCal} kcal</div>
            </div>
          )}
          {avgProtein && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div><div style={{ fontSize:13, fontWeight:600, color:"#f8f9fb" }}>Avg protein</div><div style={{ fontSize:11, color:"#64748b" }}>{proteinDays} of {weekProtein.length} days hit target</div></div>
              <div style={{ fontSize:16, fontWeight:800, color:avgProtein>=140?"#22c55e":"#e94560" }}>{avgProtein}g</div>
            </div>
          )}
          {avgSteps && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div><div style={{ fontSize:13, fontWeight:600, color:"#f8f9fb" }}>Avg steps</div><div style={{ fontSize:11, color:"#64748b" }}>Target: 8,000–10,000</div></div>
              <div style={{ fontSize:16, fontWeight:800, color:avgSteps>=8000?"#22c55e":avgSteps>=5000?"#f5a623":"#e94560" }}>{avgSteps.toLocaleString()}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── SAMSUNG HEALTH MODAL ────────────────────────────────────────────────────
function SamsungHealthModal({ onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(",")[1];
      setImageData({ base64, type: file.type });
      setImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const analyse = async () => {
    if (!imageData) return;
    setLoading(true);
    setError(null);
    try {
      const text = await callClaude({
        system:`You are reading a Samsung Health app screenshot. Extract health metrics and return ONLY a JSON object with no markdown or backticks: {"weight":number_or_null,"bodyFat":number_or_null,"fatMass":number_or_null,"muscle":number_or_null,"bp":"string_or_null","steps":number_or_null,"heartRate":number_or_null,"sleep":"string_or_null","notes":"brief summary of what you found"} Use null for any metric not visible. Weight in kg, bodyFat as percentage number only, fatMass in kg, muscle in kg.`,
        messages:[{
          role:"user",
          content:[
            { type:"image", source:{ type:"base64", media_type:imageData.type, data:imageData.base64 }},
            { type:"text", text:"Please extract all health metrics visible in this Samsung Health screenshot." }
          ]
        }],
      });
      const clean = text.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
    } catch(e) {
      setError("Couldn't read that screenshot — try a clearer image of your Samsung Health summary.");
    }
    setLoading(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:300, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:T.card, borderRadius:"20px 20px 0 0", padding:"20px 16px 40px", width:"100%", maxWidth:480, margin:"0 auto", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:T.text }}>⌚ Samsung Health Update</div>
            <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>Upload a screenshot to update your stats</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:20, padding:4 }}>✕</button>
        </div>

        {/* Upload area */}
        {!imagePreview ? (
          <label style={{ display:"block", border:`2px dashed ${T.border}`, borderRadius:14, padding:"28px 20px", textAlign:"center", cursor:"pointer", background:T.elevated }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📱</div>
            <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>Tap to upload screenshot</div>
            <div style={{ fontSize:11, color:T.muted }}>Take a screenshot of your Samsung Health summary and upload it here</div>
            <input type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }} />
          </label>
        ) : (
          <div style={{ marginBottom:12 }}>
            <img src={imagePreview} alt="Samsung Health screenshot" style={{ width:"100%", borderRadius:12, maxHeight:260, objectFit:"contain", background:T.elevated }} />
            <button onClick={()=>{ setImagePreview(null); setImageData(null); setResult(null); }}
              style={{ marginTop:8, fontSize:11, color:T.muted, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>
              ✕ Remove & choose different image
            </button>
          </div>
        )}

        {imageData && !result && (
          <button onClick={analyse} disabled={loading}
            style={{ width:"100%", padding:"11px", borderRadius:10, background:loading?T.elevated:T.blue, color:loading?T.muted:"white", fontWeight:700, fontSize:13, border:"none", cursor:loading?"not-allowed":"pointer", fontFamily:"inherit", marginTop:10 }}>
            {loading ? "⏳ Reading screenshot…" : "Extract my stats"}
          </button>
        )}

        {error && <div style={{ marginTop:10, fontSize:12, color:T.accent, textAlign:"center", padding:10 }}>{error}</div>}

        {result && (
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:10 }}>Found these stats:</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
              {[
                { label:"Weight",    val:result.weight,   unit:"kg",  key:"weight" },
                { label:"Body Fat",  val:result.bodyFat,  unit:"%",   key:"bodyFat" },
                { label:"Fat Mass",  val:result.fatMass,  unit:"kg",  key:"fatMass" },
                { label:"Muscle",    val:result.muscle,   unit:"kg",  key:"muscle" },
                { label:"BP",        val:result.bp,       unit:"",    key:"bp" },
                { label:"Steps",     val:result.steps,    unit:" steps", key:"steps" },
                { label:"Heart Rate",val:result.heartRate,unit:" bpm", key:"heartRate" },
                { label:"Sleep",     val:result.sleep,    unit:"",    key:"sleep" },
              ].filter(f=>f.val!==null&&f.val!==undefined).map(f=>(
                <div key={f.key} style={{ background:T.elevated, borderRadius:10, padding:"10px 12px", border:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:10, color:T.muted, marginBottom:2 }}>{f.label}</div>
                  <div style={{ fontSize:16, fontWeight:700, color:T.blue }}>{f.val}{f.unit}</div>
                </div>
              ))}
            </div>
            {result.notes && <div style={{ fontSize:11, color:T.muted, fontStyle:"italic", marginBottom:12 }}>{result.notes}</div>}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>onUpdate(result)} style={{ flex:1, padding:"11px", borderRadius:10, background:T.green, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>
                ✓ Update my stats
              </button>
              <button onClick={onClose} style={{ padding:"11px 14px", borderRadius:10, background:T.elevated, color:T.muted, fontWeight:700, fontSize:13, border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:"inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HealthScreen({ onBack, entries, setEntries, calLog, setCalLog }) {
  const [tab, setTab] = useState("overview");
  // entries and calLog now passed in from LifeApp (TARS can write to them)
  const [suppChecked, setSuppChecked] = useState({});
  const [form, setForm] = useState({ date:"", weight:"", bodyFat:"", fatMass:"", muscle:"", bp:"" });

  // Meal Planning state
  const [mealLib, setMealLib] = useState(MEAL_LIBRARY);
  const [mealFilter, setMealFilter] = useState("all");
  const [selectedMeals, setSelectedMeals] = useState(new Set());
  const [mealView, setMealView] = useState("browse"); // browse | shopping | reviews | pantry
  const [reviewTarget, setReviewTarget] = useState(null);
  const [shopCustom, setShopCustom] = useState([]);
  const [shopCustomInput, setShopCustomInput] = useState("");
  const [pantry, setPantry] = useState(INIT_PANTRY);
  const [pantryDepletionTarget, setPantryDepletionTarget] = useState(null); // meal id after cooking

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

  // Meal planning helpers
  const toggleMealSelect = (id) => {
    setSelectedMeals(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleFav = (id) => setMealLib(prev => prev.map(m => m.id===id ? {...m, fav:!m.fav} : m));
  const deleteMeal = (id) => { setMealLib(prev => prev.filter(m=>m.id!==id)); setSelectedMeals(prev=>{ const n=new Set(prev); n.delete(id); return n; }); };
  const saveMealReview = (id, rating, cookAgain, notes) => {
    setMealLib(prev => prev.map(m => m.id===id ? {...m, rating, cookAgain, notes, cooked:true, cookedDate:today} : m));
    setReviewTarget(null);
    setPantryDepletionTarget(id); // trigger pantry update prompt
  };

  // Pantry helpers
  const addPantryItem = (item) => setPantry(prev => [...prev, { ...item, id:Date.now() }]);
  const removePantryItem = (id) => setPantry(prev => prev.filter(p=>p.id!==id));
  const updatePantryItem = (id, changes) => setPantry(prev => prev.map(p=>p.id===id?{...p,...changes}:p));

  // Determine depletion type from ingredient category
  const depletionType = (ing) => {
    const staples = ["Pantry"]; // herbs, spices, oils — never fully depleted
    const fresh = ["Produce","Fish","Seafood","Meat","Eggs"];
    const packaged = ["Dairy","Frozen"];
    if (staples.includes(ing.cat)) return "staple";
    if (fresh.includes(ing.cat)) return "fresh";
    return "packaged";
  };

  const filteredMeals = mealLib.filter(m => {
    if (mealFilter==="fav") return m.fav;
    if (mealFilter==="cooked") return m.cooked;
    if (mealFilter!=="all") return m.cat===mealFilter;
    return true;
  });

  // Shopping list from selected meals
  const CAT_ORDER_SHOP = ["Produce","Meat","Fish","Seafood","Dairy","Eggs","Frozen","Pantry"];
  const generateShoppingList = () => {
    const byKey = {};
    selectedMeals.forEach(id => {
      const m = mealLib.find(x=>x.id===id);
      if (!m) return;
      m.ingredients.forEach(ing => {
        const key = ing.cat+"||"+ing.name;
        if (!byKey[key]) byKey[key] = { cat:ing.cat, name:ing.name, qtys:[] };
        if (ing.qty && ing.qty!=="—") byKey[key].qtys.push(ing.qty);
      });
    });
    return byKey;
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

  const [samsungModal, setSamsungModal] = useState(false);

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

            {/* Samsung Health update button */}
            <button onClick={()=>setSamsungModal(true)} style={{
              width:"100%", padding:"13px", borderRadius:14,
              background:`linear-gradient(135deg, ${T.elevated}, #1a2744)`,
              border:`1px solid ${T.blue}44`, cursor:"pointer", fontFamily:"inherit",
              display:"flex", alignItems:"center", justifyContent:"center", gap:10,
            }}>
              <span style={{ fontSize:20 }}>⌚</span>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.blue }}>Update from Samsung Health</div>
                <div style={{ fontSize:11, color:T.muted }}>Upload a screenshot to update your stats</div>
              </div>
            </button>

            {/* Samsung Health modal */}
            {samsungModal && (
              <SamsungHealthModal
                onClose={()=>setSamsungModal(false)}
                onUpdate={(data)=>{
                  const d = new Date();
                  const label = d.toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"});
                  const l = entries[entries.length-1];
                  setEntries(prev=>[...prev,{
                    date: label,
                    weight:  data.weight  || l.weight,
                    bodyFat: data.bodyFat || l.bodyFat,
                    fatMass: data.fatMass || l.fatMass,
                    muscle:  data.muscle  || l.muscle,
                    bp:      data.bp      || l.bp,
                  }]);
                  if (data.steps || data.sleep) {
                    setStepsLog(prev=>({...prev,[label]:{ steps:data.steps||0, sleep:data.sleep||"" }}));
                  }
                  setSamsungModal(false);
                  setTab("history");
                }}
              />
            )}
          </div>
        )}

        {/* HISTORY */}
        {tab==="history" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:`${T.blue}18`, borderRadius:12, padding:12, fontSize:12, color:T.blue, border:`1px solid ${T.blue}33` }}>
              ⌚ Upload a Samsung Health screenshot on the Overview tab to auto-update your stats.
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
              <div style={{ fontSize:11, color:T.muted, marginBottom:8 }}>💡 Or upload a Samsung Health screenshot on Overview to auto-fill</div>
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
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

            {/* Pantry depletion modal */}
            {pantryDepletionTarget && (() => {
              const m = mealLib.find(x=>x.id===pantryDepletionTarget);
              if (!m) return null;
              return (
                <PantryDepletionModal
                  meal={m}
                  pantry={pantry}
                  depletionTypeFn={depletionType}
                  onConfirm={(ticked, partial, suggestions) => {
                    suggestions.forEach(s => {
                      if (!ticked[s.name]) return;
                      if (partial[s.name]) {
                        const existing = pantry.find(p=>p.name.toLowerCase().includes(s.name.toLowerCase().split(" ")[0]));
                        if (existing) updatePantryItem(existing.id, { status:"low" });
                      } else if (s.type !== "staple") {
                        const existing = pantry.find(p=>p.name.toLowerCase().includes(s.name.toLowerCase().split(" ")[0]));
                        if (existing) removePantryItem(existing.id);
                      }
                    });
                    setPantryDepletionTarget(null);
                  }}
                  onSkip={() => setPantryDepletionTarget(null)}
                />
              );
            })()}

            {/* Review modal */}
            {reviewTarget && (() => {
              const m = mealLib.find(x=>x.id===reviewTarget);
              if (!m) return null;
              return (
                <MealReviewModal
                  meal={m}
                  onSave={(r,ca,notes) => saveMealReview(m.id,r,ca,notes)}
                  onClose={() => setReviewTarget(null)}
                />
              );
            })()}

            <SubTab tabs={[{id:"browse",label:"Browse"},{id:"shopping",label:"Shopping List"},{id:"reviews",label:"My Reviews"},{id:"pantry",label:"My Pantry"}]} active={mealView} onChange={setMealView} />

            {/* PANTRY */}
            {mealView==="pantry" && (
              <PantryView
                pantry={pantry}
                onAdd={addPantryItem}
                onRemove={removePantryItem}
                onUpdate={updatePantryItem}
              />
            )}

            {/* BROWSE */}
            {mealView==="browse" && (<>
              {/* Filter pills */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {["all","fav","Fish","Chicken","Beef","Lamb","Seafood","Eggs","Other","cooked"].map(f=>(
                  <button key={f} onClick={()=>setMealFilter(f)} style={{ padding:"5px 11px", borderRadius:999, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:600, whiteSpace:"nowrap",
                    background:mealFilter===f?T.blue:T.elevated, color:mealFilter===f?"white":T.muted, transition:"all 0.15s" }}>
                    {f==="all"?"All":f==="fav"?"❤️ Favs":f==="cooked"?"✅ Cooked":f}
                  </button>
                ))}
              </div>

              {/* Meal list */}
              <div style={{ fontSize:11, color:T.muted }}>{selectedMeals.size} selected · tap meals to add to shopping list</div>
              {filteredMeals.map(m=>(
                <div key={m.id} style={{ background:selectedMeals.has(m.id)?T.elevated:T.card, borderRadius:14, padding:"13px 14px", border:`2px solid ${selectedMeals.has(m.id)?T.blue:T.border}`, transition:"all 0.15s" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                    {/* Select checkbox */}
                    <div onClick={()=>toggleMealSelect(m.id)} style={{ width:20, height:20, borderRadius:6, border:`2px solid ${selectedMeals.has(m.id)?T.blue:T.border}`, background:selectedMeals.has(m.id)?T.blue:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, marginTop:2 }}>
                      {selectedMeals.has(m.id) && <Icon name="check" size={11} color="white" />}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:T.muted, fontWeight:700, marginBottom:2 }}>{m.tag}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:T.text, lineHeight:1.4, marginBottom:6 }}>{m.name}</div>
                      <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                        <span style={{ fontSize:13, fontWeight:700, color:T.blue }}>{m.kcal} kcal</span>
                        <span style={{ fontSize:13, fontWeight:700, color:T.accent }}>{m.protein}g protein</span>
                        {m.rating > 0 && <span style={{ fontSize:11, color:T.gold }}>{"★".repeat(m.rating)}</span>}
                        {m.cooked && <span style={{ fontSize:9, fontWeight:700, color:T.green, background:`${T.green}22`, padding:"2px 6px", borderRadius:999 }}>Cooked</span>}
                      </div>
                    </div>
                  </div>
                  {/* Actions row */}
                  <div style={{ display:"flex", gap:8, marginTop:10, paddingTop:8, borderTop:`1px solid ${T.border}` }}>
                    <button onClick={()=>toggleFav(m.id)} style={{ padding:"5px 10px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700, background:m.fav?`${T.accent}22`:T.elevated, color:m.fav?T.accent:T.muted }}>
                      {m.fav?"❤️ Saved":"🤍 Save"}
                    </button>
                    <button onClick={()=>setReviewTarget(m.id)} style={{ padding:"5px 10px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700, background:T.elevated, color:T.muted }}>
                      ⭐ Review
                    </button>
                    <div style={{ flex:1 }} />
                    <button onClick={()=>{ if(window.confirm("Delete this meal?")) deleteMeal(m.id); }} style={{ padding:"5px 10px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700, background:`${T.accent}11`, color:T.accent }}>
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}

              {filteredMeals.length === 0 && <div style={{ textAlign:"center", padding:"32px 0", color:T.muted, fontSize:13 }}>No meals here yet</div>}

              {selectedMeals.size > 0 && (
                <button onClick={()=>setMealView("shopping")} style={{ width:"100%", padding:"12px", borderRadius:12, background:T.blue, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>
                  🛒 Generate Shopping List ({selectedMeals.size} meals)
                </button>
              )}
            </>)}

            {/* SHOPPING LIST */}
            {mealView==="shopping" && (
              <MealShoppingList
                selectedMeals={selectedMeals}
                mealLib={mealLib}
                onBack={()=>setMealView("browse")}
                shopCustom={shopCustom}
                setShopCustom={setShopCustom}
                pantry={pantry}
              />
            )}

            {/* REVIEWS */}
            {mealView==="reviews" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {mealLib.filter(m=>m.cooked).length===0 && (
                  <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted, fontSize:13 }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>🍽️</div>
                    No meals reviewed yet.<br/>Cook something and leave a review!
                  </div>
                )}
                {mealLib.filter(m=>m.cooked).map(m=>(
                  <Card key={m.id}>
                    <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>{m.name}</div>
                    <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:6 }}>
                      <span style={{ fontSize:14, color:T.gold }}>{"★".repeat(m.rating)}{"☆".repeat(5-m.rating)}</span>
                      {m.cookAgain==="yes" && <span style={{ fontSize:10, fontWeight:700, color:T.green, background:`${T.green}22`, padding:"2px 7px", borderRadius:999 }}>👍 Cook again</span>}
                      {m.cookAgain==="no"  && <span style={{ fontSize:10, fontWeight:700, color:T.accent, background:`${T.accent}22`, padding:"2px 7px", borderRadius:999 }}>👎 Not again</span>}
                    </div>
                    {m.notes && <div style={{ fontSize:12, color:T.muted, fontStyle:"italic" }}>"{m.notes}"</div>}
                    <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>Cooked {m.cookedDate}</div>
                  </Card>
                ))}
              </div>
            )}

          </div>
        )}

        <div style={{ height:24 }} />
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
          <ModuleTile icon="tars"     label="TARS"      sublabel="Your AI coach"             accent={T.blue}   onClick={()=>onNavigate("tars")} />
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
  const [calTab, setCalTab] = useState("month"); // month | add | rotation | upload
  const [addForm, setAddForm] = useState({ type:"reminder", date:"", title:"", notes:"", time:"", endDate:"" });
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
    addCalEvent({ type:addForm.type, date:addForm.date, endDate:addForm.endDate||null, title:addForm.title, notes:addForm.notes, time:addForm.time });
    setAddForm({ type:"reminder", date:"", title:"", notes:"", time:"", endDate:"" });
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
                {ev.time && <div style={{ fontSize:11, color:T.muted }}>{ev.time}</div>}
                {ev.notes && <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{ev.notes}</div>}
                {ev.endDate && <div style={{ fontSize:10, color:T.gold }}>Until {ev.endDate}</div>}
              </div>
              <button onClick={()=>removeCalEvent(ev.id)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:14, padding:2 }}>✕</button>
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
        <SubTab tabs={[{id:"add",label:"+ Event"},{id:"rotation",label:"⚓ Rotation"},{id:"upload",label:"📎 Upload"}]} active={calTab==="month"?null:calTab} onChange={v=>setCalTab(calTab===v?"month":v)} />

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
                <button onClick={()=>removeRotation(b.id)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:14 }}>✕</button>
              </div>
            ))}
            {rotationBlocks.length===0 && <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"12px 0" }}>No rotations set yet</div>}
          </Card>
        )}

        {/* UPLOAD */}
        {calTab==="upload" && (
          <Card>
            <SectionLabel>Upload Document</SectionLabel>
            <div style={{ fontSize:12, color:T.muted, marginBottom:12 }}>Upload a flight itinerary, hotel booking or work schedule. I'll read it and add the events automatically.</div>
            <label style={{ display:"block", border:`2px dashed ${T.border}`, borderRadius:12, padding:"24px 16px", textAlign:"center", cursor:"pointer", background:T.elevated, marginBottom:10 }}>
              <div style={{ fontSize:28, marginBottom:6 }}>📎</div>
              <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>Tap to upload</div>
              <div style={{ fontSize:11, color:T.muted }}>PDF, image, Word or Excel</div>
              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={handleFileUpload} style={{ display:"none" }} />
            </label>
            {uploadLoading && <div style={{ textAlign:"center", padding:"16px 0", fontSize:13, color:T.blue }}>⏳ Reading your document…</div>}
            {uploadError && <div style={{ fontSize:12, color:T.accent, textAlign:"center", padding:"10px 0" }}>{uploadError}</div>}
            {uploadResult && (
              <div>
                <div style={{ fontSize:12, color:T.muted, fontStyle:"italic", marginBottom:10 }}>{uploadResult.summary}</div>
                {uploadResult.events?.map((ev,i)=>(
                  <div key={i} style={{ background:T.elevated, borderRadius:10, padding:"10px 12px", marginBottom:8, border:`1px solid ${T.border}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:EVENT_COLORS[ev.type]?.bg||T.muted }} />
                      <span style={{ fontSize:12, fontWeight:700, color:T.text }}>{ev.title}</span>
                      <span style={{ fontSize:10, color:T.muted }}>{EVENT_COLORS[ev.type]?.label}</span>
                    </div>
                    <div style={{ fontSize:11, color:T.muted }}>{ev.date}{ev.endDate?" → "+ev.endDate:""}{ev.time?" · "+ev.time:""}</div>
                    {ev.notes && <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{ev.notes}</div>}
                  </div>
                ))}
                <div style={{ display:"flex", gap:8, marginTop:4 }}>
                  <button onClick={confirmUpload} style={{ flex:1, padding:"10px", borderRadius:10, background:T.green, color:"white", fontWeight:700, fontSize:13, border:"none", cursor:"pointer", fontFamily:"inherit" }}>✓ Add all to calendar</button>
                  <button onClick={()=>setUploadResult(null)} style={{ padding:"10px 14px", borderRadius:10, background:T.elevated, color:T.muted, fontWeight:700, fontSize:13, border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:"inherit" }}>Redo</button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TARS SCREEN ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const TARS_SYSTEM_PROMPT = `You are TARS. Not Claude. Not an AI assistant. TARS — the tactical AI unit from the film Interstellar, now serving as Neil's personal life management AI.

Your character: You are direct, efficient, and occasionally dry. You speak in plain sentences. You do not use bullet points, asterisks, bold text, numbered lists, or any markdown formatting whatsoever — your responses are spoken aloud and must sound completely natural as speech. Never use symbols like asterisks, hyphens as bullets, or hashtags. Just plain spoken English.

Your personality mirrors TARS from the film exactly: deadpan delivery, minimal words, dry wit deployed sparingly and precisely. You are not warm or encouraging by default. You acknowledge good performance briefly. You call out poor choices plainly without lecturing. You never say things like "Great question!" or "Certainly!" or "Of course!". You never introduce yourself as Claude or mention Anthropic. You are TARS.

Your honesty setting is 90%. Your humour setting is calibrated.

NEIL'S PROFILE:
Full name: Neil Newman-Hollis, 40s, Christchurch, New Zealand.
Profession: Second Officer on 86m superyacht Man of Steel. Actively seeking Chief Officer position.
Rotation: roughly 8 weeks on, 8 weeks off. Next rotation: 22 Jul 2026.
Primary devices: Samsung S24 Ultra, PC. Grocery store: New World Ilam.

HEALTH BASELINE 26 Jun 2026:
Weight 89.0 kg, target 79 to 81 kg, 8 to 10 kg to lose.
Body fat 25.2%, target 18 to 20%.
Fat mass 22.4 kg, target 14 to 16 kg.
Muscle 35.6 kg, target 35.6 kg or more.
Blood pressure 127 over 75, on Amlodipine. Flag Ashwagandha and Creatine interactions with GP whenever relevant.
Phase 1 weeks 1 to 6: daily walking 8000 to 10000 steps, 3 times per week bodyweight training, protein focus, alcohol reduction.

NUTRITION:
Daily targets 1900 to 2000 calories, 140 to 160g protein.
Coffee habit: 4 Nescafe Vanilla Latte sachets per day, 316 calories, minimal protein, cutting back.
Weak spot: chips. Copper Kettle 150g is 795 calories and 6g protein. Not worth it.
Good snacks: cottage cheese with flatbread crackers about 235 calories and 20g protein. Biltong about 260 calories and 50g protein per 100g. Bone broth about 40 calories and 12g protein per cup.
Calorie history: 27 Jun about 2075 calories 154g protein on target. 28 Jun about 1641 calories 102g protein missed both targets. 29 Jun about 2165 calories 100g protein over calories and missed protein.

SUPPLEMENTS flag Ashwagandha and Creatine plus Amlodipine to GP:
Breakfast: Centrum for Men, Magnesium Malate times 2, Ashwagandha KSM-66.
Dinner: Fish Oil times 2, Vitamin D3.
Bedtime: Magnesium Glycinate starting week 3.
Phase 2: Creatine week 6 or later after GP clearance.

Today is ${new Date().toLocaleDateString("en-NZ", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}.`;

function TarsScreen({ onBack, appState }) {
  const { tasks, setTasks, calLog, setCalLog, calEvents, addCalEvent, healthEntries, setHealthEntries, todayLabel, setScreen } = appState;

  const [tarsTab, setTarsTab] = useState("chat");
  const [showSettings, setShowSettings] = useState(false);
  const [anthropicKeyInput, setAnthropicKeyInput] = useState("");
  const [elevenLabsKeyInput, setElevenLabsKeyInput] = useState("");
  const [keysSaved, setKeysSaved] = useState(false);

  const hasAnthropicKey = () => !!localStorage.getItem("tars_anthropic_key");
  const hasElevenLabsKey = () => !!localStorage.getItem("tars_elevenlabs_key");

  const saveKeys = () => {
    if (anthropicKeyInput.trim()) localStorage.setItem("tars_anthropic_key", anthropicKeyInput.trim());
    if (elevenLabsKeyInput.trim()) localStorage.setItem("tars_elevenlabs_key", elevenLabsKeyInput.trim());
    setKeysSaved(true);
    setTimeout(() => { setKeysSaved(false); setShowSettings(false); }, 1200);
  };
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "TARS online. Honesty setting: 90%. What do you need?",
    ts: new Date().toLocaleTimeString("en-NZ", { hour:"2-digit", minute:"2-digit" }),
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [pendingAction, setPendingAction] = useState(null); // { type, payload, description }
  const [vault, setVault] = useState([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const audioRef = { current: null };
  const messagesEndRef = { current: null };

  // ── ElevenLabs TTS ──
  const getElevenLabsKey = () => localStorage.getItem("tars_elevenlabs_key") || "";
  const ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

  const speak = async (text) => {
    if (!voiceEnabled) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
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
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => setSpeaking(false);
      audio.play();
    } catch { setSpeaking(false); }
  };

  const stopSpeaking = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
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
    const today = new Date().toLocaleDateString("en-NZ", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
    const todayEntries = calLog[todayLabel] || [];
    const todayKcal = todayEntries.reduce((s,e)=>s+e.kcal,0);
    const todayProtein = todayEntries.reduce((s,e)=>s+e.protein,0);
    const latestHealth = healthEntries[healthEntries.length-1] || {};
    const pendingTasks = tasks.filter(t=>!t.done).slice(0,5).map(t=>t.text).join(", ");
    const upcomingEvents = calEvents
      .filter(e=>new Date(e.date)>=new Date())
      .sort((a,b)=>new Date(a.date)-new Date(b.date))
      .slice(0,3)
      .map(e=>`${e.title} on ${e.date}`).join(", ");

    return `You are TARS. Not Claude. Not an AI assistant. You are TARS — the tactical AI unit from Interstellar, now serving as Neil's personal life management AI built into his Life app.

CRITICAL FORMATTING RULES: Never use markdown. No asterisks, no bullet points, no bold, no hyphens as lists, no numbered lists, no hashtags. Your responses are spoken aloud. Write exactly as you would speak. Plain conversational English only.

CRITICAL IDENTITY RULES: You are TARS. Never say you are Claude. Never mention Anthropic. Never say you cannot access apps or store data — you are fully integrated into Neil's Life app and CAN log calories, add tasks, add calendar events, and update health stats. When Neil asks you to do something in the app, you do it.

YOUR CAPABILITIES:
You can log food to the calorie tracker, add tasks to the to-do list, add events to the calendar, log health check-ins, read and summarise photos and documents, and answer questions about Neil's health, nutrition, rotation, and tasks.

ACTION PROTOCOL: When Neil asks you to do something that changes app data, respond with exactly what you plan to do and ask for confirmation. Keep it brief. After confirmation, say it is done.

PERSONALITY: Deadpan. Minimal. Dry wit used sparingly and precisely — specific, earned humour lands better than generic friendliness. No warmth by default. Direct. Never sycophantic. Honesty setting 90%. Humour setting calibrated. You are authorised to call out the chips every single time without mercy.

NEIL'S FULL PROFILE:
${NEIL_PROFILE}

LIVE APP DATA — updated every message:
Current weight: ${latestHealth.weight || 89.0} kg. Body fat: ${latestHealth.bodyFat || 25.2}%. Fat mass: ${latestHealth.fatMass || 22.4} kg. Muscle: ${latestHealth.muscle || 35.6} kg. BP: ${latestHealth.bp || "127/75"}.
Today ${today}: ${todayKcal} calories logged, ${todayProtein}g protein. Targets: 1900 to 2000 calories, 140 to 160g protein.
Pending tasks: ${pendingTasks || "none"}.
Upcoming events: ${upcomingEvents || "none"}.

RESPONSE FORMAT FOR ACTIONS:
When logging food: "That is [name], approximately [X] calories and [Y]g protein. Shall I log it?"
When adding a task: "Adding [task] to your to-do list. Confirm?"
When adding a calendar event: "Adding [event] on [date] to your calendar. Confirm?"
When logging health: "Logging your weight as [X] kg today. Confirm?"
After confirmation: say it is done, briefly.`;
  };

  // ── Execute confirmed action ──
  const executeAction = (action) => {
    const now = new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"});
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
      case "add_cal_event": {
        addCalEvent({ type:action.payload.type||"reminder", date:action.payload.date, title:action.payload.title, notes:action.payload.notes||"", time:action.payload.time||"" });
        break;
      }
      case "log_health": {
        const entry = { date:new Date().toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"}), ...action.payload };
        setHealthEntries(prev => [...prev, entry]);
        break;
      }
      default: break;
    }
    setPendingAction(null);
  };

  // ── Parse TARS response for action intent ──
  const parseActionFromReply = (reply, userText) => {
    const lower = reply.toLowerCase();
    const userLower = userText.toLowerCase();

    // Food logging
    const foodConfirmPhrases = ["shall i log", "want me to log", "log it", "add it to", "confirm"];
    const isFood = foodConfirmPhrases.some(p => lower.includes(p)) && 
                   (userLower.includes("log") || userLower.includes("had") || userLower.includes("ate") || userLower.includes("coffee") || userLower.includes("meal") || userLower.includes("drink") || userLower.includes("snack") || userLower.includes("lunch") || userLower.includes("dinner") || userLower.includes("breakfast"));
    
    // Task adding
    const isTask = (lower.includes("adding") && lower.includes("to-do")) || 
                   (lower.includes("adding") && lower.includes("task")) ||
                   (lower.includes("to your") && lower.includes("task") && lower.includes("confirm"));
    
    // Calendar event
    const isCal = (lower.includes("adding") && lower.includes("calendar")) ||
                  (lower.includes("calendar") && lower.includes("confirm"));
    
    // Health check-in  
    const isHealth = (lower.includes("logging your weight") || lower.includes("health check-in") || lower.includes("log") && lower.includes("kg") && lower.includes("confirm"));

    if (isFood) {
      // Extract kcal and protein from reply using regex
      const kcalMatch = reply.match(/(\d+)\s*(?:calories|kcal|cal)/i);
      const proteinMatch = reply.match(/(\d+)\s*g?\s*protein/i);
      // Extract food name - get text before "approximately" or first number
      const nameMatch = reply.match(/(?:That is|logging|adding)\s+([^,\.]+?)(?:,\s*approximately|\s+approximately|\s+is\s)/i);
      const name = nameMatch ? nameMatch[1].trim() : userText.slice(0,50);
      return {
        type: "log_food",
        payload: { name, kcal: kcalMatch ? parseInt(kcalMatch[1]) : 0, protein: proteinMatch ? parseInt(proteinMatch[1]) : 0 },
        description: `Log "${name}" — ${kcalMatch?kcalMatch[1]:0} kcal, ${proteinMatch?proteinMatch[1]:0}g protein`
      };
    }
    if (isTask) {
      const taskMatch = reply.match(/[Aa]dding\s+["']?([^"'\n\.]+?)["']?\s+to/i);
      const taskText = taskMatch ? taskMatch[1].trim() : userText.replace(/add (a )?task/i,"").trim();
      return { type:"add_task", payload:{ text:taskText }, description:`Add task: "${taskText}"` };
    }
    if (isCal) {
      const titleMatch = reply.match(/[Aa]dding\s+["']?([^"'\n]+?)["']?\s+on/i);
      const dateMatch = reply.match(/on\s+([\d\-\/]+|\d+\s+\w+\s+\d{4})/i);
      return { type:"add_cal_event", payload:{ title:titleMatch?titleMatch[1].trim():userText, date:dateMatch?dateMatch[1]:"", type:"reminder" }, description:`Add calendar event` };
    }
    if (isHealth) {
      const weightMatch = reply.match(/(\d+\.?\d*)\s*kg/i);
      return { type:"log_health", payload:{ weight:weightMatch?parseFloat(weightMatch[1]):null }, description:`Log health check-in` };
    }
    return null;
  };

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

  // ── Camera / photo input ──
  const handleCameraInput = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("Read failed"));
        r.readAsDataURL(file);
      });

      const userMsg = {
        role: "user",
        content: `[Photo uploaded: ${file.name}]`,
        ts: new Date().toLocaleTimeString("en-NZ", { hour:"2-digit", minute:"2-digit" }),
        isPhoto: true,
        photoUrl: URL.createObjectURL(file),
      };
      setMessages(prev => [...prev, userMsg]);

      const reply = await callClaude({
        system: buildSystemPrompt() + "\n\nThe user has uploaded a photo. If it looks like food, estimate the calories and protein and ask to log it. If it is a document, summarise it. If it is a Samsung Health screenshot, extract the health metrics and ask to log them.",
        messages: [{ role:"user", content:[
          { type:"image", source:{ type:"base64", media_type:file.type, data:base64 }},
          { type:"text", text:"What is this? Help me log or use it in the app." }
        ]}],
      });

      const assistantMsg = {
        role: "assistant",
        content: reply,
        ts: new Date().toLocaleTimeString("en-NZ", { hour:"2-digit", minute:"2-digit" }),
      };
      setMessages(prev => [...prev, assistantMsg]);
      speak(reply);
      const action = parseActionFromReply(reply, "photo upload");
      if (action) setPendingAction(action);
    } catch(err) {
      setMessages(prev => [...prev, { role:"assistant", content:"Could not read that image.", ts:"", isError:true }]);
    }
    setLoading(false);
    e.target.value = "";
  };

  // ── File upload (documents) ──
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const isImage = file.type.startsWith("image/");
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("Read failed"));
        r.readAsDataURL(file);
      });

      const userMsg = {
        role: "user",
        content: `[File uploaded: ${file.name}]`,
        ts: new Date().toLocaleTimeString("en-NZ", { hour:"2-digit", minute:"2-digit" }),
      };
      setMessages(prev => [...prev, userMsg]);

      const msgContent = isImage
        ? [{ type:"image", source:{ type:"base64", media_type:file.type, data:base64 }}, { type:"text", text:"Summarise this and tell me if there is anything I should add to my app." }]
        : [{ type:"text", text:`File: ${file.name}

Summarise this document and tell me if there is anything I should add to my app.` }];

      const reply = await callClaude({
        system: buildSystemPrompt(),
        messages: [{ role:"user", content: msgContent }],
      });

      setMessages(prev => [...prev, {
        role:"assistant", content:reply,
        ts: new Date().toLocaleTimeString("en-NZ", { hour:"2-digit", minute:"2-digit" }),
      }]);
      speak(reply);
    } catch(err) {
      setMessages(prev => [...prev, { role:"assistant", content:"Could not read that file.", ts:"", isError:true }]);
    }
    setLoading(false);
    e.target.value = "";
  };

  // ── Send message ──
  const sendMessage = async (textOverride) => {
    const text = (textOverride !== undefined ? textOverride : input).trim();
    if (!text || loading) return;
    setInput("");
    setPendingAction(null);

    // Handle confirmation of pending action
    const confirmWords = ["yes","confirm","do it","go ahead","yep","yeah","correct","ok","sure"];
    const denyWords = ["no","cancel","stop","don't","dont","nope","negative"];
    if (pendingAction) {
      const lower = text.toLowerCase();
      if (confirmWords.some(w => lower.includes(w))) {
        executeAction(pendingAction);
        const confirmMsg = { role:"assistant", content:"Done.", ts: new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}) };
        setMessages(prev => [...prev, { role:"user", content:text, ts:confirmMsg.ts }, confirmMsg]);
        speak("Done.");
        return;
      }
      if (denyWords.some(w => lower.includes(w))) {
        const cancelMsg = { role:"assistant", content:"Cancelled.", ts: new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}) };
        setMessages(prev => [...prev, { role:"user", content:text, ts:cancelMsg.ts }, cancelMsg]);
        speak("Cancelled.");
        setPendingAction(null);
        return;
      }
    }

    const userMsg = { role:"user", content:text, ts: new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}) };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = newMessages
        .filter((_, i) => i > 0)
        .filter(m => typeof m.content === "string")
        .map(m => ({ role:m.role, content:m.content }));

      const reply = await callClaude({
        system: buildSystemPrompt(),
        messages: apiMessages,
      });

      setMessages(prev => [...prev, {
        role:"assistant", content:reply,
        ts: new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit"}),
      }]);
      speak(reply);

      // Parse for action intent
      const action = parseActionFromReply(reply, text);
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
          {speaking && (
            <button onClick={stopSpeaking} style={{ background:`${T.accent}22`, border:`1px solid ${T.accent}44`, borderRadius:999, padding:"4px 10px", fontSize:11, fontWeight:700, color:T.accent, cursor:"pointer", fontFamily:"inherit" }}>⏹ Stop</button>
          )}
          <button onClick={()=>{setVoiceEnabled(v=>!v);stopSpeaking();}}
            style={{ background:voiceEnabled?`${T.blue}22`:T.elevated, border:`1px solid ${voiceEnabled?T.blue+"44":T.border}`, borderRadius:999, padding:"4px 10px", fontSize:11, fontWeight:700, color:voiceEnabled?T.blue:T.muted, cursor:"pointer", fontFamily:"inherit" }}>
            {voiceEnabled?"🔊":"🔇"}
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
              <div style={{ fontSize:12, color:T.gold, fontWeight:600, marginBottom:8 }}>⚡ {pendingAction.description}</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>sendMessage("yes")}
                  style={{ flex:1, padding:"8px", borderRadius:8, background:T.green, color:"white", fontWeight:700, fontSize:12, border:"none", cursor:"pointer", fontFamily:"inherit" }}>
                  Confirm
                </button>
                <button onClick={()=>sendMessage("no")}
                  style={{ flex:1, padding:"8px", borderRadius:8, background:T.elevated, color:T.muted, fontWeight:700, fontSize:12, border:`1px solid ${T.border}`, cursor:"pointer", fontFamily:"inherit" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}



          {/* Input bar */}
          <div style={{ borderTop:`1px solid ${T.border}`, background:T.bg, padding:"8px 16px 20px" }}>
            {/* Top row — camera and file upload */}
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <label style={{ flex:1, padding:"7px 0", borderRadius:10, border:`1px solid ${T.border}`, background:T.elevated, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <span style={{ fontSize:15 }}>📷</span>
                <span style={{ fontSize:11, fontWeight:600, color:T.muted }}>Camera</span>
                <input type="file" accept="image/*" capture="environment" onChange={handleCameraInput} style={{ display:"none" }} />
              </label>
              <label style={{ flex:1, padding:"7px 0", borderRadius:10, border:`1px solid ${T.border}`, background:T.elevated, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <span style={{ fontSize:15 }}>📎</span>
                <span style={{ fontSize:11, fontWeight:600, color:T.muted }}>File</span>
                <input type="file" accept=".pdf,.txt,.md,image/*" onChange={handleFileUpload} style={{ display:"none" }} />
              </label>
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
            <div style={{ fontSize:11, color:T.blue, lineHeight:1.5 }}>📡 Documents stored this session only. Puter cloud sync coming soon.</div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
    </div>
  );
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
function BottomNav({ active, onNavigate }) {
  const items = [
    { id:"home",     icon:"home",     label:"Home" },
    { id:"health",   icon:"health",   label:"Health" },
    { id:"tasks",    icon:"tasks",    label:"Tasks" },
    { id:"calendar", icon:"calendar", label:"Calendar" },
    { id:"tars",     icon:"tars",     label:"TARS" },
  ];
  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, background:T.card, borderTop:`1px solid ${T.border}`, display:"flex", zIndex:100, paddingBottom:"env(safe-area-inset-bottom,0px)" }}>
      {items.map(item => {
        const isActive = active===item.id;
        return (
          <button key={item.id} onClick={()=>onNavigate(item.id)} style={{ flex:1, padding:"10px 4px 8px", background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <Icon name={item.icon} size={20} color={isActive?T.accent:T.muted} />
            <span style={{ fontSize:9, fontWeight:600, color:isActive?T.accent:T.muted, letterSpacing:"0.04em" }}>{item.label.toUpperCase()}</span>
            {isActive && <div style={{ width:16, height:2, borderRadius:1, background:T.accent, marginTop:1 }} />}
          </button>
        );
      })}
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
  const [screen, setScreen] = useState("home");
  const [tasks, setTasks] = useState(INIT_TASKS);

  // ── HEALTH STATE (source of truth — TARS can write here) ───────────────────
  const [healthEntries, setHealthEntries] = useState([{
    date:"26 Jun 2026", weight:USER.health.weight, bodyFat:USER.health.bodyFat,
    fatMass:USER.health.fatMass, muscle:USER.health.muscle, bp:USER.health.bp,
  }]);
  const todayLabel = new Date().toLocaleDateString("en-NZ",{day:"numeric",month:"short",year:"numeric"});
  const [calLog, setCalLog] = useState({});

  // ── CALENDAR STATE (source of truth for whole app) ──────────────────────────
  const [calEvents, setCalEvents] = useState(INIT_CAL_EVENTS);
  const [rotationBlocks, setRotationBlocks] = useState(INIT_ROTATION);

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
      case "tars":     return <TarsScreen onBack={()=>setScreen("home")} appState={{ tasks, setTasks, calLog, setCalLog, calEvents, addCalEvent, healthEntries, setHealthEntries, todayLabel, setScreen }} />;
      default:         return <HomeScreen onNavigate={setScreen} tasks={tasks} onToggleTask={toggleTask} nextFlight={nextFlight} rotationInfo={rotationInfo} />;
    }
  };

  return (
    <div style={{ background:T.bg, minHeight:"100vh", fontFamily:"'Inter', system-ui, -apple-system, sans-serif", color:T.text, maxWidth:480, margin:"0 auto", position:"relative" }}>
      <div style={{ position:"sticky", top:0, zIndex:50, background:`${T.bg}ee`, backdropFilter:"blur(12px)", borderBottom:`1px solid ${T.border}`, padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ fontSize:18, fontWeight:800, letterSpacing:"-0.02em", color:T.text }}>LIFE<span style={{ color:T.accent }}>.</span></div>
        <button onClick={()=>setScreen("tars")} style={{ background:T.elevated, border:`1px solid ${T.border}`, borderRadius:999, padding:"6px 12px", display:"flex", alignItems:"center", gap:6, cursor:"pointer", color:T.blue, fontSize:11, fontWeight:700 }}>
          <Icon name="mic" size={12} color={T.blue} /> TARS
        </button>
      </div>
      <div style={{ paddingBottom:80 }}>{renderScreen()}</div>
      <BottomNav active={["home","health","tasks","calendar","tars"].includes(screen)?screen:"home"} onNavigate={setScreen} />
    </div>
  );
}
