"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Account,
  AddressValueLink,
  Contact,
  ContactValueLink,
  HubShell,
  Input,
  InteractionPanel,
  SectionCard,
  StatusMessage,
  createClient,
} from "@/components/hub-shared";

type PeopleRow = {
  id: string;
  state: string | null;
  national_name: string | null;
  company_name: string | null;
  supplier: string | null;
  corporate_kingpin: string | null;
  regional_kingpin: string | null;
  title: string | null;
  address: string | null;
  office_phone: string | null;
  cell_phone: string | null;
  email: string | null;
  contact_type: string | null;
  created_at?: string | null;
};

type SearchResult = PeopleRow & {
  source_table: "contacts" | "kingpins";
};

type AccountRow = {
  id: string;
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
  office_phone: string | null;
  created_at?: string | null;
};

type UnifiedPersonRow = {
  id: string;
  email: string | null;
  office_phone?: string | null;
  cell_phone?: string | null;
};

type GroupedSearchResult = {
  key: string;
  display_name: string;
  display_company: string;
  display_subtitle: string;
  display_type: string;
  data_source_label: string;
  email: string | null;
  cell_phone: string | null;
  office_phone: string | null;
  address: string | null;
  supplier: string | null;
  state: string | null;
  title: string | null;
  contact_type: string | null;
  source_tables: Array<"contacts" | "kingpins">;
  contact_record: SearchResult | null;
  kingpin_record: SearchResult | null;
  preferred_record: SearchResult;
};

const PLACEHOLDER_VALUES = new Set([
  "",
  "other",
  "unknown",
  "n/a",
  "na",
  "none",
  "null",
  "tbd",
  "-",
  "--",
]);

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function isPlaceholderValue(value: string | null | undefined): boolean {
  const normalized = normalizeValue(value).toLowerCase();
  return PLACEHOLDER_VALUES.has(normalized);
}

function normalizePhone(value: string | null | undefined): string {
  return normalizeValue(value).replace(/[^\d]/g, "");
}

function normalizeEmail(value: string | null | undefined): string {
  return normalizeValue(value).toLowerCase();
}

function normalizeCompany(value: string | null | undefined): string {
  return normalizeValue(value).toLowerCase();
}

function normalizeState(value: string | null | undefined): string {
  return normalizeValue(value).toLowerCase();
}

function buildAccountLookupKey(
  name: string | null | undefined,
  state: string | null | undefined,
): string {
  return `${normalizeCompany(name)}|${normalizeState(state)}`;
}

function formatAccountCompanyDisplay(
  account: Partial<AccountRow> | null | undefined,
): string {
  const retailer = normalizeValue(account?.retailer);
  const name = normalizeValue(account?.name);

  if (retailer && name) return `${retailer} - ${name}`;
  if (retailer) return retailer;
  if (name) return name;
  return "";
}

