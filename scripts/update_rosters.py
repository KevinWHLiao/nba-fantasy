# -*- coding: utf-8 -*-
"""Point the fantasy pool at 2026-27 preseason rosters.

Existing players keep their ids and 2025-26 per-game rates.
Their team and age are updated. Players no longer on a roster are removed.
Added players are contracted rotation pieces, numbered rookies through age 24,
or veterans who are on a roster with a jersey even when ESPN has no 2027 salary.
Rookies have no 2025-26 line, so their rates stay at zero.
"""
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

from build_data import expected_bonus

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "js" / "data.js"
MAP = {
    "ATL": "ATL", "BOS": "BOS", "BKN": "BRK", "CHA": "CHO", "CHI": "CHI",
    "CLE": "CLE", "DAL": "DAL", "DEN": "DEN", "DET": "DET", "GS": "GSW",
    "GSW": "GSW", "HOU": "HOU", "IND": "IND", "LAC": "LAC", "LAL": "LAL",
    "MEM": "MEM", "MIA": "MIA", "MIL": "MIL", "MIN": "MIN", "NO": "NOP",
    "NOP": "NOP", "NY": "NYK", "NYK": "NYK", "OKC": "OKC", "ORL": "ORL",
    "PHI": "PHI", "PHX": "PHO", "PHO": "PHO", "POR": "POR", "SAC": "SAC",
    "SA": "SAS", "SAS": "SAS", "TOR": "TOR", "UTA": "UTA", "UTAH": "UTA",
    "WSH": "WAS", "WAS": "WAS",
}
GUARD = {
    "Trae Young": "PG", "Kyrie Irving": "PG", "Damian Lillard": "PG",
    "Tyrese Haliburton": "PG", "Fred VanVleet": "PG", "Dejounte Murray": "PG",
    "Chris Paul": "PG", "Mike Conley": "PG", "Tyus Jones": "PG",
    "Jordan Poole": "SG", "Bradley Beal": "SG", "Klay Thompson": "SG",
    "Anfernee Simons": "SG", "Collin Sexton": "SG", "Buddy Hield": "SG",
    "Gary Trent Jr.": "SG", "Luguentz Dort": "SG", "Keon Ellis": "SG",
}
FORWARD = {
    "Jonathan Isaac": "PF", "Kyle Anderson": "PF", "Khris Middleton": "SF",
    "Harrison Barnes": "SF", "Rui Hachimura": "PF", "Jerami Grant": "PF",
    "John Collins": "PF", "Bobby Portis": "PF", "Tobias Harris": "PF",
    "Cameron Boozer": "PF", "AJ Dybantsa": "SF", "Cooper Flagg": "SF",
    "Ben Simmons": "PF",
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=40) as res:
        return json.load(res)


