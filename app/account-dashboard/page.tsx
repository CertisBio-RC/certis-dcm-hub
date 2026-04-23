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
  created_at: string | null;
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

type LinkedPerson = PeopleRow & {
  source_table: "contacts" | "kingpins";
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

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeForMatch(value: string | null | undefined): string {
  return normalizeValue(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSupplierTokens(value: string | null | undefined): string[] {
  return normalizeValue(value)
    .split(",")
    .map((item) => normalizeForMatch(item))
    .filter(Boolean);
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

function getPersonDisplayName(person: LinkedPerson): string {
  return (
    normalizeValue(person.regional_kingpin) ||
    normalizeValue(person.corporate_kingpin) ||
    normalizeValue(person.email) ||
    "Unnamed Person"
  );
}

function getPersonCompany(person: LinkedPerson): string {
  return (
    normalizeValue(person.company_name) ||
    normalizeValue(person.national_name) ||
    "No company listed"
  );
}

function searchIncludes(values: Array<string | null | undefined>, query: string): boolean {
  const haystack = values.map((value) => normalizeForMatch(value)).join(" ");
  return haystack.includes(normalizeForMatch(query));
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
    account.office_phone,
    account.account_key,
    account.row_crop_relevance,
  ];
}

function buildPersonSearchFields(person: PeopleRow): Array<string | null | undefined> {
  return [
    person.corporate_kingpin,
    person.regional_kingpin,
    person.company_name,
    person.national_name,
    person.supplier,
    person.state,
    person.title,
    person.email,
    person.address,
    person.office_phone,
    person.cell_phone,
    person.contact_type,
  ];
}

function isLinkedPerson(account: AccountRow, person: PeopleRow): boolean {
  const accountLongName = normalizeForMatch(account.long_name);
  const accountRetailer = normalizeForMatch(account.retailer);
  const accountName = normalizeForMatch(account.name);
  const accountState = normalizeForMatch(account.state);
  const accountSuppliers = splitSupplierTokens(account.suppliers);

  const personCompany = normalizeForMatch(person.company_name);
  const personNational = normalizeForMatch(person.national_name);
  const personSupplierTokens = splitSupplierTokens(person.supplier);
  const personState = normalizeForMatch(person.state);

  const companyCandidates = [personCompany, personNational].filter(Boolean);

  const companyMatch = companyCandidates.some((candidate) => {
    return (
      (!!accountLongName && candidate.includes(accountLongName)) ||
      (!!accountRetailer && candidate.includes(accountRetailer)) ||
      (!!accountName && candidate.includes(accountName)) ||
      (!!candidate && accountLongName.includes(candidate)) ||
      (!!candidate && accountRetailer.includes(candidate)) ||
      (!!candidate && accountName.includes(candidate))
    );
  });

  const supplierMatch =
    accountSuppliers.length === 0 ||
    personSupplierTokens.length === 0 ||
    accountSuppliers.some((supplier) => personSupplierTokens.includes(supplier));

  const stateMatch = !accountState || !personState || accountState === personState;

  return companyMatch && supplierMatch && stateMatch;
}

function sortAccounts(a: AccountRow, b: AccountRow): number {
  return getAccountDisplayName(a).localeCompare(getAccountDisplayName(b));
}

function sortPeople(a: LinkedPerson, b: LinkedPerson): number {
  return getPersonDisplayName(a).localeCompare(getPersonDisplayName(b));
}

function dedupeLinkedPeople(people: LinkedPerson[]): LinkedPerson[] {
  const seen = new Set<string>();
  const result: LinkedPerson[] = [];

  for (const person of people) {
    const key = `${person.source_table}:${person.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
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

function isRelevantAccount(account: AccountRow): boolean {
  const relevance = normalizeForMatch(account.row_crop_relevance || "unknown");
  const category = normalizeForMatch(account.category);

  const isHeadquarters =
    category.includes("corporate") || category.includes("regional");

  if (isHeadquarters) return true;

  return relevance === "relevant";
}

export default function CommercialIntelligenceHubPage() {
  const supabase = useMemo(() => createClient(), []);

  const [query, setQuery] = useState("");
  const [allAccounts, setAllAccounts] = useState<AccountRow[]>([]);
  const [allContacts, setAllContacts] = useState<PeopleRow[]>([]);
  const [allKingpins, setAllKingpins] = useState<PeopleRow[]>([]);
  const [allInteractions, setAllInteractions] = useState<InteractionRow[]>([]);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountRow | null>(null);
  const [linkedPeople, setLinkedPeople] = useState<LinkedPerson[]>([]);
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

      const [accountsResponse, contactsResponse, kingpinsResponse, interactionsResponse] =
        await Promise.all([
          supabase
            .from("accounts")
            .select(
              "id, source_system, source_file, source_sheet, source_row_number, account_key, long_name, retailer, name, address, city, state, zip, category, suppliers, is_active, created_at, updated_at, office_phone, row_crop_relevance",
            )
            .limit(2500),
          supabase
            .from("contacts")
            .select(
              "id, state, national_name, company_name, supplier, corporate_kingpin, regional_kingpin, title, address, office_phone, cell_phone, email, contact_type, created_at",
            )
            .limit(2500),
          supabase
            .from("kingpins")
            .select(
              "id, state, national_name, company_name, supplier, corporate_kingpin, regional_kingpin, title, address, office_phone, cell_phone, email, contact_type, created_at",
            )
            .limit(2500),
          supabase
            .from("interactions")
            .select(
              "id, user_id, contact_id, date, type, summary, details, outcome, follow_up_date, created_at, stage",
            )
            .limit(2500),
        ]);

      if (accountsResponse.error) {
        setMessage({
          tone: "error",
          text: `Could not load accounts. ${accountsResponse.error.message}`,
        });
        setIsLoadingBaseData(false);
        return;
      }

      if (contactsResponse.error) {
        setMessage({
          tone: "error",
          text: `Could not load contacts. ${contactsResponse.error.message}`,
        });
        setIsLoadingBaseData(false);
        return;
      }

      if (kingpinsResponse.error) {
        setMessage({
          tone: "error",
          text: `Could not load kingpins. ${kingpinsResponse.error.message}`,
        });
        setIsLoadingBaseData(false);
        return;
      }

      if (interactionsResponse.error) {
        setMessage({
          tone: "error",
          text: `Could not load interactions. ${interactionsResponse.error.message}`,
        });
        setIsLoadingBaseData(false);
        return;
      }

      setAllAccounts(((accountsResponse.data ?? []) as AccountRow[]).sort(sortAccounts));
      setAllContacts((contactsResponse.data ?? []) as PeopleRow[]);
      setAllKingpins((kingpinsResponse.data ?? []) as PeopleRow[]);
      setAllInteractions((interactionsResponse.data ?? []) as InteractionRow[]);
      setIsLoadingBaseData(false);
    };

    void loadBaseData();
  }, [supabase]);

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

    setIsProcessingSearch(true);

    const contactLinkedByAccount = new Map<string, LinkedPerson[]>();
    const kingpinLinkedByAccount = new Map<string, LinkedPerson[]>();

    for (const account of allAccounts) {
      contactLinkedByAccount.set(
        account.id,
        allContacts
          .filter((person) => isLinkedPerson(account, person))
          .map((person) => ({
            ...person,
            source_table: "contacts" as const,
          })),
      );

      kingpinLinkedByAccount.set(
        account.id,
        allKingpins
          .filter((person) => isLinkedPerson(account, person))
          .map((person) => ({
            ...person,
            source_table: "kingpins" as const,
          })),
      );
    }

    const filteredAccounts = allAccounts
      .filter((account) => {
        const accountMatch = searchIncludes(buildAccountSearchFields(account), q);

        const linkedContacts = contactLinkedByAccount.get(account.id) ?? [];
        const linkedKingpins = kingpinLinkedByAccount.get(account.id) ?? [];

        const peopleMatch = [...linkedContacts, ...linkedKingpins].some((person) =>
          searchIncludes(buildPersonSearchFields(person), q),
        );

        return accountMatch || peopleMatch;
      })
      .sort(sortAccounts);

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

    const aggregatedLinkedPeople = dedupeLinkedPeople(
      filteredAccounts.flatMap((account) => [
        ...(contactLinkedByAccount.get(account.id) ?? []),
        ...(kingpinLinkedByAccount.get(account.id) ?? []),
      ]),
    ).sort(sortPeople);

    const aggregatedContactIds = new Set(
      aggregatedLinkedPeople
        .filter((person) => person.source_table === "contacts")
        .map((person) => person.id),
    );

    const aggregatedInteractions = allInteractions.filter(
      (interaction) =>
        !!interaction.contact_id && aggregatedContactIds.has(interaction.contact_id),
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
  }, [
    query,
    allAccounts,
    allContacts,
    allKingpins,
    allInteractions,
    selectedAccount?.id,
    isLoadingBaseData,
  ]);

  useEffect(() => {
    if (!selectedAccount || isEditingAccount) return;
    setEditForm(buildEditForm(selectedAccount));
  }, [selectedAccount, isEditingAccount]);

  const relevantAccounts = useMemo(
    () => accounts.filter((account) => isRelevantAccount(account)),
    [accounts],
  );

  const partialAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => normalizeForMatch(account.row_crop_relevance) === "partial",
      ),
    [accounts],
  );

  const nonRelevantAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => normalizeForMatch(account.row_crop_relevance) === "not_relevant",
      ),
    [accounts],
  );

  const unknownAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        const relevance = normalizeForMatch(account.row_crop_relevance);
        return !relevance || relevance === "unknown";
      }),
    [accounts],
  );

  const percentRelevant =
    accounts.length > 0
      ? Math.round((relevantAccounts.length / accounts.length) * 100)
      : 0;

  const contactCount = linkedPeople.filter((person) => person.source_table === "contacts").length;
  const kingpinCount = linkedPeople.filter((person) => person.source_table === "kingpins").length;
  const otherCount = Math.max(linkedPeople.length - contactCount - kingpinCount, 0);

  const mostRecentInteraction =
    [...linkedInteractions].sort((a, b) => {
      const aDate = a.date ?? a.created_at ?? "";
      const bDate = b.date ?? b.created_at ?? "";
      return bDate.localeCompare(aDate);
    })[0] ?? null;

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
      .select(
        "id, source_system, source_file, source_sheet, source_row_number, account_key, long_name, retailer, name, address, city, state, zip, category, suppliers, is_active, created_at, updated_at, office_phone, row_crop_relevance",
      )
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
      .select(
        "id, source_system, source_file, source_sheet, source_row_number, account_key, long_name, retailer, name, address, city, state, zip, category, suppliers, is_active, created_at, updated_at, office_phone, row_crop_relevance",
      );

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
      <div className="grid gap-6 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
        <SectionCard
          title="Commercial Search"
          description="Search by account, retailer, city, state, supplier, category, or linked contact/kingpin name."
          className="self-start xl:sticky xl:top-6"
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
                message="Loading account, contact, kingpin, and interaction data..."
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

          <div className="mt-4 max-h-[65vh] space-y-3 overflow-y-auto pr-2">
            {accounts.map((account) => {
              const isSelected = selectedAccount?.id === account.id;
              const relevance = normalizeForMatch(account.row_crop_relevance);
              const category = normalizeForMatch(account.category);
              const isHeadquarters =
                category.includes("corporate") || category.includes("regional");
              const displayRelevance = isHeadquarters
                ? "relevant"
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
                    {displayRelevance ? (
                      <RecordBadge>{displayRelevance}</RecordBadge>
                    ) : null}
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

        <div className="grid gap-6">
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
                          {isRelevantAccount(selectedAccount)
                            ? "relevant"
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
                        placeholder="Example: Coop, Retailer, Dealer"
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

          <SectionCard
            title="Commercial Footprint"
            description="Visible location buckets for the matched account set, with KPI emphasis on relevant locations only."
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Relevant Locations
                </div>
                <div className="mt-1 text-4xl font-bold">{relevantAccounts.length}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Total Locations
                </div>
                <div className="mt-1 text-4xl font-bold">{accounts.length}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  % Relevant
                </div>
                <div className="mt-1 text-4xl font-bold">{percentRelevant}%</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Unclassified
                </div>
                <div className="mt-1 text-4xl font-bold">{unknownAccounts.length}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Partial / Mixed
                </div>
                <div className="mt-1 text-3xl font-bold">{partialAccounts.length}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Non-Relevant
                </div>
                <div className="mt-1 text-3xl font-bold">{nonRelevantAccounts.length}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  HQ Override Included
                </div>
                <div className="mt-1 text-sm font-semibold">
                  Corporate HQ and Regional HQ always count as relevant.
                </div>
              </div>
            </div>
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
            description="Contacts and kingpins associated with the current matched account set, not just the selected location."
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
                    key={`${person.source_table}-${person.id}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-2xl font-bold">{getPersonDisplayName(person)}</div>
                      <RecordBadge>{person.contact_type || person.source_table}</RecordBadge>
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
                        value={person.address}
                        address={person.address}
                        state={person.state}
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
              This page is now positioned as the Commercial Intelligence Hub. Use it to review the
              account, correct business details in real time, and quickly assess the linked people
              and recent activity around the account.
            </div>
          </SectionCard>
        </div>
      </div>
    </HubShell>
  );
}