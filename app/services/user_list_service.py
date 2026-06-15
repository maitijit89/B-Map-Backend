from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.models import UserList, Place
from app.schemas.user_list import UserListCreate, UserListResponse, UserListDetailResponse, AddPlaceRequest
from app.schemas.place import PlaceResponse
from uuid import UUID
from typing import List, Optional

class UserListService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_or_create_place(self, google_place_id: str, name: str, address: Optional[str], lat: float, lng: float) -> Place:
        doc = await self.db.places.find_one({"google_place_id": google_place_id})
        if doc:
            return Place.from_dict(doc)
            
        location = {
            "type": "Point",
            "coordinates": [lng, lat]
        }
        place = Place(
            google_place_id=google_place_id,
            name=name,
            address=address,
            location=location,
            rating=0,
            user_ratings_total=0
        )
        await self.db.places.insert_one(place.to_dict())
        return place

    async def create_list(self, user_id: UUID, list_in: UserListCreate) -> UserListResponse:
        user_list = UserList(
            user_id=user_id,
            name=list_in.name,
            is_public=list_in.is_public,
            place_ids=[]
        )
        await self.db.user_lists.insert_one(user_list.to_dict())
        
        return UserListResponse(
            id=user_list.id,
            user_id=user_list.user_id,
            name=user_list.name,
            is_public=user_list.is_public,
            created_at=user_list.created_at,
            places_count=0
        )

    async def get_user_lists(self, user_id: UUID) -> List[UserListResponse]:
        cursor = self.db.user_lists.find({"user_id": user_id})
        user_lists = []
        async for doc in cursor:
            user_lists.append(UserListResponse(
                id=doc["_id"],
                user_id=doc["user_id"],
                name=doc["name"],
                is_public=doc["is_public"],
                created_at=doc["created_at"],
                places_count=len(doc.get("place_ids", []))
            ))
        return user_lists

    async def add_place_to_list(self, user_id: UUID, list_id: UUID, req: AddPlaceRequest) -> bool:
        # Check list ownership
        user_list = await self.db.user_lists.find_one({"_id": list_id, "user_id": user_id})
        if not user_list:
            return False
            
        place = await self.get_or_create_place(req.google_place_id, req.name, req.address, req.lat, req.lng)
        
        # Append place ID to place_ids list if not already present ($addToSet)
        await self.db.user_lists.update_one(
            {"_id": list_id, "user_id": user_id},
            {"$addToSet": {"place_ids": place.id}}
        )
        return True

    async def remove_place_from_list(self, user_id: UUID, list_id: UUID, place_id: UUID) -> bool:
        # Check list ownership
        user_list = await self.db.user_lists.find_one({"_id": list_id, "user_id": user_id})
        if not user_list:
            return False
            
        place_doc = await self.db.places.find_one({"_id": place_id})
        if not place_doc:
            return False
            
        # Delete from list
        res = await self.db.user_lists.update_one(
            {"_id": list_id, "user_id": user_id},
            {"$pull": {"place_ids": place_id}}
        )
        return res.modified_count > 0

    async def get_list_details(self, user_id: UUID, list_id: UUID) -> Optional[UserListDetailResponse]:
        # Fetch list
        user_list_doc = await self.db.user_lists.find_one({"_id": list_id})
        if not user_list_doc:
            return None
            
        # Privacy guard
        if not user_list_doc.get("is_public", False) and user_list_doc["user_id"] != user_id:
            return None
            
        place_ids = user_list_doc.get("place_ids", [])
        places = []
        if place_ids:
            places_cursor = self.db.places.find({"_id": {"$in": place_ids}})
            async for p in places_cursor:
                places.append(PlaceResponse(
                    id=p["_id"],
                    google_place_id=p["google_place_id"],
                    name=p["name"],
                    address=p.get("address"),
                    lat=p["location"]["coordinates"][1],
                    lng=p["location"]["coordinates"][0],
                    rating=p.get("rating", 0),
                    user_ratings_total=p.get("user_ratings_total", 0),
                    created_at=p["created_at"]
                ))
                
        return UserListDetailResponse(
            id=user_list_doc["_id"],
            user_id=user_list_doc["user_id"],
            name=user_list_doc["name"],
            is_public=user_list_doc.get("is_public", False),
            created_at=user_list_doc["created_at"],
            places=places
        )
