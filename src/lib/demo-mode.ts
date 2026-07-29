// Frontend-only demo mode. All test brand/opportunity data lives here.
// Guardrails prevent real emails, real payments, or accidental confusion
// between demo entities and real verified brand opportunities.

export const DEMO_MODE = true;

export type DemoOpportunity = {
  id: string;
  brand: string;
  category: "Beauty" | "Fashion" | "Skincare" | "Haircare" | "Accessories";
  logoInitials: string;
  // Fastest-to-cash signals
  fitScore: number; // 0-100
  audienceFit: number; // 0-100
  contentFit: number; // 0-100
  brandFreshness: "Active this week" | "New campaign" | "Recent creator posts";
  estPayout: string; // e.g. "$450–$900"
  estCloseDays: number;
  creatorTier: "Nano" | "Micro" | "Mid";
  dealType: "Paid post" | "UGC" | "Affiliate + post" | "Gifting + fee";
  usageRights: "30 days organic" | "60 days paid" | "Perpetual (higher fee)";
  exclusivityDays: number;
  contactStatus: "Verified email" | "Likely email" | "Form only";
  responseLikelihood: number; // 0-100
  competitionLevel: "Low" | "Medium" | "High";
  // Locality — closer brands close faster (easier shipping, in-person meets,
  // shared timezone, local relevance for content).
  brandLocation: string; // e.g. "Brooklyn, NY"
  localFit: "Same city" | "Same region" | "Same country" | "Ships to you" | "International";
  nextStep: string;
  reasoning: string[];
  // Earnings-first fields (additive; safe to be undefined on real matches).
  earnType?:
    | "quick"
    | "ugc_match"
    | "licensing"
    | "sponsored"
    | "repeat_brand"
    | "monthly_retainer";
  effort?: "5 min" | "1 hr" | "half day" | "full day" | "recurring";
  deliverables?: string[];
  deadlineIso?: string;
  newContentRequired?: boolean;
  progress?:
    | "prepared"
    | "approved"
    | "sent"
    | "delivered"
    | "replied"
    | "negotiating"
    | "won"
    | "paid";
  // Content-to-Opportunity matching layer. Ties a paid opportunity to
  // the creator's *existing* content so pursuit feels natural.
  contentMatch?: {
    matchedContent: string;
    whyFit: string;
    suggestedPackage: string;
    usageRecommendation: string;
    source:
      | "MatchAI-sourced"
      | "Direct brand"
      | "Private opportunity"
      | "Public campaign brief"
      | "Brand launch"
      | "Similar-UGC brand"
      | "Previous partner"
      | "Creator outbound";
    matchConfidence: number;
    contactConfidence: number;
    portfolioExamples: string[];
  };
};


