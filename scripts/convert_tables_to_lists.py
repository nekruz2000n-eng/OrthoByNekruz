#!/usr/bin/env python3
"""Convert markdown tables in question answers to bullet lists."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"

TABLE_ROW_RE = re.compile(r"^\s*\|(.+)\|\s*$")
SEPARATOR_RE = re.compile(r"^\s*\|[\s:|-]+\|\s*$")


def parse_row(line: str) -> list[str]:
    inner = line.strip()
    if inner.startswith("|"):
        inner = inner[1:]
    if inner.endswith("|"):
        inner = inner[:-1]
    return [cell.strip() for cell in inner.split("|")]


def is_separator(line: str) -> bool:
    return bool(SEPARATOR_RE.match(line))


def convert_table_block(lines: list[str]) -> list[str]:
    if len(lines) < 2:
        return lines

    rows = [parse_row(line) for line in lines]
    header = rows[0]
    data_start = 1
    if len(rows) > 1 and all(re.fullmatch(r"[-:\s]+", c) for c in rows[1]):
        data_start = 2
    data_rows = rows[data_start:]
    if not data_rows:
        return lines

    ncol = len(header)
    out: list[str] = []

    for row in data_rows:
        cells = row + [""] * (ncol - len(row))
        cells = cells[:ncol]
        if ncol == 1:
            out.append(f"- {cells[0]}")
        elif ncol == 2:
            k, v = cells[0], cells[1]
            if k and v:
                out.append(f"- **{k}:** {v}")
            elif k:
                out.append(f"- {k}")
            else:
                out.append(f"- {v}")
        else:
            key = cells[0]
            parts: list[str] = []
            for h, c in zip(header[1:], cells[1:]):
                h = h.strip()
                c = c.strip()
                if not c:
                    continue
                if h:
                    parts.append(f"**{h}:** {c}")
                else:
                    parts.append(c)
            detail = "; ".join(parts)
            if key:
                out.append(f"- **{key}:** {detail}" if detail else f"- **{key}**")
            else:
                out.append(f"- {detail}")

    return out


def convert_tables_in_text(text: str) -> tuple[str, int]:
    if not text or "|" not in text:
        return text, 0

    lines = text.split("\n")
    result: list[str] = []
    i = 0
    converted = 0

    while i < len(lines):
        line = lines[i]
        if TABLE_ROW_RE.match(line):
            block = [line]
            j = i + 1
            while j < len(lines) and TABLE_ROW_RE.match(lines[j]):
                block.append(lines[j])
                j += 1

            if len(block) >= 2 and (len(block) == 2 or is_separator(block[1])):
                result.extend(convert_table_block(block))
                converted += 1
                i = j
                continue

        result.append(line)
        i += 1

    return "\n".join(result), converted


def process_file(path: Path) -> int:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)

    total = 0
    for item in data:
        for field in ("answer", "question"):
            if field not in item or not isinstance(item[field], str):
                continue
            new_text, n = convert_tables_in_text(item[field])
            if n:
                item[field] = new_text
                total += n

    if total:
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

    return total


def main() -> None:
    patterns = [
        "*_questions.json",
        "*_tasks.json",
        "*_tests.json",
    ]
    files: list[Path] = []
    for pat in patterns:
        files.extend(sorted(DATA.glob(pat)))

    grand = 0
    for path in files:
        n = process_file(path)
        if n:
            print(f"{path.name}: {n} table(s)")
            grand += n

    print(f"Total: {grand} table(s) converted")
    return 0 if grand >= 0 else 1


if __name__ == "__main__":
    sys.exit(main())
