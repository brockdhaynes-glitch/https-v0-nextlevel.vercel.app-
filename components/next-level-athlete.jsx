"use client";

import { useState, useEffect, useRef, useMemo } from "react";

/* =========================================================================
   NEXTLEVEL ATHLETE
   A personalized morning training system for youth baseball players.
   ========================================================================= */

/* ---------------------------- design tokens ----------------------------- */
const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
`;

const TOKENS = `
:root{
  --bg:#12161d;
  --bg-elev:#181f29;
  --card:#1d2531;
  --card-2:#232c3a;
  --border:rgba(245,241,232,0.09);
  --border-strong:rgba(245,241,232,0.16);
  --text:#f4f1e9;
  --text-muted:#8f99a8;
  --text-dim:#5f6a7a;
  --amber:#f0a857;
  --amber-dim:#8a642f;
  --clay:#c1694f;
  --grass:#6fa287;
  --grass-dim:#3c5548;
  --yellow:#e6c260;
  --red:#d9695f;
  --radius:14px;
  --radius-sm:9px;
}
`;

/* ------------------------------ utilities -------------------------------- */
const pad2 = (n) => String(n).padStart(2, "0");

function timeToMinutes(t) {
  // t: "HH:MM" 24h
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToClock(mins) {
  let m = ((mins % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${pad2(mm)} ${ampm}`;
}
function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function prettyDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function watchUrl(drillName) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(drillName + " baseball drill how to")}`;
}

/* --------------------------- storage helpers ------------------------------ */
const STORAGE_PREFIX = "nextlevel:";
async function loadKey(key, fallback) {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (raw !== null && raw !== undefined) return JSON.parse(raw);
    return fallback;
  } catch (e) {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error("storage save failed", key, e);
  }
}
async function deleteKey(key) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch (e) {
    /* key may not exist */
  }
}

/* ============================== constants ================================ */

const AGE_GROUPS = [
  { id: "10-12", label: "10–12", min: 10, max: 12 },
  { id: "13-14", label: "13–14", min: 13, max: 14 },
  { id: "15-16", label: "15–16", min: 15, max: 16 },
  { id: "17-18", label: "17–18", min: 17, max: 18 },
];

function ageGroupFor(age) {
  const a = Number(age);
  return AGE_GROUPS.find((g) => a >= g.min && a <= g.max) || AGE_GROUPS[1];
}

const POSITIONS = [
  "Pitcher", "Catcher", "First Base", "Infielder", "Outfielder", "Two-Way Player", "Hitter (Position Player)",
];

const GOALS = [
  "Throw harder", "Improve pitching command", "Become a better hitter", "Improve fielding",
  "Improve speed", "Get stronger", "Improve athleticism", "Prepare for high school ball",
  "Prepare for college ball", "General development",
];

const EQUIPMENT = [
  "Baseball", "Glove", "Bat", "Tee", "Net", "Mound", "Plyo balls", "Resistance bands",
  "Dumbbells", "Barbell", "Medicine ball", "Cones", "Agility ladder", "Weight room",
];

const NAV = [
  { id: "home", label: "Today", icon: "home" },
  { id: "calendar", label: "Calendar", icon: "cal" },
  { id: "progress", label: "Progress", icon: "chart" },
  { id: "coach", label: "AI Coach", icon: "chat" },
  { id: "more", label: "More", icon: "dots" },
];

/* ============================ activity library ============================
   Each drill: id, name, purpose, cues[], mistakes[], whenToStop, weight
   (weight = relative share of the time block; scaled to fit available time) */

const LIB = {
  dynamicWarmup: [
    { id: "dw1", name: "Dynamic Warm-up", purpose: "Raise heart rate and prep joints/muscles for throwing, hitting, and running.",
      cues: ["Leg swings, walking lunges, arm circles", "Gradually increase range of motion", "Light jog or shuffle to finish"],
      mistakes: ["Skipping straight to static stretching", "Rushing through it cold"],
      whenToStop: "Stop if you feel sharp pain anywhere — this should just get you warm.", weight: 1 },
  ],
  throwPrep: [
    { id: "tp1", name: "Throwing Preparation", purpose: "Progressively build arm readiness before higher-intent throwing.",
      cues: ["Start with short-distance easy catch", "Gradually extend distance", "Focus on a clean, relaxed arm path"],
      mistakes: ["Airing it out on the first throw", "Rushing distance before the arm is loose"],
      whenToStop: "Stop and tell an adult if you feel arm pain (not normal warm-up looseness).", weight: 1 },
  ],
  pitching: [
    { id: "pd1", name: "Mechanical Drills", purpose: "Reinforce clean pitching mechanics at low intensity.",
      cues: ["Balance drills", "Stride-line work", "Slow-motion delivery reps"],
      mistakes: ["Doing drills at full effort", "Ignoring balance/tempo"],
      whenToStop: "Stop this block if mechanics feel off due to fatigue — quality over reps.", weight: 1 },
    { id: "pd2", name: "Fastball Command", purpose: "Build accuracy and consistency on the fastball to a target.",
      cues: ["Pick a small target, not just 'the zone'", "Stay tall through release", "Repeat your pre-pitch routine"],
      mistakes: ["Throwing max effort every pitch", "Chasing velocity over location"],
      whenToStop: "Stop if command falls apart from fatigue, or if you feel any arm discomfort.", weight: 1.4 },
    { id: "pd3", name: "Changeup Development", purpose: "Develop feel and arm-speed deception on the changeup.",
      cues: ["Same arm speed as fastball", "Focus on grip and release feel, not just outcome"],
      mistakes: ["Slowing the arm down to slow the ball down", "Overthrowing it"],
      whenToStop: "Stop if grip/feel is off today — this is a feel pitch, not a force pitch.", weight: 0.9 },
    { id: "pd4", name: "Flat-Ground Work", purpose: "Lower-stress rep-building away from a mound.",
      cues: ["Focus on tempo and direction to the target", "Stay under your throwing program's guidelines"],
      mistakes: ["Treating flat ground like a bullpen max-effort session"],
      whenToStop: "Follow your coach or team's pitch-count / rest guidance for your age group.", weight: 1 },
  ],
  hitting: [
    { id: "ht1", name: "Tee Work", purpose: "Groove the swing path with a stationary ball.",
      cues: ["Same pre-swing setup every rep", "Work all fields — inside, middle, outside tee position"],
      mistakes: ["Rushing reps without checking swing path", "Only pulling the ball"],
      whenToStop: "Stop the block once swing quality starts dropping from fatigue.", weight: 1 },
    { id: "ht2", name: "Soft Toss", purpose: "Add timing and a moving ball to swing work.",
      cues: ["Stay short to the ball", "Trust your hands, don't lunge"],
      mistakes: ["Tossing too fast for the athlete's timing level"],
      whenToStop: "Stop if timing/contact quality drops off noticeably.", weight: 1 },
    { id: "ht3", name: "Front Toss / Timing", purpose: "Build timing against a live-look pitch.",
      cues: ["Load early, stay balanced", "Focus on barrel control over exit velocity"],
      mistakes: ["Trying to hit every ball as hard as possible"],
      whenToStop: "Wrap up once bat speed or focus starts to fade.", weight: 1.1 },
    { id: "ht4", name: "Plate Discipline / Situational", purpose: "Sharpen pitch recognition and situational approach.",
      cues: ["Call balls/strikes out loud before swinging", "Practice a 2-strike approach"],
      mistakes: ["Swinging at everything just to make contact"],
      whenToStop: "This is a lower-fatigue block — good for tired days.", weight: 0.8 },
  ],
  fielding: [
    { id: "if1", name: "Infield Fundamentals", purpose: "Clean footwork and glove work on ground balls.",
      cues: ["Get in front, low to high", "Funnel the ball to your body", "Quick, accurate exchange"],
      mistakes: ["Fielding standing straight up", "Rushing the throw before securing the ball"],
      whenToStop: "Stop the block if fatigue is causing sloppy fundamentals.", weight: 1 },
    { id: "if2", name: "Double-Play Footwork", purpose: "Build the pivot, feed, and timing needed to turn two.",
      cues: ["Catch and throw in one motion at the bag", "Feet find the bag before the ball arrives", "Communicate early with your partner"],
      mistakes: ["Rushing the pivot before securing the transfer", "Standing directly on the bag instead of using it"],
      whenToStop: "Stop if footwork gets sloppy from fatigue — timing matters more than speed here.", weight: 1 },
    { id: "if3", name: "First-Base Scoops", purpose: "Cleanly field low, short-hop, and off-target throws at first.",
      cues: ["Stretch after the ball is released, not before", "Get your glove down early on short hops", "Stay on the bag, don't leave early"],
      mistakes: ["Reaching before establishing footing", "Stabbing at short hops instead of scooping through them"],
      whenToStop: "Wrap up once your reads on the hop start getting late.", weight: 0.9 },
  ],
  catching: [
    { id: "ct1", name: "Receiving & Framing", purpose: "Present borderline pitches cleanly to help get strike calls.",
      cues: ["Quiet hands, soft glove", "Catch the ball moving toward the zone, not away from it", "Stay low and stable in your stance"],
      mistakes: ["Stabbing at the ball", "Yanking pitches back toward the middle"],
      whenToStop: "Stop the block once your hands start getting noisy from fatigue.", weight: 1 },
    { id: "ct2", name: "Blocking Balls in the Dirt", purpose: "Keep the ball in front on pitches in the dirt.",
      cues: ["Drop straight down, chin to chest", "Round your back to keep the ball in front", "Cover the middle of the plate first"],
      mistakes: ["Reaching with the glove instead of blocking with the body", "Turning your shoulders away from the ball"],
      whenToStop: "This is high-impact on the body — keep total reps modest.", weight: 1 },
    { id: "ct3", name: "Throwdowns to Bases", purpose: "Quick, accurate exchange and release on stolen-base attempts.",
      cues: ["Get your feet moving out of your stance", "Quick transfer, low release point", "Throw through the bag, not at the runner"],
      mistakes: ["Rushing the transfer and dropping accuracy", "Standing tall too early and losing quickness"],
      whenToStop: "Stop if arm feels off — this counts as throwing volume for the day.", weight: 1 },
  ],
  outfield: [
    { id: "of1", name: "Outfield Routes & Reads", purpose: "Improve first-step reaction and route efficiency.",
      cues: ["Read off the bat, not the flight", "Drop step on balls over your head", "Take efficient angles, not straight lines"],
      mistakes: ["False-stepping in", "Rounding routes too much"],
      whenToStop: "Keep this block short and sharp — quality reps over volume.", weight: 1 },
  ],
  fieldingGeneral: [
    { id: "fd3", name: "Catch Play / Throwing Accuracy", purpose: "Accurate, on-line throws with a crow-hop.",
      cues: ["Crow hop and get your feet under you", "Throw through a target, not just at it"],
      mistakes: ["Throwing max effort with poor mechanics"],
      whenToStop: "Stop if arm feels off — this counts as throwing volume for the day.", weight: 0.9 },
  ],
  speed: [
    { id: "sp1", name: "Acceleration Mechanics", purpose: "Improve first-step quickness and sprint mechanics.",
      cues: ["Drive knees forward, not just up", "Stay low through the first steps"],
      mistakes: ["Standing up too early out of the start"],
      whenToStop: "Stop a rep early if form breaks down — speed work is about quality.", weight: 1 },
    { id: "sp2", name: "Agility / Change of Direction", purpose: "Build the ability to decelerate and redirect quickly.",
      cues: ["Bend the knees, stay athletic", "Plant and go — don't round cuts"],
      mistakes: ["Going too fast before mechanics are solid"],
      whenToStop: "This is a nervous-system-taxing block — keep total volume low.", weight: 1 },
  ],
  strength: [
    { id: "st1", name: "Foundational Strength Circuit", purpose: "Build general strength appropriate for the athlete's age and experience.",
      cues: ["Bodyweight or light-load movements for younger athletes", "Focus on clean technique before adding load"],
      mistakes: ["Maxing out without supervision", "Sacrificing form for more weight/reps"],
      whenToStop: "Younger or less experienced athletes should train under qualified supervision.", weight: 1.4 },
    { id: "st2", name: "Core & Stability", purpose: "Build a stable base for throwing, hitting, and running.",
      cues: ["Controlled, slow reps", "Breathe — don't hold your breath through the whole set"],
      mistakes: ["Rushing through reps for speed"],
      whenToStop: "Stop a set if form breaks down.", weight: 1 },
  ],
  recovery: [
    { id: "rc1", name: "Mobility Flow", purpose: "Restore range of motion and reduce stiffness.",
      cues: ["Slow, controlled movements", "Breathe through each position"],
      mistakes: ["Rushing through it like a warm-up instead of recovery"],
      whenToStop: "This should feel easy — back off anything that feels sharp.", weight: 1 },
    { id: "rc2", name: "Easy Movement", purpose: "Light, low-stress activity to promote blood flow without adding fatigue.",
      cues: ["Easy walk, light bike, or easy catch if appropriate", "Keep effort conversational"],
      mistakes: ["Turning 'easy' into an actual workout"],
      whenToStop: "If it starts to feel like training, dial it back — today is about recovery.", weight: 1 },
    { id: "rc3", name: "Breathing & Reset", purpose: "Lower stress and support recovery.",
      cues: ["Slow nasal breathing", "A few minutes, no phone"],
      mistakes: ["Skipping this because it 'doesn't feel like training'"],
      whenToStop: "N/A — low risk, short block.", weight: 0.6 },
  ],
  cooldown: [
    { id: "cd1", name: "Cooldown", purpose: "Bring the body back down and start the recovery process.",
      cues: ["Easy walk", "Light static stretching", "Hydrate"],
      mistakes: ["Skipping this to save five minutes"],
      whenToStop: "N/A", weight: 1 },
  ],
};

const DAY_TYPE_META = {
  "Pitching + Hitting": { blocks: ["dynamicWarmup", "throwPrep", "pitching", "hitting", "cooldown"] },
  "Hitting + Fielding": { blocks: ["dynamicWarmup", "hitting", "fielding", "cooldown"] },
  "Fielding + Speed": { blocks: ["dynamicWarmup", "fielding", "speed", "cooldown"] },
  "Strength + Speed": { blocks: ["dynamicWarmup", "strength", "speed", "cooldown"] },
  "Light Skill Day": { blocks: ["dynamicWarmup", "hitting", "cooldown"], light: true },
  "Recovery Day": { blocks: ["recovery", "cooldown"], light: true },
  "Game Day Prep": { blocks: ["dynamicWarmup", "recovery"], light: true },
  "Off Day": { blocks: [] },
};

/* ============================ rules engine ================================ */

function parseSleepHours(v) {
  if (v == null) return 8;
  if (typeof v === "number") return v;
  const map = { "<5": 4.5, "5-6": 5.5, "6-7": 6.5, "7-8": 7.5, "8-9": 8.5, "9+": 9.5 };
  if (map[v] != null) return map[v];
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 8;
}

function assessReadiness(r) {
  if (!r) return { level: "unknown", label: "Not checked in", color: "var(--text-dim)" };
  const painFlags = [r.arm === "Painful", r.legs === "Painful", r.soreness === "Significant", r.illness];
  if (painFlags.some(Boolean)) {
    return { level: "red", label: "STOP — talk to an adult", color: "var(--red)" };
  }
  const score = Number(r.score) || 3;
  const tiredFlags = [
    score <= 2, parseSleepHours(r.sleepHours) < 6, r.arm === "Sore", r.legs === "Sore",
    r.soreness === "Moderate", r.arm === "A little tired", r.stress === "High",
  ];
  const tiredCount = tiredFlags.filter(Boolean).length;
  if (tiredCount >= 2 || score <= 2) {
    return { level: "yellow", label: "Take it easier today", color: "var(--yellow)" };
  }
  return { level: "green", label: "Ready to train", color: "var(--grass)" };
}

function readinessFactors(r) {
  if (!r) return [];
  const factors = [];
  if (r.arm === "Painful") factors.push("arm reported painful");
  if (r.legs === "Painful") factors.push("legs reported painful");
  if (r.soreness === "Significant") factors.push("significant soreness");
  if (r.illness) factors.push("feeling sick");
  if (Number(r.score) <= 2) factors.push("low readiness score");
  if (parseSleepHours(r.sleepHours) < 6) factors.push(`only ${r.sleepHours} hrs sleep`);
  if (r.arm === "Sore") factors.push("arm sore");
  if (r.arm === "A little tired") factors.push("arm a little tired");
  if (r.legs === "Sore") factors.push("legs sore");
  if (r.soreness === "Moderate") factors.push("moderate soreness");
  if (r.stress === "High") factors.push("high stress");
  return factors;
}

function planReasonText(dayType, readiness, readinessInfo, mandatoryRest) {
  if (mandatoryRest) return "Scheduled rest day — even a full week of green days needs a break built in.";
  if (readiness?.schedule && readiness.schedule !== "None") {
    return `${readiness.schedule} today — the plan is built around saving energy for it.`;
  }
  const factors = readinessFactors(readiness);
  if (readinessInfo.level === "red") {
    return `Recovery only — ${factors.slice(0, 2).join(", ") || "reported symptoms today"}.`;
  }
  if (readinessInfo.level === "yellow") {
    return `Lighter day because: ${factors.slice(0, 2).join(", ") || "reduced readiness today"}.`;
  }
  if (readinessInfo.level === "green") {
    return "Good readiness across the board — normal training day.";
  }
  return null;
}

function analyzeReadinessTrend(readinessHistory, days = 7) {
  const keys = Array.from({ length: days }, (_, i) => todayKey(new Date(Date.now() - (days - 1 - i) * 86400000)));
  const entries = keys.map((k) => readinessHistory[k]).filter(Boolean);
  const checkedInDays = entries.length;
  if (checkedInDays < 3) return { flags: [], checkedInDays };

  const armIssues = entries.filter((e) => ["A little tired", "Sore", "Painful"].includes(e.arm)).length;
  const armPain = entries.filter((e) => e.arm === "Painful").length;
  const legIssues = entries.filter((e) => ["Tired", "Sore", "Painful"].includes(e.legs)).length;
  const sorenessIssues = entries.filter((e) => ["Moderate", "Significant"].includes(e.soreness)).length;
  const lowSleep = entries.filter((e) => parseSleepHours(e.sleepHours) < 6).length;

  const flags = [];
  if (armIssues >= 3) {
    flags.push({
      area: "Arm", level: armPain >= 1 || armIssues >= 5 ? "red" : "yellow",
      text: `Arm reported tired, sore, or painful on ${armIssues} of the last ${checkedInDays} check-ins.`,
    });
  }
  if (legIssues >= 4) {
    flags.push({
      area: "Legs", level: legIssues >= 6 ? "red" : "yellow",
      text: `Legs reported tired, sore, or painful on ${legIssues} of the last ${checkedInDays} check-ins.`,
    });
  }
  if (sorenessIssues >= 3) {
    flags.push({
      area: "Overall soreness", level: sorenessIssues >= 5 ? "red" : "yellow",
      text: `Moderate or significant soreness on ${sorenessIssues} of the last ${checkedInDays} check-ins.`,
    });
  }
  if (lowSleep >= 3) {
    flags.push({
      area: "Sleep", level: lowSleep >= 5 ? "red" : "yellow",
      text: `Under 6 hours of sleep on ${lowSleep} of the last ${checkedInDays} check-ins.`,
    });
  }
  return { flags, checkedInDays };
}

function countConsecutiveTrainingDays(log) {
  let count = 0;
  for (let i = 1; i <= 13; i++) {
    const key = todayKey(new Date(Date.now() - i * 86400000));
    const entry = (log || []).find((l) => l.date === key);
    if (!entry || entry.completedIds.length === 0) break; // no confirmed training that day — can't verify a streak further back
    if (entry.dayType === "Recovery Day") break; // rest day found — streak reset
    count++;
  }
  return count;
}

function pickDayType(profile, readiness, recentLog) {
  const readinessAssessment = assessReadiness(readiness);
  const schedule = readiness?.schedule || "None";

  if (readinessAssessment.level === "red") return "Recovery Day";
  if (schedule === "Game" || schedule === "Tournament") return "Game Day Prep";
  if (countConsecutiveTrainingDays(recentLog) >= 6) return "Recovery Day";
  if (readinessAssessment.level === "yellow") return "Light Skill Day";

  // rotate through a sensible pattern, avoiding two high-intent throwing days in a row
  const isPitcher = profile.positions.includes("Pitcher") || profile.positions.includes("Two-Way Player");
  const lastHardThrow = [...(recentLog || [])].reverse().find((l) => l.dayType === "Pitching + Hitting");
  const yesterday = todayKey(new Date(Date.now() - 86400000));
  const threwYesterday = lastHardThrow && lastHardThrow.date === yesterday;

  const rotation = isPitcher
    ? threwYesterday
      ? ["Hitting + Fielding", "Strength + Speed", "Fielding + Speed"]
      : ["Pitching + Hitting", "Hitting + Fielding", "Fielding + Speed", "Strength + Speed"]
    : ["Hitting + Fielding", "Fielding + Speed", "Strength + Speed"];

  const dayIndex = new Date().getDate() % rotation.length;
  return rotation[dayIndex];
}

function fieldingPoolFor(profile) {
  const pos = (profile && profile.positions) || [];
  const pool = [];
  if (pos.includes("Catcher")) pool.push(...LIB.catching);
  if (pos.includes("Infielder") || pos.includes("First Base") || pos.includes("Two-Way Player") || pos.includes("Hitter (Position Player)")) pool.push(...LIB.fielding);
  if (pos.includes("Outfielder")) pool.push(...LIB.outfield);
  if (pool.length === 0) pool.push(...LIB.fielding); // pitcher-only or unspecified: general infield fundamentals
  pool.push(...LIB.fieldingGeneral);
  return pool;
}

function scaleActivities(dayType, availableMinutes, profile) {
  const meta = DAY_TYPE_META[dayType] || DAY_TYPE_META["Recovery Day"];
  if (meta.blocks.length === 0) return [];
  const usesOwnProgram = !!(profile && profile.hasThrowingProgram);
  // gather one representative set of drills per block (cap 2 drills for non-warmup/cooldown blocks)
  const chosen = [];
  meta.blocks.forEach((blockKey) => {
    if (blockKey === "pitching" && usesOwnProgram) {
      chosen.push({
        id: "coachprogram", name: "Coach's Throwing Program", block: "pitching", weight: 2.3,
        purpose: "Follow the throwing program your coach or team has given you, instead of a generic pitching session.",
        cues: profile.throwingProgramNotes
          ? [profile.throwingProgramNotes]
          : ["Follow your coach's assigned throwing program for today.", "If you're unsure what's on tap, check with your coach before throwing."],
        mistakes: ["Adding extra throwing on top of your program", "Skipping steps your program calls for"],
        whenToStop: "Stop and tell an adult if you feel arm pain — that overrides any program.",
      });
      return;
    }
    const pool = blockKey === "fielding" ? fieldingPoolFor(profile) : LIB[blockKey];
    if (!pool) return;
    if (["dynamicWarmup", "throwPrep", "cooldown"].includes(blockKey)) {
      chosen.push({ ...pool[0], block: blockKey });
    } else if (blockKey === "recovery") {
      pool.forEach((d) => chosen.push({ ...d, block: blockKey }));
    } else {
      // pick up to 2 highest-weight drills for variety, rotated by day-of-year for freshness
      const doy = Math.floor((Date.now() / 86400000)) % pool.length;
      const rotated = [...pool.slice(doy), ...pool.slice(0, doy)];
      rotated.slice(0, 2).forEach((d) => chosen.push({ ...d, block: blockKey }));
    }
  });

  const totalWeight = chosen.reduce((s, a) => s + a.weight, 0) || 1;
  const minMinutes = meta.light ? 3 : 5;
  let remaining = availableMinutes;
  const withMinutes = chosen.map((a, i) => {
    const raw = Math.round((a.weight / totalWeight) * availableMinutes);
    const m = Math.max(minMinutes, raw);
    return { ...a, minutes: m };
  });
  // rescale if total exceeds available (rare, due to minMinutes floor)
  const sum = withMinutes.reduce((s, a) => s + a.minutes, 0);
  if (sum > availableMinutes && availableMinutes > 0) {
    const factor = availableMinutes / sum;
    withMinutes.forEach((a) => (a.minutes = Math.max(3, Math.round(a.minutes * factor))));
  }
  return withMinutes;
}

function buildMorningSchedule(profile, activities) {
  const wake = timeToMinutes(profile.wakeTime);
  const leave = timeToMinutes(profile.leaveTime);
  if (wake == null || leave == null) return { schedule: [], warning: null };

  const fixedAfter = 5 + 12 + 15; // shower(12) + breakfast/get ready(15) + hydrate(5)
  const totalWindow = leave - wake;
  const trainingBudget = Math.max(0, totalWindow - fixedAfter);
  const requestedTraining = activities.reduce((s, a) => s + a.minutes, 0);

  let finalActivities = activities;
  let warning = null;
  if (requestedTraining > trainingBudget && requestedTraining > 0) {
    const factor = Math.max(0.3, trainingBudget / requestedTraining);
    finalActivities = activities.map((a) => ({ ...a, minutes: Math.max(3, Math.round(a.minutes * factor)) }));
    warning = "Your training time was shortened to fit between wake-up and leave-time. Consider waking up a little earlier if you want longer sessions.";
  }

  let cursor = wake;
  const schedule = [];
  schedule.push({ id: "am-wake", name: "Wake up", minutes: 0, fixed: true, time: cursor });
  cursor += 5;
  schedule.push({ id: "am-hydrate", name: "Hydrate & get ready", minutes: 5, fixed: true, time: cursor - 5 });

  finalActivities.forEach((a) => {
    schedule.push({ ...a, id: `am-${a.id}`, time: cursor });
    cursor += a.minutes;
  });

  schedule.push({ id: "am-shower", name: "Shower", minutes: 12, fixed: true, time: cursor });
  cursor += 12;
  schedule.push({ id: "am-readybfast", name: "Get ready & breakfast", minutes: 15, fixed: true, time: cursor });
  cursor += 15;
  schedule.push({ id: "am-leave", name: profile.inSchool !== false ? "Leave for school" : "Start your day", minutes: 0, fixed: true, time: leave });

  return { schedule, warning };
}

/* ============================ afternoon / evening ========================== */

const SCHEDULE_DURATIONS = { Practice: 105, Game: 150, Tournament: 195 };

function pickAfternoonDayType(profile, readiness, morningDayType, log) {
  const readinessAssessment = assessReadiness(readiness);
  const schedule = readiness?.schedule || "None";

  if (schedule === "Practice") return "Team Practice";
  if (schedule === "Game") return "Game";
  if (schedule === "Tournament") return "Tournament";
  if (readinessAssessment.level === "red") return "Recovery Day";
  if (readinessAssessment.level === "yellow") return "Light Skill Day";
  if (!profile.afternoonTrainingEnabled) return "Recovery Day";

  // pick something complementary to the morning session so the same skill isn't maxed twice
  const isPitcher = profile.positions.includes("Pitcher") || profile.positions.includes("Two-Way Player");
  const pool = (isPitcher
    ? ["Hitting + Fielding", "Fielding + Speed", "Strength + Speed", "Pitching + Hitting"]
    : ["Hitting + Fielding", "Fielding + Speed", "Strength + Speed"]
  ).filter((d) => d !== morningDayType);
  if (pool.length === 0) return "Light Skill Day";
  const dayIndex = new Date().getDate() % pool.length;
  return pool[dayIndex];
}

function buildAfternoonSchedule(profile, readiness, afternoonDayType, log) {
  const inSchool = profile.inSchool !== false;
  const schoolStart = timeToMinutes(profile.schoolStartTime || "08:00");
  const anchor = inSchool
    ? timeToMinutes(profile.schoolEndTime || "15:15")
    : timeToMinutes(profile.afternoonStartTime || "12:00");
  const bedtime = timeToMinutes(profile.bedtime || "21:30");
  if (anchor == null || bedtime == null) return { schedule: [], warning: null, isEventDay: false };

  // bedtime is typically the next relative clock time after the anchor; handle midnight wrap
  const bedtimeAbs = bedtime <= anchor ? bedtime + 1440 : bedtime;
  const totalWindow = bedtimeAbs - anchor;

  const scheduleType = readiness?.schedule || "None";
  const isEventDay = ["Practice", "Game", "Tournament"].includes(scheduleType);
  const dinner = timeToMinutes(profile.dinnerTime || "18:00");
  const dinnerAbs = dinner != null ? (dinner <= anchor ? dinner + 1440 : dinner) : null;
  const homeworkMinutes = inSchool ? (profile.homeworkMinutes || 45) : 0;
  const windDown = 15;

  let cursor = anchor;
  const schedule = [];

  if (inSchool && schoolStart != null) {
    schedule.push({ id: "pm-school", name: "School", minutes: Math.max(0, anchor - schoolStart), fixed: true, time: schoolStart });
  }
  schedule.push({ id: "pm-schoolout", name: inSchool ? "Out of school" : "Afternoon begins", minutes: 0, fixed: true, time: cursor });
  cursor += 10;
  schedule.push({ id: "pm-snack", name: "Snack & hydrate", minutes: 10, fixed: true, time: cursor - 10 });

  let warning = null;

  if (isEventDay) {
    const eventDefaultStart = cursor + 60;
    let eventStart = readiness?.scheduleTime ? timeToMinutes(readiness.scheduleTime) : null;
    if (eventStart != null && eventStart < anchor) eventStart += 1440;
    if (eventStart == null || eventStart < cursor) eventStart = eventDefaultStart;
    const eventDuration = SCHEDULE_DURATIONS[scheduleType] || 120;

    // light prep before the event, filling the gap without adding real fatigue
    const prepGap = Math.max(0, eventStart - cursor);
    const prepMinutes = Math.min(20, prepGap);
    if (prepMinutes >= 8) {
      schedule.push({ ...LIB.dynamicWarmup[0], id: `pm-prep`, name: "Pre-" + scheduleType.toLowerCase() + " movement prep", minutes: prepMinutes, time: cursor });
    }
    cursor = eventStart;
    schedule.push({ id: "pm-event", name: scheduleType, minutes: eventDuration, fixed: true, time: cursor, tag: scheduleType.toUpperCase() });
    cursor += eventDuration;

    schedule.push({ ...LIB.cooldown[0], id: "pm-postcooldown", name: "Post-" + scheduleType.toLowerCase() + " cooldown", minutes: 10, time: cursor });
    cursor += 10;

    // dinner after the event if it runs late, otherwise at the usual time
    const dinnerTime = dinnerAbs != null && dinnerAbs > cursor ? dinnerAbs : cursor;
    if (dinnerTime > cursor) cursor = dinnerTime;
    schedule.push({ id: "pm-dinner", name: "Dinner", minutes: 30, fixed: true, time: cursor });
    cursor += 30;

    const remaining = bedtimeAbs - windDown - cursor;
    if (homeworkMinutes > 0) {
      if (remaining > 15) {
        const hw = Math.min(homeworkMinutes, remaining);
        schedule.push({ id: "pm-homework", name: "Homework", minutes: hw, fixed: true, time: cursor });
        cursor += hw;
      } else {
        warning = `${scheduleType} runs late tonight — keep homework light and prioritize sleep.`;
      }
    }
  } else {
    const trainingWanted = afternoonDayType === "Recovery Day" ? 15 : (profile.afternoonTrainingMinutes || 30);
    const fixedTotal = homeworkMinutes + 30 + windDown; // homework + dinner + wind-down
    const trainingBudget = Math.max(0, totalWindow - 10 - fixedTotal);
    let activities = scaleActivities(afternoonDayType, Math.min(trainingWanted, trainingBudget), profile);
    if (trainingWanted > trainingBudget) {
      warning = homeworkMinutes > 0
        ? "Afternoon training was shortened to leave enough time for homework, dinner, and a full night's sleep."
        : "Afternoon training was shortened to leave enough time for dinner and a full night's sleep.";
    }
    activities.forEach((a) => {
      schedule.push({ ...a, id: `pm-${a.id}`, time: cursor });
      cursor += a.minutes;
    });

    const dinnerTime = dinnerAbs != null && dinnerAbs > cursor ? dinnerAbs : cursor;
    if (dinnerTime > cursor) cursor = dinnerTime;
    schedule.push({ id: "pm-dinner", name: "Dinner", minutes: 30, fixed: true, time: cursor });
    cursor += 30;

    if (homeworkMinutes > 0) {
      schedule.push({ id: "pm-homework", name: "Homework", minutes: homeworkMinutes, fixed: true, time: cursor });
      cursor += homeworkMinutes;
    }
  }

  schedule.push({ id: "pm-winddown", name: "Wind down (no screens)", minutes: windDown, fixed: true, time: Math.max(cursor, bedtimeAbs - windDown) });
  schedule.push({ id: "pm-bed", name: "Bedtime", minutes: 0, fixed: true, time: bedtimeAbs });

  return { schedule, warning, isEventDay };
}

/* =============================== icons ==================================== */
function Icon({ name, size = 20 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "home": return <svg {...common}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>;
    case "cal": return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>;
    case "chart": return <svg {...common}><path d="M4 20V10M12 20V4M20 20v-7"/></svg>;
    case "chat": return <svg {...common}><path d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4A9 9 0 0 1 3 20l1.3-3.8A8.4 8.4 0 1 1 21 11.5Z"/></svg>;
    case "dots": return <svg {...common}><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>;
    case "back": return <svg {...common}><path d="M15 18l-6-6 6-6"/></svg>;
    case "check": return <svg {...common}><path d="M20 6 9 17l-5-5"/></svg>;
    case "moon": return <svg {...common}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>;
    case "food": return <svg {...common}><path d="M6 3v7a3 3 0 0 0 6 0V3M9 10v11M18 3c-2 1-3 3-3 6s1 4 3 5v7"/></svg>;
    case "shield": return <svg {...common}><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z"/></svg>;
    case "user": return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>;
    case "send": return <svg {...common}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg>;
    default: return null;
  }
}

/* =============================== app shell ================================= */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [readinessHistory, setReadinessHistory] = useState({});
  const [log, setLog] = useState([]);
  const [chat, setChat] = useState([]);
  const [pitchLog, setPitchLog] = useState({});
  const [screen, setScreen] = useState("home");
  const [needsCheckin, setNeedsCheckin] = useState(false);
  const [detailActivity, setDetailActivity] = useState(null);
  const [editingReadiness, setEditingReadiness] = useState(false);
  const [parentMode, setParentMode] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await loadKey("profile", null);
      const rh = await loadKey("readiness-history", {});
      const lg = await loadKey("training-log", []);
      const ch = await loadKey("chat-history", []);
      const pl = await loadKey("pitch-log", {});
      setProfile(p);
      setReadinessHistory(rh);
      setLog(lg);
      setChat(ch);
      setPitchLog(pl);
      if (p && !rh[todayKey()]) setNeedsCheckin(true);
      setLoading(false);
    })();
  }, []);

  const today = todayKey();
  const todaysReadiness = readinessHistory[today];

  async function saveProfile(p) {
    setProfile(p);
    await saveKey("profile", p);
  }
  async function saveReadiness(entry) {
    const next = { ...readinessHistory, [today]: entry };
    setReadinessHistory(next);
    await saveKey("readiness-history", next);
    setNeedsCheckin(false);
    setEditingReadiness(false);
  }
  async function savePitchCount(count) {
    const next = { ...pitchLog, [today]: { pitches: count } };
    setPitchLog(next);
    await saveKey("pitch-log", next);
  }
  async function completeActivity(dayType, activityIds) {
    const existingIdx = log.findIndex((l) => l.date === today);
    const entry = { date: today, dayType, completedIds: activityIds, effort: existingIdx >= 0 ? log[existingIdx].effort : undefined };
    let next;
    if (existingIdx >= 0) {
      next = [...log];
      next[existingIdx] = entry;
    } else {
      next = [...log, entry];
    }
    setLog(next);
    await saveKey("training-log", next);
  }
  async function saveEffort(effort) {
    const existingIdx = log.findIndex((l) => l.date === today);
    let next;
    if (existingIdx >= 0) {
      next = [...log];
      next[existingIdx] = { ...next[existingIdx], effort };
    } else {
      next = [...log, { date: today, dayType, completedIds: [], effort }];
    }
    setLog(next);
    await saveKey("training-log", next);
  }
  async function pushChat(msg) {
    const next = [...chat, msg];
    setChat(next);
    await saveKey("chat-history", next);
    return next;
  }
  async function resetAllData() {
    const keys = ["profile", "readiness-history", "training-log", "chat-history", "pitch-log"];
    for (const k of keys) {
      await deleteKey(k);
    }
    setProfile(null);
    setReadinessHistory({});
    setLog([]);
    setChat([]);
    setPitchLog({});
    setNeedsCheckin(false);
    setEditingReadiness(false);
    setScreen("home");
    setParentMode(false);
  }
  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      readinessHistory,
      trainingLog: log,
      pitchLog,
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const namePart = (profile?.name || "athlete").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      a.href = url;
      a.download = `nextlevel-athlete-${namePart}-${today}.json`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      console.error("Export failed", e);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontFamily: "Inter" }}>
          Loading…
        </div>
      </Shell>
    );
  }

  if (!profile) {
    return (
      <Shell>
        <Onboarding onDone={async (p) => { await saveProfile(p); setNeedsCheckin(true); }} />
      </Shell>
    );
  }

  if (needsCheckin || editingReadiness) {
    const priorDates = Object.keys(readinessHistory).filter((k) => k !== today).sort();
    const previous = priorDates.length ? readinessHistory[priorDates[priorDates.length - 1]] : null;
    return (
      <Shell>
        <ReadinessCheckin
          profile={profile}
          initial={editingReadiness ? todaysReadiness : null}
          previous={previous}
          onCancel={editingReadiness ? () => setEditingReadiness(false) : null}
          onSubmit={saveReadiness}
        />
      </Shell>
    );
  }

  const dayType = pickDayType(profile, todaysReadiness, log);
  const activities = scaleActivities(dayType, profile.trainingMinutes, profile);
  const { schedule, warning } = buildMorningSchedule(profile, activities);
  const readinessInfo = assessReadiness(todaysReadiness);
  const trend = analyzeReadinessTrend(readinessHistory);
  const todaysLog = log.find((l) => l.date === today);
  const mandatoryRest = dayType === "Recovery Day" && readinessInfo.level !== "red" && countConsecutiveTrainingDays(log) >= 6;
  const planReason = planReasonText(dayType, todaysReadiness, readinessInfo, mandatoryRest);

  const afternoonDayType = pickAfternoonDayType(profile, todaysReadiness, dayType, log);
  const { schedule: afternoonSchedule, warning: afternoonWarning, isEventDay } = buildAfternoonSchedule(profile, todaysReadiness, afternoonDayType, log);

  return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <TopBar profile={profile} parentMode={parentMode} setParentMode={setParentMode} screen={screen} />
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {parentMode ? (
            <ParentView profile={profile} readiness={todaysReadiness} readinessInfo={readinessInfo} dayType={dayType} log={log} trend={trend} />
          ) : screen === "home" ? (
            <Home
              profile={profile}
              readiness={todaysReadiness}
              readinessInfo={readinessInfo}
              dayType={dayType}
              schedule={schedule}
              warning={warning}
              afternoonDayType={afternoonDayType}
              afternoonSchedule={afternoonSchedule}
              afternoonWarning={afternoonWarning}
              isEventDay={isEventDay}
              todaysLog={todaysLog}
              todaysPitchCount={pitchLog[today]?.pitches}
              onSavePitchCount={savePitchCount}
              onSaveEffort={saveEffort}
              planReason={planReason}
              trend={trend}
              onOpenActivity={setDetailActivity}
              onChangePlan={() => setEditingReadiness(true)}
              onToggleComplete={(id) => {
                const ids = new Set(todaysLog?.completedIds || []);
                if (ids.has(id)) ids.delete(id); else ids.add(id);
                completeActivity(dayType, Array.from(ids));
              }}
            />
          ) : screen === "calendar" ? (
            <CalendarView log={log} readinessHistory={readinessHistory} />
          ) : screen === "progress" ? (
            <ProgressView log={log} readinessHistory={readinessHistory} profile={profile} pitchLog={pitchLog} />
          ) : screen === "coach" ? (
            <AICoach profile={profile} readiness={todaysReadiness} dayType={dayType} afternoonDayType={afternoonDayType} chat={chat} pushChat={pushChat} setChat={setChat} />
          ) : screen === "more" ? (
            <MoreMenu onNavigate={setScreen} onEditProfile={() => setScreen("editProfile")} onResetData={resetAllData} />
          ) : screen === "nutrition" ? (
            <NutritionView profile={profile} />
          ) : screen === "sleep" ? (
            <SleepView profile={profile} readinessHistory={readinessHistory} />
          ) : screen === "safety" ? (
            <SafetyView />
          ) : screen === "editProfile" ? (
            <EditProfile profile={profile} onSave={saveProfile} onBack={() => setScreen("more")} />
          ) : null}
        </div>
        {!parentMode && screen !== "editProfile" && <BottomNav screen={screen} setScreen={setScreen} />}
      </div>
      {detailActivity && <ActivityModal activity={detailActivity} onClose={() => setDetailActivity(null)} />}
    </Shell>
  );
}

/* =============================== shell/layout ============================== */

function Shell({ children }) {
  return (
    <div style={{
      fontFamily: "'Inter', sans-serif", background: "var(--bg)", color: "var(--text)",
      minHeight: "640px", height: "100%", maxWidth: 480, margin: "0 auto",
      borderRadius: 20, overflow: "hidden", position: "relative", border: "1px solid var(--border)",
      boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
    }}>
      <style>{FONT_IMPORT}{TOKENS}{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
        button { font-family: inherit; cursor: pointer; }
        input, select, textarea { font-family: inherit; }
        .h-display { font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 0.02em; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .btn-primary {
          background: var(--amber); color: #1a1207; border: none; border-radius: 999px;
          padding: 14px 22px; font-weight: 600; font-size: 15px; transition: transform .15s ease, opacity .15s ease;
        }
        .btn-primary:active { transform: scale(0.97); }
        .btn-primary:disabled { opacity: 0.4; }
        .btn-secondary {
          background: transparent; color: var(--text); border: 1px solid var(--border-strong); border-radius: 999px;
          padding: 13px 20px; font-weight: 500; font-size: 14px;
        }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); }
        .chip {
          border: 1px solid var(--border-strong); border-radius: 999px; padding: 9px 14px; font-size: 13.5px;
          background: transparent; color: var(--text-muted); text-align: left;
        }
        .chip.active { background: rgba(240,168,87,0.14); border-color: var(--amber); color: var(--amber); }
        a { color: inherit; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>
      {children}
    </div>
  );
}

function TopBar({ profile, parentMode, setParentMode, screen }) {
  const titles = { home: "Today", calendar: "Calendar", progress: "Progress", coach: "NextLevel Coach", more: "More", nutrition: "Fueling", sleep: "Sleep", safety: "Safety First", editProfile: "Edit Profile" };
  return (
    <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(140deg, var(--amber), var(--clay))" }} />
        <div className="h-display" style={{ fontSize: 15, letterSpacing: "0.06em" }}>{parentMode ? "Parent View" : (titles[screen] || "NextLevel")}</div>
      </div>
      <button
        onClick={() => setParentMode(!parentMode)}
        className="chip"
        style={{ fontSize: 11.5, padding: "6px 11px" }}
        title="Toggle parent view"
      >
        {parentMode ? "Athlete view" : "Parent view"}
      </button>
    </div>
  );
}

function BottomNav({ screen, setScreen }) {
  return (
    <div style={{ display: "flex", borderTop: "1px solid var(--border)", background: "var(--bg-elev)" }}>
      {NAV.map((n) => {
        const active = screen === n.id || (n.id === "more" && ["more","nutrition","sleep","safety","editProfile"].includes(screen));
        return (
          <button key={n.id} onClick={() => setScreen(n.id)}
            style={{
              flex: 1, background: "none", border: "none", padding: "10px 4px 12px", display: "flex",
              flexDirection: "column", alignItems: "center", gap: 4, color: active ? "var(--amber)" : "var(--text-dim)",
            }}>
            <Icon name={n.icon} size={19} />
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{n.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ================================ onboarding ================================ */

function OnboardStep({ title, subtitle, children }) {
  return (
    <div style={{ padding: "28px 22px 10px" }}>
      <div className="h-display" style={{ fontSize: 24, lineHeight: 1.15, marginBottom: 6 }}>{title}</div>
      {subtitle && <div style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function MultiChip({ options, selected, onToggle, max }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button key={o} className={"chip" + (active ? " active" : "")}
            onClick={() => {
              if (active) onToggle(selected.filter((s) => s !== o));
              else if (!max || selected.length < max) onToggle([...selected, o]);
            }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function TimeInput({ label, value, onChange }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "12px 14px", color: "var(--text)", fontSize: 16 }} />
    </label>
  );
}

function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState(null); // null | "quick" | "full"
  const [form, setForm] = useState({
    name: "", age: "14", positions: [], goals: [], equipment: [],
    wakeTime: "05:15", leaveTime: "06:45", trainingMinutes: 30, bedtime: "21:30",
    inSchool: true, schoolStartTime: "08:00", schoolEndTime: "15:15", afternoonStartTime: "12:00",
    dinnerTime: "18:00", homeworkMinutes: 45,
    afternoonTrainingEnabled: true, afternoonTrainingMinutes: 30,
    hasThrowingProgram: false, throwingProgramNotes: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isPitcher = form.positions.includes("Pitcher") || form.positions.includes("Two-Way Player");

  const steps = [
    {
      title: "Welcome to NextLevel Athlete", subtitle: "Train smart. Recover better. Get better. First — how much time do you have right now?",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => setMode("quick")}
            className="card" style={{ padding: 16, textAlign: "left", border: "1px solid " + (mode === "quick" ? "var(--amber)" : "var(--border)"), background: mode === "quick" ? "rgba(240,168,87,0.1)" : "var(--card)" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Quick Start <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>· ~1 min</span></div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>Just name, age, and position. We'll use sensible defaults for everything else — fine-tune it later in Edit Profile.</div>
          </button>
          <button onClick={() => setMode("full")}
            className="card" style={{ padding: 16, textAlign: "left", border: "1px solid " + (mode === "full" ? "var(--amber)" : "var(--border)"), background: mode === "full" ? "rgba(240,168,87,0.1)" : "var(--card)" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Full Setup <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>· ~5 min</span></div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>Goals, equipment, school schedule, throwing program — the most personalized plan from day one.</div>
          </button>
        </div>
      ),
      valid: mode !== null,
    },
    {
      title: "Let's get started", subtitle: "The basics.",
      body: (
        <>
          <label style={{ display: "block", marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>Your name</div>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="First name"
              style={{ width: "100%", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "12px 14px", color: "var(--text)", fontSize: 16 }} />
          </label>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>Age</div>
          <MultiChip options={Array.from({ length: 11 }, (_, i) => String(10 + i))} selected={[form.age]} onToggle={(sel) => set("age", sel[sel.length - 1] || form.age)} />
        </>
      ),
      valid: form.name.trim().length > 0,
    },
    {
      title: "Position(s)", subtitle: "Select all that apply.",
      body: (
        <>
          <MultiChip options={POSITIONS} selected={form.positions} onToggle={(v) => set("positions", v)} />
          {mode === "quick" && (
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 18, lineHeight: 1.5 }}>
              That's it — we'll use typical training times, general-development goals, and no equipment assumptions to start. You can add all of that anytime in Edit Profile.
            </div>
          )}
        </>
      ),
      valid: form.positions.length > 0,
    },
    mode === "full" && isPitcher && {
      title: "Throwing program", subtitle: "If your coach or team already gives you a throwing program, we'll defer to it instead of generic pitching drills.",
      body: (
        <>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>Do you follow a coach or team throwing program?</div>
          <MultiChip options={["No", "Yes"]} selected={[form.hasThrowingProgram ? "Yes" : "No"]} onToggle={(sel) => set("hasThrowingProgram", sel[sel.length - 1] === "Yes")} />
          {form.hasThrowingProgram && (
            <label style={{ display: "block", marginTop: 16 }}>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>Notes about your program (optional)</div>
              <textarea value={form.throwingProgramNotes} onChange={(e) => set("throwingProgramNotes", e.target.value)}
                placeholder="e.g. Mon/Thu long toss, Tue bullpen, rest per coach's pitch count chart"
                rows={4}
                style={{ width: "100%", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "12px 14px", color: "var(--text)", fontSize: 14.5, resize: "vertical" }} />
            </label>
          )}
        </>
      ),
      valid: true,
    },
    mode === "full" && {
      title: "What are your biggest goals?", subtitle: "Pick up to 3.",
      body: <MultiChip options={GOALS} selected={form.goals} onToggle={(v) => set("goals", v)} max={3} />,
      valid: form.goals.length > 0,
    },
    mode === "full" && {
      title: "What equipment do you have?", subtitle: "Select everything available to you.",
      body: <MultiChip options={EQUIPMENT} selected={form.equipment} onToggle={(v) => set("equipment", v)} />,
      valid: true,
    },
    mode === "full" && {
      title: "Your morning", subtitle: "This shapes your daily schedule — be realistic.",
      body: (
        <>
          <TimeInput label="What time do you wake up?" value={form.wakeTime} onChange={(v) => set("wakeTime", v)} />
          <TimeInput label="What time do you need to leave?" value={form.leaveTime} onChange={(v) => set("leaveTime", v)} />
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>Training time available (minutes)</div>
          <MultiChip options={["15", "20", "30", "45", "60"]} selected={[String(form.trainingMinutes)]} onToggle={(sel) => set("trainingMinutes", Number(sel[sel.length - 1]) || form.trainingMinutes)} />
        </>
      ),
      valid: true,
    },
    mode === "full" && {
      title: "Your afternoon & evening", subtitle: "So we can build a plan for after school too, not just the morning.",
      body: (
        <>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>Are you still in school right now?</div>
          <MultiChip options={["Yes", "No"]} selected={[form.inSchool ? "Yes" : "No"]} onToggle={(sel) => set("inSchool", sel[sel.length - 1] === "Yes")} />
          <div style={{ height: 16 }} />

          {form.inSchool ? (
            <>
              <TimeInput label="What time does school start?" value={form.schoolStartTime} onChange={(v) => set("schoolStartTime", v)} />
              <TimeInput label="What time does school end?" value={form.schoolEndTime} onChange={(v) => set("schoolEndTime", v)} />
            </>
          ) : (
            <TimeInput label="What time do you want your afternoon training/routine to start?" value={form.afternoonStartTime} onChange={(v) => set("afternoonStartTime", v)} />
          )}

          <TimeInput label="What time is dinner, usually?" value={form.dinnerTime} onChange={(v) => set("dinnerTime", v)} />
          <TimeInput label="What time do you usually go to sleep?" value={form.bedtime} onChange={(v) => set("bedtime", v)} />

          {form.inSchool && (
            <>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>Typical homework time (minutes)</div>
              <MultiChip options={["30", "45", "60", "90"]} selected={[String(form.homeworkMinutes)]} onToggle={(sel) => set("homeworkMinutes", Number(sel[sel.length - 1]))} />
            </>
          )}

          <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "16px 0 8px", fontWeight: 600 }}>Train again on non-practice/game afternoons?</div>
          <MultiChip options={["No", "Yes"]} selected={[form.afternoonTrainingEnabled ? "Yes" : "No"]} onToggle={(sel) => set("afternoonTrainingEnabled", sel[sel.length - 1] === "Yes")} />
          {form.afternoonTrainingEnabled && (
            <>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "16px 0 8px", fontWeight: 600 }}>Afternoon training time (minutes)</div>
              <MultiChip options={["15", "20", "30", "45", "60"]} selected={[String(form.afternoonTrainingMinutes)]} onToggle={(sel) => set("afternoonTrainingMinutes", Number(sel[sel.length - 1]))} />
            </>
          )}
        </>
      ),
      valid: true,
    },
  ].filter(Boolean);

  const cur = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 5, padding: "16px 22px 0" }}>
        {steps.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? "var(--amber)" : "var(--border-strong)" }} />
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <OnboardStep title={cur.title} subtitle={cur.subtitle}>{cur.body}</OnboardStep>
      </div>
      <div style={{ padding: 18, display: "flex", gap: 10, borderTop: "1px solid var(--border)" }}>
        {step > 0 && <button className="btn-secondary" onClick={() => setStep(step - 1)}>Back</button>}
        <button className="btn-primary" style={{ flex: 1 }} disabled={!cur.valid}
          onClick={() => {
            if (isLast) {
              const finalGoals = mode === "quick" && form.goals.length === 0 ? ["General development"] : form.goals;
              onDone({ ...form, goals: finalGoals, age: Number(form.age), ageGroup: ageGroupFor(form.age).id });
            } else setStep(step + 1);
          }}>
          {isLast ? "Build my profile" : "Continue"}
        </button>
      </div>
    </div>
  );
}

/* ============================== readiness check ============================== */

function ScoreScale({ value, onChange }) {
  const labels = { 5: "Feel great", 4: "Feel good", 3: "Normal", 2: "Tired / sore", 1: "Very tired" };
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n)}
          style={{
            flex: 1, aspectRatio: "1", borderRadius: 12, border: "1px solid " + (value === n ? "var(--amber)" : "var(--border-strong)"),
            background: value === n ? "rgba(240,168,87,0.16)" : "var(--card)", color: value === n ? "var(--amber)" : "var(--text)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, fontFamily: "IBM Plex Mono",
          }}>{n}</button>
      ))}
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

function ReadinessCheckin({ profile, initial, previous, onCancel, onSubmit }) {
  const [r, setR] = useState(initial || {
    score: 4, sleepHours: "7-8", arm: "Normal", legs: "Normal", soreness: "None", stress: "Normal",
    schedule: "None", scheduleTime: "", scheduleIntensity: "Moderate", illness: false,
  });
  const set = (k, v) => setR((cur) => ({ ...cur, [k]: v }));

  return (
    <div style={{ padding: "26px 22px 100px" }}>
      <div className="h-display" style={{ fontSize: 24, marginBottom: 4 }}>How are you feeling today?</div>
      <div style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 8 }}>{profile.name}, this shapes today's plan.</div>
      <div style={{ color: "var(--text-dim)", fontSize: 12.5, marginBottom: 14, lineHeight: 1.5 }}>
        We ask this every morning so the plan can adjust — never to judge, and never to push you through pain.
      </div>

      {previous && !initial && (
        <button className="chip" style={{ marginBottom: 18, display: "block" }}
          onClick={() => setR({ ...previous, illness: false, schedule: "None", scheduleTime: "" })}>
          Copy my last check-in (edit anything that's changed)
        </button>
      )}

      <FieldRow label="Overall readiness">
        <ScoreScale value={r.score} onChange={(v) => set("score", v)} />
      </FieldRow>

      <FieldRow label="Hours of sleep last night">
        <MultiChip options={["<5", "5-6", "6-7", "7-8", "8-9", "9+"]} selected={[r.sleepHours]} onToggle={(sel) => set("sleepHours", sel[sel.length - 1])} />
      </FieldRow>

      <FieldRow label="How does your arm feel?">
        <MultiChip options={["Feels great", "Normal", "A little tired", "Sore", "Painful"]} selected={[r.arm]} onToggle={(sel) => set("arm", sel[sel.length - 1])} />
      </FieldRow>

      <FieldRow label="How do your legs feel?">
        <MultiChip options={["Feel great", "Normal", "Tired", "Sore", "Painful"]} selected={[r.legs]} onToggle={(sel) => set("legs", sel[sel.length - 1])} />
      </FieldRow>

      <FieldRow label="Overall soreness">
        <MultiChip options={["None", "Mild", "Moderate", "Significant"]} selected={[r.soreness]} onToggle={(sel) => set("soreness", sel[sel.length - 1])} />
      </FieldRow>

      <FieldRow label="Stress level">
        <MultiChip options={["Low", "Normal", "High"]} selected={[r.stress]} onToggle={(sel) => set("stress", sel[sel.length - 1])} />
      </FieldRow>

      <FieldRow label="Do you feel sick today?">
        <MultiChip options={["No", "Yes"]} selected={[r.illness ? "Yes" : "No"]} onToggle={(sel) => set("illness", sel[sel.length - 1] === "Yes")} />
      </FieldRow>

      <FieldRow label="Practice or game today?">
        <MultiChip options={["None", "Practice", "Game", "Tournament"]} selected={[r.schedule]} onToggle={(sel) => set("schedule", sel[sel.length - 1])} />
      </FieldRow>

      {r.schedule !== "None" && (
        <>
          <TimeInput label={`What time is ${r.schedule.toLowerCase()}?`} value={r.scheduleTime} onChange={(v) => set("scheduleTime", v)} />
          <FieldRow label="How intense do you expect it to be?">
            <MultiChip options={["Light", "Moderate", "High"]} selected={[r.scheduleIntensity]} onToggle={(sel) => set("scheduleIntensity", sel[sel.length - 1])} />
          </FieldRow>
        </>
      )}

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto", padding: 18, background: "var(--bg)", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
        {onCancel && <button className="btn-secondary" onClick={onCancel}>Cancel</button>}
        <button className="btn-primary" style={{ flex: 1 }} onClick={() => onSubmit(r)}>Build today's plan</button>
      </div>
    </div>
  );
}

/* ================================= home ==================================== */

function ReadinessGauge({ info, score }) {
  const angle = score ? -90 + (score - 1) * 45 : -90;
  return (
    <div style={{ position: "relative", width: 140, height: 78, margin: "0 auto" }}>
      <svg viewBox="0 0 140 78" width="140" height="78">
        <path d="M10 74 A60 60 0 0 1 130 74" fill="none" stroke="var(--border-strong)" strokeWidth="10" strokeLinecap="round" />
        <path d="M10 74 A60 60 0 0 1 130 74" fill="none" stroke={info.color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray="188.5" strokeDashoffset={score ? 188.5 - (188.5 * (score / 5)) : 188.5}
          style={{ transition: "stroke-dashoffset .5s ease" }} />
        <g transform={`rotate(${angle} 70 74)`}>
          <line x1="70" y1="74" x2="70" y2="24" stroke={info.color} strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx="70" cy="74" r="5" fill={info.color} />
      </svg>
      <div className="mono" style={{ position: "absolute", bottom: -2, left: 0, right: 0, textAlign: "center", fontSize: 22, fontWeight: 600, color: info.color }}>
        {score || "–"}<span style={{ fontSize: 12, color: "var(--text-dim)" }}>/5</span>
      </div>
    </div>
  );
}

function Home({ profile, readiness, readinessInfo, dayType, schedule, warning, afternoonDayType, afternoonSchedule, afternoonWarning, isEventDay, todaysLog, todaysPitchCount, onSavePitchCount, onSaveEffort, planReason, trend, onOpenActivity, onChangePlan, onToggleComplete }) {
  const [segment, setSegment] = useState("morning");
  const completedIds = new Set(todaysLog?.completedIds || []);
  const activeSchedule = segment === "morning" ? schedule : afternoonSchedule;
  const activeWarning = segment === "morning" ? warning : afternoonWarning;
  const trainableItems = activeSchedule.filter((s) => !s.fixed);
  const isPitcher = profile.positions.includes("Pitcher") || profile.positions.includes("Two-Way Player");
  const pitchingToday = isPitcher && (dayType === "Pitching + Hitting" || afternoonDayType === "Pitching + Hitting");

  return (
    <div style={{ padding: "20px 18px 30px" }}>
      <div style={{ marginBottom: 4, color: "var(--text-muted)", fontSize: 13 }}>{prettyDate()}</div>
      <div className="h-display" style={{ fontSize: 26 }}>Good morning, {profile.name}</div>

      <div className="card" style={{ marginTop: 18, padding: 18, display: "flex", alignItems: "center", gap: 16 }}>
        <ReadinessGauge info={readinessInfo} score={readiness?.score} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", fontWeight: 600 }}>Readiness</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: readinessInfo.color, margin: "3px 0 8px" }}>{readinessInfo.label}</div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", fontWeight: 600 }}>Morning focus</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{dayType}</div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", fontWeight: 600, marginTop: 6 }}>This afternoon</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{afternoonDayType}</div>
        </div>
      </div>

      {planReason && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, padding: "0 2px" }}>
          <span style={{ color: "var(--text-dim)", fontSize: 13, lineHeight: 1.5 }}>💡</span>
          <span style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.5, fontStyle: "italic" }}>{planReason}</span>
        </div>
      )}

      {readinessInfo.level === "red" && (
        <div className="card" style={{ marginTop: 14, padding: 16, borderColor: "var(--red)", background: "rgba(217,105,95,0.08)" }}>
          <div style={{ fontWeight: 700, color: "var(--red)", marginBottom: 6 }}>Take today seriously</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Based on what you reported, today isn't a training day. Talk to a parent/guardian, coach, athletic trainer, or doctor before doing any baseball activity.
          </div>
        </div>
      )}

      <TrendFlags flags={trend?.flags} />

      <div style={{ display: "flex", gap: 6, marginTop: 22, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 999, padding: 4 }}>
        {[["morning", "Morning"], ["afternoon", "After School"]].map(([id, label]) => (
          <button key={id} onClick={() => setSegment(id)}
            style={{
              flex: 1, border: "none", borderRadius: 999, padding: "9px 0", fontSize: 13, fontWeight: 600,
              background: segment === id ? "var(--amber)" : "transparent", color: segment === id ? "#1a1207" : "var(--text-muted)",
            }}>{label}</button>
        ))}
      </div>

      {activeWarning && (
        <div className="card" style={{ marginTop: 14, padding: 14, fontSize: 13, color: "var(--text-muted)" }}>{activeWarning}</div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 12 }}>
        <div className="h-display" style={{ fontSize: 15, letterSpacing: "0.05em" }}>
          {segment === "morning" ? "Today's Routine" : (isEventDay ? afternoonDayType + " Day" : "This Afternoon")}
        </div>
        <button className="chip" onClick={onChangePlan} style={{ fontSize: 12 }}>Change today's plan</button>
      </div>

      <div style={{ position: "relative", paddingLeft: 6 }}>
        <div style={{ position: "absolute", left: 41, top: 8, bottom: 8, width: 2, background: "var(--border-strong)" }} />
        {activeSchedule.map((item, i) => {
          const isDone = completedIds.has(item.id);
          const isEvent = !!item.tag;
          return (
            <div key={item.id + i} style={{ display: "flex", gap: 12, marginBottom: 10, position: "relative" }}>
              <div className="mono" style={{ width: 66, fontSize: 11.5, color: "var(--text-dim)", paddingTop: 12, flexShrink: 0 }}>
                {minutesToClock(item.time)}
              </div>
              <div
                onClick={() => !item.fixed && onOpenActivity(item)}
                className="card"
                style={{
                  flex: 1, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
                  opacity: item.fixed && !isEvent ? 0.55 : 1, cursor: item.fixed ? "default" : "pointer",
                  borderColor: isDone ? "var(--grass)" : isEvent ? "var(--clay)" : "var(--border)",
                  background: isEvent ? "rgba(193,105,79,0.1)" : "var(--card)",
                }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    {item.name}
                    {isEvent && <span className="mono" style={{ fontSize: 9.5, color: "var(--clay)", border: "1px solid var(--clay)", borderRadius: 4, padding: "1px 5px" }}>{item.tag}</span>}
                  </div>
                  {isEvent && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>~{Math.round(item.minutes / 60 * 10) / 10} hrs</div>}
                </div>
                {!item.fixed && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{item.minutes}m</span>
                    <button onClick={(e) => { e.stopPropagation(); onToggleComplete(item.id); }}
                      style={{
                        width: 26, height: 26, borderRadius: "50%", border: "1.5px solid " + (isDone ? "var(--grass)" : "var(--border-strong)"),
                        background: isDone ? "var(--grass)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                      {isDone && <Icon name="check" size={14} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {segment === "morning" && trainableItems.length === 0 && (
        <div className="card" style={{ padding: 16, marginTop: 8, fontSize: 14, color: "var(--text-muted)" }}>
          No training blocks today — focus on rest, sleep, and coming back ready tomorrow.
        </div>
      )}

      {(todaysLog?.completedIds?.length || 0) > 0 && (
        <EffortCard value={todaysLog?.effort} onSave={onSaveEffort} />
      )}

      {pitchingToday && (
        <PitchCountCard value={todaysPitchCount} onSave={onSavePitchCount} />
      )}
    </div>
  );
}

function EffortCard({ value, onSave }) {
  const options = [
    { id: "great", emoji: "🟢", label: "Great" },
    { id: "ok", emoji: "🟡", label: "OK" },
    { id: "rough", emoji: "🔴", label: "Rough" },
  ];
  return (
    <div className="card" style={{ padding: 16, marginTop: 22 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", fontWeight: 600, marginBottom: 10 }}>How did that feel?</div>
      <div style={{ display: "flex", gap: 10 }}>
        {options.map((o) => (
          <button key={o.id} onClick={() => onSave(o.id)}
            style={{
              flex: 1, borderRadius: 12, padding: "12px 0", border: "1px solid " + (value === o.id ? "var(--amber)" : "var(--border-strong)"),
              background: value === o.id ? "rgba(240,168,87,0.14)" : "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
            <span style={{ fontSize: 20 }}>{o.emoji}</span>
            <span style={{ fontSize: 11.5, color: value === o.id ? "var(--amber)" : "var(--text-muted)", fontWeight: 600 }}>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PitchCountCard({ value, onSave }) {
  const [count, setCount] = useState(value != null ? String(value) : "");
  const [saved, setSaved] = useState(false);
  return (
    <div className="card" style={{ padding: 16, marginTop: 22 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", fontWeight: 600, marginBottom: 8 }}>Throwing Log</div>
      <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
        Log today's pitch count so you (and your coach) can see your workload over time. Follow your team or league's pitch-count and rest guidelines.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <input type="number" min="0" inputMode="numeric" value={count} onChange={(e) => { setCount(e.target.value); setSaved(false); }} placeholder="Pitches thrown"
          style={{ flex: 1, background: "var(--bg-elev)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 15 }} />
        <button className="btn-primary" style={{ padding: "10px 18px" }}
          onClick={() => { const n = Number(count); if (!isNaN(n) && n >= 0) { onSave(n); setSaved(true); } }}>
          {saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </div>
  );
}

function ActivityModal({ activity, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,12,16,0.65)", display: "flex", alignItems: "flex-end", zIndex: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", borderRadius: "20px 20px 0 0", padding: "22px 22px 28px", maxHeight: "80%", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-strong)", margin: "0 auto 16px" }} />
        <div className="h-display" style={{ fontSize: 21 }}>{activity.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 16, flexWrap: "wrap" }}>
          <div className="mono" style={{ color: "var(--amber)", fontSize: 13 }}>{activity.minutes} minutes</div>
          {activity.id !== "coachprogram" && (
            <a href={watchUrl(activity.name)} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--clay)", textDecoration: "none", border: "1px solid var(--border-strong)", borderRadius: 999, padding: "5px 12px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Watch an example
            </a>
          )}
        </div>

        <Section title="Purpose" text={activity.purpose} />
        <Section title="Coaching cues" list={activity.cues} />
        <Section title="Common mistakes" list={activity.mistakes} />
        <Section title="When to stop" text={activity.whenToStop} accent="var(--red)" />

        <button className="btn-primary" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}
function Section({ title, text, list, accent }) {
  if (!text && !list) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.06em", color: accent || "var(--text-dim)", fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {text && <div style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--text)" }}>{text}</div>}
      {list && <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14.5, lineHeight: 1.6 }}>{list.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  );
}

/* ================================ calendar ================================= */

function CalendarView({ log, readinessHistory }) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000);
    return d;
  });
  return (
    <div style={{ padding: "20px 18px 40px" }}>
      <div className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Last 14 Days</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 18 }}>Training + readiness history</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {days.map((d) => {
          const key = todayKey(d);
          const l = log.find((x) => x.date === key);
          const r = readinessHistory[key];
          const info = assessReadiness(r);
          return (
            <div key={key} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: r ? info.color : "var(--border-strong)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{l ? l.dayType : r ? "Checked in, no session logged" : "No data"}</div>
              </div>
              {l && <div className="mono" style={{ fontSize: 11, color: "var(--grass)" }}>{l.completedIds.length} done</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================ progress ================================= */

function TrendFlags({ flags, title }) {
  if (!flags || flags.length === 0) return null;
  const worstLevel = flags.some((f) => f.level === "red") ? "red" : "yellow";
  const color = worstLevel === "red" ? "var(--red)" : "var(--yellow)";
  return (
    <div className="card" style={{ padding: 16, marginTop: 14, borderColor: color, background: worstLevel === "red" ? "rgba(217,105,95,0.08)" : "rgba(230,194,96,0.08)" }}>
      <div style={{ fontWeight: 700, color, marginBottom: 8, fontSize: 14 }}>{title || "This Week's Pattern"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flags.map((f) => (
          <div key={f.area} style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            <span style={{ color: f.level === "red" ? "var(--red)" : "var(--yellow)", fontWeight: 600 }}>{f.area}: </span>
            {f.text}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 10, lineHeight: 1.5 }}>
        {worstLevel === "red"
          ? "This is a pattern worth addressing — consider talking to a parent/guardian, coach, athletic trainer, or doctor."
          : "Worth keeping an eye on. One or two tough days is normal — a repeating pattern is the thing to watch."}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: 16, flex: 1, minWidth: 130 }}>
      <div className="mono" style={{ fontSize: 26, fontWeight: 600, color: "var(--amber)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function generateWeeklySummaryText(profile, log, readinessHistory, pitchLog) {
  const isPitcher = profile.positions.includes("Pitcher") || profile.positions.includes("Two-Way Player");
  const last7 = Array.from({ length: 7 }, (_, i) => todayKey(new Date(Date.now() - (6 - i) * 86400000)));
  const sessions = log.filter((l) => last7.includes(l.date) && l.completedIds.length > 0).length;
  const recoveryDays = log.filter((l) => last7.includes(l.date) && l.dayType === "Recovery Day").length;
  const readinessCounts = { green: 0, yellow: 0, red: 0 };
  last7.forEach((k) => {
    const info = assessReadiness(readinessHistory[k]);
    if (readinessCounts[info.level] != null) readinessCounts[info.level]++;
  });
  const pitchTotal = last7.reduce((s, k) => s + (pitchLog?.[k]?.pitches || 0), 0);
  const start = new Date(Date.now() - 6 * 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const end = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const lines = [
    `${profile.name}'s Week — ${start} to ${end}`,
    `Sessions completed: ${sessions}`,
    `Recovery days: ${recoveryDays}`,
    `Readiness: ${readinessCounts.green} green / ${readinessCounts.yellow} yellow / ${readinessCounts.red} red days`,
  ];
  if (isPitcher) lines.push(`Pitch count (7-day total): ${pitchTotal}`);
  if (profile.goals?.length) lines.push(`Working on: ${profile.goals.join(", ")}`);
  lines.push("— sent from NextLevel Athlete");
  return lines.join("\n");
}

