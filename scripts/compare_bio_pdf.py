"""Compare bio_tests.json answers against PDF bold correct options."""
import json
import re
import sys

import fitz

PDF_PATH = r"c:\Users\Admin\Downloads\Итоговый тест биология (1) (2).pdf"
JSON_PATH = r"c:\Users\Admin\Downloads\download\src\data\bio_tests.json"
OUT_PATH = r"c:\Users\Admin\Downloads\download\pdf_mismatches.json"


def is_bold(span: dict) -> bool:
    return "Bold" in span.get("font", "") or bool(span.get("flags", 0) & 16)


def line_bold(parts: list[tuple[str, bool]]) -> bool:
    return any(b for _, b in parts)


def line_text(parts: list[tuple[str, bool]]) -> str:
    return "".join(t for t, _ in parts).strip()


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().strip())


def strip_prefix(s: str) -> str:
    return re.sub(r"^[\da-z]+[\).]\s*", "", s, flags=re.I).strip()


def norm_loose(s: str) -> str:
    s = norm(strip_prefix(s))
    s = s.replace(",", ".")
    s = re.sub(r"\s+", " ", s)
    return s.rstrip(".")


def answers_match(a: str, b: str) -> bool:
    na, nb = norm_loose(a), norm_loose(b)
    if na == nb:
        return True
    if len(na) >= 24 and len(nb) >= 24 and (na.startswith(nb) or nb.startswith(na)):
        return True
    return False


def parse_pdf(path: str) -> list[dict]:
    doc = fitz.open(path)
    raw_lines: list[list[tuple[str, bool]]] = []
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            for line in block["lines"]:
                parts = [
                    (span["text"], is_bold(span))
                    for span in line["spans"]
                    if span["text"].strip()
                ]
                if parts:
                    raw_lines.append(parts)
    doc.close()

    questions: list[dict] = []
    current: dict | None = None
    q_start = re.compile(r"^(\d{3})\.\s*(.*)$")
    opt_only = re.compile(r"^(\d+|[a-e])\)\s*$", re.I)
    opt_inline = re.compile(r"^(\d+|[a-e])\)\s*(.+)$", re.I)

    def flush_question() -> None:
        nonlocal current
        if current and current.get("correct"):
            questions.append(current)
        current = None

    i = 0
    while i < len(raw_lines):
        parts = raw_lines[i]
        text = line_text(parts)

        if not text or text.startswith("--"):
            i += 1
            continue
        if text.startswith(("Раздел", "ТЕСТОВЫЕ", "Выберите")):
            i += 1
            continue

        m = q_start.match(text)
        if m:
            flush_question()
            current = {"num": m.group(1), "question": m.group(2).strip(), "correct": None}
            i += 1
            continue

        if current is None:
            i += 1
            continue

        inline = opt_inline.match(text)
        only = opt_only.match(text)

        if inline:
            num, rest = inline.group(1), inline.group(2).strip()
            if line_bold(parts):
                current["correct"] = f"{num}) {rest}".strip()
            i += 1
            continue

        if only:
            num = only.group(1)
            bold = line_bold(parts)
            if i + 1 < len(raw_lines):
                next_parts = raw_lines[i + 1]
                next_text = line_text(next_parts)
                next_bold = line_bold(next_parts)
                if (
                    next_text
                    and not q_start.match(next_text)
                    and not opt_only.match(next_text)
                    and not opt_inline.match(next_text)
                ):
                    if bold or next_bold:
                        current["correct"] = f"{num}) {next_text}".strip()
                    i += 2
                    continue
            i += 1
            continue

        if current["correct"] is None:
            current["question"] += " " + text
        i += 1

    flush_question()
    return questions


def build_pdf_index(pdf: list[dict]) -> dict[str, str]:
    """Exact question text -> PDF correct answer (skip conflicts)."""
    index: dict[str, str] = {}
    conflicts: set[str] = set()
    for q in pdf:
        key = norm(q["question"])
        ans = q["correct"]
        if not key or not ans:
            continue
        if key in index and norm(strip_prefix(index[key])) != norm(strip_prefix(ans)):
            conflicts.add(key)
        else:
            index[key] = ans
    for key in conflicts:
        index.pop(key, None)
    return index


def find_option(options: list[str], pdf_correct: str) -> str | None:
    pdf_norm = norm(strip_prefix(pdf_correct))
    for o in options:
        if norm(strip_prefix(o)) == pdf_norm:
            return o
    for o in options:
        on = norm(strip_prefix(o))
        if len(on) >= 12 and (on in pdf_norm or pdf_norm in on):
            return o
    return None


def main(apply: bool = False) -> None:
    pdf = parse_pdf(PDF_PATH)
    pdf_index = build_pdf_index(pdf)
    with open(JSON_PATH, encoding="utf-8") as f:
        bio = json.load(f)

    mismatches = []
    not_matched = []
    applied = 0

    for t in bio:
        key = norm(t["question"])
        pdf_correct = pdf_index.get(key)
        if not pdf_correct:
            not_matched.append(t["id"])
            continue

        if answers_match(t["correct"], pdf_correct):
            continue

        fix_opt = find_option(t["options"], pdf_correct)
        item = {
            "id": t["id"],
            "question": t["question"][:100],
            "json_correct": t["correct"],
            "pdf_correct": pdf_correct,
            "fix_to": fix_opt,
        }
        mismatches.append(item)

        if apply and fix_opt and norm(strip_prefix(fix_opt)) != norm(strip_prefix(t["correct"])):
            t["correct"] = fix_opt
            applied += 1

    print(f"PDF parsed: {len(pdf)} | indexed: {len(pdf_index)}")
    print(f"JSON: {len(bio)} | not matched: {len(not_matched)} | mismatches: {len(mismatches)}")
    print(f"Fixable: {sum(1 for m in mismatches if m['fix_to'])}")
    if apply:
        print(f"Applied: {applied}")
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(bio, f, ensure_ascii=False, indent=2)
            f.write("\n")

    for m in mismatches:
        tag = "FIX" if m["fix_to"] else "MANUAL"
        print(f"[{tag}] {m['id']}: {m['json_correct'][:55]} -> {m['pdf_correct'][:55]}")

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"mismatches": mismatches, "not_matched": not_matched}, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main(apply="--apply" in sys.argv)
