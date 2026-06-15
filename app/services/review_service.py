from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.db.models import Review, Place, User
from app.schemas.review import ReviewCreate, ReviewResponse
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
            await self.db.flush() # Flush to assign database generated properties
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
        self.db.add(review)
        await self.db.flush()
        
        # Recalculate average ratings
        stmt = select(
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.id).label("total_ratings")
        ).where(Review.place_id == place.id)
        res = await self.db.execute(stmt)
        stats = res.first()
        
        if stats and stats.total_ratings > 0:
            place.rating = int(round(stats.avg_rating))
            place.user_ratings_total = stats.total_ratings
            
        await self.db.commit()
        await self.db.refresh(review)
        
        # Fetch reviewer name
        user_stmt = select(User).where(User.id == user_id)
        user_res = await self.db.execute(user_stmt)
        user = user_res.scalars().first()
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
        place_stmt = select(Place).where(Place.google_place_id == google_place_id)
        place_res = await self.db.execute(place_stmt)
        place = place_res.scalars().first()
        if not place:
            return []
            
        stmt = select(Review, User).join(User, Review.user_id == User.id).where(Review.place_id == place.id)
        result = await self.db.execute(stmt)
        reviews = []
        for row in result:
            review = row[0]
            user = row[1]
            reviewer_name = _get_reviewer_name(user)
            reviews.append(ReviewResponse(
                id=review.id,
                user_id=review.user_id,
                place_id=review.place_id,
                rating=review.rating,
                comment=review.comment,
                created_at=review.created_at,
                reviewer_name=reviewer_name
            ))
        return reviews

    async def delete_review(self, user_id: UUID, review_id: UUID) -> bool:
        stmt = select(Review).where(Review.id == review_id, Review.user_id == user_id)
        result = await self.db.execute(stmt)
        review = result.scalars().first()
        if not review:
            return False
            
        place_id = review.place_id
        await self.db.delete(review)
        await self.db.flush()
        
        # Recalculate average ratings
        stmt = select(
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.id).label("total_ratings")
        ).where(Review.place_id == place_id)
        res = await self.db.execute(stmt)
        stats = res.first()
        
        place_stmt = select(Place).where(Place.id == place_id)
        place_res = await self.db.execute(place_stmt)
        place = place_res.scalars().first()
        
        if place:
            if stats and stats.total_ratings > 0:
                place.rating = int(round(stats.avg_rating))
                place.user_ratings_total = stats.total_ratings
            else:
                place.rating = 0
                place.user_ratings_total = 0
                
        await self.db.commit()
        return True
