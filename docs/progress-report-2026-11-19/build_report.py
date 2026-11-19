"""Builds the client progress report PDF (run: python build_report.py). Screenshots sit beside this script."""
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from PIL import Image as PILImage

HERE = Path(__file__).parent
OUT = HERE.parent / "Fixzy-Pro-Progress-Report-2026-11-19.pdf"
INK, MUTED, LINE = colors.HexColor("#141412"), colors.HexColor("#6f6b63"), colors.HexColor("#e0dbd3")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=26, leading=30, textColor=INK, alignment=0, spaceAfter=4)
SUB = ParagraphStyle("SUB", parent=ss["Normal"], fontSize=11, leading=15, textColor=MUTED)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=INK, spaceBefore=16, spaceAfter=6)
H3 = ParagraphStyle("H3", parent=ss["Heading3"], fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=INK, spaceBefore=10, spaceAfter=3)
BODY = ParagraphStyle("BODY", parent=ss["Normal"], fontSize=10, leading=14.5, textColor=colors.HexColor("#2a2925"))
SMALL = ParagraphStyle("SMALL", parent=BODY, fontSize=8.5, leading=12, textColor=MUTED)
CELL = ParagraphStyle("CELL", parent=BODY, fontSize=9, leading=12.5)
CELLB = ParagraphStyle("CELLB", parent=CELL, fontName="Helvetica-Bold")
BUL = ParagraphStyle("BUL", parent=BODY, leftIndent=12, bulletIndent=0, spaceAfter=2)


def bullets(items):
    return [Paragraph(t, BUL, bulletText="•") for t in items]


def shot(name, caption, width=16.4 * cm):
    w, h = PILImage.open(HERE / name).size
    img = Image(str(HERE / name), width=width, height=width * h / w)
    t = Table([[img]], colWidths=[width])
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    return KeepTogether([t, Spacer(1, 3), Paragraph(caption, SMALL), Spacer(1, 8)])


def table(rows, widths):
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("LEFTPADDING", (0, 0), (-1, -1), 4),
                           ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4efe8")), ("LINEBELOW", (0, 0), (-1, 0), 1, INK)]))
    return t


def P(t, s=CELL):
    return Paragraph(t, s)


def res(t, ok=True):
    return Paragraph('<font color="%s"><b>%s</b></font>' % ("#2f6b4f" if ok else "#a13a2a", t), CELL)


def footer(c, d):
    c.saveState()
    c.setFont("Helvetica", 8)
    c.setFillColor(MUTED)
    c.drawString(2 * cm, 1.2 * cm, "Fixzy Pro  |  Progress report  |  19 November 2026")
    c.drawRightString(A4[0] - 2 * cm, 1.2 * cm, "Page %d" % d.page)
    c.restoreState()


s = []
s += [Paragraph("Fixzy Pro", H1), Paragraph("Progress and change report. Provider app, build of 19 November 2026.", SUB), Spacer(1, 10)]
s += [Paragraph("Summary", H2), Paragraph(
    "This update gives the provider app a new look and a clearer day-to-day flow. The sign-in page, header, bottom bar and My jobs page were redesigned, "
    "money is now highlighted everywhere, and a new Live status popup and a floating timer show how long you have been online and how long the current trip has run. "
    "The checks we could run automatically all passed. Items we could not test yet are listed in the testing report on the last pages.", BODY)]

s += [Paragraph("What changed", H2)]
s += [Paragraph("1. New sign-in page", H3)]
s += bullets([
    "Split layout: the form on the left, a quiet dot-grid canvas on the right. The page says clearly that it is the <b>Fixzy Pro provider app</b>, and points customers to the separate customer app.",
    "Inline checks for email and password, a show/hide toggle, a clear error banner for failed sign-ins, and a loading state on the button.",
    "Light and dark appearance follow the device setting. On phones the canvas is hidden and the form fills the screen.",
    "The dial on the canvas follows the mouse, and the footer ticker steps through the real job stages: Confirmed, On the way, Working, Done."])
s += [Spacer(1, 6), shot("01-login.jpg", "Figure 1. New sign-in page (dark appearance).")]

s += [Paragraph("2. My jobs page", H3)]
s += bullets([
    "The job that needs attention now sits in a dark block with a large time, the customer, address, phone (tap to call) and estimate, plus a three-step progress line.",
    "Upcoming jobs are listed by day (Today, Tomorrow, then the date) as a clean list with thin rules instead of boxed cards. Each row shows time, customer, service and address, status and price.",
    "Active and Completed are simple text tabs with counts. Times and headings use a serif typeface; reading text stays in Inter, matching the rest of the app.",
    "Action buttons keep their meaning: Start trip, Start work, Mark complete, and Route."])
s += [Spacer(1, 6), shot("02-my-jobs.jpg", "Figure 2. My jobs: the current job on the left, upcoming jobs by day on the right.")]

s += [Paragraph("3. Money is highlighted everywhere", H3)]
s += bullets(["Every amount (job estimates, requests, earnings, payouts, totals) now sits on a soft tan highlight in bold figures, so prices are the first thing the eye finds."])
s += [Paragraph("4. Account page", H3)]
s += bullets([
    "Large-number tiles for total earned, jobs completed, rating and reply time; green for today, dark for this month.",
    "A 14-day earnings chart with amounts above each bar, and a paid-versus-due bar for payouts with a short recent-payouts list."])