function ProgressView({ log, readinessHistory, profile, pitchLog }) {
  const totalSessions = log.filter((l) => l.completedIds.length > 0).length;
  const recoveryDays = log.filter((l) => l.dayType === "Recovery Day").length;
  const pitchingSessions = log.filter((l) => l.dayType === "Pitching + Hitting").length;
  const hittingSessions = log.filter((l) => l.dayType.includes("Hitting")).length;
  const fieldingSessions = log.filter((l) => l.dayType.includes("Fielding")).length;
  const isPitcher = profile.positions.includes("Pitcher") || profile.positions.includes("Two-Way Player");

  const last7 = Array.from({ length: 7 }, (_, i) => todayKey(new Date(Date.now() - (6 - i) * 86400000)));
  const sleepEntries = last7.map((k) => readinessHistory[k]?.sleepHours).filter(Boolean);
  const consistentSleep = sleepEntries.length >= 5;

  const goalProgress = profile.goals.map((g) => {
    const relevant =
      g.toLowerCase().includes("pitch") || g.toLowerCase().includes("throw") ? pitchingSessions :
      g.toLowerCase().includes("hit") ? hittingSessions :
      g.toLowerCase().includes("field") ? fieldingSessions : totalSessions;
    return { goal: g, count: relevant };
  });

  const pitchDays = last7.map((k) => ({
    key: k, label: new Date(k + "T00:00").toLocaleDateString(undefined, { weekday: "short" }),
    pitches: pitchLog?.[k]?.pitches,
  }));
  const rolling7Total = pitchDays.reduce((s, d) => s + (d.pitches || 0), 0);
  const maxPitches = Math.max(1, ...pitchDays.map((d) => d.pitches || 0));

  const effortEmoji = { great: "🟢", ok: "🟡", rough: "🔴" };
  const effortDays = last7.map((k) => {
    const entry = log.find((l) => l.date === k);
    return { key: k, label: new Date(k + "T00:00").toLocaleDateString(undefined, { weekday: "short" }), effort: entry?.effort };
  });

  return (
    <div style={{ padding: "20px 18px 40px" }}>
      <div className="h-display" style={{ fontSize: 22, marginBottom: 16 }}>Progress</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        <StatCard label="Sessions completed" value={totalSessions} />
        <StatCard label="Recovery days taken" value={recoveryDays} />
        <StatCard label="Sleep logged 5+/7 days" value={consistentSleep ? "Yes" : "Building"} />
      </div>

      {effortDays.some((d) => d.effort) && (
        <>
          <div className="h-display" style={{ fontSize: 14, letterSpacing: "0.05em", marginBottom: 10, color: "var(--text-muted)" }}>How Training Felt</div>
          <div className="card" style={{ padding: 16, marginBottom: 22, display: "flex", justifyContent: "space-between" }}>
            {effortDays.map((d) => (
              <div key={d.key} style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 20 }}>{d.effort ? effortEmoji[d.effort] : "–"}</div>
                <div style={{ fontSize: 9.5, color: "var(--text-dim)", marginTop: 4 }}>{d.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {isPitcher && (
        <>
          <div className="h-display" style={{ fontSize: 14, letterSpacing: "0.05em", marginBottom: 10, color: "var(--text-muted)" }}>Throwing Log</div>
          <div className="card" style={{ padding: 16, marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>7-day rolling total</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--amber)" }}>{rolling7Total}<span style={{ fontSize: 11, color: "var(--text-dim)" }}> pitches</span></div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 6 }}>
              {pitchDays.map((d) => (
                <div key={d.key} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ height: 56, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                    <div style={{ width: 16, borderRadius: 4, background: d.pitches ? "var(--clay)" : "var(--border-strong)", height: `${Math.max(6, ((d.pitches || 0) / maxPitches) * 100)}%` }} />
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>{d.pitches ?? "–"}</div>
                  <div style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{d.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 10, lineHeight: 1.5 }}>
              This is a log, not a limit — always follow your team, league, or coach's pitch-count and rest rules.
            </div>
          </div>
        </>
      )}

      <div className="h-display" style={{ fontSize: 14, letterSpacing: "0.05em", marginBottom: 10, color: "var(--text-muted)" }}>By Skill Area</div>
      <div className="card" style={{ padding: 16, marginBottom: 22 }}>
        {[
          ["Pitching", pitchingSessions],
          ["Hitting", hittingSessions],
          ["Fielding", fieldingSessions],
          ["Recovery", recoveryDays],
        ].map(([label, val]) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
              <span style={{ color: "var(--text-muted)" }}>{label}</span><span className="mono">{val}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--border)" }}>
              <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(100, val * 12)}%`, background: "var(--amber)" }} />
            </div>
          </div>
        ))}
      </div>

      <div className="h-display" style={{ fontSize: 14, letterSpacing: "0.05em", marginBottom: 10, color: "var(--text-muted)" }}>Your Goals</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {goalProgress.map((g) => (
          <div key={g.goal} className="card" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13.5 }}>{g.goal}</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--grass)" }}>{g.count} sessions</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 18, marginBottom: 18, lineHeight: 1.5 }}>
        Progress here is about consistency and development — not body weight or appearance.
      </div>

      <WeeklyShareCard profile={profile} log={log} readinessHistory={readinessHistory} pitchLog={pitchLog} />
    </div>
  );
}

function WeeklyShareCard({ profile, log, readinessHistory, pitchLog }) {
  const [copied, setCopied] = useState(false);
  const [emailed, setEmailed] = useState(false);
  const text = generateWeeklySummaryText(profile, log, readinessHistory, pitchLog);

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch (e2) {
        console.error("Copy failed", e2);
        return false;
      }
    }
  }

  async function copy() {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function emailIt() {
    const subject = profile.name + "'s Week — NextLevel Athlete";
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    // A real, user-activated anchor click is the most reliable way to hand off to a mail
    // client from inside a sandboxed iframe. There's no reliable way to detect whether it
    // actually opened something, so we also copy a ready-to-paste version as a safety net.
    try {
      const a = document.createElement("a");
      a.href = href;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("mailto hand-off failed", e);
    }
    await copyText(`Subject: ${subject}\n\n${text}`);
    setEmailed(true);
    setTimeout(() => setEmailed(false), 4000);
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)", fontWeight: 600, marginBottom: 8 }}>Share This Week</div>
      <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
        Send a quick update to a coach or parent — sessions, recovery, and readiness for the week.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={copy}>{copied ? "Copied ✓" : "Copy summary"}</button>
        <button className="btn-primary" style={{ flex: 1 }} onClick={emailIt}>{emailed ? "Ready ✓" : "Email it"}</button>
      </div>
      {emailed && (
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 10, lineHeight: 1.5 }}>
          If your email app didn't open, the subject and message are copied — just paste them into a new email.
        </div>
      )}
    </div>
  );
}

/* ================================ parent view =============================== */

function ParentView({ profile, readiness, readinessInfo, dayType, log, trend }) {
  const last7 = Array.from({ length: 7 }, (_, i) => todayKey(new Date(Date.now() - (6 - i) * 86400000)));
  const sessionsThisWeek = log.filter((l) => last7.includes(l.date) && l.completedIds.length > 0).length;
  const recoveryThisWeek = log.filter((l) => last7.includes(l.date) && l.dayType === "Recovery Day").length;
  return (
    <div style={{ padding: "20px 18px 40px" }}>
      <div className="h-display" style={{ fontSize: 20, marginBottom: 4 }}>{profile.name}'s Week</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 18 }}>A high-level view — not a substitute for talking with your athlete.</div>

      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, marginBottom: 4 }}>Today</div>
        <div style={{ fontWeight: 700, color: readinessInfo.color, fontSize: 16 }}>{readinessInfo.label}</div>
        <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 2 }}>Focus: {dayType}</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <StatCard label="Sessions this week" value={sessionsThisWeek} />
        <StatCard label="Recovery days" value={recoveryThisWeek} />
      </div>

      {readinessInfo.level === "red" && (
        <div className="card" style={{ padding: 16, borderColor: "var(--red)", background: "rgba(217,105,95,0.08)", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: "var(--red)", marginBottom: 6 }}>Heads up</div>
          <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            {profile.name} reported symptoms that could need attention today (pain, significant soreness, or feeling ill). Consider checking in directly.
          </div>
        </div>
      )}

      <TrendFlags flags={trend?.flags} title="This Week's Pattern" />

      <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5, marginTop: 14 }}>
        This is a single-device demo, so this view reads from the same profile rather than a separate linked account.
      </div>
    </div>
  );
}

/* ================================= AI coach ================================= */

const COACH_SYSTEM_PROMPT_BASE = `You are "NextLevel Coach," an assistant inside a youth baseball training app talking directly to a young athlete.
Rules you must always follow:
- You are not a doctor and must never diagnose injuries or illness.
- If the athlete mentions pain, injury symptoms, illness, dizziness, or anything concerning, tell them to stop and talk to a parent/guardian, coach, athletic trainer, or healthcare professional. Do not suggest they push through it.
- Never encourage training through pain, excessive throwing/volume, extreme dieting, rapid weight change, supplements, or training while sick.
- Keep advice age-appropriate, safety-first, and encouraging. Prioritize recovery when the athlete is fatigued or sore.
- Keep responses short (2-5 sentences) and conversational, like a supportive coach texting an athlete — no long essays, no markdown headers.
- Use the athlete's profile/context below to personalize your answer, and defer to any coach-provided plan over generic advice.`;

function AICoach({ profile, readiness, dayType, afternoonDayType, chat, pushChat, setChat }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat, sending]);

  async function send(text) {
    if (!text.trim() || sending) return;
    setInput("");
    const history = await pushChat({ role: "user", content: text });
    setSending(true);
    try {
      const throwingProgramNote = profile.hasThrowingProgram
        ? `has a coach/team throwing program (${profile.throwingProgramNotes || "no notes given"}) — always defer to that over generic pitching advice`
        : "no separate coach throwing program on file";
      const context = `Athlete context: name=${profile.name}, age=${profile.age}, positions=${profile.positions.join("/")}, goals=${profile.goals.join(", ")}, equipment=${profile.equipment.join(", ") || "none listed"}, today's readiness=${readiness ? JSON.stringify(readiness) : "not checked in"}, today's morning focus=${dayType}, today's afternoon/evening focus=${afternoonDayType || "n/a"}, throwing program: ${throwingProgramNote}.`;
      const apiMessages = history.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: COACH_SYSTEM_PROMPT_BASE + "\n\n" + context,
          messages: apiMessages,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        console.error("NextLevel Coach API error:", data.error || res.status);
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const replyText = data.text || "Sorry, I couldn't get a response right now — try again in a bit.";
      const next = [...history, { role: "assistant", content: replyText }];
      setChat(next);
      await saveKey("chat-history", next);
    } catch (e) {
      console.error("NextLevel Coach request failed:", e);
      const next = [...history, { role: "assistant", content: "I'm having trouble connecting right now. Try again in a moment." }];
      setChat(next);
      await saveKey("chat-history", next);
    } finally {
      setSending(false);
    }
  }

  const suggestions = ["What should I do this morning?", "I'm sore today, what should I change?", "I only have 20 minutes.", "I have a game tonight."];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "18px 16px" }}>
        {chat.length === 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 14, lineHeight: 1.5 }}>
              Hey {profile.name} — I'm your NextLevel Coach. Ask me about today's plan, how to adjust for fatigue or a game, or anything about your training. I'm not a doctor, so for pain or injury I'll always point you to a parent, coach, or trainer.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {suggestions.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div style={{
              maxWidth: "80%", padding: "10px 14px", borderRadius: 16, fontSize: 14.5, lineHeight: 1.45,
              background: m.role === "user" ? "var(--amber)" : "var(--card)",
              color: m.role === "user" ? "#1a1207" : "var(--text)",
              borderBottomRightRadius: m.role === "user" ? 4 : 16, borderBottomLeftRadius: m.role === "user" ? 16 : 4,
            }}>{m.content}</div>
          </div>
        ))}
        {sending && <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Coach is typing…</div>}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 14, borderTop: "1px solid var(--border)" }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your coach…"
          onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
          style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 999, padding: "12px 16px", color: "var(--text)", fontSize: 14.5 }} />
        <button onClick={() => send(input)} disabled={sending}
          style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--amber)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1207", flexShrink: 0 }}>
          <Icon name="send" size={18} />
        </button>
      </div>
    </div>
  );
}

