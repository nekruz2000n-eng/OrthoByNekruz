"""Apply remaining PDF answer fixes to bio_tests.json."""
import json
import re
import sys

sys.path.insert(0, r"c:\Users\Admin\Downloads\download\scripts")
from compare_bio_pdf import parse_pdf, build_pdf_index, norm, strip_prefix, find_option

JSON_PATH = r"c:\Users\Admin\Downloads\download\src\data\bio_tests.json"
PDF_PATH = r"c:\Users\Admin\Downloads\Итоговый тест биология (1) (3).pdf"


def norm_loose(s: str) -> str:
    s = norm(strip_prefix(s))
    s = s.replace(",", ".")
    s = re.sub(r"\s+", " ", s)
    return s.rstrip(".")


def strip_prefix(s: str) -> str:
    return re.sub(r"^[\da-z]+[\).]\s*", "", s, flags=re.I).strip()


def answers_match(a: str, b: str) -> bool:
    na, nb = norm_loose(a), norm_loose(b)
    if na == nb:
        return True
    if len(na) >= 20 and len(nb) >= 20 and (na.startswith(nb) or nb.startswith(na)):
        return True
    return False


def prefix_of(option: str) -> str:
    m = re.match(r"^([\da-z]+\))\s*", option, re.I)
    return m.group(1) if m else ""


def set_option_text(options: list[str], index: int, body: str) -> list[str]:
    p = prefix_of(options[index])
    options[index] = f"{p} {body}".strip()
    return options


# Explicit overrides: id -> (correct body text, optional option index to rewrite)
EXPLICIT: dict[str, tuple[str, int | None]] = {
    "0149": ("9.2 ккал", 3),
    "0894": ("саркоптоза", 2),
    "1038": ("нейруляции", 3),
    "1058": ("краевого инфильтрата вокруг язвы на коже", 2),
    "1062": ("двенадцатиперстной и подвздошной кишках", 1),
    "1066": ("Infusoria", 2),
    "1091": ("поедании листьев салата", None),  # new option 5
}


def main() -> None:
    pdf = parse_pdf(PDF_PATH)
    pdf_index = build_pdf_index(pdf)
    with open(JSON_PATH, encoding="utf-8") as f:
        bio = json.load(f)

    by_id = {t["id"]: t for t in bio}
    applied = []

    for t in bio:
        key = norm(t["question"])
        pdf_correct = pdf_index.get(key)
        if not pdf_correct:
            continue
        if answers_match(t["correct"], pdf_correct):
            continue

        tid = t["id"]

        if tid in EXPLICIT:
            body, opt_idx = EXPLICIT[tid]
            if tid == "1091":
                if len(t["options"]) < 5:
                    t["options"].append(f"5) {body}")
                else:
                    t["options"][4] = f"5) {body}"
                t["correct"] = f"5) {body}"
            elif opt_idx is not None:
                set_option_text(t["options"], opt_idx, body)
                t["correct"] = t["options"][opt_idx]
            applied.append(tid)
            continue

        fix = find_option(t["options"], pdf_correct)
        if fix and not answers_match(t["correct"], fix):
            t["correct"] = fix
            applied.append(tid)
            continue

        # PDF text is shorter — trim matching option to PDF wording
        pdf_body = strip_prefix(pdf_correct)
        for i, opt in enumerate(t["options"]):
            ob = strip_prefix(opt)
            if norm_loose(ob).startswith(norm_loose(pdf_body)) or norm_loose(pdf_body).startswith(norm_loose(ob)):
                if norm_loose(ob) != norm_loose(pdf_body):
                    set_option_text(t["options"], i, pdf_body)
                    t["correct"] = t["options"][i]
                    applied.append(tid)
                break

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(bio, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Applied {len(applied)} fixes: {', '.join(applied)}")

    # verify
    with open(JSON_PATH, encoding="utf-8") as f:
        bio = json.load(f)
    mismatch = 0
    matched = 0
    for t in bio:
        pdf_correct = pdf_index.get(norm(t["question"]))
        if not pdf_correct:
            continue
        if answers_match(t["correct"], pdf_correct):
            matched += 1
        else:
            mismatch += 1
            print(f"  still: {t['id']} | {t['correct'][:50]} != {pdf_correct[:50]}")
    print(f"After: matched={matched}, mismatch={mismatch}")


if __name__ == "__main__":
    main()
