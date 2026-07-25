from pydantic import BaseModel, ConfigDict, Field
from typing import Annotated

class SecureBaseModel(BaseModel):
    """
    Ironclad Base Pydantic Model.
    Enforces 'extra = forbid' to prevent parameter injection / mass assignment attacks,
    and 'str_strip_whitespace = True' to clean and sanitize string inputs automatically.
    """
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        validate_assignment=True
    )

# Reusable Security-Constrained Fields
Latitude = Annotated[float, Field(ge=-90.0, le=90.0, description="Latitude in degrees (-90 to +90)")]
Longitude = Annotated[float, Field(ge=-180.0, le=180.0, description="Longitude in degrees (-180 to +180)")]
NonEmptyString = Annotated[str, Field(min_length=1, max_length=256, description="Sanitized non-empty string max 256 chars")]
LongDescription = Annotated[str, Field(min_length=1, max_length=2000, description="Sanitized description max 2000 chars")]
NonNegativeFloat = Annotated[float, Field(ge=0.0, description="Non-negative floating point number")]
PositiveInt = Annotated[int, Field(ge=1, description="Positive integer >= 1")]
HeadingDeg = Annotated[float, Field(ge=0.0, le=360.0, description="Compass heading in degrees (0.0 to 360.0)")]
