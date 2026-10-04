# -*- coding: utf-8 -*-
"""Turn Basketball-Reference 2025-26 totals into the fantasy player pool."""
import json
from pathlib import Path

SRC = Path(r"C:\Users\Kevin\.cursor\projects\c-Users-Kevin-Desktop-My-Project-NBA-Fantasy\agent-tools\9c1a433c-16c2-4d27-8233-9d1c58ed5f4d.txt")
OUT = Path(r"C:\Users\Kevin\Desktop\My_Project\NBA_Fantasy\js\data.js")

TEAMS = {
    "ATL": ("老鷹", "#E03A3E"),
    "BOS": ("塞爾提克", "#007A33"),
    "BRK": ("籃網", "#FFFFFF"),
    "CHO": ("黃蜂", "#00788C"),
    "CHI": ("公牛", "#CE1141"),
    "CLE": ("騎士", "#860038"),
    "DAL": ("獨行俠", "#00538C"),
    "DEN": ("金塊", "#FEC524"),
    "DET": ("活塞", "#C8102E"),
    "GSW": ("勇士", "#1D428A"),
    "HOU": ("火箭", "#CE1141"),
    "IND": ("溜馬", "#FDBB30"),
    "LAC": ("快艇", "#C8102E"),
    "LAL": ("湖人", "#FDB927"),
    "MEM": ("灰熊", "#5D76A9"),
    "MIA": ("熱火", "#98002E"),
    "MIL": ("公鹿", "#00471B"),
    "MIN": ("灰狼", "#236192"),
    "NOP": ("鵜鶘", "#0C2340"),
    "NYK": ("尼克", "#F58426"),
    "OKC": ("雷霆", "#007AC1"),
    "ORL": ("魔術", "#0077C0"),
    "PHI": ("76人", "#ED174C"),
    "PHO": ("太陽", "#E56020"),
    "POR": ("拓荒者", "#E03A3E"),
    "SAC": ("國王", "#5A2D81"),
    "SAS": ("馬刺", "#C4CED4"),
    "TOR": ("暴龍", "#CE1141"),
    "UTA": ("爵士", "#002B5C"),
    "WAS": ("巫師", "#002B5C"),
}

# Extra fantasy eligibility beyond the primary position.
MULTI = {
    "Luka Dončić": ["SG"],
    "Shai Gilgeous-Alexander": ["SG"],
    "Tyrese Maxey": ["SG"],
    "De'Aaron Fox": ["SG"],
    "Cade Cunningham": ["SG"],
    "LaMelo Ball": ["SG"],
    "Amen Thompson": ["SG", "SF"],
    "Josh Giddey": ["SG"],
    "Stephon Castle": ["SG"],
    "Derrick White": ["PG"],
    "Austin Reaves": ["PG"],
    "Payton Pritchard": ["SG"],
    "Andrew Nembhard": ["SG"],
    "Jamal Murray": ["SG"],
    "Jalen Brunson": ["SG"],
    "James Harden": ["SG"],
    "Devin Booker": ["PG"],
    "Anthony Edwards": ["SF"],
    "Desmond Bane": ["SF"],
    "Donovan Mitchell": ["PG"],
    "Jaylen Brown": ["SG"],
    "LeBron James": ["PF"],
    "Kevin Durant": ["PF"],
    "Kawhi Leonard": ["PF"],
    "Jalen Johnson": ["PF"],
    "Scottie Barnes": ["SF", "C"],
    "Paolo Banchero": ["SF"],
    "Cooper Flagg": ["PF"],
    "Brandon Ingram": ["SG"],
    "Jimmy Butler": ["SG"],
    "Franz Wagner": ["SG"],
    "Deni Avdija": ["PF"],
    "Mikal Bridges": ["SG"],
    "OG Anunoby": ["SF"],
    "Josh Hart": ["SG", "PF"],
    "Draymond Green": ["C"],
    "Julius Randle": ["C"],
    "Giannis Antetokounmpo": ["SF", "C"],
    "Zion Williamson": ["C"],
    "Jayson Tatum": ["SF"],
    "Anthony Davis": ["C"],
    "Victor Wembanyama": ["PF"],
    "Chet Holmgren": ["C"],
    "Evan Mobley": ["C"],
    "Jaren Jackson Jr.": ["PF"],
    "Karl-Anthony Towns": ["PF"],
    "Alperen Şengün": ["PF"],
    "Bam Adebayo": ["PF"],
    "Nikola Jokić": ["PF"],
    "Jalen Duren": ["PF"],
    "Kristaps Porziņģis": ["PF"],
    "Jalen Williams": ["SF", "PG"],
    "Ausar Thompson": ["SG", "PF"],
    "Trey Murphy III": ["SG"],
    "RJ Barrett": ["SG"],
    "Andrew Wiggins": ["SG"],
    "DeMar DeRozan": ["SF"],
    "Pascal Siakam": ["C"],
    "Domantas Sabonis": ["PF"],
    "Lauri Markkanen": ["SF"],
    "Michael Porter Jr.": ["PF"],
    "Brandon Miller": ["SG"],
    "Kon Knueppel": ["SG"],
    "VJ Edgecombe": ["SF"],
    "Cason Wallace": ["PG"],
    "Dyson Daniels": ["PG", "SF"],
    "Herb Jones": ["PF"],
    "Herbert Jones": ["PF"],
    "Tari Eason": ["SF"],
    "Jabari Smith Jr.": ["SF"],
    "Cam Thomas": ["PG"],
    "Keyonte George": ["SG"],
    "Collin Sexton": ["PG"],
    "Immanuel Quickley": ["SG"],
    "CJ McCollum": ["SG"],
    "Norman Powell": ["SF"],
    "Zach LaVine": ["SF"],
    "Ja Morant": ["SG"],
    "Darius Garland": ["SG"],
    "Tyler Herro": ["PG"],
    "Anfernee Simons": ["PG"],
    "Jordan Poole": ["SG"],
    "Scoot Henderson": ["SG"],
    "Shaedon Sharpe": ["SF"],
}


