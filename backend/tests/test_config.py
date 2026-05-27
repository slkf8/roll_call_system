import sys

import pytest

from app import config


def test_get_data_dir_fallback_to_backend_data(monkeypatch):
    monkeypatch.delenv("ROLL_CALL_DATA_DIR", raising=False)
    monkeypatch.delenv("ROLL_CALL_PACKAGED", raising=False)
    monkeypatch.setattr(sys, "frozen", False, raising=False)

    path = config.get_data_dir()

    assert path.name == "data"
    assert path.parent.name == "backend"
    assert path.exists()


def test_get_data_dir_with_env(monkeypatch, tmp_path):
    target = tmp_path / "custom-data"
    monkeypatch.setenv("ROLL_CALL_DATA_DIR", str(target))
    monkeypatch.delenv("ROLL_CALL_PACKAGED", raising=False)
    monkeypatch.setattr(sys, "frozen", False, raising=False)

    result = config.get_data_dir()

    assert result == target
    assert target.exists()


def test_get_database_url_contains_app_db(monkeypatch, tmp_path):
    monkeypatch.setenv("ROLL_CALL_DATA_DIR", str(tmp_path))

    url = config.get_database_url()

    assert url.startswith("sqlite:///")
    assert url.endswith("app.db")
    assert str(tmp_path) in url


def test_get_allowed_origins_fallback(monkeypatch):
    monkeypatch.delenv("ROLL_CALL_ALLOWED_ORIGINS", raising=False)

    assert config.get_allowed_origins() == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def test_get_allowed_origins_with_env(monkeypatch):
    monkeypatch.setenv(
        "ROLL_CALL_ALLOWED_ORIGINS",
        "http://localhost:5173 , tauri://localhost,, http://127.0.0.1:1420 ",
    )

    assert config.get_allowed_origins() == [
        "http://localhost:5173",
        "tauri://localhost",
        "http://127.0.0.1:1420",
    ]


def test_get_allowed_origins_empty_env_falls_back(monkeypatch):
    monkeypatch.setenv("ROLL_CALL_ALLOWED_ORIGINS", "  , , ")

    assert config.get_allowed_origins() == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def test_get_host_fallback(monkeypatch):
    monkeypatch.delenv("ROLL_CALL_HOST", raising=False)
    monkeypatch.delenv("HOST", raising=False)

    assert config.get_host() == "127.0.0.1"


def test_get_host_env_override(monkeypatch):
    monkeypatch.setenv("ROLL_CALL_HOST", "0.0.0.0")

    assert config.get_host() == "0.0.0.0"


def test_get_host_falls_back_to_HOST(monkeypatch):
    monkeypatch.delenv("ROLL_CALL_HOST", raising=False)
    monkeypatch.setenv("HOST", "192.168.1.10")

    assert config.get_host() == "192.168.1.10"


def test_get_port_fallback(monkeypatch):
    monkeypatch.delenv("ROLL_CALL_PORT", raising=False)
    monkeypatch.delenv("PORT", raising=False)

    assert config.get_port() == 8000


def test_get_port_env_override(monkeypatch):
    monkeypatch.setenv("ROLL_CALL_PORT", "9090")

    assert config.get_port() == 9090


def test_get_port_falls_back_to_PORT(monkeypatch):
    monkeypatch.delenv("ROLL_CALL_PORT", raising=False)
    monkeypatch.setenv("PORT", "8001")

    assert config.get_port() == 8001


def test_get_port_invalid_value_raises(monkeypatch):
    monkeypatch.setenv("ROLL_CALL_PORT", "not-a-number")

    with pytest.raises(ValueError):
        config.get_port()


def test_get_port_out_of_range_raises(monkeypatch):
    monkeypatch.setenv("ROLL_CALL_PORT", "70000")

    with pytest.raises(ValueError):
        config.get_port()


# ---------- packaged-mode detection ----------


def test_is_packaged_defaults_to_false(monkeypatch):
    monkeypatch.delenv("ROLL_CALL_PACKAGED", raising=False)
    monkeypatch.setattr(sys, "frozen", False, raising=False)

    assert config._is_packaged() is False


