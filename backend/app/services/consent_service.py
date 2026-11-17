"""Korean PIPA consent policy lookup, validation, audit logging, and withdrawal enforcement."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.security import hash_token, utc_now
from backend.app.db.models import ConsentPolicy, User, UserConsent, UserConsentLog
from backend.app.schemas.auth import ConsentItemInput, ConsentPolicyOut, UserConsentStatusOut


class ConsentValidationError(ValueError):
    """Raised when submitted consent items fail Korean PIPA mandatory/sensitive checks."""

    def __init__(self, code: str, message: str, missing_codes: list[str] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.missing_codes = missing_codes or []


def get_active_policies(db: Session) -> list[ConsentPolicy]:
    """Return the latest active version of each consent policy ordered for display."""
    rows = db.scalars(
        select(ConsentPolicy)
        .where(ConsentPolicy.is_active.is_(True))
        .order_by(ConsentPolicy.code.asc(), ConsentPolicy.version.desc())
    ).all()

    latest_by_code: dict[str, ConsentPolicy] = {}
    for row in rows:
        if row.code not in latest_by_code:
            latest_by_code[row.code] = row
    return sorted(latest_by_code.values(), key=lambda p: (p.display_order, p.code))


def serialize_policy(policy: ConsentPolicy) -> ConsentPolicyOut:
    return ConsentPolicyOut(
        code=policy.code,
        version=policy.version,
        title=policy.title,
        summary=policy.summary,
        purpose=policy.purpose,
        items=policy.items,
        retention_period=policy.retention_period,
        refusal_notice=policy.refusal_notice,
        is_required=policy.is_required,
        is_sensitive=policy.is_sensitive,
        display_order=policy.display_order,
    )


def evaluate_user_consents(
    db: Session, user_id: object
) -> tuple[bool, list[str], list[UserConsentStatusOut]]:
    """Compare user's active consent records against current active policy versions."""
    policies = get_active_policies(db)
    existing_rows = db.scalars(
        select(UserConsent).where(UserConsent.user_id == user_id)
    ).all()
    by_key = {(row.policy_code, row.policy_version): row for row in existing_rows}

    missing_required: list[str] = []
    statuses: list[UserConsentStatusOut] = []

    for policy in policies:
        record = by_key.get((policy.code, policy.version))
        is_agreed = bool(record and record.agreed and record.revoked_at is None)
        if policy.is_required and not is_agreed:
            missing_required.append(policy.code)
        statuses.append(
            UserConsentStatusOut(
                code=policy.code,
                version=policy.version,
                title=policy.title,
                summary=policy.summary,
                purpose=policy.purpose,
                items=policy.items,
                retention_period=policy.retention_period,
                refusal_notice=policy.refusal_notice,
                is_required=policy.is_required,
                is_sensitive=policy.is_sensitive,
                display_order=policy.display_order,
                agreed=is_agreed,
                agreed_at=record.agreed_at if record else None,
                revoked_at=record.revoked_at if record else None,
                needs_reconsent=bool(policy.is_required and not is_agreed),
            )
        )

    return len(missing_required) == 0, missing_required, statuses


def apply_user_consents(
    db: Session,
    *,
    user: User,
    submitted: list[ConsentItemInput],
    client_meta_hash: str | None,
    require_all_mandatory: bool,
) -> tuple[bool, list[str], list[UserConsentStatusOut]]:
    """Validate and persist individual consent decisions + immutable audit logs."""
    policies = get_active_policies(db)
    policies_by_code = {p.code: p for p in policies}

    submitted_by_code: dict[str, ConsentItemInput] = {}
    for item in submitted:
        policy = policies_by_code.get(item.code)
        if policy is None:
            raise ConsentValidationError("UNKNOWN_CONSENT_POLICY", f"알 수 없는 동의 항목입니다: {item.code}")
        if item.version != policy.version:
            raise ConsentValidationError(
                "STALE_CONSENT_VERSION",
                f"최신 동의서 버전({policy.code} v{policy.version})을 확인해 주세요.",
            )
        if item.code in submitted_by_code:
            raise ConsentValidationError("DUPLICATE_CONSENT_ITEM", f"중복된 동의 항목입니다: {item.code}")
        submitted_by_code[item.code] = item

    existing_rows = db.scalars(
        select(UserConsent).where(UserConsent.user_id == user.id)
    ).all()
    existing_by_key = {(row.policy_code, row.policy_version): row for row in existing_rows}

    if require_all_mandatory:
        missing: list[str] = []
        for policy in policies:
            if not policy.is_required:
                continue
            item = submitted_by_code.get(policy.code)
            existing = existing_by_key.get((policy.code, policy.version))
            already_ok = bool(existing and existing.agreed and existing.revoked_at is None)
            will_agree = item.agreed if item is not None else already_ok
            if not will_agree:
                missing.append(policy.code)
        if missing:
            raise ConsentValidationError(
                "MANDATORY_CONSENT_REQUIRED",
                "만 14세 이상 확인, 개인정보 수집·이용 및 민감정보 처리 필수 동의가 모두 필요합니다.",
                missing_codes=missing,
            )
    else:
        for item in submitted_by_code.values():
            policy = policies_by_code[item.code]
            if policy.is_required and not item.agreed:
                raise ConsentValidationError(
                    "MANDATORY_REVOCATION_REQUIRES_WITHDRAWAL",
                    "필수 개인정보 및 민감정보 동의 철회는 회원 탈퇴를 통해 처리됩니다.",
                    missing_codes=[policy.code],
                )

    now = utc_now()
    user_ref_hash = hash_token(str(user.id))

    for code, item in submitted_by_code.items():
        policy = policies_by_code[code]
        key = (policy.code, policy.version)
        existing = existing_by_key.get(key)
        was_agreed = bool(existing and existing.agreed and existing.revoked_at is None)

        if existing is None:
            existing = UserConsent(
                user_id=user.id,
                policy_code=policy.code,
                policy_version=policy.version,
                agreed=item.agreed,
                agreed_at=now if item.agreed else None,
                revoked_at=None if item.agreed else now,
                updated_at=now,
            )
            db.add(existing)
            action = "GRANTED" if item.agreed else "REVOKED"
            db.add(
                UserConsentLog(
                    user_id=user.id,
                    user_ref_hash=user_ref_hash,
                    policy_code=policy.code,
                    policy_version=policy.version,
                    action=action,
                    client_meta_hash=client_meta_hash,
                    created_at=now,
                )
            )
        else:
            existing.agreed = item.agreed
            existing.updated_at = now
            if item.agreed:
                existing.agreed_at = now
                existing.revoked_at = None
                if not was_agreed:
                    db.add(
                        UserConsentLog(
                            user_id=user.id,
                            user_ref_hash=user_ref_hash,
                            policy_code=policy.code,
                            policy_version=policy.version,
                            action="GRANTED",
                            client_meta_hash=client_meta_hash,
                            created_at=now,
                        )
                    )
            else:
                existing.revoked_at = now
                if was_agreed:
                    db.add(
                        UserConsentLog(
                            user_id=user.id,
                            user_ref_hash=user_ref_hash,
                            policy_code=policy.code,
                            policy_version=policy.version,
                            action="REVOKED",
                            client_meta_hash=client_meta_hash,
                            created_at=now,
                        )
                    )

        if policy.code == "AGE_14_PLUS" and item.agreed:
            user.is_adult_14_plus = True

    db.flush()
    return evaluate_user_consents(db, user.id)
