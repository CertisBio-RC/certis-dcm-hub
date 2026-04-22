"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Account,
  Contact,
  HubShell,
  Input,
  InteractionPanel,
  PrimaryButton,
  RecordBadge,
  SectionCard,
  SecondaryButton,
  StatusMessage,
  TextArea,
  createClient,
  formatAddress,
  getAccountDisplayName,
  normalizeText,
} from "@/components/hub-shared";

type ContactTypeOption = "Contact" | "Kingpin";

type SavedPersonRow = {
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

function buildDisplayName(row: Partial<SavedPersonRow> | null | undefined): string {
  if (!row) return "No record saved yet";

  const regional = (row.regional_kingpin ?? "").trim();
  const corporate = (row.corporate_kingpin ?? "").trim();
  const email = (row.email ?? "").trim();

  return regional || corporate || email || "No record saved yet";
}

function getTargetTable(contactType: ContactTypeOption): "contacts" | "kingpins" {
  return contactType === "Kingpin" ? "kingpins" : "contacts";
}

function getPageSubtitle(contactType: ContactTypeOption): string {
  return `Create a new ${contactType.toLowerCase()} record, link them to an existing account when available, or add a new account / location inline when needed.`;
}

function getSavePersonButtonLabel(contactType: ContactTypeOption, isSaving: boolean): string {
  if (isSaving) {
    return contactType === "Kingpin" ? "Saving Kingpin..." : "Saving Contact...";
  }

  return contactType === "Kingpin" ? "Add Kingpin" : "Add Contact";
}

function getPersonSuccessMessage(contactType: ContactTypeOption): string {
  return contactType === "Kingpin"
    ? "Kingpin saved successfully."
    : "Contact saved successfully.";
}

function getPersonErrorPrefix(contactType: ContactTypeOption): string {
  return contactType === "Kingpin" ? "Could not save kingpin." : "Could not save contact.";
}

function generateAccountKey(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `acct_${hex}`;
}

function buildSuggestedLongName(
  retailer: string,
  locationName: string,
  stateValue: string,
  fallbackCompany: string,
): string {
  const r = retailer.trim();
  const l = locationName.trim();
  const s = stateValue.trim();
  const c = fallbackCompany.trim();

  if (r && l && s) return `${r} - ${l}, ${s}`;
  if (r && l) return `${r} - ${l}`;
  if (c && s) return `${c} - ${s}`;
  if (c) return c;
  if (r) return r;
  return "";
}

export default function AddContactPage() {
  const supabase = useMemo(() => createClient(), []);

  const [accountSearch, setAccountSearch] = useState("");
  const [accountMatches, setAccountMatches] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isSearchingAccounts, setIsSearchingAccounts] = useState(false);

  const [contactType, setContactType] = useState<ContactTypeOption>("Contact");
  const [personName, setPersonName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [cellPhone, setCellPhone] = useState("");
  const [officePhone, setOfficePhone] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [supplier, setSupplier] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [nationalName, setNationalName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [showAddAccountSection, setShowAddAccountSection] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [accountLongName, setAccountLongName] = useState("");
  const [accountRetailer, setAccountRetailer] = useState("");
  const [accountLocationName, setAccountLocationName] = useState("");
  const [accountAddress, setAccountAddress] = useState("");
  const [accountCity, setAccountCity] = useState("");
  const [accountState, setAccountState] = useState("");
  const [accountZip, setAccountZip] = useState("");
  const [accountCategory, setAccountCategory] = useState("");
  const [accountSuppliers, setAccountSuppliers] = useState("");
  const [accountOfficePhone, setAccountOfficePhone] = useState("");

  const [savedContact, setSavedContact] = useState<SavedPersonRow | null>(null);
  const [savedContactSourceTable, setSavedContactSourceTable] = useState<"contacts" | "kingpins" | null>(
    null,
  );
  const [isSavingPerson, setIsSavingPerson] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const suppressNextAccountSearchRef = useRef(false);

  useEffect(() => {
    const runSearch = async () => {
      if (suppressNextAccountSearchRef.current) {
        suppressNextAccountSearchRef.current = false;
        return;
      }

      const q = normalizeText(accountSearch);

      if (!q || q.length < 2) {
        setAccountMatches([]);
        setIsSearchingAccounts(false);
        return;
      }

      setIsSearchingAccounts(true);

      const { data, error } = await supabase
        .from("accounts")
        .select(
          "id, account_key, long_name, retailer, name, address, city, state, zip, category, suppliers, office_phone, created_at",
        )
        .or(
          [
            `long_name.ilike.%${q}%`,
            `retailer.ilike.%${q}%`,
            `name.ilike.%${q}%`,
            `city.ilike.%${q}%`,
            `state.ilike.%${q}%`,
            `suppliers.ilike.%${q}%`,
          ].join(","),
        )
        .order("long_name", { ascending: true })
        .limit(12);

      if (error) {
        setAccountMatches([]);
        setMessage({ tone: "error", text: `Account search failed. ${error.message}` });
        setIsSearchingAccounts(false);
        return;
      }

      setAccountMatches((data ?? []) as Account[]);
      setIsSearchingAccounts(false);
    };

    void runSearch();
  }, [accountSearch, supabase]);

  useEffect(() => {
    if (!selectedAccount) return;

    setCompanyName(selectedAccount.name || selectedAccount.long_name || "");
    setNationalName(selectedAccount.retailer || "");
    setStateValue(selectedAccount.state || "");
    setSupplier(selectedAccount.suppliers || "");
    setAddress(formatAddress(selectedAccount) || "");
    setOfficePhone((prev) => prev || selectedAccount.office_phone || "");
  }, [selectedAccount]);

  const clearPersonForm = () => {
    setContactType("Contact");
    setPersonName("");
    setTitle("");
    setEmail("");
    setCellPhone("");
    setOfficePhone("");
    setStateValue("");
    setSupplier("");
    setCompanyName("");
    setNationalName("");
    setAddress("");
    setNotes("");
  };

  const clearAccountSelection = () => {
    setSelectedAccount(null);
    setAccountSearch("");
    setAccountMatches([]);
  };

  const clearAccountForm = () => {
    setAccountLongName("");
    setAccountRetailer("");
    setAccountLocationName("");
    setAccountAddress("");
    setAccountCity("");
    setAccountState("");
    setAccountZip("");
    setAccountCategory("");
    setAccountSuppliers("");
    setAccountOfficePhone("");
    setAccountMessage(null);
  };

  const seedAccountFormFromCurrentContext = () => {
    const seededRetailer = accountRetailer || nationalName;
    const seededLocationName = accountLocationName || companyName;
    const seededState = accountState || stateValue;
    const seededSuppliers = accountSuppliers || supplier;
    const seededAddress = accountAddress || address;
    const seededOfficePhone = accountOfficePhone || officePhone;

    setAccountRetailer(seededRetailer);
    setAccountLocationName(seededLocationName);
    setAccountState(seededState);
    setAccountSuppliers(seededSuppliers);
    setAccountAddress(seededAddress);
    setAccountOfficePhone(seededOfficePhone);

    setAccountLongName((prev) => {
      if (prev.trim()) return prev;
      return buildSuggestedLongName(seededRetailer, seededLocationName, seededState, companyName);
    });
  };

  const handleOpenAddAccount = () => {
    seedAccountFormFromCurrentContext();
    setShowAddAccountSection(true);
    setAccountMessage(null);
  };

  const handleSaveAccount = async () => {
    setIsSavingAccount(true);
    setAccountMessage(null);
    setMessage(null);

    const trimmedLongName = accountLongName.trim();
    const trimmedRetailer = accountRetailer.trim();
    const trimmedLocationName = accountLocationName.trim();
    const trimmedAddress = accountAddress.trim();
    const trimmedCity = accountCity.trim();
    const trimmedState = accountState.trim();
    const trimmedZip = accountZip.trim();
    const trimmedCategory = accountCategory.trim();
    const trimmedSuppliers = accountSuppliers.trim();
    const trimmedOfficePhone = accountOfficePhone.trim();

    if (!trimmedRetailer) {
      setAccountMessage({
        tone: "error",
        text: "Retailer is required before saving the account / location.",
      });
      setIsSavingAccount(false);
      return;
    }

    if (!trimmedLocationName && !trimmedLongName) {
      setAccountMessage({
        tone: "error",
        text: "Enter at least a Location Name or Long Name before saving the account / location.",
      });
      setIsSavingAccount(false);
      return;
    }

    if (!trimmedState) {
      setAccountMessage({
        tone: "error",
        text: "State is required before saving the account / location.",
      });
      setIsSavingAccount(false);
      return;
    }

    const resolvedLongName =
      trimmedLongName ||
      buildSuggestedLongName(trimmedRetailer, trimmedLocationName, trimmedState, companyName);

    const payload = {
      account_key: generateAccountKey(),
      long_name: resolvedLongName || null,
      retailer: trimmedRetailer,
      name: trimmedLocationName || null,
      address: trimmedAddress || null,
      city: trimmedCity || null,
      state: trimmedState,
      zip: trimmedZip || null,
      category: trimmedCategory || null,
      suppliers: trimmedSuppliers || null,
      office_phone: trimmedOfficePhone || null,
    };

    const { data, error } = await supabase
      .from("accounts")
      .insert(payload)
      .select(
        "id, account_key, long_name, retailer, name, address, city, state, zip, category, suppliers, office_phone, created_at",
      )
      .single();

    if (error) {
      setAccountMessage({
        tone: "error",
        text: `Could not save account / location. ${error.message}`,
      });
      setIsSavingAccount(false);
      return;
    }

    const newAccount = data as Account;
    const displayName = getAccountDisplayName(newAccount);

    suppressNextAccountSearchRef.current = true;
    setSelectedAccount(newAccount);
    setAccountMatches([newAccount]);
    setAccountSearch(displayName);
    setShowAddAccountSection(false);

    setCompanyName(newAccount.name || newAccount.long_name || "");
    setNationalName(newAccount.retailer || "");
    setStateValue(newAccount.state || "");
    setSupplier(newAccount.suppliers || "");
    setAddress(formatAddress(newAccount) || "");
    setOfficePhone((prev) => prev || newAccount.office_phone || "");

    clearAccountForm();
    setAccountMessage({
      tone: "success",
      text: "Account / location saved and selected successfully.",
    });
    setIsSavingAccount(false);
  };

  const handleSavePerson = async () => {
    setIsSavingPerson(true);
    setMessage(null);

    if (!personName.trim() && !email.trim()) {
      setMessage({
        tone: "error",
        text: "Enter at least a person name or email before saving.",
      });
      setIsSavingPerson(false);
      return;
    }

    const targetTable = getTargetTable(contactType);

    const payload = {
      state: stateValue.trim() || null,
      national_name: nationalName.trim() || null,
      company_name: companyName.trim() || null,
      supplier: supplier.trim() || null,
      corporate_kingpin: personName.trim() || null,
      regional_kingpin: null,
      title: title.trim() || null,
      address: address.trim() || null,
      office_phone: officePhone.trim() || null,
      cell_phone: cellPhone.trim() || null,
      email: email.trim() || null,
      contact_type: contactType,
    };

    const { data, error } = await supabase
      .from(targetTable)
      .insert(payload)
      .select(
        "id, state, national_name, company_name, supplier, corporate_kingpin, regional_kingpin, title, address, office_phone, cell_phone, email, contact_type, created_at",
      )
      .single();

    if (error) {
      setMessage({ tone: "error", text: `${getPersonErrorPrefix(contactType)} ${error.message}` });
      setIsSavingPerson(false);
      return;
    }

    setSavedContact(data as SavedPersonRow);
    setSavedContactSourceTable(targetTable);
    setMessage({ tone: "success", text: getPersonSuccessMessage(contactType) });
    setIsSavingPerson(false);
    clearPersonForm();
  };

  const interactionContact: Contact | null = savedContact
    ? {
        id: savedContact.id,
        account_id: null,
        first_name: null,
        last_name: buildDisplayName(savedContact),
        title: savedContact.title ?? null,
        email: savedContact.email ?? null,
        mobile_phone: savedContact.cell_phone ?? null,
        office_phone: savedContact.office_phone ?? null,
        stage: savedContact.contact_type ?? null,
        notes: notes || savedContact.company_name || null,
        created_at: savedContact.created_at ?? null,
      }
    : null;

  return (
    <HubShell title="Add New Person" subtitle={getPageSubtitle(contactType)}>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Add New Person"
          description="Create a Contact or Kingpin, then link them to an existing account or add a new account / location inline when needed."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-bold text-white">Person Type</label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setContactType("Contact")}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                    contactType === "Contact"
                      ? "border-[#46f0c3] bg-[#12305d] text-[#46f0c3]"
                      : "border-[#496792] bg-[#132b55] text-white hover:border-[#46f0c3]"
                  }`}
                >
                  Contact
                </button>
                <button
                  type="button"
                  onClick={() => setContactType("Kingpin")}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                    contactType === "Kingpin"
                      ? "border-[#46f0c3] bg-[#12305d] text-[#46f0c3]"
                      : "border-[#496792] bg-[#132b55] text-white hover:border-[#46f0c3]"
                  }`}
                >
                  Kingpin
                </button>
              </div>
            </div>

            <Input
              label="Person Name"
              value={personName}
              onChange={setPersonName}
              placeholder="Example Contact"
            />
            <Input
              label="Title"
              value={title}
              onChange={setTitle}
              placeholder="Agronomy Manager"
            />
            <Input
              label="Email"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="name@example.com"
            />
            <Input
              label="Cell Phone"
              value={cellPhone}
              onChange={setCellPhone}
              type="tel"
              placeholder="555-123-4567"
            />
            <Input
              label="Office Phone"
              value={officePhone}
              onChange={setOfficePhone}
              type="tel"
              placeholder="555-987-6543"
            />
            <Input
              label="State"
              value={stateValue}
              onChange={setStateValue}
              placeholder="ST"
            />
          </div>

          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-bold text-white">
              Link / Match Account (Optional)
            </label>
            <input
              value={accountSearch}
              onChange={(event) => setAccountSearch(event.target.value)}
              placeholder="Type retailer, location, city, state, category, or supplier"
              className="w-full rounded-xl border border-[#496792] bg-[#16315f] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#9fb3d6] transition focus:border-[#46f0c3]"
            />
          </div>

          {isSearchingAccounts ? (
            <div className="mt-4">
              <StatusMessage message="Searching accounts..." tone="info" />
            </div>
          ) : null}

          {accountMatches.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {accountMatches.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setSelectedAccount(account)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    selectedAccount?.id === account.id
                      ? "border-[#46f0c3] bg-[#12305d]"
                      : "border-[#496792] bg-[#132b55] hover:border-[#46f0c3]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-white">{getAccountDisplayName(account)}</div>
                    {account.category ? <RecordBadge>{account.category}</RecordBadge> : null}
                  </div>
                  <div className="mt-1 text-sm text-[#d3def5]">{formatAddress(account)}</div>
                  {account.suppliers ? (
                    <div className="mt-1 text-sm text-[#d3def5]">
                      Suppliers: {account.suppliers}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <SecondaryButton onClick={handleOpenAddAccount}>
              Add Account / Location
            </SecondaryButton>
            <SecondaryButton onClick={clearAccountSelection}>
              Clear Account Selection
            </SecondaryButton>
          </div>

          {accountMessage ? (
            <div className="mt-4">
              <StatusMessage message={accountMessage.text} tone={accountMessage.tone} />
            </div>
          ) : null}

          {showAddAccountSection ? (
            <div className="mt-5 rounded-2xl border border-[#46f0c3] bg-[#10284f] p-4">
              <div className="mb-3 text-lg font-bold text-white">Add Account / Location</div>

              <div className="mb-3 text-sm text-[#d3def5]">
                Required fields: Retailer, State, and either Location Name or Long Name.
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Long Name"
                  value={accountLongName}
                  onChange={setAccountLongName}
                  placeholder="NEW Coop - Red Oak, IA"
                />
                <Input
                  label="Retailer *"
                  value={accountRetailer}
                  onChange={setAccountRetailer}
                  placeholder="NEW Coop"
                />
                <Input
                  label="Location Name *"
                  value={accountLocationName}
                  onChange={setAccountLocationName}
                  placeholder="Red Oak"
                />
                <Input
                  label="Category"
                  value={accountCategory}
                  onChange={setAccountCategory}
                  placeholder="Retail Location"
                />
                <Input
                  label="Address"
                  value={accountAddress}
                  onChange={setAccountAddress}
                  placeholder="123 Main Street"
                />
                <Input
                  label="City"
                  value={accountCity}
                  onChange={setAccountCity}
                  placeholder="Red Oak"
                />
                <Input
                  label="State *"
                  value={accountState}
                  onChange={setAccountState}
                  placeholder="IA"
                />
                <Input
                  label="Zip"
                  value={accountZip}
                  onChange={setAccountZip}
                  placeholder="51566"
                />
                <Input
                  label="Suppliers"
                  value={accountSuppliers}
                  onChange={setAccountSuppliers}
                  placeholder="Winfield, Rosen's"
                />
                <Input
                  label="Office Phone"
                  value={accountOfficePhone}
                  onChange={setAccountOfficePhone}
                  type="tel"
                  placeholder="555-222-3333"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <PrimaryButton onClick={handleSaveAccount} disabled={isSavingAccount}>
                  {isSavingAccount ? "Saving Account / Location..." : "Save Account / Location"}
                </PrimaryButton>
                <SecondaryButton
                  onClick={() => {
                    setShowAddAccountSection(false);
                    clearAccountForm();
                  }}
                >
                  Cancel
                </SecondaryButton>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Input
              label="Company Name"
              value={companyName}
              onChange={setCompanyName}
              placeholder="Example Local Account"
            />
            <Input
              label="National Name"
              value={nationalName}
              onChange={setNationalName}
              placeholder="Example National Organization"
            />
            <Input
              label="Supplier"
              value={supplier}
              onChange={setSupplier}
              placeholder="Example Supplier"
            />
            <Input
              label="Address"
              value={address}
              onChange={setAddress}
              placeholder="123 Example Street, Example City, ST 12345"
            />
          </div>

          <div className="mt-4">
            <TextArea
              label="Notes"
              value={notes}
              onChange={setNotes}
              rows={5}
              placeholder="Optional notes about the person, relationship, or account context."
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <PrimaryButton onClick={handleSavePerson} disabled={isSavingPerson}>
              {getSavePersonButtonLabel(contactType, isSavingPerson)}
            </PrimaryButton>
            <SecondaryButton onClick={clearPersonForm}>Clear Person Form</SecondaryButton>
          </div>

          {message ? (
            <div className="mt-4">
              <StatusMessage message={message.text} tone={message.tone} />
            </div>
          ) : null}
        </SectionCard>

        <InteractionPanel
          selectedAccount={selectedAccount}
          selectedContact={interactionContact}
          selectedSourceTable={savedContactSourceTable}
        />
      </div>
    </HubShell>
  );
}