function titleCaseFromEmailLocalPart(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const cleaned = localPart.replace(/[._-]+/g, " ").trim();

  if (!cleaned) return "";

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPersonNameCandidates(person: SearchResult): string[] {
  return [
    normalizeValue(person.regional_kingpin),
    normalizeValue(person.corporate_kingpin),
  ].filter((value) => value && !isPlaceholderValue(value));
}

function getDisplayName(person: SearchResult): string {
  const personNameCandidate = getPersonNameCandidates(person)[0];
  if (personNameCandidate) return personNameCandidate;

  const email = normalizeEmail(person.email);
  if (email) {
    const emailAsName = titleCaseFromEmailLocalPart(email);
    if (emailAsName) return emailAsName;
    return email;
  }

  return "Unnamed Person";
}

function getBaseCompanyValue(person: SearchResult): string {
  const companyName = normalizeValue(person.company_name);
  const supplier = normalizeValue(person.supplier);
  const nationalName = normalizeValue(person.national_name);

  return companyName || supplier || nationalName || "No company listed";
}

function getDisplaySubtitle(
  person: SearchResult,
  displayCompanyOverride?: string,
): string {
  const parts = [
    normalizeValue(person.title),
    displayCompanyOverride || getBaseCompanyValue(person),
    normalizeValue(person.state),
  ].filter(Boolean);

  return parts.join(" · ") || "No details listed";
}

function sortResults(a: SearchResult, b: SearchResult): number {
  const nameCompare = getDisplayName(a).localeCompare(getDisplayName(b));
  if (nameCompare !== 0) return nameCompare;

  const companyCompare = getBaseCompanyValue(a).localeCompare(getBaseCompanyValue(b));
  if (companyCompare !== 0) return companyCompare;

  const titleCompare = normalizeValue(a.title).localeCompare(normalizeValue(b.title));
  if (titleCompare !== 0) return titleCompare;

  return a.source_table.localeCompare(b.source_table);
}

function buildSearchOrClause(query: string): string {
  const safe = query.replace(/,/g, " ").replace(/\./g, " ").trim();

  return [
    `state.ilike.%${safe}%`,
    `national_name.ilike.%${safe}%`,
    `company_name.ilike.%${safe}%`,
    `supplier.ilike.%${safe}%`,
    `corporate_kingpin.ilike.%${safe}%`,
    `regional_kingpin.ilike.%${safe}%`,
    `title.ilike.%${safe}%`,
    `address.ilike.%${safe}%`,
    `office_phone.ilike.%${safe}%`,
    `cell_phone.ilike.%${safe}%`,
    `email.ilike.%${safe}%`,
    `contact_type.ilike.%${safe}%`,
  ].join(",");
}

function getBestNameForGroup(records: SearchResult[]): string {
  const candidateNames = records
    .map((record) => getDisplayName(record))
    .filter((value) => value && value !== "Unnamed Person" && !isPlaceholderValue(value));

  if (candidateNames.length > 0) {
    candidateNames.sort((a, b) => a.localeCompare(b));
    return candidateNames[0];
  }

  const email = records.map((record) => normalizeEmail(record.email)).find(Boolean);
  if (email) return titleCaseFromEmailLocalPart(email) || email;

  return "Unnamed Person";
}

function getPreferredRecord(records: SearchResult[]): SearchResult {
  const contactRecord = records.find((record) => record.source_table === "contacts");
  if (contactRecord) return contactRecord;
  return records[0];
}

function buildGroupKey(record: SearchResult): string {
  const email = normalizeEmail(record.email);
  if (email) return `email:${email}`;

  const mobile = normalizePhone(record.cell_phone);
  if (mobile) return `mobile:${mobile}`;

  const office = normalizePhone(record.office_phone);
  if (office) return `office:${office}`;

  const personName = getPersonNameCandidates(record)[0];
  const company = normalizeCompany(record.company_name) || normalizeCompany(record.supplier);

  if (personName && company) {
    return `name-company:${personName.toLowerCase()}|${company}`;
  }

  return `record:${record.source_table}:${record.id}`;
}

function groupSearchResults(records: SearchResult[]): GroupedSearchResult[] {
  const groups = new Map<string, SearchResult[]>();

  for (const record of records) {
    const key = buildGroupKey(record);
    const current = groups.get(key) ?? [];
    current.push(record);
    groups.set(key, current);
  }

  const grouped = Array.from(groups.entries()).map(([key, groupRecords]) => {
    const preferredRecord = getPreferredRecord(groupRecords);
    const contactRecord =
      groupRecords.find((record) => record.source_table === "contacts") ?? null;
    const kingpinRecord =
      groupRecords.find((record) => record.source_table === "kingpins") ?? null;
    const sourceTables = Array.from(
      new Set(groupRecords.map((record) => record.source_table)),
    ).sort();

    const displayName = getBestNameForGroup(groupRecords);
    const displayCompany = getBaseCompanyValue(preferredRecord);
    const displaySubtitle = getDisplaySubtitle(preferredRecord, displayCompany);

    const hasKingpin = sourceTables.includes("kingpins");
    const displayType = hasKingpin ? "Kingpin" : "Contact";

    let dataSourceLabel = "Contacts Table";
    if (sourceTables.length === 2) {
      dataSourceLabel = "Contacts Table + Kingpins Table";
    } else if (sourceTables[0] === "kingpins") {
      dataSourceLabel = "Kingpins Table";
    }

    return {
      key,
      display_name: displayName,
      display_company: displayCompany,
      display_subtitle: displaySubtitle,
      display_type: displayType,
      data_source_label: dataSourceLabel,
      email:
        normalizeValue(preferredRecord.email) ||
        normalizeValue(contactRecord?.email) ||
        normalizeValue(kingpinRecord?.email) ||
        null,
      cell_phone:
        normalizeValue(preferredRecord.cell_phone) ||
        normalizeValue(contactRecord?.cell_phone) ||
        normalizeValue(kingpinRecord?.cell_phone) ||
        null,
      office_phone:
        normalizeValue(preferredRecord.office_phone) ||
        normalizeValue(contactRecord?.office_phone) ||
        normalizeValue(kingpinRecord?.office_phone) ||
        null,
      address:
        normalizeValue(preferredRecord.address) ||
        normalizeValue(contactRecord?.address) ||
        normalizeValue(kingpinRecord?.address) ||
        null,
      supplier:
        normalizeValue(preferredRecord.supplier) ||
        normalizeValue(contactRecord?.supplier) ||
        normalizeValue(kingpinRecord?.supplier) ||
        null,
      state:
        normalizeValue(preferredRecord.state) ||
        normalizeValue(contactRecord?.state) ||
        normalizeValue(kingpinRecord?.state) ||
        null,
      title:
        normalizeValue(preferredRecord.title) ||
        normalizeValue(contactRecord?.title) ||
        normalizeValue(kingpinRecord?.title) ||
        null,
      contact_type:
        normalizeValue(preferredRecord.contact_type) ||
        normalizeValue(contactRecord?.contact_type) ||
        normalizeValue(kingpinRecord?.contact_type) ||
        null,
      source_tables: sourceTables,
      contact_record: contactRecord,
      kingpin_record: kingpinRecord,
      preferred_record: preferredRecord,
    };
  });

  return grouped.sort((a, b) => {
    const nameCompare = a.display_name.localeCompare(b.display_name);
    if (nameCompare !== 0) return nameCompare;

    const companyCompare = a.display_company.localeCompare(b.display_company);
    if (companyCompare !== 0) return companyCompare;

    return a.display_subtitle.localeCompare(b.display_subtitle);
  });
}

function enrichGroupedResultsWithAccounts(
  groupedResults: GroupedSearchResult[],
  accounts: AccountRow[],
): GroupedSearchResult[] {
  const byNameAndState = new Map<string, AccountRow>();
  const byNameOnly = new Map<string, AccountRow>();

  for (const account of accounts) {
    const name = normalizeValue(account.name);
    if (!name) continue;

    const keyWithState = buildAccountLookupKey(account.name, account.state);
    if (!byNameAndState.has(keyWithState)) {
      byNameAndState.set(keyWithState, account);
    }

    const nameOnlyKey = normalizeCompany(account.name);
    if (!byNameOnly.has(nameOnlyKey)) {
      byNameOnly.set(nameOnlyKey, account);
    }
  }

  return groupedResults.map((result) => {
    const companyName = result.preferred_record.company_name;
    const state = result.state || result.preferred_record.state;

    const matchedAccount =
      byNameAndState.get(buildAccountLookupKey(companyName, state)) ??
      byNameOnly.get(normalizeCompany(companyName)) ??
      null;

    const accountDisplayCompany = formatAccountCompanyDisplay(matchedAccount);
    const nextDisplayCompany = accountDisplayCompany || result.display_company;

    return {
      ...result,
      display_company: nextDisplayCompany,
      display_subtitle: getDisplaySubtitle(result.preferred_record, nextDisplayCompany),
    };
  });
}

function TypeBadge({ result }: { result: GroupedSearchResult }) {
  const isKingpin = result.display_type === "Kingpin";

  const className = isKingpin
    ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950"
    : "bg-blue-600 text-white dark:bg-blue-500 dark:text-slate-950";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}
    >
      {result.display_type}
    </span>
  );
}

