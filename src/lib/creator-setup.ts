// Frontend-only creator setup store (localStorage).
// One-time configuration data the daily agent consumes to source deals.
// Real backend wiring comes in a later phase.

export type RateCard = {
  ig_post?: number;
  ig_reel?: number;
  ig_story?: number;
  tiktok?: number;
  ugc_video?: number;
  bundle_note?: string;
};

export type BrandKit = {
  bio: string;
  niches: string[]; // e.g. Clean Beauty, Skincare, Streetwear
  tone: "Warm & personal" | "Editorial" | "Playful" | "Direct & pro" | "";
  values: string[]; // e.g. Cruelty-free, Sustainable, Female-founded
  aesthetic: string; // free-text visual description
  colors: string[]; // hex or name
  logoDataUrl?: string; // uploaded logo preview
  moodboard?: BrandAsset[]; // reference/aesthetic images
};

export type BrandAsset = {
  id: string;
  name: string;
  dataUrl: string; // base64 preview (localStorage-only for now)
  kind: "image";
};

export type UsageRightsDefault = {
  organicDays: number; // e.g. 30
  paidAmplificationDays: number; // 0 = not included
  exclusivityDays: number;
  whitelistingAllowed: boolean;
};

export type PortfolioMedia = {
  id: string;
  name: string;
  dataUrl: string;
  kind: "image" | "video" | "document";
  mime?: string;
  sizeBytes?: number;
};

export type PortfolioItem = {
  id: string;
  brand: string;
  platform: "Instagram" | "TikTok" | "YouTube" | "UGC" | "Other";
  url: string;
  metric: string; // e.g. "142k views · 8.4% ER"
  notes?: string;
  media?: PortfolioMedia[]; // uploaded screenshots / clips / docs (pdf, ppt, etc.)
};



export type ShippingInfo = {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type CreatorSetup = {
  rates: RateCard;
  brandKit: BrandKit;
  usageRights: UsageRightsDefault;
  portfolio: PortfolioItem[];
  shipping: ShippingInfo | null;
  exclusions: string[]; // brands/categories to avoid
  updatedAt: number;
};

const KEY = "matchai:creator-setup:v1";

const DEFAULT: CreatorSetup = {
  rates: {},
  brandKit: {
    bio: "",
    niches: [],
    tone: "",
    values: [],
    aesthetic: "",
    colors: [],
  },
  usageRights: {
    organicDays: 30,
    paidAmplificationDays: 0,
    exclusivityDays: 0,
    whitelistingAllowed: false,
  },
  portfolio: [],
  shipping: null,
  exclusions: [],
  updatedAt: 0,
};

export function loadSetup(): CreatorSetup {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function saveSetup(next: CreatorSetup) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ ...next, updatedAt: Date.now() }),
  );
  window.dispatchEvent(new CustomEvent("matchai:setup-updated"));
}

export type SetupStep = {
  key: keyof CreatorSetup | "rates" | "brandKit" | "usageRights" | "portfolio" | "shipping" | "exclusions";
  label: string;
  done: boolean;
  hint: string;
};

export function computeSetupSteps(s: CreatorSetup): SetupStep[] {
  const ratesDone = Boolean(
    s.rates.ig_post || s.rates.ig_reel || s.rates.tiktok || s.rates.ugc_video,
  );
  const kitDone = Boolean(s.brandKit.bio && s.brandKit.niches.length && s.brandKit.tone);
  const usageDone = s.usageRights.organicDays > 0;
  const portfolioDone = s.portfolio.length >= 1;
  const shippingDone = Boolean(s.shipping?.postalCode && s.shipping.addressLine1);
  const exclusionsDone = true; // optional but visible
  return [
    { key: "brandKit", label: "Brand kit", done: kitDone, hint: "Bio, niche, tone, values" },
    { key: "rates", label: "Rates", done: ratesDone, hint: "Post/Reel/UGC pricing" },
    { key: "portfolio", label: "Portfolio", done: portfolioDone, hint: "Past work + metrics" },
    { key: "usageRights", label: "Usage rights defaults", done: usageDone, hint: "Organic + paid windows" },
    { key: "shipping", label: "Shipping address", done: shippingDone, hint: "For gifted product" },
    { key: "exclusions", label: "Exclusions", done: exclusionsDone, hint: "Brands/categories to skip" },
  ];
}

export function setupCompletion(s: CreatorSetup) {
  const steps = computeSetupSteps(s);
  const done = steps.filter((x) => x.done).length;
  return { done, total: steps.length, pct: Math.round((done / steps.length) * 100), steps };
}

/** Flatten every portfolio media item into a pickable attachment list. */
export type PickableAttachment = PortfolioMedia & {
  portfolioItemId: string;
  brand: string;
  platform: PortfolioItem["platform"];
};

export function listAttachableMedia(s: CreatorSetup): PickableAttachment[] {
  const out: PickableAttachment[] = [];
  for (const item of s.portfolio) {
    for (const m of item.media ?? []) {
      out.push({ ...m, portfolioItemId: item.id, brand: item.brand, platform: item.platform });
    }
  }
  return out;
}

