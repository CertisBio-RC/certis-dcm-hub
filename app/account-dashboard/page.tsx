"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AddressValueLink,
  ContactValueLink,
  HubShell,
  Input,
  PrimaryButton,
  RecordBadge,
  SecondaryButton,
  SectionCard,
  StatusMessage,
  createClient,
} from "@/components/hub-shared";

type AccountRow = {
  id: string;
  source_system: string | null;
  source_file: string | null;
  source_sheet: string | null;
  source_row_number: number | null;
  account_key: string | null;
  long_name: string | null;
  retailer: string | null;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  category: string | null;
  suppliers: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  office_phone: string | null;
  row_crop_relevance: string | null;
};

type PeopleRow = {
  id: string;
  account_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  national_name: string | null;
  company_name: string | null;
  supplier: string | null;
  title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  office_phone: string | null;
  cell_phone: string | null;
  email: string | null;
  contact_type: string | null;
  is_kingpin: boolean | null;
  legacy_contact_id: string | null;
  legacy_kingpin_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PersonAccountLinkRow = {
  id: string;
  person_id: string;
  account_id: string;
  link_type: string | null;
  is_primary: boolean | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type InteractionRow = {
  id: string;
  user_id: string | null;
  contact_id: string | null;
  person_id: string | null;
  date: string | null;
  type: string | null;
  summary: string | null;
  details: string | null;
  outcome: string | null;
  follow_up_date: string | null;
  created_at: string | null;
  stage: string | string[] | null;
};

type AccountEditForm = {
  suppliers: string;
  category: string;
  office_phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  row_crop_relevance: string;
};

type SummaryCounts = {
  totalAccounts: number;
  totalAgronomyAccounts: number;
  totalPeople: number;
  totalContacts: number;
  totalKingpins: number;
  totalInteractions: number;
  linkedPeople: number;
  linkedInteractions: number;
};

type StageKey =
  | "introduction"
  | "technical_training"
  | "field_evaluation"
  | "adoption";

type AccountGroup = {
  key: string;
  longName: string;
  canonicalName: string;
  accounts: AccountRow[];
  people: PeopleRow[];
  interactions: InteractionRow[];
  directLocationCount: number;
  agronomyLocationCount: number;
  lastInteractionDate: string | null;
};

const ACCOUNT_SELECT =
  "id, source_system, source_file, source_sheet, source_row_number, account_key, long_name, retailer, name, address, city, state, zip, category, suppliers, is_active, created_at, updated_at, office_phone, row_crop_relevance";

const PEOPLE_SELECT =
  "id, account_id, full_name, first_name, last_name, national_name, company_name, supplier, title, address, city, state, zip, office_phone, cell_phone, email, contact_type, is_kingpin, legacy_contact_id, legacy_kingpin_id, created_at, updated_at";

const PERSON_ACCOUNT_LINK_SELECT =
  "id, person_id, account_id, link_type, is_primary, notes, created_at, updated_at";

const INTERACTION_SELECT =
  "id, user_id, contact_id, person_id, date, type, summary, details, outcome, follow_up_date, created_at, stage";

const SESSION_QUERY_KEY = "certis-ci-query";
const SESSION_GROUP_KEY = "certis-ci-selected-group";
const SESSION_ACCOUNT_KEY = "certis-ci-selected-account";
const SESSION_SCROLL_KEY = "certis-ci-scroll-y";

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeForMatch(value: string | null | undefined): string {
  return normalizeValue(value)
    .toLowerCase()
    .replace(/co[\s-]?op/g, "coop")
    .replace(/\bcooperative\b/g, "coop")
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompact(value: string | null | undefined): string {
  return normalizeForMatch(value).replace(/\s+/g, "");
}

function getAccountGroupKey(account: AccountRow): string {
  return normalizeCompact(account.long_name || account.retailer || account.name || account.id) || account.id;
}

function getAccountGroupName(account: AccountRow): string {
  return (
    normalizeValue(account.long_name) ||
    normalizeValue(account.retailer) ||
    normalizeValue(account.name) ||
    "Unnamed Account"
  );
}

function getAccountDisplayName(account: AccountRow | null): string {
  if (!account) return "No location selected";

  return (
    account.name ||
    account.long_name ||
    account.retailer ||
    [account.city, account.state].filter(Boolean).join(", ") ||
    "Unnamed Location"
  );
}

function getAccountAddress(account: AccountRow | null): string {
  if (!account) return "Not listed";

  return (
    [account.address, account.city, account.state, account.zip]
      .filter(Boolean)
      .join(", ") || "Not listed"
  );
}

function joinedName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return normalizeValue(`${normalizeValue(firstName)} ${normalizeValue(lastName)}`.trim());
}

function getPersonDisplayName(person: PeopleRow): string {
  return (
    normalizeValue(person.full_name) ||
    joinedName(person.first_name, person.last_name) ||
    normalizeValue(person.email) ||
    "Unnamed Person"
  );
}

function getPersonCompany(person: PeopleRow): string {
  return (
    normalizeValue(person.company_name) ||
    normalizeValue(person.national_name) ||
    "No company listed"
  );
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => normalizeValue(value)).filter(Boolean)),
  );
}

