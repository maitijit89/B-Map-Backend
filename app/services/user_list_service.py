from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.db.models import UserList, Place, user_list_places
from app.schemas.user_list import UserListCreate, UserListResponse, UserListDetailResponse, AddPlaceRequest
from app.schemas.place import PlaceResponse
from uuid import UUID
from typing import List, Optional
from geoalchemy2.functions import ST_X, ST_Y, ST_AsText

class UserListService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_place(self, google_place_id: str, name: str, address: Optional[str], lat: float, lng: float) -> Place:
        stmt = select(Place).where(Place.google_place_id == google_place_id)
        result = await self.db.execute(stmt)
        place = result.scalars().first()
        
        if not place:
            location = f"POINT({lng} {lat})"
            place = Place(
                google_place_id=google_place_id,
                name=name,
                address=address,
                location=location,
                rating=0,
                user_ratings_total=0
            )
            self.db.add(place)
            await self.db.flush()
        return place

    async def create_list(self, user_id: UUID, list_in: UserListCreate) -> UserListResponse:
        user_list = UserList(
            user_id=user_id,
            name=list_in.name,
            is_public=list_in.is_public
        )
        self.db.add(user_list)
        await self.db.commit()
        await self.db.refresh(user_list)
        
        return UserListResponse(
            id=user_list.id,
            user_id=user_list.user_id,
            name=user_list.name,
            is_public=user_list.is_public,
            created_at=user_list.created_at,
            places_count=0
        )

    async def get_user_lists(self, user_id: UUID) -> List[UserListResponse]:
        # Select lists with count of associated places
        stmt = select(
            UserList,
            func.count(user_list_places.c.place_id).label("places_count")
        ).outerjoin(
            user_list_places, UserList.id == user_list_places.c.list_id
        ).where(
            UserList.user_id == user_id
        ).group_by(UserList.id)
        
        result = await self.db.execute(stmt)
        user_lists = []
        for row in result:
            user_list = row[0]
            places_count = row[1]
            user_lists.append(UserListResponse(
                id=user_list.id,
                user_id=user_list.user_id,
                name=user_list.name,
                is_public=user_list.is_public,
                created_at=user_list.created_at,
                places_count=places_count
            ))
        return user_lists

    async def add_place_to_list(self, user_id: UUID, list_id: UUID, req: AddPlaceRequest) -> bool:
        # Check list ownership
        list_stmt = select(UserList).where(UserList.id == list_id, UserList.user_id == user_id)
        list_res = await self.db.execute(list_stmt)
        user_list = list_res.scalars().first()
        if not user_list:
            return False
            
        place = await self.get_or_create_place(req.google_place_id, req.name, req.address, req.lat, req.lng)
        
        # Check if already in the list to prevent primary key violation
        check_stmt = select(user_list_places).where(
            user_list_places.c.list_id == list_id,
            user_list_places.c.place_id == place.id
        )
        check_res = await self.db.execute(check_stmt)
        if check_res.first():
            return True # already added
            
        # Append place using association table insert or ORM relationship
        # Since we mapped it as relationship we can do:
        user_list.places.append(place)
        await self.db.commit()
        return True

    async def remove_place_from_list(self, user_id: UUID, list_id: UUID, place_id: UUID) -> bool:
        # Check list ownership
        list_stmt = select(UserList).where(UserList.id == list_id, UserList.user_id == user_id)
        list_res = await self.db.execute(list_stmt)
        user_list = list_res.scalars().first()
        if not user_list:
            return False
            
        place_stmt = select(Place).where(Place.id == place_id)
        place_res = await self.db.execute(place_stmt)
        place = place_res.scalars().first()
        if not place:
            return False
            
        if place in user_list.places:
            user_list.places.remove(place)
            await self.db.commit()
            return True
        return False

    async def get_list_details(self, user_id: UUID, list_id: UUID) -> Optional[UserListDetailResponse]:
        # Fetch list
        list_stmt = select(UserList).where(UserList.id == list_id)
        list_res = await self.db.execute(list_stmt)
        user_list = list_res.scalars().first()
        if not user_list:
            return None
            
        # Privacy guard
        if not user_list.is_public and user_list.user_id != user_id:
            return None
            
        # Fetch places in list with coordinate extraction
        stmt = select(
            Place,
            ST_X(ST_AsText(Place.location)).label("lng"),
            ST_Y(ST_AsText(Place.location)).label("lat")
        ).join(
            user_list_places, Place.id == user_list_places.c.place_id
        ).where(
            user_list_places.c.list_id == list_id
        )
        
        result = await self.db.execute(stmt)
        places = []
        for row in result:
            p = row[0]
            places.append(PlaceResponse(
                id=p.id,
                google_place_id=p.google_place_id,
                name=p.name,
                address=p.address,
                lat=row.lat,
                lng=row.lng,
                rating=p.rating,
                user_ratings_total=p.user_ratings_total,
                created_at=p.created_at
            ))
            
        return UserListDetailResponse(
            id=user_list.id,
            user_id=user_list.user_id,
            name=user_list.name,
            is_public=user_list.is_public,
            created_at=user_list.created_at,
            places=places
        )
