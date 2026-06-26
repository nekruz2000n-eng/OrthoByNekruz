#!/usr/bin/env python3
"""Parse chemistry exam ticket docx files and dump text for matching."""
from __future__ import annotations

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "scripts" / "_chem_docx_parsed.json"

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

DOCX_FILES = [
    r"c:\Users\Admin\Downloads\21.docx",
    r"c:\Users\Admin\Downloads\22.docx",
    r"c:\Users\Admin\Downloads\24.docx",
    r"c:\Users\Admin\Downloads\bilet.docx",
    r"c:\Users\Admin\Downloads\bilet_9.docx",
    r"c:\Users\Admin\Downloads\bilet_10.docx",
    r"c:\Users\Admin\Downloads\bilet_11 (1).docx",
    r"c:\Users\Admin\Downloads\bilet_11.docx",
    r"c:\Users\Admin\Downloads\bilet_13.docx",
    r"c:\Users\Admin\Downloads\bilet_14 (1).docx",
    r"c:\Users\Admin\Downloads\bilet_14.docx",
    r"c:\Users\Admin\Downloads\bilet_15.docx",
    r"c:\Users\Admin\Downloads\bilet_16.docx",
    r"c:\Users\Admin\Downloads\bilet_17.docx",
    r"c:\Users\Admin\Downloads\bilet_23.docx",
    r"c:\Users\Admin\Downloads\bilet_25.docx",
    r"c:\Users\Admin\Downloads\bilet_27.docx",
    r"c:\Users\Admin\Downloads\bilet_28.docx",
    r"c:\Users\Admin\Downloads\bilet_29.docx",
    r"c:\Users\Admin\Downloads\bilet_30.docx",
    r"c:\Users\Admin\Downloads\bilet_32.docx",
    r"c:\Users\Admin\Downloads\bilet_33.docx",
    r"c:\Users\Admin\Downloads\bilet_34.docx",
    r"c:\Users\Admin\Downloads\bilet_35 (1).docx",
    r"c:\Users\Admin\Downloads\bilet_35 (2).docx",
    r"c:\Users\Admin\Downloads\bilet_35.docx",
    r"c:\Users\Admin\Downloads\1_bilet.docx",
    r"c:\Users\Admin\Downloads\2_bilet.docx",
    r"c:\Users\Admin\Downloads\3_bilet.docx",
    r"c:\Users\Admin\Downloads\4_bilet.docx",
    r"c:\Users\Admin\Downloads\6_bilet.docx",
    r"c:\Users\Admin\Downloads\7_bilet.docx",
    r"c:\Users\Admin\Downloads\18.docx",
    r"c:\Users\Admin\Downloads\19.docx",
    r"c:\Users\Admin\Downloads\20.docx",
]


def read_docx(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        root = ET.fromstring(zf.read("word/document.xml"))
    paras: list[str] = []
    for para in root.iter(f"{W_NS}p"):
        texts = [t.text or "" for t in para.iter(f"{W_NS}t")]
        line = "".join(texts).strip()
        if line:
            paras.append(line)
    return "\n".join(paras)


def guess_ticket_number(filename: str, text: str) -> int | None:
    name = filename.lower()
    patterns = [
        r"bilet[_\s]*\(?(\d+)\)?",
        r"(\d+)_bilet",
        r"^(\d+)\.docx$",
    ]
    for pat in patterns:
        m = re.search(pat, name)
        if m:
            return int(m.group(1))
    m = re.search(r"билет\s*№?\s*(\d+)", text, re.I)
    if m:
        return int(m.group(1))
    m = re.search(r"билет\s+(\d+)", text, re.I)
    if m:
        return int(m.group(1))
    return None


def main() -> None:
    rows = []
    for fp in DOCX_FILES:
        p = Path(fp)
        if not p.exists():
            rows.append({"file": p.name, "error": "not found"})
            continue
        text = read_docx(p)
        num = guess_ticket_number(p.name, text)
        rows.append(
            {
                "file": p.name,
                "ticketNumber": num,
                "text": text,
                "preview": text[:800],
            }
        )
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"parsed {len(rows)} files -> {OUT}")
    nums = sorted({r["ticketNumber"] for r in rows if r.get("ticketNumber")})
    print("ticket numbers:", nums)


if __name__ == "__main__":
    main()