function buildAccountSearchFields(account: AccountRow): Array<string | null | undefined> {
  return [
    account.long_name,
    account.retailer,
    account.name,
    account.address,
    account.city,
    account.state,
    account.zip,
    account.category,
    account.suppliers,
    account.account_key,
    account.row_crop_relevance,
  ];
}

function buildPeopleSearchFields(person: PeopleRow): Array<string | null | undefined> {
  return [
    person.full_name,
    person.first_name,
    person.last_name,
    person.company_name,
    person.national_name,
    person.supplier,
    person.state,
    person.city,
    person.title,
    person.email,
    person.address,
    person.office_phone,
    person.cell_phone,
    person.contact_type,
  ];
}

function searchIncludes(values: Array<string | null | undefined>, query: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  if (!normalizedQuery) return false;

  const haystack = values.map((value) => normalizeForMatch(value)).join(" ");
  return haystack.includes(normalizedQuery);
}

function isHeadquartersAccount(account: AccountRow): boolean {
  const category = normalizeForMatch(account.category);
  return category.includes("corporate") || category.includes("regional") || category.includes("hq");
}

function isAgronomyAccount(account: AccountRow): boolean {
  const category = normalizeForMatch(account.category);

  if (isHeadquartersAccount(account)) return true;
  return category.includes("agronomy");
}

function sortAccounts(a: AccountRow, b: AccountRow): number {
  return getAccountDisplayName(a).localeCompare(getAccountDisplayName(b));
}

function sortPeople(a: PeopleRow, b: PeopleRow): number {
  return getPersonDisplayName(a).localeCompare(getPersonDisplayName(b));
}

function sortInteractions(a: InteractionRow, b: InteractionRow): number {
  const aDate = a.date ?? a.created_at ?? "";
  const bDate = b.date ?? b.created_at ?? "";
  return bDate.localeCompare(aDate);
}

function dedupePeople(people: PeopleRow[]): PeopleRow[] {
  const seen = new Set<string>();
  const result: PeopleRow[] = [];

  for (const person of people) {
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    result.push(person);
  }

  return result;
}

function dedupeInteractions(interactions: InteractionRow[]): InteractionRow[] {
  const seen = new Set<string>();
  const result: InteractionRow[] = [];

  for (const interaction of interactions) {
    if (seen.has(interaction.id)) continue;
    seen.add(interaction.id);
    result.push(interaction);
  }

  return result;
}

function buildEditForm(account: AccountRow | null): AccountEditForm {
  return {
    suppliers: normalizeValue(account?.suppliers),
    category: normalizeValue(account?.category),
    office_phone: normalizeValue(account?.office_phone),
    address: normalizeValue(account?.address),
    city: normalizeValue(account?.city),
    state: normalizeValue(account?.state),
    zip: normalizeValue(account?.zip),
    row_crop_relevance: normalizeValue(account?.row_crop_relevance) || "unknown",
  };
}

