import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

class User:
    def __init__(
        self,
        id=None,
        email=None,
        password_hash=None,
        display_name=None,
        phone_number=None,
        firebase_uid=None,
        gender=None,
        dob=None,
        profile_pic_url=None,
        is_email_verified=False,
        created_at=None,
        updated_at=None
    ):
        self.id = id or uuid.uuid4()
        self.email = email
        self.password_hash = password_hash
        self.display_name = display_name
        self.phone_number = phone_number
        self.firebase_uid = firebase_uid
        self.gender = gender
        self.dob = dob
        self.profile_pic_url = profile_pic_url
        self.is_email_verified = is_email_verified
        self.created_at = created_at or datetime.now(timezone.utc)
        self.updated_at = updated_at or datetime.now(timezone.utc)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]):
        if not data:
            return None
        return cls(
            id=data.get("_id"),
            email=data.get("email"),
            password_hash=data.get("password_hash"),
            display_name=data.get("display_name"),
            phone_number=data.get("phone_number"),
            firebase_uid=data.get("firebase_uid"),
            gender=data.get("gender"),
            dob=data.get("dob"),
            profile_pic_url=data.get("profile_pic_url"),
            is_email_verified=data.get("is_email_verified", False),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at")
        )

    def to_dict(self) -> Dict[str, Any]:
        data = {
            "_id": self.id,
            "display_name": self.display_name,
            "is_email_verified": self.is_email_verified,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
        if self.email is not None:
            data["email"] = self.email
        if self.password_hash is not None:
            data["password_hash"] = self.password_hash
        if self.phone_number is not None:
            data["phone_number"] = self.phone_number
        if self.firebase_uid is not None:
            data["firebase_uid"] = self.firebase_uid
        if self.gender is not None:
            data["gender"] = self.gender
        if self.dob is not None:
            data["dob"] = self.dob
        if self.profile_pic_url is not None:
            data["profile_pic_url"] = self.profile_pic_url
        return data