def test_is_packaged_truthy_env_values(monkeypatch):
    monkeypatch.setattr(sys, "frozen", False, raising=False)
    for value in ("1", "true", "TRUE", "yes", "YES", "True"):
        monkeypatch.setenv("ROLL_CALL_PACKAGED", value)
        assert config._is_packaged() is True, f"{value!r} should be packaged"


def test_is_packaged_falsy_env_values(monkeypatch):
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    for value in ("0", "false", "FALSE", "no", "NO", "False"):
        monkeypatch.setenv("ROLL_CALL_PACKAGED", value)
        assert config._is_packaged() is False, f"{value!r} should be source"


def test_is_packaged_invalid_env_raises(monkeypatch):
    monkeypatch.setenv("ROLL_CALL_PACKAGED", "maybe")
    monkeypatch.setattr(sys, "frozen", False, raising=False)

    with pytest.raises(ValueError):
        config._is_packaged()


def test_is_packaged_falls_back_to_sys_frozen(monkeypatch):
    monkeypatch.delenv("ROLL_CALL_PACKAGED", raising=False)
    monkeypatch.setattr(sys, "frozen", True, raising=False)

    assert config._is_packaged() is True


def test_is_packaged_env_overrides_sys_frozen(monkeypatch):
    monkeypatch.setenv("ROLL_CALL_PACKAGED", "0")
    monkeypatch.setattr(sys, "frozen", True, raising=False)

    assert config._is_packaged() is False


# ---------- packaged-mode data dir ----------


def test_get_data_dir_packaged_mode_uses_platformdirs(monkeypatch):
    from platformdirs import user_data_dir

    monkeypatch.delenv("ROLL_CALL_DATA_DIR", raising=False)
    monkeypatch.setenv("ROLL_CALL_PACKAGED", "1")
    monkeypatch.setattr(sys, "frozen", False, raising=False)

    path = config.get_data_dir()
    expected = user_data_dir("RollCall", appauthor=False)

    assert str(path) == expected
    assert path.exists()


def test_get_data_dir_env_overrides_packaged_mode(monkeypatch, tmp_path):
    target = tmp_path / "explicit-override"
    monkeypatch.setenv("ROLL_CALL_DATA_DIR", str(target))
    monkeypatch.setenv("ROLL_CALL_PACKAGED", "1")
    monkeypatch.setattr(sys, "frozen", True, raising=False)

    result = config.get_data_dir()

    assert result == target
    assert target.exists()


# ---------- frontend dist resolution ----------


def test_get_frontend_dist_dir_env_override_existing(monkeypatch, tmp_path):
    target = tmp_path / "custom-dist"
    target.mkdir()
    monkeypatch.setenv("ROLL_CALL_FRONTEND_DIST", str(target))
    monkeypatch.delenv("ROLL_CALL_PACKAGED", raising=False)
    monkeypatch.setattr(sys, "frozen", False, raising=False)

    assert config.get_frontend_dist_dir() == target


def test_get_frontend_dist_dir_env_override_missing_returns_none(monkeypatch, tmp_path):
    target = tmp_path / "does-not-exist"
    monkeypatch.setenv("ROLL_CALL_FRONTEND_DIST", str(target))
    monkeypatch.delenv("ROLL_CALL_PACKAGED", raising=False)
    monkeypatch.setattr(sys, "frozen", False, raising=False)

    assert config.get_frontend_dist_dir() is None


def test_get_frontend_dist_dir_packaged_uses_meipass(monkeypatch, tmp_path):
    bundled = tmp_path / "frontend_dist"
    bundled.mkdir()
    monkeypatch.delenv("ROLL_CALL_FRONTEND_DIST", raising=False)
    monkeypatch.setenv("ROLL_CALL_PACKAGED", "1")
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)

    assert config.get_frontend_dist_dir() == bundled


def test_get_frontend_dist_dir_packaged_meipass_missing_returns_none(
    monkeypatch, tmp_path
):
    monkeypatch.delenv("ROLL_CALL_FRONTEND_DIST", raising=False)
    monkeypatch.setenv("ROLL_CALL_PACKAGED", "1")
    # _MEIPASS points at tmp_path but no frontend_dist subdir exists.
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)

    assert config.get_frontend_dist_dir() is None
