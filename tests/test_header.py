import pytest
from cockpit.workspace import HeaderError, read_header, validate, write_header

WITH = "---\nstatus: active\nsummary: A project\ncustom_key: x\n---\n\n# Title\nbody: not a field\n"


def test_reads_fields():
    fields, present = read_header(WITH)
    assert present and fields == {"status": "active", "summary": "A project", "custom_key": "x"}


def test_no_header():
    assert read_header("# Title\n") == ({}, False)


def test_unclosed_header_is_absent():
    assert read_header("---\nstatus: active\n# Title\n") == ({}, False)


def test_value_with_colon():
    assert read_header("---\nsummary: Bug : 664\n---\n")[0]["summary"] == "Bug : 664"


def test_writes_without_touching_body_or_unknown_keys():
    assert write_header(WITH, {"status": "paused", "next_step": "Call the vendor"}) == (
        "---\nstatus: paused\nsummary: A project\ncustom_key: x\nnext_step: Call the vendor\n---\n"
        "\n# Title\nbody: not a field\n")


def test_empty_value_removes_the_field():
    assert "custom_key" not in write_header(WITH, {"custom_key": ""})


def test_crlf_kept():
    out = write_header(WITH.replace("\n", "\r\n"), {"waiting_on": "me"})
    assert "\n" not in out.replace("\r\n", "")
    assert out.endswith("\r\n\r\n# Title\r\nbody: not a field\r\n")


def test_adds_a_header_when_missing():
    assert write_header("# Title\n", {"status": "active", "summary": "S"}) == "---\nstatus: active\nsummary: S\n---\n\n# Title\n"


def test_refuses_an_unclosed_header():
    with pytest.raises(HeaderError):
        write_header("---\nstatus: active\n# Title\n", {"waiting_on": "me"})


@pytest.mark.parametrize("key,value", [
    ("status", "finished"), ("waiting_on", "him"), ("due", "soon"), ("due", "2026-13-01"), ("created", "yesterday"),
    ("summary", "a\nb"), ("summary", "---"), ("unknown", "x"), ("status", ""), ("summary", "  "),
])
def test_validate_refuses(key, value):
    with pytest.raises(HeaderError):
        validate(key, value)


def test_validate_cleans_and_truncates():
    assert validate("next_step", "  x  ") == "x"
    assert len(validate("summary", "a" * 400)) == 300
    assert validate("due", "") == ""
