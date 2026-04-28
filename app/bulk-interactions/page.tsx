"use client";

import { ChangeEvent, useMemo, useState } from "react";
import {
  HubShell,
  PrimaryButton,
  SectionCard,
  SecondaryButton,
  StatusMessage,
  TextArea,
  createClient,
} from "@/components/hub-shared";

type RawImportRow = {
  interaction_date: string;
  person_name: string;
  email: string;
  company_name: string;
  interaction_type: string;
  purpose: string;
  details: string;
  outcome: string;
  follow_up_date: string;
  stage: string;
  data_source: string;
  address: string;
  office_phone: string;
  cell_phone: string;
  title: string;
  state: string;
};

type PeopleLookupRow = {
  id: string;
  full_name: string | null;
  title: string | null;
  email: string | null;
  cell_phone: string | null;
  office_phone: string | null;
  company_name: string | null;
  national_name: string | null;
  supplier: string | null;
  state: string | null;
  address: string | null;
  account_id: string | null;
  is_kingpin: boolean | null;
  contact_type: string | null;
  legacy_contact_id: string | null;
  legacy_kingpin_id: string | null;
};

type MatchCandidate = {
  id: string;
  label: string;
  email: string | null;
  company_name: string | null;
  person_name: string | null;
  match_reason: string;
  score: number;
  state: string | null;
  address: string | null;
  office_phone: string | null;
  cell_phone: string | null;
  title: string | null;
  is_kingpin: boolean | null;
  contact_type: string | null;
};

type PersonAction = "matched" | "possible" | "create" | "skip";
type PreviewLane = "ready" | "needs_completion" | "failed";

type PreviewRow = RawImportRow & {
  row_number: number;
  person_action: PersonAction;
  preview_lane: PreviewLane;
  matched_person_id: string | null;
  matched_person_label: string | null;
  selected_possible_candidate_id: string | null;
  normalized_interaction_type: string;
  prepared_details: string;
  import_key: string;
  error_message: string | null;
  completion_notes: string[];
  possible_candidates: MatchCandidate[];
  can_create_person: boolean;
  duplicate_status: "unchecked" | "duplicate" | "new";
};

type ImportFailure = {
  row_number: number;
  person_name: string;
  company_name: string;
  interaction_type: string;
  stage:
    | "person_lookup"
    | "person_create"
    | "interaction_insert"
    | "validation"
    | "duplicate";
  message: string;
};

type ImportResult = {
  imported: number;
  created_people: number;
  matched_people: number;
  duplicates_skipped: number;
  skipped: number;
  failed: number;
};

type AppField =
  | "interaction_date"
  | "person_name"
  | "email"
  | "company_name"
  | "interaction_type"
  | "purpose"
  | "details"
  | "outcome"
  | "follow_up_date"
  | "stage"
  | "data_source"
  | "address"
  | "office_phone"
  | "cell_phone"
  | "title"
  | "state";

type HeaderMapping = Record<string, AppField | "">;

type ParsedInputState = {
  headers: string[];
  dataRows: string[][];
};

const CONTACT_FIELDS: AppField[] = [
  "person_name",
  "email",
  "company_name",
  "address",
  "office_phone",
  "cell_phone",
  "title",
  "state",
];

const INTERACTION_FIELDS: AppField[] = [
  "interaction_date",
  "interaction_type",
  "purpose",
  "details",
  "outcome",
  "follow_up_date",
  "stage",
  "data_source",
];

const TEMPLATE_HEADERS: AppField[] = [
  "interaction_date",
  "person_name",
  "email",
  "company_name",
  "title",
  "address",
  "office_phone",
  "cell_phone",
  "state",
  "interaction_type",
  "purpose",
  "details",
  "outcome",
  "follow_up_date",
  "stage",
  "data_source",
];

const REQUIRED_FIELDS_FOR_IMPORT: AppField[] = [];

const VALID_STAGES = ["introduction", "education", "evaluation", "adoption"];

const FIELD_METADATA: Record<
  AppField,
  { label: string; description: string; group: "contact" | "interaction" }
> = {
  person_name: {
    label: "person_name",
    description: "Person / kingpin / contact name",
    group: "contact",
  },
  email: {
    label: "email",
    description: "Email address",
    group: "contact",
  },
  company_name: {
    label: "company_name",
    description: "Company / destination / account name",
    group: "contact",
  },
  address: {
    label: "address",
    description: "Address",
    group: "contact",
  },
  office_phone: {
    label: "office_phone",
    description: "Office phone",
    group: "contact",
  },
  cell_phone: {
    label: "cell_phone",
    description: "Cell / mobile phone",
    group: "contact",
  },
  title: {
    label: "title",
    description: "Job title",
    group: "contact",
  },
  state: {
    label: "state",
    description: "State",
    group: "contact",
  },
  interaction_date: {
    label: "interaction_date",
    description: "Date of the interaction",
    group: "interaction",
  },
  interaction_type: {
    label: "interaction_type",
    description: "Visit / virtual meeting / call / email / trial",
    group: "interaction",
  },
  purpose: {
    label: "purpose",
    description: "Purpose of the interaction",
    group: "interaction",
  },
  details: {
    label: "details",
    description: "Meeting notes / long-form details",
    group: "interaction",
  },
  outcome: {
    label: "outcome",
    description: "Outcome / result / next status",
    group: "interaction",
  },
  follow_up_date: {
    label: "follow_up_date",
    description: "Follow-up date",
    group: "interaction",
  },
  stage: {
    label: "stage",
    description: "Demand creation stage",
    group: "interaction",
  },
  data_source: {
    label: "data_source",
    description: "Source label for imported data",
    group: "interaction",
  },
};

const TEMPLATE_EXAMPLE_ROWS = [
  [
    "2026-04-10",
    "Example Contact",
    "example.contact@certisbio.com",
    "Example Cooperative",
    "Agronomy Lead",
    "123 Main Street, Ames, IA 50010",
    "515-555-1111",
    "515-555-2222",
    "IA",
    "In-Person Visit",
    "Discuss trial setup",
    "Reviewed trial plans, product fit, and next-step interest.",
    "Positive engagement",
    "2026-04-17",
    "Evaluation",
    "Spreadsheet Import",
  ],
  [
    "2026-04-11",
    "Sample Agronomy Lead",
    "sample.lead@certisbio.com",
    "Sample Retail Account",
    "CCA",
    "456 Market Avenue, Des Moines, IA 50309",
    "515-555-3333",
    "515-555-4444",
    "IA",
    "Email",
    "Share commercial trial results",
    "Shared technical summary and proposed next-step discussion.",
    "Pending response",
    "",
    "Education",
    "Spreadsheet Import",
  ],
];

