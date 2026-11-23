"""Builds the client change log PDF from docs/changelog.json (run: python build_changelog.py)."""
import json
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

DOCS = Path(__file__).resolve().parent.parent
entries = json.loads((DOCS / "changelog.json").read_text(encoding="utf-8"))
OUT = DOCS / ("Fixzy-Change-Log-%s.pdf" % entries[0]["date"])
INK, MUTED, LINE = colors.HexColor("#141412"), colors.HexColor("#6f6b63"), colors.HexColor("#e0dbd3")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=26, leading=30, textColor=INK, alignment=0, spaceAfter=4)
SUB = ParagraphStyle("SUB", parent=ss["Normal"], fontSize=11, leading=15, textColor=MUTED)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=13.5, leading=17, textColor=INK)
DATE = ParagraphStyle("DATE", parent=ss["Normal"], fontName="Helvetica-Bold", fontSize=9.5, leading=14, textColor=MUTED)
BODY = ParagraphStyle("BODY", parent=ss["Normal"], fontSize=10, leading=14.5, textColor=colors.HexColor("#2a2925"))
BUL = ParagraphStyle("BUL", parent=BODY, leftIndent=12, bulletIndent=0, spaceAfter=3)


def fmt(d):
    y, m, dd = map(int, d.split("-"))
    return date(y, m, dd).strftime("%d %B %Y").lstrip("0")


def entry(e):
    head = Table([[Paragraph(fmt(e["date"]), DATE), Paragraph(escape(e["title"]), H2)]], colWidths=[3.4 * cm, 13.6 * cm])
    head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEABOVE", (0, 0), (-1, 0), 1, INK), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    items = [Paragraph(escape(t), BUL, bulletText="•") for t in e["items"]]
    body = Table([["", items]], colWidths=[3.4 * cm, 13.6 * cm])
    body.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 12)]))
    return KeepTogether([head, body])


def footer(c, d):
    c.saveState()
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    c.drawString(2 * cm, 1.2 * cm, "Fixzy  |  Change log  |  Updated %s" % fmt(entries[0]["date"]))
    c.drawRightString(A4[0] - 2 * cm, 1.2 * cm, "Page %d" % d.page)
    c.restoreState()


story = [Paragraph("Fixzy change log", H1),
         Paragraph("What has been added and improved across the customer app, pro app, admin panel and website. Latest first.", SUB),
         Spacer(1, 14)]
story += [entry(e) for e in entries]
SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm, title="Fixzy change log", author="Fixzy").build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
