#!/usr/bin/env python3
"""Export a portable source ZIP using Python's standard library.

Usage: python3 scripts/export_project.py /absolute/path/pokemon-battle-vue.zip
Run against a committed, clean source snapshot for a reproducible handoff.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TOP_LEVEL = ['README.md', 'AGENTS.md', '.gitignore', '.nvmrc', 'package.json',
             'package-lock.json', 'vite.config.js', 'index.html', 'playground.html']
DIRECTORIES = ['apps', 'packages', 'public', 'docs', 'examples', 'scripts', 'tests']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    output = args.output.expanduser().resolve()
    if ROOT == output or ROOT in output.parents:
        parser.error('Put the output archive outside the project directory.')
    files = [ROOT / name for name in TOP_LEVEL]
    for directory in DIRECTORIES:
        files.extend(p for p in (ROOT / directory).rglob('*')
                     if p.is_file() and not {'__pycache__', 'node_modules', 'dist'}.intersection(p.parts) and p.suffix not in {'.pyc', '.tgz'})
    files = sorted(files)
    missing = [str(p.relative_to(ROOT)) for p in files if not p.is_file()]
    if missing:
        parser.error(f'Missing required files: {missing}')
    for path in files:
        if path.is_symlink() or path.name.startswith('.env'):
            parser.error(f'Unexpected symlink or environment file: {path.relative_to(ROOT)}')

    try:
        dirty = subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, stderr=subprocess.DEVNULL, text=True)
        commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, stderr=subprocess.DEVNULL, text=True).strip()
        if dirty:
            parser.error('Commit or clean the intended source before exporting.')
    except (subprocess.CalledProcessError, FileNotFoundError):
        # An extracted portable project has no Git metadata; preserve origin if present.
        old_manifest = ROOT / 'EXPORT_MANIFEST.json'
        original = json.loads(old_manifest.read_text()) if old_manifest.exists() else {}
        commit = original.get('source_commit')

    payloads = [(str(path.relative_to(ROOT)), path.read_bytes()) for path in files]
    manifest = {
        'project': 'pokemon-battle-vue',
        'source_commit': commit,
        'runtime_entrypoint': 'apps/game/src/main.js',
        'excluded': ['.git', '.openai', '.env files', 'node_modules', 'dist'],
        'files': {name: hashlib.sha256(data).hexdigest() for name, data in payloads},
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in payloads:
            archive.writestr('pokemon-battle-vue/' + name, data)
        archive.writestr('pokemon-battle-vue/EXPORT_MANIFEST.json', json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'archive': str(output), 'files': len(payloads) + 1,
                      'bytes': output.stat().st_size, 'source_commit': commit}))


if __name__ == '__main__':
    main()