def num(value, default=0.0):
    value = (value or "").strip()
    if value in {"", ".", "-"}:
        return default
    return float(value)


def parse_tags(awards):
    tags = []
    for part in (awards or "").split(","):
        token = part.strip()
        if not token:
            continue
        if token == "MVP-1":
            tags.append("MVP")
        elif token.startswith("MVP-"):
            tags.append("MVP票選")
        elif token == "DPOY-1":
            tags.append("DPOY")
        elif token.startswith("DPOY-"):
            tags.append("DPOY票選")
        elif token == "ROY-1":
            tags.append("最佳新秀")
        elif token.startswith("ROY-"):
            tags.append("新秀票選")
        elif token == "MIP-1":
            tags.append("進步最快")
        elif token == "6MOY-1":
            tags.append("最佳第六人")
        elif token.startswith("6MOY-"):
            tags.append("第六人票選")
        elif token == "AS":
            tags.append("明星賽")
        elif token == "NBA1":
            tags.append("年度第一隊")
        elif token == "NBA2":
            tags.append("年度第二隊")
        elif token == "NBA3":
            tags.append("年度第三隊")
        elif token == "DEF1":
            tags.append("防守第一隊")
        elif token == "DEF2":
            tags.append("防守第二隊")
        elif token.startswith("CPOY"):
            tags.append("關鍵球員")
    # Keep the strongest tags, in order, unique.
    seen = set()
    out = []
    for tag in tags:
        if tag not in seen:
            seen.add(tag)
            out.append(tag)
    return out[:4]


def poisson_binom_at_least(probs, k):
    total = 0.0
    n = len(probs)
    for mask in range(1 << n):
        bits = 0
        pr = 1.0
        for i in range(n):
            if mask & (1 << i):
                bits += 1
                pr *= probs[i]
            else:
                pr *= 1 - probs[i]
        if bits >= k:
            total += pr
    return total


def rate(avg, mid, span, cap):
    return min(cap, max(0.0, (avg - mid) / span))


def expected_bonus(pts, reb, ast, stl, blk):
    probs = [
        rate(pts, 8, 8, 0.98),
        rate(reb, 6.5, 7, 0.96),
        rate(ast, 6.5, 7, 0.96),
        rate(stl, 2.4, 1.6, 0.45),
        rate(blk, 2.4, 1.6, 0.55),
    ]
    p2 = poisson_binom_at_least(probs, 2)
    p3 = poisson_binom_at_least(probs, 3)
    # Double-double +2, triple-double adds another +3.
    return 2 * p2 + 3 * p3


