"use client";

import { useMemo, useState } from "react";
import {
  Account,
  HubShell,
  Input,
  PrimaryButton,
  RecordBadge,
  SectionCard,
  SecondaryButton,
  StatusMessage,
  TextArea,
  createClient,
  formatAddress,
  getAccountDisplayName,
} from "@/components/hub-shared";

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
): string {
  const r = retailer.trim();
  const l = locationName.trim();
  const s = stateValue.trim();

  if (r && l && s) return `${r} - ${l}, ${s}`;
  if (r && l) return `${r} - ${l}`;
  if (r && s) return `${r} - ${s}`;
  if (r) return r;
  return "";
}

function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function formatWebsiteDisplay(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "No website entered yet";

  try {
    const parsed = new URL(normalizeWebsite(raw));
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
  }
}

export default function AddAccountPage() {
  const supabase = useMemo(() => createClient(), []);

  const [retailer, setRetailer] = useState("");
  const [locationName, setLocationName] = useState("");
  const [longName, setLongName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [zip, setZip] = useState("");
  const [category, setCategory] = useState("");
  const [suppliers, setSuppliers] = useState("");
  const [officePhone, setOfficePhone] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");

  const [savedAccount, setSavedAccount] = useState<Account | null>(null);
  const [savedWebsite, setSavedWebsite] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const handleAutoFillLongName = () => {
    const suggestion = buildSuggestedLongName(retailer, locationName, stateValue);
    setLongName(suggestion);
  };

  const clearForm = () => {
    setRetailer("");
    setLocationName("");
    setLongName("");
    setAddress("");
    setCity("");
    setStateValue("");
    setZip("");
    setCategory("");
    setSuppliers("");
    setOfficePhone("");
    setWebsite("");
    setNotes("");
    setMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    const trimmedRetailer = retailer.trim();
    const trimmedLocationName = locationName.trim();
    const trimmedLongName = longName.trim();
    const trimmedAddress = address.trim();
    const trimmedCity = city.trim();
    const trimmedState = stateValue.trim();
    const trimmedZip = zip.trim();
    const trimmedCategory = category.trim();
    const trimmedSuppliers = suppliers.trim();
    const trimmedOfficePhone = officePhone.trim();
    const trimmedWebsite = normalizeWebsite(website);
    const trimmedNotes = notes.trim();

    if (!trimmedRetailer) {
      setMessage({
        tone: "error",
        text: "Retailer is required before saving the account / location.",
      });
      setIsSaving(false);
      return;
    }

    if (!trimmedLocationName && !trimmedLongName) {
      setMessage({
        tone: "error",
        text: "Enter at least a Location Name or Long Name before saving the account / location.",
      });
      setIsSaving(false);
      return;
    }

    if (!trimmedState) {
      setMessage({
        tone: "error",
        text: "State is required before saving the account / location.",
      });
      setIsSaving(false);
      return;
    }

    const resolvedLongName =
      trimmedLongName || buildSuggestedLongName(trimmedRetailer, trimmedLocationName, trimmedState);

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
      website: trimmedWebsite || null,
      notes: trimmedNotes || null,
    };

    const { data, error } = await supabase
      .from("accounts")
      .insert(payload)
      .select(
        "id, account_key, long_name, retailer, name, address, city, state, zip, category, suppliers, office_phone, created_at",
      )
      .single();

    if (error) {
      setMessage({
        tone: "error",
        text: `Could not save account / location. ${error.message}`,
      });
      setIsSaving(false);
      return;
    }

    setSavedAccount(data as Account);
    setSavedWebsite(trimmedWebsite);
    setMessage({
      tone: "success",
      text: "Account / location saved successfully.",
    });
    setIsSaving(false);
    clearForm();
  };

  return (
    <HubShell
      title="Add New Account/Location"
      subtitle="Create a new account or retail location when no person is known yet, so it can be targeted and linked later."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Add New Account / Location"
          description="Create an account-first record for a retail location, branch, or business unit before any contact is identified."
        >
          <div className="mb-3 text-sm text-slate-300">
            Required fields: Retailer, State, and either Location Name or Long Name.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Retailer *"
              value={retailer}
              onChange={setRetailer}
              placeholder="NEW Coop"
            />
            <Input
              label="Location Name *"
              value={locationName}
              onChange={setLocationName}
              placeholder="Red Oak"
            />

            <Input
              label="Long Name"
              value={longName}
              onChange={setLongName}
              placeholder="NEW Coop - Red Oak, IA"
            />
            <div className="flex items-end">
              <SecondaryButton onClick={handleAutoFillLongName}>
                Build Suggested Long Name
              </SecondaryButton>
            </div>

            <Input
              label="Address"
              value={address}
              onChange={setAddress}
              placeholder="123 Main Street"
            />
            <Input
              label="City"
              value={city}
              onChange={setCity}
              placeholder="Red Oak"
            />

            <Input
              label="State *"
              value={stateValue}
              onChange={setStateValue}
              placeholder="IA"
            />
            <Input
              label="Zip"
              value={zip}
              onChange={setZip}
              placeholder="51566"
            />

            <Input
              label="Category"
              value={category}
              onChange={setCategory}
              placeholder="Retail Location"
            />
            <Input
              label="Suppliers"
              value={suppliers}
              onChange={setSuppliers}
              placeholder="Winfield, Rosen's"
            />

            <Input
              label="Office Phone"
              value={officePhone}
              onChange={setOfficePhone}
              type="tel"
              placeholder="555-222-3333"
            />
            <Input
              label="Website"
              value={website}
              onChange={setWebsite}
              placeholder="www.example.com"
            />
          </div>

          <div className="mt-4">
            <TextArea
              label="Notes"
              value={notes}
              onChange={setNotes}
              rows={5}
              placeholder="Optional notes about the account, territory context, account size, branch details, or follow-up needs."
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <PrimaryButton onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving Account / Location..." : "Save Account / Location"}
            </PrimaryButton>
            <SecondaryButton onClick={clearForm}>Clear Form</SecondaryButton>
          </div>

          {message ? (
            <div className="mt-4">
              <StatusMessage message={message.text} tone={message.tone} />
            </div>
          ) : null}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Account Preview"
            description="Review the account-first record you are creating before saving."
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-[#496792] bg-[#132b55] p-3">
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#a8bddf]">
                  Retailer
                </div>
                <div className="mt-1 font-bold text-white">
                  {retailer || "No retailer entered yet"}
                </div>
              </div>

              <div className="rounded-2xl border border-[#496792] bg-[#132b55] p-3">
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#a8bddf]">
                  Location
                </div>
                <div className="mt-1 font-bold text-white">
                  {locationName || "No location name entered yet"}
                </div>
              </div>

              <div className="rounded-2xl border border-[#496792] bg-[#132b55] p-3">
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#a8bddf]">
                  Long Name
                </div>
                <div className="mt-1 font-bold text-white">
                  {longName ||
                    buildSuggestedLongName(retailer, locationName, stateValue) ||
                    "No long name entered yet"}
                </div>
              </div>

              <div className="rounded-2xl border border-[#496792] bg-[#132b55] p-3">
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#a8bddf]">
                  Address
                </div>
                <div className="mt-1 text-sm text-[#d3def5]">
                  {[address, city, stateValue, zip].filter(Boolean).join(", ") ||
                    "No address entered yet"}
                </div>
              </div>

              <div className="rounded-2xl border border-[#496792] bg-[#132b55] p-3">
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#a8bddf]">
                  Category / Suppliers
                </div>
                <div className="mt-1 text-sm text-[#d3def5]">
                  {[category, suppliers].filter(Boolean).join(" · ") ||
                    "No category or supplier entered yet"}
                </div>
              </div>

              <div className="rounded-2xl border border-[#496792] bg-[#132b55] p-3">
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#a8bddf]">
                  Website
                </div>
                <div className="mt-1 text-sm text-[#d3def5]">
                  {formatWebsiteDisplay(website)}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Last Saved Account"
            description="Confirm what was created most recently."
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-[#496792] bg-[#132b55] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-bold text-white">
                    {savedAccount ? getAccountDisplayName(savedAccount) : "No account saved yet"}
                  </div>
                  {savedAccount?.category ? <RecordBadge>{savedAccount.category}</RecordBadge> : null}
                </div>

                <div className="mt-2 text-sm text-[#d3def5]">
                  {savedAccount ? formatAddress(savedAccount) : "No saved address yet"}
                </div>

                {savedAccount?.suppliers ? (
                  <div className="mt-1 text-sm text-[#d3def5]">
                    Suppliers: {savedAccount.suppliers}
                  </div>
                ) : null}

                {savedWebsite ? (
                  <div className="mt-1 text-sm text-[#d3def5]">
                    Website: {savedWebsite}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-[#496792] bg-[#132b55] p-3">
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#a8bddf]">
                  Next Step
                </div>
                <div className="mt-1 text-sm text-[#d3def5]">
                  Once an account exists, you can later add a person and link them to this location,
                  or review the account in the dashboard.
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </HubShell>
  );
}