const HEADER_ALIAS_MAP: Record<AppField, string[]> = {
  interaction_date: [
    "interaction_date",
    "interaction date",
    "date",
    "date of visit",
    "visit date",
    "meeting date",
    "date visited",
    "date of interaction",
    "interactiondate",
    "activity date",
    "call date",
    "email date",
  ],
  person_name: [
    "person_name",
    "person name",
    "name",
    "contact",
    "contact name",
    "kingpin",
    "kingpin_name",
    "kingpin name",
    "person",
    "attendee",
    "customer name",
    "individual",
    "full_name",
    "full name",
    "from name",
    "sender name",
  ],
  email: [
    "email",
    "email address",
    "e-mail",
    "e mail",
    "contact email",
    "emailaddress",
    "email_address",
    "from email",
    "sender email",
  ],
  company_name: [
    "company_name",
    "company name",
    "company",
    "destination",
    "org show",
    "organization",
    "organisation",
    "account",
    "account name",
    "retailer",
    "business name",
    "customer",
    "customer name",
    "location",
    "site",
  ],
  interaction_type: [
    "interaction_type",
    "interaction type",
    "type_of_interaction",
    "type of interaction",
    "interaction category",
    "type",
    "activity type",
    "call type",
    "meeting type",
  ],
  purpose: [
    "purpose",
    "interaction purpose",
    "purpose of interaction",
    "summary",
    "subject",
    "topic",
    "interaction summary",
    "activity summary",
    "meeting summary",
    "visit summary",
    "email subject",
    "title",
  ],
  details: [
    "details",
    "detail",
    "notes",
    "meeting notes",
    "meeting_notes",
    "note",
    "comments",
    "comment",
    "description",
    "email notes",
    "meetingnotes",
    "memo",
    "body",
    "email body",
    "snippet",
  ],
  outcome: [
    "outcome",
    "result",
    "status",
    "response",
    "disposition",
    "meeting outcome",
    "visit outcome",
    "next outcome",
  ],
  follow_up_date: [
    "follow_up_date",
    "follow up date",
    "follow-up date",
    "next step date",
    "next contact date",
    "callback date",
    "reminder date",
  ],
  stage: [
    "stage",
    "process stage",
    "pipeline stage",
    "journey stage",
    "workflow stage",
    "demand creation stage",
  ],
  data_source: [
    "data_source",
    "data source",
    "source",
    "file source",
    "import source",
    "origin",
    "source_file",
    "source file",
    "file",
    "filename",
  ],
  address: ["address", "street address", "mailing address", "location address"],
  office_phone: [
    "office phone",
    "office_phone",
    "phone",
    "work phone",
    "business phone",
    "office number",
    "main phone",
    "telephone",
  ],
  cell_phone: [
    "cell phone",
    "cell_phone",
    "mobile phone",
    "mobile",
    "cell",
    "cell number",
    "mobile number",
  ],
  title: ["title", "job title", "position", "role"],
  state: ["state", "st", "province", "territory"],
};

function sanitizeImportedText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeValue(value: string | null | undefined): string {
  return sanitizeImportedText(value);
}

