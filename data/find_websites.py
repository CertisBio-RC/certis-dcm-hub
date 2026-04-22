import time
from urllib.parse import urlparse

import pandas as pd
from duckduckgo_search import DDGS

INPUT_FILE = "retailers_unique.tsv"
OUTPUT_FILE = "retailers_with_websites.xlsx"

BLOCKED_DOMAINS = {
    "facebook.com",
    "linkedin.com",
    "instagram.com",
    "x.com",
    "twitter.com",
    "youtube.com",
    "wikipedia.org",
    "mapquest.com",
    "yelp.com",
    "bloomberg.com",
    "dnb.com",
    "zoominfo.com",
    "opencorporates.com",
    "indeed.com",
}

PREFERRED_KEYWORDS = {
    "coop",
    "co-op",
    "fs",
    "agronomy",
    "ag",
    "farm",
    "cooperative",
    "chs",
    "cva",
}


def normalize_domain(url: str) -> str:
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower().strip()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def is_blocked_domain(domain: str) -> bool:
    return any(domain == blocked or domain.endswith(f".{blocked}") for blocked in BLOCKED_DOMAINS)


def score_result(url: str, title: str, body: str, retailer: str, long_name: str) -> int:
    domain = normalize_domain(url)
    if not domain or is_blocked_domain(domain):
        return -100

    score = 0
    retailer_lower = retailer.lower().strip()
    long_name_lower = long_name.lower().strip()
    title_lower = (title or "").lower()
    body_lower = (body or "").lower()

    combined_text = f"{domain} {title_lower} {body_lower}"

    if retailer_lower and retailer_lower in combined_text:
        score += 40

    if long_name_lower and long_name_lower in combined_text:
        score += 20

    if any(keyword in combined_text for keyword in PREFERRED_KEYWORDS):
        score += 10

    # Prefer cleaner corporate-style domains over deep paths
    if url.count("/") <= 3:
        score += 10

    # Prefer homepages/root pages
    parsed = urlparse(url)
    if parsed.path in {"", "/"}:
        score += 10

    # Penalize obvious non-official pages
    if any(word in combined_text for word in ["directory", "profile", "listing", "locations near"]):
        score -= 20

    return score


def classify_confidence(score: int) -> str:
    if score >= 60:
        return "High"
    if score >= 30:
        return "Medium"
    if score >= 0:
        return "Low"
    return "Reject"


def search_candidates(query: str, max_results: int = 5) -> list[dict]:
    try:
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=max_results))
    except Exception:
        return []


def get_website(retailer: str, long_name: str) -> tuple[str, str, str]:
    queries = [
        f'{retailer} official website',
        f'{retailer} agronomy official website',
    ]

    if long_name and long_name.lower() != retailer.lower():
        queries.append(f'{retailer} {long_name} official website')

    best_url = ""
    best_confidence = "Low"
    best_reason = "No useful result found"
    best_score = -999

    for query in queries:
        results = search_candidates(query, max_results=5)

        for result in results:
            url = result.get("href", "") or result.get("url", "")
            title = result.get("title", "")
            body = result.get("body", "") or result.get("snippet", "")

            score = score_result(url, title, body, retailer, long_name)
            confidence = classify_confidence(score)

            if score > best_score:
                best_score = score
                best_url = url
                best_confidence = confidence
                best_reason = f'Best match from query: "{query}"'

    if best_confidence == "Reject":
        return "", "Low", "Only low-quality or blocked domains found"

    return best_url, best_confidence, best_reason


def main() -> None:
    df = pd.read_csv(INPUT_FILE, sep="\t", dtype=str).fillna("")

    websites: list[str] = []
    confidence: list[str] = []
    reason: list[str] = []

    for idx, row in df.iterrows():
        retailer = str(row.get("Retailer", "")).strip()
        long_name = str(row.get("Long Name", "")).strip()

        print(f"Processing {idx + 1}/{len(df)}: {retailer}")

        url, conf, why = get_website(retailer, long_name)

        websites.append(url)
        confidence.append(conf)
        reason.append(why)

        time.sleep(1)

    df["Website"] = websites
    df["Confidence"] = confidence
    df["Reason"] = reason

    df.to_excel(OUTPUT_FILE, index=False)

    print(f"\nDone. Output saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()