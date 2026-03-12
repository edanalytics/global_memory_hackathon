"""
Scraper for University of South Carolina undergraduate major requirements.
Crawls academicbulletins.sc.edu to extract course requirements for each major.
Output: usc_major_requirements.json and usc_major_requirements.csv
"""

import json
import re
import time
import csv
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://academicbulletins.sc.edu"
UNDERGRAD_URL = f"{BASE_URL}/undergraduate/"

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (research scraper; contact: research@example.com)"
})


def fetch(url: str, retries: int = 3) -> BeautifulSoup | None:
    for attempt in range(retries):
        try:
            resp = SESSION.get(url, timeout=15)
            if resp.status_code == 200:
                return BeautifulSoup(resp.text, "lxml")
            elif resp.status_code == 404:
                return None
            else:
                print(f"  HTTP {resp.status_code} for {url}")
                return None
        except Exception as e:
            print(f"  Error fetching {url}: {e} (attempt {attempt+1})")
            time.sleep(2 ** attempt)
    return None


def is_major_page(url: str) -> bool:
    """Heuristic: major pages are paths ending in known degree suffixes."""
    path = urlparse(url).path.rstrip("/")
    segments = path.split("/")
    # Must be at least 3 segments deep: /undergraduate/college/major
    # (some business majors live directly under /undergraduate/business/)
    if len(segments) < 4:
        return False
    last = segments[-1].lower()
    # Common degree suffixes in USC bulletin URLs
    degree_patterns = [
        r".*-b[as]$", r".*-ba$", r".*-bs$", r".*-bfa$", r".*-bsba$",
        r".*-bscs$", r".*-bais$", r".*-bsc$", r".*-bmus$", r".*-bsed$",
        r".*-bsn$", r".*-bsph$", r".*-bsw$", r".*-barch$", r".*-bsme$",
        r".*-bsce$", r".*-bsee$", r".*-bschem$", r".*-bsie$",
        r".*-ba-?.*$", r".*-bs-?.*$",
    ]
    for pat in degree_patterns:
        if re.match(pat, last):
            return True
    return False


def get_college_links(soup: BeautifulSoup, base: str) -> list[str]:
    """Find links to college sub-pages from the undergraduate index."""
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        full = urljoin(base, href)
        parsed = urlparse(full)
        path = parsed.path
        # College pages: /undergraduate/{college}/
        if (parsed.netloc == urlparse(BASE_URL).netloc and
                path.startswith("/undergraduate/") and
                path.count("/") == 3 and
                path.endswith("/")):
            links.append(full)
    return list(set(links))


def crawl_for_major_urls(start_url: str) -> list[str]:
    """BFS crawl from undergraduate root to find all major pages."""
    visited = set()
    to_visit = [start_url]
    major_urls = []
    college_urls = []

    print("Discovering college pages...")
    root_soup = fetch(start_url)
    if not root_soup:
        return []

    college_links = get_college_links(root_soup, start_url)
    print(f"  Found {len(college_links)} college pages")

    for college_url in college_links:
        if college_url in visited:
            continue
        visited.add(college_url)
        print(f"  Crawling college: {college_url}")
        college_soup = fetch(college_url)
        if not college_soup:
            continue
        time.sleep(0.3)

        # Find all links on this page
        for a in college_soup.find_all("a", href=True):
            href = a["href"]
            full = urljoin(college_url, href)
            parsed = urlparse(full)
            if parsed.netloc != urlparse(BASE_URL).netloc:
                continue
            path = parsed.path
            if not path.startswith("/undergraduate/"):
                continue
            # Skip PDF links
            if path.endswith(".pdf"):
                continue

            if is_major_page(full) and full not in visited:
                major_urls.append(full)
                visited.add(full)
            elif (path.count("/") == 4 and path.endswith("/") and
                  full not in visited and full not in college_urls):
                college_urls.append(full)
                visited.add(full)

    # Also crawl department-level pages we found
    print(f"Crawling {len(college_urls)} department/sub-pages...")
    for dept_url in college_urls:
        dept_soup = fetch(dept_url)
        if not dept_soup:
            continue
        time.sleep(0.3)
        for a in dept_soup.find_all("a", href=True):
            href = a["href"]
            full = urljoin(dept_url, href)
            parsed = urlparse(full)
            if parsed.netloc != urlparse(BASE_URL).netloc:
                continue
            if parsed.path.endswith(".pdf"):
                continue
            if is_major_page(full) and full not in visited:
                major_urls.append(full)
                visited.add(full)

    return major_urls


def parse_course_code(text: str) -> str | None:
    """Extract a course code like 'CSCE 145' from text."""
    m = re.search(r"\b([A-Z]{2,5})\s+(\d{3,4}[A-Z]?)\b", text)
    if m:
        return f"{m.group(1)} {m.group(2)}"
    return None


def normalize_text(text: str) -> str:
    """Replace non-breaking spaces and normalize whitespace."""
    return text.replace("\xa0", " ").strip()