function getProfileHref(result: GroupedSearchResult): string {
  if (result.contact_record) {
    return `/search-contacts/contacts/${result.contact_record.id}`;
  }

  return `/search-contacts/kingpins/${result.preferred_record.id}`;
}

export default function SearchContactsPage() {
  const supabase = useMemo(() => createClient(), []);
  const interactionPanelRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GroupedSearchResult[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<GroupedSearchResult | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [resolvedPersonId, setResolvedPersonId] = useState<string | null>(null);
  const [resolvedBy, setResolvedBy] = useState<string | null>(null);
  const [isResolvingPersonId, setIsResolvingPersonId] = useState(false);
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasTypedSearch, setHasTypedSearch] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    const runSearch = async () => {
      const q = query.trim();

      if (q.length === 0) {
        setResults([]);
        setSelectedPerson(null);
        setSelectedAccount(null);
        setResolvedPersonId(null);
        setResolvedBy(null);
        setMessage(null);
        setIsSearching(false);
        setHasTypedSearch(false);
        return;
      }

      setHasTypedSearch(true);

      if (q.length < 2) {
        setResults([]);
        setSelectedPerson(null);
        setSelectedAccount(null);
        setResolvedPersonId(null);
        setResolvedBy(null);
        setMessage({
          tone: "info",
          text: "Type at least 2 characters to search people.",
        });
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setMessage(null);

      const orClause = buildSearchOrClause(q);

      const [contactsResponse, kingpinsResponse] = await Promise.all([
        supabase
          .from("contacts")
          .select(
            "id, state, national_name, company_name, supplier, corporate_kingpin, regional_kingpin, title, address, office_phone, cell_phone, email, contact_type, created_at",
          )
          .or(orClause)
          .limit(100),
        supabase
          .from("kingpins")
          .select(
            "id, state, national_name, company_name, supplier, corporate_kingpin, regional_kingpin, title, address, office_phone, cell_phone, email, contact_type, created_at",
          )
          .or(orClause)
          .limit(100),
      ]);

      if (contactsResponse.error) {
        setResults([]);
        setSelectedPerson(null);
        setSelectedAccount(null);
        setResolvedPersonId(null);
        setResolvedBy(null);
        setMessage({
          tone: "error",
          text: `Contact search failed. ${contactsResponse.error.message}`,
        });
        setIsSearching(false);
        return;
      }

      if (kingpinsResponse.error) {
        setResults([]);
        setSelectedPerson(null);
        setSelectedAccount(null);
        setResolvedPersonId(null);
        setResolvedBy(null);
        setMessage({
          tone: "error",
          text: `Kingpin search failed. ${kingpinsResponse.error.message}`,
        });
        setIsSearching(false);
        return;
      }

      const contactRows: SearchResult[] = ((contactsResponse.data ?? []) as PeopleRow[]).map(
        (row) => ({
          ...row,
          source_table: "contacts",
        }),
      );

      const kingpinRows: SearchResult[] = ((kingpinsResponse.data ?? []) as PeopleRow[]).map(
        (row) => ({
          ...row,
          source_table: "kingpins",
        }),
      );

      const merged = [...contactRows, ...kingpinRows].sort(sortResults);
      const grouped = groupSearchResults(merged);

      let enrichedResults = grouped;

      const uniqueAccountNames = Array.from(
        new Set(
          grouped
            .map((item) => normalizeValue(item.preferred_record.company_name))
            .filter(Boolean),
        ),
      );

      if (uniqueAccountNames.length > 0) {
        const accountsResponse = await supabase
          .from("accounts")
          .select(
            "id, account_key, long_name, retailer, name, address, city, state, zip, category, suppliers, office_phone, created_at",
          )
          .in("name", uniqueAccountNames);

        if (!accountsResponse.error) {
          enrichedResults = enrichGroupedResultsWithAccounts(
            grouped,
            (accountsResponse.data ?? []) as AccountRow[],
          );
        }
      }

      setResults(enrichedResults);

      setSelectedPerson((current) => {
        if (!current) return enrichedResults[0] ?? null;
        const refreshed = enrichedResults.find((item) => item.key === current.key);
        return refreshed ?? (enrichedResults[0] ?? null);
      });

      if (enrichedResults.length === 0) {
        setMessage({
          tone: "info",
          text: "No people matched your search.",
        });
      } else {
        setMessage({
          tone: "success",
          text: `${enrichedResults.length} matching record${
            enrichedResults.length === 1 ? "" : "s"
          } found.`,
        });
      }

      setIsSearching(false);
    };

    void runSearch();
  }, [query, supabase]);

  useEffect(() => {
    const resolveUnifiedPersonId = async () => {
      if (!selectedPerson) {
        setResolvedPersonId(null);
        setResolvedBy(null);
        setIsResolvingPersonId(false);
        return;
      }

      const email = normalizeEmail(selectedPerson.email);
      const mobilePhone = normalizePhone(selectedPerson.cell_phone);
      const officePhone = normalizePhone(selectedPerson.office_phone);

      setIsResolvingPersonId(true);
      setResolvedPersonId(null);
      setResolvedBy(null);

      if (email) {
        const { data: emailMatches, error: emailError } = await supabase
          .from("people")
          .select("id, email")
          .ilike("email", email)
          .limit(10);

        if (!emailError && emailMatches && emailMatches.length > 0) {
          setResolvedPersonId(emailMatches[0].id);
          setResolvedBy(`email (${email})`);
          setIsResolvingPersonId(false);
          return;
        }
      }

      const { data: peopleRows, error: peopleError } = await supabase
        .from("people")
        .select("id, email, office_phone, cell_phone")
        .limit(5000);

      if (!peopleError && peopleRows) {
        const matchedByPhone = (peopleRows as UnifiedPersonRow[]).find((row) => {
          const rowMobile = normalizePhone(row.cell_phone ?? null);
          const rowOffice = normalizePhone(row.office_phone ?? null);

          if (mobilePhone && (rowMobile === mobilePhone || rowOffice === mobilePhone)) {
            return true;
          }

          if (officePhone && (rowMobile === officePhone || rowOffice === officePhone)) {
            return true;
          }

          return false;
        });

        if (matchedByPhone?.id) {
          const matchedPhone =
            mobilePhone &&
            (normalizePhone(matchedByPhone.cell_phone ?? null) === mobilePhone ||
              normalizePhone(matchedByPhone.office_phone ?? null) === mobilePhone)
              ? mobilePhone
              : officePhone;

          setResolvedPersonId(matchedByPhone.id);
          setResolvedBy(`phone (${matchedPhone || "matched"})`);
          setIsResolvingPersonId(false);
          return;
        }
      }

      setResolvedPersonId(null);
      setResolvedBy(null);
      setIsResolvingPersonId(false);
    };

    void resolveUnifiedPersonId();
  }, [selectedPerson, supabase]);

  useEffect(() => {
    const resolveSelectedAccount = async () => {
      if (!selectedPerson) {
        setSelectedAccount(null);
        setIsResolvingAccount(false);
        return;
      }

      const companyName = normalizeValue(selectedPerson.preferred_record.company_name);
      const state = normalizeValue(selectedPerson.state || selectedPerson.preferred_record.state);

      if (!companyName) {
        setSelectedAccount(null);
        setIsResolvingAccount(false);
        return;
      }

      setIsResolvingAccount(true);
      setSelectedAccount(null);

      const { data: exactMatches, error: exactError } = await supabase
        .from("accounts")
        .select(
          "id, account_key, long_name, retailer, name, address, city, state, zip, category, suppliers, office_phone, created_at",
        )
        .eq("name", companyName)
        .eq("state", state)
        .limit(5);

      if (!exactError && exactMatches && exactMatches.length > 0) {
        setSelectedAccount(exactMatches[0] as Account);
        setIsResolvingAccount(false);
        return;
      }

      const { data: nameOnlyMatches, error: nameOnlyError } = await supabase
        .from("accounts")
        .select(
          "id, account_key, long_name, retailer, name, address, city, state, zip, category, suppliers, office_phone, created_at",
        )
        .eq("name", companyName)
        .limit(5);

      if (!nameOnlyError && nameOnlyMatches && nameOnlyMatches.length > 0) {
        setSelectedAccount(nameOnlyMatches[0] as Account);
        setIsResolvingAccount(false);
        return;
      }

      setSelectedAccount(null);
      setIsResolvingAccount(false);
    };

    void resolveSelectedAccount();
  }, [selectedPerson, supabase]);

  const selectedContactForInteraction: Contact | null = selectedPerson
    ? {
        id: selectedPerson.contact_record?.id ?? selectedPerson.preferred_record.id,
        account_id: selectedAccount?.id ?? null,
        first_name: selectedPerson.display_name,
        last_name: null,
        title: selectedPerson.title,
        email: selectedPerson.email,
        mobile_phone: selectedPerson.cell_phone,
        office_phone: selectedPerson.office_phone,
        stage: null,
        notes: selectedPerson.display_company,
        created_at:
          selectedPerson.contact_record?.created_at ??
          selectedPerson.preferred_record.created_at ??
          null,
      }
    : null;

  const selectedPersonId = resolvedPersonId;
  const selectedSourceTable =
    selectedPerson?.contact_record != null
      ? "contacts"
      : selectedPerson?.kingpin_record != null
        ? "kingpins"
        : null;

  const canLogInteraction = Boolean(selectedPerson && selectedPersonId && !isResolvingPersonId);

  const handleScrollToInteractionPanel = () => {
    interactionPanelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <HubShell
      title="Search Existing People"
      subtitle="Search across people, including contacts and kingpins. Review the selected record, then open the full profile timeline."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Search People"
          description="Search by person name, company, supplier, state, title, phone, or email."
        >
          <Input
            label="Search People"
            value={query}
            onChange={setQuery}
            placeholder="Type a person name, company, supplier, state, title, phone, or email"
          />

          {isSearching ? (
            <div className="mt-4">
              <StatusMessage message="Searching people..." tone="info" />
            </div>
          ) : null}

          {message ? (
            <div className="mt-4">
              <StatusMessage message={message.text} tone={message.tone} />
            </div>
          ) : null}

          {!hasTypedSearch ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              Begin typing to search across people, including contacts and kingpins.
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            {results.map((person) => {
              const isSelected = selectedPerson?.key === person.key;

              return (
                <div
                  key={person.key}
                  className={`rounded-2xl border p-4 transition ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-bold">{person.display_name}</div>
                        <TypeBadge result={person} />
                      </div>

                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {person.display_subtitle}
                      </div>

                      {person.email ? (
                        <div className="mt-2 text-sm">
                          <ContactValueLink kind="email" value={person.email} />
                        </div>
                      ) : null}

                      {person.cell_phone ? (
                        <div className="mt-1 text-sm">
                          <ContactValueLink kind="mobile" value={person.cell_phone} />
                        </div>
                      ) : null}

                      {person.office_phone ? (
                        <div className="mt-1 text-sm">
                          <ContactValueLink kind="office" value={person.office_phone} />
                        </div>
                      ) : null}

                      {person.address ? (
                        <div className="mt-1 text-sm">
                          <AddressValueLink
                            value={person.address}
                            address={person.address}
                            state={person.state}
                            label={person.display_name}
                            context={person.display_company}
                          />
                        </div>
                      ) : null}

                      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold">Data Source:</span>{" "}
                        {person.data_source_label}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPerson(person)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          isSelected
                            ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500 dark:text-slate-950"
                            : "border-blue-600 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-400 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-900/30"
                        }`}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </button>

                      <Link
                        href={getProfileHref(person)}
                        className="rounded-xl border border-[#46f0c3] bg-[#12305d] px-3 py-2 text-center text-sm font-semibold text-[#46f0c3] transition hover:bg-[#163a71]"
                      >
                        Open Profile
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div ref={interactionPanelRef} className="scroll-mt-6">
          {selectedPerson ? (
            <div className="mb-4 flex flex-wrap gap-3">
              <Link
                href={getProfileHref(selectedPerson)}
                className="inline-flex rounded-xl border border-[#46f0c3] bg-[#12305d] px-4 py-2.5 text-sm font-bold text-[#46f0c3] transition hover:bg-[#163a71]"
              >
                Open Full Profile + Timeline
              </Link>

              <button
                type="button"
                onClick={handleScrollToInteractionPanel}
                disabled={!canLogInteraction}
                className={`inline-flex rounded-xl px-4 py-2.5 text-sm font-bold text-white transition ${
                  canLogInteraction
                    ? "bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    : "cursor-not-allowed bg-slate-400 dark:bg-slate-700"
                }`}
              >
                Log Interaction
              </button>
            </div>
          ) : null}

          {!selectedPerson ? (
            <SectionCard
              title="Log An Interaction"
              description="Search and select a person on the left, then log the interaction here."
            >
              <StatusMessage
                tone="info"
                message="No person selected yet. Search and select a person to enable interaction logging."
              />
            </SectionCard>
          ) : !canLogInteraction ? (
            <SectionCard
              title="Log An Interaction"
              description="A unified people.id must be resolved before this interaction can be saved."
            >
              <StatusMessage
                tone="error"
                message="Interaction logging is temporarily disabled for this selected record because the app could not match it to the unified people table."
              />
            </SectionCard>
          ) : (
            <InteractionPanel
              selectedAccount={selectedAccount}
              selectedContact={selectedContactForInteraction}
              selectedPersonId={selectedPersonId}
              selectedSourceTable={selectedSourceTable}
            />
          )}
        </div>
      </div>
    </HubShell>
  );
}