export const DEMO_OPPORTUNITIES: DemoOpportunity[] = [
  {
    id: "demo-1",
    brand: "Glossy Beauty Co.",
    category: "Beauty",
    logoInitials: "GB",
    fitScore: 94,
    audienceFit: 91,
    contentFit: 96,
    brandFreshness: "Active this week",
    estPayout: "$600–$1,100",
    estCloseDays: 6,
    creatorTier: "Micro",
    dealType: "Paid post",
    usageRights: "30 days organic",
    exclusivityDays: 14,
    contactStatus: "Verified email",
    responseLikelihood: 78,
    competitionLevel: "Low",
    nextStep: "Draft personalized pitch",
    brandLocation: "Brooklyn, NY",
    localFit: "Same city",
    reasoning: [
      "HQ in your city — cheap shipping, in-person meet possible",
      "Posted 3 creator collabs in last 30 days in your audience age band",
      "Your top-performing reel matches their current launch aesthetic",
      "Public partnerships lead email verified this morning",
    ],
  },
  {
    id: "demo-2",
    brand: "Studio Linen",
    category: "Fashion",
    logoInitials: "SL",
    fitScore: 88,
    audienceFit: 85,
    contentFit: 90,
    brandFreshness: "New campaign",
    estPayout: "$400–$750",
    estCloseDays: 8,
    creatorTier: "Micro",
    dealType: "UGC",
    usageRights: "60 days paid",
    exclusivityDays: 7,
    contactStatus: "Likely email",
    responseLikelihood: 64,
    competitionLevel: "Medium",
    brandLocation: "Jersey City, NJ",
    localFit: "Same region",
    nextStep: "Verify contact then pitch",
    reasoning: [
      "Warehouse 1 state over — 2-day shipping for samples",
      "Launched SS26 capsule 4 days ago — actively sourcing UGC",
      "Existing creators overlap 22% with your audience",
      "Rate range aligns with your minimum UGC rate",
    ],
  },
  {
    id: "demo-3",
    brand: "Nolabel Skincare",
    category: "Skincare",
    logoInitials: "NS",
    fitScore: 82,
    audienceFit: 88,
    contentFit: 77,
    brandFreshness: "Recent creator posts",
    estPayout: "$350–$650",
    estCloseDays: 10,
    creatorTier: "Micro",
    dealType: "Affiliate + post",
    usageRights: "30 days organic",
    exclusivityDays: 0,
    contactStatus: "Verified email",
    responseLikelihood: 71,
    competitionLevel: "Medium",
    brandLocation: "Brooklyn, NY",
    nextStep: "Send pitch with rate card",
    localFit: "Same city",
    reasoning: [
      "Same city — founder does creator coffees weekly",
      "Affiliate program pays 18% — above category average",
      "No exclusivity clause — stackable with other skincare deals",
      "Founder replies personally to creator inbounds within 48h",
    ],
  },
  {
    id: "demo-4",
    brand: "Maison Ivy",
    category: "Accessories",
    logoInitials: "MI",
    fitScore: 79,
    audienceFit: 74,
    contentFit: 83,
    brandFreshness: "Active this week",
    estPayout: "$250–$500 + product",
    estCloseDays: 5,
    creatorTier: "Nano",
    dealType: "Gifting + fee",
    usageRights: "Perpetual (higher fee)",
    exclusivityDays: 0,
    contactStatus: "Verified email",
    responseLikelihood: 82,
    competitionLevel: "Low",
    brandLocation: "Los Angeles, CA",
    localFit: "Same country",
    nextStep: "Send pitch — fastest turnaround",
    reasoning: [
      "US-based — flat-rate 3-day shipping for samples",
      "Fastest average creator response time in your matches (2.1 days)",
      "Prefers nano/micro creators — you fit their exact tier",
      "Perpetual usage available with 30% fee uplift",
    ],
  },
  {
    id: "demo-5",
    brand: "Bloom Haircare",
    category: "Haircare",
    logoInitials: "BH",
    fitScore: 76,
    audienceFit: 80,
    contentFit: 72,
    brandFreshness: "New campaign",
    estPayout: "$500–$900",
    estCloseDays: 12,
    creatorTier: "Micro",
    dealType: "Paid post",
    usageRights: "60 days paid",
    exclusivityDays: 21,
    contactStatus: "Likely email",
    responseLikelihood: 58,
    competitionLevel: "High",
    brandLocation: "London, UK",
    localFit: "Ships to you",
    nextStep: "Verify contact then pitch",
    reasoning: [
      "UK-based — 7-10 day sample shipping, factor into timeline",
      "Fall campaign kicked off this week — budget confirmed",
      "Higher competition — pitch quality matters more here",
      "21-day exclusivity — check calendar before committing",
    ],
  },
  {
    id: "demo-6",
    brand: "Ceramic Skin Lab",
    category: "Skincare",
    logoInitials: "CS",
    fitScore: 73,
    audienceFit: 78,
    contentFit: 70,
    brandFreshness: "Active this week",
    estPayout: "$300–$550",
    estCloseDays: 9,
    creatorTier: "Micro",
    dealType: "UGC",
    usageRights: "30 days organic",
    exclusivityDays: 0,
    contactStatus: "Verified email",
    responseLikelihood: 69,
    competitionLevel: "Low",
    brandLocation: "Queens, NY",
    localFit: "Same city",
    nextStep: "Send pitch with UGC samples",
    reasoning: [
      "Same city — pickup possible, no shipping cost or delay",
      "Actively booking UGC creators this week — 6 slots open",
      "No exclusivity — stackable with your other skincare deals",
      "Brand voice matches your soft, editorial tone",
    ],
  },
];


