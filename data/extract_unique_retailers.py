from __future__ import annotations

import csv
from pathlib import Path

INPUT_FILE = "RC Channel Accounts - COMBINED.txt"
OUTPUT_FILE = "retailers_unique.tsv"
DELIMITER = "\t"


def main() -> None:
    input_path = Path(INPUT_FILE)
    output_path = Path(OUTPUT_FILE)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path.resolve()}")

    with input_path.open("r", encoding="cp1252", errors="replace", newline="") as infile:
        reader = csv.DictReader(infile, delimiter=DELIMITER)

        if reader.fieldnames is None:
            raise ValueError("Input file has no header row.")

        required_columns = {"Retailer", "Long Name", "Suppliers", "Website"}
        missing = required_columns - set(reader.fieldnames)
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

        retailer_map: dict[str, dict[str, str]] = {}

        for row in reader:
            retailer = (row.get("Retailer") or "").strip()
            if not retailer:
                continue

            long_name = (row.get("Long Name") or "").strip()
            suppliers = (row.get("Suppliers") or "").strip()
            website = (row.get("Website") or "").strip()

            if retailer not in retailer_map:
                retailer_map[retailer] = {
                    "Retailer": retailer,
                    "Long Name": long_name,
                    "Suppliers": suppliers,
                    "Website": website,
                }
            else:
                existing = retailer_map[retailer]

                if not existing["Long Name"] and long_name:
                    existing["Long Name"] = long_name

                if not existing["Suppliers"] and suppliers:
                    existing["Suppliers"] = suppliers

                if not existing["Website"] and website:
                    existing["Website"] = website

    sorted_rows = sorted(
        retailer_map.values(),
        key=lambda item: (item["Retailer"].lower(), item["Long Name"].lower()),
    )

    with output_path.open("w", encoding="utf-8", newline="") as outfile:
        fieldnames = ["Retailer", "Long Name", "Suppliers", "Website"]
        writer = csv.DictWriter(outfile, fieldnames=fieldnames, delimiter=DELIMITER)
        writer.writeheader()
        writer.writerows(sorted_rows)

    print(f"Unique retailers extracted: {len(sorted_rows)}")
    print(f"Output written to: {output_path.resolve()}")


if __name__ == "__main__":
    main()