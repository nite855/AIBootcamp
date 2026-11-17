"""Input validation rules aligned with frontend diary-core.js and contracts/analysis.schema.json."""

TEXT_MAX_CODE_POINTS = 10000


def validate_non_empty_identifier(value: str) -> str:
    if not isinstance(value, str) or "\x00" in value or not value.strip():
        raise ValueError("식별자는 비어 있을 수 없습니다.")
    return value


def validate_record_text(text: str) -> str:
    """Validate diary record text using Unicode code-point counting without silent truncation."""
    if not isinstance(text, str):
        raise ValueError("본문은 문자열이어야 합니다.")
    if "\x00" in text:
        raise ValueError("텍스트에 읽을 수 없는 문자가 있습니다.")
    if not text.strip():
        raise ValueError("분석할 문장을 입력하세요.")
    if len(text) > TEXT_MAX_CODE_POINTS:
        raise ValueError("전체 입력이 10,000자를 초과했습니다. 원문은 자동으로 자르지 않습니다.")
    return text
