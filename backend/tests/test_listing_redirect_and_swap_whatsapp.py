"""Issues #9 and #10 — listing redirect to Browse, in-place WhatsApp for swaps."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient

from app.api.deps import auth as auth_deps
from app.api.routes.exchange_offers import router as exchange_offers_router
from app.schemas.exchange import ExchangeOfferCreateRequest

REPO_ROOT = Path(__file__).resolve().parents[2]


def run_node(script: str) -> str:
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    return result.stdout


# ── Issue #9 ─────────────────────────────────────────────────────────────────


def test_successful_listing_creation_redirects_to_browse():
    give_page = (REPO_ROOT / "src" / "pages" / "GiveItemPage.jsx").read_text(encoding="utf-8")
    app = (REPO_ROOT / "src" / "App.jsx").read_text(encoding="utf-8")

    assert "navigate('/browse'" in give_page
    assert "listingJustPublished: true" in give_page
    assert "createdItem" in give_page
    # Only navigate after the create handler returns a created item.
    assert "if (!createdItem)" in give_page
    assert "path=\"/browse\"" in app
    # The success intermediate page is no longer the post-create destination.
    assert "navigate('/item-listed-success'" not in give_page


def test_failed_or_invalid_listing_creation_does_not_redirect():
    give_page = (REPO_ROOT / "src" / "pages" / "GiveItemPage.jsx").read_text(encoding="utf-8")
    app = (REPO_ROOT / "src" / "App.jsx").read_text(encoding="utf-8")

    # Create handler returns null on validation / API failure; page bails out.
    assert "return null" in app
    assert "if (!createdItem) {\n      return\n    }" in give_page or "if (!createdItem) {\r\n      return\r\n    }" in give_page
    assert "await onCreateItem(event)" in give_page
    # Still a single POST create path in App.
    assert give_page.count("onCreateItem") >= 1
    assert "fetch(ITEMS_ENDPOINT" in app
    assert app.count("method: 'POST'") >= 1


# ── Issue #10 ────────────────────────────────────────────────────────────────


def test_whatsapp_required_error_helper_matches_backend_message():
    script = """
    import {
      isWhatsAppRequiredError,
      WHATSAPP_REQUIRED_MESSAGE,
      SWAP_WHATSAPP_REQUIRED_MESSAGE,
    } from './src/lib/whatsappRequirement.js';
    const out = {
      backend: isWhatsAppRequiredError(WHATSAPP_REQUIRED_MESSAGE),
      swapCopy: isWhatsAppRequiredError(SWAP_WHATSAPP_REQUIRED_MESSAGE),
      other: isWhatsAppRequiredError('Could not send swap offer.'),
      empty: isWhatsAppRequiredError(''),
      object: isWhatsAppRequiredError({ detail: 'Please add your WhatsApp number in Settings before listing or requesting.' }),
    };
    process.stdout.write(JSON.stringify(out));
    """
    result = json.loads(run_node(script))
    assert result["backend"] is True
    assert result["swapCopy"] is True
    assert result["other"] is False
    assert result["empty"] is False
    assert result["object"] is True


def test_propose_swap_draft_is_preserved_across_profile_roundtrip():
    script = """
    globalThis.sessionStorage = (() => {
      const store = new Map();
      return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => { store.set(key, String(value)); },
        removeItem: (key) => { store.delete(key); },
      };
    })();
    import {
      saveProposeSwapDraft,
      loadProposeSwapDraft,
      clearProposeSwapDraft,
    } from './src/lib/whatsappRequirement.js';

    const itemId = 'listing-1';
    saveProposeSwapDraft(itemId, {
      step: 2,
      sourceType: 'custom',
      customTitle: 'Jacket',
      customCondition: 'Good',
      message: 'Fair swap please.',
      cashAdjustment: '5',
      offeringCity: 'Lahore',
    });
    const same = loadProposeSwapDraft(itemId);
    const other = loadProposeSwapDraft('listing-2');
    clearProposeSwapDraft(itemId);
    const afterClear = loadProposeSwapDraft(itemId);
    process.stdout.write(JSON.stringify({ same, other, afterClear }));
    """
    result = json.loads(run_node(script))
    assert result["same"]["customTitle"] == "Jacket"
    assert result["same"]["customCondition"] == "Good"
    assert result["same"]["message"] == "Fair swap please."
    assert result["same"]["cashAdjustment"] == "5"
    assert result["other"] is None
    assert result["afterClear"] is None


def test_propose_swap_modal_shows_inplace_whatsapp_popup_not_backward_navigation():
    modal = (REPO_ROOT / "src" / "components" / "ProposeSwapModal.jsx").read_text(encoding="utf-8")
    app = (REPO_ROOT / "src" / "App.jsx").read_text(encoding="utf-8")
    details = (REPO_ROOT / "src" / "pages" / "ItemDetailsPage.jsx").read_text(encoding="utf-8")
    card = (REPO_ROOT / "src" / "components" / "ItemCard.jsx").read_text(encoding="utf-8")

    assert "WhatsApp number required" in modal
    assert "Add WhatsApp Number" in modal
    assert "showWhatsAppPopup" in modal
    assert "isWhatsAppRequiredError" in modal
    assert "saveProposeSwapDraft" in modal
    assert "missingWhatsApp={userNeedsWhatsApp(currentUser)}" in app
    assert "missingWhatsApp={userNeedsWhatsApp(currentUser)}" in details
    # Opening swap must not navigate the user to profile first.
    assert "navigate('/profile', { state: { whatsappRequired: true } })" not in app.split("function openRequestModal")[1].split("async function handleCreateRequest")[0]
    assert "showFlash(WHATSAPP_REQUIRED_MESSAGE)" not in details
    assert "WHATSAPP_REQUIRED_MESSAGE" not in card


def test_add_whatsapp_action_returns_to_listing_and_resumes_swap():
    modal = (REPO_ROOT / "src" / "components" / "ProposeSwapModal.jsx").read_text(encoding="utf-8")
    profile = (REPO_ROOT / "src" / "pages" / "ProfilePage.jsx").read_text(encoding="utf-8")
    details = (REPO_ROOT / "src" / "pages" / "ItemDetailsPage.jsx").read_text(encoding="utf-8")

    assert "returnTo: `/items/${item.id}`" in modal
    assert "resumeSwapItemId: item.id" in modal
    assert "navigate(returnTo" in profile
    assert "resumeSwapItemId" in profile
    assert "location.state?.resumeSwapItemId" in details
    assert "setSwapModalOpen(true)" in details


def test_backend_still_rejects_swap_without_whatsapp():
    """The dependency must keep rejecting; the frontend must not bypass it."""
    auth_source = (REPO_ROOT / "app" / "api" / "deps" / "auth.py").read_text(encoding="utf-8")
    offers_source = (REPO_ROOT / "app" / "api" / "routes" / "exchange_offers.py").read_text(encoding="utf-8")

    assert "async def get_whatsapp_user" in auth_source
    assert "Please add your WhatsApp number in Settings before listing or requesting." in auth_source
    assert "get_whatsapp_user" in offers_source

    app = FastAPI()

    async def reject_without_whatsapp():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please add your WhatsApp number in Settings before listing or requesting.",
        )

    app.dependency_overrides[auth_deps.get_whatsapp_user] = reject_without_whatsapp
    app.include_router(exchange_offers_router, prefix="/api")

    with TestClient(app) as client:
        response = client.post(
            "/api/exchange-offers",
            json={
                "listing_id": str(ObjectId()),
                "custom_item_title": "Jacket",
                "custom_item_condition": "Good",
                "custom_item_image": "https://cdn.example.com/jacket.jpg",
                "offering_user_city": "Lahore",
                "message": "Would love to swap this jacket for your shoes.",
            },
        )

    assert response.status_code == 400
    assert "WhatsApp" in response.json()["detail"]


def test_valid_custom_swap_payload_still_accepted_by_schema():
    payload = ExchangeOfferCreateRequest(
        listing_id=str(ObjectId()),
        custom_item_title="Jacket",
        custom_item_condition="Good",
        custom_item_image="https://cdn.example.com/jacket.jpg",
        offering_user_city="Lahore",
        message="Would love to swap this jacket for your shoes.",
    )
    assert payload.custom_item_condition == "Good"


def test_other_swap_errors_are_not_treated_as_whatsapp_requirement():
    script = """
    import { isWhatsAppRequiredError } from './src/lib/whatsappRequirement.js';
    const cases = [
      'Could not send swap offer.',
      'Select one of your listings to offer.',
      'Unauthorized',
      'Database connection is not available.',
    ];
    process.stdout.write(JSON.stringify(cases.map((message) => isWhatsAppRequiredError(message))));
    """
    assert json.loads(run_node(script)) == [False, False, False, False]