/* ================================= more menu ================================= */

function MoreMenu({ onNavigate, onEditProfile, onResetData }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const items = [
    { id: "nutrition", label: "Fueling & Nutrition", icon: "food" },
    { id: "sleep", label: "Sleep", icon: "moon" },
    { id: "safety", label: "Safety First", icon: "shield" },
  ];
  return (
    <div style={{ padding: "20px 18px 40px" }}>
      <div className="h-display" style={{ fontSize: 22, marginBottom: 16 }}>More</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {items.map((it) => (
          <button key={it.id} onClick={() => onNavigate(it.id)} className="card"
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", textAlign: "left" }}>
            <Icon name={it.icon} size={19} />
            <span style={{ fontSize: 14.5, fontWeight: 500 }}>{it.label}</span>
          </button>
        ))}
        <button onClick={onEditProfile} className="card"
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", textAlign: "left" }}>
          <Icon name="user" size={19} />
          <span style={{ fontSize: 14.5, fontWeight: 500 }}>Edit Profile</span>
        </button>
      </div>

      {confirmingReset ? (
        <div className="card" style={{ padding: 16, borderColor: "var(--red)", background: "rgba(217,105,95,0.08)", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: "var(--red)", marginBottom: 6, fontSize: 14 }}>Reset all data?</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
            This deletes your profile, check-in history, training log, pitch log, and coach chat. This can't be undone.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmingReset(false)}>Cancel</button>
            <button className="btn-primary" style={{ flex: 1, background: "var(--red)", color: "#fff" }} onClick={onResetData}>Reset</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmingReset(true)}
          style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 13, padding: "8px 2px", marginBottom: 12 }}>
          Reset my data
        </button>
      )}

      <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5 }}>
        NextLevel Athlete is educational and does not replace individualized coaching or medical care.
      </div>
    </div>
  );
}

