import pytest

from app import config


def test_get_data_dir_fallback_to_backend_data(monkeypatch):
    monkeypatch.delenv("ROLL_CALL_DATA_DIR", raising=False)

    path = config.get_data_dir()

    assert path.name == "data"
    assert path.parent.name == "backend"
    assert path.exists()


def test_get_data_dir_with_env(monkeypatch, tmp_path):
    target = tmp_path / "custom-data"
    monkeypatch.setenv("ROLL_CALL_DATA_DIR", str(target))

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
