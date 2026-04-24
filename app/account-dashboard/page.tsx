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

type LegacyLinkRow = {
  id: string;
  email: string | null;
  corporate_kingpin: string | null;
  regional_kingpin: string | null;
  company_name: string | null;
  national_name: string | null;
  supplier: string | null;
  state: string | null;
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
  date: string | null;
  type: string | null;
  summary: string | null;
  details: string | null;
  outcome: string | null;
  follow_up_date: string | null;
  created_at: string | null;
  stage: string | null;
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
  totalContacts: number;
  totalKingpins: number;
  totalInteractions: number;
};

type StageKey =
  | "introduction"
  | "technical_training"
  | "field_evaluation"
  | "adoption";

const ACCOUNT_SELECT =
  "id, source_system, source_file, source_sheet, source_row_number, account_key, long_name, retailer, name, address, city, state, zip, category, suppliers, is_active, created_at, updated_at, office_phone, row_crop_relevance";

const PEOPLE_SELECT =
  "id, account_id, full_name, first_name, last_name, national_name, company_name, supplier, title, address, city, state, zip, office_phone, cell_phone, email, contact_type, is_kingpin, legacy_contact_id, legacy_kingpin_id, created_at, updated_at";

const LEGACY_LINK_SELECT =
  "id, email, corporate_kingpin, regional_kingpin, company_name, national_name, supplier, state";

const PERSON_ACCOUNT_LINK_SELECT =
  "id, person_id, account_id, link_type, is_primary, notes, created_at, updated_at";

const INTERACTION_SELECT =
  "id, user_id, contact_id, date, type, summary, details, outcome, follow_up_date, created_at, stage";

const COMMON_BUSINESS_STOPWORDS = new Set([
  "inc",
  "llc",
  "ltd",
  "co",
  "company",
  "companies",
  "corp",
  "corporation",
  "group",
  "services",
  "service",
  "center",
  "centers",
  "location",
  "locations",
  "store",
  "stores",
  "energy",
  "holdings",
  "partners",
  "partner",
  "association",
  "assoc",
  "the",
  "and",
  "of",
]);

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeForMatch(value: string | null | undefined): string {
  return normalizeValue(value)
    .toLowerCase()
    .replace(/co[\s-]?op/g, "coop")
    .replace(/\bcooperative\b/g, "coop")
    .replace(/\bassociation\b/g, "assoc")
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeValue(value))
        .filter(Boolean),
    ),
  );
}

function splitSupplierTokens(value: string | null | undefined): string[] {
  return normalizeValue(value)
    .split(/[;,]/)
    .map((item) => normalizeForMatch(item))
    .filter(Boolean);
}

function getSignificantWords(value: string | null | undefined): string[] {
  return normalizeForMatch(value)
    .split(" ")
    .filter((word) => word.length >= 3 && !COMMON_BUSINESS_STOPWORDS.has(word));
}

function countSharedWords(a: string | null | undefined, b: string | null | undefined): number {
  const aWords = new Set(getSignificantWords(a));
  const bWords = new Set(getSignificantWords(b));

  let count = 0;
  aWords.forEach((word) => {
    if (bWords.has(word)) count += 1;
  });

  return count;
}

function companyNamesStronglyMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeForMatch(left);
  const b = normalizeForMatch(right);

  if (!a || !b) return false;
  if (a === b) return true;

  const sharedWords = countSharedWords(a, b);
  if (sharedWords >= 2) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  const shorterWords = getSignificantWords(shorter);
  const longerWords = getSignificantWords(longer);

  if (
    shorterWords.length === 1 &&
    shorterWords[0] &&
    shorterWords[0].length >= 5 &&
    longerWords.includes(shorterWords[0]) &&
    longer.startsWith(shorterWords[0])
  ) {
    return true;
  }

  if (shorter.length >= 8 && longer.includes(shorter) && sharedWords >= 1) {
    return true;
  }

  return false;
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

