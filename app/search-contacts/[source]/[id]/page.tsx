"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  AddressValueLink,
  ContactValueLink,
  HubShell,
} from "@/components/hub-shared";

type SourceType = "people" | "contacts" | "kingpins";

type PersonRecord = {
  id: string;
  account_id?: string | null;
  full_name?: string | null;
  national_name?: string | null;
  person_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  supplier?: string | null;
  title?: string | null;
  email?: string | null;
  office_phone?: string | null;
  cell_phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  corporate_kingpin?: string | null;
  regional_kingpin?: string | null;
  contact_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type LegacyRecord = {
  id: string;
  full_name?: string | null;
  national_name?: string | null;
  person_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  supplier?: string | null;
  corporate_kingpin?: string | null;
  regional_kingpin?: string | null;
  title?: string | null;
  address?: string | null;
  office_phone?: string | null;
  cell_phone?: string | null;
  email?: string | null;
  contact_type?: string | null;
  state?: string | null;
};

type InteractionRecord = {
  id: string;
  person_id?: string | null;
  contact_id?: string | null;
  account_id?: string | null;
  date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  type?: string | null;
  stage?: string[] | string | null;
  summary?: string | null;
  details?: string | null;
  outcome?: string | null;
};

type AccountRecord = {
  id: string;
  name?: string | null;
  long_name?: string | null;
  retailer?: string | null;
  national_name?: string | null;
  company_name?: string | null;
  suppliers?: string | null;
  website?: string | null;
  category?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  zip?: string | null;
};

type DisplayProfile = {
  id: string;
  source: SourceType;
  name: string;
  company: string;
  title: string;
  email: string;
  mobile: string;
  officePhone: string;
  supplier: string;
  recordType: string;
};

type StageKey =
  | "introduction"
  | "technical_training"
  | "field_evaluation"
  | "adoption";

type StageInteractionPoint = {
  interaction: InteractionRecord;
  stage: StageKey;
  positionPercent: number;
  stackIndex: number;
};

type EditProfileForm = {
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  email: string;
  mobile: string;
  officePhone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  recordType: string;
};

type ResolvedAccountContext = {
  mainAccount: AccountRecord | null;
  totalLocations: number | null;
  website: string;
  supplier: string;
  profile: DisplayProfile;
};

const STAGE_ORDER: StageKey[] = [
  "introduction",
  "technical_training",
  "field_evaluation",
  "adoption",
];

const STAGE_LABELS: Record<StageKey, string> = {
  introduction: "Intro / Touch Base",
  technical_training: "Technical Training",
  field_evaluation: "Field Evaluation",
  adoption: "Adoption",
};

const STAGE_OPTIONS = ["all", ...STAGE_ORDER] as const;
const EDITABLE_RECORD_TYPES = ["Person", "Contact", "Kingpin"] as const;

function normalizeSource(value: string | string[] | undefined): SourceType {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "people" || raw === "contacts" || raw === "kingpins") {
    return raw;
  }
  return "people";
}

function cleanText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join(" ");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}

function normalizeWhitespace(value: string | null | undefined): string {
  return cleanText(value).replace(/\s+/g, " ");
}

function normalizeComparable(value: string | null | undefined): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[.,/&()-]+/g, " ")
    .replace(/\b(coop|cooperative|llc|inc|corp|corporation|company|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter(Boolean),
    ),
  );
}

function joinedName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  return normalizeWhitespace(`${cleanText(firstName)} ${cleanText(lastName)}`);
}

function fallbackNameFromEmail(email: string | null | undefined): string {
  const raw = cleanText(email);
  if (!raw.includes("@")) return "";

  const localPart = raw.split("@")[0] ?? "";
  if (!localPart) return "";

  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();
}

function splitDisplayName(name: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const cleaned = normalizeWhitespace(name);
  if (!cleaned) {
    return { firstName: "", lastName: "" };
  }

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0] ?? "", lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" "),
  };
}

function displayNameFromPerson(person: Partial<PersonRecord> | null | undefined): string {
  if (!person) return "";

  return (
    normalizeWhitespace(person.full_name) ||
    normalizeWhitespace(person.national_name) ||
    normalizeWhitespace(person.person_name) ||
    joinedName(person.first_name, person.last_name) ||
    fallbackNameFromEmail(person.email)
  );
}

function displayNameFromLegacy(record: Partial<LegacyRecord> | null | undefined): string {
  if (!record) return "";

  return (
    normalizeWhitespace(record.full_name) ||
    normalizeWhitespace(record.national_name) ||
    normalizeWhitespace(record.person_name) ||
    joinedName(record.first_name, record.last_name) ||
    fallbackNameFromEmail(record.email)
  );
}

function getRecordType(
  person: Partial<PersonRecord> | null | undefined,
  legacy: Partial<LegacyRecord> | null | undefined,
): string {
  const raw = cleanText(person?.contact_type) || cleanText(legacy?.contact_type);

  if (!raw) return "Person";
  if (raw.toLowerCase() === "kingpin") return "Kingpin";
  if (raw.toLowerCase() === "contact") return "Contact";

  return raw;
}

function mapRecordTypeToDbValue(recordType: string): string {
  const normalized = cleanText(recordType).toLowerCase();

  if (normalized === "kingpin") return "kingpin";
  if (normalized === "contact") return "contact";

  return "person";
}

function toDisplayProfile(
  source: SourceType,
  person: PersonRecord | null,
  legacy: LegacyRecord | null,
): DisplayProfile {
  return {
    id: person?.id || legacy?.id || "",
    source,
    name: displayNameFromPerson(person) || displayNameFromLegacy(legacy) || "Unnamed Person",
    company: cleanText(person?.company_name) || cleanText(legacy?.company_name),
    title: cleanText(person?.title) || cleanText(legacy?.title),
    email: cleanText(person?.email) || cleanText(legacy?.email),
    mobile: cleanText(person?.cell_phone) || cleanText(legacy?.cell_phone),
    officePhone: cleanText(person?.office_phone) || cleanText(legacy?.office_phone),
    supplier: cleanText(person?.supplier) || cleanText(legacy?.supplier),
    recordType: getRecordType(person, legacy),
  };
}

