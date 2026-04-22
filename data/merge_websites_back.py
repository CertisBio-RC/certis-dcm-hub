from __future__ import annotations

import csv
from pathlib import Path

SOURCE_FILE = "RC Channel Accounts - COMBINED.txt"
RETAILER_WEBSITES_FILE = "retailers_with_websites.tsv"
OUTPUT_FILE = "RC Channel Accounts - UPDATED.txt"
DELIMITER = "\t"


def normalize_key(value: str) -> str:
    return value.strip().casefold()


def main() -> None:
    working_dir = Path.cwd()
    source_path = working_dir / SOURCE_FILE
    retailer_websites_path = working_dir / RETAILER_WEBSITES_FILE
    output_path = working_dir / OUTPUT_FILE

    print(f"Working directory: {working_dir}")
    print(f"Looking for source file: {source_path}")
    print(f"Looking for retailer websites file: {retailer_websites_path}")

    if not source_path.exists():
        raise FileNotFoundError(f"Source file not found: {source_path}")

    if not retailer_websites_path.exists():
        raise FileNotFoundError(
            f"Retailer website file not found: {retailer_websites_path}"
        )

    with retailer_websites_path.open("r", encoding="cp1252", errors="replace", newline="") as infile:
        retailer_reader = csv.DictReader(infile, delimiter=DELIMITER)

        if retailer_reader.fieldnames is None:
            raise ValueError("Retailer website file has no header row.")

        if "Retailer" not in retailer_reader.fieldnames:
            raise ValueError("Retailer website file must contain a 'Retailer' column.")

        if "Website" not in retailer_reader.fieldnames:
            raise ValueError("Retailer website file must contain a 'Website' column.")

        retailer_to_website: dict[str, str] = {}

        for row in retailer_reader:
            retailer = (row.get("Retailer") or "").strip()
            website = (row.get("Website") or "").strip()

            if not retailer:
                continue

            retailer_to_website[normalize_key(retailer)] = website

    with source_path.open("r", encoding="cp1252", errors="replace", newline="") as infile:
        source_reader = csv.DictReader(infile, delimiter=DELIMITER)

        if source_reader.fieldnames is None:
            raise ValueError("Source file has no header row.")

        fieldnames = list(source_reader.fieldnames)

        if "Retailer" not in fieldnames:
            raise ValueError("Source file must contain a 'Retailer' column.")

        if "Website" not in fieldnames:
            fieldnames.append("Website")

        updated_rows: list[dict[str, str]] = []
        updated_count = 0

        for row in source_reader:
            retailer = (row.get("Retailer") or "").strip()
            existing_website = (row.get("Website") or "").strip()

            matched_website = retailer_to_website.get(normalize_key(retailer), "")
            final_website = matched_website or existing_website

            if final_website != existing_website:
                updated_count += 1

            row["Website"] = final_website
            updated_rows.append(dict(row))

    with output_path.open("w", encoding="utf-8", newline="") as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames, delimiter=DELIMITER)
        writer.writeheader()
        writer.writerows(updated_rows)

    print(f"Rows processed: {len(updated_rows)}")
    print(f"Rows updated with website values: {updated_count}")
    print(f"Output written to: {output_path}")


if __name__ == "__main__":
    main()