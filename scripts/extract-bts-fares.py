import json
import sys

import pdfplumber


CODES = (
    [f"N{i}" for i in range(24, 0, -1)]
    + ["CEN"]
    + [f"E{i}" for i in range(1, 24)]
    + ["W1"]
    + [f"S{i}" for i in range(1, 13)]
)


def main(source: str, output: str) -> None:
    table = pdfplumber.open(source).pages[0].extract_tables()[0]
    rows: list[list[int]] = []
    for raw in table[1:]:
        columns = [(cell or "").splitlines() for cell in raw[1:]]
        count = max(map(len, columns))
        if count == 0:
            continue
        if any(len(column) != count for column in columns):
            raise ValueError("could not separate merged PDF rows")
        for row_index in range(count):
            rows.append([int(column[row_index]) for column in columns])
    if len(rows) != len(CODES) or any(len(row) != len(CODES) for row in rows):
        raise ValueError("unexpected BTS fare matrix dimensions")
    for i, row in enumerate(rows):
        for j, value in enumerate(row):
            if value != rows[j][i]:
                raise ValueError(f"fare matrix is not symmetric at {i},{j}")
    data = {
        "source": "https://www.bts.co.th/files/uploads/tickets/pdf/fare_matrix_Eff.1Nov25_SJC.pdf",
        "effective": "2025-11-01",
        "codes": CODES,
        "fares": rows,
    }
    with open(output, "w", encoding="utf-8", newline="\n") as stream:
        json.dump(data, stream, ensure_ascii=False, separators=(",", ":"))
        stream.write("\n")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
