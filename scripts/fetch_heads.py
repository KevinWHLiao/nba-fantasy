# -*- coding: utf-8 -*-
"""Match the fantasy pool to ESPN headshots and write js/heads.js."""
import json
import re
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "js" / "data.js"
OUT = ROOT / "js" / "heads.js"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=40) as res:
        return json.load(res)


def norm(name):
    text = unicodedata.normalize("NFKD", str(name))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("'", "").replace("’", "").replace(".", "")
    text = text.replace("-", " ")
    text = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", text, flags=re.I)
    text = re.sub(r"[^A-Za-z ]", "", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def main():
    raw = DATA.read_text(encoding="utf-8").split("=", 1)[1].strip().rstrip(";")
    players = json.loads(raw)["players"]
    teams = get("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams")
    teams = teams["sports"][0]["leagues"][0]["teams"]
    by_name = {}
    for item in teams:
        team_id = item["team"]["id"]
        roster = get(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{team_id}/roster")
        for athlete in roster.get("athletes") or []:
            shot = (athlete.get("headshot") or {}).get("href")
            if not shot:
                continue
            by_name.setdefault(norm(athlete.get("displayName") or athlete.get("fullName")), shot)

    missing = []
    pairs = []
    for player in players:
        shot = by_name.get(norm(player["name"]))
        if not shot:
            query = urllib.parse.quote(player["name"].replace("ё", "e").replace("ё", "e"))
            found = get(f"https://site.web.api.espn.com/apis/common/v3/search?query={query}&limit=5&type=player")
            for item in found.get("items") or []:
                href = (item.get("headshot") or {}).get("href") or ""
                if "/nba/" in href:
                    shot = href
                    break
        if not shot:
            missing.append(player["name"])
            continue
        pairs.append((player["id"], shot))

    lines = ["const PLAYER_HEADS = {"]
    for pid, shot in pairs:
        lines.append(f'  {pid}: "{shot}",')
    lines.append("};")
    lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"matched {len(pairs)} / {len(players)}")
    if missing:
        print("missing:")
        for name in missing:
            print(" -", name)


if __name__ == "__main__":
    main()
