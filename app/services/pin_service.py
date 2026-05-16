from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from geoalchemy2.functions import ST_AsText, ST_X, ST_Y
from app.db.models import Pin
from app.schemas.pin import PinCreate, PinResponse, PinUpdate
from uuid import UUID
from typing import List

class PinService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_pin(self, user_id: UUID, pin_in: PinCreate) -> PinResponse:
        location = f"POINT({pin_in.lng} {pin_in.lat})"
        pin = Pin(
            user_id=user_id,
            name=pin_in.name,
            description=pin_in.description,
            location=location
        )
        self.db.add(pin)
        await self.db.commit()
        await self.db.refresh(pin)
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
        stmt = select(
            Pin,
            ST_X(ST_AsText(Pin.location)).label("lng"),
            ST_Y(ST_AsText(Pin.location)).label("lat")
        ).where(Pin.user_id == user_id)
        
        result = await self.db.execute(stmt)
        pins = []
        for row in result:
            pin = row[0]
            pins.append(PinResponse(
                id=pin.id,
                user_id=pin.user_id,
                name=pin.name,
                description=pin.description,
                lat=row.lat,
                lng=row.lng,
                created_at=pin.created_at
            ))
        return pins

    async def delete_pin(self, user_id: UUID, pin_id: UUID):
        stmt = select(Pin).where(Pin.id == pin_id, Pin.user_id == user_id)
        result = await self.db.execute(stmt)
        pin = result.scalars().first()
        if pin:
            await self.db.delete(pin)
            await self.db.commit()
            return True
        return False
        
    async def update_pin(self, user_id: UUID, pin_id: UUID, pin_in: PinUpdate) -> PinResponse:
        stmt = select(Pin).where(Pin.id == pin_id, Pin.user_id == user_id)
        result = await self.db.execute(stmt)
        pin = result.scalars().first()
        
        if not pin:
            return None
            
        if pin_in.name is not None:
            pin.name = pin_in.name
        if pin_in.description is not None:
            pin.description = pin_in.description
        if pin_in.lat is not None and pin_in.lng is not None:
            pin.location = f"POINT({pin_in.lng} {pin_in.lat})"
            
        await self.db.commit()
        await self.db.refresh(pin)
        
        # Extract current coordinates
        coord_stmt = select(
            ST_X(ST_AsText(Pin.location)).label("lng"),
            ST_Y(ST_AsText(Pin.location)).label("lat")
        ).where(Pin.id == pin_id)
        coord_res = await self.db.execute(coord_stmt)
        coords = coord_res.first()
        
        return PinResponse(
            id=pin.id,
            user_id=pin.user_id,
            name=pin.name,
            description=pin.description,
            lat=coords.lat,
            lng=coords.lng,
            created_at=pin.created_at
        )
