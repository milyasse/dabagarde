"""Liste officielle des hôpitaux (ministère de la Santé, data.gov.ma, ODbL) : xlsx → JSON.

Usage : python3 scripts/ministry-hospitals.py fichier.xlsx [--brut]
  --brut : toutes les lignes de toutes les feuilles, sans interprétation (contrôle du format).
Les lignes sont recopiées sans modification ; aucune position n'est ajoutée ici.
"""
import json
import sys

from openpyxl import load_workbook


def rows(ws):
    for r in ws.iter_rows(values_only=True):
        cells = ["" if v is None else str(v).strip() for v in r]
        if any(cells):
            yield cells


def main():
    path = sys.argv[1]
    wb = load_workbook(path, read_only=True, data_only=True)
    if "--brut" in sys.argv:
        out = {ws.title: list(rows(ws)) for ws in wb.worksheets}
        json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
        return
    raise SystemExit("format structuré : à définir après lecture du format brut")


if __name__ == "__main__":
    main()
