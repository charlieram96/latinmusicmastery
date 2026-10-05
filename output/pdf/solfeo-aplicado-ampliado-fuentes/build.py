"""Rebuild the Spanish PDF and editable scores, then validate them."""
from pathlib import Path
import subprocess,sys
root=Path(__file__).resolve().parent
for filename in ('author.py','revise.py','render.py','export_scores.py','validate.py','audit_coverage.py'):
    subprocess.run([sys.executable,str(root/filename)],check=True,cwd=root)
