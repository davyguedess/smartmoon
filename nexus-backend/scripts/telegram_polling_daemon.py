import requests
import json
import time
import sys

TOKEN = "8766162857:AAFMHV-ACeNi8kF9OTT9biDamAGPm_Q7ck8"
WEBHOOK_URL = "http://127.0.0.1:8000/webhook/telegram/receive"

def get_updates(offset=None):
    url = f"https://api.telegram.org/bot{TOKEN}/getUpdates"
    params = {"timeout": 30, "offset": offset}
    try:
        r = requests.get(url, params=params, timeout=35)
        return r.json()
    except Exception as e:
        print(f"Error getting updates: {e}")
        return None

def send_to_webhook(payload):
    try:
        # Include token in query param for better company matching
        url = f"{WEBHOOK_URL}?token={TOKEN}"
        r = requests.post(url, json=payload, timeout=10)
        return r.status_code
    except Exception as e:
        print(f"Error sending to webhook: {e}")
        return None

if __name__ == "__main__":
    print(f"🚀 Telegram Polling Daemon started for bot token ending in ...{TOKEN[-5:]}")
    offset = None
    
    # Reset webhook to allow polling
    requests.get(f"https://api.telegram.org/bot{TOKEN}/deleteWebhook")
    
    while True:
        updates = get_updates(offset)
        if updates and updates.get("ok"):
            for update in updates["result"]:
                update_id = update["update_id"]
                print(f"📥 Processing update {update_id}...")
                
                status = send_to_webhook(update)
                if status == 200:
                    print(f"✅ Sent to webhook: {status}")
                else:
                    print(f"⚠️ Webhook error: {status}")
                
                offset = update_id + 1
        
        time.sleep(1)
