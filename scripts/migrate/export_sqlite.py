import json
import pathlib
import sqlite3
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: export_sqlite.py <app.db>", file=sys.stderr)
        return 2

    db_path = pathlib.Path(sys.argv[1])
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "select id, title, content, created_on, changed_on from notes order by id"
    ).fetchall()
    print(json.dumps([dict(row) for row in rows], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
