"""Tests for the macOS maintenance wrapper and its packaging.

The wrapper is a thin shell layer over the binary CLI. These tests use a fake
executable "binary" that records its argv + ROLL_CALL_DATA_DIR, plus a mini-repo
copy of package_release.sh — the real repo ``release/`` and ``backend/data`` are
never touched. Skipped where bash is unavailable (e.g. Windows CI).
"""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
WRAPPER_SRC = REPO / "scripts" / "maintenance_restore.command"
PACKAGE_SRC = REPO / "scripts" / "package_release.sh"
MAINT_DEST_NAME = "RollCall 資料回復工具.command"

BASH = shutil.which("bash")
pytestmark = pytest.mark.skipif(BASH is None, reason="bash not available")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_FAKE_BIN = """\
#!/usr/bin/env bash
printf 'ARGS=%s\\n' "$*" >> "$FAKE_BIN_LOG"
printf 'ARGC=%s\\n' "$#" >> "$FAKE_BIN_LOG"
printf 'DATADIR=%s\\n' "${ROLL_CALL_DATA_DIR:-}" >> "$FAKE_BIN_LOG"
i=0
for a in "$@"; do
  printf 'ARG[%s]=%s\\n' "$i" "$a" >> "$FAKE_BIN_LOG"
  i=$((i + 1))
done
exit 0
"""


def _make_portable(tmp_path: Path, *, with_binary: bool = True):
    root = tmp_path / "RollCall_Portable_macOS"
    (root / "maintenance").mkdir(parents=True)
    (root / "roll_call_backend" / "data" / "backups").mkdir(parents=True)

    dest = root / "maintenance" / MAINT_DEST_NAME
    shutil.copy(WRAPPER_SRC, dest)
    dest.chmod(0o755)

    if with_binary:
        binp = root / "roll_call_backend" / "roll_call_backend"
        binp.write_text(_FAKE_BIN, encoding="utf-8")
        binp.chmod(0o755)

    return root, dest


def _run(dest: Path, stdin: str, log_path: Path, cwd: Path):
    env = dict(os.environ)
    env["FAKE_BIN_LOG"] = str(log_path)
    return subprocess.run(
        [BASH, str(dest)],
        input=stdin,
        text=True,
        capture_output=True,
        cwd=str(cwd),
        env=env,
    )


def _log_lines(log_path: Path) -> list[str]:
    if not log_path.exists():
        return []
    return log_path.read_text(encoding="utf-8").splitlines()


# ---------------------------------------------------------------------------
# Syntax + static safety
# ---------------------------------------------------------------------------