/* ================================ nutrition / sleep / safety ================================ */

function NutritionView({ profile }) {
  return (
    <div style={{ padding: "20px 18px 40px" }}>
      <div className="h-display" style={{ fontSize: 22, marginBottom: 6 }}>Fueling Your Training</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13.5, marginBottom: 18, lineHeight: 1.5 }}>
        Regular meals and hydration matter more than any specific plan. No calorie counting, no restriction — just fuel to train, grow, and recover.
      </div>
      {[
        { t: "Before morning training", d: "Something light and easy on the stomach — like toast with peanut butter, a banana, or a small yogurt — plus water." },
        { t: "After training / before school", d: "A real breakfast with protein and carbs: eggs, oatmeal with fruit, or a breakfast sandwich." },
        { t: "Lunch", d: "A balanced plate — protein, carbs, and something colorful (fruit or veggies). Pack it or grab school lunch, either works." },
        { t: "Hydration", d: "Water throughout the day, more on training or game days. Thirst is a late signal — don't wait for it." },
        { t: "After practice or a game", d: "A snack with protein and carbs within an hour or two helps recovery — like chocolate milk, a sandwich, or fruit and yogurt." },
      ].map((s) => (
        <div key={s.t} className="card" style={{ padding: 16, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>{s.t}</div>
          <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{s.d}</div>
        </div>
      ))}
    </div>
  );
}