function normalizeForMatch(value: string | null | undefined): string {
  return normalizeValue(value)
    .toLowerCase()
    .replace(/[^\x00-\x7F\w\s]/g, " ")
    .replace(/[^\x00-\x7F]/g, " ")
    .replace(/[.,/#!$%^&*;:{}=_`~()\-+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string | null | undefined): string {
  return normalizeValue(value).replace(/\D/g, "");
}

function normalizeState(value: string | null | undefined): string {
  return normalizeValue(value).toUpperCase();
}

function normalizeEmail(value: string | null | undefined): string {
  return normalizeValue(value).toLowerCase();
}

function isValidEmail(value: string | null | undefined): boolean {
  const email = normalizeEmail(value);
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isWeakOrJunkName(value: string | null | undefined): boolean {
  const name = normalizeValue(value);
  const lowered = name.toLowerCase();

  if (!name) return true;
  if (name.length < 3) return true;
  if (isValidEmail(name)) return true;
  if (name.includes("@")) return true;
  if (/^\d+$/.test(name)) return true;
  if (["unknown", "n/a", "na", "none", "null", "external", "email"].includes(lowered)) {
    return true;
  }

  return false;
}

function normalizeDateForImport(value: string): string | null {
  const raw = normalizeValue(value);
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return raw;
}

function normalizedStageForImport(value: string): string | null {
  const normalized = normalizeForMatch(value).replace(/\s+/g, "_");
  if (!normalized) return null;
  return VALID_STAGES.includes(normalized) ? normalized : null;
}

function normalizeInteractionType(value: string): string {
  const normalized = normalizeForMatch(value);

  if (!normalized) return "";
  if (normalized.includes("email")) return "email";
  if (normalized.includes("call") || normalized.includes("phone")) return "call";
  if (
    normalized.includes("virtual") ||
    normalized.includes("zoom") ||
    normalized.includes("teams") ||
    normalized.includes("webex")
  ) {
    return "virtual_meeting";
  }
  if (
    normalized.includes("visit") ||
    normalized.includes("in person") ||
    normalized.includes("in-person")
  ) {
    return "in_person_visit";
  }
  if (
    normalized.includes("trial") ||
    normalized.includes("plot") ||
    normalized.includes("evaluation")
  ) {
    return "trial";
  }
  if (normalized.includes("note")) {
    return "note";
  }

  return "";
}

function inferInteractionType(row: RawImportRow): string {
  const combined = normalizeForMatch(
    [row.interaction_type, row.purpose, row.details].filter(Boolean).join(" "),
  );

  if (!combined) return "email";
  if (combined.includes("email")) return "email";
  if (combined.includes("call") || combined.includes("phone")) return "call";
  if (
    combined.includes("trial") ||
    combined.includes("plot") ||
    combined.includes("evaluation")
  ) {
    return "trial";
  }
  if (
    combined.includes("virtual") ||
    combined.includes("zoom") ||
    combined.includes("teams") ||
    combined.includes("webex")
  ) {
    return "virtual_meeting";
  }
  if (
    combined.includes("visit") ||
    combined.includes("met with") ||
    combined.includes("in person") ||
    combined.includes("in-person") ||
    combined.includes("lunch") ||
    combined.includes("coffee")
  ) {
    return "in_person_visit";
  }

  return "email";
}

function buildPreparedDetails(row: RawImportRow): string {
  const chunks: string[] = [];

  if (normalizeValue(row.details)) {
    chunks.push(`--- Details ---\n${normalizeValue(row.details)}`);
  }

  if (normalizeValue(row.outcome)) {
    chunks.push(`--- Outcome ---\n${normalizeValue(row.outcome)}`);
  }

  if (normalizeValue(row.follow_up_date)) {
    chunks.push(`--- Follow-Up Date ---\n${normalizeValue(row.follow_up_date)}`);
  }

  if (normalizeValue(row.company_name)) {
    chunks.push(`--- Company ---\n${normalizeValue(row.company_name)}`);
  }

  if (normalizeValue(row.title)) {
    chunks.push(`--- Title ---\n${normalizeValue(row.title)}`);
  }

  if (normalizeValue(row.address)) {
    chunks.push(`--- Address ---\n${normalizeValue(row.address)}`);
  }

  if (normalizeValue(row.office_phone)) {
    chunks.push(`--- Office Phone ---\n${normalizeValue(row.office_phone)}`);
  }

  if (normalizeValue(row.cell_phone)) {
    chunks.push(`--- Cell Phone ---\n${normalizeValue(row.cell_phone)}`);
  }

  if (normalizeValue(row.state)) {
    chunks.push(`--- State ---\n${normalizeValue(row.state)}`);
  }

  if (normalizeValue(row.data_source)) {
    chunks.push(`--- Data Source ---\n${normalizeValue(row.data_source)}`);
  }

  return chunks.join("\n\n");
}

function buildImportKey(row: RawImportRow): string {
  const email = normalizeEmail(row.email);
  const date = normalizeDateForImport(row.interaction_date) ?? "";
  const purpose = normalizeForMatch(row.purpose || row.details).replace(/\s+/g, " ");
  const sourceFile = normalizeForMatch(row.data_source || "bulk_interactions_import.csv").replace(
    /\s+/g,
    " ",
  );

  return [email, date, purpose, sourceFile].join("|");
}

function parseDelimitedText(text: string): string[][] {
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine =
    normalizedText.split("\n").find((line) => normalizeValue(line).length > 0) ?? "";
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const delimiter = tabCount > commaCount ? "\t" : ",";

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < normalizedText.length; i += 1) {
    const char = normalizedText[i];
    const nextChar = normalizedText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);

  const hasOnlyEmptyTrailingRow =
    currentRow.length === 1 && normalizeValue(currentRow[0]).length === 0;

  if (!hasOnlyEmptyTrailingRow) {
    rows.push(currentRow);
  }

  return rows
    .map((row) => row.map((cell) => sanitizeImportedText(cell)))
    .filter((row) => row.some((cell) => normalizeValue(cell).length > 0));
}

function buildTemplateCsv(): string {
  const lines = [
    TEMPLATE_HEADERS.join(","),
    ...TEMPLATE_EXAMPLE_ROWS.map((row) =>
      row
        .map((cell) => {
          const escaped = cell.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(","),
    ),
  ];

  return lines.join("\n");
}

function downloadTemplateCsv() {
  const csv = buildTemplateCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "interactions_import_template.csv";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

function getAutoMappedField(header: string): AppField | "" {
  const normalizedHeader = normalizeForMatch(header);

  if (!normalizedHeader) return "";

  for (const field of [...CONTACT_FIELDS, ...INTERACTION_FIELDS]) {
    const aliases = HEADER_ALIAS_MAP[field];

    if (aliases.some((alias) => normalizeForMatch(alias) === normalizedHeader)) {
      return field;
    }
  }

  for (const field of [...CONTACT_FIELDS, ...INTERACTION_FIELDS]) {
    const aliases = HEADER_ALIAS_MAP[field];

    if (
      aliases.some((alias) => {
        const normalizedAlias = normalizeForMatch(alias);
        return (
          normalizedHeader.includes(normalizedAlias) ||
          normalizedAlias.includes(normalizedHeader)
        );
      })
    ) {
      return field;
    }
  }

  return "";
}

function buildInitialHeaderMapping(headers: string[]): HeaderMapping {
  const mapping: HeaderMapping = {};

  for (const header of headers) {
    mapping[header] = getAutoMappedField(header);
  }

  return mapping;
}

function getMappedHeadersForField(mapping: HeaderMapping, field: AppField): string[] {
  return Object.entries(mapping)
    .filter(([, mappedField]) => mappedField === field)
    .map(([header]) => header);
}

function validateHeaderMapping(mapping: HeaderMapping): {
  missingRequiredFields: AppField[];
} {
  const missingRequiredFields = REQUIRED_FIELDS_FOR_IMPORT.filter((field) => {
    const mappedHeaders = getMappedHeadersForField(mapping, field);
    return mappedHeaders.length === 0;
  });

  return { missingRequiredFields };
}

function buildRawRowsFromMappedInput(
  parsedInput: ParsedInputState,
  mapping: HeaderMapping,
): RawImportRow[] {
  const headerIndexMap = new Map<string, number>();

  parsedInput.headers.forEach((header, index) => {
    headerIndexMap.set(header, index);
  });

  return parsedInput.dataRows.map((row) => {
    const readMappedField = (field: AppField): string => {
      const mappedHeaders = getMappedHeadersForField(mapping, field);

      const values = mappedHeaders
        .map((header) => {
          const index = headerIndexMap.get(header);
          return index === undefined ? "" : row[index] ?? "";
        })
        .map((value) => normalizeValue(value))
        .filter(Boolean);

      if (field === "details") {
        return values.join("\n\n");
      }

      return values[0] ?? "";
    };

    return {
      interaction_date: readMappedField("interaction_date"),
      person_name: readMappedField("person_name"),
      email: readMappedField("email"),
      company_name: readMappedField("company_name"),
      interaction_type: readMappedField("interaction_type"),
      purpose: readMappedField("purpose"),
      details: readMappedField("details"),
      outcome: readMappedField("outcome"),
      follow_up_date: readMappedField("follow_up_date"),
      stage: readMappedField("stage"),
      data_source: readMappedField("data_source") || "bulk_interactions_import.csv",
      address: readMappedField("address"),
      office_phone: readMappedField("office_phone"),
      cell_phone: readMappedField("cell_phone"),
      title: readMappedField("title"),
      state: readMappedField("state"),
    };
  });
}

function buildCandidateLabel({
  personName,
  companyName,
  email,
  matchReason,
  isKingpin,
  contactType,
}: {
  personName: string;
  companyName: string;
  email: string;
  matchReason: string;
  isKingpin: boolean | null;
  contactType: string | null;
}) {
  const typeLabel =
    isKingpin === true ? "Kingpin" : normalizeValue(contactType) || "Person";

  return [
    personName || "Unnamed Person",
    companyName || "No Company",
    email || "No Email",
    typeLabel,
    matchReason,
  ].join(" · ");
}

function scoreCandidateForRow(
  row: RawImportRow,
  candidate: PeopleLookupRow,
): MatchCandidate | null {
  const rowEmail = normalizeEmail(row.email);
  const rowName = normalizeForMatch(row.person_name);
  const rowCompany = normalizeForMatch(row.company_name);
  const rowState = normalizeState(row.state);
  const rowOfficePhone = normalizePhone(row.office_phone);
  const rowCellPhone = normalizePhone(row.cell_phone);
  const rowAddress = normalizeForMatch(row.address);
  const rowTitle = normalizeForMatch(row.title);

  const candidateEmail = normalizeEmail(candidate.email);
  const candidateName = normalizeForMatch(candidate.full_name);
  const candidateCompany = normalizeForMatch(candidate.company_name);
  const candidateNational = normalizeForMatch(candidate.national_name);
  const candidateSupplier = normalizeForMatch(candidate.supplier);
  const candidateState = normalizeState(candidate.state);
  const candidateOfficePhone = normalizePhone(candidate.office_phone);
  const candidateCellPhone = normalizePhone(candidate.cell_phone);
  const candidateAddress = normalizeForMatch(candidate.address);
  const candidateTitle = normalizeForMatch(candidate.title);

  let score = 0;
  const reasons: string[] = [];

  if (rowEmail && candidateEmail && rowEmail === candidateEmail) {
    score += 120;
    reasons.push("email exact");
  }

  if (rowName && candidateName && rowName === candidateName) {
    score += 70;
    reasons.push("name exact");
  }

  if (rowCompany && candidateCompany && rowCompany === candidateCompany) {
    score += 25;
    reasons.push("company exact");
  }

  if (rowCompany && candidateNational && rowCompany === candidateNational) {
    score += 16;
    reasons.push("national name");
  }

  if (rowCompany && candidateSupplier && rowCompany === candidateSupplier) {
    score += 8;
    reasons.push("supplier");
  }

  if (
    rowName &&
    candidateName &&
    rowName !== candidateName &&
    (rowName.includes(candidateName) || candidateName.includes(rowName))
  ) {
    score += 28;
    reasons.push("name similar");
  }

  if (
    rowCompany &&
    candidateCompany &&
    rowCompany !== candidateCompany &&
    (rowCompany.includes(candidateCompany) || candidateCompany.includes(rowCompany))
  ) {
    score += 10;
    reasons.push("company similar");
  }

  if (rowState && candidateState && rowState === candidateState) {
    score += 6;
    reasons.push("state");
  }

  if (
    rowOfficePhone &&
    candidateOfficePhone &&
    rowOfficePhone.length >= 7 &&
    rowOfficePhone === candidateOfficePhone
  ) {
    score += 18;
    reasons.push("office phone");
  }

  if (
    rowCellPhone &&
    candidateCellPhone &&
    rowCellPhone.length >= 7 &&
    rowCellPhone === candidateCellPhone
  ) {
    score += 18;
    reasons.push("cell phone");
  }

  if (
    rowAddress &&
    candidateAddress &&
    rowAddress.length >= 8 &&
    candidateAddress.length >= 8 &&
    (rowAddress.includes(candidateAddress) || candidateAddress.includes(rowAddress))
  ) {
    score += 10;
    reasons.push("address");
  }

  if (rowTitle && candidateTitle && rowTitle === candidateTitle) {
    score += 5;
    reasons.push("title");
  }

  if (score <= 0) {
    return null;
  }

  const personName = normalizeValue(candidate.full_name);
  const companyName = normalizeValue(candidate.company_name);
  const email = normalizeValue(candidate.email);
  const matchReason = reasons.join(", ");

  return {
    id: candidate.id,
    label: buildCandidateLabel({
      personName,
      companyName,
      email,
      matchReason,
      isKingpin: candidate.is_kingpin,
      contactType: candidate.contact_type,
    }),
    email: candidate.email,
    company_name: candidate.company_name,
    person_name: personName || null,
    match_reason: matchReason,
    score,
    state: candidate.state,
    address: candidate.address,
    office_phone: candidate.office_phone,
    cell_phone: candidate.cell_phone,
    title: candidate.title,
    is_kingpin: candidate.is_kingpin,
    contact_type: candidate.contact_type,
  };
}

function dedupeCandidates(candidates: MatchCandidate[]): MatchCandidate[] {
  const seen = new Set<string>();
  const output: MatchCandidate[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    output.push(candidate);
  }

  return output;
}

function classifyRow(row: RawImportRow, candidates: MatchCandidate[]): {
  action: PersonAction;
  lane: PreviewLane;
  matchedCandidate: MatchCandidate | null;
  errorMessage: string | null;
  completionNotes: string[];
  canCreatePerson: boolean;
} {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0] ?? null;
  const second = sorted[1] ?? null;
  const hasEmail = isValidEmail(row.email);
  const hasAnyEmailText = Boolean(normalizeValue(row.email));
  const hasUsableName = !isWeakOrJunkName(row.person_name);
  const hasPurpose = Boolean(normalizeValue(row.purpose));
  const completionNotes: string[] = [];

  if (!hasPurpose) completionNotes.push("Purpose / summary is required before import.");
  if (hasAnyEmailText && !hasEmail) completionNotes.push("Email is present but does not look valid.");
  if (!hasEmail && !hasUsableName) {
    completionNotes.push("Option A requires either a valid email or a usable person name.");
  }

  const emailOnlyNoMatch = hasEmail && !hasUsableName && !top;
  if (emailOnlyNoMatch) {
    completionNotes.push(
      "Email-only row has no matched existing person. Add a real person name before creating a new person.",
    );
  }

  const canCreatePerson = hasUsableName;

  if (!hasPurpose || (!hasEmail && !hasUsableName) || (hasAnyEmailText && !hasEmail)) {
    const severeFailure = !hasPurpose && !hasEmail && !hasUsableName;
    return {
      action: "skip",
      lane: severeFailure ? "failed" : "needs_completion",
      matchedCandidate: null,
      errorMessage: completionNotes.join(" "),
      completionNotes,
      canCreatePerson,
    };
  }

  if (!top) {
    if (!canCreatePerson) {
      return {
        action: "skip",
        lane: "needs_completion",
        matchedCandidate: null,
        errorMessage: completionNotes.join(" ") || "Add a real person name before import.",
        completionNotes,
        canCreatePerson,
      };
    }

    return {
      action: "create",
      lane: "ready",
      matchedCandidate: null,
      errorMessage: null,
      completionNotes,
      canCreatePerson,
    };
  }

  const strongExactEmail = top.match_reason.includes("email exact");
  const strongNameAndCompany =
    top.match_reason.includes("name exact") &&
    top.match_reason.includes("company exact");
  const clearlyAhead = !second || top.score - second.score >= 25;
  const veryStrongScore = top.score >= 110 || (top.score >= 90 && clearlyAhead);
  const strongNonEmailScore = top.score >= 85 && strongNameAndCompany && clearlyAhead;

  if (strongExactEmail || veryStrongScore || strongNonEmailScore) {
    return {
      action: "matched",
      lane: "ready",
      matchedCandidate: top,
      errorMessage: null,
      completionNotes,
      canCreatePerson,
    };
  }

  if (top.score >= 35) {
    completionNotes.push("Possible existing person found. Choose Use Existing Person or Create Person.");
    return {
      action: "possible",
      lane: "needs_completion",
      matchedCandidate: null,
      errorMessage: "Possible existing person found. Review before importing.",
      completionNotes,
      canCreatePerson,
    };
  }

  if (!canCreatePerson) {
    completionNotes.push("A new person cannot be created from an email-only or weak-name row.");
    return {
      action: "skip",
      lane: "needs_completion",
      matchedCandidate: null,
      errorMessage: completionNotes.join(" "),
      completionNotes,
      canCreatePerson,
    };
  }

  return {
    action: "create",
    lane: "ready",
    matchedCandidate: null,
    errorMessage: null,
    completionNotes,
    canCreatePerson,
  };
}

function rebuildPreviewRow(row: PreviewRow): PreviewRow {
  const selectedCandidate = row.possible_candidates.find(
    (candidate) => candidate.id === row.selected_possible_candidate_id,
  );
  const candidatesForClassification = selectedCandidate
    ? [selectedCandidate, ...row.possible_candidates.filter((candidate) => candidate.id !== selectedCandidate.id)]
    : row.possible_candidates;
  const classification = classifyRow(row, candidatesForClassification);
  const matchedCandidate =
    row.person_action === "matched" && selectedCandidate
      ? selectedCandidate
      : classification.matchedCandidate;

  return {
    ...row,
    person_action:
      row.person_action === "matched" && selectedCandidate
        ? "matched"
        : classification.action,
    preview_lane:
      row.person_action === "matched" && selectedCandidate
        ? "ready"
        : classification.lane,
    matched_person_id: matchedCandidate?.id ?? null,
    matched_person_label: matchedCandidate?.label ?? null,
    normalized_interaction_type:
      normalizeInteractionType(row.interaction_type) || inferInteractionType(row),
    prepared_details: buildPreparedDetails(row),
    import_key: buildImportKey(row),
    error_message:
      row.person_action === "matched" && selectedCandidate
        ? null
        : classification.errorMessage,
    completion_notes:
      row.person_action === "matched" && selectedCandidate
        ? []
        : classification.completionNotes,
    can_create_person: classification.canCreatePerson,
    duplicate_status: "unchecked",
  };
}

function FieldGroupSection({
  title,
  description,
  fields,
  parsedInput,
  headerMapping,
  onChange,
}: {
  title: string;
  description: string;
  fields: AppField[];
  parsedInput: ParsedInputState;
  headerMapping: HeaderMapping;
  onChange: (header: string, value: string) => void;
}) {
  return (
    <SectionCard title={title} description={description}>
      <div className="space-y-3">
        {parsedInput.headers.map((header, index) => {
          const selectedValue = headerMapping[header] ?? "";
          const selectedFieldGroup = selectedValue
            ? FIELD_METADATA[selectedValue as AppField]?.group
            : null;

          if (selectedFieldGroup && !fields.includes(selectedValue as AppField)) {
            return null;
          }

          return (
            <div
              key={`${title}-mapping-row-${header}-${index}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(220px,280px)] md:items-center">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Source Header
                  </div>
                  <div className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                    {header}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Map To
                  </label>
                  <select
                    value={selectedValue}
                    onChange={(event) => onChange(header, event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900"
                  >
                    <option value="">Ignore this column</option>
                    {fields.map((field) => (
                      <option key={field} value={field}>
                        {FIELD_METADATA[field].label} — {FIELD_METADATA[field].description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function SummaryStatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-h-[124px] rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="min-h-[40px] text-sm font-bold leading-snug text-slate-600 dark:text-slate-300">
        {label}
      </div>
      <div className="mt-4 text-3xl font-bold leading-none">{value}</div>
    </div>
  );
}

function FailureList({
  failures,
}: {
  failures: ImportFailure[];
}) {
  if (failures.length === 0) return null;

  return (
    <SectionCard
      title="Import Failures"
      description="These rows were parsed successfully but failed during validation or insert."
    >
      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
        {failures.map((failure, index) => (
          <div
            key={`${failure.row_number}-${failure.stage}-${index}`}
            className="rounded-2xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/20"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Row {failure.row_number} — {failure.person_name || "Unnamed Person"}
              </div>
              <div className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white dark:bg-rose-500 dark:text-slate-950">
                {failure.stage}
              </div>
            </div>

            <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              <div>
                <span className="font-semibold">Company:</span>{" "}
                {failure.company_name || "Not provided"}
              </div>
              <div>
                <span className="font-semibold">Interaction Type:</span>{" "}
                {failure.interaction_type || "Not resolved"}
              </div>
              <div className="mt-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm dark:border-rose-800 dark:bg-slate-900">
                {failure.message}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function LaneBadge({ row }: { row: PreviewRow }) {
  if (row.duplicate_status === "duplicate") {
    return (
      <span className="rounded-full bg-slate-600 px-3 py-1 text-xs font-bold text-white">
        Duplicate
      </span>
    );
  }

  if (row.preview_lane === "ready") {
    return (
      <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white dark:bg-emerald-500 dark:text-slate-950">
        Ready
      </span>
    );
  }

  if (row.preview_lane === "needs_completion") {
    return (
      <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-black dark:bg-amber-400 dark:text-slate-950">
        Needs Completion
      </span>
    );
  }

  return (
    <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white dark:bg-rose-500 dark:text-slate-950">
      Failed / Source Fix
    </span>
  );
}

function PreviewLaneCard({
  title,
  description,
  rows,
  emptyMessage,
  editable,
  onFieldChange,
  onActionChange,
  onCandidateChange,
}: {
  title: string;
  description: string;
  rows: PreviewRow[];
  emptyMessage: string;
  editable: boolean;
  onFieldChange: (rowNumber: number, field: keyof RawImportRow, value: string) => void;
  onActionChange: (rowNumber: number, action: PersonAction) => void;
  onCandidateChange: (rowNumber: number, value: string) => void;
}) {
  return (
    <SectionCard title={title} description={description}>
      {rows.length === 0 ? (
        <StatusMessage message={emptyMessage} tone="info" />
      ) : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
          {rows.map((row) => {
            const candidateValue = row.selected_possible_candidate_id ?? "";
            const canUseExisting = row.possible_candidates.length > 0;
            const canCreate = row.can_create_person;

            return (
              <div
                key={`preview-lane-row-${row.row_number}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Row {row.row_number}
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                      {normalizeValue(row.person_name) ||
                        normalizeValue(row.email) ||
                        "Unnamed Interaction"}
                    </div>
                    <div className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                      import_key: {row.import_key || "Not available"}
                    </div>
                  </div>
                  <LaneBadge row={row} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Person Name
                    </span>
                    <input
                      value={row.person_name}
                      disabled={!editable}
                      onChange={(event) =>
                        onFieldChange(row.row_number, "person_name", event.target.value)
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Company Name
                    </span>
                    <input
                      value={row.company_name}
                      disabled={!editable}
                      onChange={(event) =>
                        onFieldChange(row.row_number, "company_name", event.target.value)
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Email
                    </span>
                    <input
                      value={row.email}
                      disabled={!editable}
                      onChange={(event) =>
                        onFieldChange(row.row_number, "email", event.target.value)
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Purpose / Summary
                    </span>
                    <input
                      value={row.purpose}
                      disabled={!editable}
                      onChange={(event) =>
                        onFieldChange(row.row_number, "purpose", event.target.value)
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800"
                    />
                  </label>
                </div>

                {row.possible_candidates.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                    <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Existing People Candidates
                    </div>
                    <select
                      value={candidateValue}
                      disabled={!editable}
                      onChange={(event) => onCandidateChange(row.row_number, event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900 dark:disabled:bg-slate-800"
                    >
                      {row.possible_candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.label} — score {candidate.score}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {editable ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onActionChange(row.row_number, "matched")}
                      disabled={!canUseExisting}
                      className="inline-flex rounded-full border border-emerald-400 bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:border-slate-500 disabled:bg-slate-700 disabled:text-slate-300 dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950"
                    >
                      Use Existing Person
                    </button>
                    <button
                      type="button"
                      onClick={() => onActionChange(row.row_number, "create")}
                      disabled={!canCreate}
                      className="inline-flex rounded-full border border-blue-400 bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-slate-500 disabled:bg-slate-700 disabled:text-slate-300 dark:border-blue-500 dark:bg-blue-500 dark:text-slate-950"
                    >
                      Create Person
                    </button>
                    <button
                      type="button"
                      onClick={() => onActionChange(row.row_number, "skip")}
                      className="inline-flex rounded-full border border-rose-400 bg-rose-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-500 dark:border-rose-500 dark:bg-rose-500 dark:text-slate-950"
                    >
                      Skip / Source Fix
                    </button>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-300 md:grid-cols-2">
                  <div>
                    <span className="font-semibold">Interaction Date:</span>{" "}
                    {normalizeValue(row.interaction_date) || "Not provided"}
                  </div>
                  <div>
                    <span className="font-semibold">Interaction Type:</span>{" "}
                    {row.normalized_interaction_type || "Not resolved"}
                  </div>
                  <div>
                    <span className="font-semibold">Action:</span> {row.person_action}
                  </div>
                  <div>
                    <span className="font-semibold">Duplicate:</span> {row.duplicate_status}
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-semibold">Person Resolution:</span>{" "}
                    {row.matched_person_label ||
                      (row.person_action === "create"
                        ? "A new person will be created from this row."
                        : row.person_action === "possible"
                          ? "Possible match found. Review and choose how to proceed."
                          : "No person will be used.")}
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-semibold">Prepared Details:</span>
                    <div className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                      {row.prepared_details || "No details prepared"}
                    </div>
                  </div>
                </div>

                {row.completion_notes.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                    <div className="font-bold">Review Notes</div>
                    <ul className="mt-1 list-disc pl-5">
                      {row.completion_notes.map((note) => (
                        <li key={`${row.row_number}-${note}`}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {row.error_message ? (
                  <div className="mt-3 text-sm font-medium text-rose-700 dark:text-rose-300">
                    {row.error_message}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

export default function BulkInteractionsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [csvText, setCsvText] = useState("");
  const [parsedInput, setParsedInput] = useState<ParsedInputState | null>(null);
  const [headerMapping, setHeaderMapping] = useState<HeaderMapping>({});
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importFailures, setImportFailures] = useState<ImportFailure[]>([]);

  const readyRows = previewRows.filter((row) => row.preview_lane === "ready");
  const needsCompletionRows = previewRows.filter(
    (row) => row.preview_lane === "needs_completion",
  );
  const failedRows = previewRows.filter((row) => row.preview_lane === "failed");
  const matchedCount = previewRows.filter((row) => row.person_action === "matched").length;
  const createCount = previewRows.filter((row) => row.person_action === "create").length;
  const duplicateCount = previewRows.filter((row) => row.duplicate_status === "duplicate").length;
  const mappingValidation = validateHeaderMapping(headerMapping);
  const mappedFieldCount = Object.values(headerMapping).filter(Boolean).length;

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setCsvText(text);
    setParsedInput(null);
    setHeaderMapping({});
    setPreviewRows([]);
    setImportResult(null);
    setImportFailures([]);
    setMessage({
      tone: "info",
      text: `Loaded file: ${file.name}. Click Detect Headers to build the mapping table.`,
    });
  };

  const handleDetectHeaders = () => {
    setMessage(null);
    setImportResult(null);
    setPreviewRows([]);
    setImportFailures([]);

    try {
      const parsedRows = parseDelimitedText(csvText);

      if (parsedRows.length < 2) {
        setParsedInput(null);
        setHeaderMapping({});
        setMessage({
          tone: "error",
          text: "No importable rows found. Paste or upload a delimited file with a header row and at least one data row.",
        });
        return;
      }

      const headers = parsedRows[0];
      const dataRows = parsedRows.slice(1);

      if (headers.length === 0) {
        setParsedInput(null);
        setHeaderMapping({});
        setMessage({
          tone: "error",
          text: "Could not detect a header row.",
        });
        return;
      }

      const initialMapping = buildInitialHeaderMapping(headers);

      setParsedInput({ headers, dataRows });
      setHeaderMapping(initialMapping);

      const autoMappedCount = Object.values(initialMapping).filter(Boolean).length;

      setMessage({
        tone: "success",
        text: `Headers detected. ${headers.length} column(s) found and ${autoMappedCount} column(s) mapped automatically. Review mapping before previewing.`,
      });
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "Unknown parsing error.";
      setParsedInput(null);
      setHeaderMapping({});
      setPreviewRows([]);
      setImportFailures([]);
      setMessage({
        tone: "error",
        text: `Header detection failed. ${errorText}`,
      });
    }
  };

  const handleMappingChange = (header: string, value: string) => {
    setHeaderMapping((current) => ({
      ...current,
      [header]: value as AppField | "",
    }));
  };

  const handleResetAutoMapping = () => {
    if (!parsedInput) return;

    const initialMapping = buildInitialHeaderMapping(parsedInput.headers);
    setHeaderMapping(initialMapping);
    setPreviewRows([]);
    setImportResult(null);
    setImportFailures([]);
    setMessage({
      tone: "info",
      text: "Header mapping reset using automatic column suggestions.",
    });
  };

  const fetchDuplicateImportKeys = async (keys: string[]): Promise<Set<string>> => {
    const usableKeys = Array.from(new Set(keys.filter(Boolean)));
    if (usableKeys.length === 0) return new Set<string>();

    const { data, error } = await supabase
      .from("interactions")
      .select("import_key")
      .in("import_key", usableKeys);

    if (error) {
      throw new Error(
        `${error.message}. Confirm the import_key SQL migration has been run before previewing/importing.`,
      );
    }

    return new Set((data ?? []).map((row) => normalizeValue(row.import_key)));
  };

  const handlePreviewImport = async () => {
    setIsPreviewing(true);
    setMessage(null);
    setImportResult(null);
    setImportFailures([]);

    try {
      if (!parsedInput) {
        setPreviewRows([]);
        setMessage({
          tone: "error",
          text: "Detect headers first before previewing the import.",
        });
        return;
      }

      const { missingRequiredFields } = validateHeaderMapping(headerMapping);

      if (missingRequiredFields.length > 0) {
        setPreviewRows([]);
        setMessage({
          tone: "error",
          text: `Missing required field mapping: ${missingRequiredFields.join(", ")}`,
        });
        return;
      }

      const mappedRawRows = buildRawRowsFromMappedInput(parsedInput, headerMapping);

      const nonEmptyRows = mappedRawRows.filter((row) => {
        return (
          normalizeValue(row.person_name) ||
          normalizeValue(row.email) ||
          normalizeValue(row.purpose) ||
          normalizeValue(row.details)
        );
      });

      if (nonEmptyRows.length === 0) {
        setPreviewRows([]);
        setMessage({
          tone: "error",
          text: "The file was read successfully, but no non-empty interaction rows were found after mapping.",
        });
        return;
      }

      const { data: peopleData, error: peopleError } = await supabase
        .from("people")
        .select(
          "id, full_name, title, email, cell_phone, office_phone, company_name, national_name, supplier, state, address, account_id, is_kingpin, contact_type, legacy_contact_id, legacy_kingpin_id",
        )
        .limit(5000);

      if (peopleError) {
        setPreviewRows([]);
        setMessage({
          tone: "error",
          text: `Could not load people for matching. ${peopleError.message}`,
        });
        return;
      }

      const people = (peopleData ?? []) as PeopleLookupRow[];

      const builtPreviewRows: PreviewRow[] = nonEmptyRows.map((row, index) => {
        const possibleCandidates = dedupeCandidates(
          people
            .map((person) => scoreCandidateForRow(row, person))
            .filter((candidate): candidate is MatchCandidate => Boolean(candidate)),
        ).sort((a, b) => b.score - a.score);

        const classification = classifyRow(row, possibleCandidates);
        const matchedCandidate = classification.matchedCandidate;
        const normalizedInteractionType =
          normalizeInteractionType(row.interaction_type) || inferInteractionType(row);
        const importKey = buildImportKey(row);

        return {
          ...row,
          row_number: index + 2,
          person_action: classification.action,
          preview_lane: classification.lane,
          matched_person_id: matchedCandidate?.id ?? null,
          matched_person_label: matchedCandidate?.label ?? null,
          selected_possible_candidate_id: possibleCandidates[0]?.id ?? null,
          normalized_interaction_type: normalizedInteractionType,
          prepared_details: buildPreparedDetails(row),
          import_key: importKey,
          error_message: classification.errorMessage,
          completion_notes: classification.completionNotes,
          possible_candidates: possibleCandidates.slice(0, 6),
          can_create_person: classification.canCreatePerson,
          duplicate_status: "unchecked",
        };
      });

      const duplicateKeys = await fetchDuplicateImportKeys(
        builtPreviewRows.map((row) => row.import_key),
      );

      const rowsWithDuplicateStatus: PreviewRow[] = builtPreviewRows.map((row): PreviewRow => ({
        ...row,
        duplicate_status: duplicateKeys.has(row.import_key) ? "duplicate" : "new",
      }));

      setPreviewRows(rowsWithDuplicateStatus);
      setMessage({
        tone: "success",
        text: `Preview ready. ${rowsWithDuplicateStatus.length} row(s) parsed. Ready: ${rowsWithDuplicateStatus.filter((row) => row.preview_lane === "ready").length}. Needs Completion: ${rowsWithDuplicateStatus.filter((row) => row.preview_lane === "needs_completion").length}. Failed / Source Fix: ${rowsWithDuplicateStatus.filter((row) => row.preview_lane === "failed").length}. Duplicates already in Supabase: ${rowsWithDuplicateStatus.filter((row) => row.duplicate_status === "duplicate").length}.`,
      });
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "Unknown preview error.";
      setPreviewRows([]);
      setMessage({
        tone: "error",
        text: `Import preview failed. ${errorText}`,
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handlePreviewFieldChange = (
    rowNumber: number,
    field: keyof RawImportRow,
    value: string,
  ) => {
    setPreviewRows((current) =>
      current.map((row) => {
        if (row.row_number !== rowNumber) return row;
        const updated = rebuildPreviewRow({
          ...row,
          [field]: value,
        });
        return updated;
      }),
    );
  };

  const handlePreviewRowAction = (rowNumber: number, action: PersonAction) => {
    setPreviewRows((current) =>
      current.map((row) => {
        if (row.row_number !== rowNumber) return row;

        if (action === "skip") {
          return {
            ...row,
            person_action: "skip",
            preview_lane: "failed",
            matched_person_id: null,
            matched_person_label: null,
            error_message: "Row manually moved to Failed / Source Fix.",
            completion_notes: ["Fix this row in the source file, then re-run the importer."],
          };
        }

        if (action === "create") {
          if (!row.can_create_person) {
            return {
              ...row,
              person_action: "skip",
              preview_lane: "needs_completion",
              matched_person_id: null,
              matched_person_label: null,
              error_message:
                "Cannot create a new person from an email-only row or weak/junk name. Add a real person name first.",
              completion_notes: [
                "Add a real person name before creating a new person.",
              ],
            };
          }

          const updated = rebuildPreviewRow({
            ...row,
            person_action: "create",
            matched_person_id: null,
            matched_person_label: null,
          });

          return {
            ...updated,
            person_action: "create",
            preview_lane: updated.completion_notes.length > 0 ? "needs_completion" : "ready",
            matched_person_id: null,
            matched_person_label: null,
          };
        }

        if (action === "possible") {
          return {
            ...row,
            person_action: "possible",
            preview_lane: "needs_completion",
            matched_person_id: null,
            matched_person_label: null,
            error_message: "Possible existing person found. Review before importing.",
            completion_notes: [
              "Choose Use Existing Person if the selected candidate is correct, or Create Person if this is a different person.",
            ],
          };
        }

        if (action === "matched") {
          const selectedCandidate = row.possible_candidates.find(
            (candidate) => candidate.id === row.selected_possible_candidate_id,
          );

          if (!selectedCandidate) {
            return {
              ...row,
              preview_lane: "needs_completion",
              error_message: "No existing person is currently selected for this row.",
              completion_notes: ["Select an existing person candidate before using this action."],
            };
          }

          const updated = rebuildPreviewRow({
            ...row,
            person_action: "matched",
            matched_person_id: selectedCandidate.id,
            matched_person_label: selectedCandidate.label,
          });

          return {
            ...updated,
            person_action: "matched",
            preview_lane: updated.completion_notes.length > 0 ? "needs_completion" : "ready",
            matched_person_id: selectedCandidate.id,
            matched_person_label: selectedCandidate.label,
          };
        }

        return row;
      }),
    );
  };

  const handleCandidateSelectionChange = (rowNumber: number, value: string) => {
    setPreviewRows((current) =>
      current.map((row) => {
        if (row.row_number !== rowNumber) return row;

        const selectedCandidate = row.possible_candidates.find(
          (candidate) => candidate.id === value,
        );

        if (!selectedCandidate) return row;

        return rebuildPreviewRow({
          ...row,
          selected_possible_candidate_id: selectedCandidate.id,
          ...(row.person_action === "matched"
            ? {
                matched_person_id: selectedCandidate.id,
                matched_person_label: selectedCandidate.label,
              }
            : {}),
        });
      }),
    );
  };

  const handleImportRows = async () => {
    const importableRows = previewRows.filter((row) => {
      const hasPurpose = Boolean(normalizeValue(row.purpose));
      const hasIdentity = Boolean(isValidEmail(row.email) || !isWeakOrJunkName(row.person_name));
      const statusAllowsImport = row.person_action === "matched" || row.person_action === "create";
      return row.preview_lane === "ready" && statusAllowsImport && hasPurpose && hasIdentity;
    });

    if (importableRows.length === 0) {
      setMessage({
        tone: "error",
        text: "There are no Ready to Import rows. Complete or resolve rows first.",
      });
      return;
    }

    setIsImporting(true);
    setMessage(null);
    setImportResult(null);
    setImportFailures([]);

    let imported = 0;
    let createdPeople = 0;
    let matchedPeople = 0;
    let duplicatesSkipped = 0;
    let failed = 0;
    const failures: ImportFailure[] = [];

    try {
      const duplicateKeys = await fetchDuplicateImportKeys(importableRows.map((row) => row.import_key));

      for (const row of importableRows) {
        try {
          if (duplicateKeys.has(row.import_key)) {
            duplicatesSkipped += 1;
            failures.push({
              row_number: row.row_number,
              person_name: normalizeValue(row.person_name),
              company_name: normalizeValue(row.company_name),
              interaction_type: row.normalized_interaction_type,
              stage: "duplicate",
              message: "Skipped because import_key already exists in interactions.",
            });
            continue;
          }

          let personId = row.matched_person_id;

          if (!normalizeValue(row.purpose)) {
            failed += 1;
            failures.push({
              row_number: row.row_number,
              person_name: normalizeValue(row.person_name),
              company_name: normalizeValue(row.company_name),
              interaction_type: row.normalized_interaction_type,
              stage: "validation",
              message: "Purpose is blank after normalization.",
            });
            continue;
          }

          if (!row.normalized_interaction_type) {
            failed += 1;
            failures.push({
              row_number: row.row_number,
              person_name: normalizeValue(row.person_name),
              company_name: normalizeValue(row.company_name),
              interaction_type: "",
              stage: "validation",
              message: "Interaction type could not be resolved.",
            });
            continue;
          }

          if (row.person_action === "matched" && personId) {
            matchedPeople += 1;
          }

          if (!personId && row.person_action === "create") {
            if (!row.can_create_person || isWeakOrJunkName(row.person_name)) {
              failed += 1;
              failures.push({
                row_number: row.row_number,
                person_name: normalizeValue(row.person_name),
                company_name: normalizeValue(row.company_name),
                interaction_type: row.normalized_interaction_type,
                stage: "validation",
                message:
                  "Blocked unsafe Create Person action. New people require a usable real person name.",
              });
              continue;
            }

            const personPayload = {
              full_name: normalizeValue(row.person_name),
              title: normalizeValue(row.title) || null,
              email: isValidEmail(row.email) ? normalizeEmail(row.email) : null,
              cell_phone: normalizeValue(row.cell_phone) || null,
              office_phone: normalizeValue(row.office_phone) || null,
              company_name: normalizeValue(row.company_name) || null,
              national_name: null,
              supplier: null,
              state: normalizeValue(row.state) || null,
              address: normalizeValue(row.address) || null,
              account_id: null,
              is_kingpin: false,
              contact_type: "Contact",
              legacy_contact_id: null,
              legacy_kingpin_id: null,
            };

            const { data: createdPerson, error: createPersonError } = await supabase
              .from("people")
              .insert(personPayload)
              .select("id")
              .single();

            if (createPersonError || !createdPerson?.id) {
              failed += 1;
              failures.push({
                row_number: row.row_number,
                person_name: normalizeValue(row.person_name),
                company_name: normalizeValue(row.company_name),
                interaction_type: row.normalized_interaction_type,
                stage: "person_create",
                message:
                  createPersonError?.message ||
                  "Person creation failed without a returned person id.",
              });
              continue;
            }

            personId = createdPerson.id;
            createdPeople += 1;
          }

          if (!personId) {
            failed += 1;
            failures.push({
              row_number: row.row_number,
              person_name: normalizeValue(row.person_name),
              company_name: normalizeValue(row.company_name),
              interaction_type: row.normalized_interaction_type,
              stage: "person_lookup",
              message: "No person_id was resolved for this row.",
            });
            continue;
          }

          const interactionPayload = {
            person_id: personId,
            date: normalizeDateForImport(row.interaction_date),
            type: row.normalized_interaction_type,
            summary: normalizeValue(row.purpose),
            details: normalizeValue(row.prepared_details) || null,
            stage: normalizedStageForImport(row.stage),
            import_key: row.import_key,
          };

          const { error: interactionError } = await supabase
            .from("interactions")
            .insert(interactionPayload);

          if (interactionError) {
            if (
              interactionError.code === "23505" ||
              interactionError.message.toLowerCase().includes("duplicate")
            ) {
              duplicatesSkipped += 1;
              duplicateKeys.add(row.import_key);
              failures.push({
                row_number: row.row_number,
                person_name: normalizeValue(row.person_name),
                company_name: normalizeValue(row.company_name),
                interaction_type: row.normalized_interaction_type,
                stage: "duplicate",
                message: "Skipped duplicate import_key during insert.",
              });
            } else {
              failed += 1;
              failures.push({
                row_number: row.row_number,
                person_name: normalizeValue(row.person_name),
                company_name: normalizeValue(row.company_name),
                interaction_type: row.normalized_interaction_type,
                stage: "interaction_insert",
                message: interactionError.message,
              });
            }
          } else {
            imported += 1;
            duplicateKeys.add(row.import_key);
          }
        } catch (error) {
          failed += 1;
          failures.push({
            row_number: row.row_number,
            person_name: normalizeValue(row.person_name),
            company_name: normalizeValue(row.company_name),
            interaction_type: row.normalized_interaction_type,
            stage: "interaction_insert",
            message: error instanceof Error ? error.message : "Unknown import error.",
          });
        }
      }
    } catch (error) {
      failed += importableRows.length;
      failures.push({
        row_number: 0,
        person_name: "",
        company_name: "",
        interaction_type: "",
        stage: "validation",
        message: error instanceof Error ? error.message : "Unknown duplicate-check error.",
      });
    }

    const skipped = previewRows.length - importableRows.length;

    setImportResult({
      imported,
      created_people: createdPeople,
      matched_people: matchedPeople,
      duplicates_skipped: duplicatesSkipped,
      skipped,
      failed,
    });
    setImportFailures(failures);

    setMessage({
      tone: failed > 0 ? "info" : "success",
      text: `Import complete. Imported: ${imported}. New people created: ${createdPeople}. Existing people matched: ${matchedPeople}. Duplicates skipped: ${duplicatesSkipped}. Not ready/skipped: ${skipped}. Failed: ${failed}.`,
    });

    setIsImporting(false);
  };

  return (
    <HubShell
      title="Bulk Interactions Import"
      subtitle="Paste or upload a CSV or tab-delimited text file, map its headers, preview rows in a 3-lane safety workflow, complete near-misses inline, and import deduplicated interactions."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(440px,560px)_minmax(0,1fr)]">
        <div className="grid gap-6">
          <SectionCard
            title="Import Setup"
            description="Use the standard template, or paste/upload the cleaned CSV from data/bulk_interactions_import.csv. Then detect headers and map columns before previewing."
          >
            <div className="flex flex-wrap gap-3">
              <PrimaryButton onClick={() => downloadTemplateCsv()}>
                Download Template CSV
              </PrimaryButton>

              <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-blue-500 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-400 dark:hover:text-blue-400">
                Upload CSV / TXT
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              <SecondaryButton
                onClick={() => {
                  setCsvText("");
                  setParsedInput(null);
                  setHeaderMapping({});
                  setPreviewRows([]);
                  setImportResult(null);
                  setImportFailures([]);
                  setMessage(null);
                }}
              >
                Clear
              </SecondaryButton>
            </div>

            <div className="mt-5">
              <TextArea
                label="Paste Box"
                value={csvText}
                onChange={setCsvText}
                rows={16}
                placeholder={`interaction_date,person_name,email,company_name,interaction_type,purpose,details,data_source
2026-04-10,Jane Doe,jane@example.com,Example Cooperative,Email,Follow up on CONVERGENCE trial,Shared trial summary and requested next step,bulk_interactions_import.csv`}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <PrimaryButton onClick={handleDetectHeaders} disabled={isPreviewing || isImporting}>
                Detect Headers
              </PrimaryButton>

              <PrimaryButton
                onClick={handlePreviewImport}
                disabled={!parsedInput || isPreviewing || isImporting}
              >
                {isPreviewing ? "Previewing..." : "Preview Import"}
              </PrimaryButton>

              <SecondaryButton
                onClick={handleImportRows}
                type="button"
                disabled={readyRows.length === 0 || isImporting || isPreviewing}
              >
                {isImporting ? "Importing..." : `Import Ready Rows (${readyRows.length})`}
              </SecondaryButton>
            </div>

            {message ? (
              <div className="mt-4">
                <StatusMessage message={message.text} tone={message.tone} />
              </div>
            ) : null}

            {importResult ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                <SummaryStatCard label="Imported" value={importResult.imported} />
                <SummaryStatCard label="New People" value={importResult.created_people} />
                <SummaryStatCard label="Matched People" value={importResult.matched_people} />
                <SummaryStatCard label="Duplicates Skipped" value={importResult.duplicates_skipped} />
                <SummaryStatCard label="Skipped" value={importResult.skipped} />
                <SummaryStatCard label="Failed" value={importResult.failed} />
              </div>
            ) : null}
          </SectionCard>

          {!parsedInput ? (
            <SectionCard
              title="Header Mapping"
              description="Detect headers first. Then map contact fields separately from interaction fields."
            >
              <StatusMessage
                message="No headers detected yet. Paste or upload a file, then click Detect Headers."
                tone="info"
              />
            </SectionCard>
          ) : (
            <>
              <SectionCard
                title="Mapping Overview"
                description="Review the detected columns and reset automatic suggestions if needed. Option A validation happens at preview: valid email OR usable name, plus purpose."
              >
                <div className="mb-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <SummaryStatCard label="Detected Headers" value={parsedInput.headers.length} />
                  <SummaryStatCard label="Mapped Columns" value={mappedFieldCount} />
                  <SummaryStatCard label="Data Rows" value={parsedInput.dataRows.length} />
                </div>

                <div className="mb-4 flex flex-wrap gap-3">
                  <SecondaryButton onClick={handleResetAutoMapping}>
                    Reset Auto-Mapping
                  </SecondaryButton>
                </div>

                {mappingValidation.missingRequiredFields.length > 0 ? (
                  <StatusMessage
                    tone="error"
                    message={`Required field mapping still needed: ${mappingValidation.missingRequiredFields.join(", ")}`}
                  />
                ) : (
                  <StatusMessage
                    tone="success"
                    message="Required mapping is complete. You can preview the import."
                  />
                )}
              </SectionCard>

              <FieldGroupSection
                title="Contact Fields"
                description="These fields enrich matched or newly created people. New people are only created when the row has a usable real person name."
                fields={CONTACT_FIELDS}
                parsedInput={parsedInput}
                headerMapping={headerMapping}
                onChange={handleMappingChange}
              />

              <FieldGroupSection
                title="Interaction Fields"
                description="These fields populate the interaction record. Multiple source columns may map to Details and will be appended."
                fields={INTERACTION_FIELDS}
                parsedInput={parsedInput}
                headerMapping={headerMapping}
                onChange={handleMappingChange}
              />
            </>
          )}
        </div>

        <div className="grid gap-6">
          <SectionCard
            title="3-Lane Preview Summary"
            description="Rows are sorted into Ready to Import, Needs Completion, and Failed / Source Fix before anything is written to Supabase."
          >
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              <SummaryStatCard label="Parsed Rows" value={previewRows.length} />
              <SummaryStatCard label="Ready" value={readyRows.length} />
              <SummaryStatCard label="Needs Completion" value={needsCompletionRows.length} />
              <SummaryStatCard label="Failed / Source Fix" value={failedRows.length} />
              <SummaryStatCard label="Matched" value={matchedCount} />
              <SummaryStatCard label="Create Person" value={createCount} />
            </div>
            {duplicateCount > 0 ? (
              <div className="mt-4">
                <StatusMessage
                  tone="info"
                  message={`${duplicateCount} row(s) already appear to exist by import_key and will be skipped safely.`}
                />
              </div>
            ) : null}
          </SectionCard>

          {previewRows.length === 0 ? (
            <SectionCard
              title="Preview Rows"
              description="Detect headers, confirm mapping, and click Preview Import."
            >
              <StatusMessage
                message="No preview rows yet."
                tone="info"
              />
            </SectionCard>
          ) : (
            <div className="grid gap-6">
              <PreviewLaneCard
                title={`Ready to Import (${readyRows.length})`}
                description="These rows meet Option A validation and will not create weak email-only people. Duplicate import_keys will be skipped during import."
                rows={readyRows}
                emptyMessage="No ready rows yet."
                editable={false}
                onFieldChange={handlePreviewFieldChange}
                onActionChange={handlePreviewRowAction}
                onCandidateChange={handleCandidateSelectionChange}
              />

              <PreviewLaneCard
                title={`Needs Completion (${needsCompletionRows.length})`}
                description="Edit person name, company name, email, or purpose inline. Once complete, the row moves into Ready to Import."
                rows={needsCompletionRows}
                emptyMessage="No rows need completion."
                editable
                onFieldChange={handlePreviewFieldChange}
                onActionChange={handlePreviewRowAction}
                onCandidateChange={handleCandidateSelectionChange}
              />

              <PreviewLaneCard
                title={`Failed / Source Fix (${failedRows.length})`}
                description="These rows are too incomplete or were manually rejected. Fix them in the source CSV and re-run."
                rows={failedRows}
                emptyMessage="No failed rows."
                editable={false}
                onFieldChange={handlePreviewFieldChange}
                onActionChange={handlePreviewRowAction}
                onCandidateChange={handleCandidateSelectionChange}
              />
            </div>
          )}

          <FailureList failures={importFailures} />
        </div>
      </div>
    </HubShell>
  );
}
