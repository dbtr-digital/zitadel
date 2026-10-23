"""Feste Upstream-Aufgaben seriell, ohne die NX-Parallelisierung ihrer Werkzeuge."""
import json,subprocess,sys
from pathlib import Path
project=json.loads(Path('apps/api/project.json').read_text())['targets']
allowed={'generate-install','generate-stubs','generate-assets','generate-statik','build-console'}
for name in sys.argv[1:]:
 if name not in allowed:raise SystemExit('Unbekannte Buildaufgabe')
 task=project[name]
 commands=[task['command']] if 'command' in task else task['options']['commands']
 for command in commands:
  if not isinstance(command,str):raise SystemExit('Unerwartetes Upstream-Kommandoformat')
  print(name+': '+command,flush=True)
  subprocess.run(['bash','-euo','pipefail','-c',command],check=True)
