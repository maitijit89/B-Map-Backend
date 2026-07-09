from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.models import Pin
from app.schemas.pin import PinCreate, PinResponse, PinUpdate
from uuid import UUID
from typing import List

class PinService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def create_pin(self, user_id: UUID, pin_in: PinCreate) -> PinResponse:
        location = {
            "type": "Point",
            "coordinates": [pin_in.lng, pin_in.lat]
        }
        pin = Pin(
            user_id=user_id,
            name=pin_in.name,
            description=pin_in.description,
            location=location
        )
        await self.db.pins.insert_one(pin.to_dict())
        return PinResponse(
            id=pin.id,
            user_id=pin.user_id,
            name=pin.name,
            description=pin.description,
            lat=pin_in.lat,
            lng=pin_in.lng,
            created_at=pin.created_at
        )

    async def get_user_pins(self, user_id: UUID) -> List[PinResponse]:
        cursor = self.db.pins.find({"user_id": user_id})
        pins = []
        async for doc in cursor:
            pins.append(PinResponse(
                id=doc["_id"],
                user_id=doc["user_id"],
                name=doc["name"],
                description=doc.get("description"),
                lat=doc["location"]["coordinates"][1],
                lng=doc["location"]["coordinates"][0],
                created_at=doc["created_at"]
            ))
        return pins

    async def delete_pin(self, user_id: UUID, pin_id: UUID) -> bool:
        res = await self.db.pins.delete_one({"_id": pin_id, "user_id": user_id})
        return res.deleted_count > 0
        
    async def update_pin(self, user_id: UUID, pin_id: UUID, pin_in: PinUpdate) -> PinResponse:
        pin_doc = await self.db.pins.find_one({"_id": pin_id, "user_id": user_id})
        if not pin_doc:
            return None
            
        update_fields = {}
        if pin_in.name is not None:
            update_fields["name"] = pin_in.name
        if pin_in.description is not None:
            update_fields["description"] = pin_in.description
        if pin_in.lat is not None or pin_in.lng is not None:
            new_lat = pin_in.lat if pin_in.lat is not None else pin_doc["location"]["coordinates"][1]
            new_lng = pin_in.lng if pin_in.lng is not None else pin_doc["location"]["coordinates"][0]
            update_fields["location"] = {
                "type": "Point",
                "coordinates": [new_lng, new_lat]
            }
            
        if update_fields:
            await self.db.pins.update_one({"_id": pin_id}, {"$set": update_fields})
            pin_doc = await self.db.pins.find_one({"_id": pin_id})
            
        return PinResponse(
            id=pin_doc["_id"],
            user_id=pin_doc["user_id"],
            name=pin_doc["name"],
            description=pin_doc.get("description"),
            lat=pin_doc["location"]["coordinates"][1],
            lng=pin_doc["location"]["coordinates"][0],
            created_at=pin_doc["created_at"]
        )

