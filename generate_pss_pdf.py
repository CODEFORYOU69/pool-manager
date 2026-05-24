#!/usr/bin/env python3
"""
Génère un PDF d'estimation des plastrons PSS pour une compétition
Benjamin/Minime de 600 combattants sur 12 aires.
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    HRFlowable, KeepTogether
)
from reportlab.lib.colors import HexColor
import os

# Couleurs
PRIMARY = HexColor("#1e40af")
PRIMARY_LIGHT = HexColor("#dbeafe")
PRIMARY_MED = HexColor("#3b82f6")
HEADER_BG = HexColor("#1e3a5f")
ROW_ALT = HexColor("#f0f5ff")
SUCCESS = HexColor("#059669")
SUCCESS_LIGHT = HexColor("#d1fae5")
WARNING = HexColor("#d97706")
WARNING_LIGHT = HexColor("#fef3c7")
GRAY_600 = HexColor("#4b5563")
GRAY_800 = HexColor("#1f2937")
WHITE = colors.white
BLACK = colors.black

output_path = os.path.join(os.path.dirname(__file__), "public", "Estimation_Plastrons_PSS.pdf")

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    topMargin=15*mm,
    bottomMargin=15*mm,
    leftMargin=15*mm,
    rightMargin=15*mm,
)

styles = getSampleStyleSheet()
elements = []

# --- Custom styles ---
title_style = ParagraphStyle(
    "CustomTitle", parent=styles["Title"],
    fontSize=20, textColor=PRIMARY, spaceAfter=2*mm,
    fontName="Helvetica-Bold", alignment=TA_CENTER,
)
subtitle_style = ParagraphStyle(
    "CustomSubtitle", parent=styles["Normal"],
    fontSize=11, textColor=GRAY_600, alignment=TA_CENTER,
    spaceAfter=6*mm,
)
section_style = ParagraphStyle(
    "SectionTitle", parent=styles["Heading2"],
    fontSize=13, textColor=PRIMARY, spaceBefore=8*mm, spaceAfter=4*mm,
    fontName="Helvetica-Bold", borderPadding=(0, 0, 2, 0),
)
body_style = ParagraphStyle(
    "BodyText2", parent=styles["Normal"],
    fontSize=9.5, textColor=GRAY_800, spaceAfter=2*mm,
    leading=13,
)
note_style = ParagraphStyle(
    "NoteText", parent=styles["Normal"],
    fontSize=8.5, textColor=GRAY_600, spaceAfter=2*mm,
    leading=11, fontName="Helvetica-Oblique",
)
cell_style = ParagraphStyle(
    "CellStyle", parent=styles["Normal"],
    fontSize=8.5, textColor=GRAY_800, leading=11,
)
cell_center = ParagraphStyle(
    "CellCenter", parent=cell_style, alignment=TA_CENTER,
)
cell_bold = ParagraphStyle(
    "CellBold", parent=cell_style, fontName="Helvetica-Bold",
)
cell_bold_center = ParagraphStyle(
    "CellBoldCenter", parent=cell_bold, alignment=TA_CENTER,
)
header_cell = ParagraphStyle(
    "HeaderCell", parent=styles["Normal"],
    fontSize=8.5, textColor=WHITE, fontName="Helvetica-Bold",
    alignment=TA_CENTER, leading=11,
)

def make_table(data, col_widths=None, header_bg=HEADER_BG):
    """Create a styled table."""
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    # Alternate row colors
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))
    t.setStyle(TableStyle(style_cmds))
    return t

# ==========================================
# TITLE
# ==========================================
elements.append(Paragraph("Estimation des Plastrons PSS", title_style))
elements.append(Paragraph(
    "Competition Benjamin / Minime — 600 combattants — 12 aires de combat",
    subtitle_style
))
elements.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_MED, spaceAfter=4*mm))

# ==========================================
# 1. PARAMETRES
# ==========================================
elements.append(Paragraph("1. Parametres de la competition", section_style))
params_data = [
    [Paragraph("Parametre", header_cell), Paragraph("Valeur", header_cell)],
    [Paragraph("Nombre de combattants", cell_style), Paragraph("600", cell_bold_center)],
    [Paragraph("Categories d'age", cell_style), Paragraph("Benjamin + Minime", cell_bold_center)],
    [Paragraph("Genres", cell_style), Paragraph("Masculin + Feminin", cell_bold_center)],
    [Paragraph("Nombre d'aires", cell_style), Paragraph("12", cell_bold_center)],
    [Paragraph("Combats par personne (K)", cell_style), Paragraph("2", cell_bold_center)],
    [Paragraph("Repartition estimee", cell_style), Paragraph("55% garcons / 45% filles", cell_bold_center)],
    [Paragraph("Mode d'affectation", cell_style), Paragraph("Par taille de plastrons (PSS)", cell_bold_center)],
]
elements.append(make_table(params_data, col_widths=[100*mm, 70*mm]))

# ==========================================
# 2. REPARTITION PSS PAR CATEGORIE
# ==========================================
elements.append(Paragraph("2. Tailles PSS par categorie de poids (donnees FFTDA)", section_style))

pss_cat_data = [
    [Paragraph("Taille PSS", header_cell),
     Paragraph("Benjamin M", header_cell),
     Paragraph("Benjamin F", header_cell),
     Paragraph("Minime M", header_cell),
     Paragraph("Minime F", header_cell),
     Paragraph("Total cat.", header_cell)],

    [Paragraph("<b># 0</b>", cell_center),
     Paragraph("6 cat.\n-21 a -37kg", cell_center),
     Paragraph("6 cat.\n-17 a -33kg", cell_center),
     Paragraph("3 cat.\n-27 a -33kg", cell_center),
     Paragraph("4 cat.\n-23 a -33kg", cell_center),
     Paragraph("<b>19</b>", cell_bold_center)],

    [Paragraph("<b># 1</b>", cell_center),
     Paragraph("3 cat.\n-41 a -49kg", cell_center),
     Paragraph("3 cat.\n-37 a -44kg", cell_center),
     Paragraph("3 cat.\n-37 a -45kg", cell_center),
     Paragraph("3 cat.\n-37 a -44kg", cell_center),
     Paragraph("<b>12</b>", cell_bold_center)],

    [Paragraph("<b># 2</b>", cell_center),
     Paragraph("1 cat.\n+49kg", cell_center),
     Paragraph("1 cat.\n+44kg", cell_center),
     Paragraph("2 cat.\n-49, -53kg", cell_center),
     Paragraph("1 cat.\n-47kg", cell_center),
     Paragraph("<b>5</b>", cell_bold_center)],

    [Paragraph("<b># 3</b>", cell_center),
     Paragraph("-", cell_center),
     Paragraph("-", cell_center),
     Paragraph("2 cat.\n-57, +57kg", cell_center),
     Paragraph("2 cat.\n-51, +51kg", cell_center),
     Paragraph("<b>4</b>", cell_bold_center)],
]
elements.append(make_table(pss_cat_data, col_widths=[25*mm, 32*mm, 32*mm, 32*mm, 32*mm, 22*mm]))

# ==========================================
# 3. ESTIMATION COMBATTANTS PAR PSS
# ==========================================
elements.append(Paragraph("3. Repartition estimee des 600 combattants par taille PSS", section_style))
elements.append(Paragraph(
    "Distribution en cloche basee sur les donnees nationales. "
    "Finales = 3 combats/categorie (demi-finales + finale + bronze).",
    note_style
))

fighters_data = [
    [Paragraph("Taille PSS", header_cell),
     Paragraph("Nb combattants", header_cell),
     Paragraph("% du total", header_cell),
     Paragraph("Nb categories", header_cell),
     Paragraph("Combats poules\n(K=2)", header_cell),
     Paragraph("Combats finales\n(3/cat.)", header_cell),
     Paragraph("Total combats", header_cell)],

    [Paragraph("<b># 0</b>", cell_bold_center),
     Paragraph("~280", cell_center),
     Paragraph("47%", cell_center),
     Paragraph("19", cell_center),
     Paragraph("~280", cell_center),
     Paragraph("57", cell_center),
     Paragraph("<b>~337</b>", cell_bold_center)],

    [Paragraph("<b># 1</b>", cell_bold_center),
     Paragraph("~195", cell_center),
     Paragraph("32%", cell_center),
     Paragraph("12", cell_center),
     Paragraph("~195", cell_center),
     Paragraph("36", cell_center),
     Paragraph("<b>~231</b>", cell_bold_center)],

    [Paragraph("<b># 2</b>", cell_bold_center),
     Paragraph("~70", cell_center),
     Paragraph("12%", cell_center),
     Paragraph("5", cell_center),
     Paragraph("~70", cell_center),
     Paragraph("15", cell_center),
     Paragraph("<b>~85</b>", cell_bold_center)],

    [Paragraph("<b># 3</b>", cell_bold_center),
     Paragraph("~55", cell_center),
     Paragraph("9%", cell_center),
     Paragraph("4", cell_center),
     Paragraph("~55", cell_center),
     Paragraph("12", cell_center),
     Paragraph("<b>~67</b>", cell_bold_center)],
]
# Total row
fighters_data.append([
    Paragraph("<b>Total</b>", cell_bold_center),
    Paragraph("<b>600</b>", cell_bold_center),
    Paragraph("<b>100%</b>", cell_bold_center),
    Paragraph("<b>40</b>", cell_bold_center),
    Paragraph("<b>~600</b>", cell_bold_center),
    Paragraph("<b>120</b>", cell_bold_center),
    Paragraph("<b>~720</b>", cell_bold_center),
])
t = make_table(fighters_data, col_widths=[22*mm, 28*mm, 20*mm, 22*mm, 26*mm, 26*mm, 26*mm])
# Bold last row
t.setStyle(TableStyle([
    ("BACKGROUND", (0, -1), (-1, -1), PRIMARY_LIGHT),
    ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
]))
elements.append(t)

# ==========================================
# 4. AFFECTATION DES AIRES
# ==========================================
elements.append(Paragraph("4. Affectation des 12 aires (algorithme PSS)", section_style))
elements.append(Paragraph(
    "L'algorithme fusionne les tailles adjacentes les moins chargees (max 2 tailles/aire) pour equilibrer la charge, "
    "puis distribue les aires proportionnellement. Ici #2 et #3 sont fusionnes (ratio avant: 2.3, apres: 1.3).",
    note_style
))

areas_data = [
    [Paragraph("Taille PSS", header_cell),
     Paragraph("Aires attribuees", header_cell),
     Paragraph("Nb aires", header_cell),
     Paragraph("Combats totaux\n(poules + finales)", header_cell),
     Paragraph("Combats / aire", header_cell)],

    [Paragraph("<b># 0</b>", cell_bold_center),
     Paragraph("1, 2, 3, 4, 5", cell_center),
     Paragraph("5", cell_bold_center),
     Paragraph("~337", cell_center),
     Paragraph("~67", cell_bold_center)],

    [Paragraph("<b># 1</b>", cell_bold_center),
     Paragraph("6, 7, 8, 9", cell_center),
     Paragraph("4", cell_bold_center),
     Paragraph("~231", cell_center),
     Paragraph("~58", cell_bold_center)],

    [Paragraph("<b># 2 + # 3</b>", cell_bold_center),
     Paragraph("10, 11, 12", cell_center),
     Paragraph("3", cell_bold_center),
     Paragraph("~152", cell_center),
     Paragraph("~51", cell_bold_center)],
]
areas_data.append([
    Paragraph("<b>Total</b>", cell_bold_center),
    Paragraph("", cell_center),
    Paragraph("<b>12</b>", cell_bold_center),
    Paragraph("<b>~720</b>", cell_bold_center),
    Paragraph("<b>~60 moy.</b>", cell_bold_center),
])
t = make_table(areas_data, col_widths=[28*mm, 38*mm, 22*mm, 35*mm, 32*mm])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, -1), (-1, -1), PRIMARY_LIGHT),
    ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
]))
elements.append(t)

# ==========================================
# 5. NOMBRE DE PLASTRONS NECESSAIRES
# ==========================================
elements.append(Paragraph("5. Estimation du nombre de plastrons PSS necessaires", section_style))
elements.append(Paragraph(
    "Recommande : 1 paire (2 plastrons) par aire + 1 spare par aire par taille PSS. "
    "Les aires 10-12 partagent #2 et #3 : chaque taille doit etre disponible sur ces 3 aires. "
    "Confortable : 2 paires (4 plastrons) par aire pour rotation + 1 spare/aire/taille.",
    note_style
))

plastrons_data = [
    [Paragraph("Taille PSS", header_cell),
     Paragraph("Nb aires", header_cell),
     Paragraph("Minimum\n(2/aire)", header_cell),
     Paragraph("Recommande\n(2/aire + 1 spare\n/aire/taille)", header_cell),
     Paragraph("Confortable\n(4/aire + 1 spare\n/aire/taille)", header_cell)],

    [Paragraph("<b># 0</b>", cell_bold_center),
     Paragraph("5", cell_center),
     Paragraph("10", cell_center),
     Paragraph("<b>15</b>", cell_bold_center),
     Paragraph("25", cell_center)],

    [Paragraph("<b># 1</b>", cell_bold_center),
     Paragraph("4", cell_center),
     Paragraph("8", cell_center),
     Paragraph("<b>12</b>", cell_bold_center),
     Paragraph("20", cell_center)],

    [Paragraph("<b># 2</b>", cell_bold_center),
     Paragraph("3 (partage)", cell_center),
     Paragraph("6", cell_center),
     Paragraph("<b>9</b>", cell_bold_center),
     Paragraph("15", cell_center)],

    [Paragraph("<b># 3</b>", cell_bold_center),
     Paragraph("3 (partage)", cell_center),
     Paragraph("6", cell_center),
     Paragraph("<b>9</b>", cell_bold_center),
     Paragraph("15", cell_center)],
]
plastrons_data.append([
    Paragraph("<b>TOTAL</b>", cell_bold_center),
    Paragraph("<b>12</b>", cell_bold_center),
    Paragraph("<b>30</b>", cell_bold_center),
    Paragraph("<b>45</b>", cell_bold_center),
    Paragraph("<b>75</b>", cell_bold_center),
])
t = make_table(plastrons_data, col_widths=[28*mm, 22*mm, 30*mm, 38*mm, 38*mm])
# Highlight recommended column
for i in range(1, len(plastrons_data)):
    bg = SUCCESS_LIGHT if i < len(plastrons_data) - 1 else PRIMARY_LIGHT
    t.setStyle(TableStyle([
        ("BACKGROUND", (3, i), (3, i), bg),
    ]))
t.setStyle(TableStyle([
    ("BACKGROUND", (0, -1), (-1, -1), PRIMARY_LIGHT),
    ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
]))
elements.append(t)

# ==========================================
# 6. AVANTAGE DU MODE PSS
# ==========================================
elements.append(Paragraph("6. Avantage du mode PSS vs mode equilibre", section_style))

comparison_data = [
    [Paragraph("", header_cell),
     Paragraph("Mode equilibre\n(actuel)", header_cell),
     Paragraph("Mode PSS\n(nouveau)", header_cell)],

    [Paragraph("Tailles par aire", cell_bold),
     Paragraph("1 a 4 tailles\n(toutes melangees)", cell_center),
     Paragraph("<b>1 a 2 tailles max</b>\npar aire", cell_bold_center)],

    [Paragraph("Changements plastrons", cell_bold),
     Paragraph("Frequent\n(a chaque changement de categorie)", cell_center),
     Paragraph("<b>Rare ou aucun</b>\n(max 2 tailles adjacentes)", cell_bold_center)],

    [Paragraph("Stock necessaire/aire", cell_bold),
     Paragraph("Toutes tailles\ndisponibles sur chaque aire", cell_center),
     Paragraph("<b>1 a 2 tailles</b>\npar aire", cell_bold_center)],

    [Paragraph("Temps entre combats", cell_bold),
     Paragraph("Plus long\n(changement de plastron)", cell_center),
     Paragraph("<b>Reduit</b>\n(habillage en parallele)", cell_bold_center)],

    [Paragraph("Logistique plastrons", cell_bold),
     Paragraph("Complexe", cell_center),
     Paragraph("<b>Simplifiee</b>", cell_bold_center)],
]
t = make_table(comparison_data, col_widths=[40*mm, 60*mm, 60*mm])
# Green tint on PSS column
for i in range(1, len(comparison_data)):
    t.setStyle(TableStyle([
        ("BACKGROUND", (2, i), (2, i), SUCCESS_LIGHT if i % 2 != 0 else HexColor("#ecfdf5")),
        ("BACKGROUND", (1, i), (1, i), WARNING_LIGHT if i % 2 != 0 else HexColor("#fffbeb")),
    ]))
elements.append(t)

# ==========================================
# FOOTER NOTE
# ==========================================
elements.append(Spacer(1, 8*mm))
elements.append(HRFlowable(width="100%", thickness=0.5, color=GRAY_600, spaceAfter=3*mm))
elements.append(Paragraph(
    "Document genere par le Taekwondo Tournament Manager — "
    "Algorithme d'affectation PSS (pssAreaAssignment.js). "
    "Les estimations sont basees sur une distribution nationale typique et peuvent varier "
    "selon la competition reelle. Ajustez le nombre de spares en fonction de l'etat de votre materiel.",
    note_style
))

# Build
doc.build(elements)
print(f"PDF genere : {output_path}")
