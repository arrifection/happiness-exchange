from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

from app.services.location import require_allowed_city

ListingMode = Literal["GIVEAWAY", "EXCHANGE", "BOTH"]

ExchangeOfferStatus = Literal[
    "PENDING",
    "UNDER_REVIEW",
    "ACCEPTED",
    "DECLINED",
    "COUNTERED",
    "EXPIRED",
    "CANCELLED",
    "SHIPPING",
    "SHIPPED",
    "DELIVERED",
    "COMPLETED",
]

ExchangeTransactionStatus = Literal[
    "ACCEPTED",
    "COLLECTING_SHIPPING",
    "AWAITING_PAYMENT",
    "PAID",
    "SHIPPING",
    "SHIPPED",
    "DELIVERED",
    "COMPLETED",
    "EXPIRED",
    "CANCELLED",
]

ExchangeShippingStatus = Literal[
    "awaiting_details",
    "awaiting_payment",
    "paid",
    "ready_to_ship",
    "pickup_scheduled",
    "shipped",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "delivery_failed",
    "returned",
    "cancelled",
    "PENDING",
    "PAYMENT_REQUIRED",
    "PAYMENT_CONFIRMED",
    "READY_TO_SHIP",
    "PICKUP_SCHEDULED",
    "PICKED_UP",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "DELIVERY_FAILED",
    "RETURNED",
    "CANCELLED",
]

PaymentStatus = Literal["pending", "paid", "failed", "refunded"]


class ExchangeOfferCreateRequest(BaseModel):
    listing_id: str
    offered_listing_id: str | None = None
    custom_item_image: HttpUrl | None = None
    custom_item_title: str | None = Field(default=None, max_length=120)
    custom_item_description: str | None = Field(default=None, max_length=2000)
    custom_item_condition: str | None = Field(default=None, max_length=60)
    custom_item_estimated_value: Decimal | None = Field(default=None, ge=0)
    message: str = Field(min_length=10, max_length=2000)
    cash_adjustment: Decimal | None = Field(default=None)
    offering_user_city: str = Field(..., min_length=2, max_length=120)

    @field_validator("offering_user_city")
    @classmethod
    def validate_offering_user_city(cls, value: str) -> str:
        return require_allowed_city(value)

    @model_validator(mode="after")
    def validate_offer_source(self):
        has_listing = bool(self.offered_listing_id and self.offered_listing_id.strip())
        has_custom = bool(
            self.custom_item_title
            and self.custom_item_title.strip()
            and self.custom_item_condition
            and self.custom_item_condition.strip()
        )
        if has_listing and has_custom:
            raise ValueError("Provide either an existing listing or a custom item, not both.")
        if not has_listing and not has_custom:
            raise ValueError("Select one of your listings or describe a custom item to offer.")
        if has_custom and not self.custom_item_image:
            raise ValueError("A custom swap item requires an image.")
        return self


class ExchangeCounterOfferRequest(BaseModel):
    message: str = Field(min_length=5, max_length=2000)
    offered_listing_id: str | None = None
    custom_item_title: str | None = Field(default=None, max_length=120)
    custom_item_description: str | None = Field(default=None, max_length=2000)
    custom_item_condition: str | None = Field(default=None, max_length=60)
    custom_item_image: HttpUrl | None = None
    cash_adjustment: Decimal | None = Field(default=None)


class ExchangeOfferResponse(BaseModel):
    id: str
    listing_id: str
    listing_title: str
    offering_user_id: str
    offering_user_name: str
    offering_user_city: str | None = None
    owner_user_id: str
    owner_user_name: str
    offered_listing_id: str | None = None
    offered_listing_title: str | None = None
    offered_listing_image: str | None = None
    custom_item_image: str | None = None
    custom_item_title: str | None = None
    custom_item_description: str | None = None
    custom_item_condition: str | None = None
    custom_item_estimated_value: float | None = None
    message: str
    cash_adjustment: float | None = None
    status: ExchangeOfferStatus
    counter_message: str | None = None
    counter_cash_adjustment: float | None = None
    counter_offered_listing_id: str | None = None
    counter_custom_item_title: str | None = None
    counter_custom_item_description: str | None = None
    counter_custom_item_condition: str | None = None
    counter_custom_item_image: str | None = None
    transaction_id: str | None = None
    created_at: datetime
    updated_at: datetime
    expires_at: datetime | None = None


class ExchangeOfferListResponse(BaseModel):
    offers: list[ExchangeOfferResponse]
    total: int


class ExchangeShippingDetailsRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone_number: str = Field(min_length=7, max_length=30)
    address_line1: str = Field(min_length=5, max_length=200)
    address_line2: str | None = Field(default=None, max_length=200)
    city: str = Field(min_length=2, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    postal_code: str = Field(min_length=3, max_length=20)
    country: str = Field(min_length=2, max_length=80)
    notes: str | None = Field(default=None, max_length=500)


class ExchangePayShippingRequest(BaseModel):
    payment_reference: str = Field(min_length=3, max_length=120)


class ExchangeShippingPublicResponse(BaseModel):
    id: str
    sender_user_id: str
    sender_user_name: str
    receiver_user_id: str
    receiver_user_name: str | None = None
    payer_user_id: str | None = None
    transaction_id: str | None = None
    transaction_type: str | None = None
    item_title: str | None = None
    shipping_status: str
    status: str | None = None
    status_label: str | None = None
    shipping_cost: float | None = None
    payment_status: PaymentStatus
    payment_due_at: datetime | None = None
    tracking_number: str | None = None
    tracking_url: str | None = None
    tracking_page_url: str | None = None
    carrier: str | None = None
    estimated_delivery: datetime | None = None
    shipped_at: datetime | None = None
    delivered_at: datetime | None = None
    admin_instructions: str | None = None
    timeline: list[dict] = Field(default_factory=list)
    updated_at: datetime
    created_at: datetime | None = None


class ExchangeTransactionResponse(BaseModel):
    id: str
    exchange_offer_id: str
    listing_id: str
    listing_title: str
    listing_image_url: str | None = None
    offered_item_title: str | None = None
    offered_item_image: str | None = None
    offered_item_description: str | None = None
    offered_item_condition: str | None = None
    cash_adjustment: float | None = None
    user_a_id: str
    user_a_name: str
    user_b_id: str
    user_b_name: str
    status: ExchangeTransactionStatus
    shipping_records: list[ExchangeShippingPublicResponse] = Field(default_factory=list)
    created_at: datetime
    completed_at: datetime | None = None


class ExchangeImageUploadResponse(BaseModel):
    secure_url: HttpUrl


class AdminExchangeShippingUpdateRequest(BaseModel):
    shipping_cost: float | None = Field(default=None, ge=0)
    shipping_status: ExchangeShippingStatus | None = None
    payment_status: PaymentStatus | None = None
    tracking_number: str | None = Field(default=None, max_length=120)
    tracking_url: str | None = Field(default=None, max_length=500)
    carrier: str | None = Field(default=None, max_length=80)
    estimated_delivery: datetime | None = None
    admin_notes: str | None = Field(default=None, max_length=2000)
    admin_instructions: str | None = Field(default=None, max_length=2000)


class AdminExchangeTransactionStatusRequest(BaseModel):
    status: ExchangeTransactionStatus
