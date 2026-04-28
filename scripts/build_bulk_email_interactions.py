from pathlib import Path
import csv
import re
from datetime import datetime
from email.utils import getaddresses
import extract_msg

INPUT_FOLDER = Path(r"C:\Users\jbailey\certis_dcm_hub\data\bulk_emails")
OUTPUT_CSV = Path(r"C:\Users\jbailey\certis_dcm_hub\data\bulk_interactions_import.csv")

DEFAULT_TYPE = "email"
CERTIS_DOMAIN = "@certisbio.com"

EXCLUDED_EMAILS = {
    "john_d_bailey@msn.com",
    "staceybscreations@gmail.com",
}


def clean_text(text):
    if not text:
        return ""
    text = str(text).replace("\x00", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip().strip("'").strip('"').strip()


def is_certis_email(email_address):
    return clean_text(email_address).lower().endswith(CERTIS_DOMAIN)


def is_excluded_email(email_address):
    return clean_text(email_address).lower() in EXCLUDED_EMAILS


def looks_like_email(value):
    return bool(re.fullmatch(r"[\w\.-]+@[\w\.-]+\.\w+", clean_text(value).lower()))


def clean_display_name(name, email_address):
    name = clean_text(name)

    if not name:
        return ""

    if looks_like_email(name):
        return ""

    if "@" in name:
        return ""

    name = re.sub(r"\([^)]*@[^)]*\)", "", name).strip()
    name = re.sub(r"^['\";,\s]+|['\";,\s]+$", "", name).strip()

    if len(name) <= 1:
        return ""

    if name.lower() in {"eric", "ivan", "john d. bailey", "john bailey"}:
        return ""

    return name


def split_recipient_chunks(raw):
    raw = clean_text(raw)
    if not raw:
        return []

    raw = raw.replace("\n", ";")
    chunks = re.split(r";+", raw)

    clean_chunks = []
    for chunk in chunks:
        chunk = clean_text(chunk)
        if chunk:
            clean_chunks.append(chunk)

    return clean_chunks


def extract_names_and_emails(raw):
    results = []

    for chunk in split_recipient_chunks(raw):
        parsed_addresses = getaddresses([chunk])

        for parsed_name, parsed_email in parsed_addresses:
            email_clean = clean_text(parsed_email).lower()

            if not looks_like_email(email_clean):
                inline_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", chunk)
                if not inline_match:
                    continue

                email_clean = inline_match.group(0).lower()
                possible_name = chunk.replace(email_clean, "")
                possible_name = possible_name.replace("<", "").replace(">", "")
                parsed_name = possible_name

            name_clean = clean_display_name(parsed_name, email_clean)

            if not any(row["email"] == email_clean for row in results):
                results.append({
                    "name": name_clean,
                    "email": email_clean,
                })

    return results


def parse_msg_date(raw_date):
    raw = clean_text(raw_date)

    if not raw:
        return ""

    try:
        parsed = datetime.strptime(raw[:25], "%a, %d %b %Y %H:%M:%S")
        return parsed.date().isoformat()
    except Exception:
        pass

    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return parsed.date().isoformat()
    except Exception:
        return ""


def normalize_subject(subject):
    subject = clean_text(subject)
    subject = re.sub(r"^(\s*(re|fw|fwd)\s*:\s*)+", "", subject, flags=re.IGNORECASE)
    return subject.strip()


def trim_reply_chain(body):
    text = clean_text(body)

    cut_patterns = [
        r"\bFrom:\s",
        r"\bSent:\s",
        r"\bTo:\s",
        r"\bSubject:\s",
        r"-----Original Message-----",
        r"On .* wrote:",
    ]

    cut_positions = []

    for pattern in cut_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match and match.start() > 50:
            cut_positions.append(match.start())

    if cut_positions:
        text = text[: min(cut_positions)].strip()

    return text


def infer_stage(subject, body):
    text = f"{subject} {body}".lower()

    adoption_terms = [
        "we are selling",
        "we're selling",
        "started selling",
        "actively selling",
        "selling convergence",
        "selling lifegard",
        "stocking convergence",
        "stocking lifegard",
        "carrying convergence",
        "carrying lifegard",
        "customer orders are coming in",
    ]

    evaluation_terms = [
        "yes, we want to do trials",
        "we want to do trials",
        "going to do trials",
        "plan to run trials",
        "planning to run trials",
        "set up a trial",
        "set up trials",
        "let's do a trial",
        "lets do a trial",
        "send us enough",
        "send enough",
        "enough for 40 acres",
        "enough for forty acres",
        "enough for 80 acres",
        "enough for eighty acres",
        "we will run",
        "we are going to run",
        "we're going to run",
        "we'll run",
        "we would like to run",
        "we want to run",
        "we can run",
        "we could run",
        "confirmed trial",
        "trial confirmed",
        "demo product request",
        "requesting demo product",
    ]

    technical_training_terms = [
        "results",
        "result",
        "performance data",
        "yield data",
        "roi",
        "training",
        "technical",
        "webinar",
        "presentation",
        "tar spot",
        "white mold",
        "pythium",
        "rhizoctonia",
        "fusarium",
        "phytophthora",
        "disease pressure",
        "biofungicide",
    ]

    if any(term in text for term in adoption_terms):
        return "adoption"

    if any(term in text for term in evaluation_terms):
        return "field_evaluation"

    if any(term in text for term in technical_training_terms):
        return "technical_training"

    return "introduction"


def infer_summary(subject):
    cleaned = normalize_subject(subject)
    return cleaned if cleaned else "Kingpin outreach email"


def parse_msg(file_path):
    try:
        msg = extract_msg.Message(file_path)

        msg_sender = clean_text(msg.sender)
        msg_to = clean_text(msg.to)
        msg_cc = clean_text(msg.cc)
        msg_date = clean_text(msg.date)
        msg_subject = clean_text(msg.subject)
        msg_body_raw = clean_text(msg.body)

        date_out = parse_msg_date(msg_date)
        summary = infer_summary(msg_subject)
        details = trim_reply_chain(msg_body_raw)
        stage = infer_stage(summary, details)

        recipients = extract_names_and_emails(msg_to) + extract_names_and_emails(msg_cc)

        external_recipients = []
        seen_emails = set()

        for recipient in recipients:
            recipient_email = clean_text(recipient.get("email")).lower()

            if not recipient_email:
                continue

            if is_certis_email(recipient_email):
                continue

            if is_excluded_email(recipient_email):
                continue

            if recipient_email in seen_emails:
                continue

            seen_emails.add(recipient_email)
            external_recipients.append({
                "name": clean_text(recipient.get("name")),
                "email": recipient_email,
            })

        if not external_recipients:
            return []

        rows = []

        for recipient in external_recipients:
            rows.append({
                "date": date_out,
                "full_name": recipient["name"],
                "email": recipient["email"],
                "company_name": "",
                "type": DEFAULT_TYPE,
                "stage": stage,
                "summary": summary,
                "details": details,
                "outcome": "",
                "follow_up_date": "",
                "source_file": file_path.name,
                "from": msg_sender,
                "to": msg_to,
            })

        return rows

    except Exception as error:
        print(f"Error parsing {file_path.name}: {error}")
        return []


def main():
    all_rows = []

    files = sorted(INPUT_FOLDER.glob("*.msg"))
    print(f"Found {len(files)} .msg files")

    for file_path in files:
        rows = parse_msg(file_path)
        all_rows.extend(rows)

    fieldnames = [
        "date",
        "full_name",
        "email",
        "company_name",
        "type",
        "stage",
        "summary",
        "details",
        "outcome",
        "follow_up_date",
        "source_file",
        "from",
        "to",
    ]

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8-sig") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\nCSV created: {OUTPUT_CSV}")
    print(f"Total interaction rows: {len(all_rows)}")


if __name__ == "__main__":
    main()