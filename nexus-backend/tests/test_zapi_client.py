"""
Tests for Z-API Client — validates request construction, error handling, and response parsing.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.zapi_client import ZAPIClient, _post, ZAPI_BASE


# ── Helper ──────────────────────────────────────────────

INSTANCE_ID = "test-instance-123"
TOKEN = "test-token-456"
CLIENT_TOKEN = "test-client-token-789"
TEST_PHONE = "5511999998888"


def _mock_response(status_code=200, json_data=None):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        resp.raise_for_status.side_effect = Exception(f"HTTP {status_code}")
    return resp


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  URL Building
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def test_build_url():
    url = ZAPIClient._build_url("inst-1", "tok-1", "send-text")
    assert url == f"{ZAPI_BASE}/instances/inst-1/token/tok-1/send-text"


def test_build_url_with_nested_endpoint():
    url = ZAPIClient._build_url("inst-1", "tok-1", "phone-exists/5511999")
    assert url == f"{ZAPI_BASE}/instances/inst-1/token/tok-1/phone-exists/5511999"


def test_headers():
    headers = ZAPIClient._headers("my-client-token")
    assert headers["Client-Token"] == "my-client-token"
    assert headers["Content-Type"] == "application/json"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Send Text
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@pytest.mark.asyncio
async def test_send_text_success():
    mock_resp = {"zapiMessageId": "msg-123", "messageId": "mid-456"}

    with patch("app.services.zapi_client._post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        result = await ZAPIClient.send_text(INSTANCE_ID, TOKEN, CLIENT_TOKEN, TEST_PHONE, "Hello!")

    mock_post.assert_called_once()
    args = mock_post.call_args
    assert "send-text" in args[0][0]
    assert args[0][1]["phone"] == TEST_PHONE
    assert args[0][1]["message"] == "Hello!"
    assert result == mock_resp


@pytest.mark.asyncio
async def test_send_text_error():
    mock_resp = {"error": "Invalid phone", "status_code": 400}

    with patch("app.services.zapi_client._post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        result = await ZAPIClient.send_text(INSTANCE_ID, TOKEN, CLIENT_TOKEN, "invalid", "Hi")

    assert "error" in result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Send Image
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@pytest.mark.asyncio
async def test_send_image_with_caption():
    with patch("app.services.zapi_client._post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = {"zapiMessageId": "img-1"}
        await ZAPIClient.send_image(
            INSTANCE_ID, TOKEN, CLIENT_TOKEN, TEST_PHONE,
            "https://example.com/photo.jpg", caption="Look at this!"
        )

    payload = mock_post.call_args[0][1]
    assert payload["phone"] == TEST_PHONE
    assert payload["image"] == "https://example.com/photo.jpg"
    assert payload["caption"] == "Look at this!"


@pytest.mark.asyncio
async def test_send_image_without_caption():
    with patch("app.services.zapi_client._post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = {"zapiMessageId": "img-2"}
        await ZAPIClient.send_image(
            INSTANCE_ID, TOKEN, CLIENT_TOKEN, TEST_PHONE,
            "https://example.com/photo.jpg"
        )

    payload = mock_post.call_args[0][1]
    assert "caption" not in payload


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Send Document
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@pytest.mark.asyncio
async def test_send_document():
    with patch("app.services.zapi_client._post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = {}
        await ZAPIClient.send_document(
            INSTANCE_ID, TOKEN, CLIENT_TOKEN, TEST_PHONE,
            "https://example.com/doc.pdf", filename="contract.pdf"
        )

    payload = mock_post.call_args[0][1]
    assert payload["document"] == "https://example.com/doc.pdf"
    assert payload["fileName"] == "contract.pdf"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Send Audio / Video
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@pytest.mark.asyncio
async def test_send_audio():
    with patch("app.services.zapi_client._post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = {}
        await ZAPIClient.send_audio(
            INSTANCE_ID, TOKEN, CLIENT_TOKEN, TEST_PHONE,
            "https://example.com/audio.ogg"
        )

    payload = mock_post.call_args[0][1]
    assert payload["audio"] == "https://example.com/audio.ogg"


@pytest.mark.asyncio
async def test_send_video_with_caption():
    with patch("app.services.zapi_client._post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = {}
        await ZAPIClient.send_video(
            INSTANCE_ID, TOKEN, CLIENT_TOKEN, TEST_PHONE,
            "https://example.com/video.mp4", caption="Watch!"
        )

    payload = mock_post.call_args[0][1]
    assert payload["video"] == "https://example.com/video.mp4"
    assert payload["caption"] == "Watch!"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Read Message
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@pytest.mark.asyncio
async def test_read_message():
    with patch("app.services.zapi_client._post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = {"success": True}
        await ZAPIClient.read_message(
            INSTANCE_ID, TOKEN, CLIENT_TOKEN, TEST_PHONE, "msg-id-123"
        )

    payload = mock_post.call_args[0][1]
    assert payload["phone"] == TEST_PHONE
    assert payload["messageId"] == "msg-id-123"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Button List
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@pytest.mark.asyncio
async def test_send_button_list():
    buttons = [{"id": "1", "label": "Option A"}, {"id": "2", "label": "Option B"}]

    with patch("app.services.zapi_client._post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = {}
        await ZAPIClient.send_button_list(
            INSTANCE_ID, TOKEN, CLIENT_TOKEN, TEST_PHONE, "Choose one:", buttons
        )

    payload = mock_post.call_args[0][1]
    assert payload["message"] == "Choose one:"
    assert payload["buttonList"]["buttons"] == buttons


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  _post helper
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@pytest.mark.asyncio
async def test_post_success():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"zapiMessageId": "ok-123"}

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.services.zapi_client.httpx.AsyncClient", return_value=mock_client):
        result = await _post("https://api.z-api.io/test", {"phone": "123"}, "client-tok")

    assert result == {"zapiMessageId": "ok-123"}


@pytest.mark.asyncio
async def test_post_api_error():
    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.json.return_value = {"message": "Invalid phone number"}

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_resp
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.services.zapi_client.httpx.AsyncClient", return_value=mock_client):
        result = await _post("https://api.z-api.io/test", {}, "tok")

    assert "error" in result
    assert result["status_code"] == 400


@pytest.mark.asyncio
async def test_post_network_error():
    mock_client = AsyncMock()
    mock_client.post.side_effect = Exception("Connection timeout")
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.services.zapi_client.httpx.AsyncClient", return_value=mock_client):
        result = await _post("https://api.z-api.io/test", {}, "tok")

    assert "error" in result
    assert "Connection timeout" in result["error"]
