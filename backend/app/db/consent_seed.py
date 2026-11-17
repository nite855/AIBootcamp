"""Initial Korean PIPA-compliant consent policies and idempotent seeder."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.models import ConsentPolicy

DEFAULT_CONSENT_POLICIES: tuple[dict[str, object], ...] = (
    {
        "code": "AGE_14_PLUS",
        "version": 1,
        "title": "[필수] 만 14세 이상 이용자 확인",
        "summary": "개인정보 보호법 제22조의2에 따라 만 14세 이상 본인 확인을 진행합니다.",
        "purpose": "법정대리인 동의 절차 없이 회원가입이 가능한 연령(만 14세 이상) 확인",
        "items": "만 14세 이상 여부 확인 정보",
        "retention_period": "회원 탈퇴 시까지",
        "refusal_notice": "만 14세 이상 확인에 동의하지 않으시면 회원가입 및 서비스 이용이 제한됩니다.",
        "is_required": True,
        "is_sensitive": False,
        "is_active": True,
        "display_order": 1,
    },
    {
        "code": "PRIVACY_COLLECTION",
        "version": 1,
        "title": "[필수] 개인정보 수집·이용 동의",
        "summary": "회원 가입, JWT 기반 로그인 인증 및 계정별 서비스 제공을 위해 최소한의 개인정보를 수집·이용합니다.",
        "purpose": "회원 식별, 로그인 인증 및 세션 관리, 계정별 기록 보관 서비스 제공, 법적 동의·철회 이력 관리",
        "items": "아이디, 비밀번호(단방향 암호화 저장), 이메일 주소, 닉네임, 접속 및 인증·동의 이력",
        "retention_period": "회원 탈퇴 시 지체 없이 파기 (단, 관계 법령에 따른 보존 의무가 있는 경우 해당 기간 보관)",
        "refusal_notice": "개인정보 수집·이용 동의를 거부할 권리가 있으나, 필수 항목 미동의 시 회원가입 및 로그인 기반 서비스 이용이 불가능합니다.",
        "is_required": True,
        "is_sensitive": False,
        "is_active": True,
        "display_order": 2,
    },
    {
        "code": "SENSITIVE_EMOTION_PROCESSING",
        "version": 1,
        "title": "[필수] 민감정보(대화·일기 및 감정 분석 정보) 처리 및 활용 동의",
        "summary": "개인정보 보호법 제23조에 따라 사용자의 정서·심리 상태와 연관된 민감정보를 일반 개인정보와 분리하여 별도 동의를 받습니다.",
        "purpose": "사용자가 작성한 대화·일기 원문의 AI 감정 분석 수행, 계정별 감정 분석 결과·통계·수집 카드 도감 생성 및 저장",
        "items": "대화·일기 원문, 9가지 감정 확률 분포 및 우세 감정·단계, 발급·수집된 감정 카드 도감 내역",
        "retention_period": "회원 탈퇴 시 또는 개별 기록 삭제 시 지체 없이 파기 (기록 삭제 시 연결된 카드 해금 기록도 함께 삭제)",
        "refusal_notice": "민감정보 처리 및 활용에 대한 동의를 거부할 권리가 있으나, 거부 시 감정 분석, 기록 저장 및 카드 수집 기능을 이용할 수 없습니다.",
        "is_required": True,
        "is_sensitive": True,
        "is_active": True,
        "display_order": 3,
    },
    {
        "code": "OPTIONAL_SERVICE_IMPROVEMENT",
        "version": 1,
        "title": "[선택] 서비스 품질 개선을 위한 비식별 통계 활용 동의",
        "summary": "개인을 식별할 수 없는 집계 통계 범위 내에서 서비스 UX 및 감정 분류 품질 개선에 활용합니다.",
        "purpose": "감정 분류 UX 개선 및 서비스 이용 통계 분석 (개별 대화·일기 원문 미포함)",
        "items": "비식별화된 감정 분류 분포 통계, 기능 이용 빈도",
        "retention_period": "동의 철회 시 또는 회원 탈퇴 시까지",
        "refusal_notice": "선택 항목 동의를 거부하거나 추후 철회하시더라도 회원가입 및 기본 감정 분석·기록·도감 서비스 이용에는 불이익이 없습니다.",
        "is_required": False,
        "is_sensitive": False,
        "is_active": True,
        "display_order": 4,
    },
)


def seed_consent_policies(db: Session) -> None:
    """Insert default active Korean PIPA consent policies if they do not exist."""
    existing_pairs = set(
        db.execute(select(ConsentPolicy.code, ConsentPolicy.version)).all()
    )
    added = False
    for policy_data in DEFAULT_CONSENT_POLICIES:
        key = (policy_data["code"], policy_data["version"])
        if key not in existing_pairs:
            db.add(ConsentPolicy(**policy_data))
            added = True
    if added:
        db.commit()
