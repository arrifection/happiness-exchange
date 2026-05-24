from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class DeliveryCreateRequest(BaseModel):
    request_id: str
    pickup_address: str
    pickup_contact_number: str
    pickup_preferred_time: str
    pickup_notes: str | None = None

class DeliveryDropoffRequest(BaseModel):
    dropoff_address: str
    receiver_contact_number: str
    dropoff_preferred_time: str
    dropoff_notes: str | None = None

class DeliveryStatusUpdateRequest(BaseModel):
    status: str
    notes: str | None = None

class DeliveryResponse(BaseModel):
    id: str
    request_id: str
    item_id: str
    item_title: str
    giver_id: str
    receiver_id: str
    status: str
    
    # Encrypted fields (masked for normal users, decrypted for courier/admin)
    pickup_address: str | None = None
    pickup_contact_number: str | None = None
    pickup_preferred_time: str | None = None
    pickup_notes: str | None = None
    
    dropoff_address: str | None = None
    receiver_contact_number: str | None = None
    dropoff_preferred_time: str | None = None
    dropoff_notes: str | None = None
    
    courier_id: str | None = None
    proof_of_delivery_url: str | None = None
    notes: str | None = None
    
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
