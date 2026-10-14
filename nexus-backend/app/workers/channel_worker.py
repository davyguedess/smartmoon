from app.workers.tasks import process_channel_message_task

async def enqueue_channel_message(
    db, conversation_id: int, text: str, channel: str,
    group_id: str = None, integration_id: int = None,
    media_path: str = None, msg_type: str = "text",
):
    """Enqueue a channel message for asynchronous processing."""
    process_channel_message_task.delay(
        conversation_id, text, channel,
        group_id=group_id,
        integration_id=integration_id,
        media_path=media_path,
        msg_type=msg_type,
    )
