import { motion } from "framer-motion";
import { SectionEyebrow } from "./SectionEyebrow";
import { Reveal } from "./Reveal";

type Brand = { name: string; slug: string };

// Real brand logos via Simple Icons CDN — companies actively running creator
// partnerships.
const brands: Brand[] = [
  { name: "Sephora", slug: "sephora" },
  { name: "Nike", slug: "nike" },
  { name: "Adidas", slug: "adidas" },
  { name: "Under Armour", slug: "underarmour" },
  { name: "Puma", slug: "puma" },
  { name: "Shopify", slug: "shopify" },
  { name: "Notion", slug: "notion" },
  { name: "HelloFresh", slug: "hellofresh" },
  { name: "Squarespace", slug: "squarespace" },
  { name: "Audible", slug: "audible" },
  { name: "NordVPN", slug: "nordvpn" },
  { name: "Samsung", slug: "samsung" },
];

export function BrandLogoStrip() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-14">
      <Reveal className="text-center">
        <div className="flex justify-center">
          <SectionEyebrow>REAL BRANDS · REAL DEALS</SectionEyebrow>
        </div>
        <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
          Examples of companies actively paying creators — the kind of brands your agent matches you to.
        </p>
      </Reveal>

      <div className="relative mt-8 overflow-hidden">
        {/* edge fade */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />

        <motion.div
          className="flex w-max gap-10 sm:gap-14"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
        >
          {[...brands, ...brands].map((b, i) => (
            <div
              key={`${b.name}-${i}`}
              className="flex h-10 w-32 shrink-0 items-center justify-center px-2 opacity-90 transition-opacity hover:opacity-100"
              title={b.name}
            >
              {b.slug === "sephora" ? (
                <span className="whitespace-nowrap text-[14px] font-semibold tracking-[0.18em] text-foreground">
                  SEPHORA
                </span>
              ) : (
                <img
                  src={`https://cdn.simpleicons.org/${b.slug}/0f172a`}
                  alt={b.name}
                  loading="lazy"
                  className="h-7 w-auto max-w-[112px] object-contain"
                />
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