def test_wrapper_bash_syntax_ok():
    proc = subprocess.run([BASH, "-n", str(WRAPPER_SRC)], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr


def test_wrapper_has_no_forbidden_tokens():
    text = WRAPPER_SRC.read_text(encoding="utf-8")
    for forbidden in ("eval", "sqlite3", "kill", "ROLL_CALL_ENABLE_APP_LOCK"):
        assert forbidden not in text, f"wrapper must not contain {forbidden!r}"


def test_wrapper_only_drives_binary_cli():
    text = WRAPPER_SRC.read_text(encoding="utf-8")
    assert "roll_call_backend/roll_call_backend" in text
    for sub in ("list", "validate", "restore", "history"):
        assert sub in text
    assert "ROLL_CALL_DATA_DIR=" in text
    assert "RESTORE" in text


# ---------------------------------------------------------------------------
# Self-location + forwarding
# ---------------------------------------------------------------------------

def test_missing_binary_errors_clearly(tmp_path: Path):
    root, dest = _make_portable(tmp_path, with_binary=False)
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    proc = _run(dest, stdin="1\n", log_path=tmp_path / "calls.log", cwd=elsewhere)
    assert proc.returncode == 1
    assert "找不到主程式" in proc.stdout + proc.stderr


def test_list_is_forwarded_with_fixed_data_dir(tmp_path: Path):
    root, dest = _make_portable(tmp_path)
    log = tmp_path / "calls.log"
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    proc = _run(dest, stdin="1\n0\n", log_path=log, cwd=elsewhere)
    assert proc.returncode == 0, proc.stderr
    lines = _log_lines(log)
    assert "ARGS=list" in lines
    datadirs = [ln.split("=", 1)[1] for ln in lines if ln.startswith("DATADIR=")]
    assert datadirs
    for d in datadirs:
        assert d.endswith("/roll_call_backend/data")
        assert "RollCall_Portable_macOS" in d


def test_validate_forwards_filename_as_single_arg(tmp_path: Path):
    root, dest = _make_portable(tmp_path)
    log = tmp_path / "calls.log"
    # filename with a space proves single-argument quoting.
    proc = _run(dest, stdin="2\nmy backup.db\n0\n", log_path=log, cwd=tmp_path)
    assert proc.returncode == 0, proc.stderr
    lines = _log_lines(log)
    assert "ARGS=validate my backup.db" in lines
    assert "ARGC=2" in lines
    assert "ARG[0]=validate" in lines
    assert "ARG[1]=my backup.db" in lines


def test_history_is_forwarded(tmp_path: Path):
    root, dest = _make_portable(tmp_path)
    log = tmp_path / "calls.log"
    proc = _run(dest, stdin="4\n0\n", log_path=log, cwd=tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "ARGS=history" in _log_lines(log)


# ---------------------------------------------------------------------------
# restore confirmation gate
# ---------------------------------------------------------------------------

def test_restore_without_confirmation_does_not_call_restore(tmp_path: Path):
    root, dest = _make_portable(tmp_path)
    log = tmp_path / "calls.log"
    # choice 3 -> filename -> confirm "no" (not RESTORE)
    proc = _run(dest, stdin="3\napp_latest.db\nno\n0\n", log_path=log, cwd=tmp_path)
    assert proc.returncode == 0, proc.stderr
    lines = _log_lines(log)
    # restore flow lists backups first, but must NOT issue a restore call.
    assert "ARGS=list" in lines
    assert not any(ln.startswith("ARGS=restore") for ln in lines)


def test_restore_empty_filename_cancels(tmp_path: Path):
    root, dest = _make_portable(tmp_path)
    log = tmp_path / "calls.log"
    proc = _run(dest, stdin="3\n\n0\n", log_path=log, cwd=tmp_path)
    assert proc.returncode == 0, proc.stderr
    lines = _log_lines(log)
    assert not any(ln.startswith("ARGS=restore") for ln in lines)


def test_restore_with_exact_confirmation_calls_binary(tmp_path: Path):
    root, dest = _make_portable(tmp_path)
    log = tmp_path / "calls.log"
    proc = _run(dest, stdin="3\nmy backup.db\nRESTORE\n0\n", log_path=log, cwd=tmp_path)
    assert proc.returncode == 0, proc.stderr
    lines = _log_lines(log)
    assert "ARGS=restore my backup.db" in lines
    assert "ARG[0]=restore" in lines
    assert "ARG[1]=my backup.db" in lines
    assert "ARGC=2" in lines
    datadirs = [ln.split("=", 1)[1] for ln in lines if ln.startswith("DATADIR=")]
    for d in datadirs:
        assert d.endswith("/roll_call_backend/data")


# ---------------------------------------------------------------------------
# Package integration (mini-repo; never touches real repo release/)
# ---------------------------------------------------------------------------

def test_package_includes_maintenance_tool_and_stays_db_free(tmp_path: Path):
    mini = tmp_path / "mini"
    (mini / "scripts").mkdir(parents=True)
    bundle = mini / "backend" / "dist" / "roll_call_backend"
    bundle.mkdir(parents=True)

    # Copy the real package + wrapper sources into the mini-repo.
    shutil.copy(PACKAGE_SRC, mini / "scripts" / "package_release.sh")
    (mini / "scripts" / "package_release.sh").chmod(0o755)
    shutil.copy(WRAPPER_SRC, mini / "scripts" / "maintenance_restore.command")

    # Fake bundle with a seeded DB to prove packaging wipes data/.
    binp = bundle / "roll_call_backend"
    binp.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
    binp.chmod(0o755)
    (bundle / "data").mkdir()
    (bundle / "data" / "app.db").write_text("SEED", encoding="utf-8")

    proc = subprocess.run(
        [BASH, str(mini / "scripts" / "package_release.sh")],
        cwd=str(mini),
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr

    rel = mini / "release" / "RollCall_Portable_macOS"
    maint = rel / "maintenance" / MAINT_DEST_NAME
    launcher = rel / "啟動 RollCall.command"
    data = rel / "roll_call_backend" / "data"

    assert maint.is_file() and os.access(maint, os.X_OK)
    assert launcher.is_file()  # normal launcher still produced
    assert data.is_dir()
    assert {p.name for p in data.iterdir()} == {"backups"}  # only backups/
    assert list((data / "backups").iterdir()) == []          # empty
    assert list(rel.rglob("*.db")) == []                     # no DB shipped

    # The real repo release dir must be untouched by this mini-repo run.
    assert not (mini / "release" / "RollCall_Portable_macOS.zip").exists()


def test_package_preflight_fails_without_wrapper_source(tmp_path: Path):
    mini = tmp_path / "mini"
    (mini / "scripts").mkdir(parents=True)
    bundle = mini / "backend" / "dist" / "roll_call_backend"
    bundle.mkdir(parents=True)
    shutil.copy(PACKAGE_SRC, mini / "scripts" / "package_release.sh")
    (mini / "scripts" / "package_release.sh").chmod(0o755)
    binp = bundle / "roll_call_backend"
    binp.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
    binp.chmod(0o755)
    # No maintenance_restore.command in mini/scripts -> preflight must fail.

    proc = subprocess.run(
        [BASH, str(mini / "scripts" / "package_release.sh")],
        cwd=str(mini),
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "maintenance wrapper not found" in proc.stdout + proc.stderr