// Content-to-Opportunity matching layer — attaches each demo opportunity
// to a specific piece of the creator's existing content, plus source /
// confidence / suggested package. Kept out of the main object so the
// existing shape stays untouched.
const CONTENT_MATCHES: Record<string, NonNullable<DemoOpportunity["contentMatch"]>> = {
  "demo-1": {
    matchedContent: "your evening beauty routine reel",
    whyFit: "Your recent beauty routine content is a strong fit for this brand and opportunity.",
    suggestedPackage: "2 Reels + 3 Stories with 30 days organic usage",
    usageRecommendation: "30 days organic — matches their launch window",
    source: "MatchAI-sourced",
    matchConfidence: 92,
    contactConfidence: 96,
    portfolioExamples: ["Evening routine reel — 41k views", "Product-first flatlay carousel"],
  },
  "demo-2": {
    matchedContent: "your minimalist SS outfit try-on",
    whyFit: "Your linen try-on content matches their SS26 capsule aesthetic.",
    suggestedPackage: "3 UGC videos with 60 days paid usage",
    usageRecommendation: "60 days paid — standard for capsule launches",
    source: "Brand launch",
    matchConfidence: 88,
    contactConfidence: 74,
    portfolioExamples: ["Neutral outfit try-on reel", "Morning-light styling carousel"],
  },
  "demo-3": {
    matchedContent: "your sensitive-skin routine",
    whyFit: "Your recent skincare content is a strong fit for this brand and opportunity.",
    suggestedPackage: "1 Reel + 1 Story + affiliate link, 30 days organic",
    usageRecommendation: "30 days organic + affiliate (stackable)",
    source: "Similar-UGC brand",
    matchConfidence: 85,
    contactConfidence: 94,
    portfolioExamples: ["Sensitive-skin routine reel — 28k views", "Barrier-repair before/after"],
  },
  "demo-4": {
    matchedContent: "your everyday accessory styling",
    whyFit: "Your daily-carry styling matches how they position their line.",
    suggestedPackage: "1 Reel + product gifting, perpetual usage",
    usageRecommendation: "Perpetual — priced with 30% uplift",
    source: "Direct brand",
    matchConfidence: 80,
    contactConfidence: 92,
    portfolioExamples: ["Everyday carry reel", "Outfit-of-the-day carousel"],
  },
  "demo-5": {
    matchedContent: "your fall haircare routine",
    whyFit: "Your seasonal haircare content matches their fall campaign angle.",
    suggestedPackage: "2 UGC videos with 60 days paid usage",
    usageRecommendation: "60 days paid — align with campaign flight",
    source: "Public campaign brief",
    matchConfidence: 77,
    contactConfidence: 68,
    portfolioExamples: ["Fall haircare routine reel", "Wash-day carousel"],
  },
  "demo-6": {
    matchedContent: "your barrier-repair skincare series",
    whyFit: "Your soft editorial skincare tone fits their brand voice.",
    suggestedPackage: "2 UGC videos, 30 days organic",
    usageRecommendation: "30 days organic — no exclusivity",
    source: "MatchAI-sourced",
    matchConfidence: 74,
    contactConfidence: 90,
    portfolioExamples: ["Barrier-repair 3-part series", "Morning skincare POV reel"],
  },
};

for (const opp of DEMO_OPPORTUNITIES) {
  opp.contentMatch = CONTENT_MATCHES[opp.id];
}

