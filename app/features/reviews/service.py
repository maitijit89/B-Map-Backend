from motor.motor_asyncio import AsyncIOMotorDatabase
from app.features.reviews.models import Review
from app.features.places.models import Place
from app.features.auth.models import User
from app.features.reviews.schemas import ReviewCreate, ReviewResponse
from uuid import UUID
from typing import List, Optional

def _get_reviewer_name(user: Optional[User | str]) -> str:
    if not user:
        return "Anonymous"
    if isinstance(user, str):
        return user.split("@")[0] if "@" in user else user
    if user.display_name:
        return user.display_name
    if user.email:
        return user.email.split("@")[0]
    if user.phone_number:
        pn = user.phone_number
        if len(pn) > 6:
            return pn[:3] + "*****" + pn[-4:]
        return "User"
    return "User"

class ReviewService:
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

    async def add_review(self, user_id: UUID, review_in: ReviewCreate) -> ReviewResponse:
        place = await self.get_or_create_place(
            review_in.google_place_id,
            review_in.place_name,
            review_in.place_address,
            review_in.lat,
            review_in.lng
        )
        
        review = Review(
            user_id=user_id,
            place_id=place.id,
            rating=review_in.rating,
            comment=review_in.comment
        )
        await self.db.reviews.insert_one(review.to_dict())
        
        pipeline = [
            {"$match": {"place_id": place.id}},
            {"$group": {
                "_id": None,
                "avg_rating": {"$avg": "$rating"},
                "total_ratings": {"$sum": 1}
            }}
        ]
        cursor = self.db.reviews.aggregate(pipeline)
        res = await cursor.to_list(length=1)
        
        if res and res[0].get("total_ratings", 0) > 0:
            avg_rating = int(round(res[0]["avg_rating"]))
            total_ratings = res[0]["total_ratings"]
            await self.db.places.update_one(
                {"_id": place.id},
                {"$set": {"rating": avg_rating, "user_ratings_total": total_ratings}}
            )
            
        user_doc = await self.db.users.find_one({"_id": user_id})
        user = User.from_dict(user_doc)
        reviewer_name = _get_reviewer_name(user)
        
        return ReviewResponse(
            id=review.id,
            user_id=review.user_id,
            place_id=review.place_id,
            rating=review.rating,
            comment=review.comment,
            created_at=review.created_at,
            reviewer_name=reviewer_name
        )

    async def get_place_reviews(self, google_place_id: str) -> List[ReviewResponse]:
        place_doc = await self.db.places.find_one({"google_place_id": google_place_id})
        if not place_doc:
            return []
            
        place_id = place_doc["_id"]
        
        pipeline = [
            {"$match": {"place_id": place_id}},
            {"$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user_list"
            }},
            {"$unwind": {"path": "$user_list", "preserveNullAndEmptyArrays": True}}
        ]
        
        cursor = self.db.reviews.aggregate(pipeline)
        reviews = []
        async for doc in cursor:
            user_doc = doc.get("user_list")
            user = User.from_dict(user_doc) if user_doc else None
            reviewer_name = _get_reviewer_name(user)
            reviews.append(ReviewResponse(
                id=doc["_id"],
                user_id=doc["user_id"],
                place_id=doc["place_id"],
                rating=doc["rating"],
                comment=doc.get("comment"),
                created_at=doc["created_at"],
                reviewer_name=reviewer_name
            ))
        return reviews

    async def delete_review(self, user_id: UUID, review_id: UUID) -> bool:
        review_doc = await self.db.reviews.find_one({"_id": review_id, "user_id": user_id})
        if not review_doc:
            return False
            
        place_id = review_doc["place_id"]
        await self.db.reviews.delete_one({"_id": review_id})
        
        pipeline = [
            {"$match": {"place_id": place_id}},
            {"$group": {
                "_id": None,
                "avg_rating": {"$avg": "$rating"},
                "total_ratings": {"$sum": 1}
            }}
        ]
        cursor = self.db.reviews.aggregate(pipeline)
        res = await cursor.to_list(length=1)
        
        if res and res[0].get("total_ratings", 0) > 0:
            avg_rating = int(round(res[0]["avg_rating"]))
            total_ratings = res[0]["total_ratings"]
            await self.db.places.update_one(
                {"_id": place_id},
                {"$set": {"rating": avg_rating, "user_ratings_total": total_ratings}}
            )
        else:
            await self.db.places.update_one(
                {"_id": place_id},
                {"$set": {"rating": 0, "user_ratings_total": 0}}
            )
            
        return True

    async def get_user_reviews(self, user_id: UUID) -> List[ReviewResponse]:
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$lookup": {
                "from": "places",
                "localField": "place_id",
                "foreignField": "_id",
                "as": "place_list"
            }},
            {"$unwind": {"path": "$place_list", "preserveNullAndEmptyArrays": True}}
        ]
        
        cursor = self.db.reviews.aggregate(pipeline)
        reviews = []
        async for doc in cursor:
            user_doc = await self.db.users.find_one({"_id": user_id})
            user = User.from_dict(user_doc) if user_doc else None
            reviewer_name = _get_reviewer_name(user)
            reviews.append(ReviewResponse(
                id=doc["_id"],
                user_id=doc["user_id"],
                place_id=doc["place_id"],
                rating=doc["rating"],
                comment=doc.get("comment"),
                created_at=doc["created_at"],
                reviewer_name=reviewer_name
            ))
        return reviews