def parse_major_page(url: str, soup: BeautifulSoup) -> dict:
    """Extract structured course requirements from a major page."""
    result = {
        "url": url,
        "major_name": "",
        "degree": "",
        "college": "",
        "total_hours": None,
        "all_courses": [],
    }

    # Extract college from URL path
    path_parts = urlparse(url).path.strip("/").split("/")
    if len(path_parts) >= 2:
        result["college"] = path_parts[1].replace("-", " ").title()

    # Extract major name: skip the site-banner h1 ("20XX-20XX Academic Bulletin")
    # and grab the first content h1 that looks like a degree title
    for h1 in soup.find_all("h1"):
        text = normalize_text(h1.get_text(strip=True))
        if "Academic Bulletin" in text or "Edition" in text:
            continue
        result["major_name"] = text
        m = re.search(r"(B\.[A-Z.]+)", text)
        if m:
            result["degree"] = m.group(1)
        break

    # Extract total hours from section heading like "Degree Requirements (120 hours)"
    for h in soup.find_all(["h2", "h3"]):
        text = h.get_text()
        m = re.search(r"Degree Requirements\s*\((\d+)", text)
        if m:
            result["total_hours"] = int(m.group(1))
            break

    # Walk through page content to find sections and course tables
    current_section = "General"
    current_subsection = None
    seen_courses = set()

    content = soup.find("main") or soup.find("div", id="content") or soup.find("body")
    if not content:
        return result

    for elem in content.find_all(["h2", "h3", "h4", "table", "li", "p"]):
        tag = elem.name

        if tag in ("h2", "h3", "h4"):
            heading_text = normalize_text(elem.get_text(strip=True))
            if tag == "h2":
                current_section = heading_text
                current_subsection = None
            else:
                current_subsection = heading_text

        elif tag == "table":
            rows = elem.find_all("tr")
            for row in rows:
                cells = row.find_all(["td", "th"])
                if len(cells) < 2:
                    continue

                # Look for course code links (href contains /search/?P=COURSE)
                links = row.find_all("a", href=True)
                course_link = None
                for link in links:
                    if "/search/?P=" in link["href"]:
                        course_link = link
                        break
                if not course_link:
                    continue

                code = normalize_text(
                    course_link["href"].split("P=")[-1].replace("%20", " ")
                )
                if not re.match(r"^[A-Z]{2,5}\s+\d{3}", code):
                    continue

                # Determine which cell has course code and which has title
                # Usually: cells[0]=code, cells[1]=title, cells[-1]=credits
                title = ""
                if len(cells) >= 2:
                    title = normalize_text(cells[1].get_text(" ", strip=True))
                    # If the title cell looks like just another code, check cell 0
                    if not title or re.match(r"^[A-Z]{2,5}\s+\d{3}", title):
                        title = normalize_text(cells[0].get_text(" ", strip=True))

                # Credits: last cell that is a plain integer
                credits = None
                for c in reversed(cells):
                    txt = c.get_text(strip=True)
                    if re.match(r"^\d+$", txt):
                        credits = int(txt)
                        break

                course_key = (current_section, code)
                if course_key not in seen_courses:
                    seen_courses.add(course_key)
                    result["all_courses"].append({
                        "section": current_section,
                        "subsection": current_subsection,
                        "course_code": code,
                        "course_title": title,
                        "credits": credits,
                    })

        elif tag in ("li", "p"):
            # Courses listed outside tables (e.g. concentrations listed as plain links)
            for link in elem.find_all("a", href=True):
                if "/search/?P=" not in link["href"]:
                    continue
                code = normalize_text(
                    link["href"].split("P=")[-1].replace("%20", " ")
                )
                link_text = normalize_text(link.get_text(strip=True))
                # Only accept links where the link text itself is a course code
                if not re.match(r"^[A-Z]{2,5}\s+\d{3}", link_text):
                    continue
                course_key = (current_section, code)
                if course_key not in seen_courses:
                    seen_courses.add(course_key)
                    result["all_courses"].append({
                        "section": current_section,
                        "subsection": current_subsection,
                        "course_code": code,
                        "course_title": link_text,
                        "credits": None,
                    })

    return result


def main():
    print("=== USC Major Requirements Scraper ===\n")

    major_urls = crawl_for_major_urls(UNDERGRAD_URL)
    print(f"\nFound {len(major_urls)} major pages to scrape\n")

    all_majors = []
    flat_rows = []

    for i, url in enumerate(sorted(major_urls)):
        print(f"[{i+1}/{len(major_urls)}] Scraping: {url}")
        soup = fetch(url)
        if not soup:
            print("  Skipped (fetch failed)")
            continue
        major_data = parse_major_page(url, soup)
        all_majors.append(major_data)
        print(f"  -> {major_data['major_name']} | {len(major_data['all_courses'])} courses")

        for course in major_data["all_courses"]:
            flat_rows.append({
                "major_name": major_data["major_name"],
                "degree": major_data["degree"],
                "college": major_data["college"],
                "total_hours": major_data["total_hours"],
                "url": url,
                "section": course["section"],
                "subsection": course["subsection"],
                "course_code": course["course_code"],
                "course_title": course["course_title"],
                "credits": course["credits"],
            })

        time.sleep(0.4)

    # Write JSON
    json_path = "usc_major_requirements.json"
    with open(json_path, "w") as f:
        json.dump(all_majors, f, indent=2)
    print(f"\nWrote {json_path} ({len(all_majors)} majors)")

    # Write CSV
    csv_path = "usc_major_requirements.csv"
    if flat_rows:
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=flat_rows[0].keys())
            writer.writeheader()
            writer.writerows(flat_rows)
        print(f"Wrote {csv_path} ({len(flat_rows)} course rows)")


if __name__ == "__main__":
    main()