// Earnings-first backfill for the original 6 (kept separate so the objects
// above stay untouched). Defaults chosen from dealType + usageRights.
const EARN_BACKFILL: Record<string, Partial<DemoOpportunity>> = {
  "demo-1": {
    earnType: "sponsored",
    effort: "half day",
    deliverables: ["2 Reels", "3 Stories"],
    newContentRequired: true,
    progress: "prepared",
  },
  "demo-2": {
    earnType: "ugc_match",
    effort: "half day",
    deliverables: ["3 UGC videos, 20–30s"],
    newContentRequired: true,
    progress: "prepared",
  },
  "demo-3": {
    earnType: "sponsored",
    effort: "1 hr",
    deliverables: ["1 Reel", "1 Story", "Affiliate link"],
    newContentRequired: true,
    progress: "prepared",
  },
  "demo-4": {
    earnType: "quick",
    effort: "1 hr",
    deliverables: ["1 Reel + product gifting"],
    newContentRequired: true,
    progress: "prepared",
  },
  "demo-5": {
    earnType: "sponsored",
    effort: "full day",
    deliverables: ["2 UGC videos", "1 Reel"],
    newContentRequired: true,
    progress: "prepared",
  },
  "demo-6": {
    earnType: "ugc_match",
    effort: "half day",
    deliverables: ["2 UGC videos, 15–30s"],
    newContentRequired: true,
    progress: "prepared",
  },
};

function daysFromNow(d: number) {
  return new Date(Date.now() + d * 86400_000).toISOString();
}

for (const opp of DEMO_OPPORTUNITIES) {
  Object.assign(opp, EARN_BACKFILL[opp.id] ?? {});
  if (!opp.deadlineIso) opp.deadlineIso = daysFromNow(opp.estCloseDays);
}

