"""Shared shipment tracking, privacy, and Give Away/Exchange coverage."""

from unittest import IsolatedAsyncioTestCase, TestCase

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import shipments as shipment_routes
from app.services.encryption import encrypt_text
from app.services.exchange_shipping import build_shipping_document, serialize_shipping_for_participant
from app.services.shipping_status import canonical_status, storage_status, timeline_for_status


class FakeShippingCollection:
    def __init__(self, documents):
        self.documents = list(documents)

    async def find_one(self, query):
        for document in self.documents:
            if query.get("_id") == document.get("_id"):
                return document
        return None

    def find(self, query):
        matched = []
        or_clause = query.get("$or")
        for document in self.documents:
            ok = True
            if or_clause:
                ok = False
                for clause in or_clause:
                    if all(document.get(key) == value for key, value in clause.items()):
                        ok = True
                        break
            for key, value in query.items():
                if key == "$or":
                    continue
                if document.get(key) != value:
                    ok = False
            if ok:
                matched.append(document)

        class Cursor:
            def __init__(self, rows):
                self.rows = rows

            def sort(self, *_args, **_kwargs):
                return self

            def __aiter__(self):
                async def gen():
                    for row in self.rows:
                        yield row
                return gen()

        return Cursor(matched)

    async def update_one(self, query, update):
        for document in self.documents:
            if document.get("_id") == query.get("_id"):
                document.update(update.get("$set") or {})
                return type("Result", (), {"modified_count": 1})()
        return type("Result", (), {"modified_count": 0})()


class ShippingStatusTests(TestCase):
    def test_aliases_map_to_canonical(self):
        self.assertEqual(canonical_status("awaiting_details"), "PENDING")
        self.assertEqual(canonical_status("awaiting_payment"), "PAYMENT_REQUIRED")
        self.assertEqual(canonical_status("shipped"), "PICKED_UP")
        self.assertEqual(canonical_status("IN_TRANSIT"), "IN_TRANSIT")
        self.assertEqual(storage_status("IN_TRANSIT"), "in_transit")

    def test_timeline_marks_current_in_transit(self):
        steps = timeline_for_status("IN_TRANSIT")
        by_key = {step["key"]: step["state"] for step in steps}
        self.assertEqual(by_key["PAYMENT_CONFIRMED"], "done")
        self.assertEqual(by_key["PICKED_UP"], "done")
        self.assertEqual(by_key["IN_TRANSIT"], "current")
        self.assertEqual(by_key["DELIVERED"], "upcoming")


class ShipmentPrivacyTests(IsolatedAsyncioTestCase):
    def setUp(self):
        self.owner_id = str(ObjectId())
        self.partner_id = str(ObjectId())
        self.stranger_id = str(ObjectId())
        self.shipment_id = ObjectId()
        self.secret_address = "12 Hidden Lane"
        self.secret_phone = "+15555550100"
        self.shipping = build_shipping_document(
            exchange_transaction_id="tx-1",
            sender_user_id=self.owner_id,
            sender_user_name="Owner",
            receiver_user_id=self.partner_id,
            receiver_user_name="Partner",
            transaction_type="EXCHANGE",
            item_title="Nike Shoes",
        )
        self.shipping["_id"] = self.shipment_id
        self.shipping["encrypted_address_line1"] = encrypt_text(self.secret_address)
        self.shipping["encrypted_phone_number"] = encrypt_text(self.secret_phone)
        self.shipping["tracking_number"] = "DHL123"
        self.shipping["carrier"] = "DHL"
        self.shipping["shipping_status"] = "in_transit"
        self.shipping["status"] = "IN_TRANSIT"
        self.collection = FakeShippingCollection([self.shipping])

        async def get_collection():
            return self.collection

        shipment_routes.get_exchange_shipping_collection_async = get_collection
        self.app = FastAPI()
        self.app.include_router(shipment_routes.router, prefix="/api")

        async def owner_user():
            return {"id": self.owner_id, "name": "Owner", "is_verified": True}

        async def partner_user():
            return {"id": self.partner_id, "name": "Partner", "is_verified": True}

        async def stranger_user():
            return {"id": self.stranger_id, "name": "Stranger", "is_verified": True}

        self.owner_user = owner_user
        self.partner_user = partner_user
        self.stranger_user = stranger_user

    def test_participant_serialize_hides_encrypted_fields(self):
        public = serialize_shipping_for_participant(self.shipping, self.partner_id)
        blob = str(public)
        self.assertNotIn(self.secret_address, blob)
        self.assertNotIn(self.secret_phone, blob)
        self.assertNotIn("encrypted_address_line1", public)
        self.assertEqual(public["tracking_number"], "DHL123")
        self.assertEqual(public["carrier"], "DHL")

    def test_owner_can_load_tracking_without_pii(self):
        self.app.dependency_overrides[shipment_routes.get_current_user] = self.owner_user
        with TestClient(self.app) as client:
            response = client.get(f"/api/shipments/{self.shipment_id}")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        blob = str(payload)
        self.assertNotIn(self.secret_address, blob)
        self.assertNotIn(self.secret_phone, blob)
        self.assertEqual(payload["tracking_number"], "DHL123")
        self.assertEqual(payload["status"], "IN_TRANSIT")
        self.assertTrue(payload["tracking_page_url"].endswith(str(self.shipment_id)))

    def test_stranger_cannot_read_shipment(self):
        self.app.dependency_overrides[shipment_routes.get_current_user] = self.stranger_user
        with TestClient(self.app) as client:
            response = client.get(f"/api/shipments/{self.shipment_id}")
        self.assertEqual(response.status_code, 403)

    def test_giveaway_payer_is_receiver(self):
        giver = str(ObjectId())
        taker = str(ObjectId())
        doc = build_shipping_document(
            exchange_transaction_id="req-1",
            sender_user_id=giver,
            sender_user_name="Giver",
            receiver_user_id=taker,
            receiver_user_name="Taker",
            transaction_type="GIVEAWAY",
            item_title="Books",
            payer_user_id=taker,
        )
        self.assertEqual(doc["transaction_type"], "GIVEAWAY")
        self.assertEqual(doc["payer_user_id"], taker)
        self.assertEqual(doc["status"], "PENDING")
