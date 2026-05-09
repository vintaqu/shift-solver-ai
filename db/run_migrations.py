"""Ejecuta todas las migraciones y el seed contra la base de datos Neon.

Uso:
    python db/run_migrations.py                  # solo migraciones
    python db/run_migrations.py --seed           # migraciones + seed
    DATABASE_URL=<conn> python db/run_migrations.py --seed

Requiere psycopg2-binary:
    pip install psycopg2-binary
"""

import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("ERROR: falta psycopg2-binary. Instálalo con:  pip install psycopg2-binary")
    sys.exit(1)

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: define la variable DATABASE_URL con la connection string de Neon.")
    sys.exit(1)

BASE = Path(__file__).parent

def run_file(conn, path: Path):
    sql = path.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    print(f"  OK  {path.name}")

def main():
    seed = "--seed" in sys.argv

    print(f"Conectando a la base de datos...")
    conn = psycopg2.connect(DB_URL)
    print("  Conectado.")

    print("\nEjecutando migraciones:")
    for migration in sorted((BASE / "migrations").glob("*.sql")):
        run_file(conn, migration)

    if seed:
        print("\nEjecutando seed:")
        run_file(conn, BASE / "seed.sql")

    conn.close()
    print("\nListo.")

if __name__ == "__main__":
    main()