// Additional smaller / faster / licensing / repeat opportunities so the
// "Ways to Earn" mix is visible on first load.
const EXTRA_OPPS: DemoOpportunity[] = [
  {
    id: "demo-7",
    brand: "Petal & Pore",
    category: "Skincare",
    logoInitials: "PP",
    fitScore: 81,
    audienceFit: 82,
    contentFit: 80,
    brandFreshness: "Active this week",
    estPayout: "$180",
    estCloseDays: 2,
    creatorTier: "Micro",
    dealType: "UGC",
    usageRights: "30 days organic",
    exclusivityDays: 0,
    contactStatus: "Verified email",
    responseLikelihood: 84,
    competitionLevel: "Low",
    brandLocation: "Brooklyn, NY",
    localFit: "Same city",
    nextStep: "Send raw footage offer",
    reasoning: [
      "They buy raw skincare b-roll weekly",
      "No script — just clean product-in-hand clips",
      "Same-city — samples reach you in a day",
    ],
    earnType: "quick",
    effort: "5 min",
    deliverables: ["1 raw clip, 15s, natural light"],
    newContentRequired: true,
    deadlineIso: daysFromNow(2),
    progress: "prepared",
    contentMatch: {
      matchedContent: "your morning skincare b-roll",
      whyFit: "They license the exact style of raw skincare footage you already shoot.",
      suggestedPackage: "1 raw 15s clip — $180 flat",
      usageRecommendation: "30 days organic, brand social only",
      source: "Similar-UGC brand",
      matchConfidence: 86,
      contactConfidence: 94,
      portfolioExamples: ["Morning skincare b-roll", "Serum-drop macro clip"],
    },
  },
  {
    id: "demo-8",
    brand: "Nova Co.",
    category: "Beauty",
    logoInitials: "NC",
    fitScore: 79,
    audienceFit: 78,
    contentFit: 82,
    brandFreshness: "New campaign",
    estPayout: "$220",
    estCloseDays: 3,
    creatorTier: "Micro",
    dealType: "UGC",
    usageRights: "30 days organic",
    exclusivityDays: 0,
    contactStatus: "Verified email",
    responseLikelihood: 80,
    competitionLevel: "Low",
    brandLocation: "Austin, TX",
    localFit: "Same country",
    nextStep: "Pitch 15s product demo",
    reasoning: [
      "Booking 15s product-demo hooks this week",
      "Format matches your top-performing hook style",
      "Turnaround is fast — pay on delivery",
    ],
    earnType: "quick",
    effort: "1 hr",
    deliverables: ["1 short-form hook, 15s, product demo"],
    newContentRequired: true,
    deadlineIso: daysFromNow(3),
    progress: "prepared",
    contentMatch: {
      matchedContent: "your product-demo hook style",
      whyFit: "Your hook cadence matches the pattern they're currently buying.",
      suggestedPackage: "1 hook @ 15s — $220 flat",
      usageRecommendation: "30 days organic",
      source: "Public campaign brief",
      matchConfidence: 83,
      contactConfidence: 92,
      portfolioExamples: ["Hook-driven demo #1", "Hook-driven demo #2"],
    },
  },
  {
    id: "demo-9",
    brand: "Rove Basics",
    category: "Fashion",
    logoInitials: "RB",
    fitScore: 84,
    audienceFit: 86,
    contentFit: 82,
    brandFreshness: "Active this week",
    estPayout: "$450",
    estCloseDays: 4,
    creatorTier: "Micro",
    dealType: "UGC",
    usageRights: "60 days paid",
    exclusivityDays: 0,
    contactStatus: "Verified email",
    responseLikelihood: 76,
    competitionLevel: "Low",
    brandLocation: "New York, NY",
    localFit: "Same city",
    nextStep: "Offer existing Reel for licensing",
    reasoning: [
      "They license existing UGC instead of commissioning new content",
      "One of your Reels already fits their capsule",
      "No new shoot — pure licensing revenue",
    ],
    earnType: "licensing",
    effort: "5 min",
    deliverables: ["License 1 existing Reel — no new content"],
    newContentRequired: false,
    deadlineIso: daysFromNow(4),
    progress: "prepared",
    contentMatch: {
      matchedContent: "your neutral outfit try-on Reel",
      whyFit: "This brand may license content you already created.",
      suggestedPackage: "License 1 existing Reel — 90 days paid social",
      usageRecommendation: "Paid social only, 90 days, no whitelisting",
      source: "Direct brand",
      matchConfidence: 88,
      contactConfidence: 95,
      portfolioExamples: ["Neutral outfit try-on Reel", "Morning-light styling carousel"],
    },
  },
  {
    id: "demo-10",
    brand: "Glossy Beauty Co.",
    category: "Beauty",
    logoInitials: "GB",
    fitScore: 90,
    audienceFit: 90,
    contentFit: 91,
    brandFreshness: "New campaign",
    estPayout: "$900–$1,400",
    estCloseDays: 5,
    creatorTier: "Micro",
    dealType: "Paid post",
    usageRights: "30 days organic",
    exclusivityDays: 14,
    contactStatus: "Verified email",
    responseLikelihood: 88,
    competitionLevel: "Low",
    brandLocation: "Brooklyn, NY",
    localFit: "Same city",
    nextStep: "Pitch repeat-partner launch package",
    reasoning: [
      "A previous partner has a new product launch",
      "0% success fee — repeat brand",
      "They asked their team to prioritize past collaborators",
    ],
    earnType: "repeat_brand",
    effort: "half day",
    deliverables: ["1 Reel + 3 Stories, launch week"],
    newContentRequired: true,
    deadlineIso: daysFromNow(5),
    progress: "prepared",
    contentMatch: {
      matchedContent: "your last collab with Glossy",
      whyFit: "You've already delivered for them — repeat deals close 3× faster.",
      suggestedPackage: "1 Reel + 3 Stories, launch week — repeat rate",
      usageRecommendation: "30 days organic — matches their last deal",
      source: "Previous partner",
      matchConfidence: 94,
      contactConfidence: 98,
      portfolioExamples: ["Previous Glossy Reel — 62k views"],
    },
  },
];

DEMO_OPPORTUNITIES.push(...EXTRA_OPPS);


// Guardrails
export function isDemoId(id: string | null | undefined) {
  return !!id && id.startsWith("demo-");
}


export function blockRealActionOnDemo(action: "send" | "fund" | "sign"): string | null {
  return `This is demo data. Real ${action === "send" ? "outreach" : action === "fund" ? "payments" : "contracts"} are disabled until brand discovery is connected.`;
}
