import Link from "next/link";
import { HubShell, SectionCard } from "@/components/hub-shared";

const mainCards = [
  {
    href: "/add-contact",
    title: "Add New Person",
    description:
      "Create a new person record and capture company, supplier, and account/location context needed for follow-up.",
    external: false,
    disabled: false,
  },
  {
    href: "/add-account", // 🔥 NEW
    title: "Add New Account / Location",
    description:
      "Create a new retail location when no contact is known yet, enabling territory planning and future relationship development.",
    external: false,
    disabled: false,
  },
  {
    href: "/search-contacts",
    title: "Search Existing People",
    description:
      "Search across unified people records, then review profiles, timelines, and key relationship details.",
    external: false,
    disabled: false,
  },
  {
    href: "/account-dashboard",
    title: "Commercial Intelligence Hub",
description:
  "Review account-level context, linked people, recent activity, and update key commercial account details.",
    external: false,
    disabled: false,
  },
  {
    href: "/bulk-interactions",
    title: "Bulk Import",
    description:
      "Paste or upload contact or interaction data to preview, match people, and(or) import multiple records at once.",
    external: false,
    disabled: false,
  },
];

const otherTools = [
    {
    href: "https://certisbio-rc.github.io/certis_agroute_app/",
    title: "CERTIS AgRoute Database",
    description:
      "Launch the routing and channel-location tool for planning account coverage and travel.",
    external: true,
    disabled: false,
  },
{
    href: "/notable-quotables",
    title: "Notable Quotables",
    description:
      "Capture field quotes, objections, reactions, and market intelligence with sentiment tagging.",
    external: false,
    disabled: false,
  },

  {
    href: "#",
    title: "CERTIS PlotTrack",
    description:
      "Reserved space for a future plot and trial tracking tool across row crop programs.",
    external: false,
    disabled: true,
  },
  {
    href: "#",
    title: "CERTIS Performance Risk Calculator",
    description:
      "Analyze conditions to understand when CERTIS biologicals are most likely to deliver strong field performance.",
    external: false,
    disabled: true,
  },
];

function ActiveCard({
  href,
  title,
  description,
  external = false,
}: {
  href: string;
  title: string;
  description: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group rounded-3xl border border-slate-300 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 dark:border-[#35527d] dark:bg-[#0d2147] dark:shadow-[0_8px_22px_rgba(0,0,0,0.14)] dark:hover:border-[#46f0c3]"
    >
      <div className="text-[1.35rem] font-extrabold tracking-tight text-slate-900 dark:text-[#ffd84d]">
        {title}
      </div>

      <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-[#d3def5]">
        {description}
      </p>

      <div className="mt-6 text-sm font-extrabold text-emerald-600 transition group-hover:text-emerald-700 dark:text-[#46f0c3] dark:group-hover:text-[#72ffd2]">
        Open tool →
      </div>
    </Link>
  );
}

function DisabledCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-3xl border border-slate-300 bg-slate-100 p-6 opacity-70 dark:border-[#35527d] dark:bg-[#0b1d3f]">
      <div className="absolute right-4 top-4 rounded-full bg-yellow-400 px-3 py-1 text-xs font-extrabold text-slate-900 dark:bg-[#ffd84d] dark:text-[#0b1d3f]">
        Coming Soon
      </div>

      <div className="pr-24 text-[1.35rem] font-extrabold tracking-tight text-slate-900 dark:text-[#ffd84d]">
        {title}
      </div>

      <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-[#9fb3d9]">
        {description}
      </p>
    </div>
  );
}

export default function LaunchPage() {
  return (
    <HubShell
      title="Demand Creation Hub"
      subtitle="Track people, understand account context, and manage interactions across your territory."
    >
      <div className="grid gap-6">
        <SectionCard
          title="Core CERTIS Tools"
          description="Primary workflow tools for managing people, accounts, and interactions."
        >
          <div className="grid gap-6 md:grid-cols-2">
            {mainCards.map((card) =>
              card.disabled ? (
                <DisabledCard
                  key={card.title}
                  title={card.title}
                  description={card.description}
                />
              ) : (
                <ActiveCard
                  key={card.title}
                  href={card.href}
                  title={card.title}
                  description={card.description}
                  external={card.external}
                />
              ),
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Other CERTIS Tools"
          description="Supporting tools and future applications outside the core DCM workflow."
        >
          <div className="grid gap-6 md:grid-cols-2">
            {otherTools.map((tool) =>
              tool.disabled ? (
                <DisabledCard
                  key={tool.title}
                  title={tool.title}
                  description={tool.description}
                />
              ) : (
                <ActiveCard
                  key={tool.title}
                  href={tool.href}
                  title={tool.title}
                  description={tool.description}
                  external={tool.external}
                />
              ),
            )}
          </div>
        </SectionCard>
      </div>
    </HubShell>
  );
}