function formatDate(value: string | null | undefined): string {
  const raw = normalizeValue(value);
  if (!raw) return "No date";

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function getStageRawValue(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizeStageKey(value: string | string[] | null | undefined): StageKey | null {
  const normalized = normalizeForMatch(getStageRawValue(value))
    .replace(/\//g, " ")
    .replace(/\s+/g, "_");

  if (
    normalized === "introduction" ||
    normalized === "intro" ||
    normalized === "touch_base" ||
    normalized === "intro_touch_base"
  ) {
    return "introduction";
  }

  if (
    normalized === "technical_training" ||
    normalized === "technical" ||
    normalized === "training" ||
    normalized === "education"
  ) {
    return "technical_training";
  }

  if (
    normalized === "field_evaluation" ||
    normalized === "field" ||
    normalized === "evaluation" ||
    normalized === "trial" ||
    normalized === "field_trial"
  ) {
    return "field_evaluation";
  }

  if (normalized === "adoption" || normalized === "adopted") {
    return "adoption";
  }

  return null;
}

function formatStageLabel(value: string | string[] | null | undefined): string {
  const stage = normalizeStageKey(value);

  if (stage === "introduction") return "Introduction";
  if (stage === "technical_training") return "Technical Training";
  if (stage === "field_evaluation") return "Field Evaluation";
  if (stage === "adoption") return "Adoption";

  return "Unstaged";
}

function formatInteractionType(value: string | null | undefined): string {
  const raw = normalizeValue(value);
  if (!raw) return "Unknown";

  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getStageBadgeClasses(stage: string | string[] | null | undefined): string {
  const normalized = normalizeStageKey(stage);

  if (normalized === "introduction") {
    return "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }

  if (normalized === "technical_training") {
    return "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200";
  }

  if (normalized === "field_evaluation") {
    return "border-yellow-300 bg-yellow-100 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-200";
  }

  if (normalized === "adoption") {
    return "border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-950/40 dark:text-green-200";
  }

  return "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
}

function getHighestStage(interactions: InteractionRow[]): StageKey | null {
  const stageOrder: StageKey[] = [
    "introduction",
    "technical_training",
    "field_evaluation",
    "adoption",
  ];

  let highest: StageKey | null = null;

  interactions.forEach((interaction) => {
    const stage = normalizeStageKey(interaction.stage);
    if (!stage) return;

    if (!highest || stageOrder.indexOf(stage) > stageOrder.indexOf(highest)) {
      highest = stage;
    }
  });

  return highest;
}

function formatHighestStage(interactions: InteractionRow[]): string {
  const highest = getHighestStage(interactions);
  if (highest === "introduction") return "Introduction";
  if (highest === "technical_training") return "Technical Training";
  if (highest === "field_evaluation") return "Field Evaluation";
  if (highest === "adoption") return "Adoption";
  return "Unstaged";
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-h-[7.25rem] flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="min-h-[2.25rem] text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-4xl font-bold leading-none">{value}</div>
    </div>
  );
}

async function fetchAllRows<T>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  selectClause: string,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(selectClause)
      .range(from, to);

    if (error) throw error;

    const chunk = (data ?? []) as T[];
    rows.push(...chunk);

    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function getPeopleForAccountIds(
  accountIds: Set<string>,
  people: PeopleRow[],
  manualLinks: PersonAccountLinkRow[],
): PeopleRow[] {
  const directPeople = people.filter(
    (person) => !!person.account_id && accountIds.has(person.account_id),
  );

  const manuallyLinkedPeopleIds = new Set(
    manualLinks
      .filter((link) => accountIds.has(link.account_id))
      .map((link) => link.person_id),
  );

  const manuallyLinkedPeople = people.filter((person) => manuallyLinkedPeopleIds.has(person.id));

  return dedupePeople([...directPeople, ...manuallyLinkedPeople]).sort(sortPeople);
}

function getInteractionsForPeople(
  people: PeopleRow[],
  interactions: InteractionRow[],
): InteractionRow[] {
  const personIds = new Set(people.map((person) => person.id));

  return dedupeInteractions(
    interactions.filter((interaction) => !!interaction.person_id && personIds.has(interaction.person_id)),
  ).sort(sortInteractions);
}

function buildAccountGroups(
  accounts: AccountRow[],
  people: PeopleRow[],
  manualLinks: PersonAccountLinkRow[],
  interactions: InteractionRow[],
): AccountGroup[] {
  const groupedAccounts = new Map<string, AccountRow[]>();

  accounts.forEach((account) => {
    const key = getAccountGroupKey(account);
    const existing = groupedAccounts.get(key) ?? [];
    existing.push(account);
    groupedAccounts.set(key, existing);
  });

  return Array.from(groupedAccounts.entries())
    .map(([key, accountRows]) => {
      const sortedAccounts = [...accountRows].sort((a, b) => {
        if (isHeadquartersAccount(a) !== isHeadquartersAccount(b)) {
          return isHeadquartersAccount(a) ? -1 : 1;
        }
        return sortAccounts(a, b);
      });

      const accountIds = new Set(sortedAccounts.map((account) => account.id));
      const groupPeople = getPeopleForAccountIds(accountIds, people, manualLinks);
      const groupInteractions = getInteractionsForPeople(groupPeople, interactions);
      const latestInteraction = groupInteractions[0] ?? null;
      const firstAccount = sortedAccounts[0];

      return {
        key,
        longName: getAccountGroupName(firstAccount),
        canonicalName: normalizeCompact(firstAccount.long_name || firstAccount.retailer || firstAccount.name),
        accounts: sortedAccounts,
        people: groupPeople,
        interactions: groupInteractions,
        directLocationCount: sortedAccounts.length,
        agronomyLocationCount: sortedAccounts.filter((account) => isAgronomyAccount(account)).length,
        lastInteractionDate: latestInteraction?.date ?? latestInteraction?.created_at ?? null,
      } satisfies AccountGroup;
    })
    .sort((a, b) => {
      const aDate = a.lastInteractionDate ?? "";
      const bDate = b.lastInteractionDate ?? "";

      if (aDate || bDate) {
        const dateCompare = bDate.localeCompare(aDate);
        if (dateCompare !== 0) return dateCompare;
      }

      const interactionCompare = b.interactions.length - a.interactions.length;
      if (interactionCompare !== 0) return interactionCompare;

      return a.longName.localeCompare(b.longName);
    });
}

export default function CommercialIntelligenceHubPage() {
  const supabase = useMemo(() => createClient(), []);

  const [query, setQuery] = useState("");
  const [summaryCounts, setSummaryCounts] = useState<SummaryCounts>({
    totalAccounts: 0,
    totalAgronomyAccounts: 0,
    totalPeople: 0,
    totalContacts: 0,
    totalKingpins: 0,
    totalInteractions: 0,
    linkedPeople: 0,
    linkedInteractions: 0,
  });

  const [allAccounts, setAllAccounts] = useState<AccountRow[]>([]);
  const [allPeople, setAllPeople] = useState<PeopleRow[]>([]);
  const [manualLinks, setManualLinks] = useState<PersonAccountLinkRow[]>([]);
  const [allInteractions, setAllInteractions] = useState<InteractionRow[]>([]);

  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const [isLoadingBaseData, setIsLoadingBaseData] = useState(true);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [editForm, setEditForm] = useState<AccountEditForm>(buildEditForm(null));

  useEffect(() => {
    if (typeof window === "undefined") return;

    setQuery(window.sessionStorage.getItem(SESSION_QUERY_KEY) ?? "");
    setSelectedGroupKey(window.sessionStorage.getItem(SESSION_GROUP_KEY));
    setSelectedAccountId(window.sessionStorage.getItem(SESSION_ACCOUNT_KEY));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(SESSION_QUERY_KEY, query);
  }, [query]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (selectedGroupKey) {
      window.sessionStorage.setItem(SESSION_GROUP_KEY, selectedGroupKey);
    } else {
      window.sessionStorage.removeItem(SESSION_GROUP_KEY);
    }
  }, [selectedGroupKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (selectedAccountId) {
      window.sessionStorage.setItem(SESSION_ACCOUNT_KEY, selectedAccountId);
    } else {
      window.sessionStorage.removeItem(SESSION_ACCOUNT_KEY);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedScroll = window.sessionStorage.getItem(SESSION_SCROLL_KEY);
    if (savedScroll) {
      window.requestAnimationFrame(() => {
        window.scrollTo(0, Number(savedScroll));
      });
    }

    const saveScroll = () => {
      window.sessionStorage.setItem(SESSION_SCROLL_KEY, String(window.scrollY));
    };

    window.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("beforeunload", saveScroll);

    return () => {
      saveScroll();
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("beforeunload", saveScroll);
    };
  }, []);

  useEffect(() => {
    const loadBaseData = async () => {
      setIsLoadingBaseData(true);

      try {
        const [
          accountsCountResponse,
          contactsCountResponse,
          kingpinsCountResponse,
          interactionsCountResponse,
          allAccountsData,
          allPeopleData,
          manualLinkData,
          allInteractionsData,
        ] = await Promise.all([
          supabase.from("accounts").select("*", { count: "exact", head: true }),
          supabase.from("contacts").select("*", { count: "exact", head: true }),
          supabase.from("kingpins").select("*", { count: "exact", head: true }),
          supabase.from("interactions").select("*", { count: "exact", head: true }),
          fetchAllRows<AccountRow>(supabase, "accounts", ACCOUNT_SELECT),
          fetchAllRows<PeopleRow>(supabase, "people", PEOPLE_SELECT),
          fetchAllRows<PersonAccountLinkRow>(
            supabase,
            "person_account_links",
            PERSON_ACCOUNT_LINK_SELECT,
          ),
          fetchAllRows<InteractionRow>(supabase, "interactions", INTERACTION_SELECT),
        ]);

        const linkedPeopleCount = allPeopleData.filter((person) => !!person.account_id).length;
        const linkedPersonIds = new Set(
          allPeopleData.filter((person) => !!person.account_id).map((person) => person.id),
        );
        const linkedInteractionsCount = allInteractionsData.filter(
          (interaction) => !!interaction.person_id && linkedPersonIds.has(interaction.person_id),
        ).length;

        setSummaryCounts({
          totalAccounts: accountsCountResponse.count ?? 0,
          totalAgronomyAccounts: allAccountsData.filter((account) => isAgronomyAccount(account)).length,
          totalPeople: allPeopleData.length,
          totalContacts: contactsCountResponse.count ?? 0,
          totalKingpins: kingpinsCountResponse.count ?? 0,
          totalInteractions: interactionsCountResponse.count ?? 0,
          linkedPeople: linkedPeopleCount,
          linkedInteractions: linkedInteractionsCount,
        });

        setAllAccounts(allAccountsData.sort(sortAccounts));
        setAllPeople(allPeopleData.sort(sortPeople));
        setManualLinks(manualLinkData);
        setAllInteractions(allInteractionsData.sort(sortInteractions));
        setMessage({
          tone: "success",
          text: "Commercial Intelligence data loaded. Direct account activity is now based on people.account_id and person-linked interactions.",
        });
        setIsLoadingBaseData(false);
      } catch (error) {
        const messageText =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while loading base data.";

        setMessage({
          tone: "error",
          text: `Could not load Commercial Intelligence Hub data. ${messageText}`,
        });
        setIsLoadingBaseData(false);
      }
    };

    void loadBaseData();
  }, [supabase]);

  const allGroups = useMemo(
    () => buildAccountGroups(allAccounts, allPeople, manualLinks, allInteractions),
    [allAccounts, allPeople, manualLinks, allInteractions],
  );

  const filteredGroups = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];

    return allGroups.filter((group) => {
      const groupFields = [
        group.longName,
        ...group.accounts.flatMap((account) => buildAccountSearchFields(account)),
        ...group.people.flatMap((person) => buildPeopleSearchFields(person)),
      ];

      return searchIncludes(groupFields, q);
    });
  }, [allGroups, query]);

  const selectedGroup = useMemo(() => {
    if (filteredGroups.length === 0) return null;

    return (
      filteredGroups.find((group) => group.key === selectedGroupKey) ??
      filteredGroups[0]
    );
  }, [filteredGroups, selectedGroupKey]);

  const selectedAccount = useMemo(() => {
    if (!selectedGroup) return null;

    return (
      selectedGroup.accounts.find((account) => account.id === selectedAccountId) ??
      selectedGroup.accounts[0] ??
      null
    );
  }, [selectedGroup, selectedAccountId]);

  useEffect(() => {
    if (!selectedGroup) {
      setSelectedGroupKey(null);
      setSelectedAccountId(null);
      setIsEditingAccount(false);
      setEditForm(buildEditForm(null));
      return;
    }

    if (selectedGroup.key !== selectedGroupKey) {
      setSelectedGroupKey(selectedGroup.key);
    }

    const accountToSelect =
      selectedGroup.accounts.find((account) => account.id === selectedAccountId) ??
      selectedGroup.accounts[0] ??
      null;

    if (accountToSelect?.id !== selectedAccountId) {
      setSelectedAccountId(accountToSelect?.id ?? null);
    }
  }, [selectedGroup, selectedGroupKey, selectedAccountId]);

  useEffect(() => {
    if (!selectedAccount || isEditingAccount) return;
    setEditForm(buildEditForm(selectedAccount));
  }, [selectedAccount, isEditingAccount]);

  useEffect(() => {
    if (isLoadingBaseData) return;

    const q = query.trim();
    if (q.length < 2) {
      setMessage({
        tone: "info",
        text: "Type at least two characters to search account-level Commercial Intelligence.",
      });
      return;
    }

    if (filteredGroups.length === 0) {
      setMessage({
        tone: "info",
        text: "No account groups matched your search.",
      });
      return;
    }

    const peopleCount = filteredGroups.reduce((sum, group) => sum + group.people.length, 0);
    const interactionCount = filteredGroups.reduce(
      (sum, group) => sum + group.interactions.length,
      0,
    );

    setMessage({
      tone: "success",
      text: `Commercial Intelligence Hub loaded. ${filteredGroups.length} account group${
        filteredGroups.length === 1 ? "" : "s"
      }, ${peopleCount} directly linked people, and ${interactionCount} direct interactions found.`,
    });
  }, [filteredGroups, isLoadingBaseData, query]);

  const searchedLocationCount = useMemo(
    () => filteredGroups.reduce((sum, group) => sum + group.directLocationCount, 0),
    [filteredGroups],
  );

  const searchedPeopleCount = useMemo(
    () => filteredGroups.reduce((sum, group) => sum + group.people.length, 0),
    [filteredGroups],
  );

  const searchedInteractionCount = useMemo(
    () => filteredGroups.reduce((sum, group) => sum + group.interactions.length, 0),
    [filteredGroups],
  );

  const searchedActive90Count = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    return filteredGroups.filter((group) =>
      group.interactions.some((interaction) => {
        const rawDate = interaction.date || interaction.created_at;
        if (!rawDate) return false;

        const parsed = new Date(rawDate);
        if (Number.isNaN(parsed.getTime())) return false;

        return parsed >= cutoff;
      }),
    ).length;
  }, [filteredGroups]);

  const selectedGroupContacts = useMemo(
    () =>
      selectedGroup?.people.filter((person) =>
        normalizeForMatch(person.contact_type).includes("contact"),
      ).length ?? 0,
    [selectedGroup],
  );

  const selectedGroupKingpins = useMemo(
    () =>
      selectedGroup?.people.filter(
        (person) =>
          person.is_kingpin === true ||
          normalizeForMatch(person.contact_type).includes("kingpin"),
      ).length ?? 0,
    [selectedGroup],
  );

  const selectedGroupOtherPeople = Math.max(
    (selectedGroup?.people.length ?? 0) - selectedGroupContacts - selectedGroupKingpins,
    0,
  );

  const selectedHighestStage = selectedGroup
    ? formatHighestStage(selectedGroup.interactions)
    : "Unstaged";

  const selectedMostRecentInteraction = selectedGroup?.interactions[0] ?? null;

  const handleEditField = (field: keyof AccountEditForm, value: string) => {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleStartEditing = () => {
    if (!selectedAccount) return;
    setEditForm(buildEditForm(selectedAccount));
    setIsEditingAccount(true);
  };

  const handleCancelEditing = () => {
    setEditForm(buildEditForm(selectedAccount));
    setIsEditingAccount(false);
  };

  const handleSaveThisLocation = async () => {
    if (!selectedAccount) return;

    setIsSavingAccount(true);

    const payload = {
      suppliers: editForm.suppliers || null,
      category: editForm.category || null,
      office_phone: editForm.office_phone || null,
      address: editForm.address || null,
      city: editForm.city || null,
      state: editForm.state || null,
      zip: editForm.zip || null,
      row_crop_relevance: editForm.row_crop_relevance || "unknown",
    };

    const { data, error } = await supabase
      .from("accounts")
      .update(payload)
      .eq("id", selectedAccount.id)
      .select(ACCOUNT_SELECT)
      .single();

    if (error) {
      setMessage({
        tone: "error",
        text: `Could not save location updates. ${error.message}`,
      });
      setIsSavingAccount(false);
      return;
    }

    const updatedAccount = data as AccountRow;

    setAllAccounts((current) =>
      current
        .map((account) => (account.id === updatedAccount.id ? updatedAccount : account))
        .sort(sortAccounts),
    );

    setSelectedAccountId(updatedAccount.id);
    setEditForm(buildEditForm(updatedAccount));
    setIsEditingAccount(false);
    setIsSavingAccount(false);
    setMessage({
      tone: "success",
      text: `Location details updated for ${getAccountDisplayName(updatedAccount)}.`,
    });
  };

  const handleSaveEntireAccountGroup = async () => {
    if (!selectedGroup) return;

    const accountIds = selectedGroup.accounts.map((account) => account.id);
    if (accountIds.length === 0) return;

    setIsSavingAccount(true);

    const sharedPayload = {
      suppliers: editForm.suppliers || null,
      category: editForm.category || null,
      row_crop_relevance: editForm.row_crop_relevance || "unknown",
    };

    const { data, error } = await supabase
      .from("accounts")
      .update(sharedPayload)
      .in("id", accountIds)
      .select(ACCOUNT_SELECT);

    if (error) {
      setMessage({
        tone: "error",
        text: `Could not apply account-wide updates. ${error.message}`,
      });
      setIsSavingAccount(false);
      return;
    }

    const updatedRows = (data ?? []) as AccountRow[];
    const updatedMap = new Map(updatedRows.map((row) => [row.id, row]));

    setAllAccounts((current) =>
      current
        .map((account) => updatedMap.get(account.id) ?? account)
        .sort(sortAccounts),
    );

    const refreshedSelectedAccount =
      updatedMap.get(selectedAccount?.id ?? "") ?? selectedAccount ?? null;

    setSelectedAccountId(refreshedSelectedAccount?.id ?? null);
    setEditForm(buildEditForm(refreshedSelectedAccount));
    setIsEditingAccount(false);
    setIsSavingAccount(false);
    setMessage({
      tone: "success",
      text: `Shared account updates applied to ${updatedRows.length} ${
        updatedRows.length === 1 ? "location" : "locations"
      } for ${selectedGroup.longName}.`,
    });
  };

  return (
    <HubShell
      title="Commercial Intelligence Hub"
      subtitle="Account-level relationship intelligence. Direct activity is counted only when an interaction is tied to a person who is linked to that account."
    >
      <div className="grid gap-6">
        <SectionCard
          title="General Database Summary"
          description="High-level snapshot of the full CERTIS DCM database and current account-linking coverage."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard label="Total Accounts" value={summaryCounts.totalAccounts} />
            <KpiCard label="Agronomy Accounts" value={summaryCounts.totalAgronomyAccounts} />
            <KpiCard label="People" value={summaryCounts.totalPeople} />
            <KpiCard label="Contacts" value={summaryCounts.totalContacts} />
            <KpiCard label="Kingpins" value={summaryCounts.totalKingpins} />
            <KpiCard label="Interactions" value={summaryCounts.totalInteractions} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            <KpiCard label="People Linked to Accounts" value={summaryCounts.linkedPeople} />
            <KpiCard label="Interactions Linked to Accounts" value={summaryCounts.linkedInteractions} />
          </div>
        </SectionCard>

        <SectionCard
          title="Commercial Search"
          description="Search by account group, location, city, state, supplier, category, linked person, email, or company name. Results are grouped by long_name first."
        >
          <Input
            label="Search Account-Level CI"
            value={query}
            onChange={setQuery}
            placeholder="Example: Landus, Agtegra, Kevin Bown, Waverly, IA, Winfield"
          />

          {isLoadingBaseData ? (
            <div className="mt-4">
              <StatusMessage
                message="Loading accounts, people, person-account links, and interactions..."
                tone="info"
              />
            </div>
          ) : null}

          {message ? (
            <div className="mt-4">
              <StatusMessage message={message.text} tone={message.tone} />
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Matched Account Groups" value={filteredGroups.length} />
            <KpiCard label="Matched Locations" value={searchedLocationCount} />
            <KpiCard label="Direct Linked People" value={searchedPeopleCount} />
            <KpiCard label="Direct Interactions" value={searchedInteractionCount} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            <KpiCard label="Active Account Groups (90d)" value={searchedActive90Count} />
            <KpiCard label="Current Account Stage" value={selectedHighestStage} />
          </div>

          <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto pr-2">
            {filteredGroups.map((group) => {
              const isSelected = selectedGroup?.key === group.key;

              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => {
                    setSelectedGroupKey(group.key);
                    setSelectedAccountId(group.accounts[0]?.id ?? null);
                    setIsEditingAccount(false);
                  }}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30"
                      : "border-slate-200 bg-white hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-400"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-lg font-bold">{group.longName}</div>
                    <RecordBadge>{group.directLocationCount} locations</RecordBadge>
                    <RecordBadge>{group.people.length} people</RecordBadge>
                    <RecordBadge>{group.interactions.length} direct interactions</RecordBadge>
                  </div>

                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Last direct interaction: {formatDate(group.lastInteractionDate)}
                  </div>

                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Highest stage: {formatHighestStage(group.interactions)}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Selected Account-Level Intelligence"
          description="Truth layer for the selected long_name account group. Counts are direct only; remote influencer contacts should be handled separately."
        >
          {selectedGroup ? (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Account Group
                </div>
                <div className="mt-1 text-3xl font-bold">{selectedGroup.longName}</div>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Direct activity reflects interactions connected through people.account_id or manual person-account links. It does not copy network or remote influencer activity across every location.
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <KpiCard label="Locations" value={selectedGroup.directLocationCount} />
                <KpiCard label="Agronomy Locations" value={selectedGroup.agronomyLocationCount} />
                <KpiCard label="Linked People" value={selectedGroup.people.length} />
                <KpiCard label="Direct Interactions" value={selectedGroup.interactions.length} />
                <KpiCard label="Last Interaction" value={formatDate(selectedGroup.lastInteractionDate)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <KpiCard label="Contacts" value={selectedGroupContacts} />
                <KpiCard label="Kingpins" value={selectedGroupKingpins} />
                <KpiCard label="Other / Unassigned" value={selectedGroupOtherPeople} />
              </div>
            </div>
          ) : (
            <StatusMessage
              message="Search and select an account group to load account-level intelligence."
              tone="info"
            />
          )}
        </SectionCard>

        <SectionCard
          title="Direct Interaction Timeline"
          description="Interactions tied to people who are directly linked to this selected account group."
        >
          {!selectedGroup || selectedGroup.interactions.length === 0 ? (
            <StatusMessage
              message="No direct person-linked interactions found for the selected account group."
              tone="info"
            />
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                This is the conservative, truthful activity feed. Network/influencer activity should be displayed separately later rather than inflated into every account.
              </div>

              <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-2">
                {selectedGroup.interactions.slice(0, 75).map((interaction) => (
                  <div
                    key={interaction.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <RecordBadge>{formatInteractionType(interaction.type)}</RecordBadge>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStageBadgeClasses(
                          interaction.stage,
                        )}`}
                      >
                        {formatStageLabel(interaction.stage)}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {formatDate(interaction.date || interaction.created_at)}
                      </span>
                    </div>

                    <div className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                      {interaction.summary || "Interaction"}
                    </div>

                    <div className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                      {interaction.details || interaction.outcome || "No additional details recorded."}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Locations Under This Account"
          description="Locations are supporting detail under the account-level relationship, not the primary CI unit."
        >
          {!selectedGroup ? (
            <StatusMessage message="No account group selected." tone="info" />
          ) : (
            <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-2">
              {selectedGroup.accounts.map((account) => {
                const isSelected = selectedAccount?.id === account.id;
                const peopleAtLocation = getPeopleForAccountIds(
                  new Set([account.id]),
                  allPeople,
                  manualLinks,
                );
                const interactionsAtLocation = getInteractionsForPeople(
                  peopleAtLocation,
                  allInteractions,
                );

                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => {
                      setSelectedAccountId(account.id);
                      setIsEditingAccount(false);
                      setEditForm(buildEditForm(account));
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30"
                        : "border-slate-200 bg-white hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-400"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-bold">{getAccountDisplayName(account)}</div>
                      {account.category ? <RecordBadge>{account.category}</RecordBadge> : null}
                      <RecordBadge>{peopleAtLocation.length} people</RecordBadge>
                      <RecordBadge>{interactionsAtLocation.length} direct interactions</RecordBadge>
                    </div>

                    <div className="mt-2 text-sm">
                      <AddressValueLink
                        value={getAccountAddress(account)}
                        address={account.address}
                        city={account.city}
                        state={account.state}
                        zip={account.zip}
                        label={getAccountDisplayName(account)}
                      />
                    </div>

                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Suppliers: {account.suppliers || "Not listed"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Selected Location Details"
          description="Review and correct the core business details for the selected location. Shared account edits can be applied across all locations in the selected account group."
        >
          {selectedAccount ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Selected Location
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {getAccountDisplayName(selectedAccount)}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {selectedAccount.long_name || selectedAccount.retailer || "Selected location"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!isEditingAccount ? (
                    <SecondaryButton onClick={handleStartEditing}>
                      Edit Location Details
                    </SecondaryButton>
                  ) : (
                    <SecondaryButton
                      onClick={handleCancelEditing}
                      disabled={isSavingAccount}
                    >
                      Cancel
                    </SecondaryButton>
                  )}
                </div>
              </div>

              {!isEditingAccount ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Retailer
                      </div>
                      <div className="mt-1 font-semibold">
                        {selectedAccount.retailer || "Not listed"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Category
                      </div>
                      <div className="mt-1 font-semibold">
                        {selectedAccount.category || "Not listed"}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Row Crop Relevance
                      </div>
                      <div className="mt-1 font-semibold">
                        {isHeadquartersAccount(selectedAccount)
                          ? "hq / agronomy"
                          : selectedAccount.row_crop_relevance || "unknown"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Office Phone
                      </div>
                      <div className="mt-1 font-semibold">
                        <ContactValueLink kind="office" value={selectedAccount.office_phone} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Address
                    </div>
                    <div className="mt-1 font-semibold">
                      <AddressValueLink
                        value={getAccountAddress(selectedAccount)}
                        address={selectedAccount.address}
                        city={selectedAccount.city}
                        state={selectedAccount.state}
                        zip={selectedAccount.zip}
                        label={getAccountDisplayName(selectedAccount)}
                        showPin
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Suppliers
                      </div>
                      <div className="mt-1 font-semibold">
                        {selectedAccount.suppliers || "Not listed"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Account Key
                      </div>
                      <div className="mt-1 font-semibold">
                        {selectedAccount.account_key || "Not listed"}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Supplier"
                      value={editForm.suppliers}
                      onChange={(value) => handleEditField("suppliers", value)}
                      placeholder="Example: Rosen's"
                    />
                    <Input
                      label="Category"
                      value={editForm.category}
                      onChange={(value) => handleEditField("category", value)}
                      placeholder="Example: Coop, Agronomy, Retail"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Office Phone"
                      value={editForm.office_phone}
                      onChange={(value) => handleEditField("office_phone", value)}
                      placeholder="Office phone"
                    />
                    <Input
                      label="Address"
                      value={editForm.address}
                      onChange={(value) => handleEditField("address", value)}
                      placeholder="Street address"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Input
                      label="City"
                      value={editForm.city}
                      onChange={(value) => handleEditField("city", value)}
                      placeholder="City"
                    />
                    <Input
                      label="State"
                      value={editForm.state}
                      onChange={(value) => handleEditField("state", value)}
                      placeholder="State"
                    />
                    <Input
                      label="ZIP"
                      value={editForm.zip}
                      onChange={(value) => handleEditField("zip", value)}
                      placeholder="ZIP"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold">
                        Row Crop Relevance
                      </label>
                      <select
                        value={editForm.row_crop_relevance}
                        onChange={(event) =>
                          handleEditField("row_crop_relevance", event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900"
                      >
                        <option value="relevant">relevant</option>
                        <option value="partial">partial</option>
                        <option value="not_relevant">not_relevant</option>
                        <option value="unknown">unknown</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                    Use <span className="font-semibold">Save This Location</span> for local fields
                    like phone or address. Use <span className="font-semibold">Save Entire Account Group</span> for shared fields like supplier, category, and row crop relevance.
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton
                      onClick={handleSaveThisLocation}
                      disabled={isSavingAccount}
                    >
                      {isSavingAccount ? "Saving..." : "Save This Location"}
                    </PrimaryButton>

                    <SecondaryButton
                      onClick={handleSaveEntireAccountGroup}
                      disabled={isSavingAccount}
                    >
                      {isSavingAccount ? "Saving..." : "Save Entire Account Group"}
                    </SecondaryButton>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <StatusMessage
              message="Search and select an account group, then select a location to view or edit details."
              tone="info"
            />
          )}
        </SectionCard>

        <SectionCard
          title="Linked People"
          description="People directly associated with the selected account group through account_id or manual person-account links."
        >
          {!selectedGroup || selectedGroup.people.length === 0 ? (
            <StatusMessage
              message="No directly linked people found for this selected account group."
              tone="info"
            />
          ) : (
            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-2">
              {selectedGroup.people.map((person) => (
                <div
                  key={person.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-2xl font-bold">{getPersonDisplayName(person)}</div>
                    <RecordBadge>
                      {person.is_kingpin ? "Kingpin" : person.contact_type || "Person"}
                    </RecordBadge>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <div>
                      <span className="font-semibold">Title:</span> {person.title || "Not listed"}
                    </div>

                    <div>
                      <span className="font-semibold">Email:</span>{" "}
                      <ContactValueLink kind="email" value={person.email} />
                    </div>

                    <div>
                      <span className="font-semibold">Mobile:</span>{" "}
                      <ContactValueLink kind="mobile" value={person.cell_phone} />
                    </div>

                    <div>
                      <span className="font-semibold">Office:</span>{" "}
                      <ContactValueLink kind="office" value={person.office_phone} />
                    </div>

                    <div>
                      <span className="font-semibold">Company:</span> {getPersonCompany(person)}
                    </div>

                    <div>
                      <span className="font-semibold">Supplier / State:</span>{" "}
                      {[person.supplier, person.state].filter(Boolean).join(" - ") || "Not listed"}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                    <span className="font-semibold">Address:</span>{" "}
                    <AddressValueLink
                      value={
                        [person.address, person.city, person.state, person.zip]
                          .filter(Boolean)
                          .join(", ") || person.address
                      }
                      address={person.address}
                      city={person.city}
                      state={person.state}
                      zip={person.zip}
                      label={getPersonDisplayName(person)}
                      context={getPersonCompany(person)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Strategic Notes"
          description="Working space for what this account means commercially and what should happen next."
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800">
            Account-level CI is now grouped by long_name first. Direct interactions are counted only through linked people. This intentionally avoids inflating location-level activity with remote supplier or network influencer conversations.
          </div>
        </SectionCard>
      </div>
    </HubShell>
  );
}
