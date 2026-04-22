"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HubShell,
  Input,
  PrimaryButton,
  RecordBadge,
  SectionCard,
  Select,
  StatusMessage,
  TextArea,
  createClient,
} from "@/components/hub-shared";

type QuoteRecord = {
  id: string;
  quote_text: string;
  source_name: string | null;
  source_company: string | null;
  category: string | null;
  sentiment: "negative" | "neutral" | "positive";
  notes: string | null;
  created_at?: string | null;
};

function sentimentClasses(sentiment: QuoteRecord["sentiment"]): string {
  if (sentiment === "positive") {
    return "border-[#3ea96f] bg-[#123825] text-[#baf5d1]";
  }

  if (sentiment === "neutral") {
    return "border-[#9a8a3c] bg-[#3a3212] text-[#ffe59b]";
  }

  return "border-[#9b4658] bg-[#381823] text-[#ffc2cf]";
}

export default function NotableQuotablesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [quoteText, setQuoteText] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceCompany, setSourceCompany] = useState("");
  const [category, setCategory] = useState("testimonial");
  const [sentiment, setSentiment] = useState<QuoteRecord["sentiment"]>("neutral");
  const [notes, setNotes] = useState("");

  const [records, setRecords] = useState<QuoteRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const loadRecords = async () => {
    const { data, error } = await supabase
      .from("notable_quotables")
      .select("id, quote_text, source_name, source_company, category, sentiment, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setMessage({ tone: "error", text: `Could not load notable quotables. ${error.message}` });
      return;
    }

    setRecords((data ?? []) as QuoteRecord[]);
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const handleSave = async () => {
    if (!quoteText.trim()) {
      setMessage({ tone: "error", text: "Enter a quote or field observation before saving." });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.from("notable_quotables").insert({
      quote_text: quoteText.trim(),
      source_name: sourceName.trim() || null,
      source_company: sourceCompany.trim() || null,
      category,
      sentiment,
      notes: notes.trim() || null,
    });

    if (error) {
      setMessage({ tone: "error", text: `Could not save notable quotable. ${error.message}` });
      setIsSaving(false);
      return;
    }

    setQuoteText("");
    setSourceName("");
    setSourceCompany("");
    setCategory("testimonial");
    setSentiment("neutral");
    setNotes("");
    setMessage({ tone: "success", text: "Notable quotable saved successfully." });
    setIsSaving(false);
    await loadRecords();
  };

  return (
    <HubShell
      title="Notable Quotables"
      subtitle="Capture field quotes, objections, reactions, and market intelligence with sentiment tagging."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Notable Quotables"
          description="Capture testimonials, objections, product or company reactions, and marketing ideas heard from the field."
        >
          <div className="grid gap-4">
            <TextArea
              label="Quote / Observation"
              value={quoteText}
              onChange={setQuoteText}
              rows={5}
              placeholder='Example: "James Klein from Boone County Iowa really likes our CONVERGENCE® BioFungicide sell sheet."'
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Source Name" value={sourceName} onChange={setSourceName} />
              <Input label="Source Company" value={sourceCompany} onChange={setSourceCompany} />
              <Select
                label="Category"
                value={category}
                onChange={setCategory}
                options={[
                  { value: "testimonial", label: "Testimonial" },
                  { value: "objection", label: "Objection" },
                  { value: "reaction", label: "Product / Company Reaction" },
                  { value: "marketing_idea", label: "Marketing Idea" },
                  { value: "other", label: "Other" },
                ]}
              />
              <Select
                label="Sentiment"
                value={sentiment}
                onChange={(value) => setSentiment(value as QuoteRecord["sentiment"])}
                options={[
                  { value: "negative", label: "Negative" },
                  { value: "neutral", label: "Neutral" },
                  { value: "positive", label: "Positive" },
                ]}
              />
            </div>

            <TextArea
              label="Notes"
              value={notes}
              onChange={setNotes}
              rows={4}
              placeholder="Any follow-up context, product implications, or added commentary."
            />

            <div className="flex flex-wrap gap-3">
              <PrimaryButton onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Entry"}
              </PrimaryButton>
            </div>

            {message ? <StatusMessage message={message.text} tone={message.tone} /> : null}
          </div>
        </SectionCard>

        <SectionCard
          title="Recent Entries"
          description="Latest notable quotables saved to the table."
        >
          <div className="grid gap-3">
            {records.map((record) => (
              <div key={record.id} className={`rounded-2xl border p-4 ${sentimentClasses(record.sentiment)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <RecordBadge>{record.category || "uncategorized"}</RecordBadge>
                  <RecordBadge>{record.sentiment}</RecordBadge>
                </div>

                <div className="mt-3 text-base font-extrabold leading-relaxed">
                  “{record.quote_text}”
                </div>

                <div className="mt-2 text-sm">
                  {[record.source_name, record.source_company].filter(Boolean).join(" · ") || "No source provided"}
                </div>

                {record.notes ? <div className="mt-2 text-sm">{record.notes}</div> : null}
              </div>
            ))}

            {records.length === 0 ? (
              <StatusMessage message="No notable quotables saved yet." tone="info" />
            ) : null}
          </div>
        </SectionCard>
      </div>
    </HubShell>
  );
}