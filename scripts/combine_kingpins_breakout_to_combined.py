import os
import re
import sys
import pandas as pd

# =============================================================================
# CERTIS DCM HUB / CERTIS AGROUTE DATABASE
# COMBINE RC Kingpins breakout workbook -> combined kingpin workbook
#
# Purpose:
# - Read a breakout workbook with multiple worksheets
# - Normalize headers
# - Map aliases to a stable canonical schema
# - Concatenate all sheets into one combined workbook
#
# Input:
#   data/RC Kingpins for AgRoute - BREAKOUT.xlsx
#
# Output:
#   data/RC Kingpins for AgRoute - COMBINED.xlsx
# =============================================================================

INPUT_FILE = os.path.join("data", "RC Kingpins for AgRoute - BREAKOUT.xlsx")
OUTPUT_FILE = os.path.join("data", "RC Kingpins for AgRoute - COMBINED.xlsx")

CANON_COLS = [
    "STATE",
    "NATIONAL NAME",
    "REGIONAL NAME",
    "SUPPLIER",
    "CORPORATE KINGPIN",
    "REGIONAL KINGPIN",
    "TITLE",
    "ADDRESS",
    "OFFICE PHONE",
    "CELL PHONE",
    "EMAIL",
]

ALIASES = {
    # State
    "state": "STATE",

    # Naming hierarchy
    "national name": "NATIONAL NAME",
    "national_name": "NATIONAL NAME",
    "national-name": "NATIONAL NAME",

    "regional name": "REGIONAL NAME",
    "regional_name": "REGIONAL NAME",
    "regional-name": "REGIONAL NAME",

    # Supplier
    "supplier": "SUPPLIER",
    "suppliers": "SUPPLIER",

    # Kingpins
    "corporate kingpin": "CORPORATE KINGPIN",
    "corporate_kingpin": "CORPORATE KINGPIN",
    "corporate-kingpin": "CORPORATE KINGPIN",

    "regional kingpin": "REGIONAL KINGPIN",
    "regional_kingpin": "REGIONAL KINGPIN",
    "regional-kingpin": "REGIONAL KINGPIN",

    # Title / address / phones / email
    "title": "TITLE",
    "address": "ADDRESS",

    "office phone": "OFFICE PHONE",
    "office_phone": "OFFICE PHONE",
    "office-phone": "OFFICE PHONE",
    "phone": "OFFICE PHONE",

    "cell phone": "CELL PHONE",
    "cell_phone": "CELL PHONE",
    "cell-phone": "CELL PHONE",
    "mobile": "CELL PHONE",
    "mobile phone": "CELL PHONE",

    "email": "EMAIL",
    "e-mail": "EMAIL",
}


def norm_header(value):
    if value is None:
        return ""
    s = str(value).replace("\ufeff", "").strip()
    s = re.sub(r"\s+", " ", s)
    return s


def alias_key(value):
    return norm_header(value).lower()


def canonicalize_columns(df):
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


def trim_string_cells(df):
    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)
    return df


def ensure_schema(df):
    for col in CANON_COLS:
        if col not in df.columns:
            df[col] = pd.NA
    return df[CANON_COLS].copy()


def drop_fully_blank_rows(df):
    return df.dropna(how="all").reset_index(drop=True)


def combine_workbook():
    if not os.path.exists(INPUT_FILE):
        raise FileNotFoundError(f"Missing file: {INPUT_FILE}")

    excel = pd.ExcelFile(INPUT_FILE)
    frames = []

    for sheet in excel.sheet_names:
        df = excel.parse(sheet)
        df = canonicalize_columns(df)
        df = trim_string_cells(df)
        df = ensure_schema(df)
        df = drop_fully_blank_rows(df)
        frames.append(df)

    if not frames:
        raise RuntimeError("No worksheets were available to combine.")

    combined = pd.concat(frames, ignore_index=True)
    combined = trim_string_cells(combined)
    combined = drop_fully_blank_rows(combined)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    combined.to_excel(OUTPUT_FILE, index=False)

    print(f"[OK] Kingpins combined -> {OUTPUT_FILE}")
    print(f"[INFO] Sheets: {len(excel.sheet_names)} | Rows: {len(combined)}")
    print(f"[INFO] Output columns: {', '.join(CANON_COLS)}")


if __name__ == "__main__":
    try:
        combine_workbook()
    except Exception as e:
        print(f"[FAIL] {e}")
        sys.exit(1)