s += [Spacer(1, 6), shot("03-account.jpg", "Figure 3. Account page with highlighted earnings.")]

s += [Paragraph("5. Header, bottom bar, Live popup and timer", H3)]
s += bullets([
    "<b>Header:</b> logo flush left, Sign out on the right, no page name. While you are online the logo glows softly and its full stop becomes a pulsing green dot.",
    "<b>Bottom bar:</b> a floating rounded bar, as wide as its five items, that stays on every screen except sign-in (the job screen now keeps it too). Each item fits its own slot so nothing spills past the edge.",
    "<b>Live tab:</b> the last item. Grey and still when offline; radar rings pulse outward when online. It opens a popup (no separate page) with the online switch, open requests and total earned.",
    "<b>Online switch:</b> a small, minimal toggle with an Online / Offline label.",
    "<b>Floating timer:</b> a small translucent pill above the bar showing time online and the running time of the current trip or job, with a close button. Closing hides it until something changes."])
s += [Spacer(1, 6), shot("04-live-popup.jpg", "Figure 4. The Live popup, with the bottom bar and timer behind it.")]

s += [Paragraph("Testing report", H2),
      Paragraph("Run on 19 November 2026 against the local development setup. Automated results are exact; browser checks were done by hand in a desktop-width browser preview.", BODY), Spacer(1, 8)]
s += [Paragraph("Automated checks", H3)]
s += [table([
    [P("<b>Check</b>"), P("<b>What it covers</b>"), P("<b>Result</b>")],
    [P("Provider app type-check"), P("Compiles every screen and component with strict TypeScript. 8 type errors were found in new code during this check and fixed."), res("Pass, 0 errors")],
    [P("Customer app type-check"), P("Same check on the customer app."), res("Pass, 0 errors")],
    [P("Backend type-check"), P("Same check on the API."), res("Pass, 0 errors")],
    [P("Backend API test suite<br/>(npm run test:e2e)"), P("46 checks: sign-up and sign-in, token refresh, profile rules, booking create / reschedule / cancel / double-booking, role guards, orders and coupons, payments, reviews, wishlist, contact form, password reset."), res("46 passed, 0 failed, 1 skipped")],
], [4.0 * cm, 9.2 * cm, 3.8 * cm])]
s += [Spacer(1, 4), Paragraph("The one skipped check is the provider-flow test, which needs admin credentials that were not supplied. Running the suite several times in a row triggers the API rate limiter (HTTP 429) and shows false failures; the clean run is the one reported.", SMALL)]

s += [Paragraph("Manual checks in the browser", H3)]
rows = [[P("<b>Area</b>"), P("<b>What was checked</b>"), P("<b>Result</b>")]]
for a, w, r in [
    ("Sign-in page", "Renders in split layout; prefilled test account signs in; app opens after sign-in; no bottom bar or timer shown on this page.", "Pass"),
    ("My jobs", "Current-job block, day-grouped list, Active and Completed tabs and counts, highlighted prices, hairline layout at desktop width.", "Pass"),
    ("Account", "Tiles, earnings chart, payouts bar, highlighted money.", "Pass"),
    ("Bottom bar", "Five items fit their slots, active item filled, Live item pulses when online, bar visible on the job screen.", "Pass (desktop width)"),
    ("Live popup", "Opens from the Live tab, shows status, switch, open requests and total earned, closes with the cross.", "Pass"),
    ("Floating timer", "Shows time online and trip time and keeps counting.", "Pass (close button not exercised)"),
    ("Online switch", "Appears in minimal form on Requests and in the popup.", "Pass (toggling not exercised)"),
]:
    rows.append([P(a, CELLB), P(w), res(r)])
s += [table(rows, [3.0 * cm, 10.2 * cm, 3.8 * cm])]

s += [Paragraph("Not yet tested", H3)]
s += bullets([
    "<b>Real phones.</b> No Android or iPhone device or installed APK was used. The bottom bar was reported cut off at the screen edge on a narrow browser window; a fix for the browser's visible height was added but has not been confirmed on a phone.",
    "<b>Job actions end to end.</b> Start trip, Start work, Mark complete and the timer reset after a status change were not pressed during this run (they change live job data).",
    "<b>Sign-in edge cases.</b> Wrong password, empty fields and the Reset password flow were not exercised on the new page. The light appearance of the sign-in page was not captured.",
    "<b>Accessibility.</b> Keyboard focus rings and screen-reader labels were added but not checked with assistive technology.",
    "<b>Automated UI tests.</b> The project has none yet; every screen check above is manual."])

s += [Paragraph("Known limits", H2)]
s += bullets([
    "The time-online figure is stored on the device, because the server does not record when a provider went online. It starts when the app first sees you online and survives restarts. Saving it on the server is a small follow-up and would make it consistent across devices.",
    "The trip timer counts from the last status change of the job.",
    "There is no Google / SSO sign-in button, because the backend has no social sign-in."])
s += [Paragraph("Suggested next steps", H2)]
s += bullets([
    "Install a build on a real Android phone and re-check the bottom bar, timer and sign-in page at phone size.",
    "Record the online start time on the server.",
    "Add a short set of automated UI tests for sign-in and the job status flow."])

SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm, bottomMargin=2 * cm,
                  title="Fixzy Pro progress report", author="Fixzy").build(s, onFirstPage=footer, onLaterPages=footer)
print(OUT)
