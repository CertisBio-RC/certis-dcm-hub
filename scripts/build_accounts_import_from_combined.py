import os
import re
import sys
import hashlib
import pandas as pd

# =============================================================================
# CERTIS DCM HUB
# BUILD accounts_import.csv FROM retailers combined workbook
#
# Input:
#   data/Channel Partners and Kingpins Map - COMBINED.xlsx
#
# Output:
#   data/accounts_import.csv
#
# Purpose:
# - Read the canonical combined retailers workbook
# - Normalize headers
# - Preserve the shared truth fields
# - Generate a stable account_key for Hub relational use
# - Output a clean CSV ready for Supabase import
# =============================================================================

INPUT_FILE = os.path.join("data", "Channel Partners and Kingpins Map - COMBINED.xlsx")
OUTPUT_FILE = os.path.join("data", "accounts_import.csv")

CANON_COLS = [
    "Long Name",
    "Retailer",
    "Name",
    "Address",
    "City",
    "State",
    "Zip",
    "Category",
    "Suppliers",
]

OUTPUT_COLS = [
    "source_system",
    "source_file",
    "source_sheet",
    "source_row_number",
    "account_key",
    "long_name",
    "retailer",
    "name",
    "address",
    "city",
    "state",
    "zip",
    "category",
    "suppliers",
    "is_active",
]

ALIASES = {
    "long name": "Long Name",
    "longname": "Long Name",
    "long_name": "Long Name",
    "long-name": "Long Name",
    "retailer": "Retailer",
    "name": "Name",
    "location": "Name",
    "address": "Address",
    "street": "Address",
    "city": "City",
    "state": "State",
    "zip": "Zip",
    "zipcode": "Zip",
    "zip code": "Zip",
    "category": "Category",
    "categories": "Category",
    "supplier": "Suppliers",
    "suppliers": "Suppliers",
}


def norm_text(value) -> str:
    if value is None:
        return ""
    if pd.isna(value):
        return ""
    text = str(value).replace("\ufeff", "").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def norm_header(value) -> str:
    return norm_text(value)


def alias_key(value) -> str:
    return norm_header(value).lower()


def canonicalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    rename_map = {}
    canon_lower_map = {c.lower(): c for c in CANON_COLS}

    for col in df.columns:
        key = alias_key(col)

        if key in ALIASES:
            rename_map[col] = ALIASES[key]
        elif key in canon_lower_map:
            rename_map[col] = canon_lower_map[key]
        else:
            rename_map[col] = norm_header(col)

    df = df.rename(columns=rename_map)

    if df.columns.duplicated().any():
        dedup = {}
        for col in df.columns:
            if col not in dedup:
                dedup[col] = df[col]
            else:
                dedup[col] = dedup[col].where(~dedup[col].isna(), df[col])
        df = pd.DataFrame(dedup)

    return df


def ensure_schema(df: pd.DataFrame) -> pd.DataFrame:
    for col in CANON_COLS:
        if col not in df.columns:
            df[col] = pd.NA
    return df[CANON_COLS].copy()


def trim_string_cells(df: pd.DataFrame) -> pd.DataFrame:
    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)
    return df


def drop_fully_blank_rows(df: pd.DataFrame) -> pd.DataFrame:
    return df.dropna(how="all").reset_index(drop=True)


def blank_to_none(value):
    text = norm_text(value)
    return text if text else None


def stable_account_key(retailer, name, city, state, address, zip_code) -> str:
    parts = [
        norm_text(retailer).upper(),
        norm_text(name).upper(),
        norm_text(city).upper(),
        norm_text(state).upper(),
        norm_text(address).upper(),
        norm_text(zip_code).upper(),
    ]
    raw = "|".join(parts)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]
    return f"acct_{digest}"


def build_accounts_import(input_file: str = INPUT_FILE, output_file: str = OUTPUT_FILE) -> None:
    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Missing file: {input_file}")

    excel = pd.ExcelFile(input_file)

    # Combined workbook should normally be one sheet, but this supports more than one if present.
    rows = []

    for sheet_name in excel.sheet_names:
        df = excel.parse(sheet_name)
        df = canonicalize_columns(df)
        df = ensure_schema(df)
        df = trim_string_cells(df)
        df = drop_fully_blank_rows(df)

        for idx, row in df.iterrows():
            retailer = blank_to_none(row.get("Retailer"))
            name = blank_to_none(row.get("Name"))

            # Skip rows that do not have minimum account identity
            if not retailer or not name:
                continue

            long_name = blank_to_none(row.get("Long Name"))
            address = blank_to_none(row.get("Address"))
            city = blank_to_none(row.get("City"))
            state = blank_to_none(row.get("State"))
            zip_code = blank_to_none(row.get("Zip"))
            category = blank_to_none(row.get("Category"))
            suppliers = blank_to_none(row.get("Suppliers"))

            account_key = stable_account_key(
                retailer=retailer,
                name=name,
                city=city,
                state=state,
                address=address,
                zip_code=zip_code,
            )

            rows.append(
                {
                    "source_system": "combined_workbook",
                    "source_file": os.path.basename(input_file),
                    "source_sheet": sheet_name,
                    "source_row_number": int(idx) + 2,  # Excel-style row number incl. header
                    "account_key": account_key,
                    "long_name": long_name,
                    "retailer": retailer,
                    "name": name,
                    "address": address,
                    "city": city,
                    "state": state,
                    "zip": zip_code,
                    "category": category,
                    "suppliers": suppliers,
                    "is_active": True,
                }
            )

    if not rows:
        raise RuntimeError("No valid account rows were found in the combined workbook.")

    out_df = pd.DataFrame(rows)

    # Deduplicate exact account_key collisions by keeping the first occurrence.
    out_df = out_df.drop_duplicates(subset=["account_key"], keep="first").reset_index(drop=True)

    # Ensure output column order
    out_df = out_df[OUTPUT_COLS]

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    out_df.to_csv(output_file, index=False)

    print(f"[OK] Accounts import file saved -> {output_file}")
    print(f"[INFO] Sheets scanned: {len(excel.sheet_names)}")
    print(f"[INFO] Accounts written: {len(out_df)}")
    print(f"[INFO] Output columns: {', '.join(OUTPUT_COLS)}")


if __name__ == "__main__":
    try:
        build_accounts_import()
    except Exception as exc:
        print(f"[FAIL] {exc}")
        sys.exit(1)