function buildEditForm(
  person: PersonRecord | null,
  legacy: LegacyRecord | null,
  profile: DisplayProfile | null,
): EditProfileForm {
  const fallbackName =
    displayNameFromPerson(person) || displayNameFromLegacy(legacy) || profile?.name || "";
  const splitName = splitDisplayName(fallbackName);

  return {
    firstName: cleanText(person?.first_name) || cleanText(legacy?.first_name) || splitName.firstName,
    lastName: cleanText(person?.last_name) || cleanText(legacy?.last_name) || splitName.lastName,
    company: cleanText(person?.company_name) || cleanText(legacy?.company_name) || "",
    title: cleanText(person?.title) || cleanText(legacy?.title) || "",
    email: cleanText(person?.email) || cleanText(legacy?.email) || "",
    mobile: cleanText(person?.cell_phone) || cleanText(legacy?.cell_phone) || "",
    officePhone: cleanText(person?.office_phone) || cleanText(legacy?.office_phone) || "",
    address: cleanText(person?.address) || cleanText(legacy?.address) || "",
    city: cleanText(person?.city) || "",
    state: cleanText(person?.state) || cleanText(legacy?.state) || "",
    zip: cleanText(person?.zip) || "",
    recordType: profile?.recordType || getRecordType(person, legacy),
  };
}

function normalizeStageKey(value: unknown): StageKey | null {
  const raw = cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/\//g, "_");

  if (
    raw === "introduction" ||
    raw === "intro" ||
    raw === "touch_base" ||
    raw === "intro_touch_base" ||
    raw === "intro_touch"
  ) {
    return "introduction";
  }

  if (
    raw === "technical_training" ||
    raw === "technical" ||
    raw === "training" ||
    raw === "education"
  ) {
    return "technical_training";
  }

  if (
    raw === "field_evaluation" ||
    raw === "field" ||
    raw === "evaluation" ||
    raw === "trial" ||
    raw === "field_trial"
  ) {
    return "field_evaluation";
  }

  if (raw === "adoption" || raw === "adopted") {
    return "adoption";
  }

  return null;
}

function normalizeStage(value: string[] | string | null | undefined): StageKey[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => normalizeStageKey(item))
          .filter((item): item is StageKey => item !== null),
      ),
    );
  }

  const single = normalizeStageKey(value);
  return single ? [single] : [];
}

function getPrimaryStage(stages: StageKey[]): StageKey | null {
  if (stages.length === 0) return null;

  const sorted = [...stages].sort(
    (a, b) => STAGE_ORDER.indexOf(b) - STAGE_ORDER.indexOf(a),
  );

  return sorted[0] ?? null;
}

