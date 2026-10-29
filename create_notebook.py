import nbformat as nbf
from pathlib import Path

def build_ingarss_notebook():
    cell_dir = Path("ingarss_2026/notebook_cells")
    
    with open(cell_dir / "cell1_physics.md", "r", encoding="utf-8") as f:
        cell1_text = f.read()
    with open(cell_dir / "cell2_telemetry.py", "r", encoding="utf-8") as f:
        cell2_text = f.read()
    with open(cell_dir / "cell3_figure.py", "r", encoding="utf-8") as f:
        cell3_text = f.read()
    with open(cell_dir / "cell4_lifecycle.py", "r", encoding="utf-8") as f:
        cell4_text = f.read()
    with open(cell_dir / "cell5_bias.md", "r", encoding="utf-8") as f:
        cell5_text = f.read()

    nb = nbf.v4.new_notebook()
    nb.cells = [
        nbf.v4.new_markdown_cell(cell1_text),
        nbf.v4.new_code_cell(cell2_text),
        nbf.v4.new_code_cell(cell3_text),
        nbf.v4.new_code_cell(cell4_text),
        nbf.v4.new_markdown_cell(cell5_text),
    ]

    targets = [
        Path("ingarss2026_submission/NISAR_Bihar_Flood_Lifecycle.ipynb"),
        Path("ingarss_2026/notebooks/NISAR_Bihar_Flood_Lifecycle.ipynb"),
    ]

    for target in targets:
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            nbf.write(nb, f)
        print(f"Successfully generated notebook: {target}")

if __name__ == "__main__":
    build_ingarss_notebook()
