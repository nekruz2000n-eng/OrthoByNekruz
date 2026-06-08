"""Remove a-e duplicate questions and convert remaining letter options to 1-5."""
import json
import re

JSON_PATH = r"c:\Users\Admin\Downloads\download\src\data\bio_tests.json"


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().strip())


def strip_prefix(s: str) -> str:
    return re.sub(r"^[\da-z]+[\).]\s*", "", s, flags=re.I).strip()


def norm_ans(a: str) -> str:
    return norm(strip_prefix(a)).replace(",", ".")


def is_letter_opts(opts: list[str]) -> bool:
    if not opts:
        return False
    return sum(1 for o in opts if re.match(r"^[a-e][\).]", o, re.I)) >= max(1, len(opts) - 1)


def is_digit_opts(opts: list[str]) -> bool:
    if not opts:
        return False
    return sum(1 for o in opts if re.match(r"^\d+\)", o)) >= max(1, len(opts) - 1)


def answers_match(a: str, b: str) -> bool:
    na, nb = norm_ans(a), norm_ans(b)
    if na == nb:
        return True
    if len(na) >= 20 and len(nb) >= 20 and (na.startswith(nb) or nb.startswith(na)):
        return True
    return False


def letter_to_digit_options(options: list[str]) -> list[str]:
    mapping = {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5}
    out: list[str] = []
    for o in options:
        m = re.match(r"^([a-e])[\).]\s*(.*)$", o, re.I)
        if m:
            n = mapping[m.group(1).lower()]
            out.append(f"{n}) {m.group(2).strip()}")
        else:
            out.append(o)
    return out


def letter_to_digit_correct(correct: str, options: list[str], new_options: list[str]) -> str:
    m = re.match(r"^([a-e])[\).]\s*(.*)$", correct, re.I)
    if not m:
        return correct
    body = m.group(2).strip()
    for opt in new_options:
        if norm(strip_prefix(opt)) == norm(body):
            return opt
    return correct


def main() -> None:
    with open(JSON_PATH, encoding="utf-8") as f:
        bio = json.load(f)

    from collections import defaultdict

    groups: dict[str, list[dict]] = defaultdict(list)
    for t in bio:
        groups[norm(t["question"])].append(t)

    remove_ids: set[str] = set()
    convert_ids: set[str] = set()

    for items in groups.values():
        if len(items) < 2:
            if is_letter_opts(items[0]["options"]):
                convert_ids.add(items[0]["id"])
            continue

        letter_items = [t for t in items if is_letter_opts(t["options"])]
        digit_items = [t for t in items if is_digit_opts(t["options"])]

        if not letter_items or not digit_items:
            continue

        for li in letter_items:
            paired = any(answers_match(li["correct"], d["correct"]) for d in digit_items)
            if paired:
                remove_ids.add(li["id"])
            else:
                convert_ids.add(li["id"])

    result: list[dict] = []
    removed = 0
    converted = 0

    for t in bio:
        if t["id"] in remove_ids:
            removed += 1
            continue

        if t["id"] in convert_ids and is_letter_opts(t["options"]):
            new_opts = letter_to_digit_options(t["options"])
            t = {
                **t,
                "options": new_opts,
                "correct": letter_to_digit_correct(t["correct"], t["options"], new_opts),
            }
            converted += 1

        result.append(t)

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Before: {len(bio)}")
    print(f"After:  {len(result)}")
    print(f"Removed letter duplicates: {removed}")
    print(f"Converted letter -> digit: {converted}")


if __name__ == "__main__":
    main()