function formatStage(value: string[] | string | null | undefined): string {
  const stages = normalizeStage(value);
  if (stages.length > 0) {
    return stages.map((stage) => STAGE_LABELS[stage]).join(" • ");
  }

  const raw = cleanText(value);
  if (!raw) return "";

  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatInteractionType(value: string | null | undefined): string {
  const raw = cleanText(value);
  if (!raw) return "Unknown";

  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDate(value: string | null | undefined): string {
  const raw = cleanText(value);
  if (!raw) return "No date";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getInteractionDate(row: InteractionRecord): Date | null {
  const raw = row.date || row.created_at || row.updated_at || "";
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getInteractionTimestamp(row: InteractionRecord): number {
  const date = getInteractionDate(row);
  return date ? date.getTime() : 0;
}

function uniqueSortedInteractions(rows: InteractionRecord[]): InteractionRecord[] {
  const map = new Map<string, InteractionRecord>();

  for (const row of rows) {
    if (!row?.id) continue;
    if (!map.has(row.id)) {
      map.set(row.id, row);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => getInteractionTimestamp(b) - getInteractionTimestamp(a),
  );
}

function matchesStage(stageFilter: string, row: InteractionRecord): boolean {
  if (stageFilter === "all") return true;

  const stages = normalizeStage(row.stage);
  return stages.includes(stageFilter as StageKey);
}

function matchesType(typeFilter: string, row: InteractionRecord): boolean {
  if (typeFilter === "all") return true;
  return cleanText(row.type).toLowerCase() === typeFilter.toLowerCase();
}

function matchesText(textFilter: string, row: InteractionRecord): boolean {
  const query = textFilter.trim().toLowerCase();
  if (!query) return true;

  const haystack = [
    row.summary,
    row.details,
    row.outcome,
    row.type,
    formatStage(row.stage),
  ]
    .map((value) => cleanText(value).toLowerCase())
    .join(" ");

  return haystack.includes(query);
}

function getStageCounts(interactions: InteractionRecord[]): Record<StageKey, number> {
  const counts: Record<StageKey, number> = {
    introduction: 0,
    technical_training: 0,
    field_evaluation: 0,
    adoption: 0,
  };

  for (const interaction of interactions) {
    const stages = normalizeStage(interaction.stage);
    stages.forEach((stage) => {
      counts[stage] += 1;
    });
  }

  return counts;
}

function getHighestReachedStage(interactions: InteractionRecord[]): StageKey | null {
  const reached = new Set<StageKey>();

  for (const interaction of interactions) {
    normalizeStage(interaction.stage).forEach((stage) => reached.add(stage));
  }

  for (let index = STAGE_ORDER.length - 1; index >= 0; index -= 1) {
    const stage = STAGE_ORDER[index];
    if (reached.has(stage)) return stage;
  }

  return null;
}

function getLatestKnownStage(interactions: InteractionRecord[]): StageKey | null {
  for (const interaction of interactions) {
    const stages = normalizeStage(interaction.stage);
    const primaryStage = getPrimaryStage(stages);
    if (primaryStage) return primaryStage;
  }

  return null;
}

function getLatestInteractionType(interactions: InteractionRecord[]): string {
  const latest = interactions[0];
  if (!latest) return "—";
  return formatInteractionType(latest.type);
}

function getLastInteractionDate(interactions: InteractionRecord[]): string {
  const latest = interactions[0];
  if (!latest) return "—";
  return formatDate(latest.date || latest.created_at || latest.updated_at);
}

function getStageCardClasses(stage: StageKey, counts: Record<StageKey, number>): string {
  const isActive = counts[stage] > 0;

  if (!isActive) {
    return "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }

  if (stage === "introduction") {
    return "border-blue-300 bg-blue-500 text-white dark:border-blue-500/60 dark:bg-blue-600 dark:text-white";
  }

  if (stage === "technical_training") {
    return "border-red-300 bg-red-500 text-white dark:border-red-500/60 dark:bg-red-600 dark:text-white";
  }

  if (stage === "field_evaluation") {
    return "border-yellow-300 bg-yellow-400 text-slate-900 dark:border-yellow-400/60 dark:bg-yellow-400 dark:text-slate-950";
  }

  return "border-green-300 bg-green-500 text-white dark:border-green-500/60 dark:bg-green-600 dark:text-white";
}

function getStageDotClasses(stage: StageKey): string {
  if (stage === "introduction") {
    return "border-blue-300 bg-blue-500 dark:border-blue-400 dark:bg-blue-500";
  }
  if (stage === "technical_training") {
    return "border-red-300 bg-red-500 dark:border-red-400 dark:bg-red-500";
  }
  if (stage === "field_evaluation") {
    return "border-yellow-300 bg-yellow-400 dark:border-yellow-300 dark:bg-yellow-400";
  }
  return "border-green-300 bg-green-500 dark:border-green-400 dark:bg-green-500";
}

function getStageProgressStatus(
  stage: StageKey,
  highestReachedStage: StageKey | null,
): "reached" | "current" | "upcoming" {
  if (!highestReachedStage) return "upcoming";

  const currentIndex = STAGE_ORDER.indexOf(highestReachedStage);
  const stageIndex = STAGE_ORDER.indexOf(stage);

  if (stageIndex < currentIndex) return "reached";
  if (stageIndex === currentIndex) return "current";
  return "upcoming";
}

function getStageInteractionPoints(interactions: InteractionRecord[]): StageInteractionPoint[] {
  const buckets: Record<StageKey, InteractionRecord[]> = {
    introduction: [],
    technical_training: [],
    field_evaluation: [],
    adoption: [],
  };

  for (const interaction of [...interactions].sort(
    (a, b) => getInteractionTimestamp(a) - getInteractionTimestamp(b),
  )) {
    const primaryStage = getPrimaryStage(normalizeStage(interaction.stage));
    if (!primaryStage) continue;
    buckets[primaryStage].push(interaction);
  }

  const points: StageInteractionPoint[] = [];

  STAGE_ORDER.forEach((stage) => {
    const stageInteractions = buckets[stage];
    const total = stageInteractions.length;

    stageInteractions.forEach((interaction, index) => {
      const rawPosition = total === 1 ? 0.5 : index / (total - 1);
      const paddedPosition = 0.14 + rawPosition * 0.72;

      points.push({
        interaction,
        stage,
        positionPercent: paddedPosition * 100,
        stackIndex: 0,
      });
    });
  });

  return points;
}

function cleanImportedInteractionDetails(
  details: string | null | undefined,
  profile: DisplayProfile | null,
): string {
  let text = cleanText(details);
  if (!text) return "";

  text = text.replace(/\uFFFD/g, "'");
  text = text.replace(/\s+/g, " ").trim();

  const removableLabeledBlocks = [
    "Company",
    "Title",
    "Address",
    "Office Phone",
    "Cell Phone",
    "Email",
    "State",
    "City",
    "ZIP",
    "Zip",
  ];

  removableLabeledBlocks.forEach((label) => {
    const pattern = new RegExp(
      `---\\s*${label}\\s*---[\\s\\S]*?(?=(---\\s*[A-Za-z /]+\\s*---)|$)`,
      "gi",
    );
    text = text.replace(pattern, " ");
  });

  if (profile) {
    const profileValues = [
      profile.name,
      profile.company,
      profile.title,
      profile.email,
      profile.mobile,
      profile.officePhone,
    ]
      .map((value) => cleanText(value))
      .filter(Boolean);

    profileValues.forEach((value) => {
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(new RegExp(escaped, "gi"), "");
    });
  }

  text = text.replace(/---\s*Details\s*---/gi, "");
  text = text.replace(/\s{2,}/g, " ");
  text = text.replace(/\s+([,.;:])/g, "$1");
  text = text.replace(/(^[-–—:\s]+|[-–—:\s]+$)/g, "").trim();

  return text;
}

function getAccountDisplayName(account: AccountRecord | null): string {
  if (!account) return "—";

  return (
    cleanText(account.long_name) ||
    cleanText(account.name) ||
    cleanText(account.company_name) ||
    cleanText(account.national_name) ||
    cleanText(account.retailer) ||
    "—"
  );
}

function getAccountCandidateNames(
  person: PersonRecord | null,
  legacy: LegacyRecord | null,
  profile: DisplayProfile | null,
): string[] {
  return uniqueNonEmpty([
    person?.company_name,
    person?.national_name,
    legacy?.company_name,
    legacy?.national_name,
    profile?.company,
  ]);
}

function scoreAccountMatch(account: AccountRecord, candidateNames: string[]): number {
  const accountValues = [
    account.long_name,
    account.name,
    account.company_name,
    account.national_name,
    account.retailer,
  ].map((value) => normalizeComparable(value));

  let bestScore = 0;

  candidateNames.forEach((candidate) => {
    const normalizedCandidate = normalizeComparable(candidate);
    if (!normalizedCandidate) return;

    accountValues.forEach((accountValue) => {
      if (!accountValue) return;

      if (accountValue === normalizedCandidate) {
        bestScore = Math.max(bestScore, 100);
        return;
      }

      if (accountValue.includes(normalizedCandidate) || normalizedCandidate.includes(accountValue)) {
        bestScore = Math.max(bestScore, 75);
        return;
      }

      const candidateWords = normalizedCandidate.split(" ").filter(Boolean);
      const matchedWords = candidateWords.filter((word) => accountValue.includes(word)).length;

      if (matchedWords > 0) {
        const wordScore = Math.round((matchedWords / candidateWords.length) * 50);
        bestScore = Math.max(bestScore, wordScore);
      }
    });
  });

  return bestScore;
}

async function fetchBestAccountByCandidates(
  supabase: ReturnType<typeof createClient>,
  candidateNames: string[],
): Promise<AccountRecord | null> {
  const aggregated = new Map<string, AccountRecord>();

  for (const candidate of candidateNames) {
    const cleanedCandidate = cleanText(candidate);
    if (!cleanedCandidate) continue;

    for (const field of ["long_name", "name", "company_name", "national_name", "retailer"] as const) {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .ilike(field, `%${cleanedCandidate}%`)
        .limit(20);

      if (error) {
        continue;
      }

      (data as AccountRecord[] | null | undefined)?.forEach((account) => {
        if (account?.id) {
          aggregated.set(account.id, account);
        }
      });
    }
  }

  const candidates = Array.from(aggregated.values());
  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((account) => ({
      account,
      score: scoreAccountMatch(account, candidateNames),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score <= 0) return null;

  return best.account;
}

async function fetchLocationCountForAccountGroup(
  supabase: ReturnType<typeof createClient>,
  account: AccountRecord | null,
): Promise<number | null> {
  if (!account) return null;

  const groupingStrategies: Array<{
    field: keyof AccountRecord;
    value: string;
  }> = [];

  const retailer = cleanText(account.retailer);
  const nationalName = cleanText(account.national_name);
  const longName = cleanText(account.long_name);
  const companyName = cleanText(account.company_name);
  const name = cleanText(account.name);

  if (retailer) groupingStrategies.push({ field: "retailer", value: retailer });
  if (nationalName) groupingStrategies.push({ field: "national_name", value: nationalName });
  if (longName) groupingStrategies.push({ field: "long_name", value: longName });
  if (companyName) groupingStrategies.push({ field: "company_name", value: companyName });
  if (name) groupingStrategies.push({ field: "name", value: name });

  for (const strategy of groupingStrategies) {
    const { count, error } = await supabase
      .from("accounts")
      .select("*", { count: "exact", head: true })
      .ilike(strategy.field, strategy.value);

    if (!error && typeof count === "number" && count > 0) {
      return count;
    }
  }

  return 1;
}

async function fetchFallbackWebsiteForAccountGroup(
  supabase: ReturnType<typeof createClient>,
  account: AccountRecord | null,
): Promise<string> {
  if (!account) return "";

  const candidateValues = uniqueNonEmpty([
    account.retailer,
    account.long_name,
    account.company_name,
    account.national_name,
    account.name,
  ]);

  const aggregated = new Map<string, string>();

  for (const candidate of candidateValues) {
    for (const field of ["retailer", "long_name", "company_name", "national_name", "name"] as const) {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, website")
        .ilike(field, `%${candidate}%`)
        .limit(50);

      if (error) continue;

      const rows =
        (data as Array<{ id?: string; website?: string | null }> | null | undefined) ?? [];
      for (const row of rows) {
        const website = cleanText(row.website);
        const rowId = cleanText(row.id);
        if (rowId && website) {
          aggregated.set(rowId, website);
        }
      }
    }
  }

  for (const website of aggregated.values()) {
    if (website) return website;
  }

  return "";
}

function resolveSupplier(
  account: AccountRecord | null,
  person: PersonRecord | null,
  legacy: LegacyRecord | null,
): string {
  return (
    cleanText(account?.suppliers) ||
    cleanText(person?.supplier) ||
    cleanText(legacy?.supplier) ||
    ""
  );
}

function normalizeWebsiteForHref(value: string | null | undefined): string {
  const raw = cleanText(value);
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `https://${raw}`;
}

function formatWebsiteDisplay(value: string | null | undefined): string {
  const href = normalizeWebsiteForHref(value);
  if (!href) return "";

  try {
    const parsed = new URL(href);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return cleanText(value)
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "");
  }
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (typeof err === "object" && err !== null) {
    const maybeMessage = "message" in err ? err.message : null;
    const maybeDetails = "details" in err ? err.details : null;
    const maybeHint = "hint" in err ? err.hint : null;
    const maybeCode = "code" in err ? err.code : null;

    const parts = [maybeMessage, maybeDetails, maybeHint, maybeCode]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => String(value).trim());

    if (parts.length > 0) {
      return parts.join(" | ");
    }

    try {
      return JSON.stringify(err);
    } catch {
      return "An unexpected error occurred while loading the profile.";
    }
  }

  return "An unexpected error occurred while loading the profile.";
}

async function fetchLegacyMatchesByEmail(
  supabase: ReturnType<typeof createClient>,
  table: "contacts" | "kingpins",
  email: string,
): Promise<LegacyRecord[]> {
  const normalized = cleanText(email);
  if (!normalized) return [];

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .ilike("email", normalized);

  if (error) throw error;
  return (data as LegacyRecord[]) ?? [];
}

async function fetchInteractionsByIds(
  supabase: ReturnType<typeof createClient>,
  key: "person_id" | "contact_id",
  ids: string[],
): Promise<InteractionRecord[]> {
  const validIds = Array.from(new Set(ids.filter(Boolean)));
  if (validIds.length === 0) return [];

  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .in(key, validIds);

  if (error) throw error;

  return (data as InteractionRecord[]) ?? [];
}

async function resolveAccountContext(
  supabase: ReturnType<typeof createClient>,
  source: SourceType,
  person: PersonRecord | null,
  legacy: LegacyRecord | null,
): Promise<ResolvedAccountContext> {
  const provisionalProfile = toDisplayProfile(source, person, legacy);

  let resolvedMainAccount: AccountRecord | null = null;
  let resolvedLocationCount: number | null = null;

  if (person?.account_id) {
    const { data: accountData, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", person.account_id)
      .maybeSingle();

    if (!accountError && accountData) {
      resolvedMainAccount = accountData as AccountRecord;
    }
  }

  if (!resolvedMainAccount) {
    const candidateNames = getAccountCandidateNames(person, legacy, provisionalProfile);

    resolvedMainAccount = await fetchBestAccountByCandidates(
      supabase,
      candidateNames,
    );
  }

  resolvedLocationCount = await fetchLocationCountForAccountGroup(
    supabase,
    resolvedMainAccount,
  );

  const resolvedSupplier = resolveSupplier(
    resolvedMainAccount,
    person,
    legacy,
  );

  const displayProfile: DisplayProfile = {
    ...provisionalProfile,
    supplier: resolvedSupplier,
  };

  const primaryWebsite = cleanText(resolvedMainAccount?.website);
  const siblingWebsite = primaryWebsite
    ? ""
    : await fetchFallbackWebsiteForAccountGroup(supabase, resolvedMainAccount);
  const finalWebsite = primaryWebsite || siblingWebsite;

  return {
    mainAccount: resolvedMainAccount,
    totalLocations: resolvedLocationCount,
    website: finalWebsite,
    supplier: resolvedSupplier,
    profile: displayProfile,
  };
}

export default function ProfilePage() {
  const params = useParams<{ source: string; id: string }>();
  const source = normalizeSource(params?.source);
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DisplayProfile | null>(null);
  const [personRecord, setPersonRecord] = useState<PersonRecord | null>(null);
  const [legacyRecord, setLegacyRecord] = useState<LegacyRecord | null>(null);
  const [mainAccount, setMainAccount] = useState<AccountRecord | null>(null);
  const [resolvedWebsite, setResolvedWebsite] = useState<string>("");
  const [totalLocations, setTotalLocations] = useState<number | null>(null);
  const [interactions, setInteractions] = useState<InteractionRecord[]>([]);
  const [error, setError] = useState("");

  const [stageFilter, setStageFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [textFilter, setTextFilter] = useState<string>("");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState("");
  const [profileSaveSuccess, setProfileSaveSuccess] = useState("");
  const [editForm, setEditForm] = useState<EditProfileForm>({
    firstName: "",
    lastName: "",
    company: "",
    title: "",
    email: "",
    mobile: "",
    officePhone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    recordType: "Person",
  });

  useEffect(() => {
    let isActive = true;

    async function loadPage() {
      if (!id) {
        if (isActive) {
          setError("Missing profile ID.");
          setLoading(false);
        }
        return;
      }

      if (isActive) {
        setLoading(true);
        setError("");
      }

      try {
        let resolvedPerson: PersonRecord | null = null;
        let resolvedLegacy: LegacyRecord | null = null;

        if (source === "people") {
          const { data, error: personError } = await supabase
            .from("people")
            .select("*")
            .eq("id", id)
            .maybeSingle();

          if (personError) throw personError;
          resolvedPerson = (data as PersonRecord | null) ?? null;
        } else {
          const { data, error: legacyError } = await supabase
            .from(source)
            .select("*")
            .eq("id", id)
            .maybeSingle();

          if (legacyError) throw legacyError;
          resolvedLegacy = (data as LegacyRecord | null) ?? null;
        }

        const legacyEmail = cleanText(resolvedLegacy?.email);

        if (!resolvedPerson && source !== "people" && legacyEmail) {
          const { data: personByEmail, error: personByEmailError } = await supabase
            .from("people")
            .select("*")
            .ilike("email", legacyEmail)
            .maybeSingle();

          if (personByEmailError && personByEmailError.code !== "PGRST116") {
            throw personByEmailError;
          }

          if (personByEmail) {
            resolvedPerson = personByEmail as PersonRecord;
          }
        }

        const allMatchedContacts = new Map<string, LegacyRecord>();

        if (source === "contacts" && resolvedLegacy?.id) {
          allMatchedContacts.set(resolvedLegacy.id, resolvedLegacy);
        }

        const personEmail = cleanText(resolvedPerson?.email) || legacyEmail;

        if (personEmail) {
          const contactMatchesByEmail = await fetchLegacyMatchesByEmail(
            supabase,
            "contacts",
            personEmail,
          );

          for (const record of contactMatchesByEmail) {
            if (record?.id) {
              allMatchedContacts.set(record.id, record);
            }
          }
        }

        const personIds = resolvedPerson?.id ? [resolvedPerson.id] : [];
        const contactIds = Array.from(allMatchedContacts.keys());

        const [personInteractions, contactInteractions] = await Promise.all([
          fetchInteractionsByIds(supabase, "person_id", personIds),
          fetchInteractionsByIds(supabase, "contact_id", contactIds),
        ]);

        const mergedInteractions = uniqueSortedInteractions([
          ...personInteractions,
          ...contactInteractions,
        ]);

        const accountContext = await resolveAccountContext(
          supabase,
          source,
          resolvedPerson,
          resolvedLegacy,
        );

        if (!isActive) return;

        setPersonRecord(resolvedPerson);
        setLegacyRecord(resolvedLegacy);
        setMainAccount(accountContext.mainAccount);
        setResolvedWebsite(accountContext.website);
        setTotalLocations(accountContext.totalLocations);
        setProfile(accountContext.profile);
        setInteractions(mergedInteractions);
        setExpandedIds([]);
        setLoading(false);
      } catch (err) {
        const message = extractErrorMessage(err);

        if (!isActive) return;

        setError(message);
        setLoading(false);
      }
    }

    void loadPage();

    return () => {
      isActive = false;
    };
  }, [id, source, supabase]);

  useEffect(() => {
    if (!profile) return;
    setEditForm(buildEditForm(personRecord, legacyRecord, profile));
  }, [personRecord, legacyRecord, profile]);

  const availableTypes = useMemo(() => {
    const types = Array.from(
      new Set(
        interactions
          .map((row) => cleanText(row.type))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b)),
      ),
    );

    return ["all", ...types];
  }, [interactions]);

  const filteredInteractions = useMemo(() => {
    return interactions.filter((row) => {
      return (
        matchesStage(stageFilter, row) &&
        matchesType(typeFilter, row) &&
        matchesText(textFilter, row)
      );
    });
  }, [interactions, stageFilter, typeFilter, textFilter]);

  const stageCounts = useMemo(() => getStageCounts(interactions), [interactions]);
  const highestReachedStage = useMemo(() => getHighestReachedStage(interactions), [interactions]);
  const latestKnownStage = useMemo(() => getLatestKnownStage(interactions), [interactions]);
  const stagePoints = useMemo(
    () => getStageInteractionPoints(filteredInteractions),
    [filteredInteractions],
  );

  const websiteHref = normalizeWebsiteForHref(resolvedWebsite);
  const websiteDisplay = formatWebsiteDisplay(resolvedWebsite);
  const showWebsiteCard = Boolean(websiteHref);

  const resolvedAddress = useMemo(() => {
    const addressParts = [
      cleanText(personRecord?.address) || cleanText(legacyRecord?.address),
      cleanText(personRecord?.city),
      cleanText(personRecord?.state) || cleanText(legacyRecord?.state),
      cleanText(personRecord?.zip),
    ].filter(Boolean);

    return addressParts.join(", ");
  }, [personRecord, legacyRecord]);

  const editResolvedAddress = useMemo(() => {
    const addressParts = [
      cleanText(editForm.address),
      cleanText(editForm.city),
      cleanText(editForm.state),
      cleanText(editForm.zip),
    ].filter(Boolean);

    return addressParts.join(", ");
  }, [editForm.address, editForm.city, editForm.state, editForm.zip]);

  const toggleExpanded = (interactionId: string) => {
    setExpandedIds((current) =>
      current.includes(interactionId)
        ? current.filter((idValue) => idValue !== interactionId)
        : [...current, interactionId],
    );
  };

  const updateEditField = (field: keyof EditProfileForm, value: string) => {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleEditProfile = () => {
    setProfileSaveError("");
    setProfileSaveSuccess("");
    setEditForm(buildEditForm(personRecord, legacyRecord, profile));
    setIsEditingProfile(true);
  };

  const handleCancelEdit = () => {
    setProfileSaveError("");
    setProfileSaveSuccess("");
    setEditForm(buildEditForm(personRecord, legacyRecord, profile));
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setIsSavingProfile(true);
    setProfileSaveError("");
    setProfileSaveSuccess("");

    try {
      const firstName = cleanText(editForm.firstName);
      const lastName = cleanText(editForm.lastName);
      const fullName = joinedName(firstName, lastName);

      const basePayload = {
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: fullName || null,
        company_name: cleanText(editForm.company) || null,
        title: cleanText(editForm.title) || null,
        email: cleanText(editForm.email) || null,
        office_phone: cleanText(editForm.officePhone) || null,
        cell_phone: cleanText(editForm.mobile) || null,
        address: cleanText(editForm.address) || null,
        city: cleanText(editForm.city) || null,
        state: cleanText(editForm.state) || null,
        zip: cleanText(editForm.zip) || null,
        contact_type: mapRecordTypeToDbValue(editForm.recordType),
      };

      let savedPerson: PersonRecord | null = null;

if (personRecord?.id) {
  const updatePayload = {
    ...basePayload,
    account_id: personRecord.account_id ?? mainAccount?.id ?? null,
    supplier: personRecord.supplier ?? (cleanText(legacyRecord?.supplier) || null),
  };

  const { error: updateError } = await supabase
    .from("people")
    .update(updatePayload)
    .eq("id", personRecord.id);

  if (updateError) throw updateError;

  const { data: refreshedPerson, error: refreshedPersonError } = await supabase
    .from("people")
    .select("*")
    .eq("id", personRecord.id)
    .maybeSingle();

  if (refreshedPersonError) throw refreshedPersonError;
  if (!refreshedPerson) {
    throw new Error("Profile update succeeded, but the refreshed people record could not be reloaded.");
  }

  savedPerson = refreshedPerson as PersonRecord;
} else {
  const insertPayload = {
    ...basePayload,
    account_id: mainAccount?.id ?? null,
    supplier: cleanText(legacyRecord?.supplier) || null,
    national_name: cleanText(legacyRecord?.national_name) || null,
    person_name: cleanText(legacyRecord?.person_name) || null,
    corporate_kingpin: cleanText(legacyRecord?.corporate_kingpin) || null,
    regional_kingpin: cleanText(legacyRecord?.regional_kingpin) || null,
  };        const { data, error: insertError } = await supabase
          .from("people")
          .insert(insertPayload)
          .select("*")
          .single();

        if (insertError) throw insertError;
        savedPerson = data as PersonRecord;
      }

      const accountContext = await resolveAccountContext(
        supabase,
        source,
        savedPerson,
        legacyRecord,
      );

      setPersonRecord(savedPerson);
      setMainAccount(accountContext.mainAccount);
      setResolvedWebsite(accountContext.website);
      setTotalLocations(accountContext.totalLocations);
      setProfile(accountContext.profile);
      setEditForm(buildEditForm(savedPerson, legacyRecord, accountContext.profile));
      setIsEditingProfile(false);
      setProfileSaveSuccess("Profile updated successfully.");
    } catch (err) {
      setProfileSaveError(extractErrorMessage(err));
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <HubShell
        title="Person Profile"
        subtitle="Loading person details, unified record matches, and interaction history."
      >
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-600 dark:text-slate-300">Loading profile...</p>
          </div>
        </div>
      </HubShell>
    );
  }

  if (error) {
    return (
      <HubShell
        title="Person Profile"
        subtitle="Review person details, relationship progression, and interaction history."
      >
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-900/50 dark:bg-red-950/30">
            <h1 className="text-xl font-bold text-red-800 dark:text-red-300">
              Profile Load Error
            </h1>
            <p className="mt-2 text-sm text-red-700 dark:text-red-200">{error}</p>
            <div className="mt-4">
              <Link
                href="/search-contacts"
                className="inline-flex items-center rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
              >
                Back to Search
              </Link>
            </div>
          </div>
        </div>
      </HubShell>
    );
  }

  if (!profile) {
    return (
      <HubShell
        title="Person Profile"
        subtitle="Review person details, relationship progression, and interaction history."
      >
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Profile Not Found</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              No matching person record could be loaded for this profile.
            </p>
            <div className="mt-4">
              <Link
                href="/search-contacts"
                className="inline-flex items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Back to Search
              </Link>
            </div>
          </div>
        </div>
      </HubShell>
    );
  }

  return (
    <HubShell
      title="Person Profile"
      subtitle="Review person details, relationship progression, and interaction history."
    >
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <Link
                  href="/search-contacts"
                  className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
                >
                  ← Back to Search
                </Link>

                {!isEditingProfile ? (
                  <>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                      {profile.name}
                    </h1>

                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {profile.recordType}
                      {profile.company ? ` • ${profile.company}` : ""}
                      {profile.title ? ` • ${profile.title}` : ""}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {profile.email ? (
                        <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                          <ContactValueLink kind="email" value={profile.email} />
                        </span>
                      ) : null}

                      {resolvedAddress ? (
                        <span className="inline-flex items-center rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm dark:border-blue-500/40 dark:bg-blue-900/20">
                          <AddressValueLink
                            value={resolvedAddress}
                            address={cleanText(personRecord?.address) || cleanText(legacyRecord?.address)}
                            city={cleanText(personRecord?.city)}
                            state={cleanText(personRecord?.state) || cleanText(legacyRecord?.state)}
                            zip={cleanText(personRecord?.zip)}
                            label={profile.name}
                            context={profile.company}
                            showPin
                          />
                        </span>
                      ) : null}

                      {profile.mobile ? (
                        <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                          <ContactValueLink kind="mobile" value={profile.mobile} />
                        </span>
                      ) : null}

                      {profile.officePhone ? (
                        <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                          <ContactValueLink kind="office" value={profile.officePhone} />
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="firstName"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        >
                          First Name
                        </label>
                        <input
                          id="firstName"
                          type="text"
                          value={editForm.firstName}
                          onChange={(event) => updateEditField("firstName", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="lastName"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        >
                          Last Name
                        </label>
                        <input
                          id="lastName"
                          type="text"
                          value={editForm.lastName}
                          onChange={(event) => updateEditField("lastName", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="recordType"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        >
                          Record Type
                        </label>
                        <select
                          id="recordType"
                          value={editForm.recordType}
                          onChange={(event) => updateEditField("recordType", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        >
                          {EDITABLE_RECORD_TYPES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="company"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        >
                          Company
                        </label>
                        <input
                          id="company"
                          type="text"
                          value={editForm.company}
                          onChange={(event) => updateEditField("company", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label
                          htmlFor="title"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        >
                          Title
                        </label>
                        <input
                          id="title"
                          type="text"
                          value={editForm.title}
                          onChange={(event) => updateEditField("title", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label
                          htmlFor="email"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        >
                          Email
                        </label>
                        <input
                          id="email"
                          type="email"
                          value={editForm.email}
                          onChange={(event) => updateEditField("email", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="mobile"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        >
                          Mobile
                        </label>
                        <input
                          id="mobile"
                          type="text"
                          value={editForm.mobile}
                          onChange={(event) => updateEditField("mobile", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="officePhone"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        >
                          Office Phone
                        </label>
                        <input
                          id="officePhone"
                          type="text"
                          value={editForm.officePhone}
                          onChange={(event) => updateEditField("officePhone", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label
                          htmlFor="address"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        >
                          Address
                        </label>
                        <input
                          id="address"
                          type="text"
                          value={editForm.address}
                          onChange={(event) => updateEditField("address", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="city"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        >
                          City
                        </label>
                        <input
                          id="city"
                          type="text"
                          value={editForm.city}
                          onChange={(event) => updateEditField("city", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="state"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        >
                          State
                        </label>
                        <input
                          id="state"
                          type="text"
                          value={editForm.state}
                          onChange={(event) => updateEditField("state", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="zip"
                          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                        >
                          ZIP
                        </label>
                        <input
                          id="zip"
                          type="text"
                          value={editForm.zip}
                          onChange={(event) => updateEditField("zip", event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>
                    </div>

                    {editResolvedAddress ? (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                        {editResolvedAddress}
                      </div>
                    ) : null}
                  </div>
                )}

                {(profileSaveError || profileSaveSuccess) && !isEditingProfile ? (
                  <div className="mt-4">
                    {profileSaveError ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                        {profileSaveError}
                      </div>
                    ) : null}

                    {profileSaveSuccess ? (
                      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200">
                        {profileSaveSuccess}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 xl:items-end">
                {!isEditingProfile ? (
                  <>
                    <button
                      type="button"
                      onClick={handleEditProfile}
                      className="inline-flex items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                    >
                      Edit Profile
                    </button>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800/70">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Record Source
                      </div>
                      <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                        {source === "people"
                          ? "People Table"
                          : source === "contacts"
                            ? "Contacts Table"
                            : "Kingpins Table"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {personRecord?.id ? "Unified people match found" : "Legacy record only"}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="inline-flex items-center rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSavingProfile ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isSavingProfile}
                        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>

                    {profileSaveError ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                        {profileSaveError}
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800/70">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Record Source
                      </div>
                      <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                        {source === "people"
                          ? "People Table"
                          : source === "contacts"
                            ? "Contacts Table"
                            : "Kingpins Table"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {personRecord?.id
                          ? "Saving changes back to people"
                          : "Legacy profile will create a new people row"}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div
              className={[
                "mt-6 grid gap-4",
                showWebsiteCard ? "md:grid-cols-4" : "md:grid-cols-3",
              ].join(" ")}
            >
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Supplier
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                  {profile.supplier || "—"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Main Account
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                  {getAccountDisplayName(mainAccount)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Total Locations
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                  {typeof totalLocations === "number" ? totalLocations : "—"}
                </div>
              </div>

              {showWebsiteCard ? (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Website
                  </div>
                  <div className="mt-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
                    {websiteDisplay || "Open website"}
                  </div>
                </a>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Relationship Progression
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Interactions are visualized within each stage block instead of floating on a
                separate month rail.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {STAGE_ORDER.map((stage) => {
                const status = getStageProgressStatus(stage, highestReachedStage);
                const count = stageCounts[stage];
                const stageDots = stagePoints.filter((point) => point.stage === stage);

                return (
                  <div key={stage} className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                      <div className="mb-3 flex items-center gap-2 text-xs">
                        <span
                          className={`inline-block h-3 w-3 rounded-full border ${getStageDotClasses(stage)}`}
                        />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {STAGE_LABELS[stage]}
                        </span>
                      </div>

                      <div className="relative h-16 overflow-hidden rounded-xl border border-slate-200 bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900">
                        <div className="absolute inset-0 grid grid-cols-4">
                          <div className="border-r border-slate-200/80 dark:border-slate-800/80" />
                          <div className="border-r border-slate-200/80 dark:border-slate-800/80" />
                          <div className="border-r border-slate-200/80 dark:border-slate-800/80" />
                          <div />
                        </div>

                        {stageDots.map((point) => (
                          <button
                            key={point.interaction.id}
                            type="button"
                            onClick={() => toggleExpanded(point.interaction.id)}
                            title={`${formatDate(point.interaction.date || point.interaction.created_at)} • ${formatInteractionType(point.interaction.type)} • ${STAGE_LABELS[stage]}`}
                            className={`absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${getStageDotClasses(stage)}`}
                            style={{ left: `${point.positionPercent}%` }}
                            aria-label={`Open interaction from ${formatDate(
                              point.interaction.date || point.interaction.created_at,
                            )}`}
                          />
                        ))}

                        {stageDots.length === 0 ? (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
                            No interactions yet
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div
                      className={[
                        "rounded-2xl border p-5 shadow-sm",
                        getStageCardClasses(stage, stageCounts),
                      ].join(" ")}
                    >
                      <div className="text-sm font-bold">{STAGE_LABELS[stage]}</div>
                      <div className="mt-2 text-2xl font-extrabold">{count}</div>
                      <div className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-90">
                        {status === "current"
                          ? "Current Stage"
                          : status === "reached"
                            ? "Reached"
                            : "Upcoming"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {highestReachedStage ? (
              <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                Highest stage reached:{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {STAGE_LABELS[highestReachedStage]}
                </span>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                No staged interactions yet.
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total Interactions
              </div>
              <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                {interactions.length}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Last Interaction
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                {getLastInteractionDate(interactions)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Latest Interaction Type
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                {getLatestInteractionType(interactions)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Current Stage
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                {latestKnownStage ? STAGE_LABELS[latestKnownStage] : "—"}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Interaction Timeline
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Showing {filteredInteractions.length} of {interactions.length} interaction
                  {interactions.length === 1 ? "" : "s"}.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[760px]">
                <div>
                  <label
                    htmlFor="stageFilter"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Stage
                  </label>
                  <select
                    id="stageFilter"
                    value={stageFilter}
                    onChange={(event) => setStageFilter(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {STAGE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option === "all" ? "All Stages" : STAGE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="typeFilter"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Type
                  </label>
                  <select
                    id="typeFilter"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {availableTypes.map((option) => (
                      <option key={option} value={option}>
                        {option === "all" ? "All Types" : formatInteractionType(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="textFilter"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Search
                  </label>
                  <input
                    id="textFilter"
                    type="text"
                    value={textFilter}
                    onChange={(event) => setTextFilter(event.target.value)}
                    placeholder="Search summary, details, outcome..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {filteredInteractions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  No interactions match the current filters.
                </div>
              ) : (
                filteredInteractions.map((interaction) => {
                  const summary = cleanText(interaction.summary);
                  const details = cleanImportedInteractionDetails(interaction.details, profile);
                  const outcome = cleanText(interaction.outcome);
                  const isExpanded = expandedIds.includes(interaction.id);
                  const stageTokens = normalizeStage(interaction.stage);

                  return (
                    <div
                      key={interaction.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpanded(interaction.id)}
                        className="w-full px-5 py-4 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                {formatInteractionType(interaction.type)}
                              </span>

                              {stageTokens.map((stage) => (
                                <span
                                  key={`${interaction.id}-${stage}`}
                                  className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  {STAGE_LABELS[stage]}
                                </span>
                              ))}
                            </div>

                            <div className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                              {summary || "Interaction"}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                            <span>{formatDate(interaction.date || interaction.created_at)}</span>
                            <span className="text-lg">{isExpanded ? "−" : "+"}</span>
                          </div>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
                            {details ? (
                              <div>
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Details
                                </div>
                                <p className="whitespace-pre-line">{details}</p>
                              </div>
                            ) : null}

                            {outcome ? (
                              <div>
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  Outcome
                                </div>
                                <p className="whitespace-pre-line">{outcome}</p>
                              </div>
                            ) : null}

                            {!details && !outcome ? (
                              <div className="text-slate-500 dark:text-slate-400">
                                No additional details are available for this interaction.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </HubShell>
  );
}