def norm(name):
    text = str(name).replace("ё", "e").replace("Ё", "E").replace("е", "e").replace("Е", "E")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("'", "").replace("’", "").replace(".", "").replace("-", " ")
    text = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", text, flags=re.I)
    text = re.sub(r"[^A-Za-z ]", "", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def salary_2027(athlete):
    best = 0
    for contract in athlete.get("contracts") or []:
        season = (contract.get("season") or {}).get("year")
        if season == 2027:
            best = max(best, contract.get("salary") or 0)
    return best


def pos_for(name, espn_pos):
    if name in GUARD:
        pos = GUARD[name]
        return pos, [pos, "SG" if pos == "PG" else "PG"]
    if name in FORWARD:
        pos = FORWARD[name]
        other = "PF" if pos == "SF" else "SF"
        return pos, [pos, other]
    if espn_pos == "C":
        return "C", ["C"]
    if espn_pos == "F":
        return "SF", ["SF", "PF"]
    return "SG", ["SG", "PG"]


def blank(name, team, pos, elig, age, tags):
    return {
        "name": name,
        "age": int(age or 22),
        "team": team,
        "pos": pos,
        "elig": elig,
        "g": 0,
        "mpg": 0,
        "pts": 0, "reb": 0, "ast": 0, "stl": 0, "blk": 0, "tov": 0, "tpm": 0,
        "fg": 0, "fga": 0, "tp": 0, "tpa": 0, "ft": 0, "fta": 0,
        "fgp": 0, "tpp": 0, "ftp": 0,
        "fppg": 0,
        "risk": 0.16,
        "tags": tags,
    }


def from_stats(name, team, pos, elig, age, stats):
    games = stats.get("gamesPlayed") or 0
    if games < 1:
        row = blank(name, team, pos, elig, age, ["上季未出賽"])
        return row
    pts = stats.get("avgPoints") or 0
    reb = stats.get("avgRebounds") or 0
    ast = stats.get("avgAssists") or 0
    stl = stats.get("avgSteals") or 0
    blk = stats.get("avgBlocks") or 0
    tov = stats.get("avgTurnovers") or 0
    tpm = stats.get("avgThreePointFieldGoalsMade") or 0
    fga = stats.get("avgFieldGoalsAttempted") or 0
    tpa = stats.get("avgThreePointFieldGoalsAttempted") or 0
    fta = stats.get("avgFreeThrowsAttempted") or 0
    fg = (stats.get("fieldGoalsMade") or 0) / games
    ft = (stats.get("freeThrowsMade") or 0) / games
    fgp = stats.get("fieldGoals") or 0
    tpp = (tpm / tpa) if tpa else 0
    ftp = stats.get("freeThrows") or 0
    if fgp > 1:
        fgp = (fg / fga) if fga else 0
    if ftp > 1:
        ftp = (ft / fta) if fta else 0
    base = pts + reb * 1.2 + ast * 1.5 + stl * 3 + blk * 3 - tov + tpm * 0.5
    fppg = base + expected_bonus(pts, reb, ast, stl, blk)
    risk = 0.012 + max(0, (72 - games) / 72) * 0.1
    if age >= 33:
        risk += 0.012
    if age >= 36:
        risk += 0.018
    tags = ["上季樣本少"] if games < 20 else []
    return {
        "name": name,
        "age": int(age or 25),
        "team": team,
        "pos": pos,
        "elig": elig,
        "g": int(games),
        "mpg": round(stats.get("avgMinutes") or 0, 1),
        "pts": round(pts, 1),
        "reb": round(reb, 1),
        "ast": round(ast, 1),
        "stl": round(stl, 1),
        "blk": round(blk, 1),
        "tov": round(tov, 1),
        "tpm": round(tpm, 1),
        "fg": round(fg, 2),
        "fga": round(fga, 2),
        "tp": round(tpm, 2),
        "tpa": round(tpa, 2),
        "ft": round(ft, 2),
        "fta": round(fta, 2),
        "fgp": round(fgp, 3),
        "tpp": round(tpp, 3),
        "ftp": round(ftp, 3),
        "fppg": round(fppg, 2),
        "risk": round(min(risk, 0.22), 3),
        "tags": tags,
    }


def load_rosters():
    teams = get("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams")
    teams = teams["sports"][0]["leagues"][0]["teams"]
    rows = []
    unknown = set()
    for item in teams:
        team = item["team"]
        abbr = team.get("abbreviation")
        code = MAP.get(abbr)
        if not code:
            unknown.add(abbr)
            continue
        roster = get(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{team['id']}/roster")
        for athlete in roster.get("athletes") or []:
            rows.append({
                "name": athlete.get("displayName") or athlete.get("fullName"),
                "norm": norm(athlete.get("displayName") or ""),
                "team": code,
                "pos": (athlete.get("position") or {}).get("abbreviation") or "G",
                "age": athlete.get("age") or 0,
                "espn": athlete.get("id"),
                "salary": salary_2027(athlete),
                "years": (athlete.get("experience") or {}).get("years") or 0,
                "jersey": athlete.get("jersey"),
                "seasons": [
                    (contract.get("season") or {}).get("year")
                    for contract in athlete.get("contracts") or []
                ],
            })
    if unknown:
        print("unmapped abbreviations", sorted(unknown))
    return rows


def stat_line(espn_id):
    try:
        data = get(
            "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/"
            f"seasons/2026/types/2/athletes/{espn_id}/statistics"
        )
    except Exception:
        return {}
    stats = {}
    for cat in (data.get("splits") or {}).get("categories") or []:
        for item in cat.get("stats") or []:
            stats[item["name"]] = item.get("value") or 0
    return stats


def wanted(row):
    if row["salary"] >= 2_000_000:
        return True
    if row["years"] == 0 and row["jersey"] and 0 < row["age"] <= 24:
        return True
    if not row["jersey"]:
        return False
    if row["years"] >= 4:
        return True
    return 2026 in row["seasons"] or 2027 in row["seasons"]


def main():
    write = "--write" in sys.argv
    raw = DATA.read_text(encoding="utf-8").split("=", 1)[1].strip().rstrip(";")
    payload = json.loads(raw)
    players = payload["players"]
    roster = load_rosters()
    by = {}
    for row in roster:
        current = by.get(row["norm"])
        if current is None or row["salary"] > current["salary"]:
            by[row["norm"]] = row

    kept = []
    moved = []
    removed = []
    seen = set()
    for player in players:
        hit = by.get(norm(player["name"]))
        if not hit:
            removed.append(player["name"])
            continue
        seen.add(hit["norm"])
        if player["team"] != hit["team"]:
            moved.append(f"{player['name']}: {player['team']} -> {hit['team']}")
            player["team"] = hit["team"]
        if hit["age"]:
            player["age"] = int(hit["age"])
        kept.append(player)

    additions = [row for row in by.values() if row["norm"] not in seen and wanted(row)]
    additions.sort(key=lambda row: (-row["salary"], row["name"]))
    print(f"kept {len(kept)} moved {len(moved)} removed {len(removed)} add {len(additions)}")
    print("--- MOVED ---")
    print("\n".join(moved))
    print("--- REMOVED ---")
    print("\n".join(removed) or "(none)")
    print("--- ADD ---")
    print("\n".join(f"{row['name']} {row['team']} {row['pos']} ${row['salary']} exp {row['years']} #{row['jersey'] or '-'}" for row in additions))
    if not write:
        print("dry run only; pass --write to save")
        return

    next_id = max(player["id"] for player in kept) + 1
    added = []
    for index, row in enumerate(additions, start=1):
        pos, elig = pos_for(row["name"], row["pos"])
        if row["years"] == 0:
            player = blank(row["name"], row["team"], pos, elig, row["age"], ["2026新秀"])
        else:
            stats = stat_line(row["espn"])
            player = from_stats(row["name"], row["team"], pos, elig, row["age"], stats)
        player["id"] = next_id
        next_id += 1
        added.append(player)
        print(f"  stats {index}/{len(additions)} {player['name']} g={player['g']} fppg={player['fppg']}")

    payload["players"] = kept + added
    text = (
        "/* 2026-27 rosters. Rates are 2025-26 per game; rookies have no NBA season yet. */\n"
        "const LEAGUE_DATA = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n"
    )
    DATA.write_text(text, encoding="utf-8")
    print("wrote", len(payload["players"]), "players")


if __name__ == "__main__":
    main()