function getAccountDisplayName(account: AccountRow | null): string {
  if (!account) return "No account selected";

  return (
    account.long_name ||
    account.name ||
    account.retailer ||
    [account.city, account.state].filter(Boolean).join(", ") ||
    "Unnamed Account"
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
  return category.includes("corporate") || category.includes("regional");
}

function isAgronomyAccount(account: AccountRow): boolean {
  const category = normalizeForMatch(account.category);
  if (isHeadquartersAccount(account)) return true;
  return category.includes("agronomy");
}

function hasManualAccountLink(
  account: AccountRow,
  person: PeopleRow,
  manualLinks: PersonAccountLinkRow[],
): boolean {
  return manualLinks.some(
    (link) => link.account_id === account.id && link.person_id === person.id,
  );
}

function isLinkedPerson(
  account: AccountRow,
  person: PeopleRow,
  manualLinks: PersonAccountLinkRow[],
): boolean {
  if (hasManualAccountLink(account, person, manualLinks)) return true;

  if (person.account_id && account.id === person.account_id) return true;

  const accountNames = uniqueNonEmpty([
    account.long_name,
    account.retailer,
    account.name,
  ]);

  const personCompanies = uniqueNonEmpty([
    person.company_name,
    person.national_name,
  ]);

  if (accountNames.length === 0 || personCompanies.length === 0) {
    return false;
  }

  const stateMatch =
    !normalizeForMatch(account.state) ||
    !normalizeForMatch(person.state) ||
    normalizeForMatch(account.state) === normalizeForMatch(person.state);

  if (!stateMatch) return false;

  const strongNameMatch = accountNames.some((accountName) =>
    personCompanies.some((personCompany) =>
      companyNamesStronglyMatch(personCompany, accountName),
    ),
  );

  if (!strongNameMatch) return false;

  const accountSuppliers = splitSupplierTokens(account.suppliers);
  const personSuppliers = splitSupplierTokens(person.supplier);

  if (accountSuppliers.length > 0 && personSuppliers.length > 0) {
    const supplierOverlap = accountSuppliers.some((supplier) =>
      personSuppliers.includes(supplier),
    );

    if (!supplierOverlap) return false;
  }

  return true;
}

function sortAccounts(a: AccountRow, b: AccountRow): number {
  return getAccountDisplayName(a).localeCompare(getAccountDisplayName(b));
}

function sortPeople(a: PeopleRow, b: PeopleRow): number {
  return getPersonDisplayName(a).localeCompare(getPersonDisplayName(b));
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

function formatInteractionDate(value: string | null | undefined): string {
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

function formatInteractionType(value: string | null | undefined): string {
  const raw = normalizeValue(value);
  if (!raw) return "Unknown";

  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeStageKey(value: string | null | undefined): StageKey | null {
  const normalized = normalizeForMatch(value)
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

function formatStageLabel(value: string | null | undefined): string {
  const stage = normalizeStageKey(value);

  if (stage === "introduction") return "Introduction";
  if (stage === "technical_training") return "Technical Training";
  if (stage === "field_evaluation") return "Field Evaluation";
  if (stage === "adoption") return "Adoption";

  return "Unstaged";
}

function getStageBadgeClasses(stage: string | null | undefined): string {
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

function escapeLikeValue(value: string): string {
  return value.replace(/[%_,]/g, " ").trim();
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

function getLegacyNameCandidates(person: PeopleRow): string[] {
  return uniqueNonEmpty([
    person.full_name,
    joinedName(person.first_name, person.last_name),
  ]);
}

function matchesLegacyRowToPerson(person: PeopleRow, row: LegacyLinkRow): boolean {
  if (person.legacy_contact_id && person.legacy_contact_id === row.id) return true;
  if (person.legacy_kingpin_id && person.legacy_kingpin_id === row.id) return true;

  const personEmail = normalizeForMatch(person.email);
  const rowEmail = normalizeForMatch(row.email);

  if (personEmail && rowEmail && personEmail === rowEmail) return true;

  const personNames = getLegacyNameCandidates(person);
  const rowNames = uniqueNonEmpty([row.corporate_kingpin, row.regional_kingpin]);

  if (personNames.length === 0 || rowNames.length === 0) return false;

  const stateMatch =
    !normalizeForMatch(person.state) ||
    !normalizeForMatch(row.state) ||
    normalizeForMatch(person.state) === normalizeForMatch(row.state);

  if (!stateMatch) return false;

  const nameMatch = personNames.some((personName) =>
    rowNames.some((rowName) => normalizeForMatch(personName) === normalizeForMatch(rowName)),
  );

  if (!nameMatch) return false;

  const personCompanies = uniqueNonEmpty([person.company_name, person.national_name]);
  const rowCompanies = uniqueNonEmpty([row.company_name, row.national_name]);

  if (personCompanies.length > 0 && rowCompanies.length > 0) {
    const companyMatch = personCompanies.some((personCompany) =>
      rowCompanies.some((rowCompany) =>
        companyNamesStronglyMatch(personCompany, rowCompany),
      ),
    );

    if (!companyMatch) return false;
  }

  return true;
}

export default function CommercialIntelligenceHubPage() {
  const supabase = useMemo(() => createClient(), []);

  const [query, setQuery] = useState("");
  const [summaryCounts, setSummaryCounts] = useState<SummaryCounts>({
    totalAccounts: 0,
    totalContacts: 0,
    totalKingpins: 0,
    totalInteractions: 0,
  });

  const [allAccounts, setAllAccounts] = useState<AccountRow[]>([]);
  const [allPeople, setAllPeople] = useState<PeopleRow[]>([]);
  const [legacyContacts, setLegacyContacts] = useState<LegacyLinkRow[]>([]);
  const [legacyKingpins, setLegacyKingpins] = useState<LegacyLinkRow[]>([]);
  const [manualLinks, setManualLinks] = useState<PersonAccountLinkRow[]>([]);
  const [allInteractions, setAllInteractions] = useState<InteractionRow[]>([]);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountRow | null>(null);
  const [linkedPeople, setLinkedPeople] = useState<PeopleRow[]>([]);
  const [linkedInteractions, setLinkedInteractions] = useState<InteractionRow[]>([]);

  const [isLoadingBaseData, setIsLoadingBaseData] = useState(true);
  const [isProcessingSearch, setIsProcessingSearch] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [editForm, setEditForm] = useState<AccountEditForm>(buildEditForm(null));

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
          legacyContactsData,
          legacyKingpinsData,
          manualLinkData,
          allInteractionsData,
        ] = await Promise.all([
          supabase.from("accounts").select("*", { count: "exact", head: true }),
          supabase.from("contacts").select("*", { count: "exact", head: true }),
          supabase.from("kingpins").select("*", { count: "exact", head: true }),
          supabase.from("interactions").select("*", { count: "exact", head: true }),
          fetchAllRows<AccountRow>(supabase, "accounts", ACCOUNT_SELECT),
          fetchAllRows<PeopleRow>(supabase, "people", PEOPLE_SELECT),
          fetchAllRows<LegacyLinkRow>(supabase, "contacts", LEGACY_LINK_SELECT),
          fetchAllRows<LegacyLinkRow>(supabase, "kingpins", LEGACY_LINK_SELECT),
          fetchAllRows<PersonAccountLinkRow>(
            supabase,
            "person_account_links",
            PERSON_ACCOUNT_LINK_SELECT,
          ),
          fetchAllRows<InteractionRow>(supabase, "interactions", INTERACTION_SELECT),
        ]);

        setSummaryCounts({
          totalAccounts: accountsCountResponse.count ?? 0,
          totalContacts: contactsCountResponse.count ?? 0,
          totalKingpins: kingpinsCountResponse.count ?? 0,
          totalInteractions: interactionsCountResponse.count ?? 0,
        });

        setAllAccounts(allAccountsData.sort(sortAccounts));
        setAllPeople(allPeopleData.sort(sortPeople));
        setLegacyContacts(legacyContactsData);
        setLegacyKingpins(legacyKingpinsData);
        setManualLinks(manualLinkData);
        setAllInteractions(allInteractionsData);
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

  const legacyIdsByPeopleId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const legacyRows = [...legacyContacts, ...legacyKingpins];

    allPeople.forEach((person) => {
      const ids = new Set<string>();

      legacyRows.forEach((row) => {
        if (matchesLegacyRowToPerson(person, row)) {
          ids.add(row.id);
        }
      });

      map.set(person.id, ids);
    });

    return map;
  }, [allPeople, legacyContacts, legacyKingpins]);

  useEffect(() => {
    if (isLoadingBaseData) return;

    const q = query.trim();

    if (q.length < 2) {
      setAccounts([]);
      setSelectedAccount(null);
      setLinkedPeople([]);
      setLinkedInteractions([]);
      setIsEditingAccount(false);
      setEditForm(buildEditForm(null));
      setMessage(null);
      setIsProcessingSearch(false);
      return;
    }

    let cancelled = false;

    const runSearch = async () => {
      setIsProcessingSearch(true);

      try {
        const safeQuery = escapeLikeValue(q);
        const pattern = `%${safeQuery}%`;

        const directAccountResponse = await supabase
          .from("accounts")
          .select(ACCOUNT_SELECT)
          .or(
            [
              `long_name.ilike.${pattern}`,
              `retailer.ilike.${pattern}`,
              `name.ilike.${pattern}`,
              `address.ilike.${pattern}`,
              `city.ilike.${pattern}`,
              `state.ilike.${pattern}`,
              `zip.ilike.${pattern}`,
              `category.ilike.${pattern}`,
              `suppliers.ilike.${pattern}`,
              `account_key.ilike.${pattern}`,
            ].join(","),
          )
          .limit(300);

        if (directAccountResponse.error) throw directAccountResponse.error;

        const matchedPeopleFromQuery = allPeople.filter((person) =>
          searchIncludes(buildPeopleSearchFields(person), q),
        );

        const directlyLinkedAccountsFromPeople = allAccounts.filter((account) =>
          matchedPeopleFromQuery.some(
            (person) =>
              hasManualAccountLink(account, person, manualLinks) ||
              (person.account_id && person.account_id === account.id),
          ),
        );

        const directAccounts = ((directAccountResponse.data ?? []) as AccountRow[]) ?? [];

        const peopleLinkedAccounts = allAccounts.filter((account) =>
          matchedPeopleFromQuery.some((person) => isLinkedPerson(account, person, manualLinks)),
        );

        const combinedMap = new Map<string, AccountRow>();
        directAccounts.forEach((account) => combinedMap.set(account.id, account));
        directlyLinkedAccountsFromPeople.forEach((account) => combinedMap.set(account.id, account));
        peopleLinkedAccounts.forEach((account) => combinedMap.set(account.id, account));

        const filteredAccounts = Array.from(combinedMap.values()).sort(sortAccounts);

        if (cancelled) return;

        setAccounts(filteredAccounts);

        const nextSelectedAccount =
          filteredAccounts.length === 0
            ? null
            : filteredAccounts.find((account) => account.id === selectedAccount?.id) ??
              filteredAccounts[0];

        setSelectedAccount(nextSelectedAccount);
        setIsEditingAccount(false);
        setEditForm(buildEditForm(nextSelectedAccount));

        if (filteredAccounts.length === 0) {
          setLinkedPeople([]);
          setLinkedInteractions([]);
          setMessage({
            tone: "info",
            text: "No accounts matched your search.",
          });
          setIsProcessingSearch(false);
          return;
        }

        const aggregatedLinkedPeople = dedupePeople(
          filteredAccounts.flatMap((account) =>
            allPeople.filter((person) => isLinkedPerson(account, person, manualLinks)),
          ),
        ).sort(sortPeople);

        const aggregatedLegacyIds = new Set<string>();
        aggregatedLinkedPeople.forEach((person) => {
          const ids = legacyIdsByPeopleId.get(person.id) ?? new Set<string>();
          ids.forEach((id) => aggregatedLegacyIds.add(id));
        });

        const aggregatedInteractions = allInteractions.filter(
          (interaction) =>
            !!interaction.contact_id && aggregatedLegacyIds.has(interaction.contact_id),
        );

        setLinkedPeople(aggregatedLinkedPeople);
        setLinkedInteractions(aggregatedInteractions);
        setMessage({
          tone: "success",
          text: `Commercial Intelligence Hub loaded. ${filteredAccounts.length} matching location${
            filteredAccounts.length === 1 ? "" : "s"
          } and ${aggregatedLinkedPeople.length} linked people found.`,
        });
        setIsProcessingSearch(false);
      } catch (error) {
        if (cancelled) return;

        const messageText =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while processing the search.";

        setAccounts([]);
        setSelectedAccount(null);
        setLinkedPeople([]);
        setLinkedInteractions([]);
        setMessage({
          tone: "error",
          text: `Could not process search. ${messageText}`,
        });
        setIsProcessingSearch(false);
      }
    };

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [
    query,
    allAccounts,
    allPeople,
    allInteractions,
    legacyIdsByPeopleId,
    manualLinks,
    selectedAccount?.id,
    isLoadingBaseData,
    supabase,
  ]);

  useEffect(() => {
    if (!selectedAccount || isEditingAccount) return;
    setEditForm(buildEditForm(selectedAccount));
  }, [selectedAccount, isEditingAccount]);

  const totalLocations = accounts.length;

  const totalAgronomyLocations = useMemo(
    () => accounts.filter((account) => isAgronomyAccount(account)).length,
    [accounts],
  );

  const agronomyCoveragePercent =
    totalLocations > 0
      ? Math.round((totalAgronomyLocations / totalLocations) * 100)
      : 0;

  const peopleByAccountId = useMemo(() => {
    const map = new Map<string, PeopleRow[]>();

    accounts.forEach((account) => {
      map.set(
        account.id,
        linkedPeople.filter((person) => isLinkedPerson(account, person, manualLinks)),
      );
    });

    return map;
  }, [accounts, linkedPeople, manualLinks]);

  const interactionsByAccountId = useMemo(() => {
    const map = new Map<string, InteractionRow[]>();

    accounts.forEach((account) => {
      const peopleForAccount = peopleByAccountId.get(account.id) ?? [];
      const legacyIds = new Set<string>();

      peopleForAccount.forEach((person) => {
        const ids = legacyIdsByPeopleId.get(person.id) ?? new Set<string>();
        ids.forEach((id) => legacyIds.add(id));
      });

      const accountInteractions = allInteractions.filter(
        (interaction) =>
          !!interaction.contact_id && legacyIds.has(interaction.contact_id),
      );

      map.set(account.id, accountInteractions);
    });

    return map;
  }, [accounts, peopleByAccountId, legacyIdsByPeopleId, allInteractions]);

  const locationsContacted = useMemo(() => {
    return accounts.filter((account) => {
      const interactions = interactionsByAccountId.get(account.id) ?? [];
      return interactions.length > 0;
    }).length;
  }, [accounts, interactionsByAccountId]);

  const ninetyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date;
  }, []);

  const activeLocationsLast90 = useMemo(() => {
    return accounts.filter((account) => {
      const interactions = interactionsByAccountId.get(account.id) ?? [];
      return interactions.some((interaction) => {
        const rawDate = interaction.date || interaction.created_at;
        if (!rawDate) return false;

        const parsed = new Date(rawDate);
        if (Number.isNaN(parsed.getTime())) return false;

        return parsed >= ninetyDaysAgo;
      });
    }).length;
  }, [accounts, interactionsByAccountId, ninetyDaysAgo]);

  const totalInteractionsForAccountSet = linkedInteractions.length;

  const accountHighestStageById = useMemo(() => {
    const map = new Map<string, StageKey | null>();
    const stageOrder: StageKey[] = [
      "introduction",
      "technical_training",
      "field_evaluation",
      "adoption",
    ];

    accounts.forEach((account) => {
      const interactions = interactionsByAccountId.get(account.id) ?? [];
      let highest: StageKey | null = null;

      interactions.forEach((interaction) => {
        const stage = normalizeStageKey(interaction.stage);
        if (!stage) return;

        if (!highest) {
          highest = stage;
          return;
        }

        if (stageOrder.indexOf(stage) > stageOrder.indexOf(highest)) {
          highest = stage;
        }
      });

      map.set(account.id, highest);
    });

    return map;
  }, [accounts, interactionsByAccountId]);

  const introStageLocations = useMemo(
    () =>
      accounts.filter(
        (account) => accountHighestStageById.get(account.id) === "introduction",
      ).length,
    [accounts, accountHighestStageById],
  );

  const technicalTrainingLocations = useMemo(
    () =>
      accounts.filter(
        (account) => accountHighestStageById.get(account.id) === "technical_training",
      ).length,
    [accounts, accountHighestStageById],
  );

  const fieldEvaluationLocations = useMemo(
    () =>
      accounts.filter(
        (account) => accountHighestStageById.get(account.id) === "field_evaluation",
      ).length,
    [accounts, accountHighestStageById],
  );

  const adoptionLocations = useMemo(
    () =>
      accounts.filter(
        (account) => accountHighestStageById.get(account.id) === "adoption",
      ).length,
    [accounts, accountHighestStageById],
  );

  const sortedTimelineInteractions = useMemo(() => {
    return [...linkedInteractions].sort((a, b) => {
      const aDate = a.date ?? a.created_at ?? "";
      const bDate = b.date ?? b.created_at ?? "";
      return bDate.localeCompare(aDate);
    });
  }, [linkedInteractions]);

  const mostRecentInteraction = sortedTimelineInteractions[0] ?? null;

  const contactCount = linkedPeople.filter((person) =>
    normalizeForMatch(person.contact_type).includes("contact"),
  ).length;

  const kingpinCount = linkedPeople.filter(
    (person) =>
      person.is_kingpin === true ||
      normalizeForMatch(person.contact_type).includes("kingpin"),
  ).length;

  const otherCount = Math.max(linkedPeople.length - contactCount - kingpinCount, 0);

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

    setAccounts((current) =>
      current
        .map((account) => (account.id === updatedAccount.id ? updatedAccount : account))
        .sort(sortAccounts),
    );

    setSelectedAccount(updatedAccount);
    setEditForm(buildEditForm(updatedAccount));
    setIsEditingAccount(false);
    setIsSavingAccount(false);
    setMessage({
      tone: "success",
      text: `Location details updated for ${getAccountDisplayName(updatedAccount)}.`,
    });
  };

  const handleSaveEntireCompany = async () => {
    if (!selectedAccount) return;

    const retailerKey = normalizeValue(selectedAccount.retailer);

    if (!retailerKey) {
      setMessage({
        tone: "error",
        text: "Cannot apply company-wide updates because this account does not have a retailer value.",
      });
      return;
    }

    setIsSavingAccount(true);

    const sharedPayload = {
      suppliers: editForm.suppliers || null,
      category: editForm.category || null,
      row_crop_relevance: editForm.row_crop_relevance || "unknown",
    };

    const { data, error } = await supabase
      .from("accounts")
      .update(sharedPayload)
      .eq("retailer", retailerKey)
      .select(ACCOUNT_SELECT);

    if (error) {
      setMessage({
        tone: "error",
        text: `Could not apply company-wide updates. ${error.message}`,
      });
      setIsSavingAccount(false);
      return;
    }

    const updatedRows = (data ?? []) as AccountRow[];
    const updatedMap = new Map(updatedRows.map((row) => [row.id, row]));

    const nextAllAccounts = allAccounts
      .map((account) => updatedMap.get(account.id) ?? account)
      .sort(sortAccounts);

    const nextAccounts = accounts
      .map((account) => updatedMap.get(account.id) ?? account)
      .sort(sortAccounts);

    const refreshedSelectedAccount =
      updatedMap.get(selectedAccount.id) ?? selectedAccount;

    setAllAccounts(nextAllAccounts);
    setAccounts(nextAccounts);
    setSelectedAccount(refreshedSelectedAccount);
    setEditForm(buildEditForm(refreshedSelectedAccount));
    setIsEditingAccount(false);
    setIsSavingAccount(false);
    setMessage({
      tone: "success",
      text: `Shared company updates applied to ${updatedRows.length} ${updatedRows.length === 1 ? "location" : "locations"} for ${retailerKey}.`,
    });
  };

  return (
    <HubShell
      title="Commercial Intelligence Hub"
      subtitle="Search a commercial account, review linked people, correct account data, and use this page as the working intelligence center for relationship decisions."
    >
      <div className="grid gap-6">
        <SectionCard
          title="General Account Summary"
          description="High-level snapshot of the full CERTIS DCM database."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total Accounts
              </div>
              <div className="mt-1 text-4xl font-bold">{summaryCounts.totalAccounts}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total Contacts
              </div>
              <div className="mt-1 text-4xl font-bold">{summaryCounts.totalContacts}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total Kingpins
              </div>
              <div className="mt-1 text-4xl font-bold">{summaryCounts.totalKingpins}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total Interactions
              </div>
              <div className="mt-1 text-4xl font-bold">{summaryCounts.totalInteractions}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Commercial Search"
          description="Search by account, retailer, city, state, supplier, category, or linked person name."
        >
          <Input
            label="Search Accounts"
            value={query}
            onChange={setQuery}
            placeholder="Type an account, city, state, supplier, category, or person name"
          />

          {isLoadingBaseData ? (
            <div className="mt-4">
              <StatusMessage
                message="Loading account, people, manual links, legacy links, and interaction data..."
                tone="info"
              />
            </div>
          ) : null}

          {isProcessingSearch ? (
            <div className="mt-4">
              <StatusMessage message="Processing commercial search..." tone="info" />
            </div>
          ) : null}

          {message ? (
            <div className="mt-4">
              <StatusMessage message={message.text} tone={message.tone} />
            </div>
          ) : null}

          <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-2">
            {accounts.map((account) => {
              const isSelected = selectedAccount?.id === account.id;
              const displayRelevance = isHeadquartersAccount(account)
                ? "hq / agronomy"
                : account.row_crop_relevance || "unknown";

              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    setSelectedAccount(account);
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
                    <RecordBadge>{displayRelevance}</RecordBadge>
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
        </SectionCard>

        <SectionCard
          title="Commercial Relationship Timeline"
          description="Current scaffold for account-set interaction history. This sits directly below search and will be upgraded into the full multi-user stage timeline."
        >
          {sortedTimelineInteractions.length === 0 ? (
            <StatusMessage
              message="No linked interactions found for the current matched account set yet."
              tone="info"
            />
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                Timeline scaffold is now in place. Next build step can convert this feed into the full multi-user horizontal progression view across Introduction, Technical Training, Field Evaluation, and Adoption.
              </div>

              <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-2">
                {sortedTimelineInteractions.slice(0, 40).map((interaction) => (
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
                        {formatInteractionDate(interaction.date || interaction.created_at)}
                      </span>
                    </div>

                    <div className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                      {interaction.summary || "Interaction"}
                    </div>

                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {interaction.details || interaction.outcome || "No additional details recorded."}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Commercial Footprint"
          description="Coverage, activity, and stage progression across the matched account set."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total Locations
              </div>
              <div className="mt-1 text-4xl font-bold">{totalLocations}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total Agronomy Locations
              </div>
              <div className="mt-1 text-4xl font-bold">{totalAgronomyLocations}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Agronomy Coverage
              </div>
              <div className="mt-1 text-4xl font-bold">{agronomyCoveragePercent}%</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Locations Contacted
              </div>
              <div className="mt-1 text-4xl font-bold">{locationsContacted}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Active Locations (90d)
              </div>
              <div className="mt-1 text-4xl font-bold">{activeLocationsLast90}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total Interactions
              </div>
              <div className="mt-1 text-4xl font-bold">{totalInteractionsForAccountSet}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Intro Locations
              </div>
              <div className="mt-1 text-4xl font-bold">{introStageLocations}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Technical Training
              </div>
              <div className="mt-1 text-4xl font-bold">{technicalTrainingLocations}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Field Evaluation
              </div>
              <div className="mt-1 text-4xl font-bold">{fieldEvaluationLocations}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Adoption
              </div>
              <div className="mt-1 text-4xl font-bold">{adoptionLocations}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Account Intelligence"
          description="Review and correct the core business details for the selected location."
        >
          {selectedAccount ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Account Name
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
                      Edit Account Details
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
                    like phone or address. Use <span className="font-semibold">Save Entire Company</span> for shared fields like supplier, category, and row crop relevance.
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton
                      onClick={handleSaveThisLocation}
                      disabled={isSavingAccount}
                    >
                      {isSavingAccount ? "Saving..." : "Save This Location"}
                    </PrimaryButton>

                    <SecondaryButton
                      onClick={handleSaveEntireCompany}
                      disabled={isSavingAccount}
                    >
                      {isSavingAccount ? "Saving..." : "Save Entire Company"}
                    </SecondaryButton>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <StatusMessage
              message="Search and select an account to load the Commercial Intelligence Hub."
              tone="info"
            />
          )}
        </SectionCard>

        <div className="grid gap-6 md:grid-cols-2">
          <SectionCard
            title="People Snapshot"
            description="Quick count of linked records across all currently matched locations."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Contacts
                </div>
                <div className="mt-1 text-4xl font-bold">{contactCount}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Kingpins
                </div>
                <div className="mt-1 text-4xl font-bold">{kingpinCount}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800 sm:col-span-2">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Other / Unassigned
                </div>
                <div className="mt-1 text-4xl font-bold">{otherCount}</div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Recent Activity Summary"
            description="Read-only snapshot of interaction activity across all currently matched locations."
          >
            <div className="grid gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Logged Interactions
                </div>
                <div className="mt-1 text-4xl font-bold">{linkedInteractions.length}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Most Recent Interaction Date
                </div>
                <div className="mt-1 font-semibold">
                  {mostRecentInteraction?.date ||
                    mostRecentInteraction?.created_at ||
                    "No activity recorded"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Most Recent Interaction Type
                </div>
                <div className="mt-1 font-semibold">
                  {mostRecentInteraction?.type || "No activity recorded"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Linked People
                </div>
                <div className="mt-1 font-semibold">{linkedPeople.length}</div>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Linked People"
          description="People associated with the current matched account set. Manual account links are prioritized over direct account IDs and fuzzy matching."
        >
          {linkedPeople.length === 0 ? (
            <StatusMessage
              message="No linked people found for this account set yet."
              tone="info"
            />
          ) : (
            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-2">
              {linkedPeople.map((person) => (
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
            This page now prioritizes manual person-account links, then direct account_id links,
            then fuzzy company matching. Legacy contacts and kingpins are used only to bridge
            older interaction records into the current people backbone.
          </div>
        </SectionCard>
      </div>
    </HubShell>
  );
}