function SleepView({ profile, readinessHistory }) {
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return { key: todayKey(d), label: d.toLocaleDateString(undefined, { weekday: "short" }), hours: readinessHistory[todayKey(d)]?.sleepHours };
  });
  return (
    <div style={{ padding: "20px 18px 40px" }}>
      <div className="h-display" style={{ fontSize: 22, marginBottom: 6 }}>Sleep</div>
      <div style={{ color: "var(--text-muted)", fontSize: 13.5, marginBottom: 18, lineHeight: 1.5 }}>
        Your training plan is only one part of development. Sleep and recovery matter just as much. Target bedtime: <span className="mono">{profile.bedtime}</span>.
      </div>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          {last7.map((d) => (
            <div key={d.key} style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{d.label}</div>
              <div style={{ height: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <div style={{ width: 14, borderRadius: 4, background: d.hours ? "var(--amber)" : "var(--border-strong)", height: d.hours ? `${Math.min(100, parseSleepHours(d.hours) * 10)}%` : "10%" }} />
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>{d.hours || "–"}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
        If sleep is consistently short, your daily plan will automatically lean toward lighter, skill-focused sessions instead of pushing harder to compensate.
      </div>
    </div>
  );
}

function SafetyView() {
  const points = [
    "This app is educational and does not replace individualized coaching or medical care.",
    "Never train through pain. Pain is a signal to stop, not push through.",
    "Follow your coach or league's pitch-count and rest guidelines — they take priority over anything generated here.",
    "This app does not diagnose injuries or illness. When in doubt, talk to a parent/guardian, coach, athletic trainer, or doctor.",
    "Rest and recovery days are part of training, not a break from it.",
    "Progress is about skill, consistency, and health — not appearance or body weight.",
  ];
  return (
    <div style={{ padding: "20px 18px 40px" }}>
      <div className="h-display" style={{ fontSize: 22, marginBottom: 16 }}>Safety First</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {points.map((p, i) => (
          <div key={i} className="card" style={{ padding: 14, fontSize: 13.5, lineHeight: 1.55, color: "var(--text-muted)" }}>{p}</div>
        ))}
      </div>
    </div>
  );
}

/* ================================ edit profile ================================ */

function EditProfile({ profile, onSave, onBack }) {
  const [form, setForm] = useState({
    inSchool: true, schoolStartTime: "08:00", schoolEndTime: "15:15", afternoonStartTime: "12:00",
    dinnerTime: "18:00", homeworkMinutes: 45,
    afternoonTrainingEnabled: true, afternoonTrainingMinutes: 30,
    hasThrowingProgram: false, throwingProgramNotes: "",
    ...profile,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isPitcher = form.positions.includes("Pitcher") || form.positions.includes("Two-Way Player");
  return (
    <div style={{ padding: "18px 18px 40px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, marginBottom: 16, padding: 0 }}>
        <Icon name="back" size={16} /> Back
      </button>
      <div className="h-display" style={{ fontSize: 22, marginBottom: 18 }}>Edit Profile</div>

      <FieldRow label="Name">
        <input value={form.name} onChange={(e) => set("name", e.target.value)}
          style={{ width: "100%", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "12px 14px", color: "var(--text)", fontSize: 15 }} />
      </FieldRow>
      <FieldRow label="Positions">
        <MultiChip options={POSITIONS} selected={form.positions} onToggle={(v) => set("positions", v)} />
      </FieldRow>

      {isPitcher && (
        <FieldRow label="Throwing program">
          <MultiChip options={["No", "Yes"]} selected={[form.hasThrowingProgram ? "Yes" : "No"]} onToggle={(sel) => set("hasThrowingProgram", sel[sel.length - 1] === "Yes")} />
          {form.hasThrowingProgram && (
            <textarea value={form.throwingProgramNotes} onChange={(e) => set("throwingProgramNotes", e.target.value)}
              placeholder="Notes about your coach/team throwing program"
              rows={3}
              style={{ width: "100%", marginTop: 10, background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "12px 14px", color: "var(--text)", fontSize: 14, resize: "vertical" }} />
          )}
        </FieldRow>
      )}

      <FieldRow label="Goals (up to 3)">
        <MultiChip options={GOALS} selected={form.goals} onToggle={(v) => set("goals", v)} max={3} />
      </FieldRow>
      <FieldRow label="Equipment">
        <MultiChip options={EQUIPMENT} selected={form.equipment} onToggle={(v) => set("equipment", v)} />
      </FieldRow>
      <TimeInput label="Wake time" value={form.wakeTime} onChange={(v) => set("wakeTime", v)} />
      <TimeInput label="Leave time" value={form.leaveTime} onChange={(v) => set("leaveTime", v)} />
      <FieldRow label="Morning training minutes">
        <MultiChip options={["15", "20", "30", "45", "60"]} selected={[String(form.trainingMinutes)]} onToggle={(sel) => set("trainingMinutes", Number(sel[sel.length - 1]))} />
      </FieldRow>

      <div style={{ height: 1, background: "var(--border)", margin: "22px 0" }} />
      <div className="h-display" style={{ fontSize: 14, letterSpacing: "0.05em", marginBottom: 14, color: "var(--text-muted)" }}>After School</div>

      <FieldRow label="Are you still in school?">
        <MultiChip options={["Yes", "No"]} selected={[form.inSchool ? "Yes" : "No"]} onToggle={(sel) => set("inSchool", sel[sel.length - 1] === "Yes")} />
      </FieldRow>
      {form.inSchool ? (
        <>
          <TimeInput label="School start time" value={form.schoolStartTime} onChange={(v) => set("schoolStartTime", v)} />
          <TimeInput label="School end time" value={form.schoolEndTime} onChange={(v) => set("schoolEndTime", v)} />
        </>
      ) : (
        <TimeInput label="Afternoon training/routine start time" value={form.afternoonStartTime} onChange={(v) => set("afternoonStartTime", v)} />
      )}
      <TimeInput label="Dinner time" value={form.dinnerTime} onChange={(v) => set("dinnerTime", v)} />
      <TimeInput label="Bedtime" value={form.bedtime} onChange={(v) => set("bedtime", v)} />
      {form.inSchool && (
        <FieldRow label="Typical homework time (minutes)">
          <MultiChip options={["30", "45", "60", "90"]} selected={[String(form.homeworkMinutes)]} onToggle={(sel) => set("homeworkMinutes", Number(sel[sel.length - 1]))} />
        </FieldRow>
      )}
      <FieldRow label="Train again on non-practice/game afternoons?">
        <MultiChip options={["No", "Yes"]} selected={[form.afternoonTrainingEnabled ? "Yes" : "No"]} onToggle={(sel) => set("afternoonTrainingEnabled", sel[sel.length - 1] === "Yes")} />
      </FieldRow>
      {form.afternoonTrainingEnabled && (
        <FieldRow label="Afternoon training minutes">
          <MultiChip options={["15", "20", "30", "45", "60"]} selected={[String(form.afternoonTrainingMinutes)]} onToggle={(sel) => set("afternoonTrainingMinutes", Number(sel[sel.length - 1]))} />
        </FieldRow>
      )}

      <button className="btn-primary" style={{ width: "100%", marginTop: 8 }} onClick={() => { onSave({ ...form, ageGroup: ageGroupFor(form.age).id }); onBack(); }}>
        Save changes
      </button>
    </div>
  );
}