def parse_rows(text):
    rows = []
    header = None
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if not cells or cells[0] in {"Rk", "---"} or set(cells[0]) <= {"-"}:
            if cells and cells[0] == "Rk":
                header = cells
            continue
        if header is None or not cells[0].isdigit():
            continue
        rows.append(dict(zip(header, cells)))
    return rows


def main():
    rows = parse_rows(SRC.read_text(encoding="utf-8"))
    groups = []
    for row in rows:
        if groups and groups[-1][0]["Player"] == row["Player"]:
            groups[-1].append(row)
        else:
            groups.append([row])

    built = []
    for group in groups:
        total = group[0]
        current = group[-1]
        g = num(total["G"])
        mp = num(total["MP"])
        if g < 15 or mp < 450:
            continue
        team = current["Team"]
        if team in {"2TM", "3TM"} or team not in TEAMS:
            continue
        pos = total["Pos"] if total["Pos"] in {"PG", "SG", "SF", "PF", "C"} else current["Pos"]
        if pos not in {"PG", "SG", "SF", "PF", "C"}:
            continue

        def per(key):
            return num(total[key]) / g

        pts, reb, ast = per("PTS"), per("TRB"), per("AST")
        stl, blk, tov = per("STL"), per("BLK"), per("TOV")
        tpm = per("3P")
        fga = per("FGA")
        fg = per("FG")
        tpa = per("3PA")
        fta = per("FTA")
        ft = per("FT")
        fgp = (num(total["FG"]) / num(total["FGA"])) if num(total["FGA"]) else 0
        tpp = (num(total["3P"]) / num(total["3PA"])) if num(total["3PA"]) else 0
        ftp = (num(total["FT"]) / num(total["FTA"])) if num(total["FTA"]) else 0
        base_fp = pts + reb * 1.2 + ast * 1.5 + stl * 3 + blk * 3 - tov + tpm * 0.5
        fppg = base_fp + expected_bonus(pts, reb, ast, stl, blk)
        age = int(num(total["Age"]))
        avail = min(g, 82) / 82
        risk = 0.012 + max(0, (72 - g) / 72) * 0.1
        if age >= 33:
            risk += 0.012
        if age >= 36:
            risk += 0.018
        risk = round(min(risk, 0.22), 3)
        value = fppg * (0.58 + 0.42 * (avail ** 0.55))
        elig = [pos]
        for extra in MULTI.get(total["Player"], []):
            if extra not in elig:
                elig.append(extra)
        built.append({
            "name": total["Player"],
            "age": age + 1,
            "team": team,
            "pos": pos,
            "elig": elig,
            "g": int(g),
            "mpg": round(mp / g, 1),
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
            "risk": risk,
            "tags": parse_tags(total.get("Awards", "")),
            "value": value,
        })

    unique = {}
    for player in built:
        previous = unique.get(player["name"])
        minutes = player["mpg"] * player["g"]
        if previous is None or (player["g"], minutes) > (previous["g"], previous["mpg"] * previous["g"]):
            unique[player["name"]] = player
    built = list(unique.values())
    built.sort(key=lambda p: p["value"], reverse=True)
    pool = built[:210]
    for i, player in enumerate(pool, start=1):
        player["id"] = i
        player.pop("value", None)

    missing = sorted(set(MULTI) - {p["name"] for p in pool})
    teams_hit = {p["team"] for p in pool}
    print(f"players {len(pool)} teams {len(teams_hit)}")
    print("top 12:")
    for p in pool[:12]:
        print(f"  {p['id']:3} {p['name']} {p['team']} {p['pos']} {p['fppg']} gp={p['g']} tags={p['tags']}")
    if missing:
        print("multi not in pool:", ", ".join(missing))
    if len(teams_hit) < 30:
        print("missing teams", sorted(set(TEAMS) - teams_hit))

    meta = {code: {"name": name, "color": color} for code, (name, color) in TEAMS.items()}
    payload = {
        "teams": meta,
        "players": pool,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    text = (
        "/* Generated from 2025-26 NBA regular-season totals. */\n"
        "const LEAGUE_DATA = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n"
    )
    OUT.write_text(text, encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
