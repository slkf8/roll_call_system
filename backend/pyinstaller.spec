# PyInstaller spec for the Roll Call backend.
#
# Build from the backend/ directory:
#   python -m PyInstaller pyinstaller.spec --clean --noconfirm
#
# Or use scripts/build_binary.sh from the repo root.
#
# Output: backend/dist/roll_call_backend/roll_call_backend  (--onedir mode)
#
# Bundled assets:
#   * frontend/dist  ->  _MEIPASS/frontend_dist
#     resolved at runtime by app.config.get_frontend_dist_dir().
#
# Runtime data directory (NOT inside the bundle):
#   Resolved by app.config.get_data_dir() to the binary's neighbor:
#     <binary-folder>/data/app.db
#   The whole folder is portable; move it and the database goes too.
#   Override with ROLL_CALL_DATA_DIR=/your/path.
# pylint: disable=undefined-variable

from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files


SPEC_DIR = Path(SPECPATH).resolve()
REPO_ROOT = SPEC_DIR.parent
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"


# Frontend assets shipped inside the bundle. Located by
# get_frontend_dist_dir() at <_MEIPASS>/frontend_dist.
datas = [
    (str(FRONTEND_DIST), "frontend_dist"),
]

# openpyxl ships XML schema / constants files that PyInstaller's static
# analysis can miss; pull them explicitly to be safe.
datas += collect_data_files("openpyxl")


# Hidden imports — modules loaded lazily that PyInstaller's analyzer cannot
# discover from `import` statements alone. Keep this list minimal: rely on
# PyInstaller's built-in hooks + pyinstaller-hooks-contrib first, only add
# safety nets for known-problematic lazy loaders.
hiddenimports = [
    # SQLAlchemy lazily loads dialect modules via importlib at engine
    # creation time. We use the sqlite dialect exclusively.
    "sqlalchemy.dialects.sqlite",

    # anyio (used transitively by FastAPI/Starlette) selects its asyncio
    # backend dynamically via import_module.
    "anyio._backends._asyncio",

    # uvicorn auto-selects its loop / http / websocket implementations.
    # The "auto" submodules wire to the real backend (uvloop/httptools/
    # websockets) when they exist.
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan.on",
]


a = Analysis(
    ["run.py"],
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="roll_call_backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="roll_call_backend",
)
